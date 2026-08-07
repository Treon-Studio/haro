# Haro Convention and Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Haro the emitted product/package/binary/config/runtime convention across relay, Desktop, and CLI while preserving explicit readers for historical Buzz state and mixed-version deployment.

**Architecture:** A checked naming inventory classifies every Buzz occurrence as rename, compatibility reader, signed history, or excluded mobile. New binaries/config/storage/topics/tags emit Haro; rolling relay nodes dual-read or dual-publish only where one-sided switching would lose data, then remove compatibility writers after telemetry.

**Tech Stack:** Cargo workspace, Rust binaries, Tauri configuration/keyring/deep links, Redis, SQL migrations, GitHub workflows, shell/Node policy checks.

## Global Constraints

- Plans 01-05 and Desktop/CLI conformance must be green.
- Do not modify any path under `mobile/`.
- Do not rewrite historical events or existing SQL migration files.
- Do not change the Desktop bundle identifier in this rollout.
- New state writes only `HARO_*`, `haro:*`, `haro://`, `haro-desktop`, and Haro package/binary names.
- Legacy readers are centralized, observable, and allowlisted; no scattered fallback expressions.
- Redis connection-control/pubsub transitions dual-publish with event IDs and consumer deduplication during mixed-pod rollout.
- Managed-agent Buzz environment names remain accepted aliases until external deployment repos have switched.

---

### Task 1: Create an Executable Naming Inventory

**Files:**
- Create: `scripts/haro-naming-inventory.mjs`
- Create: `scripts/haro-legacy-allowlist.json`
- Create: `scripts/test-haro-naming-inventory.mjs`
- Modify: `justfile`
- Modify: `package.json`

**Interfaces:**
- Consumes: tracked files and exact Buzz token categories.
- Produces: `just haro-naming-check` and JSON report with `rename`, `compat-reader`, `signed-history`, `mobile-excluded` classifications.

- [ ] **Step 1: Add a failing fixture test**

```js
test("unclassified production Buzz writes fail", () => {
  const result = classify("desktop/src/example.ts", 'localStorage.setItem("buzz_new", value)');
  assert.deepEqual(result, { ok: false, token: "buzz_new", reason: "unclassified-write" });
});

test("mobile is excluded without being silently renamed", () => {
  const result = classify("mobile/lib/example.dart", "buzz_relay_url");
  assert.equal(result.classification, "mobile-excluded");
});
```

- [ ] **Step 2: Verify inventory command is absent**

Run: `node scripts/test-haro-naming-inventory.mjs`

Expected: FAIL because the inventory module does not exist.

- [ ] **Step 3: Implement token-aware classification**

Scan tracked text files for `Buzz`, `buzz`, `BUZZ`, and known bundle/domain variants. Classify by exact file/token/rationale entries; fail on expired allowlist entries and any new unclassified match. Do not mutate files.

```json
{
  "signed-history": [
    { "token": "buzz:workflow", "path": "crates/haro-workflow/**", "reason": "historical signed d tag" }
  ],
  "compat-reader": [
    { "token": "BUZZ_RELAY_URL", "path": "crates/**", "removeAfter": "external deployment cutover" }
  ],
  "mobile-excluded": [
    { "token": "buzz", "path": "mobile/**", "reason": "explicitly outside initial rollout" }
  ]
}
```

- [ ] **Step 4: Run inventory tests and capture baseline**

Run: `node scripts/test-haro-naming-inventory.mjs && node scripts/haro-naming-inventory.mjs --format summary`

Expected: tests pass and every current occurrence is classified; report includes counts for manifests, env/config, Redis, storage, deep links, signed tags, UI copy, docs, and excluded mobile.

- [ ] **Step 5: Commit inventory**

```bash
. ./bin/activate-hermit
git add scripts/haro-naming-inventory.mjs scripts/haro-legacy-allowlist.json scripts/test-haro-naming-inventory.mjs justfile package.json
git commit -m "chore: enforce Haro naming inventory"
```

