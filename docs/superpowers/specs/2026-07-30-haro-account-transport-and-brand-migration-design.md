# Haro Account, Transport, and Brand Migration Design

## Summary

Haro replaces the current partially migrated Buzz desktop experience with a
coherent product identity, a username/password account system, and a typed
realtime client. Existing Nostr events, public keys, community memberships,
messages, and media remain valid. Users interact only with Haro concepts;
Nostr and Blossom remain internal protocols.

This migration must not maintain competing production transports or auth
systems. Legacy Buzz names are read only at explicit migration boundaries and
are never emitted by newly written state after migration.

## Goals

- Let users register and sign in with a username and password from Haro Desktop
  and the Haro CLI, including a second supported device.
- Preserve the Nostr identity and all existing data of migrated Buzz users.
- Support email password recovery through Kurir.
- Keep `SimpleSocket` as Haro's frontend realtime API while implementing the
  relay's actual Nostr protocol correctly.
- Restore all current product capabilities without fake success responses or
  nonexistent REST endpoints.
- Rename product conventions, crates, binaries, configuration, and new stored
  state from Buzz to Haro without invalidating signed historical events.
- Provide migration, contract, integration, and end-to-end tests for every
  compatibility boundary.

## Non-Goals

- Rewriting or re-signing historical Nostr events.
- Replacing the existing relay persistence and authorization model.
- Exposing Nostr private keys, Kurir API keys, or account session tokens to the
  React runtime.
- Adding a second JSON chat backend alongside the relay.
- Supporting an offline/demo login that silently bypasses authentication.
- Allowing account-bound Haro identities to authenticate from generic Nostr
  clients that do not implement Haro device-session proof.
- Treating an exported Nostr private key as a revocable Haro login credential.
- Adding Haro account/device-session support to the Flutter mobile app in the
  initial rollout.

## Architecture

```text
Haro account clients (initial rollout)
|- Desktop: React UI + Tauri trust boundary
|- CLI: terminal UI + OS keyring trust boundary
|- username/password and recovery operations
|- account session and device-session key in platform secure storage
|- Nostr identity cache in platform secure storage
|- HaroClient / SimpleSocket-compatible typed realtime facade
`- native signing and authenticated HTTP commands

Haro Relay
|- Account API
|- Account service and encrypted identity store
|- Existing Nostr WebSocket and HTTP relay
|- PostgreSQL and Redis
|- Key encryption provider
`- Kurir transactional email client
```

Account operations are an HTTP-only surface because password login, session
refresh, and recovery are not Nostr events. Product data continues to use the
existing event pipeline so membership, tenancy, fan-out, search, audit, and
workflow behavior remain centralized.

The account API is served only on a configured account authority such as
`accounts.haro.example`, distinct from community relay authorities. This is
required because a user logging in on a new device does not yet know which
community host to select. Community relay hosts continue to derive tenant
context from `Host` and do not expose deployment-wide account routes.

After account login, `GET /me/communities` derives the account's accessible
communities from its stable Nostr public key and returns only non-secret
connection descriptors for memberships that public key already holds. Selecting
one descriptor moves the client back onto the existing host-bound relay and
NIP-42/NIP-98 authorization paths. Reusable account bearer/refresh credentials
are never forwarded to a community relay request; only the non-secret session
ID and a fresh request-bound device signature are sent as proof inputs.

## Design Invariants

The implementation must preserve these invariants at every rollout stage:

1. A human has exactly one active Nostr public key per Haro account.
2. A migrated user's public key never changes.
3. UI runtimes receive a password only while the user enters it and passes it
   once into a native account command. They never persist or log it and never
   receive refresh tokens, private keys, KMS material, or Kurir credentials.
4. A socket is not usable until NIP-42 authentication succeeds.
5. A successful write result always corresponds to a positive relay
   acknowledgement or a committed account transaction.
6. Community identity comes from the request host; account sessions never
   override the host-derived community boundary.
7. An account session proves account identity but does not grant community
   membership. Existing membership and authorization checks still run.
8. Every legacy name has one centralized compatibility reader and one
   observable migration path. New code never creates legacy-named state.
9. A rolling deployment never requires every relay pod or client to switch
   prefixes atomically.
10. No failed migration, login, reset, reconnect, or rename step may generate a
    replacement Nostr identity.
11. For an account-bound human pubkey, possession of the cached Nostr key alone
    is insufficient to access Haro; every transport also requires an active
    account device session.
12. Account binding enforcement is not enabled for a client class until its
    supported release can enroll, store, rotate, prove, revoke, and recover a
    device session without exposing reusable secrets to its UI runtime.

## Threat Model

The design explicitly addresses:

- Database disclosure: password hashes and identity ciphertext must remain
  resistant to offline use without the KMS boundary.
- Credential stuffing and online guessing: login, registration, verification,
  and recovery have independent IP and account rate limits.
- User enumeration: login, registration conflict handling, forgot-password,
  and recovery timing use generic public responses where disclosure is not
  necessary.
- Session theft and replay: refresh tokens are opaque, hashed, rotated, grouped
  into token families, and replay revokes the family.
- Stolen cached Nostr key: account-bound human access additionally requires a
  live device session; session revocation disconnects active transports across
  relay pods. The permanent Nostr key remains a sensitive export and cannot be
  made cryptographically revocable outside Haro once disclosed.
- Reverse-proxy and frontend logging: application-layer encrypted identity
  handoff prevents private keys from appearing as plaintext JSON.
- Cross-community access: account authentication is never accepted as proof of
  channel or community membership.
- Compromised desktop webview: secrets stay in Tauri and the OS keyring; IPC
  commands expose narrow operations rather than secret getters.
- Compromised desktop host: OS keyring protection reduces casual extraction but
  cannot defend against an attacker controlling the user's account and process.
- Compromised relay process: a relay authorized to decrypt identities is inside
  the custodial trust boundary. KMS policy, audit, and least privilege limit but
  cannot eliminate this risk.
- KMS outage or revocation: new logins and device enrollment fail closed while
  already-unlocked local identities may continue until their account session or
  policy requires reauthentication.
- Kurir outage: recovery requests remain non-enumerating and enter a bounded,
  idempotent retry flow.
- Prefix split-brain: mixed-version nodes dual-read or dual-publish where a
  one-sided switch would lose messages, rate limits, or connection control.
- Supply-chain or accidental secret logging: secret-bearing types use redacted
  debug output and tests scan logs and serialized errors for known canaries.

