import type { McpToolDefinition, ToolCallResult, ToolCallContent } from '../types/mcp';
import type { DocService } from '../services/doc-service';
import type { SearchService } from '../services/search-service';
import type { SyncService } from '../services/sync-service';
import type { GraphService } from '../services/graph-service';
import type { MemoryFabricService } from '../services/memory-fabric-service';
import { DocumentNotFoundError } from '../utils/errors';

const TOOL_LIST: McpToolDefinition[] = [
  {
    name: 'okf_search',
    description: 'Search OKF documents by keywords, tags, or categories',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (keywords)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        category: { type: 'string', description: 'Filter by category' },
        status: { type: 'string', enum: ['draft', 'review', 'stable', 'deprecated'], description: 'Filter by document status' },
        limit: { type: 'number', default: 10, description: 'Max results' },
        include_content: { type: 'boolean', default: false, description: 'Include full content in results' },
      },
    },
  },
  {
    name: 'okf_get_doc',
    description: 'Get a single OKF document by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID (e.g., okf-001)' },
        format: { type: 'string', enum: ['full', 'metadata_only', 'content_only', 'summary'], default: 'full', description: 'Response format' },
        resolve_links: { type: 'boolean', default: false, description: 'Resolve internal links to document titles' },
      },
      required: ['id'],
    },
  },
  {
    name: 'okf_get_context',
    description: 'Assemble context from a document and its related documents for LLM consumption',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Starting document ID' },
        depth: { type: 'number', default: 1, minimum: 0, maximum: 3, description: 'Graph traversal depth' },
        max_tokens: { type: 'number', default: 4000, description: 'Max tokens for assembled context' },
        strategy: { type: 'string', enum: ['breadth_first', 'depth_first', 'priority'], default: 'priority', description: 'Traversal strategy' },
        include_backlinks: { type: 'boolean', default: true, description: 'Include documents that link to this document' },
      },
      required: ['id'],
    },
  },
  {
    name: 'okf_get_related',
    description: 'Get related documents with relationship analysis',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
        relationship_types: { type: 'array', items: { type: 'string', enum: ['explicit', 'implicit', 'backlink', 'parent', 'child', 'sibling', 'tag_similar'] }, description: 'Relationship types to include' },
        limit: { type: 'number', default: 10, description: 'Max results' },
      },
      required: ['id'],
    },
  },
  {
    name: 'okf_list_docs',
    description: 'List all documents with pagination and filtering',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        status: { type: 'string', enum: ['draft', 'review', 'stable', 'deprecated'], description: 'Filter by status' },
        tag: { type: 'string', description: 'Filter by tag' },
        sort_by: { type: 'string', enum: ['title', 'updated', 'created', 'priority'], default: 'updated', description: 'Sort field' },
        page: { type: 'number', default: 1, description: 'Page number' },
        per_page: { type: 'number', default: 20, description: 'Results per page' },
      },
    },
  },
  {
    name: 'okf_sync_status',
    description: 'Get sync status between GitHub and KV cache',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  /* --- memory fabric tools (proxied to VPS) --- */
  {
    name: 'memory_store',
    description: 'Store a memory in the mem0 memory layer. Messages are stored as conversation pairs and embedded for semantic retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
          description: 'List of message pairs',
        },
        user_id: { type: 'string', description: 'Scoping identifier' },
        agent_id: { type: 'string', description: 'Agent identifier' },
        metadata: { type: 'object', description: 'Optional metadata' },
      },
      required: ['messages'],
    },
  },
  {
    name: 'memory_search',
    description: 'Search memories by semantic query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query' },
        user_id: { type: 'string', description: 'Scope filter' },
        limit: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_list',
    description: 'List all memories for a given scope.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        agent_id: { type: 'string' },
        run_id: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'memory_get',
    description: 'Get a single memory by its id.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'Memory ID' },
      },
      required: ['memory_id'],
    },
  },
  {
    name: 'memory_delete',
    description: 'Delete a memory by its id.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'Memory ID' },
      },
      required: ['memory_id'],
    },
  },
  {
    name: 'gbrain_put',
    description: 'Write or update a page in the gbrain knowledge graph.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Unique page slug' },
        content: { type: 'string', description: 'Page content (markdown)' },
        tenant: { type: 'string', description: 'Tenant identifier' },
        title: { type: 'string' },
        type: { type: 'string', default: 'page' },
      },
      required: ['slug', 'content'],
    },
  },
  {
    name: 'gbrain_get',
    description: 'Read a page from the gbrain knowledge graph by slug.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Page slug' },
        tenant: { type: 'string' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'gbrain_search',
    description: 'Keyword-search pages in the gbrain knowledge graph.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        tenant: { type: 'string' },
        limit: { type: 'number', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'gbrain_query',
    description: 'Hybrid semantic search across the gbrain knowledge graph.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Question to answer from knowledge' },
        tenant: { type: 'string' },
        limit: { type: 'number', default: 10 },
      },
      required: ['question'],
    },
  },
  {
    name: 'gbrain_list',
    description: 'List pages in the gbrain knowledge graph.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by page type' },
        tag: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'gbrain_stats',
    description: 'Get gbrain health and statistics.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant: { type: 'string' },
      },
    },
  },
  {
    name: 'vault_read',
    description: 'Read a file from the tenant vault.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path in vault' },
        tenant: { type: 'string', description: 'Tenant identifier' },
      },
      required: ['path', 'tenant'],
    },
  },
  {
    name: 'vault_write',
    description: 'Write content to a file in the tenant vault.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path in vault' },
        content: { type: 'string', description: 'File content' },
        tenant: { type: 'string', description: 'Tenant identifier' },
      },
      required: ['path', 'content', 'tenant'],
    },
  },
  {
    name: 'vault_list',
    description: 'List files and directories in a vault path.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', default: '', description: 'Directory path in vault' },
        tenant: { type: 'string', description: 'Tenant identifier' },
      },
      required: ['tenant'],
    },
  },
  {
    name: 'fabric_health',
    description: 'Check connectivity to all memory fabric backends (mem0, gbrain, vault).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export function getToolDefinitions(): McpToolDefinition[] {
  return TOOL_LIST;
}

