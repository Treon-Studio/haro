import { realtimeSocketClient } from "../../../shared/api/realtimeSocketClient.ts";
import type { RelaySubscriptionFilter } from "../../../shared/api/relayClientShared.ts";
import type { RelayEvent } from "../../../shared/api/types.ts";
import { signRelayEvent } from "../../../shared/api/tauri.ts";
import { KIND_CHANNEL_SECTIONS } from "../../../shared/constants/kinds.ts";

export type PreferenceType =
  | "channel-mutes"
  | "channel-sections"
  | "channel-sort"
  | "channel-stars";

export interface PreferenceRelayPort {
  fetchEvents(filter: RelaySubscriptionFilter): Promise<RelayEvent[]>;
  publishEvent(event: RelayEvent): Promise<any>;
}

export async function fetchPreference<T>(
  pubkey: string,
  type: PreferenceType,
  parse: (content: any) => T | null,
  relay: PreferenceRelayPort = realtimeSocketClient,
): Promise<T | null> {
  const events = await relay.fetchEvents({
    kinds: [KIND_CHANNEL_SECTIONS],
    authors: [pubkey],
    "#d": [`haro:${type}`, `buzz:${type}`],
    limit: 10,
  });

  const validEvents = events
    .filter((e) => e && typeof e.created_at === "number")
    .sort((a, b) => b.created_at - a.created_at);

  for (const event of validEvents) {
    try {
      const parsed = JSON.parse(event.content);
      const val = parse(parsed?.value ?? parsed);
      if (val !== null) return val;
    } catch {
      // invalid JSON content, keep checking older events
    }
  }

  return null;
}

export async function publishPreference<T>(
  type: PreferenceType,
  value: T,
  relay: PreferenceRelayPort = realtimeSocketClient,
): Promise<void> {
  const signed = await signRelayEvent({
    kind: KIND_CHANNEL_SECTIONS,
    content: JSON.stringify({ version: 1, value }),
    tags: [["d", `haro:${type}`]],
  });

  const result = await relay.publishEvent(signed);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || `Failed to sync ${type}`);
  }
}
