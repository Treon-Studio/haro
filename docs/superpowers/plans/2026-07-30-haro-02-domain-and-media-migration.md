# Haro Domain and Media Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every fake/no-op Desktop REST shim and preserve chat, profile, preferences, reminders, presence, huddle, and media through the existing Nostr and Blossom surfaces.

**Architecture:** Domain adapters build/query signed Nostr events through the Plan 01 `SimpleSocket` facade and Tauri signing boundary. Binary upload remains native through the existing Blossom commands; no feature receives a second HTTP backend.

**Tech Stack:** TypeScript 6, React Query, Tauri 2, NIP-01/NIP-25/NIP-29/NIP-78, NIP-98, Blossom, Node tests, Playwright.

## Global Constraints

- Plan 01 phase gate must be green before starting.
- Do not modify `mobile/`.
- Channel filters and events use `h` tags, never `e` tags for channel scope.
- Queries always include explicit `kinds`.
- A domain write resolves only after relay `OK true`.
- Preserve materialized thread counter behavior by publishing the same reply tags consumed by relay handlers.
- Never fall back to local-only success after a remote error.

---

### Task 1: Replace ChatStore HTTP with Nostr Domain Mapping

**Files:**
- Modify: `desktop/src/shared/api/chatStore.ts`
- Modify: `desktop/src/features/messages/ui/MessageTimeline.tsx`
- Modify: `desktop/src/features/messages/ui/MessageThreadPanel.tsx`
- Modify: `desktop/src/features/messages/useThreadReplies.ts`
- Test: `desktop/src/shared/api/chatStore.test.mjs`

**Interfaces:**
- Consumes: `realtimeSocketClient.fetchEvents`, `sendMessage`, and `publishEvent` from Plan 01.
- Produces: `fetchChannelMessages(channelId, limit, before?)`, `sendMessage(input)`, and `addMessageReaction(input)` with existing call-site signatures.

- [ ] **Step 1: Add failing filter/tag tests**

```js
test("history query is kind- and h-scoped", async () => {
  const relay = captureRelay();
  await fetchChannelMessages("general", 25, "1700000000", relay);
  assert.deepEqual(relay.filters[0], {
    kinds: [9, 40002, 40003, 40008],
    "#h": ["general"],
    until: 1700000000,
    limit: 25,
  });
});

test("reply writes preserve h and thread references", async () => {
  const relay = captureRelay();
  await sendMessage({ channelId: "general", content: "reply", replyToId: "p", threadRootId: "r" }, relay);
  assert.deepEqual(relay.signed.tags, [["h", "general"], ["e", "r", "", "root"], ["e", "p", "", "reply"]]);
});
```

- [ ] **Step 2: Verify tests fail against `/api/chat`**

Run: `pnpm --dir desktop test -- chatStore`

Expected: FAIL because `chatStore` calls `http://localhost:3000/api/chat`.

- [ ] **Step 3: Implement explicit event mapping**

```ts
export interface ChatRelayPort {
  fetchEvents(filter: RelaySubscriptionFilter): Promise<RelayEvent[]>;
  sendMessage(channelId: string, content: string, mentions?: string[], tags?: string[][]): Promise<PublishResult>;
  publishEvent(event: RelayEvent): Promise<PublishResult>;
}

export async function fetchChannelMessages(
  channelId: string,
  limit = 50,
  before?: string,
  relay: ChatRelayPort = realtimeSocketClient,
): Promise<SimpleChatMessage[]> {
  const events = await relay.fetchEvents(buildChannelHistoryFilter(channelId, limit, before ? Number(before) : undefined));
  return events.map(toTimelineMessage).filter((value): value is SimpleChatMessage => value !== null);
}
```

Use `signRelayEvent({kind: KIND_REACTION, content: emoji, tags:[["e", messageId]]})` for reactions. Throw the relay rejection message when `accepted` is false.

- [ ] **Step 4: Run unit and message E2E tests**

