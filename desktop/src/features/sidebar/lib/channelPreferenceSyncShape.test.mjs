import assert from "node:assert/strict";
import test from "node:test";
import { ChannelSectionSyncManager } from "./channelSectionsSync.ts";
import { ChannelSortSyncManager } from "./channelSortSync.ts";

test("preference managers expose one stable pending-store API", () => {
  for (const Manager of [ChannelSectionSyncManager, ChannelSortSyncManager]) {
    const manager = new Manager("00".repeat(32));
    assert.equal(typeof manager.cancelPendingPublish, "function");
    assert.equal(typeof manager.getPendingStore, "function");
    assert.equal(manager.getPendingStore(), null);
    manager.destroy();
  }
});
