import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { channelsQueryKey } from "@/features/channels/hooks";
import { realtimeSocketClient as simpleSocket } from "@/shared/api/realtimeSocketClient";

/**
 * Listens for membership change events (member added/removed) via the
 * real-time socket and invalidates the channel query cache accordingly.
 */
export function useMembershipNotifications(currentPubkey?: string) {
  const queryClient = useQueryClient();
  const normalizedCurrentPubkey = currentPubkey?.trim().toLowerCase() ?? "";

  const handleMembershipNotification = React.useEffectEvent(
    (payload: { channelId?: string }) => {
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
      if (!payload?.channelId) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: ["channels", payload.channelId, "detail"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["channels", payload.channelId, "members"],
      });
    },
  );

  React.useEffect(() => {
    if (normalizedCurrentPubkey.length === 0) {
      return;
    }

    const handleMembershipUpdate = ({
      channelId,
      targetPubkey,
    }: {
      channelId?: string;
      targetPubkey?: string;
    }) => {
      if (targetPubkey?.toLowerCase() === normalizedCurrentPubkey) {
        handleMembershipNotification({ channelId });
      }
    };
    const removeMembershipUpdate = simpleSocket.on(
      "membership_update",
      ({ channelId, targetPubkey }) =>
        handleMembershipUpdate({ channelId, targetPubkey }),
    );

    return () => {
      removeMembershipUpdate();
    };
  }, [normalizedCurrentPubkey]);
}
