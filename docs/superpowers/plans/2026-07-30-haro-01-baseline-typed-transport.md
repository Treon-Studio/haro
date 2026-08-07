# Haro Baseline and Typed Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a green Desktop baseline and replace the invented JSON socket with one typed `SimpleSocket` facade over the existing authenticated Nostr relay client.

**Architecture:** `RelayClient` remains the sole WebSocket owner and continues to implement Tauri-backed NIP-42, request correlation, replay, backoff, and teardown. `SimpleSocket` becomes a typed application facade that maps Haro event names to Nostr filters/builders and never reports success before relay `OK` acceptance.

**Tech Stack:** React 19, TypeScript 6, Tauri 2 IPC, Nostr NIP-01/NIP-42, Node test runner, Playwright.

## Global Constraints

- Activate Hermit before Git or hook commands: `. ./bin/activate-hermit`.
- Do not modify any file under `mobile/`.
- Preserve user-authored dirty-worktree changes; inspect each diff before editing.
- No second WebSocket and no `{type,payload}` wire protocol.
- A socket is ready only after NIP-42 succeeds; relay `OK false` rejects the write.
- Explicit `disconnect()` must cancel reconnect timers, pending requests, and subscriptions.
- New readable text uses existing rem-based Tailwind tokens.
- Begin each behavior change with a failing test and commit only the task's files.

---

### Task 1: Make the Existing Desktop Baseline Green

**Files:**
- Modify: `desktop/src/app/AppTopChrome.tsx`
- Modify: `desktop/src/features/reminders/lib/reminderService.ts`
- Modify: `desktop/src/features/sidebar/lib/channelMutesSync.ts`
- Modify: `desktop/src/features/sidebar/lib/channelSectionsSync.ts`
- Modify: `desktop/src/features/sidebar/lib/channelSortSync.ts`
- Modify: `desktop/src/features/sidebar/lib/channelStarsSync.ts`
- Modify: `desktop/src/features/sidebar/lib/useChannelSections.ts`
- Modify: `desktop/src/features/sidebar/lib/useChannelSortPreference.ts`
- Test: `desktop/src/features/sidebar/lib/channelPreferenceSyncShape.test.mjs`

**Interfaces:**
- Consumes: current `ChannelSectionStore`, `ChannelSortStore`, and the four sync-manager public APIs.
- Produces: managers consistently exposing `cancelPendingPublish()` and `getPendingStore()` without unused/dead private methods.

- [ ] **Step 1: Add a failing public-shape regression test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { ChannelSectionSyncManager } from "./channelSectionsSync.ts";
import { ChannelSortSyncManager } from "./channelSortSync.ts";

test("preference managers expose one stable pending-store API", () => {
  for (const Manager of [ChannelSectionSyncManager, ChannelSortSyncManager]) {
    const manager = new Manager("00".repeat(32));
    assert.equal(typeof manager.cancelPendingPublish, "function");
    assert.equal(typeof manager.getPendingStore, "function");
    assert.equal(manager.getPendingStore(), null);
    manager.destroy();
  }
});
```

- [ ] **Step 2: Confirm the baseline failure**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop test`

Expected: typecheck fails with the recorded icon, unused reminder, and sidebar manager errors; the new test also fails because both manager names are inconsistent.

- [ ] **Step 3: Apply the minimal shape repair**

Use `AltArrowLeft` and `AltArrowRight` at the two top-chrome button sites. Rename `getPendingSectionStore` and `getPendingSortStore` to `getPendingStore`. Keep only live sync methods; remove unused private fetch/identity helpers until Plan 02 adds their real Nostr implementation. Restore `decryptReminder` usage in `fetchReminders` only in Plan 02; for this baseline delete the unused local function rather than retaining unreachable code.

```ts
cancelPendingPublish(): void {
  if (this.debounceTimer !== null) {
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }
}

getPendingStore(): ChannelSectionStore | null {
  return this.pendingStore;
}
```

