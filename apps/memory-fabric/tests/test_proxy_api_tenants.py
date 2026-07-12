import os
import pytest
from httpx import AsyncClient, ASGITransport
from memory_fabric.proxy_api import app
from unittest.mock import patch, MagicMock

os.environ.setdefault("MANAGEMENT_API_KEY", "test-key")


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_provision_requires_auth(client):
    resp = await client.put("/api/tenants/provision", json={"slug": "test"})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_provision_success(client):
    with patch("memory_fabric.proxy_api.tenant_manager") as tm:
        tm.provision.return_value = {"slug": "test", "status": "active"}
        resp = await client.put(
            "/api/tenants/provision",
            json={"slug": "test", "name": "Test"},
            headers={"Authorization": "Bearer test-key"},
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["slug"] == "test"


@pytest.mark.anyio
async def test_list_tenants(client):
    with patch("memory_fabric.proxy_api.tenant_manager") as tm:
        tm.list_tenants.return_value = ([{"slug": "test"}], 1)
        resp = await client.get(
            "/api/tenants",
            headers={"Authorization": "Bearer test-key"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"] == [{"slug": "test"}]


@pytest.mark.anyio
async def test_suspend_tenant(client):
    with patch("memory_fabric.proxy_api.tenant_manager") as tm:
        tm.update_status.return_value = {"slug": "test", "status": "suspended"}
        resp = await client.post(
            "/api/tenants/test/suspend",
            json={"reason": "test"},
            headers={"Authorization": "Bearer test-key"},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "suspended"


@pytest.mark.anyio
async def test_call_tool_requires_auth(client):
    """Unauthenticated POST to /api/tool must return 401."""
    # Don't need to mock anything - should fail at auth check before hitting DB
    resp = await client.post(
        "/api/tool",
        json={"tool": "memory_search", "args": {"tenant": "test"}},
    )
    assert resp.status_code == 401
