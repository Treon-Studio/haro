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
async def test_usage_incremented_after_memory_store(client):
    with (
        patch("memory_fabric.proxy_api.get_tenant_manager") as mock_get_tm,
        patch("memory_fabric.proxy_api._resolve_fn") as mock_resolve,
    ):
        mock_tm = MagicMock()
        mock_tm.get_tenant.return_value = {"status": "active"}
        mock_get_tm.return_value = mock_tm
        mock_resolve.return_value = AsyncMock(return_value={"result": "ok"})

        resp = await client.post(
            "/api/tool",
            json={"tool": "memory_store", "args": {"tenant": "test-tenant", "content": "hello"}},
            headers={"Authorization": "Bearer test-key"},
        )

    assert resp.status_code == 200
    mock_tm.increment_usage.assert_called_once_with("test-tenant", "memories", 1)