## Account Model

Accounts are deployment-wide. Community access remains controlled by the
existing community membership tables and host-derived tenant context. One
account owns one stable human Nostr identity and may participate in multiple
communities.

PostgreSQL adds the following community-independent tables:

- `accounts`: stable account ID, normalized username, normalized email,
  lifecycle status, and timestamps.
- `account_credentials`: account ID, Argon2id password hash, password version,
  and password-change timestamp.
- `account_identities`: account ID, Nostr public key, encrypted private key,
  wrapped data-encryption key, KMS key reference, encryption-key/AAD versions,
  nonce, and ciphertext metadata.
- `account_sessions`: token-family ID, hashed opaque access and refresh tokens,
  device-session signing public key, device metadata, idle/absolute expiry,
  revocation, and last-use timestamps.
- `email_verification_tokens`: hashed one-time token, pending account ID,
  expiry, consumption, and delivery-request reference.
- `password_reset_tokens`: hashed one-time token, account ID, expiry, and
  consumed timestamp.
- `legacy_identity_migrations`: idempotency key, requested username/email,
  proven public key, encrypted pending identity, challenge/HPKE key reference,
  state, expiry, and completion account ID.
- `account_delivery_outbox`: transactional verification/recovery delivery jobs,
  Kurir idempotency key, attempt state, next-attempt time, and terminal error
  code without token or email-body secrets.
- `account_audit_log`: append-only security events for registration, login,
  migration, password changes, recovery, session revocation, and key rotation.

Database constraints include:

- Unique normalized username and normalized email among non-deleted accounts.
- Exactly one credential and one active human identity per account.
- Globally unique lowercase Nostr public key across account identities and
  pending legacy migrations.
- Unique access-token hash, refresh-token hash, and token-family sequence.
- Unique verification/reset token hashes and conditional single-use updates.
- Unique account-delivery idempotency key.
- Foreign keys with explicit restrictive/cascade behavior reviewed per table;
  identity and audit records never disappear through an accidental cascade.

Registration, verification, migration completion, refresh rotation, reset,
password change, and logout-all each define one database transaction boundary.
Kurir calls never occur while a database transaction is open; the transaction
writes an outbox row and a worker performs delivery afterward.

Username and email comparisons are normalized and case-insensitive. Both are
unique per Haro deployment. Login accepts the username; email is used for
verification and recovery. Error responses never disclose whether a username
or email exists.

Account field policy:

- Username: 3-32 lowercase ASCII characters after normalization; letters,
  digits, `_`, `-`, and `.` only; reserved Haro/system names are rejected.
- Email: parsed and normalized conservatively; the domain is lowercased while
  the local part is retained according to the submitted address. A separate
  normalized lookup column enforces uniqueness.
- Password: 15-128 Unicode characters, no composition rule, no silent
  truncation, checked against a breached/common-password blocklist, and never
  periodically expired without evidence of compromise.
- Display name remains profile data carried by the existing Nostr profile
  event. It is not an authentication identifier.
- Account status is one of `pending_email`, `active`, `locked`, `disabled`, or
  `deleted`; state transitions are explicit and audited.

Registration creates a `pending_email` account and does not grant community
membership. Email verification activates the account. Community creation,
invite claiming, and membership continue through their existing authorization
flows after account activation.

## Password and Identity Security

- Passwords are hashed with Argon2id using a versioned policy. The stored value
  includes the algorithm parameters required for future rehashing.
- The initial Argon2id floor is `m=19456 KiB`, `t=2`, `p=1`, with a startup
  benchmark allowed to increase cost but never reduce it below that floor.
  Successful login transparently rehashes credentials below the current policy.
- Password verification runs behind a dedicated bounded blocking-work
  semaphore so an attacker cannot exhaust the Tokio executor with Argon2 work.
- Nostr private keys use authenticated envelope encryption. Each identity has a
  random data-encryption key; production wraps it with a configured KMS key.
- The identity plaintext is exactly the validated 32-byte secp256k1 secret.
  It is encrypted with AES-256-GCM using a fresh 256-bit data-encryption key and
  96-bit random nonce. Associated data binds the schema version, account ID,
  lowercase Nostr public key, and encryption-key version.
- Production obtains and wraps data-encryption keys through AWS KMS
  `GenerateDataKey`; the encrypted data key is stored beside the identity
  ciphertext and the plaintext data key is zeroized immediately after use.
- Development uses an explicit versioned master key from environment
  configuration and refuses to start without it when account endpoints are
  enabled.
- Encryption metadata includes a key version so rotation can re-wrap data keys
  without changing Nostr identities.
- Private keys and raw session tokens are redacted from logs and error values.
- Account login networking and session handling run in Tauri. React necessarily
  holds the entered password transiently, passes it once to a non-logging Tauri
  command, clears the controlled input in a `finally` path, and receives only
  non-secret account/profile state. It never receives a refresh token or private
  key.
- The Tauri backend stores the session and identity cache in the OS keyring.
- Logout revokes the server session, closes realtime connections, clears
  community-scoped state, and deletes the Haro session and identity cache.

Private identity transfer uses a standard HPKE implementation rather than
custom cryptography:

- Suite: RFC 9180 `DHKEM(X25519, HKDF-SHA256)`, `HKDF-SHA256`, and
  `ChaCha20Poly1305`.
- The HPKE `info` value is a versioned Haro identity-handoff label.
- Authenticated associated data binds request ID, account ID, device ID,
  client/server nonces, intended direction, expiry, and Nostr public key.
- Handoff keys are single-use and never persisted after completion.

1. Tauri generates an ephemeral device handoff key pair for registration,
   login on a new device, or legacy migration.
2. The request sends only the handoff public key and a client nonce.
3. The server decrypts the custodial identity only inside the account service,
   seals it to the handoff public key, zeroizes plaintext buffers, and returns
   the sealed identity bundle.
4. Tauri opens the bundle, verifies that the derived public key equals the
   account public key, writes it to the OS keyring, and zeroizes temporary
   buffers.
5. Neither React, reverse-proxy JSON logs, nor a reusable HTTP response contains
   a plaintext private key.

Legacy migration uses the reverse direction: a server-issued, single-use HPKE
ingest key is bound to the migration challenge, host, account request, and
expiry. Tauri seals the legacy identity to it and signs the complete migration
transcript with the legacy Nostr key. The server verifies the signature before
storing the identity envelope.

