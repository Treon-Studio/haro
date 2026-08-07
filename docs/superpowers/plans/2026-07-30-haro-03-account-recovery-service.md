# Haro Account and Recovery Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the disabled-by-default Haro account authority, encrypted custodial identity store, revocable device sessions, Desktop/CLI proof verification, and Kurir recovery delivery.

**Architecture:** `haro-device-proof` owns the versioned deterministic CBOR/Ed25519 contract shared by relay, Tauri, and CLI. `haro-account` owns account transactions behind repository/service traits; `buzz-relay` mounts its HTTP router only on `HARO_ACCOUNT_AUTHORITY` and enforces device proof only for account-bound human pubkeys.

**Tech Stack:** Rust 1.88, Axum 0.8, SQLx/PostgreSQL, Redis, Argon2id, AES-256-GCM, HPKE RFC 9180, Ed25519, AWS KMS, reqwest, Kurir `/v1/emails`.

## Global Constraints

- Plans 01 and 02 must be green.
- Do not modify `mobile/`.
- Account routes are disabled unless `HARO_ACCOUNT_AUTHORITY` and encryption configuration are valid.
- Argon2id floor is `m=19456 KiB`, `t=2`, `p=1`; password length is 15-128 Unicode scalar values.
- Access lifetime is 15 minutes; refresh idle lifetime is 7 days; refresh absolute lifetime is 30 days.
- Verification token lifetime is 24 hours; reset token lifetime is 30 minutes.
- HPKE suite is X25519/HKDF-SHA256/ChaCha20Poly1305.
- Device proof is Ed25519 over deterministic RFC 8949 CBOR; timestamp skew is 60 seconds and Redis nonce TTL is 120 seconds.
- No `unsafe`, new production `unwrap`, or new production `expect`.

---

### Task 1: Add Deterministic Device-Proof Crate

**Files:**
- Create: `crates/haro-device-proof/Cargo.toml`
- Create: `crates/haro-device-proof/src/lib.rs`
- Create: `crates/haro-device-proof/src/transcript.rs`
- Create: `crates/haro-device-proof/src/http.rs`
- Create: `crates/haro-device-proof/tests/vectors.rs`
- Create: `testdata/haro-device-proof-v1.json`
- Modify: `Cargo.toml`
- Modify: `Cargo.lock`

**Interfaces:**
- Consumes: normalized authority, operation, session UUID, Nostr pubkey, request/challenge fields, timestamp, nonce.
- Produces: `ProofTranscriptV1::encode()`, `DeviceProofV1::sign()`, `verify_strict()`, `HaroProofHeaders`, and shared known-answer vectors.

- [ ] **Step 1: Add a failing known-answer test**

```rust
#[test]
fn websocket_auth_vector_is_byte_exact() -> Result<(), Box<dyn std::error::Error>> {
    let vector: Vector = serde_json::from_str(include_str!("../../../testdata/haro-device-proof-v1.json"))?;
    let transcript = ProofTranscriptV1::try_from(vector.websocket_auth.input)?;
    assert_eq!(hex::encode(transcript.encode()?), vector.websocket_auth.cbor_hex);
    assert_eq!(DeviceProofV1::sign(&vector.signing_key()?, transcript)?.signature_base64url(), vector.websocket_auth.signature);
    Ok(())
}
```

- [ ] **Step 2: Verify the crate is absent**

Run: `cargo test -p haro-device-proof`

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement the exact v1 contract**

Pin workspace dependencies:

```toml
minicbor = { version = "=2.2.2", features = ["derive", "std"] }
ed25519-dalek = { version = "=3.0.0", features = ["rand_core", "zeroize"] }
base64 = "0.22"
```

Use integer CBOR keys `1=version`, `2=operation`, `3=session UUID bytes`, `4=authority`, `5=Nostr pubkey bytes`, `6=method-or-challenge`, `7=path-query`, `8=body-hash/event-id bytes`, `9=unix-ms`, `10=nonce bytes`. Reject unknown operation/version, noncanonical authority/path, non-32-byte pubkey/nonce/hash, weak Ed25519 keys, and non-64-byte signatures.

