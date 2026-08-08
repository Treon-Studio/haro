# Haro Desktop Domain Phase 1 Evidence

## Status

**Incomplete.** All seven whole-branch review findings are implemented, and the
phase-owned focused tests, Desktop unit suite, typecheck, lint/guards, E2E
build, targeted browser scenarios, and focused native tests pass. The complete
phase gate is not green: the full Tauri suite has one pre-existing keyring
assertion failure, one unchanged profile proxy-scheme E2E assertion fails, and
the broad smoke run did not complete.

## Commit Range

- Whole phase code range: `b9db0d0d6427b6c780b31a70159497ae987e0332..4f80fda2`
- Final review fix range: `4d8a30ad748024c516683efbdb24c06458c2f1c0..4f80fda2`
- `bc84f58d` - restore encrypted state and typed realtime
- `75646054` - preserve complete profile metadata
- `64e4e204` - verify native media output bytes
- `8668dd5b` - preserve contextual live events
- `724e8ce0` - keep final fixes within module limits
- `2600ce86` - model relay-backed profile events in E2E
- `0d78b461` - close read-state compaction, convergence, scope, and profile LWW gaps
- `688759a9` - bound read-state coordinate fetches and convergence retries
- `5c1a1c22` - format the read-state regression fixture
- `4f80fda2` - route canonical job lifecycle events live

## Review Finding Closure

1. Read state now fetches and hydrates the user's encrypted NIP-78 blobs,
   publishes encrypted `read-state:*` replacement events with the required `t`
   tag, deletes surplus remote slots with NIP-09 address references, and does
   not advance local state after a rejected publish.
2. Realtime subscriptions now cover the canonical live kind set, map every
   supported event family, enforce channel scope, connect `.on()` to real relay
   subscriptions, deduplicate boundedly, and disconnect cleanly.
3. Huddle and TTS consumers use typed `{ event, channelId }` callbacks and real
   unsubscribe functions. The forbidden facade scan covers aliased imports.
4. Presence publishes and filters the canonical Buzz kind `20001`.
5. Both native profile update paths merge the full prior kind-0 JSON object,
   preserving unknown and extended fields while maintaining monotonic event
   timestamps.
6. Native media upload returns an explicit output MIME, SHA-256, and byte-size
   contract. Rust and renderer validation cover HEIC, MOV/video, sanitized
   image output, empty input MIME, and descriptor mismatch cases.
7. This evidence and the progress ledger remain incomplete while required full
   gates are red.

## Follow-up Review Closure

The follow-up wave in `0d78b461` closes four additional findings:

- Consolidation now publishes and acknowledges the union before deleting extra
  slots; rejected consolidation retains slots and schedules a retry.
- Incoming live blobs that advance beyond the locally published frontier
  persist, notify, and schedule a forced read-before-write convergence.
- Channel consumers reject h-less message/lifecycle events. Only referenced
  auxiliary kinds (deletion, reaction, NIP-29 deletion, and edit) may inherit
  the trusted subscription channel; global deletion mapping still requires an
  `a` coordinate.
- Renderer profile read-merge-write events use
  `max(now, current.created_at + 1)` and rapid-save coverage prevents same-second
  LWW reversion.

The follow-up wave in `688759a9` bounds pre-publish reads to known own d-tags
within the active horizon and distinguishes permanently unpublishable oversize
state from retryable relay rejection.

The final follow-up in `4f80fda2` adds all six canonical job lifecycle kinds to
the channel live subscription filter, mapper, typed routing, and focused tests.

## Static Scope Evidence

```bash
rg -n 'localhost:3000/api/(chat|projects|feedback|reminders)|realtimeSocketClient\.(send|on)' desktop/src
git diff --name-only b9db0d0d6427b6c780b31a70159497ae987e0332..4f80fda2 -- mobile
git diff --name-only b9db0d0d6427b6c780b31a70159497ae987e0332..4f80fda2 | rg 'mobile|account|recovery|sign.?in|identity'
git diff --check
```

Results: the forbidden API scan and both out-of-scope path scans returned no
matches. `git diff --check` passed. No mobile, account, recovery, sign-in, or
identity surface is in the phase diff.

## Verification

Environment: Node `v22.23.1`, pnpm `11.4.0`, rustc
`1.95.0 (59807616e 2026-04-14)`.