The server is intentionally custodial. Operators with access to the configured
KMS authorization boundary can recover an identity. Access to identity decrypt
operations must be auditable and restricted to login, migration verification,
key rotation, and account recovery workflows.

### Account Session Binding to Relay Access

After a public key is bound to an active Haro account, every human-authenticated
relay surface requires both proofs:

1. A valid Nostr signature proving possession of the account identity.
2. A fresh challenge/request signature from the active Haro device session
   bound to the same account.

At account enrollment, Tauri creates a device-session signing key pair distinct
from the permanent Nostr identity. The account service stores only its public
key; Tauri stores the private key in the OS keyring. This key authorizes no
standalone product action and is revoked with its account session.

Device-session keys use Ed25519. Proof transcripts are deterministic CBOR per
RFC 8949, encoded and verified through maintained CBOR libraries with canonical
map ordering; clients do not construct signature input through JSON or string
concatenation. Transcript version 1 uses integer field keys for protocol
version, operation class, account session UUID, normalized target authority,
Nostr public key, challenge or request method, normalized path and query, body
SHA-256/event ID, Unix timestamp in milliseconds, and a 256-bit random nonce.
Fields irrelevant to an operation are omitted rather than encoded with multiple
equivalent empty values. The protocol specification and shared known-answer
fixtures define the exact key numbers and normalization rules before code ships.

For NIP-42, Tauri signs a canonical transcript containing protocol version,
account session ID, NIP-42 challenge, relay authority, Nostr public key,
timestamp, and random nonce. The device signature and transcript fields enter
the non-persisted AUTH event in one exact tag:
`["haro-device", "1", <session-uuid>, <unix-ms>, <nonce-base64url>,
<signature-base64url>]`. The Nostr-signed AUTH event still carries the standard
NIP-42 `relay` and `challenge` tags. React sees only this challenge-bound
one-time proof, never the device private key or bearer token.

NIP-98, Blossom, huddle, git credential, and other signed HTTP/WebSocket
surfaces use an equivalent device signature bound to method, normalized URL,
body hash/event ID, timestamp, nonce, and target community authority. The
desktop performs authenticated HTTP calls through Tauri commands so React does
not handle account access tokens or reusable session material.

HTTP proofs use the headers `Haro-Proof-Version`, `Haro-Session-ID`,
`Haro-Proof-Timestamp`, `Haro-Proof-Nonce`, and `Haro-Proof-Signature`; none is a
bearer credential. NIP-98 remains required where it is required today. Long-lived
non-Nostr sockets, including huddle, send the same proof fields in their first
authenticated protocol message rather than in a URL. Git helpers attach the
headers inside the native helper process. Redirects never forward proof headers
to another authority.

The relay resolves the signed public key to its account, loads the named
session, verifies account ID, session state, expiry, device signature,
timestamp, nonce replay guard, and request binding, then continues through the
existing community membership/scope checks. A session proof can never select
or override community context.

Proof timestamps are accepted within 60 seconds of database/relay time. A
successful or failed signature verification consumes the `(session, nonce)` in
Redis for two minutes, preventing brute-force reuse; structurally invalid
requests are rejected before inserting unbounded attacker-controlled state.
Nonce entries and verification work are rate limited and namespaced by proof
version. NIP-42 must still finish inside the existing five-second authentication
deadline.

Revocation behavior:

- Session revocation publishes a session-scoped connection-control message in
  Redis and closes every matching Nostr, huddle, tunnel, and long-lived socket
  on all pods.
- HTTP requests revalidate the session and device signature before every
  operation; nonces enter a short-lived community/session replay guard.
- WebSocket connections retain the validated session ID and session expiry.
  They close at expiry or revocation unless the client completes the defined
  reauthentication transition.
- `SimpleSocket` asks the platform signer (Tauri on Desktop) for a new
  challenge-bound device proof and reauthenticates/reconnects without exposing
  account tokens or signing keys.
- Password reset, logout-all, account disable, and account deletion revoke all
  token families and publish disconnect control before returning success.
- A device that retains a copied Nostr key after revocation cannot obtain a new
  Haro session without valid account credentials/recovery.

During migration, unbound legacy pubkeys continue using the existing NIP-42
path. The moment a legacy migration commits, that pubkey becomes account-bound
and session proof becomes mandatory. Managed agents and relay-signed system
identities remain on their existing NIP-OA/relay authorization paths and are
not misclassified as human account sessions.

### Client Compatibility Decision

Haro chooses revocation correctness over generic Nostr-client interoperability
for account-bound human identities. A standard Nostr client can prove possession
of the permanent Nostr key, but it cannot prove that the Haro account session is
still active. The relay therefore rejects account-bound human authentication
that omits a valid Haro device-session proof.

Supported account clients at enforcement time are:

| Client | Session secret boundary | Required account capabilities |
|---|---|---|
| Haro Desktop | Tauri commands and OS keyring | enroll, login, refresh, sign relay/HTTP proof, list/revoke sessions, recover |
| Haro CLI | OS keyring and local native process | interactive login, refresh, request-bound proof, logout, and explicit account selection |

The Flutter mobile app is not an account client in the initial rollout and is
not changed by these plans. It may continue using an unbound legacy Nostr
identity. Once that public key is migrated and becomes account-bound, an old
mobile client cannot authenticate it. Desktop and CLI migration screens must
state this consequence and require explicit confirmation before the irreversible
binding transaction. Mobile support requires its own later design and rollout.

Browser-only repo and invite views remain public or use their existing scoped
flows; they do not receive a custodial identity or account refresh token. Any
future browser account client requires a separate reviewed secret-storage and
device-proof design before it is added to the supported matrix.

Private-key export, if retained as an advanced recovery/portability operation,
requires recent reauthentication, an explicit irreversible-risk warning, and an
audit event. The exported key may be used with the public Nostr ecosystem, but
it does not bypass Haro's device-session requirement and does not make a generic
Nostr client a supported Haro account client.

### Client Enrollment and Enforcement Rollout

The server advertises account/device-proof capabilities in versioned relay and
account metadata. Each supported client sends a stable client class and protocol
version when it enrolls a device. The server accepts only known proof versions
and never infers support from a user-agent string.

Rollout uses these gates in order:

1. Deploy additive account tables, proof verification, Redis revocation, and
   capability metadata with account binding enforcement disabled.
2. Release Desktop and CLI versions that can create platform-held
   device keys, enroll sessions, produce request-bound proofs, and handle
   revocation and recovery.