### Task 2: Centralize Haro Configuration with Buzz Read Aliases

**Files:**
- Create: `crates/buzz-core/src/compat.rs`
- Modify: `crates/buzz-relay/src/config.rs`
- Modify: `crates/buzz-acp/src/config.rs`
- Modify: `crates/buzz-agent/src/config.rs`
- Modify: `crates/buzz-push-gateway/src/config.rs`
- Modify: `desktop/src-tauri/src/relay.rs`
- Modify: `desktop/scripts/build-release-config.mjs`
- Modify: `.env.example`
- Test: `crates/buzz-core/tests/config_compat.rs`

**Interfaces:**
- Consumes: Haro primary and Buzz legacy environment variables.
- Produces: `read_haro_env(primary, legacy)` with precedence/telemetry and no legacy writes.

- [ ] **Step 1: Add precedence tests**

```rust
#[test]
fn haro_value_wins_and_conflict_is_observable() {
    let env = TestEnv::from([("HARO_RELAY_URL", "wss://new"), ("BUZZ_RELAY_URL", "wss://old")]);
    let result = read_haro_env(&env, "HARO_RELAY_URL", "BUZZ_RELAY_URL");
    assert_eq!(result.value.as_deref(), Some("wss://new"));
    assert_eq!(result.source, ConfigSource::HaroConflict);
}
```

- [ ] **Step 2: Verify compatibility helper is absent**

Run: `cargo test -p buzz-core --test config_compat`

Expected: FAIL before package rename/helper creation.

- [ ] **Step 3: Implement one precedence rule**

Every config maps `HARO_*` primary to one `BUZZ_*` alias. If only legacy exists, read it and increment `haro_legacy_config_reads_total{key_class}` without logging values. If both differ, Haro wins and emits a conflict metric. New subprocess injection uses Haro names, adding Buzz aliases only for explicitly legacy managed-agent executables.

```rust
pub enum ConfigSource { Haro, HaroConflict, LegacyBuzz, Missing }
```

- [ ] **Step 4: Run config and naming checks**

Run: `cargo test -p buzz-core --test config_compat && just haro-naming-check`

Expected: PASS; direct production `std::env::var("BUZZ_` calls exist only inside the compatibility module/allowlist.

- [ ] **Step 5: Commit config cutover**

```bash
. ./bin/activate-hermit
git add crates/buzz-core/src/compat.rs crates/buzz-core/tests/config_compat.rs crates/buzz-relay/src/config.rs crates/buzz-acp/src/config.rs crates/buzz-agent/src/config.rs crates/buzz-push-gateway/src/config.rs desktop/src-tauri/src/relay.rs desktop/scripts/build-release-config.mjs .env.example scripts/haro-legacy-allowlist.json
git commit -m "feat: prefer Haro configuration names"
```

### Task 3: Rename Rust Packages, Libraries, and Primary Binaries

**Files:**
- Modify: `Cargo.toml`
- Modify: `Cargo.lock`
- Modify: every `crates/buzz-*/Cargo.toml`
- Rename: every `crates/buzz-*` directory to the corresponding `crates/haro-*` directory
- Modify: Rust import sites reported by `cargo check --workspace --all-targets`
- Create: `crates/haro-cli/src/bin/buzz.rs`
- Create: `crates/haro-relay/src/bin/buzz-relay.rs`

**Interfaces:**
- Consumes: exact one-to-one `buzz-* -> haro-*` and `buzz_* -> haro_*` package/library map.
- Produces: primary `haro`, `haro-relay`, `haro-admin`, `haro-agent`, `haro-dev-mcp`, `haro-push-gateway`, and `haro-pair` binaries plus time-bounded compatibility launchers.

- [ ] **Step 1: Add package metadata assertions**

