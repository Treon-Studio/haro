# Haro Desktop Domain Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Desktop profile persistence, typed semantic transport, relay lifecycle teardown, and the domain migration gate without changing Mobile or account systems.

**Architecture:** `RelayClient` remains the only WebSocket owner. Feature consumers use `SimpleSocket`/`realtimeSocketClient`, signed event builders, and native Blossom commands; relay `OK false` is always surfaced as an error. Profile kind `0` updates use read-merge-write with NIP-01 keys.

**Tech Stack:** React 19, TypeScript, Vite, Tauri 2, Rust, Nostr NIP-01/NIP-29/NIP-42/NIP-78, Blossom, Node test runner, Playwright, pnpm.

## Global Constraints

- Do not modify `mobile/`.
- Do not add a second WebSocket owner or `{type, payload}` transport.
- Do not treat local event creation as publish success; await relay acknowledgement.
- Preserve `picture`, `display_name`, `about`, and `nip05` semantics for kind `0`.
- Keep media behind native Blossom commands and preserve MIME/SHA-256 checks.
- Do not add production `unwrap()` or `expect()`.
- Every task ends with focused tests, typecheck/build gates, evidence, and one scoped commit.

---

### Task 1: Profile Kind-0 Read-Merge-Write

**Files:**
- Modify: `desktop/src/shared/api/chatStore.ts:159-216`
- Modify: `desktop/src/features/profile/hooks.ts:500-545`
- Modify: `desktop/src/shared/api/tauriProfiles.ts`
- Modify: `desktop/src-tauri/src/commands/profile.rs`
- Test: `desktop/src/shared/api/chatStore.test.mjs`
- Test: `desktop/src/features/profile/ui/ProfileAvatarEditor.utils.test.mjs`

**Interfaces:**
- `updateUserProfile(input: UpdateProfileInput, relay: ProfileRelay): Promise<RelayEvent>` reads the latest kind `0`, maps defined input fields to NIP-01 keys, publishes, and returns the accepted event.
- `useUpdateProfileMutation()` calls the boundary and invalidates the profile query only after acknowledgement.

- [ ] **Step 1: Add the failing mapping test.** Extend `chatStore.test.mjs` with a fake relay that returns an existing kind `0` event containing `display_name`, `about`, `picture`, and `nip05`; call `updateUserProfile({ displayName: "😀", avatarUrl: "data:image/svg+xml,<svg/>" }, relay)` and assert the signed event contains `display_name` and `picture`, preserves `about`/`nip05`, and has kind `0`.
- [ ] **Step 2: Run the focused test to reproduce the mismatch.**
  Run: `pnpm --dir desktop exec node --import ./test-loader.mjs --experimental-strip-types --test src/shared/api/chatStore.test.mjs src/features/profile/ui/ProfileAvatarEditor.utils.test.mjs`
  Expected: the new assertion fails on the current partial-field mapping or lost fields.
- [ ] **Step 3: Implement the read-merge-write boundary.** Fetch the latest own kind `0` event with `fetchEvents({ kinds: [0], authors: [pubkey], limit: 1 })`; parse object content; merge only defined inputs using `display_name`, `picture`, `about`, and `nip05`; sign kind `0`; await `relay.publishEvent`; throw when the result is rejected; return the accepted event. Keep `emojiAvatarDataUrl()` unchanged as the SVG encoder.
- [ ] **Step 4: Update the mutation/native bridge.** Ensure `useUpdateProfileMutation` consumes the canonical result and does not report success from a `null` native result. Ensure the Tauri profile command returns the stored canonical profile after the event is acknowledged.
- [ ] **Step 5: Run the passing profile gate.**
  Run: `pnpm --dir desktop exec node --import ./test-loader.mjs --experimental-strip-types --test src/shared/api/chatStore.test.mjs src/features/profile/ui/ProfileAvatarEditor.utils.test.mjs && pnpm --dir desktop typecheck`
  Expected: focused tests pass and typecheck exits `0`.
- [ ] **Step 6: Commit the profile boundary.**
  ```bash
  git add desktop/src/shared/api/chatStore.ts desktop/src/features/profile/hooks.ts desktop/src/shared/api/tauriProfiles.ts desktop/src-tauri/src/commands/profile.rs desktop/src/shared/api/chatStore.test.mjs desktop/src/features/profile/ui/ProfileAvatarEditor.utils.test.mjs
  git commit -m "fix(desktop): persist emoji avatars as merged kind-0 profiles"
  ```