3. Verify each client class with conformance tests and production capability
   telemetry that contains versions and outcomes but no usernames, tokens,
   public keys, challenges, nonces, or signatures.
4. Enable new-account registration only for client classes whose minimum
   supported version passes the conformance gate.
5. Offer legacy migration only from a capable client. The migration transaction
   checks the enrolling session and records the proof protocol version before it
   atomically marks the public key account-bound.
6. Reject stale client versions before migration starts, with an upgrade-required
   error that does not mutate the legacy identity or migration state.
7. Enable account-bound enforcement per client class and deployment cohort.
   There is no global flag that can strand all clients simultaneously.

Rollback may stop new registration or migration and may disable a newly
introduced proof version. It must not silently remove session enforcement from
already account-bound keys. If a client regression prevents access, recovery is
through a fixed supported client or an audited account-recovery procedure, not
through the legacy NIP-42-only path.

## Account API

The relay exposes versioned endpoints under `/api/haro/v1/account`:

- `POST /register`: create only a pending account, credential, and email
  verification record. It does not create an identity/session or grant
  community membership.
- `POST /verify-email`: consume a one-time verification token, activate the
  account, create its custodial Nostr identity, and issue the first device
  session and sealed identity bundle in one transaction boundary.
- `POST /resend-verification`: return a generic response and enqueue at most one
  active verification delivery per cooldown window.
- `POST /login`: verify credentials and issue a new device session.
- `POST /refresh`: atomically rotate an opaque refresh token.
- `POST /logout`: revoke the current session.
- `POST /logout-all`: revoke every account session.
- `POST /change-password`: require the current password, update credentials,
  and revoke other sessions.
- `POST /change-email`: require recent authentication and the current password,
  create a pending email-change verification, and keep the current email active.
- `POST /verify-email-change`: consume the pending one-time token, atomically
  replace the normalized email, and revoke other sessions.
- `POST /forgot-password`: always return the same accepted response and enqueue
  a Kurir reset email only when the account exists.
- `POST /reset-password`: consume a valid one-time token, update credentials,
  and revoke all existing sessions.
- `POST /migration/legacy/start`: create a pending migration transaction and
  return a signed challenge plus single-use HPKE ingest public key.
- `POST /migration/legacy/prove`: accept the signed migration transcript and
  sealed legacy identity, validate both, and hold the verified binding pending
  email verification.
- `POST /migration/legacy/complete`: consume the email token, atomically create
  the account binding/session, and return the same public key plus a device
  handoff bundle.
- `GET /me`: return non-secret account and session information.
- `DELETE /me`: require recent authentication plus current password, revoke all
  sessions, disable login immediately, and enqueue policy-governed erasure.
- `GET /me/communities`: return only active communities for which the account's
  Nostr public key is already an owner/member, including canonical relay URL and
  display metadata.
- `GET /sessions`: list the account's device sessions.
- `DELETE /sessions/{session_id}`: revoke one owned device session.

All requests and responses use strict versioned schemas with unknown-field
rejection. Representative contracts are:

```json
POST /api/haro/v1/account/register
{
  "username": "ridho",
  "email": "user@example.com",
  "password": "correct horse battery staple",
  "device": {
    "id": "installation-uuid",
    "name": "Ridho's Mac",
    "platform": "macos",
    "session_signing_public_key": "base64url"
  },
  "idempotency_key": "uuid"
}

202 Accepted
{
  "status": "verification_required",
  "message": "Check your email to continue."
}
```

```json
POST /api/haro/v1/account/login
{
  "username": "ridho",
  "password": "correct horse battery staple",
  "device": {
    "id": "installation-uuid",
    "name": "Ridho's Mac",
    "platform": "macos",
    "session_signing_public_key": "base64url"
  },
  "handoff_public_key": "base64url",
  "client_nonce": "base64url"
}

200 OK
{
  "account": {
    "id": "uuid",
    "username": "ridho",
    "email": "user@example.com",
    "nostr_pubkey": "64-char-lowercase-hex"
  },
  "access_token": "opaque-short-lived-secret",
  "refresh_token": "opaque-rotating-secret",
  "session": {
    "id": "uuid",
    "access_expires_at": "RFC3339",
    "refresh_expires_at": "RFC3339"
  },
  "identity_bundle": {
    "suite": "X25519-HKDF-SHA256/HKDF-SHA256/ChaCha20Poly1305",
    "enc": "base64url",
    "ciphertext": "base64url",
    "server_nonce": "base64url"
  }
}
```

Credential errors return one stable `401 invalid_credentials` envelope. Public
registration may return a generic verification response for an already-known
email, while authenticated account-management endpoints may report precise
conflicts to the account owner.

Session policy:

- Access token lifetime: 15 minutes; opaque and stored only in the native client
  process memory.
- Refresh token idle lifetime: 7 days.
- Refresh token absolute lifetime: 30 days.
- Every refresh rotates the token in one transaction and records the previous
  token hash as consumed.
- Reuse of a consumed refresh token revokes its complete token family.
- Password reset revokes every session. Password change revokes every session
  except the freshly reauthenticated current session.
- Identity export, email change, password change, logout-all, migration, and
  key rotation require authentication no older than 10 minutes.
- Device/session inventory exposes creation, last use, approximate location,
  and revocation without exposing tokens.

Default online-abuse controls, configurable only upward in production, are:

- Login: 5 failed attempts per normalized account and 20 per IP per 15 minutes,
  followed by exponential cooldown rather than permanent account lockout.
- Registration: 5 per IP per hour and one pending account per normalized email.
- Forgot password: 3 per normalized account and 10 per IP per hour.
- Verification resend: one per account per 60 seconds and 5 per day.
- Reset verification: 5 invalid tokens per IP per hour.

Rate-limit storage is shared through Redis so limits do not reset when traffic
moves between relay pods. Database constraints remain the final authority for
uniqueness and one-time token consumption.

Access tokens are opaque and held only in native client process memory. Refresh
tokens are opaque, stored only as hashes on the server, rotated on use, and kept
in platform secure storage/OS keyring. A replayed refresh token revokes the
token family.

Account endpoints have request-size limits, per-IP and per-account rate limits,
generic credential errors, structured audit events, and no permissive dev
fallback in production builds.

Authentication requests require HTTPS outside explicit loopback development.
The public origin is derived from trusted deployment configuration, not
forwarded headers supplied by arbitrary clients. Reset and verification links
use an allowlisted Haro HTTPS origin and may hand off to `haro://` only after
the browser validates the token-bearing route.

