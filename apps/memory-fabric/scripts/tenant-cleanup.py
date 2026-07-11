#!/usr/bin/env python3
# apps/memory-fabric/scripts/tenant-cleanup.py
"""
Daily cleanup job for soft-deleted tenants.
Picks up tenants where deleted_at < NOW(), cleans up filesystem resources,
then marks status as 'deleted'.
"""
import os
import sys
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s [cleanup] %(levelname)s %(message)s")
logger = logging.getLogger("tenant-cleanup")

NEON_URL = os.environ.get("NEON_DATABASE_URL", "")
VAULT_ROOT = os.environ.get("VAULT_ROOT", "/srv/vault-write")
GBRAIN_ENV_DIR = os.environ.get("GBRAIN_ENV_DIR", "/srv/memory-fabric/env")


def cleanup_expired_tenants():
    if not NEON_URL:
        logger.error("NEON_DATABASE_URL not set")
        return 1

    from memory_fabric.tenant_manager import _NeonLikeDB
    db = _NeonLikeDB(NEON_URL)

    now = datetime.now(timezone.utc)
    rows = db.fetch(
        "SELECT slug, vault_path, gbrain_env_path FROM tenants "
        "WHERE status = 'deleting' AND deleted_at < %s",
        now,
    )

    if not rows:
        logger.info("No expired tenants to clean up")
        return 0

    cleaned = 0
    errors = 0

    for row in rows:
        slug = row["slug"]
        vault_path = row["vault_path"]
        env_path = row["gbrain_env_path"]

        try:
            if vault_path and Path(vault_path).exists():
                shutil.rmtree(vault_path, ignore_errors=True)
                logger.info("Removed vault dir", extra={"slug": slug, "path": vault_path})

            if env_path and Path(env_path).exists():
                Path(env_path).unlink(missing_ok=True)
                logger.info("Removed env file", extra={"slug": slug, "path": env_path})

            db.execute(
                "UPDATE tenants SET status = 'deleted', deleted_at = %s WHERE slug = %s",
                now, slug,
            )
            db.execute(
                "INSERT INTO tenant_audit_log (tenant_id, action, metadata, created_at) "
                "VALUES (%s, 'deleted', %s, %s)",
                slug, json.dumps({"cleanup_after_days": 7, "deleted_at": now.isoformat()}), now,
            )
            cleaned += 1
            logger.info("Tenant cleanup complete", extra={"slug": slug})

        except Exception as e:
            errors += 1
            logger.error("Cleanup failed", extra={"slug": slug, "error": str(e)})

    logger.info(f"Cleanup: {cleaned} cleaned, {errors} errors")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(cleanup_expired_tenants())
