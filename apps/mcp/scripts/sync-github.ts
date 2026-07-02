import { SyncService } from '../src/services/sync-service';
import { KvStore } from '../src/kv/store';
import type { SyncConfig } from '../src/types/github';

async function main() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const docsPath = process.env.DOCS_PATH || 'docs';

  if (!owner || !repo || !token) {
    console.error('Missing required env vars: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN');
    process.exit(1);
  }

  const config: SyncConfig = { owner, repo, branch, docsPath, token };

  const kv = {} as KVNamespace;
  const store = new KvStore(kv);
  const syncService = new SyncService(store, config);

  console.log(`Starting full sync: ${owner}/${repo} (${branch})`);
  const result = await syncService.fullSync();
  console.log(`Sync complete: ${result.totalDocs} docs synced`);
  console.log(`Git SHA: ${result.gitSha}`);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
