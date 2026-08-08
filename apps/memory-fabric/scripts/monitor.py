"""Fabric Monitor — health checks for Memory Fabric services + Discord alerts."""

from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None

logger = logging.getLogger("fabric-monitor")

STATE_FILE = Path("/tmp/fabric-monitor-state.json")
CHECK_INTERVAL = 300  # seconds
SUMMARY_EVERY = 6  # every Nth check (30 min)

SERVICES = [
    "mem0",
    "gbrain",
    "vault",
    "couchdb",
    "cloudflared",
    "hermes-mcp",
    "memory-fabric-mcp",
    "memory-fabric-proxy",
]


def check_mem0() -> str:
    try:
        with httpx.Client(timeout=10) as c:
            r = c.get("http://127.0.0.1:7000/api/v1/memories/", params={"user_id": "__health__"})
            if r.status_code < 500:
                return "ok"
            return f"error: HTTP {r.status_code}"
    except Exception as e:
        return f"error: {e}"


def check_gbrain() -> str:
    try:
        r = subprocess.run(
            ["/root/.bun/bin/gbrain", "stats"],
            capture_output=True, text=True, timeout=15,
        )
        if r.returncode == 0:
            return "ok"
        return f"error: exit {r.returncode} — {r.stderr.strip() or r.stdout.strip()[:200]}"
    except FileNotFoundError:
        return "error: gbrain binary not found"
    except subprocess.TimeoutExpired:
        return "error: timed out"
    except Exception as e:
        return f"error: {e}"


def check_vault() -> str:
    return "ok" if Path("/srv/vault-write/").is_dir() else "error: /srv/vault-write/ does not exist"


def check_couchdb() -> str:
    try:
        with httpx.Client(timeout=10) as c:
            r = c.get("http://admin:mem0fabric2024@127.0.0.1:5984/")
            if r.status_code < 500:
                return "ok"
            return f"error: HTTP {r.status_code}"
    except Exception as e:
        return f"error: {e}"


def check_cloudflared() -> str:
    try:
        r = subprocess.run(
            ["systemctl", "is-active", "cloudflared"],
            capture_output=True, text=True, timeout=10,
        )
        status = r.stdout.strip()
        if status == "active":
            return "ok"
        return f"error: systemctl status = {status}"
    except Exception as e:
        return f"error: {e}"


def _check_port(host: str, port: int) -> str:
    try:
        import socket
        with socket.create_connection((host, port), timeout=5):
            return "ok"
    except (ConnectionRefusedError, OSError):
        return "error: connection refused (down)"
    except Exception as e:
        return f"error: {e}"


check_hermes_mcp = lambda: _check_port("127.0.0.1", 8765)
check_memory_fabric_mcp = lambda: _check_port("127.0.0.1", 8770)


def check_memory_fabric_proxy() -> str:
    try:
        with httpx.Client(timeout=10) as c:
            r = c.get("http://127.0.0.1:8771/api/health")
            if r.status_code == 200:
                return "ok"
            return f"error: HTTP {r.status_code}"
    except Exception as e:
        return f"error: {e}"


CHECK_FUNCS = {
    "mem0": check_mem0,
    "gbrain": check_gbrain,
    "vault": check_vault,
    "couchdb": check_couchdb,
    "cloudflared": check_cloudflared,
    "hermes-mcp": check_hermes_mcp,
    "memory-fabric-mcp": check_memory_fabric_mcp,
    "memory-fabric-proxy": check_memory_fabric_proxy,
}


def load_state() -> dict[str, str]:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def save_state(state: dict[str, str]) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n")


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def send_discord(webhook_url: str, title: str, color: int, fields: list[dict]) -> None:
    if not httpx:
        logger.warning("httpx not available, skipping Discord notification")
        return
    payload = {
        "embeds": [{
            "title": title,
            "color": color,
            "fields": fields,
        }],
    }
    try:
        with httpx.Client(timeout=10) as c:
            r = c.post(webhook_url, json=payload)
            r.raise_for_status()
    except Exception as e:
        logger.error("Failed to send Discord notification: %s", e)


