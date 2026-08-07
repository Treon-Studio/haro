import { realtimeSocketClient } from "./realtimeSocketClient.ts";
import { getIdentity } from "./tauriIdentity.ts";
import type { RelayEvent, UpdateProfileInput } from "./types.ts";
import type { RelaySubscriptionFilter } from "./relayClientShared.ts";
import type { TimelineMessage } from "../../features/messages/types.ts";
import { signRelayEvent } from "./tauri.ts";
import { KIND_REACTION, KIND_READ_STATE } from "../constants/kinds.ts";

export type SimpleChatMessage = TimelineMessage & {
  channelId?: string;
  content?: string;
  timestamp?: string;
  reply_count?: number;
  descendant_count?: number;
};

export interface ChatRelayPort {
  fetchEvents(filter: RelaySubscriptionFilter): Promise<RelayEvent[]>;
  sendMessage(
    channelId: string,
    content: string,
    mentions?: string[],
    tags?: string[][],
  ): Promise<any>;
  publishEvent(event: RelayEvent): Promise<any>;
}

export type ProfileRelay = Pick<ChatRelayPort, "fetchEvents" | "publishEvent">;

export function buildChannelHistoryFilter(
  channelId: string,
  limit = 50,
  before?: number,
): RelaySubscriptionFilter {
  return {
    kinds: [9, 40002, 40003, 40008],
    "#h": [channelId],
    ...(before ? { until: before } : {}),
    limit,
  };
}

function toTimelineMessage(event: RelayEvent): SimpleChatMessage | null {
  if (!event || typeof event.id !== "string") return null;

  const hTag = Array.isArray(event.tags)
    ? event.tags.find((t) => Array.isArray(t) && t[0] === "h")?.[1]
    : undefined;

  const isoTime = new Date(event.created_at * 1000).toISOString();

  return {
    id: event.id,
    author: event.pubkey,
    channelId: hTag,
    content: event.content || "",
    timestamp: isoTime,
    createdAt: event.created_at,
    time: isoTime,
    body: event.content || "",
    depth: 0,
    kind: event.kind,
    tags: event.tags,
  };
}

export async function fetchChannelMessages(
  channelId: string,
  limit = 50,
  before?: string,
  relay: ChatRelayPort = realtimeSocketClient,
): Promise<SimpleChatMessage[]> {
  const events = await relay.fetchEvents(
    buildChannelHistoryFilter(
      channelId,
      limit,
      before ? Number(before) : undefined,
    ),
  );
  return events
    .map(toTimelineMessage)
    .filter((v): v is SimpleChatMessage => v !== null);
}

export async function sendMessage(
  {
    channelId,
    content,
    replyToId,
    threadRootId,
    attachments,
  }: {
    channelId: string;
    content: string;
    replyToId?: string;
    threadRootId?: string;
    attachments?: any[];
  },
  relay: ChatRelayPort = realtimeSocketClient,
): Promise<SimpleChatMessage> {
  const extraTags: string[][] = [];
  if (threadRootId) {
    extraTags.push(["e", threadRootId, "", "root"]);
  }
  if (replyToId) {
    extraTags.push(["e", replyToId, "", "reply"]);
  }
  if (attachments && Array.isArray(attachments)) {
    for (const att of attachments) {
      if (Array.isArray(att)) extraTags.push(att);
    }
  }

  const result = await relay.sendMessage(channelId, content, [], extraTags);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Failed to send message");
  }

  const eventId = result?.id || result?.eventId || "e".repeat(64);
  const now = Math.floor(Date.now() / 1000);
  const isoTime = new Date(now * 1000).toISOString();
  return {
    id: eventId,
    author: "",
    channelId,
    content,
    timestamp: isoTime,
    createdAt: now,
    time: isoTime,
    body: content,
    depth: 0,
  };
}

export async function updateReadState(
  contextId: string,
  timestamp: number,
  relay: ChatRelayPort = realtimeSocketClient,
): Promise<void> {
  const signed = await signRelayEvent({
    kind: KIND_READ_STATE,
    content: JSON.stringify({ version: 1, timestamp }),
    tags: [["d", `haro:read-state:${contextId}`]],
  });

  const result = await relay.publishEvent(signed);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Failed to update read state");
  }
}

export async function updateUserProfile(
  input: UpdateProfileInput,
  relay: ProfileRelay = realtimeSocketClient,
): Promise<RelayEvent> {
  const { pubkey } = await getIdentity();
  const events = await relay.fetchEvents({
    kinds: [0],
    authors: [pubkey],
    limit: 1,
  });
  const latestContent = events[0]?.content;
  let existing: Record<string, unknown> = {};

  if (latestContent) {
    const parsed = JSON.parse(latestContent);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      existing = parsed as Record<string, unknown>;
    }
  }

  const merged = {
    ...existing,
    ...(input.displayName !== undefined && { display_name: input.displayName }),
    ...(input.avatarUrl !== undefined && { picture: input.avatarUrl }),
    ...(input.about !== undefined && { about: input.about }),
    ...(input.nip05Handle !== undefined && { nip05: input.nip05Handle }),
  };

  const createdAt = Math.max(
    Math.floor(Date.now() / 1_000),
    (events[0]?.created_at ?? 0) + 1,
  );

  const signed = await signRelayEvent({
    kind: 0,
    content: JSON.stringify(merged),
    createdAt,
    tags: [],
  });

  const result = await relay.publishEvent(signed);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Failed to update user profile");
  }

  return signed;
}

export async function addMessageReaction(
  {
    messageId,
    emoji,
  }: {
    messageId: string;
    emoji: string;
  },
  relay: ChatRelayPort = realtimeSocketClient,
): Promise<void> {
  const signed = await signRelayEvent({
    kind: KIND_REACTION,
    content: emoji,
    tags: [["e", messageId]],
  });

  const result = await relay.publishEvent(signed);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Failed to add reaction");
  }
}