**Definition of Done:** An emoji save produces an accepted kind `0` with `picture`, preserves unrelated fields after reload, rejects `OK false`, and passes focused tests plus typecheck. The task is not done if content contains `avatarUrl`/`displayName` or profile survives only in React cache.

### Task 2: Convert Semantic Socket Consumers

**Files:**
- Modify: `desktop/src/features/agents/lib/usePersonaSync.ts`
- Modify: `desktop/src/features/channels/useLiveChannelUpdates.ts`
- Modify: `desktop/src/features/channels/useMembershipNotifications.ts`
- Modify: `desktop/src/features/custom-emoji/hooks.ts`
- Modify: `desktop/src/features/huddle/components/HuddleBar.tsx`
- Modify: `desktop/src/features/messages/ui/MessageThreadPanel.tsx`
- Modify: `desktop/src/features/messages/ui/MessageTimeline.tsx`
- Modify: `desktop/src/features/messages/useChannelTyping.ts`
- Modify: `desktop/src/features/messages/useTypingBroadcast.ts`
- Modify: `desktop/src/features/presence/hooks.ts`
- Modify: `desktop/src/features/sidebar/lib/useChannelMutes.ts`
- Modify: `desktop/src/features/sidebar/lib/useChannelSections.ts`
- Modify: `desktop/src/features/sidebar/lib/useChannelSortPreference.ts`
- Modify: `desktop/src/features/sidebar/lib/useChannelStars.ts`
- Test: `desktop/src/shared/api/realtimeSocketClient.test.mjs`
- Test: `desktop/src/shared/api/haroEventMapper.test.mjs`

**Interfaces:**
- Consumers call `SimpleSocket.on<K>()`, `subscribeToChannelLive()`, `sendMessage()`, and `publishEvent(event)`.
- `mapRelayEvent()` returns typed payloads for message, typing, presence, huddle, persona, preference, emoji, membership, reaction, and profile events, or `null` for malformed/out-of-scope events.

- [ ] **Step 1: Add the forbidden consumer scan test.** Create a Node test that recursively reads `desktop/src` excluding facade implementation/tests and asserts no match for `realtimeSocketClient.(send|on|publishEvent)` and no `{ type, payload }` object passed to transport.
- [ ] **Step 2: Run the scan and capture the current caller list.**
  Run: `rg -n 'realtimeSocketClient\.(send|on|publishEvent)|type:\s*['"'"']|payload:' desktop/src/features`
  Expected: it lists the feature files above; the test fails before conversion.
- [ ] **Step 3: Convert subscription consumers.** Replace untyped listeners with `simpleSocket.on("typing_indicator", ({ event, channelId }) => ...)` or the corresponding mapped event; compare `channelId`/`h` scope before updating state; return the unsubscribe function from each effect.
- [ ] **Step 4: Convert write consumers.** Replace legacy send/publish wrappers with typed `sendMessage(channelId, content, mentions, tags)` or `publishEvent(event)`; inspect the returned acknowledgement and throw its relay message when `accepted` is false.
- [ ] **Step 5: Make mapper coverage exhaustive.** Add mapper tests for each listed kind, malformed tags, wrong-channel events, and unknown kinds; return `null` for invalid scope rather than widening types or using `any`.
- [ ] **Step 6: Run the conversion gate.**
  Run: `pnpm --dir desktop exec node --import ./test-loader.mjs --experimental-strip-types --test src/shared/api/realtimeSocketClient.test.mjs src/shared/api/haroEventMapper.test.mjs && pnpm --dir desktop typecheck && rg -n 'realtimeSocketClient\.(send|on|publishEvent)' desktop/src/features`
  Expected: tests/typecheck pass and the final search returns no feature consumer matches.
- [ ] **Step 7: Commit the typed consumer migration.**
  ```bash
  git add desktop/src/features desktop/src/shared/api/realtimeSocketClient.test.mjs desktop/src/shared/api/haroEventMapper.test.mjs
  git commit -m "refactor(desktop): route semantic consumers through typed Haro socket"
  ```

**Definition of Done:** No feature consumer uses the legacy socket API; mapper scope checks and rejection paths are tested; all listed event families use typed payloads; focused tests and typecheck pass.

### Task 3: Relay Lifecycle and Tauri Callback Cancellation