Account routes are mounted only when the normalized request authority exactly
matches `HARO_ACCOUNT_AUTHORITY`. Community, admin, and unknown authorities
cannot reach them. The account authority never serves the Nostr WebSocket or
community data bridge, preventing an account token from becoming an alternate
tenant selector.

## Legacy User Migration

On first Haro launch, Tauri checks identity sources in this order:

1. The new `haro-desktop` keyring service.
2. The legacy `buzz-desktop` keyring service.
3. Existing supported legacy identity-file migration paths.

When a legacy identity is found without a Haro account, the user must provide a
username, email, and password. Tauri signs a server challenge with the legacy
key and seals the identity to the challenge-bound ingest key. The server verifies
the signature and key match, confirms that the public key is not already bound
to another account, and records a pending verified migration. The account and
identity binding become active only after the email-verification token is
consumed.

Registration and migration verification flow is explicit:

1. Tauri submits username, email, password, and device metadata.
2. The server creates a pending record and asks Kurir to deliver verification.
3. The HTTPS verification page validates the token shape and hands it to the
   installed app through `haro://verify-email`; it never exposes account state.
4. Tauri generates a fresh handoff key and calls the verification/completion
   endpoint with the token.
5. New registration generates the Nostr identity at this point. Legacy
   migration activates the already-proven identity.
6. The server commits account activation, token consumption, identity storage,
   first session, and audit row with single-winner semantics.
7. Tauri opens the sealed identity, verifies its public key, stores secrets,
   completes NIP-42, and only then marks onboarding complete.

The legacy keyring value is not deleted until the server commit succeeds, the
returned public key matches the local public key, and a login plus NIP-42 probe
succeeds. Interrupted migrations are idempotent. A retry either completes the
same account binding or reports a recoverable already-migrated state without
creating another identity.

Migration conflict behavior is explicit:

- Existing account plus matching public key: resume and verify the same
  migration.
- Existing account plus different public key: reject without modifying either
  identity.
- Existing public key bound to another account: require account recovery; do
  not allow rebinding from a second registration.
- Legacy key unavailable but migration marker present: show recovery and never
  generate a replacement identity.
- Server commit succeeded but desktop crashed before local confirmation: the
  next launch logs into the bound account and verifies the returned public key
  before marking migration complete.
- KMS or database unavailable: preserve all legacy local material and return a
  retryable failure.

Because the public key does not change, existing events, profiles, channels,
memberships, ownership, direct messages, agents, workflows, git repositories,
and audit attribution remain attached to the same user.

## Realtime Transport

`SimpleSocket` is a typed Haro facade, not a generic `{type, payload}` socket.
Its internal connection state is:

```text
disconnected -> connecting -> authenticating -> connected
                         \-> failed
```

Behavior:

- Parse relay arrays such as `AUTH`, `EVENT`, `EOSE`, `OK`, `CLOSED`, and
  `NOTICE`.
- Respond to the NIP-42 challenge within the relay's five-second deadline using
  the existing Tauri signing boundary.
- Report `connected` only after authentication succeeds.
- Send typed Nostr `REQ`, `CLOSE`, `COUNT`, and `EVENT` frames.
- Resolve event writes only after a matching positive `OK`; propagate relay
  rejection, timeout, or disconnect as an error.
- Track active subscriptions by stable logical ID and replay them after an
  authenticated reconnect.
- Deduplicate replayed realtime events by event ID and subscription delivery
  key.
- Use bounded exponential backoff with jitter. A successful TCP/WebSocket open
  does not reset the retry budget; authenticated stability does.
- Never reconnect after an explicit logout, community switch teardown, or
  application shutdown.
- Cancel and reject pending requests when the generation changes.
- Bind the socket URL to the active community rather than a module-level
  hardcoded address.
- Validate the relay URL scheme, authority, and configured host before opening
  a socket. Production rejects plaintext `ws://` except loopback development.
- Enforce the relay-advertised and local maximum frame sizes before parsing.
- Bound subscriptions, pending acknowledgements, buffered events, and handler
  work so a malicious relay or stalled UI cannot create unbounded memory use.
- Treat malformed frames as protocol errors with bounded diagnostics that do
  not include full event content.
- Correlate `OK` by event ID, `EOSE`/`CLOSED` by subscription ID, and `COUNT` by
  request ID; unsolicited responses cannot resolve unrelated operations.
- Preserve event order within a subscription while allowing independent
  subscriptions to progress without head-of-line blocking.
- Use browser/Tauri WebSocket ping behavior plus application liveness deadlines
  consistent with the relay heartbeat. Liveness loss changes generation and
  rejects all pending operations.

UI consumers use typed domain events produced by an explicit event-kind mapper.
Unknown kinds remain available as typed raw events but never masquerade as a
known domain event.

The facade is split by responsibility:

- `HaroSocketTransport`: connection lifecycle and raw frame I/O.
- `NostrProtocolSession`: NIP-42, request correlation, and subscription replay.
- `HaroEventMapper`: Nostr event-to-domain mapping.
- `HaroClient`: domain methods consumed by features.

`SimpleSocket` is the exported singleton/facade name during migration, but does
not own signing, persistence, domain conversion, and reconnect policy in one
unbounded class.

## Data and Media Operations

The incomplete `/api/chat`, `/api/reminders`, `/read-state`, `/profile`, and
`/api/upload/presigned-url` shims are removed.

- Chat, threads, reactions, profiles, reminders, preferences, presence,
  typing, agents, workflows, moderation, and git operations use existing Nostr
  event kinds and relay authorization.
- Historical reads use authenticated Nostr HTTP `/query` or WebSocket `REQ`
  according to the existing client pattern.
- Event writes use authenticated HTTP `/events` or `SimpleSocket` `EVENT` and
  wait for relay acknowledgement.
- Media uses the relay's Blossom-compatible `PUT /upload` and
  `GET|HEAD /media/{sha256_ext}` endpoints with the existing Nostr upload auth.
- The UI receives Haro domain types and does not expose protocol terminology.

### Functionality Preservation Matrix

The migration inventory maps every existing product domain to one authoritative
transport. A feature cannot move to Haro-complete status until its listed read,
write, realtime, rejection, and community-switch tests pass.

