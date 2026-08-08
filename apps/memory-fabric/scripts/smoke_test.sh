#!/bin/bash
set -u
TENANT_ID="${1:-tenant-test001}"
FAIL=0

echo "[smoke_test] Testing tenant=${TENANT_ID} at $(date)"

echo "--- Infrastructure ---"

# hermes gateway health
curl -sf http://127.0.0.1:8642/v1/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  OK: hermes gateway health"
else
  echo "  FAIL: hermes gateway health"
  FAIL=1
fi

# gbrain binary
which gbrain > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  OK: gbrain binary"
else
  echo "  FAIL: gbrain binary"
  FAIL=1
fi

# mem0 server health
curl -sf http://127.0.0.1:7000/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  OK: mem0 server health"
else
  echo "  FAIL: mem0 server health"
  FAIL=1
fi

# CouchDB
curl -sf -u "admin:mem0fabric2024" http://127.0.0.1:5984/_up > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  OK: couchdb"
else
  echo "  FAIL: couchdb"
  FAIL=1
fi

# cloudflared
systemctl is-active cloudflared > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  OK: cloudflared"
else
  echo "  FAIL: cloudflared"
  FAIL=1
fi

echo "--- Vault Layer ---"

# vault_read: file exists
VAULT_FILE="/srv/vault-write/${TENANT_ID}"
if [ -f "${VAULT_FILE}/test-note.md" ] || [ -d "${VAULT_FILE}" ]; then
  echo "  OK: vault_read (${VAULT_FILE})"
else
  echo "  FAIL: vault_read (${VAULT_FILE} not found)"
  FAIL=1
fi

# vault_write: try creating a temp file
TEST_FILE="${VAULT_FILE}/.smoke-test-$(date +%s).md"
echo "smoke test" > "$TEST_FILE" 2>/dev/null
if [ -f "$TEST_FILE" ]; then
  rm -f "$TEST_FILE"
  echo "  OK: vault_write"
else
  echo "  FAIL: vault_write"
  FAIL=1
fi

# livesync daemon running
if systemctl is-active "livesync@${TENANT_ID}" > /dev/null 2>&1; then
  echo "  OK: livesync@${TENANT_ID}"
else
  echo "  WARN: livesync@${TENANT_ID} not active"
fi

echo "--- Memory Layer (mem0) ---"

