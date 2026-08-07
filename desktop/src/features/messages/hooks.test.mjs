import assert from "node:assert/strict";
import test from "node:test";

import { requireAcceptedMessageSend } from "./hooks.ts";

test("sendMessage rejection propagates the relay message", () => {
  assert.throws(
    () =>
      requireAcceptedMessageSend({
        accepted: false,
        message: "channel is archived",
      }),
    /channel is archived/,
  );
});