| Domain | Authoritative path after migration | Required behavior |
| --- | --- | --- |
| Account/session | Haro account HTTPS authority through Tauri | Register, verify, login, refresh, device login, revoke, logout, recovery |
| Community discovery | Account `/me/communities` plus existing operator/invite HTTP surfaces | Only memberships for the stable pubkey; no cross-account enumeration |
| Community/channel metadata | Existing Nostr kinds and host-bound relay | Create, edit, archive, membership changes, templates, visibility |
| Stream chat and threads | Nostr message/edit/deletion kinds over query/REQ/EVENT | Pagination, replies, counters, edits, deletes, realtime, deduplication |
| Forum/projects | Existing forum/project event kinds | Roots, comments, votes, status, threading, search, realtime |
| Reactions and emoji | NIP-25 and existing emoji list/set kinds | Add/remove acknowledgement, custom emoji union, legacy `d`-tag reads |
| Profile/status/social | Kind 0 and existing status/contact/list kinds | Profile update, avatar, presence-independent status, follows/bookmarks |
| Read state/sidebar preferences | Existing encrypted/replaceable preference events | Cross-device sync, conflict resolution, mutes, stars, sort, sections |
| Presence/typing | Authenticated ephemeral WebSocket events and Redis presence | No persistence, reconnect state, offline transition, rate limits |
| Direct messages | Existing NIP-17 gift-wrap path | Recipient privacy, history, realtime, membership/visibility gates |
| Reminders | Existing encrypted author-only reminder kind | Create, update, complete, cancel, due scheduling, cross-device visibility |
| Search | NIP-50 through authenticated `/query` | Kind-scoped filters, community/auth gates, no private-result leakage |
| Agents/personas/memory | Existing agent/profile/persona/team/engram kinds and ACP runtime | Ownership, encrypted memory, lifecycle, observer, drafts, usage |
| Workflows | Existing definition/trigger/execution kinds and webhook HTTP surface | Conditions, approvals, loop prevention, relay-signed outputs |
| Huddle | Dedicated authenticated audio WebSocket plus huddle event kinds | Join/leave, media, reconnect, TTS/STT, community isolation |
| Media | Blossom upload/get/head and authenticated media proxy | Hash verification, image/video limits, redirects, clipboard/download |
| Git/projects | Existing smart HTTP, policy hooks, NIP-34 events, credentials/signing | Clone/fetch/push, branch/PR/issue state, auth, no fork regression |
| Moderation/reporting | Existing moderation command kinds and authenticated read endpoints | Report, ban, timeout, resolve, audit, immediate connection eviction |
| Notifications/push | Existing notification and push-lease paths | Subscription, delivery privacy, badge/read interaction, revocation |
| Pairing/deep links | NIP-AB plus versioned Haro/legacy deep-link parsers | Device pairing, invite, message link, identity bind, scheme migration |

No domain may silently fall back to a local-only store when a remote write
fails. Optimistic UI state must retain the pending/rejected distinction and
reconcile only against relay acknowledgement or authoritative history.

### Current Partial-Migration Defects

The implementation starts by converting these known failures into regression
tests:

- `SimpleSocket` parses an invented object protocol, ignores NIP-42, resets its
  retry counter on unauthenticated open, reconnects after explicit disconnect,
  and returns fabricated publish success.
- Chat and reminder modules call localhost JSON endpoints the relay does not
  expose.
- Profile/read-state writes include no-op success paths.
- Media upload targets a presigned-URL endpoint absent from the relay instead
  of the established Blossom surface.
- Relay and API URLs are hardcoded inconsistently across frontend and Tauri.
- Login stores a fake token in local storage and treats network/auth failure as
  a successful demo account.
- The new Haro keyring service does not yet perform a verified cross-service
  adoption from the release `buzz-desktop` service.
- Desktop typecheck currently fails in top chrome, reminders, and sidebar sync
  managers because the partial refactor removed symbols/contracts incompletely.

The baseline plan removes every fake/no-op success before any account feature is
enabled. Existing passing unit tests are insufficient until each defect has a
test that fails for the current broken behavior.

## Kurir Recovery Integration

Only the Haro backend calls Kurir. Configuration includes the Kurir base URL,
an API key scoped to `emails:write`, and the Haro product ID.

The backend submits `POST /v1/emails` with:

- `Authorization: Bearer <api-key>`
- `Idempotency-Key: haro-password-reset:<reset-request-id>`
- `productId`, recipient email, subject, and HTML reset link

Reset tokens are high-entropy random values. Only their hash is stored. They
contain at least 256 bits of entropy, expire after 30 minutes, are single-use,
are superseded by a newer reset request after its email is accepted, and are
never written to logs. Kurir failures are recorded and retried through a
bounded backend delivery job; the public forgot-password response remains
generic.

Email verification tokens follow the same storage and logging rules with a
24-hour expiry. Kurir suppression or permanent delivery failure is visible only
to authenticated support/admin tooling. Admin-assisted recovery requires a
separately authorized operator, explicit reason, audit entry, session
revocation, and user notification; it cannot replace or rebind the Nostr
identity.

The Kurir contract is pinned in Haro contract tests to the current endpoint:

```json
POST /v1/emails
Authorization: Bearer <emails:write API key>
Idempotency-Key: haro-password-reset:<request-id>
{
  "productId": "configured-haro-product-id",
  "to": "user@example.com",
  "subject": "Reset your Haro password",
  "html": "bounded sanitized HTML"
}
```

Haro treats Kurir `200` replay and `201` creation as accepted. `401`, `403`,
and payload errors are configuration/permanent failures; `429`, `5xx`, and
network failures enter exponential retry with a finite attempt cap and an
operator-visible dead-letter state.

## Haro Naming Convention

New names use Haro consistently:

- Rust crates and packages: `haro-*`
- Executables: `haro`, `haro-relay`, and related Haro names
- Environment variables: `HARO_*`
- Metrics: `haro_*`
- Keyring services and storage keys: `haro-*` / `haro_*`
- Deep links: `haro://`
- UI, bundle metadata, logs, CSS/data attributes, and test fixture names: Haro

Compatibility rules:

- Legacy `BUZZ_*` variables are read only when the corresponding `HARO_*`
  variable is absent and emit a deprecation warning without secret values.
- Legacy keyring services, storage keys, database identifiers, and `buzz://`
  deep links have explicit read/migration paths.
- New writes use only Haro names.
- Historical signed events, established event tags required for verification,
  and already-applied SQL migration filenames are not rewritten.
- Database table renames use additive migrations or compatibility views so a
  rolling deployment never runs binaries against a missing table.