**Files:**
- Modify: `desktop/src/shared/api/relayClientSession.ts:100-180,480-530,700-760`
- Modify: `desktop/src/shared/api/realtimeSocketClient.ts:1-180`
- Modify: `desktop/src-tauri/src/relay.rs`
- Test: `desktop/src/shared/api/relayWebSocketClose.test.mjs`
- Test: `desktop/src/shared/api/relayReconnectController.test.mjs`
- Test: `desktop/src-tauri/src/relay_tests.rs`

**Interfaces:**
- `relayClientSession.disconnect(): void` is idempotent and rejects all pending operations.
- Tauri relay callback registration returns a removable callback handle and late async completion becomes cancellation, not a callback invocation.

- [ ] **Step 1: Add lifecycle failure tests.** Cover two consecutive disconnects, pending publish rejection, reconnect timer cancellation, duplicate close events, and a late Rust callback after client teardown; assert one close, empty pending map, and no orphan callback warning.
- [ ] **Step 2: Run the lifecycle tests before implementation.**
  Run: `pnpm --dir desktop exec node --import ./test-loader.mjs --experimental-strip-types --test src/shared/api/relayWebSocketClose.test.mjs src/shared/api/relayReconnectController.test.mjs`
  Expected: at least one new test fails against current teardown behavior.
- [ ] **Step 3: Implement one teardown path.** In `relayClientSession.ts`, mark the session closed, clear reconnect timers, close the socket once, reject and clear pending requests, remove listeners/subscriptions, and unregister Tauri callbacks. In `relay.rs`, check callback registration state before invoking a completion and return a cancellation result when the registration was removed.
- [ ] **Step 4: Preserve NIP-42 ordering.** Ensure authentication completes before emitting `connect` and reconnect reuses the same owner; add a test that publish is rejected while disconnected and no second socket is allocated.
- [ ] **Step 5: Run JavaScript, Rust, and static lifecycle gates.**
  Run: `pnpm --dir desktop exec node --import ./test-loader.mjs --experimental-strip-types --test src/shared/api/relayWebSocketClose.test.mjs src/shared/api/relayReconnectController.test.mjs && pnpm --dir desktop typecheck && cargo test --manifest-path desktop/src-tauri/Cargo.toml relay`
  Expected: all tests pass; `rg -n 'new WebSocket|accepted:\s*true' desktop/src/shared/api/realtimeSocketClient.ts desktop/src-tauri/src/relay.rs` reports no forbidden implementation.
- [ ] **Step 6: Commit the lifecycle gate.**
  ```bash
  git add desktop/src/shared/api/relayClientSession.ts desktop/src/shared/api/realtimeSocketClient.ts desktop/src-tauri/src/relay.rs desktop/src/shared/api/relayWebSocketClose.test.mjs desktop/src/shared/api/relayReconnectController.test.mjs desktop/src-tauri/src/relay_tests.rs
  git commit -m "fix(desktop): make relay teardown cancel pending callbacks"
  ```

**Definition of Done:** Disconnect is safe twice, cancels reconnects, rejects pending operations, completes NIP-42 before connect, and produces no orphan callback warning in JS/Rust tests.

### Task 4: Domain HTTP Removal, Blossom, Reminders, and Phase Gate

**Files:**
- Modify: `desktop/src/features/projects/issueMutations.ts`
- Modify: `desktop/src/features/projects/pullRequestMutations.ts`
- Modify: `desktop/src/features/projects/pullRequestReviews.ts`
- Modify: `desktop/src/features/projects/useCreateProject.ts`
- Modify: `desktop/src/features/settings/hooks/useSendFeedback.ts`
- Modify: `desktop/src/shared/api/chatStore.ts`
- Modify: `desktop/src/features/messages/lib/useMediaUpload.ts`
- Modify: `desktop/src/shared/api/s3MediaUploader.ts`
- Modify: `desktop/src/features/reminders/lib/reminderService.ts`
- Modify: `desktop/src/features/home/useInboxThreadContext.ts`
- Modify: `desktop/src/features/messages/lib/auxBackfill.ts`
- Modify: `desktop/src/features/messages/lib/renderScopedReactions.ts`
- Test: `desktop/src/features/projects/issueMutations.test.mjs`
- Test: `desktop/src/features/projects/pullRequestMutations.test.mjs`
- Test: `desktop/src/features/settings/hooks/useSendFeedback.helpers.test.mjs`
- Test: `desktop/src/shared/api/chatStore.test.mjs`
- Test: `desktop/src/shared/api/s3MediaUploader.test.mjs`
- Test: `desktop/src/features/reminders/lib/reminderService.test.mjs`

