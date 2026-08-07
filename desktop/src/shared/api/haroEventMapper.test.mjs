import assert from "node:assert/strict";
import test from "node:test";
import { mapRelayEvent } from "./haroEventMapper.ts";

const cases = [
  [9, "message_send", [["h", "ch1"]]],
  [40001, "message_send", [["h", "ch1"]]],
  [40002, "message_send", [["h", "ch1"]]],
  [40003, "message_send", [["h", "ch1"]]],
  [40008, "message_send", [["h", "ch1"]]],
  [40099, "message_send", [["h", "ch1"]]],
  [43001, "message_send", [["h", "ch1"]]],
  [43002, "message_send", [["h", "ch1"]]],
  [43003, "message_send", [["h", "ch1"]]],
  [43004, "message_send", [["h", "ch1"]]],
  [43005, "message_send", [["h", "ch1"]]],
  [43006, "message_send", [["h", "ch1"]]],
  [45001, "message_send", [["h", "ch1"]]],
  [45003, "message_send", [["h", "ch1"]]],
  [9005, "message_send", [["h", "ch1"]]],
  [39005, "message_send", [["h", "ch1"]]],
  [20002, "typing_indicator", [["h", "ch1"]]],
  [20001, "presence_update", []],
  [30315, "user_status_update", [["d", "general"]]],
  [7, "reaction_event", [["h", "ch1"]]],
  [48100, "huddle_event", [["h", "ch1"]]],
  [48101, "huddle_event", [["h", "ch1"]]],
  [48102, "huddle_event", [["h", "ch1"]]],
  [48103, "huddle_event", [["h", "ch1"]]],
  [24810, "huddle_event", [["h", "ch1"]]],
  [0, "profile_event", []],
  [30175, "persona_event", []],
  [30176, "persona_event", []],
  [30177, "persona_event", []],
  [5, "persona_event", [["a", "30175:pk1:persona"]]],
  [5, "message_send", [["h", "ch1"]]],
  [30078, "preference_update", [["d", "channel-mutes"]]],
  [30030, "emoji_update", []],
  [
    9000,
    "membership_update",
    [
      ["h", "ch1"],
      ["p", "pk1"],
    ],
  ],
  [
    44100,
    "membership_update",
    [
      ["h", "ch1"],
      ["p", "pk1"],
    ],
  ],
  [
    44101,
    "membership_update",
    [
      ["h", "ch1"],
      ["p", "pk1"],
    ],
  ],
];

for (const [kind, expectedType, tags] of cases) {
  test(`kind ${kind} maps to ${expectedType}`, () => {
    const event = {
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      created_at: 10,
      kind,
      content: "test",
      sig: "c".repeat(128),
      tags: tags || [],
    };
    const mapped = mapRelayEvent(event);
    assert.ok(mapped);
    assert.equal(mapped.type, expectedType);
  });
}

test("unknown event kind returns null", () => {
  const event = {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    created_at: 10,
    kind: 99999,
    content: "test",
    sig: "c".repeat(128),
    tags: [],
  };
  assert.equal(mapRelayEvent(event), null);
});

test("h-less deletion with an event reference is contextual, not persona data", () => {
  assert.equal(
    mapRelayEvent({
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      created_at: 10,
      kind: 5,
      content: "",
      sig: "c".repeat(128),
      tags: [["e", "message"]],
    }),
    null,
  );
});

for (const kind of [
  9, 40001, 40002, 40003, 40008, 40099, 43001, 43002, 43003, 43004, 43005,
  43006, 45001, 45003, 9005, 39005, 20002, 7, 48100, 48101, 48102, 48103, 24810,
]) {
  test(`kind ${kind} without a valid channel tag returns null`, () => {
    const event = {
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      created_at: 10,
      kind,
      content: "test",
      sig: "c".repeat(128),
      tags: [["h"]],
    };
    assert.equal(mapRelayEvent(event), null);
  });
}

test("kind 30315 without the canonical general d tag returns null", () => {
  assert.equal(
    mapRelayEvent({
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      created_at: 10,
      kind: 30315,
      content: "status",
      sig: "c".repeat(128),
      tags: [],
    }),
    null,
  );
});

test("preference event without a d tag returns null", () => {
  assert.equal(
    mapRelayEvent({
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      created_at: 10,
      kind: 30078,
      content: "test",
      sig: "c".repeat(128),
      tags: [],
    }),
    null,
  );
});

for (const kind of [9000, 44100, 44101]) {
  test(`membership notification ${kind} without target and channel tags returns null`, () => {
    assert.equal(
      mapRelayEvent({
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: 10,
        kind,
        content: "test",
        sig: "c".repeat(128),
        tags: [["h", "ch1"]],
      }),
      null,
    );
  });
}
