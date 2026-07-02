import type { OkfDocument, DocStats, LinkGraph, TagIndex, CategoryIndex } from '../types/okf';

const KEY_DOC = (id: string) => `doc:${id}`;
const KEY_TAGS = 'index:tags';
const KEY_CATEGORIES = 'index:categories';
const KEY_LINKS = 'index:links';
const KEY_STATS = 'meta:stats';

export class KvStore {
  constructor(private kv: KVNamespace) {}

  async getDoc(id: string): Promise<OkfDocument | null> {
    const raw = await this.kv.get(KEY_DOC(id), 'json');
    return raw as OkfDocument | null;
  }

  async putDoc(doc: OkfDocument): Promise<void> {
    await this.kv.put(KEY_DOC(doc.id), JSON.stringify(doc), {
      metadata: { updated: doc.sync.last_synced },
    });
  }

  async deleteDoc(id: string): Promise<void> {
    await this.kv.delete(KEY_DOC(id));
  }

  async listDocIds(): Promise<string[]> {
    const list = await this.kv.list({ prefix: 'doc:' });
    return list.keys.map(k => k.name.slice(4));
  }

  async getTagIndex(): Promise<TagIndex> {
    const raw = await this.kv.get(KEY_TAGS, 'json');
    return (raw as TagIndex) || {};
  }

  async putTagIndex(index: TagIndex): Promise<void> {
    await this.kv.put(KEY_TAGS, JSON.stringify(index));
  }

  async getCategoryIndex(): Promise<CategoryIndex> {
    const raw = await this.kv.get(KEY_CATEGORIES, 'json');
    return (raw as CategoryIndex) || {};
  }

  async putCategoryIndex(index: CategoryIndex): Promise<void> {
    await this.kv.put(KEY_CATEGORIES, JSON.stringify(index));
  }

  async getLinkGraph(): Promise<LinkGraph> {
    const raw = await this.kv.get(KEY_LINKS, 'json');
    return (raw as LinkGraph) || {};
  }

  async putLinkGraph(graph: LinkGraph): Promise<void> {
    await this.kv.put(KEY_LINKS, JSON.stringify(graph));
  }

  async getStats(): Promise<DocStats> {
    const raw = await this.kv.get(KEY_STATS, 'json');
    return (raw as DocStats) || {
      total_docs: 0,
      last_full_sync: '',
      last_incremental_sync: '',
      sync_status: 'idle',
      version: '',
    };
  }

  async putStats(stats: DocStats): Promise<void> {
    await this.kv.put(KEY_STATS, JSON.stringify(stats));
  }

  async searchDocs(query: string): Promise<string[]> {
    const ids = await this.listDocIds();
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    for (const id of ids) {
      const doc = await this.getDoc(id);
      if (!doc) continue;

      if (
        doc.id.toLowerCase().includes(lowerQuery) ||
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.content.plain_text.toLowerCase().includes(lowerQuery) ||
        doc.metadata.tags.some(t => t.toLowerCase().includes(lowerQuery))
      ) {
        results.push(id);
      }
    }

    return results;
  }
}
