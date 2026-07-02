import type { McpToolDefinition, ToolCallResult, ToolCallContent } from '../types/mcp';
import type { DocService } from '../services/doc-service';
import type { SearchService } from '../services/search-service';
import type { SyncService } from '../services/sync-service';
import type { GraphService } from '../services/graph-service';
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
