#!/bin/bash
cd "$(dirname "$0")"

# Check venv exists
if [ ! -d "venv" ]; then
    echo "Error: venv not found. Run: python3.11 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Check node_modules exists
if [ ! -d "webapp/node_modules" ]; then
    echo "Installing webapp dependencies..."
    (cd webapp && npm install)
fi

echo "Starting all services with PM2..."
pm2 start ecosystem.config.js --watch
pm2 save

echo ""
echo "Services started:"
pm2 list

echo ""
echo "View logs: pm2 logs"
echo "Stop all:  pm2 delete all"