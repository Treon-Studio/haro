import assert from "node:assert/strict";
import test from "node:test";

import * as presenceHooks from "./hooks.ts";

test("presence publishing uses ephemeral kind 20001 with no replaceable tags", async () => {
  assert.equal(typeof presenceHooks.publishPresenceUpdate, "function");
  let signedInput;
  let publishedEvent;

  const result = await presenceHooks.publishPresenceUpdate(
    "away",
    {
      async publishEvent(event) {
        publishedEvent = event;
        return { accepted: true, eventId: event.id, message: "ok" };
      },
    },
    async (input) => {
      signedInput = input;
      return {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: 1,
        kind: input.kind,
        tags: input.tags,
        content: input.content,
        sig: "c".repeat(128),
      };
    },
  );

  assert.deepEqual(signedInput, { kind: 20001, content: "away", tags: [] });
  assert.equal(publishedEvent.kind, 20001);
  assert.deepEqual(publishedEvent.tags, []);
  assert.deepEqual(result, { status: "away", ttlSeconds: 90 });
});

test("presence publishing propagates relay rejection", async () => {
  assert.equal(typeof presenceHooks.publishPresenceUpdate, "function");
  await assert.rejects(
    presenceHooks.publishPresenceUpdate(
      "online",
      {
        async publishEvent() {
          return { accepted: false, message: "blocked" };
        },
      },
      async (input) => ({
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: 1,
        kind: input.kind,
        tags: input.tags,
        content: input.content,
        sig: "c".repeat(128),
      }),
    ),
    /blocked/,
  );
});