export function getToolDefinition(name: string): McpToolDefinition | undefined {
  return TOOL_LIST.find(t => t.name === name);
}

export interface ToolServices {
  docService: DocService;
  searchService: SearchService;
  graphService: GraphService;
  syncService: SyncService;
  memoryFabric?: MemoryFabricService;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  services: ToolServices,
): Promise<ToolCallResult> {
  try {
    switch (name) {
      case 'okf_search':
        return handleSearch(args, services);
      case 'okf_get_doc':
        return handleGetDoc(args, services);
      case 'okf_get_context':
        return handleGetContext(args, services);
      case 'okf_get_related':
        return handleGetRelated(args, services);
      case 'okf_list_docs':
        return handleListDocs(args, services);
      case 'okf_sync_status':
        return handleSyncStatus(services);
      /* memory fabric tools */
      case 'memory_store':
      case 'memory_search':
      case 'memory_list':
      case 'memory_get':
      case 'memory_delete':
      case 'gbrain_put':
      case 'gbrain_get':
      case 'gbrain_search':
      case 'gbrain_query':
      case 'gbrain_list':
      case 'gbrain_stats':
      case 'vault_read':
      case 'vault_write':
      case 'vault_list':
      case 'fabric_health':
        return handleMemoryFabric(name, args, services);
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    if (err instanceof DocumentNotFoundError) {
      return {
        content: [{ type: 'text', text: err.message }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: `Error executing ${name}: ${err instanceof Error ? err.message : 'unknown error'}` }],
      isError: true,
    };
  }
}

async function handleSearch(args: Record<string, unknown>, services: ToolServices): Promise<ToolCallResult> {
  const result = await services.searchService.search({
    query: args.query as string | undefined,
    tags: args.tags as string[] | undefined,
    category: args.category as string | undefined,
    status: args.status as string | undefined,
    limit: (args.limit as number) || 10,
    includeContent: args.include_content as boolean | undefined,
  });

  if (result.results.length === 0) {
    return {
      content: [{ type: 'text', text: 'No documents found matching your search criteria.' }],
    };
  }

  let text = `Found ${result.total} documents:\n\n`;
  for (const r of result.results) {
    text += `**${r.id}** — ${r.title} (relevance: ${(r.relevance_score * 100).toFixed(0)}%)\n`;
    text += `  ${r.excerpt}\n`;
    text += `  Tags: ${r.metadata.tags.join(', ')} | Status: ${r.metadata.status}\n\n`;
  }

  return {
    content: [{ type: 'text', text }],
  };
}

async function handleGetDoc(args: Record<string, unknown>, services: ToolServices): Promise<ToolCallResult> {
  const id = args.id as string;
  const format = (args.format as string) || 'full';
  const resolveLinks = args.resolve_links as boolean;

  const doc = await services.docService.getDoc(id);

  switch (format) {
    case 'metadata_only': {
      let text = `## ${doc.title} (${doc.id})\n\n`;
      text += `- Status: ${doc.metadata.status}\n`;
      text += `- Version: ${doc.metadata.version || 'N/A'}\n`;
      text += `- Updated: ${doc.metadata.updated}\n`;
      text += `- Author: ${doc.metadata.author || 'N/A'}\n`;
      text += `- Category: ${doc.metadata.category}\n`;
      text += `- Tags: ${doc.metadata.tags.join(', ')}\n`;
      text += `- Estimated tokens: ${doc.metadata.estimated_tokens}\n`;

      return { content: [{ type: 'text', text }] };
    }

    case 'content_only': {
      return { content: [{ type: 'text', text: doc.content.raw_markdown }] };
    }

    case 'summary': {
      const summary = doc.content.plain_text.slice(0, 1000);
      const hasMore = doc.content.plain_text.length > 1000;
      let text = `## ${doc.title}\n\n${summary}${hasMore ? '\n\n*(content truncated...)*' : ''}`;

      return { content: [{ type: 'text', text }] };
    }

    default: {
      let text = `# ${doc.title}\n\n`;
      text += `**ID:** ${doc.id} | **Status:** ${doc.metadata.status} | **Updated:** ${doc.metadata.updated}\n\n`;
      text += `**Tags:** ${doc.metadata.tags.join(', ')} | **Category:** ${doc.metadata.category}\n\n`;

      if (resolveLinks) {
        const related = await services.docService.getRelated(id);
        if (related.length > 0) {
          text += '**Related documents:**\n';
          for (const r of related.slice(0, 5)) {
            text += `- ${r.id}: ${r.title} (${r.relationshipType})\n`;
          }
          text += '\n';
        }
      }

      text += '---\n\n';
      text += doc.content.raw_markdown;

      if (doc.references.backlinks.length > 0) {
        text += '\n\n---\n**Referenced by:** ';
        text += doc.references.backlinks.join(', ');
      }

      return { content: [{ type: 'text', text }] };
    }
  }
}

async function handleGetContext(args: Record<string, unknown>, services: ToolServices): Promise<ToolCallResult> {
  const id = args.id as string;
  const depth = (args.depth as number) || 1;
  const maxTokens = (args.max_tokens as number) || 4000;
  const strategy = (args.strategy as 'breadth_first' | 'depth_first' | 'priority') || 'priority';
  const includeBacklinks = args.include_backlinks !== false;

  const ctx = await services.graphService.getContext(id, maxTokens, depth, strategy, includeBacklinks);

  const docInfo = ctx.documents_included.map(
    d => `- ${d.id} (${d.tokens} tokens, ${d.reason})`,
  ).join('\n');

  let text = ctx.context;
  text += `\n\n---\n**Context assembly stats:**\n`;
  text += `- Total tokens: ${ctx.total_tokens}\n`;
  text += `- Documents included: ${ctx.documents_included.length}\n`;
  text += `- Truncated: ${ctx.truncated ? 'yes' : 'no'}\n`;
  text += `- Depth reached: ${ctx.graph_traversal.depth_reached}\n\n`;
  text += `**Documents:**\n${docInfo}`;

  return { content: [{ type: 'text', text }] };
}

async function handleGetRelated(args: Record<string, unknown>, services: ToolServices): Promise<ToolCallResult> {
  const id = args.id as string;
  const limit = (args.limit as number) || 10;

  const related = await services.docService.getRelated(id);
  const limited = related.slice(0, limit);

  if (limited.length === 0) {
    return {
      content: [{ type: 'text', text: `No related documents found for ${id}.` }],
    };
  }

  let text = `Related documents for ${id}:\n\n`;
  for (const r of limited) {
    const strengthBar = '█'.repeat(Math.round(r.strength * 10)) + '░'.repeat(Math.round((1 - r.strength) * 10));
    text += `**${r.id}** — ${r.title}\n`;
    text += `  Type: ${r.relationshipType} | Strength: ${(r.strength * 100).toFixed(0)}% ${strengthBar}\n\n`;
  }

  return { content: [{ type: 'text', text }] };
}

async function handleListDocs(args: Record<string, unknown>, services: ToolServices): Promise<ToolCallResult> {
  const result = await services.docService.listDocs({
    category: args.category as string | undefined,
    status: args.status as string | undefined,
    tag: args.tag as string | undefined,
    sortBy: (args.sort_by as string) || 'updated',
    page: (args.page as number) || 1,
    perPage: (args.per_page as number) || 20,
  });

  if (result.docs.length === 0) {
    return {
      content: [{ type: 'text', text: 'No documents found matching the filters.' }],
    };
  }

  let text = `Documents (page ${(args.page as number) || 1}, ${result.total} total):\n\n`;
  for (const doc of result.docs) {
    text += `**${doc.id}** — ${doc.title} [${doc.metadata.status}]\n`;
    text += `  Updated: ${doc.metadata.updated} | Category: ${doc.metadata.category}\n\n`;
  }

  return { content: [{ type: 'text', text }] };
}

async function handleMemoryFabric(name: string, args: Record<string, unknown>, services: ToolServices): Promise<ToolCallResult> {
  if (!services.memoryFabric) {
    return {
      content: [{ type: 'text', text: 'Memory Fabric not configured. Set MEMORY_FABRIC_URL environment variable.' }],
      isError: true,
    };
  }

  if (name === 'fabric_health') return services.memoryFabric.fabricHealth();
  if (name === 'memory_store') return services.memoryFabric.memoryStore(args);
  if (name === 'memory_search') return services.memoryFabric.memorySearch(args);
  if (name === 'memory_list') return services.memoryFabric.memoryList(args);
  if (name === 'memory_get') return services.memoryFabric.memoryGet(args);
  if (name === 'memory_delete') return services.memoryFabric.memoryDelete(args);
  if (name === 'gbrain_put') return services.memoryFabric.gbrainPut(args);
  if (name === 'gbrain_get') return services.memoryFabric.gbrainGet(args);
  if (name === 'gbrain_search') return services.memoryFabric.gbrainSearch(args);
  if (name === 'gbrain_query') return services.memoryFabric.gbrainQuery(args);
  if (name === 'gbrain_list') return services.memoryFabric.gbrainList(args);
  if (name === 'gbrain_stats') return services.memoryFabric.gbrainStats(args);
  if (name === 'vault_read') return services.memoryFabric.vaultRead(args);
  if (name === 'vault_write') return services.memoryFabric.vaultWrite(args);
  if (name === 'vault_list') return services.memoryFabric.vaultList(args);

  return { content: [{ type: 'text', text: `Unknown memory fabric tool: ${name}` }], isError: true };
}

async function handleSyncStatus(services: ToolServices): Promise<ToolCallResult> {
  const stats = await services.docService.getStats();

  let text = `## Sync Status\n\n`;
  text += `- Status: **${stats.sync_status}**\n`;
  text += `- Total documents: ${stats.total_docs}\n`;
  text += `- Last full sync: ${stats.last_full_sync || 'never'}\n`;
  text += `- Last incremental sync: ${stats.last_incremental_sync || 'never'}\n`;
  text += `- Version: ${stats.version || 'N/A'}\n`;

  return { content: [{ type: 'text', text }] };
}
