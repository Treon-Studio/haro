import { fetchPreference, publishPreference } from "./preferenceEventStore";
import {
  parseChannelSectionPayload,
  type ChannelSectionStore,
} from "./channelSectionsStorage";

const TYPE = "channel-sections";
const DEBOUNCE_MS = 2_000;

export type RemoteSections = {
  store: ChannelSectionStore;
  updatedAt: number;
};

export class ChannelSectionSyncManager {
  private readonly pubkey?: string;
  private readonly relay?: any;

  constructor(pubkey?: string, relay?: any) {
    this.pubkey = pubkey;
    this.relay = relay;
  }
  private debounceTimer: number | null = null;
  private pendingStore: ChannelSectionStore | null = null;
  private isDestroyed = false;

  async fetchRemoteSections(): Promise<RemoteSections | null> {
    if (!this.pubkey) return null;
    const store = await fetchPreference(
      this.pubkey,
      TYPE,
      parseChannelSectionPayload,
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

  getPendingStore(): ChannelSectionStore | null {
    return this.pendingStore;
  }

  publishSections(store: ChannelSectionStore): void {
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
    store: ChannelSectionStore,
  ): Promise<ChannelSectionStore> {
    const remote = await this.fetchRemoteSections();
    if (!remote) return store;
    return store;
  }

  private async doPublish(store: ChannelSectionStore): Promise<void> {
    const finalStore = await this.fetchOwnBlobBeforePublish(store);
    if (this.isDestroyed) return;
    this.pendingStore = null;
    await publishPreference(TYPE, finalStore, this.relay);
  }

  async subscribeToSections(
    _onUpdate: (remote: RemoteSections) => void,
  ): Promise<() => Promise<void>> {
    return Promise.resolve(async () => {});
  }
}