- Cargo package renames include dependency, workspace, release, Docker, Helm,
  CI, script, and documentation updates in the same staged rollout.
- Compatibility readers are inventory-listed and carry a documented removal
  release; they are not scattered ad hoc through feature code.

Not every `buzz` string can switch with the same mechanism. The migration
inventory classifies each occurrence:

| Surface | Haro write behavior | Legacy compatibility behavior |
| --- | --- | --- |
| Cargo packages/binaries | Rename to `haro-*`/`haro` in one workspace change | Release scripts accept old artifact names for the documented transition only |
| Environment variables | Write/document `HARO_*` | Central config helper falls back to `BUZZ_*` with redacted warning |
| Metrics | Emit `haro_*` | Dashboards query both names during one observation window; do not double-count in one binary |
| Redis cache keys | Write Haro keys after cutover | Dual-read while old TTL-bound keys can exist |
| Redis pub/sub/control channels | Haro channel is canonical | Mixed-version window dual-publishes with event-ID deduplication |
| OS keyring | Write `haro-desktop` | Transactionally copy from `buzz-desktop`, retain legacy until verified |
| Local/session storage | Write Haro versioned keys | One migration registry reads and removes legacy keys after validation |
| Deep links | Desktop generates `haro://` | Desktop registers and parses both schemes during transition; mobile remains on its existing scheme in this rollout |
| Signed event tags and `d` tags | New semantic versions use Haro tags | Readers accept historical Buzz forms; signed history is never rewritten |
| SQL migrations | New files and comments use Haro | Applied filenames and historical schema records remain immutable |
| Bundle/application ID | Product name changes to Haro | Existing bundle ID remains for in-place upgrade until a separately tested installer/keychain migration exists |
| HTTP routes | New account routes use `/api/haro/v1` | Existing protocol routes remain stable; no broad route rename |
| Source repository/package registry | Publish and document Haro names | Keep old repository/package locations as redirects or deprecation stubs for the transition |

The current repository contains hundreds of `BUZZ_*` references and dozens of
package/deep-link/protocol occurrences. Rename work therefore uses generated
inventory tests and staged categories, never an unreviewed global replacement.

Protocol-specific legacy names require special handling:

- `buzz:workflow`: new relay-signed workflow events may use a versioned Haro
  marker, while loop-prevention recognizes both forever or until all retained
  historical events age out.
- `buzz:custom-emoji`: addressable-event `d` tags are part of event identity.
  Haro reads both sets and publishes a migration event rather than mutating old
  events.
- `buzz:nostr-identity`: identity-binding audience/protocol values are versioned;
  callbacks validate both versions under separate exact parsers.
- Redis `buzz:{community}:...` channels: mixed pods dual-publish and consumers
  deduplicate using community plus event ID before Haro-only cutover.

The Tauri bundle identifier is intentionally not renamed in the first desktop
release. Changing it immediately would create a separate installed application
and can sever OS keyring, storage, notification, updater, and signing continuity.
Product name, icons, executable display name, and visible copy become Haro while
the identifier remains a documented legacy compatibility identifier until an
installer-level migration is independently proven.

## Community Switching

Account identity is deployment-wide; relay data is community-scoped. Switching
a community performs an ordered transition:

1. Stop new UI writes.
2. Close subscriptions and reject pending transport operations.
3. Disconnect the old `SimpleSocket` without scheduling reconnect.
4. Reset every existing community-scoped singleton and query cache.
5. Apply the new relay URL and community configuration to Tauri.
6. Authenticate a new socket with the same account identity.
7. Restore the destination route and allow writes only after readiness.

No connection, cache, media origin, membership result, or pending event from
the previous community may survive the boundary.

## Error Handling

- Authentication failures are explicit and never become demo sessions.
- Network errors are distinguishable from invalid credentials and relay
  authorization failures.
- Account and transport operations have bounded timeouts and cancellation.
- Sensitive values are excluded from logs, metrics labels, URLs, and Tauri
  error strings.
- Registration and migration use database transactions and idempotency keys.
- Kurir outage does not reveal account existence and does not create multiple
  valid reset tokens for one request.
- An inaccessible OS keyring blocks signing rather than generating an identity
  that would split account history.
- Database, Redis, KMS, and Kurir failures have distinct internal error classes
  but bounded public envelopes. Retriable classification is explicit rather
  than inferred from error text.
- Account transactions use database time for expiry and consumption decisions
  to avoid cross-pod clock disagreement.
- Reset and verification endpoints consume tokens with one conditional update;
  concurrent requests cannot both succeed.
- Audit failure on a security-sensitive mutation fails the mutation unless the
  audit row is written in the same transaction.

## Observability and Operations

- Metrics cover account request outcomes, Argon2 saturation, KMS latency and
  errors, active/revoked sessions, reset delivery state, NIP-42 duration,
  socket reconnect cause, subscription replay, and prefix compatibility reads.
- Metrics never label username, email, public key, event ID, token, IP address,
  or community UUID where cardinality or privacy would be unsafe.
- Structured logs use account/session request IDs and redacted stable error
  codes. Security audit rows retain actor, action, target account, device,
  coarse network metadata, and outcome under a documented retention policy.
- Alerts cover KMS decrypt failure, authentication error-rate spikes, refresh
  replay, Kurir dead letters, migration conflicts, NIP-42 timeout spikes, and
  use of legacy compatibility readers after the expected cutover window.
- Readiness fails for account endpoints when required database/KMS dependencies
  are unavailable, without unnecessarily taking the established Nostr data
  plane offline when account functionality is feature-gated.

## Privacy and Lifecycle

- Account email and device metadata are personal data with explicit retention
  and deletion rules.
- Account deletion first revokes sessions and disables login. Destructive data
  erasure is asynchronous and must respect signed-event retention, audit, legal,
  and community ownership rules.
- Deleting account credentials does not silently delete historical signed
  events or transfer community ownership.
- Recovery and verification email HTML contains no private key, session token,
  community membership detail, or sensitive profile data.
- Backup, restore, and disaster-recovery tests prove encrypted identities remain
  decryptable with the documented KMS recovery procedure and key versions.

## Verification Strategy

### Unit and Contract Tests

- Argon2id policy parsing, verification, and rehash decisions.
- Envelope encryption round-trip, tamper rejection, and key-version rotation.
- Session rotation, replay detection, expiry, and revocation.
- Canonical device-proof transcripts for NIP-42, NIP-98, Blossom, huddle, and
  git; reject wrong authority, method, body hash, challenge, nonce, timestamp,
  session, public key, proof version, and signature.
