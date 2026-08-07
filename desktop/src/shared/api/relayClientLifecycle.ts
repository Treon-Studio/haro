import { Channel } from "@tauri-apps/api/core";

/** Timeout for relay authentication requests. */
export const AUTH_TIMEOUT_MS = 25_000;
/** Timeout for relay history requests. */
export const HISTORY_TIMEOUT_MS = 25_000;
/** Timeout for relay publish acknowledgements. */
export const PUBLISH_TIMEOUT_MS = 25_000;
/** Stable connection duration required before reconnect backoff resets. */
export const BACKOFF_RESET_STABLE_MS = 60_000;

/** A Tauri callback channel paired with its idempotent removal handle. */
export type TauriCallbackRegistration<T> = {
  channel: Channel<T>;
  unregister(): void;
};

type TauriInternalsWithCallbacks = {
  unregisterCallback?: (id: number) => void;
};

/**
 * Register a Tauri channel while retaining the private callback teardown
 * needed when a relay session ends before native work completes.
 */
export function createTauriCallbackRegistration<T>(
  onMessage: (message: T) => void,
  createChannel: (handler: (message: T) => void) => Channel<T> = (handler) =>
    new Channel<T>(handler),
  unregisterCallback: (id: number) => void = (id) => {
    const internals = (
      window as Window & {
        __TAURI_INTERNALS__?: TauriInternalsWithCallbacks;
      }
    ).__TAURI_INTERNALS__;
    internals?.unregisterCallback?.(id);
  },
): TauriCallbackRegistration<T> {
  const channel = createChannel(onMessage);
  let removed = false;

  return {
    channel,
    unregister() {
      if (removed) return;
      removed = true;
      unregisterCallback(channel.id);
    },
  };
}

/** Create the EOSE/CLOSED readiness gate for a live relay subscription. */
export function createLiveSubscriptionReadiness(timeoutMs = 250) {
  let fallbackTimeout: number | undefined;
  let settled = false;
  let resolveReady: () => void = () => undefined;
  let rejectReady: (error: Error) => void = () => undefined;
  const clearFallback = () => {
    if (fallbackTimeout === undefined) return;
    window.clearTimeout(fallbackTimeout);
    fallbackTimeout = undefined;
  };
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = () => {
      if (settled) return;
      settled = true;
      clearFallback();
      resolve();
    };
    rejectReady = (error) => {
      if (settled) return;
      settled = true;
      clearFallback();
      reject(error);
    };
  });
  fallbackTimeout = window.setTimeout(resolveReady, timeoutMs);

  return {
    ready,
    resolveReady,
    rejectReady,
    readyTimeout: fallbackTimeout,
    cancel() {
      if (settled) return;
      settled = true;
      clearFallback();
    },
  };
}
