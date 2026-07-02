import type { OkfSearchResult, OkfDocument } from '../types/okf';
import { KvStore } from '../kv/store';
import { generateExcerpt } from '../utils/markdown';

export interface SearchFilters {
  query?: string;
  tags?: string[];
  category?: string;
  status?: string;
  limit?: number;
  includeContent?: boolean;
}

export class SearchService {
  constructor(private store: KvStore) {}

  async search(filters: SearchFilters): Promise<{ results: OkfSearchResult[]; total: number; filtersApplied: Record<string, unknown> }> {
    const { query, tags, category, status, limit = 10 } = filters;

    let candidates = await this.store.listDocIds();
    const filterLog: Record<string, unknown> = {};

    if (query) {
      candidates = await this.filterByQuery(candidates, query);
      filterLog.query = query;
    }

    if (tags && tags.length > 0) {
      const tagIndex = await this.store.getTagIndex();
      const tagIds = new Set<string>();
      for (const tag of tags) {
        for (const id of tagIndex[tag] || []) tagIds.add(id);
      }
      candidates = candidates.filter(id => tagIds.has(id));
      filterLog.tags = tags;
    }

    if (category) {
      candidates = await this.filterByCategory(candidates, category);
      filterLog.category = category;
    }

    if (status) {
      candidates = await this.filterByStatus(candidates, status);
      filterLog.status = status;
    }

    const results: OkfSearchResult[] = [];

    for (const id of candidates.slice(0, limit * 3)) {
      const doc = await this.store.getDoc(id);
      if (!doc) continue;

      let score = 0.5;
      if (query) {
        const qLower = query.toLowerCase();
        if (doc.id.toLowerCase().includes(qLower)) score += 0.3;
        if (doc.title.toLowerCase().includes(qLower)) score += 0.2;
        const occurrences = (doc.content.plain_text.toLowerCase().match(new RegExp(qLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        score += Math.min(occurrences * 0.005, 0.2);
      }
      if (doc.metadata.context_priority >= 4) score += 0.1;

      results.push({
        id: doc.id,
        title: doc.title,
        excerpt: generateExcerpt(doc.content.plain_text),
        metadata: {
          tags: doc.metadata.tags,
          status: doc.metadata.status,
          updated: doc.metadata.updated,
          author: doc.metadata.author,
          category: doc.metadata.category,
        },
        relevance_score: Math.min(score, 1.0),
      });
    }

    results.sort((a, b) => b.relevance_score - a.relevance_score);

    return {
      results: results.slice(0, limit),
      total: results.length,
      filtersApplied: filterLog,
    };
  }

  async searchByTags(tags: string[]): Promise<OkfDocument[]> {
    const tagIndex = await this.store.getTagIndex();
    const ids = new Set<string>();

    for (const tag of tags) {
      for (const id of tagIndex[tag] || []) ids.add(id);
    }

    const docs: OkfDocument[] = [];
    for (const id of ids) {
      const doc = await this.store.getDoc(id);
      if (doc) docs.push(doc);
    }

    return docs;
  }

  private async filterByQuery(ids: string[], query: string): Promise<string[]> {
    const lowerQuery = query.toLowerCase();
    const results: string[] = [];

    for (const id of ids) {
      const doc = await this.store.getDoc(id);
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

  private async filterByCategory(ids: string[], category: string): Promise<string[]> {
    const results: string[] = [];
    for (const id of ids) {
      const doc = await this.store.getDoc(id);
      if (doc && doc.metadata.category === category) results.push(id);
    }
    return results;
  }

  private async filterByStatus(ids: string[], status: string): Promise<string[]> {
    const results: string[] = [];
    for (const id of ids) {
      const doc = await this.store.getDoc(id);
      if (doc && doc.metadata.status === status) results.push(id);
    }
    return results;
  }
}
