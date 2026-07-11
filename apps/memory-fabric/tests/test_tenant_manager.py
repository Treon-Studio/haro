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