Run: `pnpm --dir desktop test -- chatStore && pnpm --dir desktop typecheck && pnpm --dir desktop exec playwright test tests/e2e/messaging.spec.ts tests/e2e/reaction-order.spec.ts tests/e2e/thread-reply-anchor-roleplay.spec.ts`

Expected: all pass; `rg -n "api/chat" desktop/src` returns no matches.

- [ ] **Step 5: Commit chat migration**

```bash
. ./bin/activate-hermit
git add desktop/src/shared/api/chatStore.ts desktop/src/shared/api/chatStore.test.mjs desktop/src/features/messages/ui/MessageTimeline.tsx desktop/src/features/messages/ui/MessageThreadPanel.tsx desktop/src/features/messages/useThreadReplies.ts
git commit -m "fix(desktop): restore chat through Nostr events"
```

### Task 2: Restore Profile and Read-State Writes

**Files:**
- Modify: `desktop/src/shared/api/chatStore.ts`
- Modify: `desktop/src/features/profile/hooks.ts`
- Modify: `desktop/src/features/channels/readState/readStateManager.ts`
- Test: `desktop/src/shared/api/chatStore.test.mjs`
- Test: `desktop/tests/e2e/profile.spec.ts`

**Interfaces:**
- Consumes: NIP-01 metadata kind `0` and NIP-78 kind `30078` with a stable `d` tag.
- Produces: acknowledged `updateUserProfile(profile)` and `updateReadState(contextId,timestamp)`.

- [ ] **Step 1: Add replacement-event tests**

```js
test("read state is a NIP-78 replacement event", async () => {
  const relay = captureRelay();
  await updateReadState("channel:general", 1700000000, relay);
  assert.equal(relay.signed.kind, 30078);
  assert.deepEqual(relay.signed.tags, [["d", "haro:read-state:channel:general"]]);
  assert.equal(relay.signed.content, JSON.stringify({ version: 1, timestamp: 1700000000 }));
});
```

- [ ] **Step 2: Verify no-op behavior fails**

Run: `pnpm --dir desktop test -- chatStore`

Expected: FAIL because the current methods return without publishing.

- [ ] **Step 3: Publish signed replacement events**

```ts
const event = await signRelayEvent({
  kind: KIND_READ_STATE,
  content: JSON.stringify({ version: 1, timestamp }),
  tags: [["d", `haro:read-state:${contextId}`]],
});
const result = await relay.publishEvent(event);
if (!result.accepted) throw new Error(result.message);
```

Profile updates merge the current kind-0 content before signing so an avatar-only edit does not erase name/about fields.

- [ ] **Step 4: Run profile/read tests**

Run: `pnpm --dir desktop test -- chatStore && pnpm --dir desktop exec playwright test tests/e2e/profile.spec.ts tests/e2e/thread-unread.spec.ts`

Expected: all pass and neither method contains a no-op body.

- [ ] **Step 5: Commit profile/read migration**

```bash
. ./bin/activate-hermit
git add desktop/src/shared/api/chatStore.ts desktop/src/shared/api/chatStore.test.mjs desktop/src/features/profile/hooks.ts desktop/src/features/channels/readState/readStateManager.ts desktop/tests/e2e/profile.spec.ts
git commit -m "fix(desktop): persist profile and read state via Nostr"
```

### Task 3: Implement NIP-78 Preference Synchronization

**Files:**
- Create: `desktop/src/features/sidebar/lib/preferenceEventStore.ts`
- Modify: `desktop/src/features/sidebar/lib/channelMutesSync.ts`
- Modify: `desktop/src/features/sidebar/lib/channelSectionsSync.ts`
- Modify: `desktop/src/features/sidebar/lib/channelSortSync.ts`
- Modify: `desktop/src/features/sidebar/lib/channelStarsSync.ts`
- Test: `desktop/src/features/sidebar/lib/preferenceEventStore.test.mjs`
- Test: `desktop/tests/e2e/channel-sort.spec.ts`
- Test: `desktop/tests/e2e/channel-star.spec.ts`
- Test: `desktop/tests/e2e/channel-mute.spec.ts`

