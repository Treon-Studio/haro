# Haro Desktop Account and Legacy Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Haro Desktop real username/password registration, login, recovery, device sessions, and one-time legacy identity migration without exposing reusable secrets to React.

**Architecture:** React owns only form input and non-secret account view state. Tauri owns account HTTP, refresh/access tokens, HPKE opening, Ed25519 device keys, Nostr secret cache, proof signing, and OS-keyring migration; the existing relay client requests one-time proof through narrow IPC commands.

**Tech Stack:** React 19, TypeScript 6, Tauri 2/Rust, OS keyring, `haro-device-proof`, HPKE, reqwest, Playwright mock bridge and live E2E.

## Global Constraints

- Plans 01-03 must be green and account routes remain feature-gated.
- Do not modify `mobile/`.
- React may hold the entered password only until the native command settles; clear it in `finally`.
- React never receives access/refresh tokens, device private keys, Nostr private keys, or plaintext HPKE identity material.
- Keep the existing bundle identifier during this rollout.
- Read legacy `buzz-desktop` keyring/storage but write only `haro-desktop`; never delete legacy material before verified Haro writes.
- Migration must preserve the exact derived Nostr public key or fail without binding.
- Desktop migration warns that current mobile clients lose access after account binding and requires explicit confirmation.

---

### Task 1: Add Native Account Types, Storage, and HTTP Client

**Files:**
- Create: `crates/haro-account-protocol/Cargo.toml`
- Create: `crates/haro-account-protocol/src/lib.rs`
- Create: `crates/haro-account-client/Cargo.toml`
- Create: `crates/haro-account-client/src/lib.rs`
- Create: `crates/haro-account-client/src/error.rs`
- Create: `crates/haro-account-client/src/http.rs`
- Create: `crates/haro-account-client/tests/contract.rs`
- Create: `desktop/src-tauri/src/account/mod.rs`
- Create: `desktop/src-tauri/src/account/types.rs`
- Create: `desktop/src-tauri/src/account/storage.rs`
- Create: `desktop/src-tauri/src/account/client.rs`
- Create: `desktop/src-tauri/src/account/tests.rs`
- Modify: `desktop/src-tauri/src/app_state.rs`
- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src-tauri/Cargo.toml`
- Modify: `desktop/src-tauri/Cargo.lock`
- Modify: `crates/buzz-relay/src/api/account/contracts.rs`
- Modify: `Cargo.toml`
- Modify: `Cargo.lock`

**Interfaces:**
- Consumes: account API contracts from Plan 03 and OS keyring service names.
- Produces: dependency-light shared account protocol/client crates plus `AccountSecretStore`, `AccountView`, and native commands for register/login/refresh/logout/recovery/session inventory.

- [ ] **Step 1: Add redaction and storage tests**

```rust
#[test]
fn account_debug_output_never_contains_secrets() {
    let session = StoredSession::test_value("refresh-canary", "device-key-canary");
    let rendered = format!("{session:?}");
    assert!(!rendered.contains("refresh-canary"));
    assert!(!rendered.contains("device-key-canary"));
}

#[tokio::test]
async fn logout_deletes_haro_session_after_server_revoke() -> Result<(), String> {
    let fixture = AccountFixture::new();
    fixture.client.logout().await?;
    assert_eq!(fixture.server.calls(), vec!["logout"]);
    assert!(fixture.store.load_session()?.is_none());
    Ok(())
}
```

- [ ] **Step 2: Verify account module is absent**

Run: `cargo test -p haro-account-protocol -p haro-account-client && cargo test --manifest-path desktop/src-tauri/Cargo.toml account::`

Expected: FAIL because the shared packages and Tauri `account` module do not exist.

- [ ] **Step 3: Implement narrow native commands**

```rust
#[derive(Serialize)]
pub struct AccountView {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub nostr_pubkey: String,
}

