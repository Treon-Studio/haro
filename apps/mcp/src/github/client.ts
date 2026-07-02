import type { GitHubTree, GitHubContent, GitHubBlob, SyncConfig } from '../types/github';
import { GitHubApiError } from '../utils/errors';

export class GitHubClient {
  private baseUrl = 'https://api.github.com';

  constructor(private config: SyncConfig) {}

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'OKF-MCP-Server',
    };
  }

  async getTree(branch: string, recursive = false): Promise<GitHubTree> {
    const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/git/trees/${encodeURIComponent(branch)}${recursive ? '?recursive=1' : ''}`;
    return this.fetchJSON<GitHubTree>(url);
  }

  async getContent(path: string): Promise<string> {
    const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${encodeURIComponent(path)}`;
    const data = await this.fetchJSON<GitHubContent>(url);

    if (data.content && data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''));
    }
    throw new GitHubApiError(422, 'No content found in response');
  }

  async getBlob(sha: string): Promise<string> {
    const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/git/blobs/${sha}`;
    const data = await this.fetchJSON<GitHubBlob>(url);
    return atob(data.content);
  }

  async getLatestCommitSha(branch: string): Promise<string> {
    const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/branches/${encodeURIComponent(branch)}`;
    const data = await this.fetchJSON<{ commit: { sha: string } }>(url);
    return data.commit.sha;
  }

  async listMdFiles(branch: string, docsPath: string): Promise<string[]> {
    const tree = await this.getTree(branch, true);
    return tree.tree
      .filter(f => f.type === 'blob' && f.path.startsWith(docsPath) && f.path.endsWith('.md'))
      .map(f => f.path);
  }

  private async fetchJSON<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      const text = await response.text();
      throw new GitHubApiError(response.status, text.slice(0, 200));
    }

    return response.json() as Promise<T>;
  }
}