```rust
pub enum ProofOperation { NostrAuth = 1, Http = 2, Huddle = 3, Git = 4 }

pub struct ProofTranscriptV1 {
    pub operation: ProofOperation,
    pub session_id: Uuid,
    pub authority: String,
    pub nostr_pubkey: [u8; 32],
    pub binding: ProofBinding,
    pub unix_ms: i64,
    pub nonce: [u8; 32],
}
```

- [ ] **Step 4: Run crate tests and forbid alternate encodings**

Run: `cargo test -p haro-device-proof && cargo clippy -p haro-device-proof --all-targets -- -D warnings`

Expected: PASS; tests reject reordered/non-shortest CBOR, padded base64, weak key, wrong operation, and changed authority.

- [ ] **Step 5: Commit proof crate**

```bash
. ./bin/activate-hermit
git add Cargo.toml Cargo.lock crates/haro-device-proof testdata/haro-device-proof-v1.json
git commit -m "feat(auth): define Haro device proof v1"
```

### Task 2: Add Account Schema and Transaction Repository

**Files:**
- Create: `migrations/0025_haro_accounts.sql`
- Create: `crates/haro-account/Cargo.toml`
- Create: `crates/haro-account/src/lib.rs`
- Create: `crates/haro-account/src/model.rs`
- Create: `crates/haro-account/src/repository.rs`
- Create: `crates/haro-account/src/error.rs`
- Create: `crates/haro-account/tests/repository.rs`
- Modify: `Cargo.toml`
- Modify: `Cargo.lock`

**Interfaces:**
- Consumes: `sqlx::PgPool` and database time.
- Produces: `AccountRepository` transactional methods and redacted account/session models.

- [ ] **Step 1: Add migration/repository tests**

```rust
#[sqlx::test(migrations = "../../migrations")]
async fn normalized_username_and_email_are_unique(pool: PgPool) -> Result<(), AccountError> {
    let repo = PgAccountRepository::new(pool);
    repo.create_pending(registration("Ridho", "User@example.com")).await?;
    assert!(matches!(repo.create_pending(registration("ridho", "User@example.com")).await, Err(AccountError::Conflict)));
    Ok(())
}
```

- [ ] **Step 2: Verify schema test fails**

Run: `cargo test -p haro-account --test repository`

Expected: FAIL because the crate/table does not exist.

- [ ] **Step 3: Create additive account tables and constraints**

The migration creates the nine tables from the approved spec. Use `uuid` primary keys, `bytea` for hashes/ciphertext/keys/nonces, `timestamptz` for lifecycle fields, check constraints for status/version/byte lengths, partial unique indexes for non-deleted normalized username/email, and a global unique index on lowercase Nostr pubkey.

```sql
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  username text NOT NULL,
  username_normalized text NOT NULL,
  email text NOT NULL,
  email_normalized text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_email','active','locked','disabled','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX accounts_username_live_uq ON accounts(username_normalized) WHERE status <> 'deleted';
CREATE UNIQUE INDEX accounts_email_live_uq ON accounts(email_normalized) WHERE status <> 'deleted';
```

Repository methods accept `&mut Transaction<'_, Postgres>` for registration, verification, refresh rotation, reset, password change, logout-all, and migration completion so service code defines one commit boundary.

- [ ] **Step 4: Run migration tests**

Run: `cargo test -p haro-account --test repository`

Expected: PASS for unique constraints, restrictive foreign keys, conditional token consumption, and concurrent single-winner refresh.

- [ ] **Step 5: Commit schema/repository**

```bash
. ./bin/activate-hermit
git add Cargo.toml Cargo.lock migrations/0025_haro_accounts.sql crates/haro-account
git commit -m "feat(auth): add Haro account persistence"
```

### Task 3: Implement Password Policy and Session Rotation

**Files:**
- Create: `crates/haro-account/src/password.rs`
- Create: `crates/haro-account/src/session.rs`
- Create: `crates/haro-account/src/rate_limit.rs`
- Test: `crates/haro-account/tests/password_session.rs`
- Modify: `crates/haro-account/Cargo.toml`
- Modify: `Cargo.toml`
- Modify: `Cargo.lock`

**Interfaces:**
- Consumes: normalized credentials, bounded Tokio blocking semaphore, repository transactions, Redis.
- Produces: `PasswordService`, `SessionService`, opaque redacted token types, and rate-limit decisions.

