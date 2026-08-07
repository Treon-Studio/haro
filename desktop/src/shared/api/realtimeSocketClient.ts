import { relayClient } from "./relayClient.ts";
import type {
  ConnectionState,
  RelaySubscriptionFilter,
} from "./relayClientShared.ts";
import type { RelayEvent } from "./types.ts";
import { mapRelayEvent } from "./haroEventMapper.ts";
import type {
  HaroEventName,
  HaroMappedEvent,
  HaroRealtimeEvents,
} from "./haroRealtimeTypes.ts";
import {
  CHANNEL_LIVE_EVENT_KINDS,
  KIND_CHANNEL_THREAD_SUMMARY,
  KIND_DELETION,
  KIND_EMOJI_SET,
  KIND_FORUM_COMMENT,
  KIND_FORUM_POST,
  KIND_GROUP_MEMBER_LIST,
  KIND_JOB_ACCEPTED,
  KIND_JOB_CANCEL,
  KIND_JOB_ERROR,
  KIND_JOB_PROGRESS,
  KIND_JOB_REQUEST,
  KIND_JOB_RESULT,
  KIND_HUDDLE_ENDED,
  KIND_HUDDLE_PARTICIPANT_JOINED,
  KIND_HUDDLE_PARTICIPANT_LEFT,
  KIND_HUDDLE_REACTION,
  KIND_HUDDLE_STARTED,
  KIND_LEGACY_STREAM_MESSAGE,
  KIND_MANAGED_AGENT,
  KIND_MEMBER_ADDED_NOTIFICATION,
  KIND_MEMBER_REMOVED_NOTIFICATION,
  KIND_NIP29_DELETE_EVENT,
  KIND_PERSONA,
  KIND_PRESENCE_UPDATE,
  KIND_PROFILE,
  KIND_REACTION,
  KIND_READ_STATE,
  KIND_STREAM_MESSAGE,
  KIND_STREAM_MESSAGE_DIFF,
  KIND_STREAM_MESSAGE_EDIT,
  KIND_STREAM_MESSAGE_V2,
  KIND_SYSTEM_MESSAGE,
  KIND_TEAM,
  KIND_TYPING_INDICATOR,
  KIND_USER_STATUS,
} from "../constants/kinds.ts";
import { isContextualChannelEvent } from "./haroEventMapper.ts";

export interface PublishResult {
  accepted: boolean;
  eventId?: string;
  message?: string;
}

export interface HaroRelayAdapter {
  preconnect(): Promise<void>;
  disconnect(): void;
  fetchEvents(filter: RelaySubscriptionFilter): Promise<RelayEvent[]>;
  publishEvent(event: RelayEvent): Promise<RelayEvent | PublishResult>;
  sendMessage(
    channelId: string,
    content: string,
    mentions?: string[],
    tags?: string[][],
  ): Promise<RelayEvent | PublishResult>;
  subscribeLive(
    filter: RelaySubscriptionFilter,
    handler: (event: RelayEvent) => void,
  ): Promise<() => Promise<void>>;
  subscribeToReconnects(handler: () => void): () => void;
  subscribeToConnectionState(
    handler: (state: ConnectionState) => void,
  ): () => void;
  getConnectionState(): ConnectionState;
}

type ChannelHaroEventName =
  | "message_send"
  | "typing_indicator"
  | "reaction_event"
  | "huddle_event";

const CHANNEL_MAPPED_LIVE_KINDS: Record<
  ChannelHaroEventName,
  readonly number[]
> = {
  message_send: [
    KIND_DELETION,
    KIND_NIP29_DELETE_EVENT,
    KIND_STREAM_MESSAGE,
    KIND_LEGACY_STREAM_MESSAGE,
    KIND_STREAM_MESSAGE_V2,
    KIND_STREAM_MESSAGE_EDIT,
    KIND_STREAM_MESSAGE_DIFF,
    KIND_SYSTEM_MESSAGE,
    KIND_JOB_REQUEST,
    KIND_JOB_ACCEPTED,
    KIND_JOB_PROGRESS,
    KIND_JOB_RESULT,
    KIND_JOB_CANCEL,
    KIND_JOB_ERROR,
    KIND_FORUM_POST,
    KIND_FORUM_COMMENT,
    KIND_CHANNEL_THREAD_SUMMARY,
  ],
  typing_indicator: [KIND_TYPING_INDICATOR],
  reaction_event: [KIND_REACTION],
  huddle_event: [
    KIND_HUDDLE_STARTED,
    KIND_HUDDLE_PARTICIPANT_JOINED,
    KIND_HUDDLE_PARTICIPANT_LEFT,
    KIND_HUDDLE_ENDED,
    KIND_HUDDLE_REACTION,
  ],
};

