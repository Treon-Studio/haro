import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { SimpleSocket } from "./realtimeSocketClient.ts";

const EXPECTED_CHANNEL_LIVE_EVENT_KINDS = [
  5, 7, 9005, 9, 40002, 45001, 45003, 40001, 40003, 40008, 40099, 43001, 43002,
  43003, 43004, 43005, 43006, 48100, 48101, 48102, 48103, 39005, 20002, 24810,
];

const sourceRoot = new URL("../../", import.meta.url);

async function sourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return entry.isFile() ? [path] : [];
    }),
  );
  return nested.flat();
}

test("feature consumers do not use the legacy socket surface", async () => {
  const files = await sourceFiles(sourceRoot.pathname);
  const violations = [];

  for (const file of files) {
    const path = relative(sourceRoot.pathname, file);
    if (
      path === "shared/api/realtimeSocketClient.ts" ||
      path === "shared/api/realtimeSocketClient.test.mjs"
    ) {
      continue;
    }

    const source = await readFile(file, "utf8");
    const facadeAliases = Array.from(
      source.matchAll(
        /import\s*\{\s*realtimeSocketClient(?:\s+as\s+(\w+))?\s*\}\s*from\s*["'][^"']*realtimeSocketClient["']/g,
      ),
      (match) => match[1] ?? "realtimeSocketClient",
    );
    const hasAliasedLegacySend = facadeAliases.some((alias) =>
      new RegExp(`\\b${alias}\\.send\\s*\\(`).test(source),
    );
    const hasUntypedAliasedHandler =
      facadeAliases.length > 0 &&
      /(?:const|function)\s+\w+[^=]*=?\s*\(event\s*:\s*any\)/.test(source);
    const hasNoopFacadeCleanup =
      facadeAliases.length > 0 &&
      /cleanup\s*=\s*\(\)\s*=>\s*\{\s*\}/.test(source);
    if (
      hasAliasedLegacySend ||
      hasUntypedAliasedHandler ||
      hasNoopFacadeCleanup
    ) {
      violations.push(path);
    }
  }

  assert.deepEqual(violations, []);
});

function fakeRelayAdapter() {
  let preconnectCalls = 0;
  let disconnectCalls = 0;
  const reconnectSubscribers = new Set();
  const liveSubscribers = new Set();

  return {
    get preconnectCalls() {
      return preconnectCalls;
    },
    get disconnectCalls() {
      return disconnectCalls;
    },
    get liveFilters() {
      return Array.from(liveSubscribers, ({ filter }) => filter);
    },
    get liveSubscriberCount() {
      return liveSubscribers.size;
    },
    async fetchEvents() {
      return [];
    },
    async preconnect() {
      preconnectCalls += 1;
    },
    disconnect() {
      disconnectCalls += 1;
    },
    async publishEvent(event) {
      return { accepted: true, eventId: event?.id || "e1", message: "ok" };
    },
    async sendMessage() {
      return { accepted: true, eventId: "m1", message: "ok" };
    },
    async subscribeLive(filter, handler) {
      const entry = { filter, handler };
      liveSubscribers.add(entry);
      return async () => liveSubscribers.delete(entry);
    },
    subscribeToReconnects(handler) {
      reconnectSubscribers.add(handler);
      return () => reconnectSubscribers.delete(handler);
    },
    subscribeToConnectionState() {
      return () => {};
    },
    getConnectionState() {
      return "connected";
    },
    emitReconnect() {
      for (const handler of reconnectSubscribers) handler();
    },
    emit(event) {
      for (const entry of liveSubscribers) {
        entry.handler(event);
      }
    },
  };
}

function eventWithTags(tags) {
  return {
    id: "e1",
    pubkey: "p1",
    created_at: 1,
    kind: 9,
    tags,
    content: "hi",
    sig: "s1",
  };
}

function mappedEvent(kind, tags = [], suffix = kind) {
  return {
    id: suffix.toString(16).padStart(64, "0"),
    pubkey: "p1",
    created_at: 1,
    kind,
    tags,
    content: "hi",
    sig: "s1",
  };
}

test("publish delegates to relay acknowledgement", async () => {
  const expected = {
    accepted: false,
    eventId: "e".repeat(64),
    message: "blocked",
  };
  const socket = new SimpleSocket({
    ...fakeRelayAdapter(),
    publishEvent: async () => expected,
  });
  assert.equal(await socket.publishEvent({ id: expected.eventId }), expected);
});

test("explicit disconnect never schedules facade reconnect", () => {
  const adapter = fakeRelayAdapter();
  const socket = new SimpleSocket(adapter);
  socket.connect();
  socket.disconnect();
  adapter.emitReconnect();
  assert.equal(adapter.preconnectCalls, 1);
});

