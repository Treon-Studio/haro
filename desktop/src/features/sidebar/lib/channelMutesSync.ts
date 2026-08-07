import { fetchPreference, publishPreference } from "./preferenceEventStore";
import { parseMutePayload, type ChannelMuteStore } from "./channelMutesStorage";

const TYPE = "channel-mutes";
const DEBOUNCE_MS = 2_000;

export type RemoteMutes = {
  store: ChannelMuteStore;
  updatedAt: number;
};

export class ChannelMuteSyncManager {
  constructor(private readonly pubkey?: string) {}
  private debounceTimer: number | null = null;
  private pendingStore: ChannelMuteStore | null = null;

  async fetchRemoteMutes(): Promise<RemoteMutes | null> {
    if (!this.pubkey) return null;
    const store = await fetchPreference(this.pubkey, TYPE, parseMutePayload);
    if (!store) return null;
    return { store, updatedAt: Date.now() };
  }

  cancelPendingPublish(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  getPendingStore(): ChannelMuteStore | null {
    return this.pendingStore;
  }

  publishMutes(store: ChannelMuteStore): void {
    this.pendingStore = store;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.doPublish(store);
    }, DEBOUNCE_MS);
  }

  private async doPublish(store: ChannelMuteStore): Promise<void> {
    this.pendingStore = null;
    await publishPreference(TYPE, store);
  }

  async subscribeToMutes(
    _onUpdate: (remote: RemoteMutes) => void,
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