#[tauri::command]
pub async fn account_login(
    state: State<'_, AppState>,
    username: String,
    password: Zeroizing<String>,
) -> Result<AccountView, String> {
    state.account.login(username, password).await.map_err(public_account_error)
}
```

`haro-account-protocol` depends only on serde, uuid, and chrono and owns every strict request/response type. `haro-account-client` owns HTTPS/no-redirect/body-limit/request-id behavior and accepts token/device callbacks instead of accessing keyring. Relay and Tauri import the same protocol types. Access tokens live in an async in-memory lock; refresh/device/Nostr secrets live under `haro-desktop/account/v1/<account-id>` keyring entries.

- [ ] **Step 4: Run native account tests**

Run: `cargo test -p haro-account-protocol -p haro-account-client && cargo test --manifest-path desktop/src-tauri/Cargo.toml account:: && cargo clippy --manifest-path desktop/src-tauri/Cargo.toml --all-targets -- -D warnings`

Expected: PASS for redaction, HTTPS policy, malformed response, login, rotation, replay logout, and keyring failure.

- [ ] **Step 5: Commit native account foundation**

```bash
. ./bin/activate-hermit
git add Cargo.toml Cargo.lock crates/haro-account-protocol crates/haro-account-client crates/buzz-relay/src/api/account/contracts.rs desktop/src-tauri/src/account desktop/src-tauri/src/app_state.rs desktop/src-tauri/src/lib.rs desktop/src-tauri/Cargo.toml desktop/src-tauri/Cargo.lock
git commit -m "feat(desktop): add native Haro account client"
```

### Task 2: Open Identity Handoffs and Sign Device Proofs in Tauri

**Files:**
- Create: `desktop/src-tauri/src/account/handoff.rs`
- Create: `desktop/src-tauri/src/account/device.rs`
- Modify: `desktop/src-tauri/src/account/mod.rs`
- Modify: `desktop/src-tauri/src/relay.rs`
- Modify: `desktop/src-tauri/src/commands/media.rs`
- Modify: `desktop/src-tauri/src/commands/media_download.rs`
- Modify: `desktop/src-tauri/src/huddle/relay_api.rs`
- Modify: `desktop/src-tauri/src/commands/project_git.rs`
- Test: `desktop/src-tauri/src/account/tests.rs`

**Interfaces:**
- Consumes: Plan 03 HPKE bundle and `haro-device-proof` crate.
- Produces: `account_nip42_proof(challenge,relay,pubkey)`, `account_http_proof(request)`, verified identity cache, and proof headers/tags.

- [ ] **Step 1: Add cross-crate vector and tamper tests**

```rust
#[test]
fn tauri_proof_matches_shared_vector() -> Result<(), String> {
    let vector = include_str!("../../../../testdata/haro-device-proof-v1.json");
    let proof = DeviceSigner::from_vector(vector)?.sign_vector_request()?;
    assert_eq!(proof.signature, expected_signature(vector)?);
    Ok(())
}