```js
test("workspace package and target names emit Haro", () => {
  const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--no-deps", "--format-version", "1"]));
  for (const pkg of metadata.packages) {
    assert.equal(pkg.name.startsWith("buzz-"), false, pkg.name);
    for (const target of pkg.targets) {
      const compatibility = new Set(["buzz", "buzz-relay"]);
      assert.equal(target.name.startsWith("buzz") && !compatibility.has(target.name), false, target.name);
    }
  }
});
```

- [ ] **Step 2: Verify metadata test fails on current names**

Run: `node scripts/test-haro-naming-inventory.mjs --metadata`

Expected: FAIL listing Buzz packages and binaries.

- [ ] **Step 3: Apply the explicit package map**

Rename these packages and Rust library identifiers: `buzz-admin`, `buzz-acp`, `buzz-agent`, `buzz-audit`, `buzz-auth`, `buzz-cli`, `buzz-conformance`, `buzz-core`, `buzz-db`, `buzz-dev-mcp`, `buzz-media`, `buzz-pair-relay`, `buzz-pairing-cli`, `buzz-persona`, `buzz-pubsub`, `buzz-push-gateway`, `buzz-relay`, `buzz-relay-mesh`, `buzz-sdk`, `buzz-search`, `buzz-test-client`, `buzz-workflow`, and `buzz-ws-client`. Preserve `sprig`, `git-sign-nostr`, and `git-credential-nostr` names because they are independent protocol/tool names.

Primary CLI/relay targets become:

```toml
[[bin]]
name = "haro"
path = "src/main.rs"

[[bin]]
name = "buzz"
path = "src/bin/buzz.rs"
```

Compatibility binaries print one deprecation warning to stderr then call the Haro library entrypoint; they do not fork another process.

- [ ] **Step 4: Compile the complete workspace**

Run: `cargo fmt --all -- --check && cargo check --workspace --all-targets && cargo test --workspace --lib`

Expected: all pass; `cargo metadata` contains no primary Buzz package/library target and both `target/debug/haro --help` and compatibility `target/debug/buzz --help` work.

- [ ] **Step 5: Commit package rename**

```bash
. ./bin/activate-hermit
git add Cargo.toml Cargo.lock crates scripts/haro-legacy-allowlist.json
git commit -m "refactor: rename Rust packages and binaries to Haro"
```

### Task 4: Cut Over Redis, Metrics, and Signed New State

**Files:**
- Modify: `crates/haro-pubsub/src/topic.rs`
- Modify: `crates/haro-pubsub/src/publisher.rs`
- Modify: `crates/haro-pubsub/src/subscriber.rs`
- Modify: `crates/haro-pubsub/src/session_control.rs`
- Modify: `crates/haro-relay/src/metrics.rs`
- Modify: `crates/haro-workflow/src/lib.rs`
- Modify: `desktop/src/features/sidebar/lib/preferenceEventStore.ts`
- Modify: `desktop/src/features/custom-emoji/hooks.ts`
- Test: `crates/haro-pubsub/tests/mixed_prefix.rs`
- Test: `crates/haro-test-client/tests/e2e_prefix_compat.rs`

**Interfaces:**
- Consumes: legacy Redis topics/cache keys and signed Buzz `d`/tag values.
- Produces: Haro writes, dual-read/dual-publish mixed-version bridge, event-ID dedupe, and compatibility metrics.

- [ ] **Step 1: Add mixed-pod no-loss/no-duplicate tests**

```rust
#[tokio::test]
async fn old_and_new_subscribers_each_receive_one_event() -> anyhow::Result<()> {
    let fixture = PrefixFixture::mixed_nodes().await?;
    fixture.new_node.publish(event("same-id")).await?;
    assert_eq!(fixture.old_node.received("same-id").await?, 1);
    assert_eq!(fixture.new_node.received("same-id").await?, 1);
    Ok(())
}
```

- [ ] **Step 2: Verify Haro-only topic fails legacy consumer**

