import assert from "node:assert/strict";
import test from "node:test";

import { publishProjectIssue } from "./issueMutations.ts";

const OWNER = "a".repeat(64);
const project = {
  owner: OWNER,
  repoAddress: `30617:${OWNER}:buzz`,
};

test("issue creation signs and publishes a NIP-34 issue event", async () => {
  let published = null;
  const id = await publishProjectIssue(
    project,
    { title: "Fix relay", body: "Details" },
    {
      async publishEvent(event) {
        published = event;
        return { accepted: true };
      },
    },
  );

  assert.equal(id, "mock-event-id");
  assert.equal(published.kind, 1621);
  assert.equal(published.content, "Details");
  assert.deepEqual(published.tags, [
    ["a", project.repoAddress],
    ["p", OWNER],
    ["subject", "Fix relay"],
  ]);
  assert.equal(typeof published.sig, "string");
});

test("issue creation throws when the relay rejects its signed event", async () => {
  await assert.rejects(
    publishProjectIssue(
      project,
      { title: "Fix relay", body: "Details" },
      {
        async publishEvent() {
          return { accepted: false, message: "denied" };
        },
      },
    ),
    /denied/,
  );
});