def check_all() -> dict[str, str]:
    results: dict[str, str] = {}
    for name, func in CHECK_FUNCS.items():
        try:
            results[name] = func()
        except Exception as e:
            results[name] = f"error: unhandled exception: {e}"
        if results[name] == "ok":
            logger.info("  ✓ %s", name)
        else:
            logger.warning("  ✗ %s — %s", name, results[name])
    return results


STATUS_EMOJI = {"ok": "✅", "error": "❌"}
STATUS_EMOJI_SHORT = {"ok": "✅", "error": "❌"}
TITLE_MAP = {
    ("error", "ok"): ("🟢 Service recovered", 0x00FF00),
    ("ok", "error"): ("🔴 Service down", 0xFF0000),
}


def process_cycle(
    webhook_url: str | None,
    previous: dict[str, str],
    count: int,
) -> dict[str, str]:
    logger.info("Check cycle #%d — %s", count, timestamp())
    results = check_all()

    events: list[dict] = []
    for name in SERVICES:
        prev = previous.get(name, "")
        curr = results[name]
        if prev and prev != curr:
            key = (prev.split(":")[0], curr.split(":")[0])
            if key in TITLE_MAP:
                title, color = TITLE_MAP[key]
                events.append({
                    "title": title,
                    "color": color,
                    "service": name,
                    "prev": prev,
                    "curr": curr,
                })

    if events and webhook_url:
        for ev in events:
            send_discord(webhook_url, ev["title"], ev["color"], [
                {"name": "Service", "value": ev["service"], "inline": True},
                {"name": "Status", "value": f"{STATUS_EMOJI.get(ev['curr'].split(':')[0], '⚠️')} {ev['curr']}", "inline": False},
                {"name": "Previous", "value": f"{STATUS_EMOJI.get(ev['prev'].split(':')[0], '⚠️')} {ev['prev']}", "inline": True},
                {"name": "Timestamp", "value": timestamp()},
            ])

    if webhook_url and count % SUMMARY_EVERY == 0:
        fields = [
            {"name": "Service", "value": "\n".join(SERVICES), "inline": True},
            {"name": "Status", "value": "\n".join(
                f"{STATUS_EMOJI_SHORT.get(r.split(':')[0], '⚠️')} {r}" for r in results.values()
            ), "inline": True},
            {"name": "Timestamp", "value": timestamp(), "inline": False},
        ]
        all_ok = all(v == "ok" for v in results.values())
        title = "🟢 All services healthy" if all_ok else "🔴 Some services degraded"
        color = 0x00FF00 if all_ok else 0xFF0000
        send_discord(webhook_url, title, color, fields)
        logger.info("Summary sent to Discord")

    save_state(results)
    return results


def run_once(webhook_url: str | None) -> None:
    previous = load_state()
    process_cycle(webhook_url, previous, 0)


def run_daemon(webhook_url: str | None) -> None:
    shutdown = False

    def _signal(_signum, _frame):
        nonlocal shutdown
        logger.info("Received signal %s, shutting down...", _signum)
        shutdown = True

    signal.signal(signal.SIGTERM, _signal)
    signal.signal(signal.SIGINT, _signal)

    previous = load_state()
    cycle = 0

    while not shutdown:
        cycle += 1
        previous = process_cycle(webhook_url, previous, cycle)
        if shutdown:
            break
        logger.info("Sleeping %d seconds...", CHECK_INTERVAL)
        try:
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            break

    logger.info("Fabric monitor stopped.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fabric Monitor")
    parser.add_argument("--once", action="store_true", help="Single check, print to stdout")
    parser.add_argument("--daemon", action="store_true", help="Continuous mode (default)")
    parser.add_argument("--discord-url", help="Discord webhook URL (env: DISCORD_WEBHOOK_URL)")
    args = parser.parse_args()

    webhook_url = args.discord_url or os.environ.get("DISCORD_WEBHOOK_URL")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    if not httpx:
        logger.warning("httpx is not installed — Discord notifications disabled")

    if args.once:
        run_once(webhook_url)
    else:
        run_daemon(webhook_url)


if __name__ == "__main__":
    main()
