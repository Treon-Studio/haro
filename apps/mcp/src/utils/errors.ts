export class OkfError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'OkfError';
  }
}

export class DocumentNotFoundError extends OkfError {
  constructor(id: string) {
    super(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND', 404);
    this.name = 'DocumentNotFoundError';
  }
}

export class SyncInProgressError extends OkfError {
  constructor() {
    super('Sync already in progress', 'SYNC_IN_PROGRESS', 409);
    this.name = 'SyncInProgressError';
  }
}

export class GitHubApiError extends OkfError {
  constructor(status: number, message: string) {
    super(`GitHub API error (${status}): ${message}`, 'GITHUB_API_ERROR', status);
    this.name = 'GitHubApiError';
  }
}

export class InvalidOkfDocumentError extends OkfError {
  constructor(id: string, reason: string) {
    super(`Invalid OKF document ${id}: ${reason}`, 'INVALID_OKF_DOCUMENT', 400);
    this.name = 'InvalidOkfDocumentError';
  }
}

export class RateLimitError extends OkfError {
  constructor(public retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter}s`, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}

export function handleError(err: unknown): { code: number; message: string } {
  if (err instanceof OkfError) {
    return { code: err.statusCode, message: err.message };
  }
  if (err instanceof Error) {
    return { code: 500, message: err.message };
  }
  return { code: 500, message: 'Unknown error occurred' };
}
