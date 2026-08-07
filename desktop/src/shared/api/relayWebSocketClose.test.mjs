import assert from "node:assert/strict";
import test from "node:test";

import { closeAllWebSockets, closeWebSocket } from "./relayWebSocketClose.ts";
import { createTauriCallbackRegistration } from "./relayClientLifecycle.ts";

const tauriCalls = [];
globalThis.window = globalThis;
globalThis.__TAURI_INTERNALS__ = {
  invoke: async (cmd, args) => {
    tauriCalls.push({ cmd, args });
  },
  transformCallback: () => 1,
  unregisterCallback: () => {},
};

test("closeWebSocket invokes authoritative native disconnect", async () => {
  const calls = [];
  await closeWebSocket(42, "community switch", async (cmd, args) => {
    calls.push({ cmd, args });
  });

  assert.deepEqual(calls, [
    { cmd: "plugin:websocket|disconnect", args: { id: 42 } },
  ]);
});

test("closeWebSocket is idempotent when the native socket is gone", async () => {
  await closeWebSocket(7, "connection reset", async () => {
    throw new Error("WebSocket connection not found");
  });
});

test("closeAllWebSockets invokes native process-wide teardown", async () => {
  const calls = [];
  await closeAllWebSockets(async (cmd, args) => calls.push({ cmd, args }));
  assert.deepEqual(calls, [
    { cmd: "plugin:websocket|disconnect_all", args: undefined },
  ]);
});

test("Tauri callback registration unregisters once and ignores late completions", () => {
  const callbacks = new Map();
  const unregistered = [];
  const delivered = [];
  const registration = createTauriCallbackRegistration(
    (message) => delivered.push(message),
    (handler) => {
      const channel = { id: 42 };
      callbacks.set(channel.id, handler);
      return channel;
    },
    (id) => {
      unregistered.push(id);
      callbacks.delete(id);
    },
  );

  registration.unregister();
  registration.unregister();
  callbacks.get(42)?.({ type: "Text", data: "late" });

  assert.deepEqual(unregistered, [42], "callback is removed exactly once");
  assert.deepEqual(
    delivered,
    [],
    "late completion is cancellation, not delivery",
  );
});

test("RelayClient disconnect is idempotent and rejects pending publishes", async () => {
  const { RelayClient } = await import("./relayClientSession.ts");
  const client = new RelayClient();
  const event = {
    id: "event-1",
    pubkey: "pubkey",
    created_at: 1,
    kind: 9,
    tags: [],
    content: "pending",
    sig: "sig",
  };
  let rejected = null;
  client.wsId = 7;
  client.pendingEvents.set(event.id, {
    event,
    resolve: () => {},
    reject: (error) => {
      rejected = error;
    },
    timeout: setTimeout(() => {}, 10_000),
  });

  tauriCalls.length = 0;
  client.disconnect();
  client.disconnect();

  assert.equal(rejected?.message, "Relay disconnected for community switch.");
  assert.equal(client.pendingEvents.size, 0, "pending publishes are cleared");
  assert.deepEqual(
    tauriCalls.filter(({ cmd }) => cmd === "plugin:websocket|disconnect"),
    [{ cmd: "plugin:websocket|disconnect", args: { id: 7 } }],
    "the native socket closes once",
  );
  await assert.rejects(
    client.publishEvent(event),
    /Relay session is terminal; cannot reconnect/,
  );
  assert.equal(
    tauriCalls.filter(({ cmd }) => cmd === "plugin:websocket|connect").length,
    0,
    "publishing after teardown does not allocate a new socket",
  );
});

test("RelayClient disconnect rejects a live subscription waiting for readiness", async () => {
  const { RelayClient } = await import("./relayClientSession.ts");
  const client = new RelayClient();
  client.wsId = 8;
  tauriCalls.length = 0;

  const subscription = client.subscribeLive({ kinds: [9], limit: 0 }, () => {});
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(client.subscriptions.size, 1, "live subscription is pending");

  client.disconnect();

  await assert.rejects(subscription, /Relay disconnected for community switch/);
  assert.equal(client.subscriptions.size, 0, "live subscription is removed");
});

test("RelayClient emits connected only after NIP-42 authentication succeeds", async () => {
  const { RelayClient } = await import("./relayClientSession.ts");
  const client = new RelayClient();
  const states = [];
  let connectArgs = null;
  let authSent = false;
  const originalInvoke = globalThis.__TAURI_INTERNALS__.invoke;
  globalThis.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
    if (cmd === "get_relay_ws_url") return "ws://relay.test";
    if (cmd === "plugin:websocket|connect") {
      connectArgs = args;
      return 9;
    }
    if (cmd === "create_auth_event") {
      return JSON.stringify({
        id: "auth-event",
        pubkey: "pubkey",
        created_at: 1,
        kind: 22242,
        tags: [],
        content: "",
        sig: "sig",
      });
    }
    if (cmd === "plugin:websocket|send") {
      authSent = JSON.parse(args.message.data)[0] === "AUTH";
    }
  };
  const unsubscribe = client.subscribeToConnectionState((state) =>
    states.push(state),
  );
  let connection = null;

  try {
    connection = client.preconnect();
    for (let attempt = 0; attempt < 10 && !connectArgs; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(connectArgs?.onMessage !== undefined, true, "socket opened");
    assert.equal(
      states.includes("connected"),
      false,
      "connect is withheld before AUTH succeeds",
    );

    connectArgs.onMessage.onmessage({
      type: "Text",
      data: JSON.stringify(["AUTH", "challenge"]),
    });
    for (let attempt = 0; attempt < 10 && !authSent; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(
      authSent,
      true,
      "AUTH frame sent before relay acknowledgement",
    );
    assert.equal(
      states.includes("connected"),
      false,
      "connect remains withheld while AUTH is pending",
    );

    connectArgs.onMessage.onmessage({
      type: "Text",
      data: JSON.stringify(["OK", "auth-event", true, ""]),
    });
    await connection;

    assert.equal(states.at(-1), "connected", "AUTH completion emits connect");
  } finally {
    unsubscribe();
    client.disconnect();
    await connection?.catch(() => {});
    globalThis.__TAURI_INTERNALS__.invoke = originalInvoke;
  }
});
