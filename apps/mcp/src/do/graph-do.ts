import type { LinkGraph } from '../types/okf';
import type { TraversalStrategy } from '../types/okf';

interface QueueItem {
  id: string;
  depth: number;
  priority: number;
}

interface TraverseRequest {
  startId: string;
  depth: number;
  strategy: TraversalStrategy;
  maxNodes: number;
}

interface ContextRequest {
  id: string;
  maxTokens: number;
  depth: number;
}

export class GraphDurableObject implements DurableObject {
  private state: DurableObjectState;
  private graph: LinkGraph | null = null;
  private storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState) {
    this.state = ctx;
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/load':
        return this.handleLoad(request);
      case '/traverse':
        return this.handleTraverse(request);
      case '/get-context':
        return this.handleGetContext(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  async handleLoad(request: Request): Promise<Response> {
    const body = (await request.json()) as { graph: LinkGraph };
    this.graph = body.graph;
    await this.storage.put('graph', this.graph);
    return Response.json({ loaded: true, nodes: Object.keys(this.graph).length });
  }

  async handleTraverse(request: Request): Promise<Response> {
    const req = (await request.json()) as TraverseRequest;
    const graph = await this.getGraph();
    const visited = new Set<string>();
    const queue: QueueItem[] = [{ id: req.startId, depth: 0, priority: 1.0 }];
    const result: Array<{ id: string; depth: number; path: string[] }> = [];

    while (queue.length > 0 && result.length < req.maxNodes) {
      const current = this.dequeue(req.strategy, queue);
      if (visited.has(current.id)) continue;

      visited.add(current.id);
      result.push({ id: current.id, depth: current.depth, path: [] });

      if (current.depth < req.depth) {
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

    return Response.json({ nodes: result });
  }

  async handleGetContext(request: Request): Promise<Response> {
    const req = (await request.json()) as ContextRequest;
    const graph = await this.getGraph();
    const visited = new Set<string>();
    const queue: QueueItem[] = [{ id: req.id, depth: 0, priority: 1.0 }];
    const nodes: Array<{ id: string; depth: number }> = [];

    while (queue.length > 0 && nodes.length < 50) {
      const current = this.dequeue('priority', queue);
      if (visited.has(current.id)) continue;

      visited.add(current.id);
      nodes.push({ id: current.id, depth: current.depth });

      if (current.depth < req.depth) {
        const node = graph[current.id];
        if (node) {
          for (const relatedId of node.outgoing) {
            if (!visited.has(relatedId)) {
              queue.push({
                id: relatedId,
                depth: current.depth + 1,
                priority: node.related_score[relatedId] || 0.5,
              });
            }
          }
        }
      }
    }

    return Response.json({ nodes });
  }

  private async getGraph(): Promise<LinkGraph> {
    if (this.graph) return this.graph;
    const stored = await this.storage.get<LinkGraph>('graph');
    this.graph = stored || {};
    return this.graph;
  }

  private dequeue(strategy: TraversalStrategy, queue: QueueItem[]): QueueItem {
    switch (strategy) {
      case 'priority':
        queue.sort((a, b) => b.priority - a.priority);
        return queue.shift()!;
      case 'breadth_first':
        return queue.shift()!;
      case 'depth_first':
        return queue.pop()!;
      default:
        return queue.shift()!;
    }
  }
}
