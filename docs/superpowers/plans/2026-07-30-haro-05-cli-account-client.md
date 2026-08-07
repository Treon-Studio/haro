# Haro CLI Account Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add username/password account, recovery, session, and migration commands to the CLI while preserving managed-agent NIP-OA/environment authentication.

**Architecture:** The CLI reuses `haro-account-client` and `haro-device-proof`; OS keyring holds refresh/device/Nostr secrets and process memory holds access tokens. `BuzzClient` receives an explicit identity source so managed agents remain on NIP-OA while account-bound humans attach device proof to every relay/HTTP operation.

**Tech Stack:** Rust 1.88, clap, reqwest, keyring 3.6.3, rpassword, Nostr, shared Haro account/proof crates, integration tests.

## Global Constraints

- Plans 01-04 must be green.
- Do not modify `mobile/`.
- Passwords and email/reset tokens are read from an interactive no-echo prompt or stdin, never command-line flags or environment variables.
- Account secrets use OS keyring service `haro-cli`; no plaintext config file.
- Existing `BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY`, and `BUZZ_AUTH_TAG` managed-agent behavior remains byte-compatible until Plan 06 aliases names.
- Generic Nostr keys cannot bypass device proof for account-bound pubkeys.
- CLI output and exit-code contracts remain JSON/compact with auth errors at exit code 3.

---

### Task 1: Extend the Shared Account Client for CLI Injection

**Files:**
- Modify: `crates/haro-account-client/src/lib.rs`
- Modify: `crates/haro-account-client/src/http.rs`
- Create: `crates/haro-account-client/tests/cli_contract.rs`
- Modify: `desktop/src-tauri/src/account/client.rs`

**Interfaces:**
- Consumes: shared protocol/client crates created in Plan 04.
- Produces: transport hooks usable by Tauri and CLI without platform keyring or UI dependencies in the shared crate.

- [ ] **Step 1: Add CLI-safe injection tests**

```rust
#[tokio::test]
async fn client_refuses_cross_authority_redirect() {
    let fixture = RedirectFixture::cross_authority().await;
    assert!(matches!(fixture.client.login(login_request()).await, Err(ClientError::RedirectRefused)));
}

#[tokio::test]
async fn client_returns_tokens_only_to_injected_sink() -> Result<(), ClientError> {
    let sink = RecordingTokenSink::new();
    let view = account_fixture().client.login(login_request(), &sink).await?;
    assert_eq!(sink.refresh_write_count(), 1);
    assert_eq!(view.username, "ridho");
    assert!(!format!("{view:?}").contains("refresh"));
    Ok(())
}
```

- [ ] **Step 2: Verify CLI-safe hooks are absent**

Run: `cargo test -p haro-account-protocol -p haro-account-client`

Expected: FAIL because the shared client does not accept an injected token sink.

- [ ] **Step 3: Keep the shared client platform-neutral**

Keep `haro-account-protocol` dependent only on serde, uuid, and chrono. Extend `haro-account-client` with injected token/handoff sinks; it must not depend on Tauri, clap, keyring, or terminal crates.

```rust
#[async_trait]
pub trait AccountTokenSink: Send + Sync {
    async fn store_login(&self, response: SecretLoginResponse) -> Result<AccountView, ClientError>;
    async fn replace_refresh(&self, response: SecretRefreshResponse) -> Result<(), ClientError>;
}
```

Tauri implements the trait with its existing account secret store; Task 2 implements it with the CLI keyring.

- [ ] **Step 4: Run shared and Desktop consumer tests**

Run: `cargo test -p haro-account-protocol -p haro-account-client && cargo test --manifest-path desktop/src-tauri/Cargo.toml account::`

Expected: PASS; dependency inspection shows no Tauri, keyring, or clap dependency in either shared crate.

- [ ] **Step 5: Commit platform-neutral client hooks**

```bash
. ./bin/activate-hermit
git add crates/haro-account-client/src/lib.rs crates/haro-account-client/src/http.rs crates/haro-account-client/tests/cli_contract.rs desktop/src-tauri/src/account/client.rs
git commit -m "refactor(auth): make Haro account client platform-neutral"
```

### Task 2: Add CLI Account Secret Store and Identity Resolution