#[test]
fn handoff_rejects_wrong_derived_pubkey() {
    assert!(open_identity_bundle(bundle_for_pubkey([1; 32]), expected_pubkey([2; 32])).is_err());
}
```

- [ ] **Step 2: Verify proof/handoff tests fail**

Run: `cargo test --manifest-path desktop/src-tauri/Cargo.toml account::tests::tauri_proof account::tests::handoff`

Expected: FAIL with missing signer/handoff functions.

- [ ] **Step 3: Implement native-only proof and identity handling**

Generate a device Ed25519 key and ephemeral X25519 handoff key natively. Open HPKE, derive the Nostr pubkey, compare constant-time to account response, then write the Nostr secret before declaring login complete. Add the exact NIP-42 tag returned to the existing `create_auth_event` path.

```rust
pub struct DeviceProofTag {
    pub version: &'static str,
    pub session_id: Uuid,
    pub unix_ms: i64,
    pub nonce: [u8; 32],
    pub signature: [u8; 64],
}
```

Native NIP-98/Blossom/huddle/git requests attach proof headers from the same signer. Proof headers are stripped on redirects by refusing redirects entirely.

- [ ] **Step 4: Run Tauri proof and existing transport tests**

Run: `cargo test --manifest-path desktop/src-tauri/Cargo.toml account:: relay:: commands::media huddle::`

Expected: PASS for shared vector, wrong challenge/authority/body, expired session refresh, handoff tamper, and existing NIP-42/Blossom cases.

- [ ] **Step 5: Commit proof integration**

```bash
. ./bin/activate-hermit
git add desktop/src-tauri/src/account desktop/src-tauri/src/relay.rs desktop/src-tauri/src/commands/media.rs desktop/src-tauri/src/commands/media_download.rs desktop/src-tauri/src/huddle/relay_api.rs desktop/src-tauri/src/commands/project_git.rs
git commit -m "feat(desktop): bind relay access to Haro device sessions"
```

### Task 3: Add Typed React Account Boundary

**Files:**
- Create: `desktop/src/shared/api/tauriAccount.ts`
- Create: `desktop/src/features/auth/accountTypes.ts`
- Create: `desktop/src/features/auth/accountStore.ts`
- Create: `desktop/src/features/auth/accountStore.test.mjs`
- Modify: `desktop/src/main.tsx`
- Modify: `desktop/tests/helpers/bridge.ts`

**Interfaces:**
- Consumes: native commands from Tasks 1-2.
- Produces: `useAccount()`, non-secret `AccountState`, and typed actions used by auth UI.

- [ ] **Step 1: Add password clearing and no-fallback tests**

```js
test("invalid login remains unauthenticated and clears password", async () => {
  const store = createAccountStore(rejectingAccountPort("invalid_credentials"));
  const form = { username: "ridho", password: "secret value here" };
  await assert.rejects(store.login(form));
  assert.equal(form.password, "");
  assert.equal(store.getSnapshot().status, "unauthenticated");
});
```

- [ ] **Step 2: Verify the existing demo fallback violates the test**

Run: `pnpm --dir desktop test -- accountStore`

Expected: FAIL because the account store does not exist and current login behavior can accept failures.

- [ ] **Step 3: Implement a non-secret external store**

```ts
export type AccountState =
  | { status: "loading" }
  | { status: "unauthenticated"; error?: AccountErrorCode }
  | { status: "verification-required"; emailHint: string }
  | { status: "authenticated"; account: AccountView };

export async function login(input: MutableLoginInput): Promise<void> {
  try {
    setState({ status: "authenticated", account: await accountLogin(input.username, input.password) });
  } finally {
    input.password = "";
  }
}
```

Never store passwords in React Query/localStorage. Remove `buzz_auth_token` reads/writes. The mock bridge returns only `AccountView` and explicit errors.

- [ ] **Step 4: Run store and type tests**

Run: `pnpm --dir desktop test -- accountStore && pnpm --dir desktop typecheck`

Expected: PASS; `rg -n "buzz_auth_token|haro_auth_token|refresh_token|private_key" desktop/src --glob '*.ts' --glob '*.tsx'` has no secret persistence path.

- [ ] **Step 5: Commit React boundary**

```bash
. ./bin/activate-hermit
git add desktop/src/shared/api/tauriAccount.ts desktop/src/features/auth/accountTypes.ts desktop/src/features/auth/accountStore.ts desktop/src/features/auth/accountStore.test.mjs desktop/src/main.tsx desktop/tests/helpers/bridge.ts
git commit -m "feat(desktop): expose non-secret Haro account state"
```

### Task 4: Build Registration, Login, Verification, and Recovery UI

**Files:**
- Modify: `desktop/src/features/auth/ui/LoginForm.tsx`
- Modify: `desktop/src/features/auth/ui/RegisterTenantForm.tsx`
- Create: `desktop/src/features/auth/ui/VerifyEmailForm.tsx`
- Create: `desktop/src/features/auth/ui/ForgotPasswordForm.tsx`
- Create: `desktop/src/features/auth/ui/ResetPasswordForm.tsx`
- Modify: `desktop/src/features/auth/ui/TenantSelectionStep.tsx`
- Modify: `desktop/src/app/App.tsx`
- Test: `desktop/tests/e2e/account-auth.spec.ts`
- Modify: `desktop/playwright.config.ts`

**Interfaces:**
- Consumes: Task 3 account store.
- Produces: complete account onboarding and recovery state machine; community selection follows authenticated `/me/communities`.

- [ ] **Step 1: Add Playwright auth-state tests**

```ts
test("invalid credentials never create an offline session", async ({ page }) => {
  await installMockBridge(page, { accountLogin: { error: "invalid_credentials" } });
  await page.goto("/");
  await page.getByLabel("Username").fill("ridho");
  await page.getByLabel("Password").fill("wrong password value");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Username or password is incorrect.")).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveValue("");
});
```

- [ ] **Step 2: Verify current login fallback fails E2E**

Run: `pnpm --dir desktop exec playwright test tests/e2e/account-auth.spec.ts`

Expected: FAIL because failed network/auth currently creates a demo/offline session.

- [ ] **Step 3: Implement explicit auth routes and states**

Use username/password fields, link-style commands for register/forgot, generic accepted copy for recovery, token input/deep-link consumption, and real loading/disabled/error states. Do not add explanatory feature text. After authentication load community descriptors; selecting one applies relay configuration then starts `SimpleSocket`.

```tsx
<Button type="submit" disabled={status === "submitting"}>
  {status === "submitting" ? <LoaderCircle className="animate-spin" /> : <LogIn />}
  Sign in
