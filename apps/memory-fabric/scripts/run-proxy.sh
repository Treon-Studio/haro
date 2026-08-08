#!/bin/bash
cd /root/go-workspace/haro/apps/memory-fabric
exec /opt/memory-fabric-mcp-venv/bin/python -c "
import sys
sys.path.insert(0, 'src')
from memory_fabric.proxy_api import run
run()
"
