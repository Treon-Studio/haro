import type { OkfDocument, OkfSearchResult, DocStats } from '../types/okf';
import { KvStore } from '../kv/store';
import { DocumentNotFoundError } from '../utils/errors';
import { generateExcerpt } from '../utils/markdown';
import type { LinkGraph } from '../types/okf';

export class DocService {
  constructor(private store: KvStore) {}

  async getDoc(id: string): Promise<OkfDocument> {
    const doc = await this.store.getDoc(id);
    if (!doc) throw new DocumentNotFoundError(id);
    return doc;
  }

  async search(query: string): Promise<OkfSearchResult[]> {
    const ids = await this.store.searchDocs(query);
    const results: OkfSearchResult[] = [];

    for (const id of ids.slice(0, 50)) {
      const doc = await this.store.getDoc(id);
      if (!doc) continue;

      let score = 0;

      if (doc.id.toLowerCase().includes(query.toLowerCase())) score += 0.4;
      if (doc.title.toLowerCase().includes(query.toLowerCase())) score += 0.3;

      const plainLower = doc.content.plain_text.toLowerCase();
      const qLower = query.toLowerCase();
      const occurrences = (plainLower.match(new RegExp(qLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      score += Math.min(occurrences * 0.01, 0.3);

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
    return results;
  }

  async listDocs(
    filters: {
      category?: string;
      status?: string;
      tag?: string;
      sortBy?: string;
      page?: number;
      perPage?: number;
    } = {},
  ): Promise<{ docs: OkfDocument[]; total: number }> {
    const { category, status, tag, sortBy = 'updated', page = 1, perPage = 20 } = filters;

    const ids = await this.store.listDocIds();
    const docs: OkfDocument[] = [];

    for (const id of ids) {
      const doc = await this.store.getDoc(id);
      if (!doc) continue;

      if (category && doc.metadata.category !== category) continue;
      if (status && doc.metadata.status !== status) continue;
      if (tag && !doc.metadata.tags.includes(tag)) continue;

      docs.push(doc);
    }

    docs.sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (sortBy === 'title') {
        aVal = a.title;
        bVal = b.title;
      } else if (sortBy === 'priority') {
        return (b.metadata.context_priority ?? 0) - (a.metadata.context_priority ?? 0);
      } else {
        aVal = sortBy === 'created' ? a.metadata.created : a.metadata.updated;
        bVal = sortBy === 'created' ? b.metadata.created : b.metadata.updated;
      }
      return bVal.localeCompare(aVal);
    });

    const total = docs.length;
    const start = (page - 1) * perPage;
    const paginated = docs.slice(start, start + perPage);

    return { docs: paginated, total };
  }

  async getRelated(id: string): Promise<Array<{ id: string; title: string; relationshipType: string; strength: number }>> {
    const doc = await this.getDoc(id);
    const graph = await this.store.getLinkGraph();
    const related: Array<{ id: string; title: string; relationshipType: string; strength: number }> = [];

    const linkNode = graph[id];
    if (!linkNode) return [];

    for (const refId of linkNode.outgoing) {
      try {
        const refDoc = await this.getDoc(refId);
        const isExplicit = doc.references.explicit.includes(refId);
        related.push({
          id: refId,
          title: refDoc.title,
          relationshipType: isExplicit ? 'explicit' : 'implicit',
          strength: linkNode.related_score[refId] || 0.5,
        });
      } catch {
        related.push({
          id: refId,
          title: refId,
          relationshipType: 'explicit',
          strength: 0.3,
        });
      }
    }

    for (const refId of linkNode.incoming) {
      if (!related.find(r => r.id === refId)) {
        try {
          const refDoc = await this.getDoc(refId);
          related.push({
            id: refId,
            title: refDoc.title,
            relationshipType: 'backlink',
            strength: graph[refId]?.related_score[id] || 0.5,
          });
        } catch {
          // skip unresolvable
        }
      }
    }

    related.sort((a, b) => b.strength - a.strength);
    return related;
  }

  async getStats(): Promise<DocStats> {
    return this.store.getStats();
  }
}
