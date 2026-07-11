# Haro Memory Fabric

MCP server providing mem0 (conversational memory), gbrain (knowledge graph),
and vault (file storage) tools for the Haro AI ecosystem.

## Dev

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -m memory_fabric.server
```

## Deploy

```bash
cp deploy/memory-fabric-mcp.service /etc/systemd/system/
cp deploy/env /etc/memory-fabric-mcp/env
systemctl daemon-reload
systemctl enable --now memory-fabric-mcp
```
