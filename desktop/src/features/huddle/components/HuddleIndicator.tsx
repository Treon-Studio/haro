import { listen } from "@tauri-apps/api/event";
import { Headphones } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { realtimeSocketClient as simpleSocket } from "@/shared/api/realtimeSocketClient";
import type { RelayEvent } from "@/shared/api/types";
import {
  KIND_HUDDLE_ENDED,
  KIND_HUDDLE_PARTICIPANT_JOINED,
  KIND_HUDDLE_PARTICIPANT_LEFT,
  KIND_HUDDLE_STARTED,
} from "@/shared/constants/kinds";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { useHuddle } from "../HuddleContext";
import { formatHuddleActionError } from "../lib/huddleError";

type ActiveHuddle = {
  ephemeralChannelId: string;
  participants: Set<string>;
};

type HuddleIndicatorProps = {
  channelId: string;
  className?: string;
  renderMode?: "button" | "menu-item";
  /** Called when the user clicks the button and no huddle is active (start). */
  onStart?: () => void;
  /** Whether the start action is disabled (e.g., permissions, already starting). */
  startDisabled?: boolean;
};

/**
 * Detects active huddles in a channel via kind:48100-48103 events.
 * Shows a glowing headphone icon when a huddle is active, with participant count.
 * Click to join the huddle.
 */
