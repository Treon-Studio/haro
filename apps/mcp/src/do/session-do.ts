interface ConversationTurn {
  query: string;
  timestamp: string;
  referencedDocs: string[];
  toolsUsed: string[];
}

export class SessionDurableObject implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(ctx: DurableObjectState) {
    this.state = ctx;
    this.storage = ctx.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/save':
        return this.handleSave(request);
      case '/history':
        return this.handleHistory();
      case '/relevant-context':
        return this.handleRelevantContext(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  async handleSave(request: Request): Promise<Response> {
    const turn = (await request.json()) as ConversationTurn;
    const history = (await this.storage.get<ConversationTurn[]>('history')) || [];
    history.push(turn);

    if (history.length > 20) history.shift();

    await this.storage.put('history', history);
    return Response.json({ saved: true });
  }

  async handleHistory(): Promise<Response> {
    const history = (await this.storage.get<ConversationTurn[]>('history')) || [];
    return Response.json({ history });
  }

  async handleRelevantContext(request: Request): Promise<Response> {
    const { query } = (await request.json()) as { query?: string };
    const history = (await this.storage.get<ConversationTurn[]>('history')) || [];

    const referencedDocs = new Set<string>();
    for (const turn of history) {
      if (turn.referencedDocs) {
        turn.referencedDocs.forEach(id => referencedDocs.add(id));
      }
    }

    return Response.json({
      referencedDocs: Array.from(referencedDocs),
      recentTurns: history.slice(-5),
    });
  }
}