</Button>
```

- [ ] **Step 4: Run UI gates**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop check && pnpm --dir desktop exec playwright test tests/e2e/account-auth.spec.ts tests/e2e/onboarding.spec.ts`

Expected: PASS for register, verification, resend cooldown, login, invalid credentials, forgot/reset, second-device handoff, and community selection.

- [ ] **Step 5: Commit account UI**

```bash
. ./bin/activate-hermit
git add desktop/src/features/auth/ui desktop/src/app/App.tsx desktop/tests/e2e/account-auth.spec.ts desktop/playwright.config.ts
git commit -m "feat(desktop): add Haro account and recovery UI"
```

### Task 5: Implement Crash-Safe Legacy Identity Migration

**Files:**
- Create: `desktop/src-tauri/src/account/migration.rs`
- Modify: `desktop/src-tauri/src/app_state_keyring.rs`
- Modify: `desktop/src-tauri/src/secret_store.rs`
- Create: `desktop/src/features/auth/ui/LegacyAccountMigration.tsx`
- Create: `desktop/src/features/auth/legacyMigrationState.ts`
- Test: `desktop/src-tauri/src/account/tests.rs`
- Test: `desktop/tests/e2e/account-legacy-migration.spec.ts`

**Interfaces:**
- Consumes: existing Buzz identity lookup order, Plan 03 migration start/prove/complete, HPKE ingest/handoff.
- Produces: idempotent one-time binding with the exact original pubkey and explicit mobile-impact confirmation.

- [ ] **Step 1: Add crash-point and public-key preservation tests**

```rust
#[tokio::test]
async fn crash_after_haro_write_resumes_without_new_identity() -> Result<(), String> {
    let fixture = MigrationFixture::with_legacy_identity();
    fixture.fail_after(MigrationStep::HaroSecretVerified);
    assert!(fixture.migrate().await.is_err());
    let resumed = fixture.resume().await?;
    assert_eq!(resumed.pubkey, fixture.legacy_pubkey());
    assert_eq!(fixture.generated_identity_count(), 0);
    Ok(())
}
```

- [ ] **Step 2: Verify migration state machine is absent**

Run: `cargo test --manifest-path desktop/src-tauri/Cargo.toml account::tests::migration`

Expected: FAIL with missing migration types.

- [ ] **Step 3: Implement journaled migration**

Persist only non-secret journal states: `discovered`, `account_pending`, `legacy_proven`, `email_verified`, `haro_secret_verified`, `bound`. Start/prove operations use idempotency UUIDs. Never delete `buzz-desktop` entries automatically; mark the Haro migration complete after server binding, Haro keyring readback, and derived pubkey verification.

```rust
pub enum LegacyMigrationStep {
    Discovered,
    AccountPending,
    LegacyProven,
    EmailVerified,
    HaroSecretVerified,
    Bound,
}
```

The React confirmation checkbox text states that existing mobile builds will stop accessing this identity after migration. The complete command is disabled until checked.

- [ ] **Step 4: Run migration tests**