Run: `cargo test -p haro-pubsub --test mixed_prefix`

Expected: FAIL before dual-publish/dedupe implementation.

- [ ] **Step 3: Implement versioned compatibility bridge**

New nodes publish the same envelope/event ID to `haro:*:v1` and required `buzz:*` legacy topics during the compatibility window. Subscribers consume both and dedupe by community + event/control ID with bounded TTL. Cache reads try Haro then legacy and promote successful legacy reads; writes use Haro only unless mixed-node correctness specifically requires dual-write.

Signed historical `buzz:workflow`, `buzz:custom-emoji`, and `buzz:nostr-identity` values remain valid readers. New signed replaceable values emit versioned `haro:` identifiers; identity parsing dispatches by exact version rather than substring replacement.

- [ ] **Step 4: Run mixed-version tests**

Run: `cargo test -p haro-pubsub --test mixed_prefix && cargo test -p haro-test-client --test e2e_prefix_compat`

Expected: PASS for event fan-out, presence, typing, cache promotion, session revoke, duplicate suppression, and signed legacy reads.

- [ ] **Step 5: Commit runtime prefix cutover**

```bash
. ./bin/activate-hermit
git add crates/haro-pubsub crates/haro-relay/src/metrics.rs crates/haro-workflow/src/lib.rs desktop/src/features/sidebar/lib/preferenceEventStore.ts desktop/src/features/custom-emoji/hooks.ts scripts/haro-legacy-allowlist.json
git commit -m "feat: emit Haro runtime prefixes"
```

### Task 5: Complete Desktop Brand, Storage, and Deep-Link Migration

**Files:**
- Modify: `desktop/package.json`
- Modify: `desktop/index.html`
- Modify: `desktop/src-tauri/Cargo.toml`
- Modify: `desktop/src-tauri/tauri.conf.json`
- Modify: `desktop/src-tauri/src/app_state_keyring.rs`
- Modify: `desktop/src-tauri/src/deep_link.rs`
- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src/features/communities/communityStorage.ts`
- Modify: `desktop/src/shared/api/tauri.ts`
- Modify: `desktop/public/haro.svg`
- Test: `desktop/src/features/communities/communityStorage.test.mjs`
- Test: `desktop/tests/e2e/deep-link-invite.spec.ts`
- Test: `desktop/tests/e2e/account-legacy-migration.spec.ts`

**Interfaces:**
- Consumes: legacy keyring/storage/deep-link schemes.
- Produces: Haro product name/icon/new writes with verified legacy reads; unchanged bundle ID.

- [ ] **Step 1: Add precedence and dual-scheme tests**

```js
test("Haro community storage wins without deleting Buzz data", async () => {
  storage.setItem("buzz_communities", legacyJson);
  storage.setItem("haro_communities", haroJson);
  assert.deepEqual(loadCommunities(storage), parse(haroJson));
  assert.equal(storage.getItem("buzz_communities"), legacyJson);
});
```

- [ ] **Step 2: Verify current mixed naming fails**

Run: `pnpm --dir desktop test -- communityStorage && pnpm --dir desktop exec playwright test tests/e2e/deep-link-invite.spec.ts`

Expected: at least one Haro precedence/scheme case fails.

- [ ] **Step 3: Implement verified copy-forward**

Product title, icons, package/crate display names, custom media scheme, generated deep links, localStorage, and keyring writes use Haro. Readers use centralized `readHaroThenBuzz`; copy legacy secrets/state to Haro, read back and validate schema/pubkey, then mark migration complete. Parse both `haro://` and `buzz://`; generate only `haro://`. Register both schemes without changing bundle identifier.

```ts
export const STORAGE_KEYS = {
  communities: { primary: "haro_communities", legacy: "buzz_communities" },
  activeCommunity: { primary: "haro_active_community_id", legacy: "buzz_active_community_id" },
} as const;
```