- Generic login and recovery error behavior.
- Kurir request authentication, payload, idempotency, retry, and redaction.
- Nostr frame parsing, NIP-42 handshake, event acknowledgement, rejection,
  reconnect backoff, subscription replay, explicit disconnect, and generation
  cancellation.
- Legacy Haro/Buzz configuration and keyring precedence.
- Domain event mapping for every functionality migrated to `SimpleSocket`.

### Integration Tests

- Register, login, refresh, logout, logout-all, change password, forgot/reset,
  and device-two login against Postgres and Redis.
- Migrate a real legacy key, prove unchanged pubkey, then read and write events
  created before migration.
- Connect through NIP-42, query history, receive realtime events, reconnect,
  and prove no duplicate delivery.
- Prove an account-bound key is rejected without a device proof, with a proof
  from another session/account/authority, and after revoke, logout-all, reset,
  disable, or expiry. Verify Redis control closes matching live connections on
  every relay pod while leaving unrelated sessions connected.
- Run the same device-proof conformance fixtures through Desktop/Tauri and CLI
  implementations and require byte-identical canonical transcripts.
- Switch between two communities and prove cache and subscription isolation.
- Upload, fetch, and authorize media through Blossom endpoints.
- Verify Kurir success, suppression, rate-limit, transient failure, and
  idempotent replay behavior with a contract-compatible test server.

### End-to-End Tests

- New user registration through first message and media upload.
- Existing Buzz user migration with unchanged profile, channels, messages, and
  ownership.
- Login on a second device with username/password.
- Enroll, use, list, and revoke sessions independently from Desktop and CLI;
  verify a generic Nostr client holding the exported private key is
  rejected by Haro after account binding.
- Forgot-password email, password reset, old-session revocation, and login with
  the new password while retaining historical data.
- Reconnect during active chat and community switching.
- Representative chat, thread, reaction, profile, reminder, preference,
  presence, typing, huddle, agent, workflow, git, moderation, and media flows.

The completion gate includes Rust formatting and clippy, desktop formatting and
typecheck, Rust and desktop unit tests, Tauri tests, CLI tests, relay integration
tests, Playwright desktop E2E, migration tests, and the repository's full
`just ci`. No mobile source or generated mobile platform file is modified.

Security verification additionally includes:

- Known-answer and tamper tests for envelope/HPKE usage through the selected
  libraries rather than reimplementing primitives.
- A secret-canary scan over logs, Tauri errors, HTTP traces, crash reports, and
  test artifacts.
- Concurrent refresh/reset/migration tests proving single-winner semantics.
- Mixed-version relay tests proving dual-publish deduplication and no lost
  fan-out during prefix cutover.
- Downgrade tests proving an older client cannot overwrite a completed Haro
  migration or create a second identity.
- Backup/restore and KMS key-rotation drills using encrypted fixture identities.
- Dependency audit and license review for Argon2, zeroization, HPKE, and KMS
  client libraries.

The security choices align with the current OWASP password-storage,
forgot-password, and session-management guidance, NIST SP 800-63B, AWS KMS
envelope-encryption guidance, and the canonical Nostr NIP-01/NIP-42 protocol
documents. Exact library choices and parameters are pinned in the implementation
plan and dependency lockfiles.

## Rollout

1. Establish green baseline and repair the current partial migration without
   adding account behavior.
2. Replace the incomplete socket, remove fake success paths, and restore every
   domain operation through Nostr and Blossom.
3. Introduce Haro naming aliases and migration inventory without removing any
   compatibility reader.
4. Add account storage, encryption, API, device-proof verification, Redis
   revocation control, and Kurir client behind a disabled
   feature/config gate.
5. Add the Desktop/Tauri account, device key, keyring, and legacy identity
   migration boundary.
6. Add the CLI keyring account client and shared Rust device-proof crate.
7. Pass Desktop/CLI conformance, compatibility, revocation, and end-to-end suites
   against legacy and fresh data.
8. Enable account registration and migration per capable client class for a
   canary deployment, then expand cohorts only while recovery remains healthy.
9. Complete crate, binary, deployment, and user-visible Haro rename.
10. Remove obsolete Buzz write paths after compatibility telemetry confirms no
    remaining writers; retain documented legacy readers until their scheduled
    removal release.

Each stage must be deployable and reversible without corrupting identity or
event history. Schema changes are additive before code switches readers or
writers, allowing rolling relay deployments.

## Implementation Decomposition

This design is too large for one safe implementation plan. It is executed as
six independently reviewable plans in this order:

1. **Baseline and typed transport:** restore a green desktop baseline, implement
   authenticated `SimpleSocket`, and remove fake acknowledgements without
   changing account behavior.
2. **Domain and media migration:** move every incomplete JSON/REST shim to the
   existing Nostr and Blossom paths with feature-level regression tests.
3. **Account and recovery service:** add database schema, Argon2, custodial
   envelope encryption, HPKE handoff, sessions, account APIs, audit, and Kurir
   integration behind a disabled gate.
4. **Desktop account and legacy identity migration:** add Tauri-held secret
   handling, registration/login/recovery UI, cross-device enrollment, and
   crash-safe `buzz-desktop` to `haro-desktop` migration.
5. **CLI account client:** add OS-keyring storage, shared Rust device-proof
   canonicalization, account commands, session management, recovery, and
   Desktop/CLI conformance tests. Mobile is explicitly untouched.
6. **Haro convention and cutover:** rename crates, binaries, configuration,
   metrics, storage, deep links, deployment artifacts, and documentation using
   the compatibility matrix, then run mixed-version and full end-to-end gates.

Each plan begins with failing tests for its own behavior, reaches a green
deployable state, and has a rollback boundary. Account rollout cannot begin
until the transport and domain plans are green or before both supported client
classes pass proof and recovery conformance. Haro-only prefix cutover
cannot begin until mixed-version compatibility tests pass.

## Security References

- OWASP Password Storage Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- OWASP Forgot Password Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- OWASP Session Management Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- NIST SP 800-63B:
  <https://pages.nist.gov/800-63-4/sp800-63b.html>
- AWS KMS data keys and envelope encryption:
  <https://docs.aws.amazon.com/kms/latest/developerguide/data-keys.html>
- Nostr NIPs, including NIP-01 and NIP-42:
  <https://github.com/nostr-protocol/nips>
