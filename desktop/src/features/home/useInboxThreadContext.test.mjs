import assert from "node:assert/strict";
import test from "node:test";

import * as inboxThreadContext from "./useInboxThreadContext.ts";

test("thread descendant query is constrained to its channel and root", () => {
  const filter = inboxThreadContext.buildInboxThreadDescendantFilter(
    "general",
    "root",
  );
  assert.deepEqual(filter["#h"], ["general"]);
  assert.deepEqual(filter["#e"], ["root"]);
  assert.ok(filter.kinds.length > 0);
  assert.equal(filter.limit, 10_000);
});