test("channel subscription rejects mismatched and unscoped events but preserves referenced auxiliary context", async () => {
  const adapter = fakeRelayAdapter();
  const socket = new SimpleSocket(adapter);
  const seen = [];
  const dispose = await socket.subscribeToChannelLive("general", (value) =>
    seen.push(value.tags),
  );
  adapter.emit(eventWithTags([["h", "random"]]));
  adapter.emit(mappedEvent(9, [], 90));
  adapter.emit(mappedEvent(7, [["e", "message"]], 91));
  adapter.emit(eventWithTags([["h", "general"]]));
  assert.deepEqual(seen, [[["e", "message"]], [["h", "general"]]]);
  assert.deepEqual(
    adapter.liveFilters[0].kinds,
    EXPECTED_CHANNEL_LIVE_EVENT_KINDS,
  );
  assert.deepEqual(adapter.liveFilters[0]["#h"], ["general"]);
  await dispose();
});

test("channel subscription emits only mapped events for its channel", async () => {
  const adapter = fakeRelayAdapter();
  const socket = new SimpleSocket(adapter);
  const seen = [];
  const unsubscribe = socket.on("message_send", (payload) => {
    if (payload.channelId === "general") seen.push(payload);
  });
  const dispose = await socket.subscribeToChannelLive("general", () => {});

  adapter.emit(mappedEvent(9, [["h", "random"]], 91));
  adapter.emit(mappedEvent(9, [["h", "general"]], 92));

  assert.deepEqual(
    seen.map(({ channelId }) => channelId),
    ["general"],
  );
  unsubscribe();
  await dispose();
});

test("channel subscription routes every canonical channel event family", async () => {
  const adapter = fakeRelayAdapter();
  const socket = new SimpleSocket(adapter);
  const routed = [];
  const removers = [
    socket.on("message_send", ({ event }) => routed.push(event.kind)),
    socket.on("typing_indicator", ({ event }) => routed.push(event.kind)),
    socket.on("reaction_event", ({ event }) => routed.push(event.kind)),
    socket.on("huddle_event", ({ event }) => routed.push(event.kind)),
  ];
  const dispose = await socket.subscribeToChannelLive("general", () => {});
  const kinds = [
    9, 40001, 40002, 40003, 40008, 40099, 43001, 43002, 43003, 43004, 43005,
    43006, 45001, 45003, 9005, 39005, 20002, 7, 48100, 48101, 48102, 48103,
    24810,
  ];

  for (const kind of kinds) {
    adapter.emit(mappedEvent(kind, [["h", "general"]]));
  }

  assert.deepEqual(new Set(routed), new Set(kinds));
  for (const remove of removers) remove();
  await dispose();
});

test("typed channel subscriptions preserve scope and requested history", async () => {
  const adapter = fakeRelayAdapter();
  const socket = new SimpleSocket(adapter);
  const seen = [];
  const dispose = await socket.subscribeToChannelEvent(
    "general",
    "huddle_event",
    ({ channelId }) => seen.push(channelId),
    { limit: 100 },
  );

  assert.deepEqual(adapter.liveFilters[0], {
    kinds: [48100, 48101, 48102, 48103, 24810],
    limit: 100,
    "#h": ["general"],
  });
  adapter.emit(mappedEvent(48100, [["h", "random"]], 481_001));
  adapter.emit(mappedEvent(48100, [["h", "general"]], 481_002));
  assert.deepEqual(seen, ["general"]);

  await dispose();
  assert.equal(adapter.liveSubscriberCount, 0);
});

test("typed on handlers own a live relay subscription for every family", async () => {
  const adapter = fakeRelayAdapter();
  const socket = new SimpleSocket(adapter);
  const routed = [];
  const removers = [
    socket.on("profile_event", ({ event }) => routed.push(event.kind)),
    socket.on("persona_event", ({ event }) => routed.push(event.kind)),
    socket.on("preference_update", ({ event }) => routed.push(event.kind)),
    socket.on("emoji_update", ({ event }) => routed.push(event.kind)),
    socket.on("presence_update", ({ event }) => routed.push(event.kind)),
    socket.on("user_status_update", ({ event }) => routed.push(event.kind)),
    socket.on("membership_update", ({ event }) => routed.push(event.kind)),
  ];

  assert.equal(adapter.liveSubscriberCount, removers.length);
  assert.ok(
    adapter.liveFilters.some(
      (filter) =>
        filter.kinds.length === 1 &&
        filter.kinds[0] === 20001 &&
        filter.limit === 0,
    ),
  );

  const events = [
    mappedEvent(0),
    mappedEvent(30175),
    mappedEvent(30176),
    mappedEvent(30177),
    mappedEvent(5, [["a", "30175:pk1:persona"]], 50),
    mappedEvent(30078, [["d", "channel-mutes"]]),
    mappedEvent(30030),
    mappedEvent(20001),
    mappedEvent(30315, [["d", "general"]]),
    mappedEvent(9000, [
      ["h", "general"],
      ["p", "pk1"],
    ]),
    mappedEvent(44100, [
      ["h", "general"],
      ["p", "pk1"],
    ]),
    mappedEvent(44101, [
      ["h", "general"],
      ["p", "pk1"],
    ]),
  ];
  for (const event of events) adapter.emit(event);

  assert.deepEqual(new Set(routed), new Set(events.map(({ kind }) => kind)));
  for (const remove of removers) remove();
  await Promise.resolve();
  assert.equal(adapter.liveSubscriberCount, 0);
});
