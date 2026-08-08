-- apps/website/scripts/migrations/004-conversations.sql
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  owner_key   TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_owner_key_format CHECK (owner_key ~ '^(org:.+|personal:.+)$')
);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated ON conversations(owner_key, updated_at DESC);

-- trigger_set_updated_at() already exists from migration 003-tenants.sql — reused, not redefined.
DROP TRIGGER IF EXISTS set_conversations_updated_at ON conversations;
CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
