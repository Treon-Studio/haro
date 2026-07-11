import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from memory_fabric.tenant_manager import TenantManager, ProvisioningError


@pytest.fixture
def manager():
    vault_root = tempfile.mkdtemp()
    env_dir = tempfile.mkdtemp()
    mgr = TenantManager(
        neon_url="postgresql://test:test@localhost:5432/test",
        vault_root=vault_root,
        gbrain_env_dir=env_dir,
        management_api_key="test-key",
    )
    mgr._db = MagicMock()  # mock DB
    mgr._db.fetchrow.return_value = None  # no existing tenant by default
    return mgr


class TestProvision:
    def test_success_creates_vault_dir(self, manager):
        slug = "test-tenant"
        result = manager.provision(
            slug=slug,
            name="Test Tenant",
            created_by=None,
        )
        vault_path = Path(manager.vault_root) / slug
        assert vault_path.exists()
        assert vault_path.is_dir()

    def test_success_creates_env_file(self, manager):
        slug = "test-tenant"
        result = manager.provision(slug=slug, name="Test Tenant")
        env_file = Path(manager.gbrain_env_dir) / f"{slug}.env"
        assert env_file.exists()
        content = env_file.read_text()
        assert f"GBRAIN_INDEX_NAME={slug}" in content

    def test_success_returns_tenant_dict(self, manager):
        slug = "test-tenant"
        result = manager.provision(slug=slug, name="Test Tenant")
        assert result["slug"] == slug
        assert result["status"] == "active"
        assert result["vault_path"].endswith(slug)

    def test_raises_on_invalid_slug(self, manager):
        with pytest.raises(ProvisioningError, match="Invalid slug"):
            manager.provision(slug="UPPERCASE_SLUG!", name="Bad")

    def test_raises_on_existing_tenant(self, manager):
        manager._db.fetchrow.return_value = {"id": "exists", "status": "active"}
        with pytest.raises(ProvisioningError, match="already exists"):
            manager.provision(slug="exists", name="Exists")

    def test_rollback_on_db_failure(self, manager):
        manager._db.execute.side_effect = Exception("DB down")
        slug = "rollback-test"
        with pytest.raises(ProvisioningError):
            manager.provision(slug=slug, name="Rollback")
        vault_path = Path(manager.vault_root) / slug
        env_file = Path(manager.gbrain_env_dir) / f"{slug}.env"
        assert not vault_path.exists()
        assert not env_file.exists()


def test_integration_vault_dir_creation(manager):
    """Verify vault dir is created with correct permissions."""
    slug = "integration-test"
    result = manager.provision(slug=slug, name="Integration Test")
    vault = Path(result["vault_path"])
    assert vault.stat().st_mode & 0o777 == 0o755
    # cleanup
    vault.rmdir()
    Path(manager.gbrain_env_dir, f"{slug}.env").unlink()


class TestGetTenant:
    def test_returns_tenant(self, manager):
        manager._db.fetchrow.return_value = {
            "id": "t1", "company_id": None, "name": "Test", "slug": "test-tenant",
            "description": "", "status": "active", "plan": "free",
            "vault_path": "/vault/test-tenant", "gbrain_env_path": "/env/test-tenant.env",
            "quota_max_memories": 100, "quota_max_vault_bytes": 1000,
            "quota_max_gbrain_pages": 10, "quota_max_users": 5,
            "usage_memories": 0, "usage_vault_bytes": 0, "usage_gbrain_pages": 0,
            "provisioned_at": None, "last_active_at": None, "suspended_at": None,
            "deleted_at": None, "created_at": None, "updated_at": None,
        }
        result = manager.get_tenant("test-tenant")
        assert result is not None
        assert result["slug"] == "test-tenant"

    def test_returns_none_when_not_found(self, manager):
        manager._db.fetchrow.return_value = None
        assert manager.get_tenant("nonexistent") is None