const MAPPED_LIVE_KINDS: Partial<Record<HaroEventName, readonly number[]>> = {
  ...CHANNEL_MAPPED_LIVE_KINDS,
  presence_update: [KIND_PRESENCE_UPDATE],
  user_status_update: [KIND_USER_STATUS],
  profile_event: [KIND_PROFILE],
  persona_event: [KIND_PERSONA, KIND_TEAM, KIND_MANAGED_AGENT, KIND_DELETION],
  preference_update: [KIND_READ_STATE],
  emoji_update: [KIND_EMOJI_SET],
  membership_update: [
    KIND_GROUP_MEMBER_LIST,
    KIND_MEMBER_ADDED_NOTIFICATION,
    KIND_MEMBER_REMOVED_NOTIFICATION,
  ],
};

type MappedSubscription = {
  cancelled: boolean;
  unsubscribe: (() => Promise<void>) | null;
};

const MAX_ROUTED_EVENT_IDS = 5_000;

export class SimpleSocket {
  private handlers = new Map<string, Set<(payload: any) => void>>();
  private explicitDisconnect = false;
  private unsubscribeReconnect: (() => void) | null = null;
  private mappedSubscriptions = new Map<HaroEventName, MappedSubscription>();
  private routedEventIds = new Set<string>();
  private routedEventOrder: string[] = [];
  private readonly relay: HaroRelayAdapter;

  constructor(relay: HaroRelayAdapter = relayClient) {
    this.relay = relay;
    this.subscribeToRelayReconnects();
  }

  private subscribeToRelayReconnects(): void {
    this.unsubscribeReconnect?.();
    this.unsubscribeReconnect = this.relay.subscribeToReconnects(() => {
      if (this.explicitDisconnect) return;
      this.emit("connect", { reconnected: true });
    });
  }

  public connect(): void {
    this.explicitDisconnect = false;
    this.subscribeToRelayReconnects();
    for (const eventName of this.handlers.keys()) {
      this.startMappedSubscription(eventName as HaroEventName);
    }
    void this.relay.preconnect();
  }

  public disconnect(): void {
    this.explicitDisconnect = true;
    this.unsubscribeReconnect?.();
    this.unsubscribeReconnect = null;
    this.disposeMappedSubscriptions();
    this.routedEventIds.clear();
    this.routedEventOrder = [];
    this.relay.disconnect();
  }

  public on<K extends HaroEventName>(
    event: K,
    handler: (payload: HaroRealtimeEvents[K]) => void,
  ): () => void;
  public on(event: string, handler: (payload: any) => void): () => void;
  public on(event: string, handler: (payload: any) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    this.startMappedSubscription(event as HaroEventName);
    return () => {
      this.off(event, handler);
    };
  }

