import { useCallback, useRef } from "react";

import { signRelayEvent } from "@/shared/api/tauri";
import { realtimeSocketClient as simpleSocket } from "@/shared/api/realtimeSocketClient";

const TYPING_SEND_INTERVAL_MS = 3_000;

/**
 * Broadcasts typing indicators for the current user via socket,
 * throttled to at most once every 3 seconds per channel.
 */
export function useTypingBroadcast(
  channelId: string | null | undefined,
  parentEventId?: string | null,
  _rootEventId?: string | null,
) {
  const lastSentRef = useRef(0);
  const lastChannelRef = useRef(channelId);
  const channelIdRef = useRef(channelId);
  const parentEventIdRef = useRef(parentEventId);
  channelIdRef.current = channelId;
  parentEventIdRef.current = parentEventId;

  const notifyTyping = useCallback(() => {
    const id = channelIdRef.current;
    if (!id) {
      return;
    }

    if (lastChannelRef.current !== id) {
      lastChannelRef.current = id;
      lastSentRef.current = 0;
    }

    const now = Date.now();
    if (now - lastSentRef.current < TYPING_SEND_INTERVAL_MS) {
      return;
    }

    lastSentRef.current = now;
    void (async () => {
      try {
        const extraTags: string[][] = [["h", id]];
        if (parentEventIdRef.current) {
          extraTags.push(["e", parentEventIdRef.current]);
        }
        const event = await signRelayEvent({
          kind: 20002,
          content: "",
          tags: extraTags,
        });
        const result = await simpleSocket.publishEvent(event);
        if ("accepted" in result && result.accepted === false) {
          throw new Error(result.message || "Relay rejected typing indicator.");
        }
      } catch (err) {
        console.error("Failed to broadcast typing indicator:", err);
      }
    })();
  }, []);

  return notifyTyping;
}