**Interfaces:**
- Project and feedback mutations sign domain events and call `realtimeSocketClient.publishEvent(event)`; rejected acknowledgements throw.
- Media uses native Blossom IPC with validated bytes/MIME/hash.
- Reminder service publishes encrypted replacement events and selects the newest valid own event.

- [ ] **Step 1: Inventory every remaining domain HTTP call.** Run `rg -n 'localhost:3000/api|fetch\(' desktop/src/features desktop/src/shared/api` and classify each match as allowlisted or domain-primary in a checked-in evidence note.
- [ ] **Step 2: Add failing event tests for project and feedback operations.** Assert event kind, `h`/`e` tags, signed payload, `publishEvent` invocation, and thrown error for `accepted: false` in each mutation test file.
- [ ] **Step 3: Replace project and feedback HTTP calls.** Use existing event builders/constants in `issueMutations.ts`, `pullRequestMutations.ts`, `pullRequestReviews.ts`, `useCreateProject.ts`, and `useSendFeedback.ts`; remove `fetch` only after its rejection test passes.
- [ ] **Step 4: Replace remaining domain reads.** Route inbox thread and auxiliary event backfills through the typed relay query adapter; retain HTTP only for explicitly allowlisted metadata/media/health/webhook/git surfaces.
- [ ] **Step 5: Verify Blossom and reminders.** Add MIME mismatch, SHA mismatch, native-command failure, malformed encrypted event, stale replacement, and rejected publish tests; keep secrets out of browser-visible return values.
- [ ] **Step 6: Run the complete phase gate.**
  Run: `pnpm --dir desktop exec node --import ./test-loader.mjs --experimental-strip-types --test src/shared/api/chatStore.test.mjs src/shared/api/s3MediaUploader.test.mjs src/features/reminders/lib/reminderService.test.mjs src/features/projects/issueMutations.test.mjs src/features/projects/pullRequestMutations.test.mjs src/features/settings/hooks/useSendFeedback.helpers.test.mjs && pnpm --dir desktop typecheck && pnpm --dir desktop test && cargo test --manifest-path desktop/src-tauri/Cargo.toml`
  Expected: focused tests, full Desktop suite, typecheck, and Tauri tests pass.
- [ ] **Step 7: Run the forbidden-path and E2E gates.** Run `rg -n 'localhost:3000/api/(chat|projects|feedback|reminders)|realtimeSocketClient\.(send|on)' desktop/src` and the repository's three domain E2E suites for chat/profile/preferences/reminders/media; only allowlisted HTTP matches may remain.
- [ ] **Step 8: Commit the phase gate evidence.**
  ```bash
  git add desktop/src/features/projects/issueMutations.ts desktop/src/features/projects/pullRequestMutations.ts desktop/src/features/projects/pullRequestReviews.ts desktop/src/features/projects/useCreateProject.ts desktop/src/features/settings/hooks/useSendFeedback.ts desktop/src/shared/api/chatStore.ts desktop/src/features/messages/lib/useMediaUpload.ts desktop/src/shared/api/s3MediaUploader.ts desktop/src/features/reminders/lib/reminderService.ts desktop/src/features/home/useInboxThreadContext.ts desktop/src/features/messages/lib/auxBackfill.ts desktop/src/features/messages/lib/renderScopedReactions.ts desktop/src/features/projects/issueMutations.test.mjs desktop/src/features/projects/pullRequestMutations.test.mjs desktop/src/features/settings/hooks/useSendFeedback.helpers.test.mjs desktop/src/shared/api/chatStore.test.mjs desktop/src/shared/api/s3MediaUploader.test.mjs desktop/src/features/reminders/lib/reminderService.test.mjs
  git commit -m "refactor(desktop): complete Haro domain transport gate"
  ```

**Definition of Done:** No fake REST/no-op remains on a domain primary path; profile, chat, read state, preferences, reminders, projects, feedback, and media use typed events or native Blossom; all focused/full tests, typecheck, Tauri tests, and domain E2E gates pass with recorded evidence.

## Final Phase Evidence

Record exact commit range, commands, pass counts, infrastructure versions, warnings, and skipped gates in `docs/superpowers/evidence/2026-07-30-haro-desktop-domain-phase1.md`. The phase is not complete if cargo or E2E infrastructure was unavailable, if a static scan was skipped, or if any High/Critical review finding remains open.