**Files:**
- Create: `crates/buzz-cli/src/account/mod.rs`
- Create: `crates/buzz-cli/src/account/store.rs`
- Create: `crates/buzz-cli/src/account/identity.rs`
- Create: `crates/buzz-cli/src/account/tests.rs`
- Modify: `crates/buzz-cli/src/lib.rs`
- Modify: `crates/buzz-cli/Cargo.toml`
- Modify: `Cargo.lock`

**Interfaces:**
- Consumes: keyring 3.6.3 and existing environment identity.
- Produces: `CliIdentitySource::{ManagedAgent,LegacyKey,HaroAccount}` and `HaroCliSecretStore`.

- [ ] **Step 1: Add precedence/redaction tests**

```rust
#[test]
fn managed_agent_environment_wins_over_human_keyring() -> Result<(), CliError> {
    let source = resolve_identity(test_env_with_auth_tag(), populated_account_store())?;
    assert!(matches!(source, CliIdentitySource::ManagedAgent { .. }));
    Ok(())
}

#[test]
fn stored_account_debug_is_redacted() {
    let rendered = format!("{:?}", StoredCliAccount::test_value("secret-canary"));
    assert!(!rendered.contains("secret-canary"));
}
```

- [ ] **Step 2: Verify identity tests fail**

Run: `cargo test -p buzz-cli account::tests`

Expected: FAIL because account identity source does not exist.

- [ ] **Step 3: Implement explicit precedence**

Pin `keyring = "=3.6.3"` and add `rpassword`. Resolve identity in this order: `BUZZ_AUTH_TAG` + private key as managed agent, explicit `--private-key`/env as legacy key, selected Haro account from keyring, otherwise auth error. Never silently generate a key.

```rust
pub enum CliIdentitySource {
    ManagedAgent { keys: Keys, auth_tag: String },
    LegacyKey { keys: Keys },
    HaroAccount { account_id: Uuid, keys: Keys, session: StoredSession, device_key: SigningKey },
}
```

Store account index metadata separately from per-account secrets; deleting one account cannot delete another.

- [ ] **Step 4: Run CLI identity tests**

Run: `cargo test -p buzz-cli account::tests && cargo clippy -p buzz-cli --all-targets -- -D warnings`

Expected: PASS for empty store, locked keyring, managed agent, legacy key, selected account, multiple accounts, redaction, and deletion isolation.

- [ ] **Step 5: Commit CLI storage**

```bash
. ./bin/activate-hermit
git add crates/buzz-cli/src/account crates/buzz-cli/src/lib.rs crates/buzz-cli/Cargo.toml Cargo.lock
git commit -m "feat(cli): add Haro account keyring storage"
```

### Task 3: Add Account Commands and Safe Prompts

**Files:**
- Create: `crates/buzz-cli/src/commands/account.rs`
- Modify: `crates/buzz-cli/src/commands/mod.rs`
- Modify: `crates/buzz-cli/src/lib.rs`
- Test: `crates/buzz-cli/tests/account_commands.rs`

**Interfaces:**
- Consumes: shared account HTTP client, CLI secret store, stdin/TTY prompt abstraction.
- Produces: `account register|verify|login|status|sessions|revoke|logout|logout-all|forgot-password|reset-password|change-password`.

- [ ] **Step 1: Add parser and secret-source tests**

```rust
#[test]
fn login_has_no_password_flag() {
    let help = Cli::command().render_long_help().to_string();
    assert!(!help.contains("--password"));
}

#[tokio::test]
async fn invalid_login_exits_three_without_storing_account() {
    let fixture = CliFixture::invalid_credentials();
    assert_eq!(fixture.run(["buzz", "account", "login", "--username", "ridho"]).await, 3);
    assert!(fixture.store.is_empty());
}
```

- [ ] **Step 2: Verify commands are absent**

Run: `cargo test -p buzz-cli --test account_commands`

Expected: FAIL because `account` is not a subcommand.

- [ ] **Step 3: Implement account command tree**

```rust
#[derive(Subcommand)]
pub enum AccountCmd {
    Register { #[arg(long)] username: String, #[arg(long)] email: String },
    Verify,
    Login { #[arg(long)] username: String },
    Status,
    Sessions,
    Revoke { session_id: Uuid },
    Logout,
    LogoutAll,
    ForgotPassword { #[arg(long)] username: String },
    ResetPassword,
    ChangePassword,
}
```

