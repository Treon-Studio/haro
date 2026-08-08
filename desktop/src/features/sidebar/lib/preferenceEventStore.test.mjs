import assert from "node:assert/strict";
import test from "node:test";
import { fetchPreference, publishPreference } from "./preferenceEventStore.ts";

function captureRelay(events = []) {
  const filters = [];
  let publishedEvent = null;

  return {
    filters,
    get published() {
      return publishedEvent;
    },
    async fetchEvents(filter) {
      filters.push(filter);
      return events;
    },
    async publishEvent(event) {
      publishedEvent = event;
      return { accepted: true, eventId: event?.id || "e1", message: "ok" };
    },
  };
}

function event(createdAt, payload, dTag = "haro:channel-stars") {
  return {
    id: `e-${createdAt}`,
    pubkey: "pubkey",
    created_at: createdAt,
    kind: 30078,
    tags: [["d", dTag]],
    content: JSON.stringify(payload),
    sig: "s1",
  };
}

test("fetch selects newest valid own replacement event", async () => {
  const expectedStore = { "ch-1": true };
  const validPayload = { version: 1, value: expectedStore };
  const relay = captureRelay([
    event(10, "invalid-json-string-content"),
    event(9, validPayload),
  ]);

  const parseStars = (val) => (val && typeof val === "object" ? val : null);
  const result = await fetchPreference(
    "pubkey",
    "channel-stars",
    parseStars,
    relay,
  );

  assert.deepEqual(result, expectedStore);
  assert.equal(relay.filters[0].authors[0], "pubkey");
  assert.deepEqual(relay.filters[0]["#d"], [
    "haro:channel-stars",
    "buzz:channel-stars",
  ]);
});

test("publish creates signed replacement event", async () => {
  const relay = captureRelay();
  const value = { "ch-1": true };
  await publishPreference("channel-stars", value, relay);

  assert.equal(relay.published.kind, 30078);
  assert.deepEqual(relay.published.tags, [["d", "haro:channel-stars"]]);
  assert.equal(relay.published.content, JSON.stringify({ version: 1, value }));
});