class TestListTenants:
    def test_returns_tenants(self, manager):
        manager._db.fetchrow.return_value = {"cnt": 1}
        manager._db.fetch.return_value = [
            {"slug": "t1", "name": "T1", "status": "active", "plan": "free",
             "usage_memories": 0, "usage_vault_bytes": 0, "usage_gbrain_pages": 0,
             "provisioned_at": None, "last_active_at": None},
        ]
        results, total = manager.list_tenants()
        assert len(results) == 1
        assert total == 1
        assert results[0]["slug"] == "t1"

    def test_returns_empty(self, manager):
        manager._db.fetchrow.return_value = {"cnt": 0}
        manager._db.fetch.return_value = []
        results, total = manager.list_tenants()
        assert results == []
        assert total == 0


class TestSuspend:
    def test_suspend_success(self, manager):
        manager._db.fetchrow.return_value = {"status": "active"}
        result = manager.suspend("test-tenant", performed_by="admin", reason="testing")
        assert result["status"] == "suspended"

    def test_suspend_not_found(self, manager):
        manager._db.fetchrow.return_value = None
        with pytest.raises(ProvisioningError, match="not found"):
            manager.suspend("nonexistent")


class TestReactivate:
    def test_reactivate_success(self, manager):
        manager._db.fetchrow.return_value = {"status": "suspended"}
        result = manager.reactivate("test-tenant", performed_by="admin")
        assert result["status"] == "active"

    def test_reactivate_not_found(self, manager):
        manager._db.fetchrow.return_value = None
        with pytest.raises(ProvisioningError, match="not found"):
            manager.reactivate("nonexistent")


class TestScheduleDelete:
    def test_schedule_delete_success(self, manager):
        manager._db.fetchrow.return_value = {"status": "active"}
        result = manager.schedule_delete("test-tenant", performed_by="admin")
        assert result["status"] == "deleting"

    def test_schedule_delete_not_found(self, manager):
        manager._db.fetchrow.return_value = None
        with pytest.raises(ProvisioningError, match="not found"):
            manager.schedule_delete("nonexistent")


class TestGetStats:
    def test_returns_stats(self, manager):
        manager._db.fetchrow.return_value = {
            "slug": "test-tenant", "usage_memories": 5, "usage_vault_bytes": 500,
            "usage_gbrain_pages": 2, "quota_max_memories": 100, "quota_max_vault_bytes": 1000,
            "quota_max_gbrain_pages": 10,
        }
        stats = manager.get_stats("test-tenant")
        assert stats["slug"] == "test-tenant"
        assert stats["usage"]["memories"] == 5
        assert stats["limits"]["memories"]["percent"] == 5.0

    def test_returns_none_when_not_found(self, manager):
        manager._db.fetchrow.return_value = None
        assert manager.get_stats("nonexistent") is None


class TestGetAuditLog:
    def test_returns_logs(self, manager):
        manager._db.fetch.return_value = [
            {"tenant_id": "t1", "action": "provisioned", "performed_by": "admin",
             "metadata": "{}", "created_at": None, "id": 1},
        ]
        logs = manager.get_audit_log()
        assert len(logs) == 1
        assert logs[0]["action"] == "provisioned"

    def test_returns_empty(self, manager):
        manager._db.fetch.return_value = []
        assert manager.get_audit_log() == []


class TestUpdateStatusValidation:
    def test_raises_on_invalid_status(self, manager):
        with pytest.raises(ProvisioningError) as exc_info:
            manager.update_status("test-tenant", "invalid_status")
        assert exc_info.value.code == "INVALID_STATUS"


class TestClose:
    def test_close_calls_db_close(self, manager):
        db_mock = MagicMock()
        manager._db = db_mock
        manager.close()
        db_mock.close.assert_called_once()
        assert manager._db is None

    def test_close_no_db(self, manager):
        manager._db = None
        manager.close()  # should not raise
