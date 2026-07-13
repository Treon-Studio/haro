import os
import time

import jwt as pyjwt
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch

os.environ.setdefault("SERVICE_JWT_SECRET", "test-service-secret")

from memory_fabric.proxy_api import app


def make_token(tenant_slug="acme", secret="test-service-secret", aud="memory-fabric", exp_delta=300):
    now = int(time.time())
    payload = {"tenantSlug": tenant_slug, "iss": "haro-website", "aud": aud, "iat": now, "exp": now + exp_delta}
    return pyjwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_call_tool_accepts_valid_matching_token(client):
    token = make_token(tenant_slug="acme")
    with patch("memory_fabric.proxy_api.tenant_manager") as tm:
        tm.get_tenant.return_value = {"status": "active"}
        resp = await client.post(
            "/api/tool",
            json={"tool": "memory_search", "args": {"tenant": "acme", "query": ""}},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_call_tool_rejects_missing_token(client):
    resp = await client.post("/api/tool", json={"tool": "memory_search", "args": {"tenant": "acme"}})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_call_tool_rejects_expired_token(client):
    token = make_token(tenant_slug="acme", exp_delta=-10)
    resp = await client.post(
        "/api/tool",
        json={"tool": "memory_search", "args": {"tenant": "acme"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_call_tool_rejects_wrong_audience(client):
    token = make_token(tenant_slug="acme", aud="something-else")
    resp = await client.post(
        "/api/tool",
        json={"tool": "memory_search", "args": {"tenant": "acme"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_call_tool_rejects_wrong_signature(client):
    token = make_token(tenant_slug="acme", secret="wrong-secret")
    resp = await client.post(
        "/api/tool",
        json={"tool": "memory_search", "args": {"tenant": "acme"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_call_tool_rejects_tenant_mismatch(client):
    """A token minted for tenant A must not be usable to touch tenant B's data."""
    token = make_token(tenant_slug="tenant-a")
    resp = await client.post(
        "/api/tool",
        json={"tool": "memory_search", "args": {"tenant": "tenant-b", "query": ""}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