From `desktop/`:

```bash
node --import ./test-loader.mjs --experimental-strip-types --test \
  src/shared/api/haroEventMapper.test.mjs \
  src/shared/api/realtimeSocketClient.test.mjs \
  src/features/presence/hooks.test.mjs \
  src/features/agents/lib/usePersonaSync.test.mjs \
  src/features/channels/readState/readStateManager.test.mjs \
  src/shared/api/s3MediaUploader.test.mjs \
  src/features/messages/lib/threadPanel.test.mjs \
  src/shared/api/relayWebSocketClose.test.mjs
pnpm typecheck
pnpm check
pnpm test
pnpm build:e2e
```

Results: focused tests `130` passed and `0` failed; typecheck passed; `pnpm
check` passed all hard guards with `23` existing Biome warnings; the full
Desktop suite passed `3,644` tests in `40` suites with no failures; the E2E
build passed with existing dynamic-import/chunk warnings.

Follow-up verification from `desktop/`:

```bash
node --import ./test-loader.mjs --experimental-strip-types --test \
  src/features/channels/readState/readStateManager.test.mjs \
  src/shared/api/realtimeSocketClient.test.mjs \
  src/shared/api/haroEventMapper.test.mjs \
  src/features/channels/unreadReadMarker.test.mjs \
  src/shared/api/chatStore.test.mjs
pnpm typecheck
pnpm check
pnpm test
pnpm build:e2e
```

Current-head results: `139/139` focused tests passed; typecheck passed; `pnpm
check` passed with `23` existing Biome warnings, no fixable Biome info, and all
hard guards; the full Desktop suite passed `3,665/3,665` tests in `40` suites;
the E2E build passed with existing dynamic-import/chunk warnings. A fresh
`git diff --check` also passed.

Native focused tests:

```bash
. ./bin/activate-hermit
cargo test --manifest-path desktop/src-tauri/Cargo.toml commands::profile::tests
cargo test --manifest-path desktop/src-tauri/Cargo.toml uploaded_descriptor_must_match_exact_native_output_bytes
```

Results: profile tests `4` passed; exact native media descriptor test `1`
passed.

Historical browser evidence (pre-`0d78b461`, not current-final) from `desktop/`:

```bash
pnpm exec playwright test --project=smoke \
  tests/e2e/file-attachment.spec.ts tests/e2e/messaging.spec.ts \
  --grep "upload a file|dropping a file|forum posts|thread refetch preserves|thread reply appears after relay closes" \
  --reporter=line
pnpm exec playwright test --project=integration tests/e2e/profile.spec.ts \
  --grep-invert "proxies feedback attachment previews" --reporter=line
```

Results: `5` phase-owned smoke scenarios passed; `25` remaining profile
integration scenarios passed. These runs predate `0d78b461` and are retained
as historical evidence only. No post-`0d78b461` Playwright rerun was completed;
the current-final browser gate is therefore incomplete.

## Remaining Gate Failures

Full native gate:

```bash
. ./bin/activate-hermit
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```

Result: `1,631` passed, `1` failed, and `14` were ignored. The only failure is
`app_state::keyring_config::tests::standalone_scope_must_remain_under_dev_service`:
the tracked value is `haro-desktop-dev`, while the assertion still expects
`buzz-desktop-dev`. The phase range does not modify
`desktop/src-tauri/src/app_state_keyring.rs`, so this is not changed here, but
it keeps the required full gate red.

The isolated unchanged profile proxy assertion also remains red:

```bash
pnpm exec playwright test --project=integration tests/e2e/profile.spec.ts \
  --grep "proxies feedback attachment previews" --reporter=line
```

Result: `1` failed. It expects
`http://127.0.0.1:54321/media/...` and receives the supported fallback
`buzz-media://localhost/media/...`. The assertion and production URL selection
are unchanged from the phase baseline.

A broad `--project=smoke` run selected `703` tests and was stopped at `500/703`
after the reused preview became unresponsive and subsequent unrelated
onboarding tests repeatedly timed out. That run is recorded as aborted and
non-diagnostic, not as a pass.

## Warnings

The Desktop suite emits expected simulated-relay error output and Node
MockTimers warnings. The E2E build emits existing dynamic-import and chunk-size
warnings. Neither command failed on those warnings.
