import os
import re
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import psycopg2
import psycopg2.extras

logger = logging.getLogger("tenant_manager")

SLUG_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")


def _serialize(obj):
    """Recursively convert datetime objects to ISO strings in dicts/lists."""
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


class _NeonLikeDB:
    """Thin wrapper to make psycopg2 look like Neon SDK (fetchrow/fetch/execute)."""
    def __init__(self, url: str):
        self._conn = psycopg2.connect(url)

    def fetchrow(self, query: str, *params):
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            row = cur.fetchone()
            return _serialize(row) if row else None

    def fetch(self, query: str, *params):
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            return [_serialize(r) for r in rows]

    def execute(self, query: str, *params):
        try:
            with self._conn.cursor() as cur:
                cur.execute(query, params)
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

    def close(self):
        self._conn.close()


class ProvisioningError(Exception):
    def __init__(self, code: str, message: str, details: Optional[dict] = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


class TenantManager:
    def __init__(
        self,
        neon_url: str,
        vault_root: str = "/srv/vault-write",
        gbrain_env_dir: str = "/srv/memory-fabric/env",
        management_api_key: str = "",
    ):
        self.neon_url = neon_url
        self.vault_root = vault_root
        self.gbrain_env_dir = gbrain_env_dir
        self.management_api_key = management_api_key
        self._db = None  # lazy init

    def _get_db(self):
        if self._db is None:
            self._db = _NeonLikeDB(self.neon_url)
        return self._db

    @staticmethod
    def _validate_slug(slug: str):
        if not SLUG_RE.match(slug) or len(slug) < 3 or len(slug) > 63:
            raise ProvisioningError(
                "VALIDATION_ERROR",
                f"Invalid slug '{slug}'. Must be 3-63 chars, lowercase alphanumeric with hyphens.",
            )

    def provision(
        self,
        slug: str,
        name: str,
        company_id: Optional[str] = None,
        created_by: Optional[str] = None,
        plan: str = "free",
        description: str = "",
    ) -> dict:
        self._validate_slug(slug)
        db = self._get_db()

        existing = db.fetchrow("SELECT id, status FROM tenants WHERE slug = %s", slug)
        if existing:
            raise ProvisioningError(
                "TENANT_SLUG_EXISTS",
                f"Tenant '{slug}' already exists with status '{existing['status']}'",
                {"slug": slug, "status": existing["status"]},
            )

        vault_path = os.path.join(self.vault_root, slug)
        env_path = os.path.join(self.gbrain_env_dir, f"{slug}.env")
        created_resources = []

        try:
            os.makedirs(vault_path, mode=0o755, exist_ok=False)
            created_resources.append(("dir", vault_path))

            with open(env_path, "w") as f:
                f.write(f"GBRAIN_INDEX_NAME={slug}\n")
            created_resources.append(("file", env_path))

            now = datetime.now(timezone.utc)
            db.execute(
                """INSERT INTO tenants
                   (id, company_id, name, slug, description, status, plan,
                    vault_path, gbrain_env_path, created_by, provisioned_at, created_at)
                   VALUES (%s,%s,%s,%s,%s,'active',%s,%s,%s,%s,%s,%s)""",
                slug, company_id, name, slug, description,
                plan, vault_path, env_path, created_by, now, now,
            )

            db.execute(
                """INSERT INTO tenant_audit_log
                   (tenant_id, action, performed_by, metadata, created_at)
                   VALUES (%s,'provisioned',%s,%s,%s)""",
                slug, created_by, json.dumps({"plan": plan}), now,
            )

            logger.info("Provisioned tenant", extra={"slug": slug, "name": name})
            return {
                "slug": slug,
                "name": name,
                "status": "active",
                "plan": plan,
                "vault_path": vault_path,
                "gbrain_env_path": env_path,
                "provisioned_at": now.isoformat(),
                "created_at": now.isoformat(),
            }

        except FileExistsError:
            raise ProvisioningError(
                "CONFLICT",
                f"Vault path already exists: {vault_path}",
                {"slug": slug, "path": vault_path},
            )
        except Exception as e:
            self._rollback(created_resources)
            logger.error("Provisioning failed", extra={"slug": slug, "error": str(e)})
            raise ProvisioningError(
                "PROVISIONING_FAILED",
                f"Failed to provision tenant: {e}",
            ) from e

    def _rollback(self, resources: list):
        for rtype, path in reversed(resources):
            try:
                if rtype == "dir":
                    os.rmdir(path)
                elif rtype == "file":
                    os.remove(path)
            except OSError:
                pass

    def get_tenant(self, slug: str) -> Optional[dict]:
        db = self._get_db()
        row = db.fetchrow(
            """SELECT id, company_id, name, slug, description, status, plan,
                      vault_path, gbrain_env_path, quota_max_memories,
                      quota_max_vault_bytes, quota_max_gbrain_pages, quota_max_users,
                      usage_memories, usage_vault_bytes, usage_gbrain_pages,
                      provisioned_at, last_active_at, suspended_at, deleted_at,
                       created_at, updated_at
               FROM tenants WHERE slug = %s""",
            slug,
        )
        if not row:
            return None
        return dict(row)

    def list_tenants(
        self,
        page: int = 1,
        per_page: int = 20,
        sort: str = "created_at",
        order: str = "desc",
        status: Optional[str] = None,
        plan: Optional[str] = None,
        search: Optional[str] = None,
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
    ) -> tuple[list[dict], int]:
        db = self._get_db()
        where_clauses = []
        params = []

        if status:
            where_clauses.append("status = %s")
            params.append(status)
        if plan:
            where_clauses.append("plan = %s")
            params.append(plan)
        if search:
            where_clauses.append("(name ILIKE %s OR slug ILIKE %s)")
            params.extend([f"%{search}%", f"%{search}%"])
        if created_after:
            where_clauses.append("created_at >= %s")
            params.append(created_after)
        if created_before:
            where_clauses.append("created_at < %s")
            params.append(created_before)

        where = " AND ".join(where_clauses) if where_clauses else "TRUE"
        allowed_sorts = {"created_at", "name", "status", "plan"}
        sort_col = sort if sort in allowed_sorts else "created_at"
        order_dir = "ASC" if order == "asc" else "DESC"
        offset = (page - 1) * per_page
        limit = min(per_page, 100)

        count_row = db.fetchrow(f"SELECT COUNT(*) as cnt FROM tenants WHERE {where}", *params)
        total = count_row["cnt"] if count_row else 0

        rows = db.fetch(
            f"SELECT slug, name, status, plan, usage_memories, usage_vault_bytes, "
            f"usage_gbrain_pages, provisioned_at, last_active_at "
            f"FROM tenants WHERE {where} ORDER BY {sort_col} {order_dir} "
            f"LIMIT %s OFFSET %s",
            *params, limit, offset,
        )

        return [dict(r) for r in rows], total

    def update_status(self, slug: str, new_status: str, performed_by: Optional[str] = None, reason: str = "") -> dict:
        if new_status not in {"suspended", "active", "deleting"}:
            raise ProvisioningError("INVALID_STATUS", f"Invalid status '{new_status}'")
        db = self._get_db()
        row = db.fetchrow("SELECT status FROM tenants WHERE slug = %s", slug)
        if not row:
            raise ProvisioningError("NOT_FOUND", f"Tenant '{slug}' not found")

        old_status = row["status"]
        now = datetime.now(timezone.utc)

        updates = {"status": new_status}
        if new_status == "suspended":
            updates["suspended_at"] = now
        elif new_status == "active" and old_status == "suspended":
            updates["suspended_at"] = None

        set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
        values = list(updates.values())
        db.execute(f"UPDATE tenants SET {set_clause} WHERE slug = %s", *values, slug)

        db.execute(
            """INSERT INTO tenant_audit_log (tenant_id, action, performed_by, metadata, created_at)
               VALUES (%s,%s,%s,%s,%s)""",
            slug,
            f"{'suspended' if new_status == 'suspended' else 'reactivated' if new_status == 'active' else 'deletion_scheduled'}",
            performed_by,
            json.dumps({"reason": reason, "old_status": old_status}),
            now,
        )

        return {"slug": slug, "status": new_status, "updated_at": now.isoformat()}

    def get_stats(self, slug: str) -> Optional[dict]:
        db = self._get_db()
        row = db.fetchrow(
            """SELECT slug, usage_memories, usage_vault_bytes, usage_gbrain_pages,
                      quota_max_memories, quota_max_vault_bytes, quota_max_gbrain_pages
               FROM tenants WHERE slug = %s""",
            slug,
        )
        if not row:
            return None
        r = dict(row)
        limits = {}
        for key, max_key in [
            ("memories", "quota_max_memories"),
            ("vault_bytes", "quota_max_vault_bytes"),
            ("gbrain_pages", "quota_max_gbrain_pages"),
        ]:
            max_val = r[max_key]
            used = r[f"usage_{key}"]
            limits[key] = {
                "max": max_val,
                "used": used,
                "percent": round(used / max_val * 100, 1) if max_val > 0 else 0,
            }
        return {
            "slug": slug,
            "usage": {k: r[f"usage_{k}"] for k in ["memories", "vault_bytes", "gbrain_pages"]},
            "limits": limits,
        }

    def suspend(self, slug: str, performed_by: Optional[str] = None, reason: str = "") -> dict:
        return self.update_status(slug, "suspended", performed_by, reason)

    def reactivate(self, slug: str, performed_by: Optional[str] = None, reason: str = "") -> dict:
        return self.update_status(slug, "active", performed_by, reason)

    def schedule_delete(self, slug: str, performed_by: Optional[str] = None, reason: str = "") -> dict:
        return self.update_status(slug, "deleting", performed_by, reason)

    def close(self):
        if self._db is not None:
            self._db.close()
            self._db = None

    def get_audit_log(self, tenant_id: Optional[str] = None, action: Optional[str] = None, limit: int = 50) -> list[dict]:
        db = self._get_db()
        clauses = []
        params = []
        if tenant_id:
            clauses.append("tenant_id = %s")
            params.append(tenant_id)
        if action:
            clauses.append("action = %s")
            params.append(action)
        where = " AND ".join(clauses) if clauses else "TRUE"
        limit = min(limit, 200)
        rows = db.fetch(
            f"SELECT * FROM tenant_audit_log WHERE {where} ORDER BY created_at DESC LIMIT %s",
            *params, limit,
        )
        return [dict(r) for r in rows]