- [ ] **Step 1: Add policy and replay tests**

```rust
#[tokio::test]
async fn consumed_refresh_replay_revokes_family() -> Result<(), AccountError> {
    let fixture = SessionFixture::new().await?;
    let first = fixture.sessions.refresh(fixture.initial_refresh()).await?;
    assert!(matches!(fixture.sessions.refresh(fixture.initial_refresh()).await, Err(AccountError::SessionReplay)));
    assert!(fixture.repo.family_is_revoked(first.family_id).await?);
    Ok(())
}
```

- [ ] **Step 2: Verify tests fail**

Run: `cargo test -p haro-account --test password_session`

Expected: FAIL with missing modules/types.

- [ ] **Step 3: Implement bounded Argon2id and opaque sessions**

Pin `argon2 = "=0.5.3"`. Construct `Params::new(19_456, 2, 1, None)`, use random salts, PHC strings, and `spawn_blocking` guarded by a configurable semaphore. Hash access/refresh tokens with SHA-256 plus a server-side pepper reference; store only hashes. Refresh uses one SQL conditional update and revokes the family when a consumed token hash reappears.

```rust
pub struct SessionPolicy {
    pub access: Duration,
    pub refresh_idle: Duration,
    pub refresh_absolute: Duration,
}

impl Default for SessionPolicy {
    fn default() -> Self {
        Self { access: Duration::minutes(15), refresh_idle: Duration::days(7), refresh_absolute: Duration::days(30) }
    }
}
```

- [ ] **Step 4: Run security/concurrency tests**

Run: `cargo test -p haro-account --test password_session && cargo clippy -p haro-account --all-targets -- -D warnings`

Expected: PASS for short/long/common passwords, Unicode, rehash, semaphore saturation, expiry, rotation, and replay.

- [ ] **Step 5: Commit credentials/sessions**

```bash
. ./bin/activate-hermit
git add Cargo.toml Cargo.lock crates/haro-account/Cargo.toml crates/haro-account/src/password.rs crates/haro-account/src/session.rs crates/haro-account/src/rate_limit.rs crates/haro-account/tests/password_session.rs
git commit -m "feat(auth): add Haro credentials and rotating sessions"
```

### Task 4: Implement Envelope Encryption and HPKE Handoff

**Files:**
- Create: `crates/haro-account/src/kms.rs`
- Create: `crates/haro-account/src/identity.rs`
- Create: `crates/haro-account/src/handoff.rs`
- Test: `crates/haro-account/tests/identity_crypto.rs`
- Modify: `crates/haro-account/Cargo.toml`
- Modify: `Cargo.lock`

**Interfaces:**
- Consumes: `KeyEncryptionProvider`, account/pubkey/AAD version, client HPKE public key.
- Produces: `IdentityEnvelope`, `SealedIdentityBundle`, `AwsKmsProvider`, and `DevelopmentKeyProvider`.

- [ ] **Step 1: Add tamper and public-key-binding tests**

```rust
#[tokio::test]
async fn envelope_rejects_account_substitution() -> Result<(), AccountError> {
    let provider = DevelopmentKeyProvider::from_bytes([7; 32]);
    let envelope = encrypt_identity(account_a(), secret_key(), &provider).await?;
    assert!(decrypt_identity(account_b(), &envelope, &provider).await.is_err());
    Ok(())
}
```

- [ ] **Step 2: Verify crypto modules are absent**

Run: `cargo test -p haro-account --test identity_crypto`

Expected: FAIL with missing imports.

- [ ] **Step 3: Implement standard primitives**

Pin `aes-gcm = "=0.10.3"`, `hpke = { version = "=0.14.0", default-features = false, features = ["alloc","getrandom","chacha","x25519","hkdfsha2"] }`, and `aws-sdk-kms = "=1.111.0"`. `AwsKmsProvider` calls `GenerateDataKey` with `AES_256`; plaintext DEKs and Nostr secrets use `Zeroizing<[u8;32]>`. Development startup requires exactly 32 decoded bytes.

```rust
#[async_trait]
pub trait KeyEncryptionProvider: Send + Sync {
    async fn generate_data_key(&self, context: &EncryptionContext) -> Result<GeneratedDataKey, AccountError>;
    async fn decrypt_data_key(&self, wrapped: &[u8], context: &EncryptionContext) -> Result<Zeroizing<[u8; 32]>, AccountError>;
}
```

