import {
  nip44DecryptFromSelf,
  nip44EncryptToSelf,
  signRelayEvent,
} from "../../../shared/api/tauri.ts";
import type { RelayEvent } from "../../../shared/api/types.ts";
import { KIND_EVENT_REMINDER } from "../../../shared/constants/kinds.ts";
import { realtimeSocketClient } from "../../../shared/api/realtimeSocketClient.ts";
import type { RelaySubscriptionFilter } from "../../../shared/api/relayClientShared.ts";
import type {
  Reminder,
  ReminderContent,
  ReminderTarget,
} from "./reminderTypes";

// Jittered expiration for completed/cancelled reminders (30-90 days).
function jitteredExpiration(): number {
  const days = 30 + Math.floor(Math.random() * 60);
  return Math.floor(Date.now() / 1_000) + days * 86_400;
}
/**
 * Generate a reminder `d`-tag with 128 bits of entropy (NIP-ER line 58 MUST).
 * `crypto.randomUUID()` is UUIDv4 = only 122 random bits, so use 16 raw bytes.
 */
function randomDTag(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseNotBefore(value: string): number | undefined {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return undefined;
  const num = Number(value);
  if (!Number.isSafeInteger(num)) return undefined;
  return num;
}

function parseTarget(value: unknown): ReminderTarget | null {
  if (typeof value !== "object" || value === null) return null;
  const t = value as Record<string, unknown>;
  if (
    typeof t.eventId !== "string" ||
    typeof t.channelId !== "string" ||
    typeof t.preview !== "string" ||
    typeof t.authorPubkey !== "string"
  ) {
    return null;
  }
  return {
    eventId: t.eventId,
    channelId: t.channelId,
    preview: t.preview,
    authorPubkey: t.authorPubkey,
  };
}

export function parseReminderContent(
  plaintext: string,
): ReminderContent | null {
  let json: unknown;
  try {
    json = JSON.parse(plaintext);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const obj = json as Record<string, unknown>;

  const status = obj.status;
  if (status !== "pending" && status !== "done" && status !== "cancelled") {
    return null;
  }

  const target = obj.target !== undefined ? parseTarget(obj.target) : undefined;
  if (obj.target !== undefined && target === null) return null;

  if (obj.note !== undefined && typeof obj.note !== "string") return null;
  const note = typeof obj.note === "string" ? obj.note : undefined;
  if (note !== undefined && note.trim() === "" && target === undefined)
    return null;

  if (target === undefined && (note === undefined || note.trim() === ""))
    return null;

  return {
    status,
    target: target ?? undefined,
    note,
  };
}

export interface ReminderRelayPort {
  fetchEvents(filter: RelaySubscriptionFilter): Promise<RelayEvent[]>;
  publishEvent(
    event: RelayEvent,
  ): Promise<RelayEvent | { accepted: boolean; message?: string }>;
}

export type ReminderDecryptor = (ciphertext: string) => Promise<string>;

export async function fetchReminders(
  pubkey: string,
  relay: ReminderRelayPort = realtimeSocketClient,
  decrypt: ReminderDecryptor = nip44DecryptFromSelf,
): Promise<Reminder[]> {
  const events = await relay.fetchEvents({
    kinds: [KIND_EVENT_REMINDER],
    authors: [pubkey],
    limit: 500,
  });

  // Group only our events by d tag. A malicious relay response must not let a
  // foreign replacement shadow the caller's encrypted reminder.
  const byDTag = new Map<string, RelayEvent[]>();
  for (const event of events) {
    if (event.pubkey.toLowerCase() !== pubkey.toLowerCase()) continue;
    const dTag = Array.isArray(event.tags)
      ? event.tags.find((t) => Array.isArray(t) && t[0] === "d")?.[1]
      : undefined;
    if (!dTag) continue;

    const replacements = byDTag.get(dTag) ?? [];
    replacements.push(event);
    byDTag.set(dTag, replacements);
  }

  const reminders: Reminder[] = [];
  for (const [dTag, replacements] of byDTag.entries()) {
    const newestFirst = [...replacements].sort(
      (left, right) => right.created_at - left.created_at,
    );
    for (const event of newestFirst) {
      try {
        const decrypted = await decrypt(event.content);
        const parsedContent = parseReminderContent(decrypted);
        if (!parsedContent) continue;

        const notBeforeTag = Array.isArray(event.tags)
          ? event.tags.find(
              (t) => Array.isArray(t) && t[0] === "not_before",
            )?.[1]
          : undefined;
        const notBefore = notBeforeTag
          ? (parseNotBefore(notBeforeTag) ?? event.created_at)
          : event.created_at;

        reminders.push({
          id: dTag,
          eventId: event.id,
          createdAt: event.created_at,
          notBefore,
          content: parsedContent,
        });
        break;
      } catch {
        // Ignore malformed or undecryptable replacements and try an older one.
      }
    }
  }

  return reminders;
}

export async function createReminder(
  target: ReminderTarget,
  notBefore: number,
  note?: string,
  relay: ReminderRelayPort = realtimeSocketClient,
): Promise<RelayEvent> {
  const dTag = randomDTag();
  const content: ReminderContent = {
    target,
    note,
    status: "pending",
  };

  const ciphertext = await nip44EncryptToSelf(JSON.stringify(content));
  const tags: string[][] = [
    ["d", dTag],
    ["not_before", String(notBefore)],
  ];

  const event = await signRelayEvent({
    kind: KIND_EVENT_REMINDER,
    content: ciphertext,
    tags,
  });

  const result = await relay.publishEvent(event);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Relay rejected reminder update.");
  }
  return event;
}

export async function completeReminder(
  _pubkey: string,
  reminder: Reminder,
  relay: ReminderRelayPort = realtimeSocketClient,
): Promise<RelayEvent> {
  const content: ReminderContent = {
    ...reminder.content,
    status: "done",
  };

  const ciphertext = await nip44EncryptToSelf(JSON.stringify(content));
  const expiration = jitteredExpiration();
  const tags: string[][] = [
    ["d", reminder.id],
    ["expiration", String(expiration)],
  ];

  const event = await signRelayEvent({
    kind: KIND_EVENT_REMINDER,
    content: ciphertext,
    createdAt: Math.max(Math.floor(Date.now() / 1_000), reminder.createdAt + 1),
    tags,
  });

  const result = await relay.publishEvent(event);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Relay rejected reminder update.");
  }
  return event;
}

