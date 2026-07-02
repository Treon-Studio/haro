export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  content?: string;
  encoding?: string;
  download_url: string | null;
  type: 'file' | 'dir';
}

export interface GitHubBlob {
  sha: string;
  node_id: string;
  size: number;
  content: string;
  encoding: 'base64';
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'removed';
}

export interface WebhookPayload {
  ref: string;
  commits: Array<{
    id: string;
    message: string;
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  changedFiles: ChangedFile[];
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
}

export interface SyncConfig {
  owner: string;
  repo: string;
  branch: string;
  docsPath: string;
  token: string;
}

export interface SyncResult {
  totalDocs?: number;
  updated: number;
  deleted: number;
  syncedAt: string;
  gitSha?: string;
}
