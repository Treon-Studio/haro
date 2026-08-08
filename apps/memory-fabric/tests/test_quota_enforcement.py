import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient, ASGITransport
from memory_fabric.proxy_api import app

os.environ.setdefault("MANAGEMENT_API_KEY", "test-key")


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_blocks_memory_store_when_quota_exceeded(client):
    with (
        patch("memory_fabric.proxy_api.get_tenant_manager") as mock_get_tm,
        patch("memory_fabric.proxy_api._resolve_fn") as mock_resolve,
    ):
        mock_tm = MagicMock()
        mock_tm.get_tenant.return_value = {
            "status": "active",
            "usage_memories": 10000,
            "quota_max_memories": 10000,
        }
        mock_get_tm.return_value = mock_tm
        mock_resolve.return_value = AsyncMock(return_value={"result": "ok"})

        resp = await client.post(
            "/api/tool",
            json={"tool": "memory_store", "args": {"tenant": "quota-full", "content": "test"}},
            headers={"Authorization": "Bearer test-key"},
        )

    assert resp.status_code == 403
    data = resp.json()
    assert data["error"]["code"] == "QUOTA_EXCEEDED"