export function HuddleIndicator({
  channelId,
  className,
  renderMode = "button",
  onStart,
  startDisabled,
}: HuddleIndicatorProps) {
  const { joinHuddle, isStarting } = useHuddle();
  const queryClient = useQueryClient();
  const [activeHuddle, setActiveHuddle] = React.useState<ActiveHuddle | null>(
    null,
  );
  const [isJoining, setIsJoining] = React.useState(false);

  React.useEffect(() => {
    if (!channelId) return;

    let disposed = false;
    let cleanup: (() => Promise<void>) | null = null;

    // Track all seen events for reconstruction. Keyed by event.id for dedup.
    const seenEvents = new Map<string, RelayEvent>();

    /** Reconstruct huddle state from the full set of seen events.
     *  Sort by created_at, then kind (causal: start < join < left < end),
     *  then event id for final tiebreak. This handles out-of-order delivery,
     *  reconnect replay, late mounts, and same-second event batches.
     *
     *  Resilient to missing start event: if we see join/left events for an
     *  ephemeral channel without a prior start, we infer the huddle exists.
     *  This covers the edge case where >100 lifecycle events push the start
     *  event out of the subscription window. */
    function reconstruct() {
      const sorted = [...seenEvents.values()].sort(
        (a, b) =>
          a.created_at - b.created_at ||
          a.kind - b.kind ||
          a.id.localeCompare(b.id),
      );

      let huddle: ActiveHuddle | null = null;
      // Track ended ephemeral channels so late-arriving join/left events
      // (e.g. relay-emitted 48102 that lands 1s after a client-emitted 48103)
      // don't resurrect a phantom huddle via the "infer huddle exists" fallback.
      const endedChannels = new Set<string>();

      for (const ev of sorted) {
        let ephId: string | null = null;
        try {
          const content = JSON.parse(ev.content);
          ephId = content.ephemeral_channel_id ?? null;
        } catch {
          continue; // Malformed — skip
        }

        switch (ev.kind) {
          case KIND_HUDDLE_STARTED: {
            if (!ephId) break;
            // A new start supersedes any previous ended state for this channel.
            endedChannels.delete(ephId);
            huddle = {
              ephemeralChannelId: ephId,
              participants: new Set([ev.pubkey]),
            };
            break;
          }
          case KIND_HUDDLE_PARTICIPANT_JOINED: {
            if (!ephId) break;
            // Skip if this ephemeral channel has already ended — don't
            // resurrect a phantom huddle from a late-arriving relay event.
            if (endedChannels.has(ephId)) break;
            // 48101 events are relay-signed — the actual participant is in the "p" tag.
            const joinedPk =
              ev.tags.find((t) => t[0] === "p")?.[1] ?? ev.pubkey;
            if (!huddle || ephId !== huddle.ephemeralChannelId) {
              huddle = {
                ephemeralChannelId: ephId,
                participants: new Set(),
              };
            }
            huddle.participants.add(joinedPk);
            break;
          }
          case KIND_HUDDLE_PARTICIPANT_LEFT: {
            if (!ephId) break;
            // Skip if this ephemeral channel has already ended.
            if (endedChannels.has(ephId)) break;
            // 48102 events are relay-signed — the actual participant is in the "p" tag.
            const leftPk = ev.tags.find((t) => t[0] === "p")?.[1] ?? ev.pubkey;
            if (!huddle || ephId !== huddle.ephemeralChannelId) {
              huddle = {
                ephemeralChannelId: ephId,
                participants: new Set(),
              };
            }
            huddle.participants.delete(leftPk);
            break;
          }
          case KIND_HUDDLE_ENDED: {
            if (!ephId) break;
            endedChannels.add(ephId);
            if (huddle && ephId === huddle.ephemeralChannelId) {
              huddle = null;
            }
            break;
          }
        }
      }

      if (!disposed) {
        setActiveHuddle(huddle);
      }
    }

    // Subscribe to huddle lifecycle events only (kinds 48100–48103).
    // limit: 100 covers long-lived huddles with many join/leave cycles.
    const handler = ({
      event,
      channelId: eventChannelId,
    }: {
      event: RelayEvent;
      channelId: string;
    }) => {
      if (disposed || eventChannelId !== channelId) return;

      // Dedup by event ID — ignore replayed events from reconnect.
      if (seenEvents.has(event.id)) return;
      seenEvents.set(event.id, event);

      // Reconstruct from full history on every new event.
      // This is cheap — huddle lifecycle events are rare (typically <20).
      reconstruct();
    };

    void simpleSocket
      .subscribeToChannelEvent(channelId, "huddle_event", handler, {
        limit: 100,
      })
      .then((unsubscribe) => {
        if (disposed) {
          void unsubscribe();
        } else {
          cleanup = unsubscribe;
        }
      })
      .catch((error) => {
        if (!disposed) {
          console.error("Failed to subscribe to huddle events", error);
        }
      });

    return () => {
      disposed = true;
      if (cleanup) void cleanup();
      setActiveHuddle(null);
    };
  }, [channelId]);

  // When the local user ends/leaves a huddle, the backend transitions to idle
  // and emits huddle-state-changed. Clear the indicator immediately rather than
  // waiting for the relay's 48103 event (which may arrive late or not at all
  // if the relay connection tears down first).
  React.useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    listen<{ phase: string }>("huddle-state-changed", (event) => {
      if (!cancelled && event.payload.phase === "idle") {
        setActiveHuddle(null);
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // No active huddle — render the start button (if onStart provided).
  if (!activeHuddle) {
    if (!onStart) return null;
    if (renderMode === "menu-item") {
      return (
        <DropdownMenuItem
          className={className}
          data-testid="channel-start-huddle-trigger"
          disabled={startDisabled || isStarting}
          onSelect={() => onStart()}
        >
          <Headphones />
          <span>Start huddle</span>
        </DropdownMenuItem>
      );
    }

    return (
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>
          <span
            className="inline-flex"
            data-testid="channel-huddle-tooltip-trigger"
          >
            <Button
              aria-label="Start huddle"
              className={className}
              data-testid="channel-start-huddle-trigger"
              disabled={startDisabled || isStarting}
              onClick={() => onStart()}
              size="icon"
              type="button"
              variant="outline"
            >
              <Headphones />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Huddle</TooltipContent>
      </Tooltip>
    );
  }

  // At least 1 participant must exist for the huddle to be active.
  // When START fell out of the event window, the creator isn't in the
  // reconstructed set — floor at 1 to avoid showing "0 participants".
  const participantCount = Math.max(1, activeHuddle.participants.size);

  async function doJoin() {
    if (!activeHuddle || isJoining) return;
    setIsJoining(true);
    try {
      await joinHuddle(channelId, activeHuddle.ephemeralChannelId);
      // Refetch channels so the ephemeral channel appears in the sidebar.
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
    } catch (e) {
      console.error("Failed to join huddle:", e);
      toast.error(formatHuddleActionError(e, "join"));
    } finally {
      setIsJoining(false);
    }
  }

  if (renderMode === "menu-item") {
    return (
      <DropdownMenuItem
        className={className}
        data-testid="channel-start-huddle-trigger"
        disabled={isJoining || isStarting}
        onSelect={() => void doJoin()}
      >
        <Headphones />
        <span>Join huddle</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {participantCount}
        </span>
      </DropdownMenuItem>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={`Join active huddle (${participantCount} participant${participantCount !== 1 ? "s" : ""})`}
          className={cn("relative", className)}
          disabled={isJoining || isStarting}
          onClick={() => void doJoin()}
          size="icon"
          type="button"
          variant="outline"
        >
          <Headphones />
          <span className="absolute inset-0 animate-pulse rounded-lg ring-2 ring-border/70" />
          {/* Participant count badge */}
          {participantCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-border bg-background px-0.5 text-2xs font-bold text-muted-foreground">
              {participantCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {`Huddle active — ${participantCount} participant${participantCount !== 1 ? "s" : ""}`}
      </TooltipContent>
    </Tooltip>
  );
}
