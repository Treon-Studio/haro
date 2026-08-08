#!/usr/bin/env python3
# apps/memory-fabric/scripts/resource-snapshot.py
"""
Daily cron: snapshot current tenant usage into tenant_resource_snapshots for billing.
"""
import os
import sys
import logging
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s [snapshot] %(levelname)s %(message)s")
logger = logging.getLogger("resource-snapshot")

NEON_URL = os.environ.get("NEON_DATABASE_URL", "")


def snapshot_usage():
    if not NEON_URL:
        logger.error("NEON_DATABASE_URL not set")
        return 1

    from memory_fabric.tenant_manager import _NeonLikeDB
    db = _NeonLikeDB(NEON_URL)

    now = datetime.now(timezone.utc)
    rows = db.fetch(
        "SELECT id, usage_memories, usage_vault_bytes, usage_gbrain_pages FROM tenants WHERE status != 'deleted'"
    )

    if not rows:
        logger.info("No active tenants to snapshot")
        return 0

    snapshotted = 0
    for row in rows:
        try:
            db.execute(
                """INSERT INTO tenant_resource_snapshots
                   (tenant_id, memories, vault_bytes, gbrain_pages, snapshot_at)
                   VALUES (%s, %s, %s, %s, %s)""",
                row["id"], row["usage_memories"], row["usage_vault_bytes"],
                row["usage_gbrain_pages"], now,
            )
            snapshotted += 1
        except Exception as e:
            logger.error("Snapshot failed for %s: %s", row["id"], e)

    logger.info("Snapshotted %d tenants", snapshotted)
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(snapshot_usage())