- [ ] **Step 4: Run Desktop migration tests and screenshot**

Run: `pnpm --dir desktop typecheck && pnpm --dir desktop test && cargo test --manifest-path desktop/src-tauri/Cargo.toml app_state_keyring deep_link && pnpm --dir desktop exec playwright test tests/e2e/deep-link-invite.spec.ts tests/e2e/account-legacy-migration.spec.ts && just desktop-screenshot --name haro-home`

Expected: all tests pass; screenshot shows Haro branding; `tauri.conf.json` bundle identifier equals the pre-migration identifier.

- [ ] **Step 5: Commit Desktop cutover**

```bash
. ./bin/activate-hermit
git add desktop/package.json desktop/index.html desktop/src-tauri desktop/src/features/communities/communityStorage.ts desktop/src/features/communities/communityStorage.test.mjs desktop/src/shared/api/tauri.ts desktop/public/haro.svg desktop/tests/e2e/deep-link-invite.spec.ts desktop/tests/e2e/account-legacy-migration.spec.ts scripts/haro-legacy-allowlist.json
git commit -m "feat(desktop): complete Haro brand and storage migration"
```

### Task 6: Rename CLI Surface and Preserve Agent Compatibility

**Files:**
- Modify: `crates/haro-cli/src/lib.rs`
- Modify: `crates/haro-cli/src/main.rs`
- Modify: `crates/haro-cli/README.md`
- Modify: `crates/haro-cli/TESTING.md`
- Modify: `crates/haro-acp/src/config.rs`
- Modify: `crates/haro-dev-mcp/src/lib.rs`
- Modify: `desktop/src-tauri/src/managed_agents/env_vars.rs`
- Test: `crates/haro-cli/tests/naming_compat.rs`

**Interfaces:**
- Consumes: Haro primary flags/env and Buzz aliases.
- Produces: `haro` help/output/docs, `HARO_RELAY_URL`, `HARO_PRIVATE_KEY`, `HARO_AUTH_TAG`, and compatibility alias behavior.

- [ ] **Step 1: Add primary/legacy precedence tests**

```rust
#[test]
fn haro_help_and_env_are_primary() {
    let help = Cli::command().render_long_help().to_string();
    assert!(help.contains("Haro CLI"));
    assert!(help.contains("HARO_RELAY_URL"));
    assert!(!help.contains("Buzz CLI"));
}
```

- [ ] **Step 2: Verify old help fails**

Run: `cargo test -p haro-cli --test naming_compat`

Expected: FAIL while clap name/help and env declarations still emit Buzz.

- [ ] **Step 3: Switch primary CLI convention**

Flags override `HARO_*`, which overrides `BUZZ_*`. Managed agent launchers inject both sets during the external deployment transition, with identical values, and emit a metric when a subprocess consumes only legacy variables. Error categories/JSON shapes/exit codes remain unchanged.

- [ ] **Step 4: Run CLI compatibility suite**

Run: `cargo test -p haro-cli --test naming_compat && cargo test -p haro-cli && target/debug/haro --help && target/debug/buzz --help`

Expected: both binaries work; Haro output is primary and compatibility binary emits one deprecation line only.

- [ ] **Step 5: Commit CLI cutover**

```bash
. ./bin/activate-hermit
git add crates/haro-cli crates/haro-acp/src/config.rs crates/haro-dev-mcp/src/lib.rs desktop/src-tauri/src/managed_agents/env_vars.rs scripts/haro-legacy-allowlist.json
git commit -m "feat(cli): make Haro the primary convention"
```

### Task 7: Update Local Build, Release, and Documentation Contracts

**Files:**
- Modify: `justfile`
- Modify: `Dockerfile`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `ARCHITECTURE.md`
- Modify: `RELEASING.md`
- Modify: `AGENTS.md`
- Test: `scripts/test-release-ref-contract.sh`