  public off<K extends HaroEventName>(
    event: K,
    handler: (payload: HaroRealtimeEvents[K]) => void,
  ): void;
  public off(event: string, handler: (payload: any) => void): void;
  public off(event: string, handler: (payload: any) => void): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(event);
        this.stopMappedSubscription(event as HaroEventName);
      }
    }
  }

  public emit(event: string, payload: any): void {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of Array.from(set)) {
        try {
          handler(payload);
        } catch (error) {
          console.error(
            `[SimpleSocket] Error in handler for event '${event}':`,
            error,
          );
        }
      }
    }
  }

  private startMappedSubscription(eventName: HaroEventName): void {
    const kinds = MAPPED_LIVE_KINDS[eventName];
    if (
      this.explicitDisconnect ||
      !kinds ||
      this.mappedSubscriptions.has(eventName)
    )
      return;

    const subscription: MappedSubscription = {
      cancelled: false,
      unsubscribe: null,
    };
    this.mappedSubscriptions.set(eventName, subscription);
    void this.relay
      .subscribeLive({ kinds: [...kinds], limit: 0 }, (event) => {
        if (subscription.cancelled) return;
        const mapped = mapRelayEvent(event);
        if (mapped?.type === eventName) {
          this.emitMapped(mapped);
        }
      })
      .then((unsubscribe) => {
        if (subscription.cancelled) {
          void unsubscribe();
          return;
        }
        subscription.unsubscribe = unsubscribe;
      })
      .catch((error) => {
        if (!subscription.cancelled) {
          this.mappedSubscriptions.delete(eventName);
          console.error(
            `[SimpleSocket] Failed to subscribe to '${eventName}':`,
            error,
          );
        }
      });
  }

  private stopMappedSubscription(eventName: HaroEventName): void {
    const subscription = this.mappedSubscriptions.get(eventName);
    if (!subscription) return;
    this.mappedSubscriptions.delete(eventName);
    subscription.cancelled = true;
    if (subscription.unsubscribe) {
      void subscription.unsubscribe();
    }
  }

  private disposeMappedSubscriptions(): void {
    for (const eventName of Array.from(this.mappedSubscriptions.keys())) {
      this.stopMappedSubscription(eventName);
    }
  }

  private emitMapped(mapped: HaroMappedEvent): void {
    const key = `${mapped.type}:${mapped.payload.event.id}`;
    if (this.routedEventIds.has(key)) return;
    this.routedEventIds.add(key);
    this.routedEventOrder.push(key);
    if (this.routedEventOrder.length > MAX_ROUTED_EVENT_IDS) {
      const oldest = this.routedEventOrder.shift();
      if (oldest) this.routedEventIds.delete(oldest);
    }
    this.emit(mapped.type, mapped.payload);
  }

  public async subscribeToChannelLive(
    channelId: string,
    onEvent: (event: RelayEvent) => void,
  ): Promise<() => Promise<void>> {
    return this.relay.subscribeLive(
      {
        kinds: [...CHANNEL_LIVE_EVENT_KINDS],
        limit: 0,
        "#h": [channelId],
      },
      (event) => {
        const hTag = Array.isArray(event.tags)
          ? event.tags.find((t) => Array.isArray(t) && t[0] === "h")?.[1]
          : null;
        if (hTag && hTag !== channelId) return;
        if (!hTag && !isContextualChannelEvent(event)) return;

        const mapped = mapRelayEvent(event);
        if (mapped) {
          this.emitMapped(mapped);
        }
        onEvent(event);
      },
    );
  }

  public async subscribeToChannelEvent<K extends ChannelHaroEventName>(
    channelId: string,
    eventName: K,
    handler: (payload: HaroRealtimeEvents[K]) => void,
    options?: { limit?: number; since?: number },
  ): Promise<() => Promise<void>> {
    const filter: RelaySubscriptionFilter = {
      kinds: [...CHANNEL_MAPPED_LIVE_KINDS[eventName]],
      limit: options?.limit ?? 0,
      "#h": [channelId],
    };
    if (options?.since !== undefined) filter.since = options.since;
    return this.relay.subscribeLive(filter, (event) => {
      const hTag = Array.isArray(event.tags)
        ? event.tags.find((tag) => tag[0] === "h")?.[1]
        : null;
      if (hTag !== channelId) return;
      const mapped = mapRelayEvent(event);
      if (mapped?.type === eventName) {
        handler(mapped.payload as HaroRealtimeEvents[K]);
      }
    });
  }

  public async sendMessage(
    channelId: string,
    content: string,
    mentions?: string[],
    tags?: string[][],
  ): Promise<RelayEvent | PublishResult> {
    return this.relay.sendMessage(channelId, content, mentions, tags);
  }

  public async fetchEvents(
    filter: RelaySubscriptionFilter,
  ): Promise<RelayEvent[]> {
    return this.relay.fetchEvents(filter);
  }

  public async subscribeLive(
    filter: RelaySubscriptionFilter,
    handler: (event: RelayEvent) => void,
  ): Promise<() => Promise<void>> {
    return this.relay.subscribeLive(filter, handler);
  }

  public async publishEvent(
    event: RelayEvent,
  ): Promise<RelayEvent | PublishResult> {
    return this.relay.publishEvent(event);
  }

  public subscribeToReconnects(handler: () => void): () => void {
    return this.relay.subscribeToReconnects(handler);
  }

  public onReconnect(handler: () => void): () => void {
    return this.relay.subscribeToReconnects(handler);
  }

  public onConnectionStateChange(
    handler: (state: ConnectionState) => void,
  ): () => void {
    return this.relay.subscribeToConnectionState(handler);
  }

  public getConnectionState(): ConnectionState {
    return this.relay.getConnectionState();
  }

  public send(data: string | object): void {
    try {
      const payload = typeof data === "string" ? JSON.parse(data) : data;
      if (payload && typeof payload === "object" && "type" in payload) {
        this.emit((payload as any).type, (payload as any).payload);
      }
    } catch {
      // Ignore invalid frames in legacy fallback
    }
  }
}

export const realtimeSocketClient = new SimpleSocket();