HPKE `info` is `b"haro-identity-handoff/v1"`; AAD is deterministic CBOR containing request/account/device/direction/expiry/pubkey fields. Verify the derived secp256k1 public key before storage and after opening.

- [ ] **Step 4: Run crypto and dependency gates**

Run: `cargo test -p haro-account --test identity_crypto && cargo check -p haro-account && cargo audit`

Expected: PASS for round-trip, ciphertext/AAD/wrapped-key tamper, wrong handoff key, expiry, key version rotation, and dependency audit.

- [ ] **Step 5: Commit identity crypto**

```bash
. ./bin/activate-hermit
git add Cargo.lock crates/haro-account/Cargo.toml crates/haro-account/src/kms.rs crates/haro-account/src/identity.rs crates/haro-account/src/handoff.rs crates/haro-account/tests/identity_crypto.rs
git commit -m "feat(auth): encrypt and hand off Haro identities"
```

### Task 5: Implement Kurir Transactional Delivery

**Files:**
- Create: `crates/haro-account/src/delivery.rs`
- Create: `crates/haro-account/src/kurir.rs`
- Test: `crates/haro-account/tests/kurir_contract.rs`
- Modify: `crates/haro-account/src/lib.rs`

**Interfaces:**
- Consumes: outbox rows and backend-only Kurir API key with `emails:write`.
- Produces: `KurirClient::send_email`, bounded retry classifier, and outbox worker.

- [ ] **Step 1: Add exact Kurir contract tests**

```rust
#[tokio::test]
async fn reset_delivery_uses_backend_key_and_idempotency() -> Result<(), AccountError> {
    let server = KurirFixture::start().await;
    let client = KurirClient::new(server.url(), KurirApiKey::new("key"), Uuid::nil())?;
    client.send_email(reset_job()).await?;
    let request = server.only_request().await?;
    assert_eq!(request.path, "/v1/emails");
    assert_eq!(request.header("Idempotency-Key"), "haro-password-reset:request-id");
    assert_eq!(request.json["productId"], Uuid::nil().to_string());
    Ok(())
}
```

- [ ] **Step 2: Verify contract test fails**

Run: `cargo test -p haro-account --test kurir_contract`

Expected: FAIL because the client is absent.

- [ ] **Step 3: Implement delivery and retry classification**

Send `{productId,to,subject,html}` to `POST /v1/emails`. Treat 200/201 as success, 401/403 and other non-429 4xx as terminal, and 429/5xx/network timeout as retriable with capped exponential backoff plus jitter. Never log API key, recipient, or token-bearing HTML.

```rust
pub struct KurirApiKey(Zeroizing<String>);
pub enum DeliveryDisposition { Delivered, RetryAfter(Duration), Terminal(&'static str) }
```

Forgot-password always returns the same public response. Creating/superseding the 256-bit token and outbox row is one database transaction; Kurir is called after commit.

- [ ] **Step 4: Run Kurir matrix tests**

Run: `cargo test -p haro-account --test kurir_contract`

Expected: PASS for 200, 201 replay, 401, 403, 429, 500, timeout, dead letter, and redaction cases.

- [ ] **Step 5: Commit Kurir integration**

```bash
. ./bin/activate-hermit
git add crates/haro-account/src/lib.rs crates/haro-account/src/delivery.rs crates/haro-account/src/kurir.rs crates/haro-account/tests/kurir_contract.rs
git commit -m "feat(auth): deliver Haro recovery through Kurir"
```

### Task 6: Mount Versioned Account API on the Account Authority

**Files:**
- Create: `crates/buzz-relay/src/api/account/mod.rs`
- Create: `crates/buzz-relay/src/api/account/contracts.rs`
- Create: `crates/buzz-relay/src/api/account/handlers.rs`
- Create: `crates/buzz-relay/src/api/account/middleware.rs`
- Create: `crates/haro-account/src/service.rs`
- Create: `crates/haro-account/src/audit.rs`
- Create: `crates/haro-account/src/metrics.rs`
- Modify: `crates/buzz-relay/src/api/mod.rs`
- Modify: `crates/buzz-relay/src/config.rs`
- Modify: `crates/buzz-relay/src/state.rs`
- Modify: `crates/buzz-relay/src/router.rs`
- Test: `crates/buzz-relay/tests/account_api.rs`

