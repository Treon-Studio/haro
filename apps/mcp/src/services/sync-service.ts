import type { SyncConfig, SyncResult, ChangedFile } from '../types/github';
import type { OkfDocument, DocStats } from '../types/okf';
import { GitHubClient } from '../github/client';
import { parseDocument, buildDocument } from '../github/parser';
import { KvStore } from '../kv/store';
import { buildTagIndex, buildCategoryIndex, buildLinkGraph, updateIndexesForDoc, removeFromIndexes } from '../kv/index';

export class SyncService {
  private github: GitHubClient;
  private syncInProgress = false;

  constructor(
    private store: KvStore,
    private config: SyncConfig,
  ) {
    this.github = new GitHubClient(config);
  }

  async fullSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { updated: 0, deleted: 0, syncedAt: new Date().toISOString(), totalDocs: 0 };
    }

    this.syncInProgress = true;

    try {
      await this.store.putStats({
        total_docs: 0,
        last_full_sync: '',
        last_incremental_sync: '',
        sync_status: 'syncing',
        version: '',
      });

      const gitSha = await this.github.getLatestCommitSha(this.config.branch);
      const mdFiles = await this.github.listMdFiles(this.config.branch, this.config.docsPath);

      const docs: OkfDocument[] = [];
      let version = 1;

      for (const filePath of mdFiles) {
        try {
          const rawContent = await this.github.getContent(filePath);
          const parsed = parseDocument(rawContent, filePath, gitSha);
          const doc = buildDocument(parsed, gitSha, version);
          docs.push(doc);
          version++;
        } catch (err) {
          console.error(`Failed to sync ${filePath}:`, err);
        }
      }

      const tagIndex = buildTagIndex(docs);
      const categoryIndex = buildCategoryIndex(docs);
      const linkGraph = buildLinkGraph(docs);

      for (const doc of docs) {
        await this.store.putDoc(doc);
      }

      await this.store.putTagIndex(tagIndex);
      await this.store.putCategoryIndex(categoryIndex);
      await this.store.putLinkGraph(linkGraph);

      const stats: DocStats = {
        total_docs: docs.length,
        last_full_sync: new Date().toISOString(),
        last_incremental_sync: new Date().toISOString(),
        sync_status: 'completed',
        version: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      };
      await this.store.putStats(stats);

      return {
        totalDocs: docs.length,
        updated: docs.length,
        deleted: 0,
        syncedAt: stats.last_full_sync,
        gitSha,
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  async incrementalSync(changedFiles: ChangedFile[]): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { updated: 0, deleted: 0, syncedAt: new Date().toISOString() };
    }

    this.syncInProgress = true;

    try {
      const gitSha = await this.github.getLatestCommitSha(this.config.branch);
      const updates: string[] = [];
      const deletions: string[] = [];
      const tagIndex = await this.store.getTagIndex();
      const categoryIndex = await this.store.getCategoryIndex();
      const linkGraph = await this.store.getLinkGraph();

      const mdFiles = changedFiles.filter(f => f.path.endsWith('.md') && f.path.startsWith(this.config.docsPath));

      for (const file of mdFiles) {
        if (file.status === 'removed') {
          const id = this.extractIdFromPath(file.path);
          const existing = await this.store.getDoc(id);
          if (existing) {
            removeFromIndexes(id, tagIndex, categoryIndex, linkGraph);
            await this.store.deleteDoc(id);
            deletions.push(id);
          }
        } else {
          try {
            const rawContent = await this.github.getContent(file.path);
            const parsed = parseDocument(rawContent, file.path, gitSha);
            const existing = await this.store.getDoc(parsed.id);
            const version = existing ? existing.sync.version + 1 : 1;
            const doc = buildDocument(parsed, gitSha, version);

            if (existing) {
              removeFromIndexes(parsed.id, tagIndex, categoryIndex, linkGraph);
            }

            updateIndexesForDoc(doc, tagIndex, categoryIndex, linkGraph);
            await this.store.putDoc(doc);
            updates.push(parsed.id);
          } catch (err) {
            console.error(`Failed to sync ${file.path}:`, err);
          }
        }
      }

      if (mdFiles.length > 0) {
        await this.store.putTagIndex(tagIndex);
        await this.store.putCategoryIndex(categoryIndex);
        await this.store.putLinkGraph(linkGraph);
      }

      const stats = await this.store.getStats();
      stats.total_docs = (await this.store.listDocIds()).length;
      stats.last_incremental_sync = new Date().toISOString();
      stats.sync_status = 'completed';
      await this.store.putStats(stats);

      return {
        updated: updates.length,
        deleted: deletions.length,
        syncedAt: stats.last_incremental_sync,
        gitSha,
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  private extractIdFromPath(path: string): string {
    const basename = path.split('/').pop() || '';
    return basename.replace(/\.md$/, '');
  }
}
