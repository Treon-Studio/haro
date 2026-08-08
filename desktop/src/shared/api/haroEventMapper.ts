import type { RelayEvent } from "./types.ts";
import type { HaroMappedEvent } from "./haroRealtimeTypes.ts";
import {
  KIND_CHANNEL_THREAD_SUMMARY,
  CHANNEL_CONTEXTUAL_EVENT_KINDS,
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

const CONTEXTUAL_EVENT_KINDS = new Set<number>(CHANNEL_CONTEXTUAL_EVENT_KINDS);

function getRequiredTag(event: RelayEvent, tagKey: string): string | null {
  if (!Array.isArray(event.tags)) return null;
  const match = event.tags.find((t) => Array.isArray(t) && t[0] === tagKey);
  return match && typeof match[1] === "string" && match[1].length > 0
    ? match[1]
    : null;
}

function hasEventReference(event: RelayEvent): boolean {
  return getRequiredTag(event, "e") !== null;
}

export function isContextualChannelEvent(event: RelayEvent): boolean {
  return CONTEXTUAL_EVENT_KINDS.has(event.kind) && hasEventReference(event);
}

export function mapRelayEvent(event: RelayEvent): HaroMappedEvent | null {
  if (!event || typeof event.kind !== "number") return null;

  switch (event.kind) {
    case KIND_STREAM_MESSAGE:
    case KIND_LEGACY_STREAM_MESSAGE:
    case KIND_STREAM_MESSAGE_V2:
    case KIND_STREAM_MESSAGE_EDIT:
    case KIND_STREAM_MESSAGE_DIFF:
    case KIND_SYSTEM_MESSAGE:
    case KIND_JOB_REQUEST:
    case KIND_JOB_ACCEPTED:
    case KIND_JOB_PROGRESS:
    case KIND_JOB_RESULT:
    case KIND_JOB_CANCEL:
    case KIND_JOB_ERROR:
    case KIND_FORUM_POST:
    case KIND_FORUM_COMMENT:
    case KIND_NIP29_DELETE_EVENT:
    case KIND_CHANNEL_THREAD_SUMMARY: {
      const channelId = getRequiredTag(event, "h");
      if (!channelId) return null;
      return {
        type: "message_send",
        payload: { event, channelId },
      };
    }

    case KIND_TYPING_INDICATOR: {
      const channelId = getRequiredTag(event, "h");
      if (!channelId) return null;
      return {
        type: "typing_indicator",
        payload: { event, channelId },
      };
    }

    case KIND_PRESENCE_UPDATE:
      return {
        type: "presence_update",
        payload: { event },
      };

    case KIND_USER_STATUS: {
      if (getRequiredTag(event, "d") !== "general") return null;
      return {
        type: "user_status_update",
        payload: { event },
      };
    }

    case KIND_REACTION: {
      const channelId = getRequiredTag(event, "h");
      if (!channelId) return null;
      return {
        type: "reaction_event",
        payload: { event, channelId },
      };
    }

    case KIND_HUDDLE_STARTED:
    case KIND_HUDDLE_PARTICIPANT_JOINED:
    case KIND_HUDDLE_PARTICIPANT_LEFT:
    case KIND_HUDDLE_ENDED:
    case KIND_HUDDLE_REACTION: {
      const channelId = getRequiredTag(event, "h");
      if (!channelId) return null;
      return {
        type: "huddle_event",
        payload: { event, channelId },
      };
    }

    case KIND_PERSONA:
    case KIND_TEAM:
    case KIND_MANAGED_AGENT:
      return {
        type: "persona_event",
        payload: { event },
      };

    case KIND_DELETION: {
      const channelId = getRequiredTag(event, "h");
      return channelId
        ? { type: "message_send", payload: { event, channelId } }
        : getRequiredTag(event, "a")
          ? { type: "persona_event", payload: { event } }
          : null;
    }

    case KIND_PROFILE:
      return {
        type: "profile_event",
        payload: { event },
      };

    case KIND_READ_STATE: {
      const preferenceType = getRequiredTag(event, "d");
      if (!preferenceType) return null;
      return {
        type: "preference_update",
        payload: { event, preferenceType },
      };
    }

    case KIND_EMOJI_SET:
      return {
        type: "emoji_update",
        payload: { event },
      };

    case KIND_GROUP_MEMBER_LIST:
    case KIND_MEMBER_ADDED_NOTIFICATION:
    case KIND_MEMBER_REMOVED_NOTIFICATION: {
      const channelId = getRequiredTag(event, "h");
      const targetPubkey = getRequiredTag(event, "p");
      if (!channelId || !targetPubkey) return null;
      return {
        type: "membership_update",
        payload: { event, channelId, targetPubkey },
      };
    }

    default:
      return null;
  }
}