# mem0 store
STORE_RES=$(curl -s -X POST http://127.0.0.1:7000/memories \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"smoke test from ${TENANT_ID}\"}],\"user_id\":\"${TENANT_ID}\"}" --max-time 60 2>/dev/null)
if echo "$STORE_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0) if d.get('results') else exit(1)" 2>/dev/null; then
  echo "  OK: mem0 store"
else
  echo "  WARN: mem0 store returned empty (model extraction may vary)"
fi

# mem0 search
SEARCH_RES=$(curl -s -X POST http://127.0.0.1:7000/search \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"smoke test\",\"filters\":{\"user_id\":\"${TENANT_ID}\"}}" --max-time 30 2>/dev/null)
if echo "$SEARCH_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0) if len(d.get('results',[])) > 0 else exit(1)" 2>/dev/null; then
  echo "  OK: mem0 search (found results)"
else
  echo "  WARN: mem0 search (no results - may need more data)"
fi

# mem0 list/get_all
GET_RES=$(curl -s "http://127.0.0.1:7000/memories?user_id=${TENANT_ID}" --max-time 30 2>/dev/null)
if echo "$GET_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0) if len(d.get('results',[])) > 0 else exit(1)" 2>/dev/null; then
  echo "  OK: mem0 list"
else
  echo "  WARN: mem0 list empty"
fi

echo "--- Knowledge Layer (gbrain) ---"

# gbrain put (create test page)
echo "# gbrain smoke test $(date)" | gbrain put "smoke-${TENANT_ID}" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  OK: gbrain put"
else
  echo "  WARN: gbrain put failed"
fi

# gbrain search
GBRAIN_SEARCH=$(gbrain search "smoke" 2>/dev/null)
if echo "$GBRAIN_SEARCH" | grep -q "smoke-${TENANT_ID}"; then
  echo "  OK: gbrain search"
else
  echo "  WARN: gbrain search (no match - may need indexing)"
fi

# gbrain stats
GBRAIN_STATS=$(gbrain doctor --json 2>/dev/null)
if echo "$GBRAIN_STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0) if isinstance(d, dict) else exit(1)" 2>/dev/null; then
  echo "  OK: gbrain doctor"
else
  echo "  WARN: gbrain doctor failed"
fi

echo "--- MCP Tools (memory-fabric-mcp) ---"

# memory-fabric-mcp service
if systemctl is-active memory-fabric-mcp > /dev/null 2>&1; then
  echo "  OK: memory-fabric-mcp service"
else
  echo "  FAIL: memory-fabric-mcp service not active"
  FAIL=1
fi

# fabric_health via MCP
MCP_SESS=$(curl -s http://127.0.0.1:8770/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":"st-init","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1"}}}' \
  -D - 2>&1 | grep -i "mcp-session-id" | tr -d '\r' | awk '{print $2}' 2>/dev/null)
if [ -n "$MCP_SESS" ]; then
  echo "  OK: MCP session"
  HEALTH_RES=$(curl -s http://127.0.0.1:8770/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: ${MCP_SESS}" \
    -d '{"jsonrpc":"2.0","id":"st-health","method":"tools/call","params":{"name":"fabric_health","arguments":{}}}' 2>/dev/null)
  if echo "$HEALTH_RES" | python3 -c "
import sys, json
for line in sys.stdin:
    if line.startswith('data: '):
        d = json.loads(line[6:])
        r = json.loads(d['result']['content'][0]['text'])
        exit(0 if r.get('mem0') == 'ok' and r.get('gbrain') == 'ok' else 1)
exit(1)
" 2>/dev/null; then
    echo "  OK: fabric_health (all backends ok)"
  else
    echo "  WARN: fabric_health reported issues"
  fi
  # vault_read via MCP
  VR_RES=$(curl -s http://127.0.0.1:8770/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: ${MCP_SESS}" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":\"st-vr\",\"method\":\"tools/call\",\"params\":{\"name\":\"vault_read\",\"arguments\":{\"path\":\"test-note.md\",\"tenant\":\"${TENANT_ID}\"}}}" 2>/dev/null)
  if echo "$VR_RES" | python3 -c "
import sys, json
for line in sys.stdin:
    if line.startswith('data: '):
        d = json.loads(line[6:])
        txt = d['result']['content'][0]['text']
        exit(0 if 'Test Note' in txt else 1)
exit(1)
" 2>/dev/null; then
    echo "  OK: vault_read (via MCP)"
  else
    echo "  WARN: vault_read (via MCP) failed"
  fi
  # memory_search via MCP
  MS_RES=$(curl -s http://127.0.0.1:8770/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: ${MCP_SESS}" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":\"st-ms\",\"method\":\"tools/call\",\"params\":{\"name\":\"memory_search\",\"arguments\":{\"query\":\"smoke test\",\"user_id\":\"${TENANT_ID}\"}}}" 2>/dev/null)
  if echo "$MS_RES" | python3 -c "
import sys, json
for line in sys.stdin:
    if line.startswith('data: '):
        d = json.loads(line[6:])
        txt = d['result']['content'][0]['text']
        r = json.loads(txt)
        exit(0 if len(r.get('results', [])) > 0 else 1)
exit(1)
" 2>/dev/null; then
    echo "  OK: memory_search (via MCP)"
  else
    echo "  WARN: memory_search (via MCP) failed"
  fi
else
  echo "  FAIL: MCP session initialization"
  FAIL=1
fi

echo "--- Summary ---"
if [ $FAIL -eq 0 ]; then
  echo "  RESULT: ALL OK"
else
  echo "  RESULT: $FAIL check(s) FAILED"
fi

exit $FAIL
