export interface OkfMetadata {
  id: string;
  title: string;
  created: string;
  updated: string;
  author?: string;
  version?: string;
  status: OkfDocStatus;
  related: string[];
  see_also: string[];
  tags: string[];
  category: string;
  parent: string | null;
  children: string[];
  context_priority: number;
  estimated_tokens: number;
}

export type OkfDocStatus = 'draft' | 'review' | 'stable' | 'deprecated';

export interface OkfContent {
  raw_markdown: string;
  plain_text: string;
  headings: OkfHeading[];
  links: OkfLinks;
}

export interface OkfHeading {
  level: number;
  text: string;
  anchor: string;
}

export interface OkfLinks {
  internal: string[];
  external: string[];
}

export interface OkfReferences {
  explicit: string[];
  implicit: string[];
  backlinks: string[];
}

export interface OkfSyncInfo {
  last_synced: string;
  git_sha: string;
  version: number;
}

export interface OkfDocument {
  id: string;
  title: string;
  metadata: OkfMetadata;
  content: OkfContent;
  references: OkfReferences;
  sync: OkfSyncInfo;
}

export interface OkfSearchResult {
  id: string;
  title: string;
  excerpt: string;
  metadata: {
    tags: string[];
    status: OkfDocStatus;
    updated: string;
    author?: string;
    category?: string;
  };
  relevance_score: number;
}

export interface TagIndex {
  [tag: string]: string[];
}

export interface CategoryNode {
  docs: string[];
  subcategories: Record<string, string[]>;
}

export interface CategoryIndex {
  [category: string]: CategoryNode;
}

export interface LinkNode {
  outgoing: string[];
  incoming: string[];
  related_score: Record<string, number>;
}

export interface LinkGraph {
  [docId: string]: LinkNode;
}

export interface DocStats {
  total_docs: number;
  last_full_sync: string;
  last_incremental_sync: string;
  sync_status: SyncStatus;
  version: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'completed' | 'error';

export interface ParsedDocument {
  id: string;
  title: string;
  metadata: OkfMetadata;
  content: OkfContent;
  references: OkfReferences;
}

export interface TraversalResult {
  nodes: Array<{ id: string; depth: number; path: string[] }>;
}

export interface AssembledContext {
  context: string;
  documents_included: Array<{ id: string; tokens: number; reason: string }>;
  total_tokens: number;
  truncated: boolean;
  graph_traversal: {
    depth_reached: number;
    documents_explored: number;
    documents_included: number;
  };
}

export interface RelationshipResult {
  document_id: string;
  title: string;
  relationship_type: RelationshipType;
  strength: number;
  context: string;
}

export type RelationshipType =
  | 'explicit'
  | 'implicit'
  | 'backlink'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'tag_similar';

export type TraversalStrategy = 'breadth_first' | 'depth_first' | 'priority';
