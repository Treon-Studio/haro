import matter from 'gray-matter';
import type { OkfDocument, OkfMetadata, OkfContent, OkfReferences, OkfSyncInfo, ParsedDocument } from '../types/okf';
import { extractHeadings, extractLinks, stripMarkdown, extractIdFromPath, generateExcerpt } from '../utils/markdown';
import { estimateTokens } from '../utils/tokenizer';

const DEFAULT_METADATA: Partial<OkfMetadata> = {
  status: 'draft',
  related: [],
  see_also: [],
  tags: [],
  category: 'uncategorized',
  parent: null,
  children: [],
  context_priority: 3,
};

export function parseDocument(rawContent: string, path: string, gitSha: string): ParsedDocument {
  const { data, content } = matter(rawContent);
  const id = (data.id as string) || extractIdFromPath(path);
  const title = (data.title as string) || id;

  const headings = extractHeadings(content);
  const links = extractLinks(content);
  const plainText = stripMarkdown(content);
  const estimatedTokens = estimateTokens(content);

  const metadata: OkfMetadata = {
    id,
    title,
    created: (data.created as string) || new Date().toISOString().split('T')[0],
    updated: (data.updated as string) || new Date().toISOString().split('T')[0],
    author: data.author as string | undefined,
    version: data.version as string | undefined,
    status: (data.status as OkfMetadata['status']) || 'draft',
    related: (data.related as string[]) || [],
    see_also: (data.see_also as string[]) || [],
    tags: (data.tags as string[]) || [],
    category: (data.category as string) || 'uncategorized',
    parent: (data.parent as string | null) || null,
    children: (data.children as string[]) || [],
    context_priority: (data.context_priority as number) || 3,
    estimated_tokens: estimatedTokens,
  };

  const docContent: OkfContent = {
    raw_markdown: content,
    plain_text: plainText,
    headings,
    links,
  };

  const references: OkfReferences = {
    explicit: metadata.related,
    implicit: metadata.see_also,
    backlinks: [],
  };

  return { id, title, metadata, content: docContent, references };
}

export function buildDocument(parsed: ParsedDocument, gitSha: string, version: number): OkfDocument {
  return {
    id: parsed.id,
    title: parsed.title,
    metadata: parsed.metadata,
    content: parsed.content,
    references: parsed.references,
    sync: {
      last_synced: new Date().toISOString(),
      git_sha: gitSha,
      version,
    },
  };
}

export function validateOkfDocument(data: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!data.id || typeof data.id !== 'string') errors.push('Missing or invalid "id"');
  if (!data.title || typeof data.title !== 'string') errors.push('Missing or invalid "title"');
  if (!data.created || typeof data.created !== 'string') errors.push('Missing or invalid "created"');
  if (!data.updated || typeof data.updated !== 'string') errors.push('Missing or invalid "updated"');

  if (data.tags && !Array.isArray(data.tags)) errors.push('"tags" must be an array');
  if (data.related && !Array.isArray(data.related)) errors.push('"related" must be an array');
  if (data.see_also && !Array.isArray(data.see_also)) errors.push('"see_also" must be an array');
  if (data.children && !Array.isArray(data.children)) errors.push('"children" must be an array');

  if (data.status && !['draft', 'review', 'stable', 'deprecated'].includes(data.status as string)) {
    errors.push(`Invalid status: ${data.status}`);
  }

  return errors;
}