**Interfaces:**
- Consumes: kind `30078`, author filter, and `d` values `haro:channel-mutes`, `haro:channel-sections`, `haro:channel-sort`, `haro:channel-stars`.
- Produces: `fetchPreference<T>(pubkey,type,parse)` and `publishPreference<T>(type,value)`.

- [ ] **Step 1: Add newest-valid-event and acknowledgement tests**

```js
test("fetch selects newest valid own replacement event", async () => {
  const relay = captureRelay([event(10, "bad"), event(9, validPayload)]);
  const result = await fetchPreference("pubkey", "channel-stars", parseStars, relay);
  assert.deepEqual(result?.store, expectedStore);
  assert.equal(relay.filters[0].authors[0], "pubkey");
  assert.deepEqual(relay.filters[0]["#d"], ["haro:channel-stars", "buzz:channel-stars"]);
});
```

- [ ] **Step 2: Verify tests fail with REST/no-op managers**

Run: `pnpm --dir desktop test -- preferenceEventStore`

Expected: FAIL because the shared event store does not exist.

- [ ] **Step 3: Implement dual-read and Haro-only writes**

```ts
export async function publishPreference<T>(
  type: PreferenceType,
  value: T,
  relay: PreferenceRelayPort = realtimeSocketClient,
): Promise<PublishResult> {
  const event = await signRelayEvent({
    kind: KIND_CHANNEL_STARS,
    content: JSON.stringify({ version: 1, value }),
    tags: [["d", `haro:${type}`]],
  });
  return requireAccepted(await relay.publishEvent(event));
}
```

Each manager keeps debounce, merge, destroy, and last-published behavior but delegates network work to this module. Legacy `buzz:` values are read only and rewritten as `haro:` on the next user mutation.

- [ ] **Step 4: Run preference gates**

Run: `pnpm --dir desktop test -- preferenceEventStore && pnpm --dir desktop typecheck && pnpm --dir desktop exec playwright test tests/e2e/channel-sort.spec.ts tests/e2e/channel-star.spec.ts tests/e2e/channel-mute.spec.ts`

Expected: all pass; `rg -n "api/preferences" desktop/src` returns no matches.

- [ ] **Step 5: Commit preference migration**

```bash
. ./bin/activate-hermit
git add desktop/src/features/sidebar/lib/preferenceEventStore.ts desktop/src/features/sidebar/lib/preferenceEventStore.test.mjs desktop/src/features/sidebar/lib/channelMutesSync.ts desktop/src/features/sidebar/lib/channelSectionsSync.ts desktop/src/features/sidebar/lib/channelSortSync.ts desktop/src/features/sidebar/lib/channelStarsSync.ts desktop/tests/e2e/channel-sort.spec.ts desktop/tests/e2e/channel-star.spec.ts desktop/tests/e2e/channel-mute.spec.ts
git commit -m "fix(desktop): sync preferences with NIP-78 events"
```

### Task 4: Restore Encrypted Reminder Queries and Writes

**Files:**
- Modify: `desktop/src/features/reminders/lib/reminderService.ts`
- Modify: `desktop/src/features/reminders/lib/reminderService.test.mjs`
- Test: `desktop/tests/e2e/reminders.spec.ts`

**Interfaces:**
- Consumes: kind `30300`, author-scoped queries, NIP-44 self encryption/decryption, and relay acknowledgement.
- Produces: functional fetch/create/complete/snooze/cancel methods with unchanged signatures.

- [ ] **Step 1: Add query and LWW tests**

```js
test("fetch decrypts only the newest valid event for each d tag", async () => {
  const relay = reminderRelay([reminderEvent("a", 10, "pending"), reminderEvent("a", 11, "done")]);
  const values = await fetchReminders("pubkey", relay);
  assert.equal(values.length, 1);
  assert.equal(values[0].content.status, "done");
  assert.deepEqual(relay.filters[0], { kinds: [30300], authors: ["pubkey"], limit: 500 });
});
```

- [ ] **Step 2: Verify current empty result fails**

Run: `pnpm --dir desktop test -- reminderService`

Expected: FAIL because `fetchReminders` always returns `[]` and writes call `/api/reminders`.

