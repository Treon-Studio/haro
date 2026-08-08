import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchChannelMessages,
  sendMessage,
  updateReadState,
  updateUserProfile,
} from "./chatStore.ts";

function captureRelay() {
  const filters = [];
  let signedEvent = null;
  let sendMessageCalled = false;
  let lastExtraTags = null;

  return {
    filters,
    get signed() {
      return signedEvent;
    },
    get sendMessageCalled() {
      return sendMessageCalled;
    },
    get lastExtraTags() {
      return lastExtraTags;
    },
    async fetchEvents(filter) {
      filters.push(filter);
      return [];
    },
    async sendMessage(_channelId, _content, _mentions, extraTags) {
      sendMessageCalled = true;
      lastExtraTags = extraTags;
      return { accepted: true, eventId: "m1", message: "ok" };
    },
    async publishEvent(event) {
      signedEvent = event;
      return { accepted: true, eventId: event?.id || "e1", message: "ok" };
    },
  };
}

test("history query is kind- and h-scoped", async () => {
  const relay = captureRelay();
  await fetchChannelMessages("general", 25, "1700000000", relay);
  assert.deepEqual(relay.filters[0], {
    kinds: [9, 40002, 40003, 40008],
    "#h": ["general"],
    until: 1700000000,
    limit: 25,
  });
});

test("reply writes preserve h and thread references", async () => {
  const relay = captureRelay();
  await sendMessage(
    {
      channelId: "general",
      content: "reply",
      replyToId: "p",
      threadRootId: "r",
    },
    relay,
  );
  assert.equal(relay.sendMessageCalled, true);
  assert.deepEqual(relay.lastExtraTags, [
    ["e", "r", "", "root"],
    ["e", "p", "", "reply"],
  ]);
});

test("read state is a NIP-78 replacement event", async () => {
  const relay = captureRelay();
  await updateReadState("channel:general", 1700000000, relay);
  assert.equal(relay.signed.kind, 30078);
  assert.deepEqual(relay.signed.tags, [
    ["d", "haro:read-state:channel:general"],
  ]);
  assert.equal(
    relay.signed.content,
    JSON.stringify({ version: 1, timestamp: 1700000000 }),
  );
});

test("profile update maps avatarUrl/displayName to picture/display_name and preserves existing fields", async () => {
  const filters = [];
  let signedEvent = null;

  const relay = {
    async fetchEvents(filter) {
      filters.push(filter);
      return [
        {
          id: "p1",
          pubkey: "pk1",
          created_at: 10,
          kind: 0,
          tags: [],
          content: JSON.stringify({
            display_name: "Old",
            about: "Keep me",
            picture: "old_url",
            nip05: "user@domain.com",
          }),
        },
      ];
    },
    async publishEvent(event) {
      signedEvent = event;
      return { accepted: true, eventId: event?.id || "e1", message: "ok" };
    },
  };

  const acceptedEvent = await updateUserProfile(
    {
      displayName: "😀",
      avatarUrl: "data:image/svg+xml,<svg/>",
    },
    relay,
  );

  assert.equal(signedEvent.kind, 0);
  assert.deepEqual(JSON.parse(signedEvent.content), {
    display_name: "😀",
    about: "Keep me",
    picture: "data:image/svg+xml,<svg/>",
    nip05: "user@domain.com",
  });
  assert.deepEqual(filters, [
    {
      kinds: [0],
      authors: [
        "0000000000000000000000000000000000000000000000000000000000000000",
      ],
      limit: 1,
    },
  ]);
  assert.strictEqual(acceptedEvent, signedEvent);
});

test("rapid profile saves advance created_at beyond the current event", async () => {
  const signedEvents = [];
  let latestCreatedAt = 1_700_000_010;
  const relay = {
    async fetchEvents() {
      return [
        {
          id: "p1",
          pubkey: "pk1",
          created_at: latestCreatedAt,
          kind: 0,
          tags: [],
          content: JSON.stringify({ display_name: "Old" }),
        },
      ];
    },
    async publishEvent(event) {
      signedEvents.push(event);
      latestCreatedAt = event.created_at;
      return { accepted: true, eventId: event.id };
    },
  };

  await updateUserProfile({ displayName: "First" }, relay);
  await updateUserProfile({ displayName: "Second" }, relay);

  assert.equal(signedEvents.length, 2);
  assert.ok(signedEvents[0].created_at > 1_700_000_010);
  assert.equal(signedEvents[1].created_at, signedEvents[0].created_at + 1);
});