- [ ] **Step 4: Run baseline checks**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop test && pnpm --dir desktop check`

Expected: all three commands exit 0; no `TS6133`, `TS2304`, `TS2339`, or `TS2551` remains.

- [ ] **Step 5: Commit the baseline repair**

```bash
. ./bin/activate-hermit
git add desktop/src/app/AppTopChrome.tsx desktop/src/features/reminders/lib/reminderService.ts desktop/src/features/sidebar/lib/channelMutesSync.ts desktop/src/features/sidebar/lib/channelSectionsSync.ts desktop/src/features/sidebar/lib/channelSortSync.ts desktop/src/features/sidebar/lib/channelStarsSync.ts desktop/src/features/sidebar/lib/useChannelSections.ts desktop/src/features/sidebar/lib/useChannelSortPreference.ts desktop/src/features/sidebar/lib/channelPreferenceSyncShape.test.mjs
git commit -m "fix(desktop): restore green Haro baseline"
```

### Task 2: Define the Typed Haro Realtime Contract

**Files:**
- Create: `desktop/src/shared/api/haroRealtimeTypes.ts`
- Create: `desktop/src/shared/api/haroEventMapper.ts`
- Test: `desktop/src/shared/api/haroEventMapper.test.mjs`

**Interfaces:**
- Consumes: `RelayEvent` from `desktop/src/shared/api/types.ts` and kind constants from `desktop/src/shared/constants/kinds.ts`.
- Produces: `HaroRealtimeEvents`, `HaroEventName`, and `mapRelayEvent(event): HaroMappedEvent | null`.

- [ ] **Step 1: Write mapper tests for channel messages and typing**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { mapRelayEvent } from "./haroEventMapper.ts";

test("maps an h-scoped stream event without inventing channel data", () => {
  const event = { id: "a".repeat(64), pubkey: "b".repeat(64), created_at: 10,
    kind: 9, content: "hello", sig: "c".repeat(128), tags: [["h", "general"]] };
  assert.deepEqual(mapRelayEvent(event), {
    type: "message_send",
    payload: { event, channelId: "general" },
  });
});

test("rejects a channel event without an h tag", () => {
  const event = { id: "a".repeat(64), pubkey: "b".repeat(64), created_at: 10,
    kind: 9, content: "hello", sig: "c".repeat(128), tags: [] };
  assert.equal(mapRelayEvent(event), null);
});
```

- [ ] **Step 2: Verify mapper tests fail**

Run: `pnpm --dir desktop test -- haroEventMapper`

Expected: FAIL with module-not-found for `haroEventMapper.ts`.

- [ ] **Step 3: Add closed event types and exhaustive mapping**

```ts
export interface HaroRealtimeEvents {
  connect: { reconnected: boolean };
  message_send: { event: RelayEvent; channelId: string };
  typing_indicator: { event: RelayEvent; channelId: string };
  presence_update: { event: RelayEvent };
  huddle_event: { event: RelayEvent; channelId: string };
  persona_event: { event: RelayEvent };
  preference_update: { event: RelayEvent; preferenceType: string };
  emoji_update: { event: RelayEvent };
  membership_update: { event: RelayEvent };
}

export type HaroEventName = keyof HaroRealtimeEvents;
export type HaroMappedEvent = {
  [K in HaroEventName]: { type: K; payload: HaroRealtimeEvents[K] }
}[HaroEventName];
```

Implement `mapRelayEvent` as a `switch (event.kind)` using named constants. Channel-scoped kinds must call one shared `getRequiredTag(event, "h")`; malformed events return `null`.

- [ ] **Step 4: Run mapper tests and typecheck**

Run: `pnpm --dir desktop test -- haroEventMapper && pnpm --dir desktop typecheck`

Expected: PASS and exit 0.

- [ ] **Step 5: Commit the typed contract**

```bash
. ./bin/activate-hermit
git add desktop/src/shared/api/haroRealtimeTypes.ts desktop/src/shared/api/haroEventMapper.ts desktop/src/shared/api/haroEventMapper.test.mjs
git commit -m "feat(desktop): define typed Haro realtime events"
```

### Task 3: Replace the Invented Socket with a RelayClient Facade

**Files:**
- Modify: `desktop/src/shared/api/realtimeSocketClient.ts`
- Modify: `desktop/src/shared/api/relayClientSession.ts`
- Test: `desktop/src/shared/api/realtimeSocketClient.test.mjs`

**Interfaces:**
- Consumes: `relayClient.fetchEvents`, `subscribeLive`, `subscribeToReconnects`, `subscribeToConnectionState`, `sendMessage`, `publishEvent`, and `disconnect`.
- Produces: typed `SimpleSocket.on<K>()`, `off<K>()`, `subscribeToChannelLive()`, `sendMessage()`, `publishEvent()`, `connect()`, and `disconnect()`.

- [ ] **Step 1: Write a fake-adapter test that rejects unacknowledged writes**

```js
test("publish delegates to relay acknowledgement", async () => {
  const expected = { accepted: false, eventId: "e".repeat(64), message: "blocked" };
  const socket = new SimpleSocket({ publishEvent: async () => expected });
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
```

- [ ] **Step 2: Verify the tests expose the fake success path**

Run: `pnpm --dir desktop test -- realtimeSocketClient`