- [ ] **Step 3: Implement relay-backed reminders**

Restore `decryptReminder`, query explicit kind/author, fold newest event by `d`, ignore malformed/decrypt failures, and publish all mutations through `realtimeSocketClient.publishEvent`.

```ts
const result = await relay.publishEvent(event);
if (!result.accepted) {
  throw new Error(result.message || "Relay rejected reminder update.");
}
return event;
```

- [ ] **Step 4: Run reminder gates**

Run: `pnpm --dir desktop test -- reminderService && pnpm --dir desktop exec playwright test tests/e2e/reminders.spec.ts tests/e2e/reminder-click-repro.spec.ts`

Expected: all pass; `rg -n "api/reminders" desktop/src` returns no matches.

- [ ] **Step 5: Commit reminder migration**

```bash
. ./bin/activate-hermit
git add desktop/src/features/reminders/lib/reminderService.ts desktop/src/features/reminders/lib/reminderService.test.mjs desktop/tests/e2e/reminders.spec.ts
git commit -m "fix(desktop): restore encrypted Nostr reminders"
```

### Task 5: Restore Native Blossom Upload

**Files:**
- Modify: `desktop/src/shared/api/s3MediaUploader.ts`
- Modify: `desktop/src/shared/api/tauriMedia.ts`
- Modify: `desktop/src/features/messages/lib/useMediaUpload.ts`
- Test: `desktop/src/shared/api/s3MediaUploader.test.mjs`
- Test: `desktop/tests/e2e/file-attachment.spec.ts`
- Test: `desktop/tests/e2e/video-attachment.spec.ts`

**Interfaces:**
- Consumes: existing Tauri commands `pick_and_upload_media`, `upload_media_bytes`, and `media-upload-progress`.
- Produces: SHA-256-backed `BlobDescriptor`; no presigned S3 URL is exposed to React.

- [ ] **Step 1: Add an IPC boundary test**

```js
test("upload delegates bytes to Tauri Blossom command", async () => {
  const calls = [];
  const file = new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" });
  const result = await uploadMedia(file, async (command, args) => calls.push({ command, args }) || descriptor);
  assert.equal(calls[0].command, "upload_media_bytes");
  assert.equal(result.sha256, descriptor.sha256);
});
```

- [ ] **Step 2: Verify presigned URL code fails**

Run: `pnpm --dir desktop test -- s3MediaUploader`

Expected: FAIL because the current code calls `/api/upload/presigned-url` and returns only a string URL.

- [ ] **Step 3: Delegate to existing native commands**

```ts
export async function uploadMedia(file: File): Promise<BlobDescriptor> {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
  return invokeTauri<BlobDescriptor>("upload_media_bytes", {
    bytes,
    filename: file.name,
    mimeType: file.type,
  });
}
```

Prefer `pick_and_upload_media` for picker flows so large files do not cross React IPC. Keep byte upload only for drag/drop and edited in-memory images. Use the returned hash, size, MIME, and URL unchanged.

- [ ] **Step 4: Run media gates**

Run: `pnpm --dir desktop test -- s3MediaUploader && cargo test --manifest-path desktop/src-tauri/Cargo.toml commands::media && pnpm --dir desktop exec playwright test tests/e2e/file-attachment.spec.ts tests/e2e/video-attachment.spec.ts`

Expected: all pass; `rg -n "presigned-url|file.name,.*sha256" desktop/src` returns no matches.

- [ ] **Step 5: Commit media migration**

```bash
. ./bin/activate-hermit
git add desktop/src/shared/api/s3MediaUploader.ts desktop/src/shared/api/s3MediaUploader.test.mjs desktop/src/shared/api/tauriMedia.ts desktop/src/features/messages/lib/useMediaUpload.ts desktop/tests/e2e/file-attachment.spec.ts desktop/tests/e2e/video-attachment.spec.ts
git commit -m "fix(desktop): restore Blossom media upload"
```

### Task 6: Convert Remaining Semantic Socket Consumers