Run: `cargo test --manifest-path desktop/src-tauri/Cargo.toml account::tests::migration && pnpm --dir desktop exec playwright test tests/e2e/account-legacy-migration.spec.ts tests/e2e/nostr-bind.spec.ts`

Expected: PASS for every crash point, wrong key, username/email conflict, expired challenge, concurrent completion, retry, unchanged pubkey, and explicit confirmation.

- [ ] **Step 5: Commit legacy migration**

```bash
. ./bin/activate-hermit
git add desktop/src-tauri/src/account/migration.rs desktop/src-tauri/src/account/tests.rs desktop/src-tauri/src/app_state_keyring.rs desktop/src-tauri/src/secret_store.rs desktop/src/features/auth/ui/LegacyAccountMigration.tsx desktop/src/features/auth/legacyMigrationState.ts desktop/tests/e2e/account-legacy-migration.spec.ts
git commit -m "feat(desktop): migrate legacy identities to Haro accounts"
```

### Task 6: Add Session Management and Revocation UX

**Files:**
- Create: `desktop/src/features/settings/ui/AccountSessionsSettings.tsx`
- Modify: `desktop/src/features/settings/ui/SettingsView.tsx`
- Modify: `desktop/src/features/auth/accountStore.ts`
- Test: `desktop/tests/e2e/account-sessions.spec.ts`

**Interfaces:**
- Consumes: session list/revoke/logout/logout-all/change-password native actions.
- Produces: device inventory and immediate local transition to unauthenticated after current-session revocation.

- [ ] **Step 1: Add current-session revocation E2E**

```ts
test("logout all closes relay and returns to login", async ({ page }) => {
  await openAuthenticatedApp(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect.poll(() => relayCloseCount(page)).toBe(1);
});
```

- [ ] **Step 2: Verify settings are absent**

Run: `pnpm --dir desktop exec playwright test tests/e2e/account-sessions.spec.ts`

Expected: FAIL because Account settings do not exist.

- [ ] **Step 3: Implement compact session controls**

Render device name, platform, created/last-use time, and current badge. Use icon buttons with tooltips for single-session revoke and a confirmation dialog for logout-all/change password. On current-session loss call `realtimeSocketClient.disconnect()`, clear community/query state, invoke native secret cleanup, then transition account store.

- [ ] **Step 4: Run session and signout tests**

Run: `pnpm --dir desktop exec playwright test tests/e2e/account-sessions.spec.ts tests/e2e/signout-confirmation.spec.ts && pnpm --dir desktop typecheck`

Expected: PASS for revoke-other, revoke-current, logout, logout-all, password change, server-forced expiry, and socket close.

- [ ] **Step 5: Commit session UX**

```bash
. ./bin/activate-hermit
git add desktop/src/features/settings/ui/AccountSessionsSettings.tsx desktop/src/features/settings/ui/SettingsView.tsx desktop/src/features/auth/accountStore.ts desktop/tests/e2e/account-sessions.spec.ts
git commit -m "feat(desktop): manage Haro account sessions"
```

### Task 7: Phase Gate

**Files:**
- Modify: `docs/superpowers/plans/2026-07-30-haro-04-desktop-account-and-migration.md`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: Desktop client ready for gated account canary.

- [ ] **Step 1: Run secret-canary scans**

Run: `rg -n "refresh_token|private_key|device_private|buzz_auth_token|haro_auth_token" desktop/src desktop/tests/test-results`

Expected: no production React persistence/logging matches; typed wire-field declarations and explicit redaction tests are the only permitted matches.

- [ ] **Step 2: Run Desktop/Tauri gate**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop test && pnpm --dir desktop check && cargo test --manifest-path desktop/src-tauri/Cargo.toml && cargo clippy --manifest-path desktop/src-tauri/Cargo.toml --all-targets -- -D warnings && pnpm --dir desktop exec playwright test --project=smoke`

Expected: every command exits 0.

- [ ] **Step 3: Commit phase evidence**

```bash
. ./bin/activate-hermit
git add docs/superpowers/plans/2026-07-30-haro-04-desktop-account-and-migration.md
git commit -m "docs: record Haro Desktop account verification"
```