Expected: FAIL because `SimpleSocket` is not exported/injectable and returns `{accepted:true}` without waiting for relay `OK`.

- [ ] **Step 3: Implement the facade with one transport owner**

```ts
export interface HaroRelayAdapter {
  preconnect(): Promise<void>;
  disconnect(): void;
  publishEvent(event: RelayEvent): Promise<PublishResult>;
  sendMessage(channelId: string, content: string, mentions?: string[], tags?: string[][]): Promise<PublishResult>;
  subscribeLive(filter: RelaySubscriptionFilter, handler: (event: RelayEvent) => void): Promise<() => Promise<void>>;
  subscribeToReconnects(handler: () => void): () => void;
  subscribeToConnectionState(handler: (state: ConnectionState) => void): () => void;
  getConnectionState(): ConnectionState;
}

export class SimpleSocket {
  constructor(private readonly relay: HaroRelayAdapter = relayClient) {}

  async connect(): Promise<void> {
    await this.relay.preconnect();
  }

  disconnect(): void {
    this.disposeSubscriptions();
    this.relay.disconnect();
  }

  publishEvent(event: RelayEvent): Promise<PublishResult> {
    return this.relay.publishEvent(event);
  }
}
```

Delete all direct `WebSocket`, reconnect-attempt, invented `send(type,payload)`, and unconditional acceptance code from `realtimeSocketClient.ts`. Add a read-only `getConnectionState()` method to `RelayClient` that returns its emitter's current state.

- [ ] **Step 4: Run transport-focused tests**

Run: `pnpm --dir desktop test -- realtimeSocketClient && pnpm --dir desktop test -- relay && pnpm --dir desktop typecheck`

Expected: all selected tests pass; `rg -n "new WebSocket|accepted: true|JSON.stringify\(\{ type, payload \}\)" desktop/src/shared/api/realtimeSocketClient.ts` returns no matches.

- [ ] **Step 5: Commit the facade**

```bash
. ./bin/activate-hermit
git add desktop/src/shared/api/realtimeSocketClient.ts desktop/src/shared/api/relayClientSession.ts desktop/src/shared/api/realtimeSocketClient.test.mjs
git commit -m "fix(desktop): back SimpleSocket with authenticated relay client"
```

### Task 4: Move Core Message Consumers to Typed Subscriptions

**Files:**
- Modify: `desktop/src/features/messages/hooks.ts`
- Modify: `desktop/src/features/messages/useChannelTyping.ts`
- Modify: `desktop/src/features/messages/useTypingBroadcast.ts`
- Modify: `desktop/src/features/channels/useLiveChannelUpdates.ts`
- Modify: `desktop/src/app/useAppShellLifecycleEffects.ts`
- Modify: `desktop/src/features/communities/useCommunityInit.ts`
- Test: `desktop/src/shared/api/realtimeSocketClient.test.mjs`
- Test: `desktop/tests/e2e/relay-reconnect.spec.ts`

**Interfaces:**
- Consumes: Task 3 typed facade.
- Produces: message/typing flows that use Nostr events and preserve community teardown ordering.

- [ ] **Step 1: Add a channel isolation test**

```js
test("channel subscription delivers only matching h-tag events", async () => {
  const adapter = fakeRelayAdapter();
  const socket = new SimpleSocket(adapter);
  const seen = [];
  const dispose = await socket.subscribeToChannelLive("general", (value) => seen.push(value));
  adapter.emit(eventWithTags([["h", "random"]]));
  adapter.emit(eventWithTags([["h", "general"]]));
  assert.equal(seen.length, 1);
  await dispose();
});
```

- [ ] **Step 2: Verify the isolation test fails**

Run: `pnpm --dir desktop test -- realtimeSocketClient`

Expected: FAIL because the current facade uses invented event names rather than a Nostr `#h` filter.

- [ ] **Step 3: Convert consumers without compatibility casts**

```ts
const dispose = await realtimeSocketClient.subscribeToChannelLive(
  channelId,
  ({ event }) => handleIncomingMessage(event),
);

await realtimeSocketClient.sendTypingIndicator(channelId, isTyping);
```

Make `connect()` awaited where readiness matters. Keep `resetCommunityState()` ordering: dispose subscriptions, `disconnect()`, reset caches, apply next relay config, then connect.

