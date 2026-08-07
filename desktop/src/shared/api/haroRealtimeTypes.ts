import type { RelayEvent } from "./types.ts";

export interface HaroRealtimeEvents {
  connect: { reconnected: boolean };
  message_send: { event: RelayEvent; channelId: string };
  typing_indicator: { event: RelayEvent; channelId: string };
  presence_update: { event: RelayEvent };
  user_status_update: { event: RelayEvent };
  reaction_event: { event: RelayEvent; channelId: string };
  huddle_event: { event: RelayEvent; channelId: string };
  profile_event: { event: RelayEvent };
  persona_event: { event: RelayEvent };
  preference_update: { event: RelayEvent; preferenceType: string };
  emoji_update: { event: RelayEvent };
  membership_update: {
    event: RelayEvent;
    channelId?: string;
    targetPubkey?: string;
  };
}

export type HaroEventName = keyof HaroRealtimeEvents;

export type HaroMappedEvent = {
  [K in Exclude<HaroEventName, "connect">]: {
    type: K;
    payload: HaroRealtimeEvents[K];
  };
}[Exclude<HaroEventName, "connect">];
