import type { LinkGraph, TraversalResult, AssembledContext, TraversalStrategy } from '../types/okf';
import { KvStore } from '../kv/store';
import { estimateTokens, formatDocForContext, formatSummaryDoc } from '../utils/tokenizer';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';

export class GraphService {
  constructor(
    private store: KvStore,
    private graphDO: DurableObjectNamespace,
  ) {}

  async traverse(
    startId: string,
    depth = 1,
    strategy: TraversalStrategy = 'priority',
    maxNodes = 20,
  ): Promise<TraversalResult> {
    const graph = await this.store.getLinkGraph();
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; priority: number }> = [
      { id: startId, depth: 0, priority: 1.0 },
    ];
    const nodes: Array<{ id: string; depth: number; path: string[] }> = [];

    while (queue.length > 0 && nodes.length < maxNodes) {
      const current = this.dequeue(strategy, queue);
      if (visited.has(current.id)) continue;

      visited.add(current.id);
      nodes.push({ id: current.id, depth: current.depth, path: [] });

      if (current.depth < depth) {
        const node = graph[current.id];
        if (node) {
          const entries = Object.entries(node.related_score);
          const maxScore = entries.length > 0 ? Math.max(...entries.map(([, s]) => s)) : 1;

          for (const [relatedId, score] of entries) {
            if (!visited.has(relatedId)) {
              queue.push({
                id: relatedId,
                depth: current.depth + 1,
                priority: (score / maxScore) * (1 / (current.depth + 1)),
              });
            }
          }
        }
      }
    }

    return { nodes };
  }

  async getContext(
    startId: string,
    maxTokens = 4000,
    depth = 1,
    strategy: TraversalStrategy = 'priority',
    includeBacklinks = true,
  ): Promise<AssembledContext> {
    const traversal = await this.traverse(startId, depth, strategy);
    let remainingTokens = maxTokens;
    const included: Array<{ id: string; tokens: number; reason: string }> = [];
    let context = '';
    let documentsExplored = 0;
    let depthReached = 0;
    let truncated = false;

    for (const node of traversal.nodes) {
      documentsExplored++;
      depthReached = Math.max(depthReached, node.depth);

      if (remainingTokens <= 100) {
        truncated = true;
        break;
      }

      const doc = await this.store.getDoc(node.id);
      if (!doc) continue;

      const docTokens = doc.metadata.estimated_tokens || estimateTokens(doc.content.plain_text);
      const reason = node.depth === 0 ? 'primary' : this.getRelationshipReason(node.id, startId, traversal.nodes);

      if (node.depth === 0) {
        if (docTokens > maxTokens * 0.5) {
          const summaryText = formatSummaryDoc(doc.title, doc.content.plain_text, Math.floor(maxTokens * 0.5));
          const summaryTokens = estimateTokens(summaryText);
          context += summaryText;
          remainingTokens -= summaryTokens;
          included.push({ id: node.id, tokens: summaryTokens, reason });
        } else {
          context += formatDocForContext(doc.title, doc.content.plain_text);
          remainingTokens -= docTokens;
          included.push({ id: node.id, tokens: docTokens, reason });
        }
      } else if (node.depth === 1) {
        const budget = Math.min(docTokens, Math.floor(remainingTokens * 0.3));
        if (docTokens > budget) {
          context += formatSummaryDoc(doc.title, doc.content.plain_text, budget);
          included.push({ id: node.id, tokens: budget, reason });
        } else {
          context += formatDocForContext(doc.title, doc.content.plain_text);
          included.push({ id: node.id, tokens: docTokens, reason });
          remainingTokens -= docTokens;
        }
      } else {
        const summaryBudget = Math.min(200, remainingTokens);
        context += formatSummaryDoc(doc.title, doc.content.plain_text, summaryBudget);
        included.push({ id: node.id, tokens: summaryBudget, reason });
        remainingTokens -= summaryBudget;
      }
    }

    if (includeBacklinks && depth < 3) {
      const primaryDoc = await this.store.getDoc(startId);
      if (primaryDoc) {
        for (const backlinkId of primaryDoc.references.backlinks.slice(0, 3)) {
          if (included.find(i => i.id === backlinkId)) continue;
          if (remainingTokens < 150) break;

          const doc = await this.store.getDoc(backlinkId);
          if (!doc) continue;

          documentsExplored++;
          const summaryBudget = Math.min(150, remainingTokens);
          context += formatSummaryDoc(doc.title, doc.content.plain_text, summaryBudget);
          included.push({ id: backlinkId, tokens: summaryBudget, reason: 'backlink' });
          remainingTokens -= summaryBudget;
        }
      }
    }

    const totalTokens = maxTokens - remainingTokens;

    return {
      context: context.trim(),
      documents_included: included,
      total_tokens: totalTokens,
      truncated,
      graph_traversal: {
        depth_reached: depthReached,
        documents_explored: documentsExplored,
        documents_included: included.length,
      },
    };
  }

  private dequeue(strategy: TraversalStrategy, queue: Array<{ id: string; depth: number; priority: number }>): {
    id: string;
    depth: number;
    priority: number;
  } {
    switch (strategy) {
      case 'priority':
        queue.sort((a, b) => b.priority - a.priority);
        return queue.shift()!;
      case 'breadth_first':
        return queue.shift()!;
      case 'depth_first':
        return queue.pop()!;
    }
  }

  private getRelationshipReason(nodeId: string, startId: string, allNodes: Array<{ id: string; depth: number; path: string[] }>): string {
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return 'related';

    if (node.depth === 1) return 'explicit_ref';
    if (node.depth === 2) return 'implicit_ref';
    return 'distant_ref';
  }
}