**Interfaces:**
- Consumes: `Arc<AccountService>`, strict JSON contracts, exact host authority.
- Produces: all `/api/haro/v1/account` endpoints from the approved spec.

- [ ] **Step 1: Add authority and non-enumeration tests**

```rust
#[tokio::test]
async fn account_routes_exist_only_on_exact_authority() {
    let app = account_test_router().await;
    assert_eq!(post(&app, "accounts.haro.test", "/api/haro/v1/account/forgot-password", forgot_body()).await.status(), StatusCode::ACCEPTED);
    assert_eq!(post(&app, "community.haro.test", "/api/haro/v1/account/forgot-password", forgot_body()).await.status(), StatusCode::NOT_FOUND);
}
```

- [ ] **Step 2: Verify route tests fail**

Run: `cargo test -p buzz-relay --test account_api`

Expected: FAIL with missing account router.

- [ ] **Step 3: Implement strict contracts and handlers**

Mount a separately body-limited router only when configured. Reject unknown JSON fields with `#[serde(deny_unknown_fields)]`. Use stable envelopes `{code,message,request_id}`; credential/recovery public responses do not reveal account existence. Return session tokens and sealed identity only to the native caller.

```rust
pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/register", post(handlers::register))
        .route("/verify-email", post(handlers::verify_email))
        .route("/login", post(handlers::login))
        .route("/refresh", post(handlers::refresh))
        .route("/logout", post(handlers::logout))
        .route("/logout-all", post(handlers::logout_all))
        .route("/forgot-password", post(handlers::forgot_password))
        .route("/reset-password", post(handlers::reset_password))
        .with_state(state)
}
```

Add the remaining approved endpoints in the same router: resend verification,
change password, change/verify email, legacy migration start/prove/complete,
`/me`, `DELETE /me`, `/me/communities`, `/sessions`, and session deletion.
`AccountService` owns every transaction boundary and writes the security audit
row inside the same transaction. Metrics contain stable outcome codes and never
username, email, pubkey, token, IP, event ID, or account UUID labels. Deletion
revokes immediately and queues erasure without deleting signed event history.

- [ ] **Step 4: Run API tests**

Run: `cargo test -p buzz-relay --test account_api`

Expected: PASS for strict schema, authority, HTTPS policy, registration/verification/login/refresh/logout, recovery, sessions, and migration state transitions.

- [ ] **Step 5: Commit account API**

```bash
. ./bin/activate-hermit
git add crates/haro-account/src/service.rs crates/haro-account/src/audit.rs crates/haro-account/src/metrics.rs crates/buzz-relay/src/api/account crates/buzz-relay/src/api/mod.rs crates/buzz-relay/src/config.rs crates/buzz-relay/src/state.rs crates/buzz-relay/src/router.rs crates/buzz-relay/tests/account_api.rs
git commit -m "feat(relay): expose Haro account authority"
```

### Task 7: Enforce Device Sessions and Cross-Pod Revocation

**Files:**
- Create: `crates/buzz-auth/src/device_proof.rs`
- Create: `crates/buzz-pubsub/src/session_control.rs`
- Modify: `crates/buzz-auth/src/lib.rs`
- Modify: `crates/buzz-relay/src/handlers/auth.rs`
- Modify: `crates/buzz-relay/src/connection.rs`
- Modify: `crates/buzz-relay/src/api/bridge.rs`
- Modify: `crates/buzz-relay/src/api/media.rs`
- Modify: `crates/buzz-relay/src/audio/handler.rs`
- Modify: `crates/buzz-relay/src/api/git/mod.rs`
- Test: `crates/buzz-test-client/tests/e2e_account_bound_auth.rs`

**Interfaces:**
- Consumes: `haro-device` NIP-42 tag, proof headers, account binding lookup, Redis nonce/session-control channels.
- Produces: `VerifiedDeviceSession` stored on authenticated connections and immediate revocation across pods.

- [ ] **Step 1: Add reject/revoke E2E cases**