**Files:**
- Modify: `desktop/src/features/channels/useMembershipNotifications.ts`
- Modify: `desktop/src/features/presence/hooks.ts`
- Modify: `desktop/src/features/custom-emoji/hooks.ts`
- Modify: `desktop/src/features/huddle/lib/useTtsSubscription.ts`
- Modify: `desktop/src/features/huddle/components/HuddleBar.tsx`
- Modify: `desktop/src/features/huddle/components/HuddleIndicator.tsx`
- Modify: `desktop/src/features/huddle/components/HuddleAttachment.tsx`
- Modify: `desktop/src/features/agents/lib/usePersonaSync.ts`
- Modify: `desktop/src/features/communities/ui/CommunitySwitcher.tsx`
- Test: `desktop/src/shared/api/haroEventMapper.test.mjs`

**Interfaces:**
- Consumes: typed events/filter helpers from Plan 01.
- Produces: no `any` event handlers, stringly `send(type,payload)`, or hardcoded connected state.

- [ ] **Step 1: Add coverage for every mapped event kind**

Create one table-driven mapper case for membership, presence, custom emoji, huddle lifecycle/reaction, persona, and preference events. Assert unknown kinds return `null`.

```js
for (const [kind, expectedType] of cases) {
  test(`kind ${kind} maps to ${expectedType}`, () => {
    assert.equal(mapRelayEvent(eventFor(kind)).type, expectedType);
  });
}
```

- [ ] **Step 2: Verify missing mappings fail**

Run: `pnpm --dir desktop test -- haroEventMapper`

Expected: at least one newly enumerated domain mapping fails.

- [ ] **Step 3: Convert consumers and expose real connection state**

Use typed facade methods and `useSyncExternalStore` over `subscribeToConnectionState`. Remove optional chaining around required socket methods and delete `const connectionState = "connected"`.

```ts
const connectionState = React.useSyncExternalStore(
  realtimeSocketClient.subscribeToConnectionState,
  realtimeSocketClient.getConnectionState,
);
```

- [ ] **Step 4: Run full Desktop functionality gate**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop test && pnpm --dir desktop check && pnpm --dir desktop exec playwright test --project=smoke`

Expected: all pass; `rg -n "send\(['\"](typing_indicator|presence|reaction_add)|: any\) =>|connectionState: ConnectionState = \"connected\"" desktop/src` returns no matches.

- [ ] **Step 5: Commit remaining domain migration**

```bash
. ./bin/activate-hermit
git add desktop/src/features/channels/useMembershipNotifications.ts desktop/src/features/presence/hooks.ts desktop/src/features/custom-emoji/hooks.ts desktop/src/features/huddle/lib/useTtsSubscription.ts desktop/src/features/huddle/components/HuddleBar.tsx desktop/src/features/huddle/components/HuddleIndicator.tsx desktop/src/features/huddle/components/HuddleAttachment.tsx desktop/src/features/agents/lib/usePersonaSync.ts desktop/src/features/communities/ui/CommunitySwitcher.tsx desktop/src/shared/api/haroEventMapper.test.mjs
git commit -m "fix(desktop): complete typed realtime domain migration"
```

### Task 7: Phase Gate

**Files:**
- Modify: `docs/superpowers/plans/2026-07-30-haro-02-domain-and-media-migration.md`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: a fully functional Desktop data plane for account work.

- [ ] **Step 1: Prove fake endpoints and no-ops are gone**

Run: `rg -n "localhost:3000/api/(chat|reminders)|api/upload/presigned-url|Silenced legacy|return \[\];|return null;.*legacy" desktop/src`

Expected: no matches in production domain adapters.

- [ ] **Step 2: Run phase verification**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop test && pnpm --dir desktop check && cargo test --manifest-path desktop/src-tauri/Cargo.toml && pnpm --dir desktop exec playwright test --project=smoke`

Expected: every command exits 0.

- [ ] **Step 3: Commit verification evidence**

```bash
. ./bin/activate-hermit
git add docs/superpowers/plans/2026-07-30-haro-02-domain-and-media-migration.md
git commit -m "docs: record Haro domain phase verification"
```
