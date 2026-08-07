# Haro Desktop Domain Phase 1 Design

## Scope

This phase completes Desktop transport and domain migration only. It covers profile kind-0 persistence, typed semantic socket consumers, relay lifecycle correctness, and the Desktop domain gate for chat, read state, preferences, reminders, project/feedback events, and Blossom media. Mobile, account authority, Kurir recovery, CLI account commands, and global naming cutover are explicitly outside this phase.

## Architecture

`RelayClient` remains the sole WebSocket owner. Feature code uses the typed `SimpleSocket`/`realtimeSocketClient` facade and domain builders; no feature constructs the legacy `{type, payload}` wire shape or opens a second WebSocket. Every publish waits for relay `OK` and propagates rejection to the existing UI error path.

Profile updates use a read-merge-write kind `0` boundary. Existing profile JSON is fetched, only defined input fields are mapped to NIP-01 keys (`display_name`, `picture`, `about`, `nip05`), and the merged event is signed and published. Emoji avatars remain SVG data URLs in `picture` and must survive reload.

Binary media remains behind native Blossom commands with MIME and SHA-256 validation. Reminder events remain encrypted and use replacement-event latest-write-wins selection. Remaining HTTP calls must be explicitly allowlisted as metadata, health, webhook, git, or media surfaces; domain primary paths cannot depend on fake REST endpoints or no-op mocks.

## Execution Order

1. Add profile mapping/merge regression tests, implement the profile boundary, and verify reload persistence.
2. Add a forbidden legacy-transport test, then migrate semantic consumers family by family: messages, typing, presence, huddle, persona, emoji, membership, reactions, preferences, and sidebar state.
3. Add lifecycle tests for duplicate disconnect, pending request cancellation, reconnect timer cancellation, and late Tauri callbacks. Make teardown idempotent and remove callback registrations before reload.
4. Inventory remaining domain HTTP/no-op paths, replace project and feedback mutations with signed typed events, verify Blossom and reminders, then run the full Desktop domain gate.

## Error Handling and Security

- A relay rejection is an error; local event construction is not success.
- Malformed or out-of-scope events are dropped before reaching feature state.
- Disconnect rejects pending operations and prevents post-disconnect publishes.
- Passwords, account credentials, and private keys are not part of this phase and must not be introduced here.
- No production `unwrap()` or `expect()` is added.

## Verification

Each step follows test-first execution: add a focused failing test, reproduce the current failure, implement the smallest fix, then run the focused test and `pnpm --dir desktop typecheck`. The phase gate additionally runs the Desktop unit suite, Tauri relay tests, domain E2E suites, and forbidden-pattern scans. Evidence must record exact commands, pass counts, and any environmental blockers.

## Definition of Done

- No semantic feature consumer calls the legacy socket API or constructs `{ type, payload }`.
- Profile emoji persistence produces an accepted kind `0` event with `picture` and preserves unrelated profile fields after reload.
- Disconnect is idempotent, cancels reconnect work, rejects pending requests, and produces no orphan Tauri callback warning.
- Project, feedback, chat, read state, preferences, reminders, and media primary paths use typed events or native Blossom; no fake REST/no-op path remains.
- Focused tests, Desktop typecheck, Desktop unit tests, Tauri tests, and domain E2E gates pass, with evidence recorded.

## Out of Scope

Account Authority, username/password login, HPKE recovery envelopes, Kurir delivery, Desktop account UI, CLI account behavior, mobile changes, and Haro/Buzz package or branding cutover.
