import { fetchPreference, publishPreference } from "./preferenceEventStore";
import {
  parseChannelSortPayload,
  type ChannelSortStore,
} from "./channelSortPreference";

const TYPE = "channel-sort";
const DEBOUNCE_MS = 2_000;

export type RemoteSortPrefs = {
  store: ChannelSortStore;
  updatedAt: number;
};

export class ChannelSortSyncManager {
  private readonly pubkey?: string;
  private readonly relay?: any;

  constructor(pubkey?: string, relay?: any) {
    this.pubkey = pubkey;
    this.relay = relay;
  }
  private debounceTimer: number | null = null;
  private pendingStore: ChannelSortStore | null = null;
  private isDestroyed = false;

  async fetchRemoteSortPrefs(): Promise<RemoteSortPrefs | null> {
    if (!this.pubkey) return null;
    const store = await fetchPreference(
      this.pubkey,
      TYPE,
      parseChannelSortPayload,
      this.relay,
    );
    if (!store) return null;
    return { store, updatedAt: Date.now() };
  }

  cancelPendingPublish(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  getPendingStore(): ChannelSortStore | null {
    return this.pendingStore;
  }

  publishSortPrefs(store: ChannelSortStore): void {
    this.pendingStore = store;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.doPublish(store);
    }, DEBOUNCE_MS);
  }

  destroy(): void {
    this.isDestroyed = true;
    this.cancelPendingPublish();
    this.pendingStore = null;
  }

  private async fetchOwnBlobBeforePublish(
    store: ChannelSortStore,
  ): Promise<ChannelSortStore> {
    const remote = await this.fetchRemoteSortPrefs();
    if (!remote) return store;
    return store;
  }

  private async doPublish(store: ChannelSortStore): Promise<void> {
    const finalStore = await this.fetchOwnBlobBeforePublish(store);
    if (this.isDestroyed) return;
    this.pendingStore = null;
    await publishPreference(TYPE, finalStore, this.relay);
  }

  async subscribeToSortPrefs(
    _onUpdate: (remote: RemoteSortPrefs) => void,
  ): Promise<() => Promise<void>> {
    return Promise.resolve(async () => {});
  }
}