**Interfaces:**
- Consumes: renamed local binaries/packages while mobile source remains unchanged.
- Produces: Haro relay/Desktop/CLI artifacts and explicit documentation of external repo compatibility requirements; mobile workflows and release scripts remain unchanged.

- [ ] **Step 1: Update release-contract assertions first**

Tests must assert relay image builds `haro-relay`, Desktop product is Haro, CLI artifact is `haro`, and compatibility artifacts are explicitly named.

- [ ] **Step 2: Verify old build contracts fail**

Run: `bash scripts/test-release-ref-contract.sh`

Expected: relay/Desktop/CLI Haro assertions fail before workflow updates.

- [ ] **Step 3: Update local automation and ecosystem docs**

Point local relay/Desktop/CLI build and release commands to Haro packages/binaries. Document required follow-up changes in `sprout-releases`, `sprout-oss`, `block-coder-tf-stacks`, and `sprout-backend-blox` without claiming those external repos changed. Do not edit mobile workflows or release scripts.

- [ ] **Step 4: Run automation tests**

Run: `bash scripts/test-release-ref-contract.sh && just haro-naming-check`

Expected: all pass and the naming inventory has no unclassified production occurrence.

- [ ] **Step 5: Commit automation/docs cutover**

```bash
. ./bin/activate-hermit
git add justfile Dockerfile .github/workflows/release.yml scripts/test-release-ref-contract.sh scripts/haro-naming-inventory.mjs scripts/haro-legacy-allowlist.json README.md CONTRIBUTING.md ARCHITECTURE.md RELEASING.md AGENTS.md
git commit -m "docs: update Haro build and release contracts"
```

### Task 8: Mixed-Version Canary and Final Gate

**Files:**
- Create: `crates/haro-test-client/tests/e2e_haro_cutover.rs`
- Modify: `scripts/haro-legacy-allowlist.json`
- Modify: `docs/superpowers/plans/2026-07-30-haro-06-convention-and-cutover.md`

**Interfaces:**
- Consumes: Tasks 1-7 and two-version relay/Desktop/CLI fixtures.
- Produces: evidence for canary enablement and a bounded legacy-reader removal list.

- [ ] **Step 1: Add full cutover E2E**

```rust
#[tokio::test]
async fn haro_clients_preserve_legacy_data_across_mixed_nodes() -> anyhow::Result<()> {
    let fixture = CutoverFixture::old_and_new_relays().await?;
    let account = fixture.migrate_legacy_user().await?;
    assert_eq!(account.pubkey(), fixture.legacy_pubkey());
    fixture.haro_desktop().send_and_receive_all_domains(&account).await?;
    fixture.haro_cli().read_and_write(&account).await?;
    fixture.assert_no_duplicate_fanout().await?;
    Ok(())
}
```

- [ ] **Step 2: Run mixed-version and full repository gates**

Run: `cargo test -p haro-test-client --test e2e_haro_cutover && just ci`

Expected: all pass, including Desktop/Tauri/CLI/account/Kurir/prefix compatibility tests.

- [ ] **Step 3: Verify naming policy**

Run: `node scripts/haro-naming-inventory.mjs --fail-on-unclassified --fail-on-new-writes`

Expected: exit 0. Remaining Buzz occurrences are only signed history, centralized compatibility readers, external migration documentation, compatibility launchers, or excluded `mobile/` paths.

- [ ] **Step 4: Record removal criteria**

For each compatibility writer, record its metric, zero-use observation window, minimum external version, owner, and removal release in the allowlist. Readers for signed history do not receive a removal date.

- [ ] **Step 5: Commit final evidence**

```bash
. ./bin/activate-hermit
git add crates/haro-test-client/tests/e2e_haro_cutover.rs scripts/haro-legacy-allowlist.json docs/superpowers/plans/2026-07-30-haro-06-convention-and-cutover.md
git commit -m "test: verify Haro mixed-version cutover"
```