Read passwords/tokens through an injected `SecretPrompt` so tests do not require a TTY. Register/login creates device/handoff keys before request; only after HPKE open and pubkey verification does it commit secrets to keyring. Output account/session views without email tokens or exact location.

- [ ] **Step 4: Run command tests**

Run: `cargo test -p buzz-cli --test account_commands`

Expected: PASS for help, register/verify/login, status, sessions, revoke, logout, logout-all, forgot/reset/change, invalid credentials, keyring failure, and non-TTY stdin.

- [ ] **Step 5: Commit account commands**

```bash
. ./bin/activate-hermit
git add crates/buzz-cli/src/commands/account.rs crates/buzz-cli/src/commands/mod.rs crates/buzz-cli/src/lib.rs crates/buzz-cli/tests/account_commands.rs
git commit -m "feat(cli): add Haro account commands"
```

### Task 4: Attach Device Proof to CLI Relay and HTTP Operations

**Files:**
- Modify: `crates/buzz-cli/src/client.rs`
- Modify: `crates/buzz-ws-client/src/connection.rs`
- Modify: `crates/buzz-ws-client/src/lib.rs`
- Modify: `crates/buzz-cli/src/commands/upload.rs`
- Test: `crates/buzz-cli/tests/account_device_proof.rs`

**Interfaces:**
- Consumes: `CliIdentitySource`, shared proof crate, relay challenge and normalized request data.
- Produces: NIP-42 `haro-device` tag and proof headers for NIP-98/Blossom/git paths.

- [ ] **Step 1: Add shared-vector and managed-agent isolation tests**

```rust
#[test]
fn account_auth_adds_exact_device_tag() -> anyhow::Result<()> {
    let auth = build_auth_event(account_fixture(), fixed_challenge(), fixed_relay())?;
    assert_eq!(auth.tags.iter().filter(|tag| tag.kind() == "haro-device").count(), 1);
    assert_eq!(auth.haro_device_signature(), shared_vector_signature());
    Ok(())
}

#[test]
fn managed_agent_auth_never_adds_haro_device_tag() -> anyhow::Result<()> {
    let auth = build_auth_event(managed_agent_fixture(), fixed_challenge(), fixed_relay())?;
    assert!(!auth.tags.iter().any(|tag| tag.kind() == "haro-device"));
    Ok(())
}
```

- [ ] **Step 2: Verify account-bound auth fails**

Run: `cargo test -p buzz-cli --test account_device_proof`

Expected: FAIL because CLI WebSocket/HTTP clients cannot attach device proof.

- [ ] **Step 3: Pass an auth strategy into shared clients**

```rust
#[async_trait]
pub trait RelayAuthStrategy: Send + Sync {
    async fn auth_tags(&self, challenge: &str, relay: &Url, pubkey: &PublicKey) -> Result<Vec<Tag>, WsClientError>;
    async fn http_headers(&self, request: &BoundHttpRequest) -> Result<HeaderMap, WsClientError>;
}
```

Legacy/NIP-OA strategies preserve current behavior. Haro account strategy refreshes an expired access token through the shared client, signs request-bound device proof, and retries exactly once before returning auth error. Upload hashes bytes before signing.

- [ ] **Step 4: Run CLI and shared WebSocket tests**

Run: `cargo test -p buzz-ws-client -p buzz-cli --test account_device_proof && cargo test -p buzz-cli`

Expected: PASS for NIP-42, HTTP, upload, retry-on-refresh, revoked session, wrong authority, and managed-agent compatibility.

- [ ] **Step 5: Commit CLI proof integration**

```bash
. ./bin/activate-hermit
git add crates/buzz-cli/src/client.rs crates/buzz-cli/src/commands/upload.rs crates/buzz-ws-client/src/connection.rs crates/buzz-ws-client/src/lib.rs crates/buzz-cli/tests/account_device_proof.rs
git commit -m "feat(cli): authenticate with Haro device proof"
```

### Task 5: Add Legacy CLI Migration

