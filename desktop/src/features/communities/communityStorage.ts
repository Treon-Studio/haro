import type { Community } from "./types";
import { homeDir } from "@tauri-apps/api/path";
import { setLocalStorageItemWithRecovery } from "@/shared/lib/localStorageQuota";

const COMMUNITIES_KEY = "buzz-communities";
const ACTIVE_COMMUNITY_KEY = "buzz-active-community-id";
const LEGACY_WORKSPACES_KEY = "buzz-workspaces";
const LEGACY_ACTIVE_WORKSPACE_KEY = "buzz-active-workspace-id";

/**
 * Expand a leading `~` to the user's home directory. The backend rejects
 * `~`-prefixed paths (`std::fs` does not expand the shell tilde), so the UI
 * resolves it before save. Returns non-`~` input unchanged. Empty/whitespace
 * input returns `undefined` so callers can clear the override.
 */
export async function expandTilde(input: string): Promise<string | undefined> {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed === "~") {
    return homeDir();
  }
  if (trimmed.startsWith("~/")) {
    const home = await homeDir();
    const base = home.endsWith("/") ? home.slice(0, -1) : home;
    return `${base}/${trimmed.slice(2)}`;
  }
  return trimmed;
}

export function migrateLegacyCommunityStorage(
  storage: Storage = localStorage,
): void {
  if (storage.getItem(COMMUNITIES_KEY) === null) {
    const legacyCommunities =
      storage.getItem("haro-communities") ??
      storage.getItem(LEGACY_WORKSPACES_KEY);
    if (legacyCommunities !== null) {
      storage.setItem(COMMUNITIES_KEY, legacyCommunities);
    }
  }
  if (storage.getItem(ACTIVE_COMMUNITY_KEY) === null) {
    const legacyActiveCommunity =
      storage.getItem("haro-active-community-id") ??
      storage.getItem(LEGACY_ACTIVE_WORKSPACE_KEY);
    if (legacyActiveCommunity !== null) {
      storage.setItem(ACTIVE_COMMUNITY_KEY, legacyActiveCommunity);
    }
  }
}

function getDefaultRelayUrl(): string {
  return (
    import.meta.env.VITE_RELAY_URL ||
    import.meta.env.VITE_DEFAULT_RELAY_URL ||
    "ws://localhost:3000"
  );
}

export function loadCommunities(): Community[] {
  try {
    migrateLegacyCommunityStorage();
    const raw = localStorage.getItem(COMMUNITIES_KEY);
    let communities: Community[] = [];
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        communities = parsed as Community[];
        // If an env override exists and an existing default community is still pointing to localhost, update it.
        const defaultEnvUrl =
          import.meta.env.VITE_RELAY_URL ||
          import.meta.env.VITE_DEFAULT_RELAY_URL;
        if (defaultEnvUrl) {
          let updated = false;
          communities = communities.map((c) => {
            if (
              c.relayUrl === "ws://localhost:3000" ||
              c.relayUrl === "ws://127.0.0.1:3000"
            ) {
              updated = true;
              return { ...c, relayUrl: defaultEnvUrl };
            }
            return c;
          });
          if (updated) {
            saveCommunities(communities);
          }
        }
      }
    }

    if (communities.length === 0) {
      const defaultCommunity: Community = {
        id: "default-enterprise-community",
        name: "Haro Workspace",
        relayUrl: getDefaultRelayUrl(),
        addedAt: new Date().toISOString(),
      };
      communities = [defaultCommunity];
      saveCommunities(communities);
      saveActiveCommunityId(defaultCommunity.id);
    }

    return communities;
  } catch {
    const defaultCommunity: Community = {
      id: "default-enterprise-community",
      name: "Haro Workspace",
      relayUrl: getDefaultRelayUrl(),
      addedAt: new Date().toISOString(),
    };
    return [defaultCommunity];
  }
}

export function saveCommunities(communities: Community[]): boolean {
  return setLocalStorageItemWithRecovery(
    COMMUNITIES_KEY,
    JSON.stringify(communities),
  );
}

export function clearCommunityStorage(storage: Storage = localStorage): void {
  storage.removeItem(COMMUNITIES_KEY);
  storage.removeItem(ACTIVE_COMMUNITY_KEY);
  storage.removeItem(LEGACY_WORKSPACES_KEY);
  storage.removeItem(LEGACY_ACTIVE_WORKSPACE_KEY);
}

export function loadActiveCommunityId(): string | null {
  migrateLegacyCommunityStorage();
  const activeId = localStorage.getItem(ACTIVE_COMMUNITY_KEY);
  if (activeId) return activeId;
  const communities = loadCommunities();
  return communities[0]?.id ?? "default-enterprise-community";
}

export function saveActiveCommunityId(id: string): boolean {
  return setLocalStorageItemWithRecovery(ACTIVE_COMMUNITY_KEY, id);
}

export function normalizeRelayUrl(url: string): string {
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    return `wss://${url}`;
  }
  return url;
}

function isLocalRelayHost(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(hostname);
}

export function shouldAutoConnectDefaultRelay(relayUrl: string): boolean {
  try {
    const parsed = new URL(relayUrl);
    return (
      (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
      !isLocalRelayHost(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function deriveCommunityName(relayUrl: string): string {
  try {
    const url = new URL(
      relayUrl.replace("ws://", "http://").replace("wss://", "https://"),
    );
    const host = url.hostname;
    if (isLocalRelayHost(host)) {
      return "Local Dev";
    }
    const parts = host.split(".");
    // Detect staging environments (e.g. buzz-oss.stage.blox.sqprod.co)
    if (parts.some((p) => p === "stage" || p === "staging")) {
      return "Buzz (staging)";
    }
    // Use the first subdomain segment or the domain itself
    if (parts.length >= 2) {
      return parts[0] === "relay" ? parts[1] : parts[0];
    }
    return host;
  } catch {
    return "Community";
  }
}

export function initFirstCommunity(
  relayUrl: string,
  pubkey: string,
  name?: string,
): Community | null {
  const normalizedUrl = normalizeRelayUrl(relayUrl);
  const trimmedName = name?.trim();
  const community: Community = {
    id: crypto.randomUUID(),
    name: trimmedName || deriveCommunityName(normalizedUrl),
    relayUrl: normalizedUrl,
    // Compiled default relays must admit the first token-less connection; there
    // is no invite-token prompt on this auto-connect path.
    pubkey,
    addedAt: new Date().toISOString(),
  };
  const previousActiveCommunityId = localStorage.getItem(ACTIVE_COMMUNITY_KEY);
  const didSaveActiveCommunity = saveActiveCommunityId(community.id);
  if (!didSaveActiveCommunity) {
    return null;
  }

  if (!saveCommunities([community])) {
    // A failed setItem leaves the existing communities value untouched. Roll
    // back only the active-ID write so inconsistent pre-existing data is never
    // destroyed while recovering from a quota failure.
    try {
      if (previousActiveCommunityId === null) {
        localStorage.removeItem(ACTIVE_COMMUNITY_KEY);
      } else {
        localStorage.setItem(ACTIVE_COMMUNITY_KEY, previousActiveCommunityId);
      }
    } catch {
      // Best effort: persistence is already unavailable, and callers will stay
      // on setup instead of reloading.
    }
    return null;
  }

  return community;
}
