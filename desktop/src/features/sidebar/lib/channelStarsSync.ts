import { fetchPreference, publishPreference } from "./preferenceEventStore";
import { parseStarPayload, type ChannelStarStore } from "./channelStarsStorage";

const TYPE = "channel-stars";
const DEBOUNCE_MS = 2_000;

export type RemoteStars = {
  store: ChannelStarStore;
  updatedAt: number;
};

export class ChannelStarSyncManager {
  constructor(private readonly pubkey?: string) {}
  private debounceTimer: number | null = null;
  private pendingStore: ChannelStarStore | null = null;

  async fetchRemoteStars(): Promise<RemoteStars | null> {
    if (!this.pubkey) return null;
    const store = await fetchPreference(this.pubkey, TYPE, parseStarPayload);
    if (!store) return null;
    return { store, updatedAt: Date.now() };
  }

  cancelPendingPublish(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  getPendingStore(): ChannelStarStore | null {
    return this.pendingStore;
  }

  publishStars(store: ChannelStarStore): void {
    this.pendingStore = store;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.doPublish(store);
    }, DEBOUNCE_MS);
  }

  private async doPublish(store: ChannelStarStore): Promise<void> {
    this.pendingStore = null;
    await publishPreference(TYPE, store);
  }

  async subscribeToStars(
    _onUpdate: (remote: RemoteStars) => void,
  ): Promise<() => Promise<void>> {
    return Promise.resolve(async () => {});
  }

  destroy(): void {
    if (this.debounceTimer !== null && this.pendingStore !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      void this.doPublish(this.pendingStore);
    } else if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