**Files:**
- Modify: `crates/buzz-cli/src/commands/account.rs`
- Create: `crates/buzz-cli/src/account/migration.rs`
- Test: `crates/buzz-cli/tests/account_migration.rs`

**Interfaces:**
- Consumes: explicit legacy private key identity and Plan 03 migration API.
- Produces: `account migrate` with exact pubkey preservation and mobile-impact acknowledgement.

- [ ] **Step 1: Add acknowledgement and idempotency tests**

```rust
#[tokio::test]
async fn migration_requires_mobile_disconnect_acknowledgement() {
    let fixture = CliFixture::legacy_identity();
    let code = fixture.run(["buzz", "account", "migrate", "--username", "ridho", "--email", "user@example.com"]).await;
    assert_eq!(code, 1);
    assert_eq!(fixture.server.migration_calls(), 0);
}
```

- [ ] **Step 2: Verify migrate command is absent**

Run: `cargo test -p buzz-cli --test account_migration`

Expected: FAIL because `account migrate` is missing.

- [ ] **Step 3: Implement journaled CLI migration**

Add `--acknowledge-mobile-disconnect` as a required boolean flag. Prompt password without echo, seal the existing Nostr secret to the server ingest key, sign the complete challenge transcript, verify email token from prompt, open returned bundle, compare pubkey, and only then store the Haro account.

```rust
Migrate {
    #[arg(long)] username: String,
    #[arg(long)] email: String,
    #[arg(long, action = clap::ArgAction::SetTrue)] acknowledge_mobile_disconnect: bool,
}
```

- [ ] **Step 4: Run migration tests**

Run: `cargo test -p buzz-cli --test account_migration`

Expected: PASS for missing acknowledgement, wrong legacy key, conflict, expiry, crash/retry, concurrent completion, unchanged pubkey, and no generated replacement key.

- [ ] **Step 5: Commit CLI migration**

```bash
. ./bin/activate-hermit
git add crates/buzz-cli/src/commands/account.rs crates/buzz-cli/src/account/migration.rs crates/buzz-cli/tests/account_migration.rs
git commit -m "feat(cli): migrate legacy identities to Haro accounts"
```

### Task 6: Desktop/CLI Conformance and Phase Gate

**Files:**
- Create: `crates/buzz-test-client/tests/e2e_account_clients.rs`
- Modify: `docs/superpowers/plans/2026-07-30-haro-05-cli-account-client.md`

**Interfaces:**
- Consumes: Desktop account fixture, CLI binary, two relay pods, Kurir fixture.
- Produces: proof that both supported client classes can enroll, recover, and revoke.

- [ ] **Step 1: Add cross-client E2E workflow**

```rust
#[tokio::test]
async fn desktop_login_cli_revoke_preserves_identity_and_history() -> anyhow::Result<()> {
    let fixture = AccountClientsFixture::start().await?;
    let desktop = fixture.register_desktop("ridho").await?;
    desktop.send_message("general", "before revoke").await?;
    let cli = fixture.login_cli("ridho").await?;
    assert_eq!(desktop.pubkey(), cli.pubkey());
    cli.revoke(desktop.session_id()).await?;
    desktop.wait_for_disconnect().await?;
    assert!(cli.read_message("general", "before revoke").await?);
    Ok(())
}
```

- [ ] **Step 2: Run cross-client E2E**

Run: `cargo test -p buzz-test-client --test e2e_account_clients`

Expected: PASS for Desktop-register/CLI-login, CLI-register/Desktop-login, session revoke, logout-all, reset, unchanged history/pubkey, and generic Nostr rejection.

- [ ] **Step 3: Run CLI gate**

Run: `cargo fmt --all -- --check && cargo clippy -p haro-account-protocol -p haro-account-client -p buzz-ws-client -p buzz-cli --all-targets -- -D warnings && cargo test -p haro-account-protocol -p haro-account-client -p buzz-ws-client -p buzz-cli`

Expected: every command exits 0.

- [ ] **Step 4: Commit E2E evidence**

```bash
. ./bin/activate-hermit
git add crates/buzz-test-client/tests/e2e_account_clients.rs docs/superpowers/plans/2026-07-30-haro-05-cli-account-client.md
git commit -m "test(auth): verify Desktop and CLI account conformance"
```
