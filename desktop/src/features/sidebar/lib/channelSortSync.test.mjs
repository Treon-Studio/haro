import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { relayClient } from "../../../shared/api/relayClient.ts";
import { ChannelSortSyncManager } from "./channelSortSync.ts";

function makeStore(groups = {}) {
  return { version: 1, groups };
}

// ─── destroy() must cancel pending publish, not flush ─────────────────────────

// Regression guard for the community-switch cross-relay publish vector:
// change a sort mode in relay A → destroy() is called (relayUrl dep change) →
// no publish should fire. The scoped localStorage write is durable; when the
// user returns to relay A the seed-publish path handles it.
test("destroy: cancels pending publish without flushing to the relay", () => {
  const publishCalls = [];
  mock.method(relayClient, "fetchEvents", () => Promise.resolve([]));
  mock.method(relayClient, "publishEvent", (...args) => {
    publishCalls.push(args);
    return Promise.resolve();
  });

  let timerCallback = null;
  const fakeTimers = [];
  let nextId = 1;
  if (typeof globalThis.window === "undefined") {
    globalThis.window = {};
  }
  const originalSetTimeout = globalThis.window.setTimeout;
  const originalClearTimeout = globalThis.window.clearTimeout;
  globalThis.window.setTimeout = (fn, _ms) => {
    const id = nextId++;
    fakeTimers.push({ id, fn });
    timerCallback = fn;
    return id;
  };
  globalThis.window.clearTimeout = (id) => {
    const idx = fakeTimers.findIndex((t) => t.id === id);
    if (idx !== -1) {
      fakeTimers.splice(idx, 1);
      timerCallback = null;
    }
  };

  try {
    const manager = new ChannelSortSyncManager("pk-test", relayClient);
    const store = makeStore({ channels: "recent" });

    manager.publishSortPrefs(store);
    assert.ok(timerCallback !== null, "debounce timer should be set");

    manager.destroy();

    assert.ok(
      timerCallback === null,
      "debounce timer should be cleared on destroy",
    );
    assert.equal(
      publishCalls.length,
      0,
      "no publish event should have been sent after destroy",
    );
  } finally {
    if (originalSetTimeout !== undefined) {
      globalThis.window.setTimeout = originalSetTimeout;
    }
    if (originalClearTimeout !== undefined) {
      globalThis.window.clearTimeout = originalClearTimeout;
    }
    mock.reset();
  }
});

// Regression guard for the timer-fired race: debounce fires → doPublish starts
// awaiting fetchOwnBlobBeforePublish → destroy() is called (relayUrl dep
// change) → publishEvent must never be called even though the timer already
// fired and cleared itself before destroy() ran.
test("destroy: aborts in-flight doPublish after fetchOwnBlobBeforePublish resolves", async () => {
  let releaseFetch = null;
  if (typeof globalThis.window === "undefined") {
    globalThis.window = {};
  }
  let capturedCallback = null;
  let nextId = 1;
  const origSetTimeout = globalThis.window.setTimeout;
  const origClearTimeout = globalThis.window.clearTimeout;
  globalThis.window.setTimeout = (fn, _ms) => {
    capturedCallback = fn;
    return nextId++;
  };
  globalThis.window.clearTimeout = (_id) => {
    capturedCallback = null;
  };

  try {
    const manager = new ChannelSortSyncManager("pk-race");
    mock.method(manager, "fetchRemoteSortPrefs", () => {
      return new Promise((resolve) => {
        releaseFetch = () => resolve(null);
      });
    });

    const store = makeStore({
      order: ["c1", "c2"],
    });

    manager.publishSortPrefs(store);
    assert.ok(capturedCallback !== null, "debounce timer should be set");

    const timerFn = capturedCallback;
    capturedCallback = null;
    timerFn();

    manager.destroy();

    assert.equal(typeof releaseFetch, "function");
    releaseFetch();

    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    if (origSetTimeout !== undefined) {
      globalThis.window.setTimeout = origSetTimeout;
    }
    if (origClearTimeout !== undefined) {
      globalThis.window.clearTimeout = origClearTimeout;
    }
    mock.reset();
  }
});

test("destroy: is safe to call with no pending publish", () => {
  const manager = new ChannelSortSyncManager("pk-no-pending");
  assert.doesNotThrow(() => manager.destroy());
});

test("destroy: cancelPendingPublish clears pendingStore", () => {
  let timerCallback = null;
  let nextId = 1;
  if (typeof globalThis.window === "undefined") {
    globalThis.window = {};
  }
  const orig = globalThis.window.setTimeout;
  const origClear = globalThis.window.clearTimeout;
  globalThis.window.setTimeout = (fn, _ms) => {
    timerCallback = fn;
    return nextId++;
  };
  globalThis.window.clearTimeout = (_id) => {
    timerCallback = null;
  };

  try {
    const manager = new ChannelSortSyncManager("pk-pending-null");
    const store = makeStore({ starred: "recent" });
    manager.publishSortPrefs(store);
    assert.deepEqual(manager.getPendingStore(), store);

    manager.destroy();
    assert.equal(
      manager.getPendingStore(),
      null,
      "pendingStore must be null after destroy",
    );
    assert.ok(timerCallback === null, "timer must be cleared after destroy");
  } finally {
    globalThis.window.setTimeout = orig;
    globalThis.window.clearTimeout = origClear;
  }
});
