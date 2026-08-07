import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductFeedbackEvent,
  publishProductFeedback,
} from "./useSendFeedback.ts";

test("buildProductFeedbackEvent uses body and category tag", () => {
  assert.deepEqual(
    buildProductFeedbackEvent({ category: "bug", message: "  It broke  " }, []),
    { content: "It broke", tags: [["category", "bug"]] },
  );
});

test("buildProductFeedbackEvent omits absent category and retains imeta", () => {
  const attachment = {
    url: "https://example.test/screenshot.png",
    sha256: "ab".repeat(32),
    size: 42,
    type: "image/png",
    uploaded: 42,
  };
  const result = buildProductFeedbackEvent(
    { category: null, message: "Useful feedback" },
    [attachment],
  );
  assert.match(result.content, /Useful feedback/);
  assert.equal(
    result.tags.some((tag) => tag[0] === "category"),
    false,
  );
  assert.equal(
    result.tags.some((tag) => tag[0] === "imeta"),
    true,
  );
});

test("feedback signs and publishes a product-feedback event", async () => {
  let published = null;
  const event = await publishProductFeedback(
    buildProductFeedbackEvent({ category: "bug", message: "Broken" }, []),
    {
      async publishEvent(value) {
        published = value;
        return { accepted: true };
      },
    },
  );
  assert.strictEqual(event, published);
  assert.equal(published.kind, 42000);
  assert.deepEqual(published.tags, [["category", "bug"]]);
  assert.equal(typeof published.sig, "string");
});

test("feedback throws when its signed event is rejected", async () => {
  await assert.rejects(
    publishProductFeedback(
      buildProductFeedbackEvent({ category: null, message: "Broken" }, []),
      {
        async publishEvent() {
          return { accepted: false, message: "denied" };
        },
      },
    ),
    /denied/,
  );
});
