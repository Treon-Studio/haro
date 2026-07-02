import type { ChangedFile, WebhookPayload } from '../types/github';

export class WebhookHandler {
  constructor(private secret: string) {}

  async verify(request: Request): Promise<boolean> {
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) return false;

    const body = await request.clone().text();
    const expectedSig = await this.sign(body);

    return signature === `sha256=${expectedSig}`;
  }

  async parsePayload(body: string): Promise<WebhookPayload> {
    const payload = JSON.parse(body);

    const changedFiles: ChangedFile[] = [];

    for (const commit of payload.commits || []) {
      for (const file of [...(commit.added || []), ...(commit.modified || [])]) {
        if (file.endsWith('.md')) {
          changedFiles.push({ path: file, status: 'modified' });
        }
      }
      for (const file of commit.removed || []) {
        if (file.endsWith('.md')) {
          changedFiles.push({ path: file, status: 'removed' });
        }
      }
    }

    return {
      ref: payload.ref,
      commits: payload.commits || [],
      changedFiles: this.deduplicate(changedFiles),
    };
  }

  private async sign(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private deduplicate(files: ChangedFile[]): ChangedFile[] {
    const seen = new Map<string, ChangedFile>();
    for (const file of files) {
      seen.set(file.path, file);
    }
    return Array.from(seen.values());
  }
}