- [ ] **Step 4: Run Desktop regression gates**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop test && pnpm --dir desktop exec playwright test tests/e2e/relay-reconnect.spec.ts`

Expected: all commands exit 0; reconnect E2E observes no duplicate message and no repeated two-second reconnect loop.

- [ ] **Step 5: Commit consumer migration**

```bash
. ./bin/activate-hermit
git add desktop/src/features/messages/hooks.ts desktop/src/features/messages/useChannelTyping.ts desktop/src/features/messages/useTypingBroadcast.ts desktop/src/features/channels/useLiveChannelUpdates.ts desktop/src/app/useAppShellLifecycleEffects.ts desktop/src/features/communities/useCommunityInit.ts desktop/src/shared/api/realtimeSocketClient.test.mjs desktop/tests/e2e/relay-reconnect.spec.ts
git commit -m "fix(desktop): route core realtime flows through Nostr"
```

### Task 5: Prove Native NIP-42 Lifecycle and Remove Reload Noise

**Files:**
- Modify: `desktop/src-tauri/src/native_websocket.rs`
- Modify: `desktop/src-tauri/src/relay.rs`
- Test: `desktop/src-tauri/src/native_websocket.rs`
- Test: `desktop/tests/e2e/relay-connectivity.spec.ts`

**Interfaces:**
- Consumes: existing `ws_connect`, `ws_send`, `ws_close`, and Tauri `Channel` IPC commands.
- Produces: idempotent close/cancel behavior and stable error codes consumed by `RelayClient`.

- [ ] **Step 1: Add Rust lifecycle tests**

```rust
#[tokio::test]
async fn explicit_close_removes_socket_before_emitting_close() {
    let registry = TestSocketRegistry::new();
    let id = registry.insert_open_socket().await;
    registry.close(id).await.expect("test close should succeed");
    assert!(!registry.contains(id).await);
    assert_eq!(registry.close(id).await, Ok(()));
}
```

Production code must not add `expect`; the test-only assertion is allowed.

- [ ] **Step 2: Verify lifecycle test fails on duplicate close**

Run: `cargo test --manifest-path desktop/src-tauri/Cargo.toml native_websocket`

Expected: the new duplicate-close assertion fails or the helper is absent.

- [ ] **Step 3: Make close and callback cancellation idempotent**

Return `Ok(())` when a socket generation is already gone, stop its task before dropping the Tauri channel, and never invoke an IPC callback after cancellation. Keep actual network/auth failures distinct from explicit shutdown.

```rust
pub async fn close(&self, id: u64) -> Result<(), String> {
    let Some(socket) = self.remove(id).await else {
        return Ok(());
    };
    socket.cancel.cancel();
    socket.join.await.map_err(|error| format!("socket task failed: {error}"))?;
    Ok(())
}
```

- [ ] **Step 4: Run native and Desktop connectivity gates**

Run: `cargo test --manifest-path desktop/src-tauri/Cargo.toml native_websocket && pnpm --dir desktop exec playwright test tests/e2e/relay-connectivity.spec.ts tests/e2e/relay-reconnect.spec.ts`

Expected: all pass; logs contain neither repeated `[Socket] Disconnected` loops nor `Couldn't find callback id` during explicit community teardown.

- [ ] **Step 5: Commit lifecycle repair**

```bash
. ./bin/activate-hermit
git add desktop/src-tauri/src/native_websocket.rs desktop/src-tauri/src/relay.rs desktop/tests/e2e/relay-connectivity.spec.ts
git commit -m "fix(desktop): make native relay teardown idempotent"
```

### Task 6: Phase Gate

**Files:**
- Modify: `docs/superpowers/plans/2026-07-30-haro-01-baseline-typed-transport.md`

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: verified baseline accepted by Plan 02.

- [ ] **Step 1: Scan forbidden transport patterns**

Run: `rg -n "api/chat|api/reminders|api/upload/presigned-url|accepted: true|new WebSocket" desktop/src/shared/api/realtimeSocketClient.ts desktop/src/shared/api/chatStore.ts desktop/src/features/reminders/lib/reminderService.ts desktop/src/shared/api/s3MediaUploader.ts`

Expected: domain shim matches are recorded for Plan 02; `realtimeSocketClient.ts` has no fake protocol or fake acknowledgement match.

- [ ] **Step 2: Run the phase gate**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop test && pnpm --dir desktop check && cargo test --manifest-path desktop/src-tauri/Cargo.toml`

Expected: every command exits 0.

- [ ] **Step 3: Record the evidence**

Add the exact command outputs and remaining Plan 02 shim file names under this task's execution notes; do not mark the plan complete if any gate is red.

- [ ] **Step 4: Commit execution notes**

```bash
. ./bin/activate-hermit
git add docs/superpowers/plans/2026-07-30-haro-01-baseline-typed-transport.md
git commit -m "docs: record Haro transport phase verification"
```