export async function snoozeReminder(
  _pubkey: string,
  reminder: Reminder,
  newNotBefore: number,
  relay: ReminderRelayPort = realtimeSocketClient,
): Promise<RelayEvent> {
  const content: ReminderContent = {
    ...reminder.content,
    status: "pending",
  };

  const ciphertext = await nip44EncryptToSelf(JSON.stringify(content));
  const tags: string[][] = [
    ["d", reminder.id],
    ["not_before", String(newNotBefore)],
  ];

  const event = await signRelayEvent({
    kind: KIND_EVENT_REMINDER,
    content: ciphertext,
    createdAt: Math.max(Math.floor(Date.now() / 1_000), reminder.createdAt + 1),
    tags,
  });

  const result = await relay.publishEvent(event);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Relay rejected reminder update.");
  }
  return event;
}

export async function cancelReminder(
  _pubkey: string,
  reminder: Reminder,
  relay: ReminderRelayPort = realtimeSocketClient,
): Promise<RelayEvent> {
  const content: ReminderContent = {
    ...reminder.content,
    status: "cancelled",
  };

  const ciphertext = await nip44EncryptToSelf(JSON.stringify(content));
  const expiration = jitteredExpiration();
  const tags: string[][] = [
    ["d", reminder.id],
    ["expiration", String(expiration)],
  ];

  const event = await signRelayEvent({
    kind: KIND_EVENT_REMINDER,
    content: ciphertext,
    createdAt: Math.max(Math.floor(Date.now() / 1_000), reminder.createdAt + 1),
    tags,
  });

  const result = await relay.publishEvent(event);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Relay rejected reminder update.");
  }
  return event;
}
