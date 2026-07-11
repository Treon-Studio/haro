-- apps/website/scripts/migrations/003-tenants.sql
CREATE TYPE tenant_status AS ENUM ('active','suspended','deleting','deleted');
CREATE TYPE tenant_plan AS ENUM ('free','starter','pro','enterprise');
CREATE TYPE audit_action AS ENUM (
  'provisioned','suspended','reactivated','plan_changed',
  'deletion_scheduled','deleted','resource_limit_updated','settings_changed'
);

CREATE TABLE IF NOT EXISTS tenants (
  id                TEXT PRIMARY KEY,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT DEFAULT '',
  status            tenant_status NOT NULL DEFAULT 'active',
  plan              tenant_plan NOT NULL DEFAULT 'free',
  vault_path        TEXT NOT NULL,
  gbrain_env_path   TEXT NOT NULL,
  quota_max_memories      INTEGER NOT NULL DEFAULT 10000,
  quota_max_vault_bytes   BIGINT  NOT NULL DEFAULT 1073741824,
  quota_max_gbrain_pages  INTEGER NOT NULL DEFAULT 1000,
  quota_max_users         INTEGER NOT NULL DEFAULT 10,
  usage_memories          INTEGER NOT NULL DEFAULT 0,
  usage_vault_bytes       BIGINT  NOT NULL DEFAULT 0,
  usage_gbrain_pages      INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_by        UUID REFERENCES auth.users(id),
  provisioned_at    TIMESTAMPTZ,
  last_active_at    TIMESTAMPTZ,
  suspended_at      TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_slug_format CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  CONSTRAINT chk_cannot_delete_active CHECK (NOT (deleted_at IS NOT NULL AND status = 'active'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_company ON tenants(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenants_search ON tenants USING gin(to_tsvector('simple', name || ' ' || slug));

CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action          audit_action NOT NULL,
  performed_by    UUID REFERENCES auth.users(id),
  ip_address      INET,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON tenant_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON tenant_audit_log(action, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_resource_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  memories        INTEGER NOT NULL DEFAULT 0,
  vault_bytes     BIGINT  NOT NULL DEFAULT 0,
  gbrain_pages    INTEGER NOT NULL DEFAULT 0,
  api_requests    INTEGER NOT NULL DEFAULT 0,
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_tenant_time ON tenant_resource_snapshots(tenant_id, snapshot_at DESC);

CREATE OR REPLACE FUNCTION trigger_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tenants_updated_at ON tenants;
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