```rust
#[tokio::test]
async fn account_bound_key_requires_live_matching_device_session() -> anyhow::Result<()> {
    let fixture = AccountRelayFixture::two_pods().await?;
    let account = fixture.account_bound_identity().await?;
    assert!(fixture.nip42_only(account.nostr_keys()).await?.is_rejected());
    let connected = fixture.connect_with_device(account.session()).await?;
    fixture.revoke_on_other_pod(account.session_id()).await?;
    connected.wait_for_close(Duration::from_secs(2)).await?;
    Ok(())
}
```

- [ ] **Step 2: Verify legacy NIP-42 currently succeeds**

Run: `cargo test -p buzz-test-client --test e2e_account_bound_auth`

Expected: FAIL because account binding/proof enforcement does not exist.

- [ ] **Step 3: Insert enforcement after NIP-42 crypto and before membership**

If pubkey is unbound, preserve the current path. If it is an account-bound human, parse exactly one `haro-device` tag, reconstruct the transcript from server-known challenge/authority/pubkey plus tag fields, consume Redis nonce, verify session/account/expiry/key and `verify_strict`, then attach session ID to connection state. Managed NIP-OA identities bypass only when the existing verified owner path classifies them as agents.

```rust
pub struct VerifiedDeviceSession {
    pub account_id: Uuid,
    pub session_id: Uuid,
    pub expires_at: DateTime<Utc>,
}
```

HTTP, Blossom, huddle, and git verify equivalent request-bound proof before existing membership/scope gates. Subscribe every pod to `haro:session-control:v1`; revoke messages close only matching session connections.

- [ ] **Step 4: Run enforcement matrix**

Run: `cargo test -p buzz-test-client --test e2e_account_bound_auth && cargo test -p buzz-test-client --test e2e_relay && cargo test -p buzz-test-client --test e2e_media && cargo test -p buzz-test-client --test e2e_git`

Expected: PASS for missing/wrong/stale/replayed proof, revoke, logout-all, reset, expiry, unbound legacy user, NIP-OA agent, and unrelated-session isolation.

- [ ] **Step 5: Commit enforcement**

```bash
. ./bin/activate-hermit
git add crates/buzz-auth/src/device_proof.rs crates/buzz-auth/src/lib.rs crates/buzz-pubsub/src/session_control.rs crates/buzz-relay/src/handlers/auth.rs crates/buzz-relay/src/connection.rs crates/buzz-relay/src/api/bridge.rs crates/buzz-relay/src/api/media.rs crates/buzz-relay/src/audio/handler.rs crates/buzz-relay/src/api/git/mod.rs crates/buzz-test-client/tests/e2e_account_bound_auth.rs
git commit -m "feat(auth): enforce revocable Haro device sessions"
```

### Task 8: Phase Gate

**Files:**
- Modify: `.env.example`
- Modify: `docs/superpowers/plans/2026-07-30-haro-03-account-recovery-service.md`

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces: disabled-by-default backend ready for Desktop/CLI enrollment.

- [ ] **Step 1: Document exact configuration**

Add `HARO_ACCOUNT_AUTHORITY`, `HARO_ACCOUNT_ENABLED=false`, `HARO_KMS_KEY_ARN`, `HARO_DEV_MASTER_KEY`, `HARO_SESSION_PEPPER`, `HARO_KURIR_BASE_URL`, `HARO_KURIR_API_KEY`, and `HARO_KURIR_PRODUCT_ID` with non-secret example values and production requirements.

- [ ] **Step 2: Run backend gate**

Run: `cargo fmt --all -- --check && cargo clippy -p haro-device-proof -p haro-account -p buzz-auth -p buzz-pubsub -p buzz-relay --all-targets -- -D warnings && cargo test -p haro-device-proof -p haro-account -p buzz-auth -p buzz-pubsub -p buzz-relay`

Expected: every command exits 0.

- [ ] **Step 3: Run infrastructure integration gate**

Run: `just test`

Expected: all Postgres/Redis relay integration tests pass with accounts disabled and enabled test configurations.

- [ ] **Step 4: Commit phase evidence**

```bash
. ./bin/activate-hermit
git add .env.example docs/superpowers/plans/2026-07-30-haro-03-account-recovery-service.md
git commit -m "docs: record Haro account service verification"
```
