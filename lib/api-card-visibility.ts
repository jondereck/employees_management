export const API_CARDS_VISIBILITY_STORAGE_KEY =
  "employees-management:show-api-request-cards";

export interface ApiCardsVisibilityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ApiCardsVisibilityStorageEvent {
  key: string | null;
  newValue: string | null;
  storageArea?: ApiCardsVisibilityStorage | null;
}

interface ApiCardsVisibilityStoreAdapter {
  getStorage(): ApiCardsVisibilityStorage | null;
  subscribeToStorageEvents(
    listener: (event: ApiCardsVisibilityStorageEvent) => void,
  ): () => void;
}

export interface ApiCardsVisibilitySnapshot {
  initialized: boolean;
  visible: boolean;
}

const SERVER_SNAPSHOT: ApiCardsVisibilitySnapshot = Object.freeze({
  initialized: false,
  visible: true,
});

export function parseStoredApiCardsVisibility(value: string | null): boolean {
  return value !== "false";
}

export function serializeApiCardsVisibility(value: boolean): string {
  return String(value);
}

export function shouldRenderApiCards(
  snapshot: ApiCardsVisibilitySnapshot,
): boolean {
  return snapshot.initialized && snapshot.visible;
}

export function createApiCardsVisibilityStore(
  adapter: ApiCardsVisibilityStoreAdapter,
) {
  let snapshot = SERVER_SNAPSHOT;
  const listeners = new Set<() => void>();
  let unsubscribeFromStorage: (() => void) | undefined;

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const updateSnapshot = (visible: boolean) => {
    if (snapshot.initialized && snapshot.visible === visible) {
      return;
    }

    snapshot = Object.freeze({ initialized: true, visible });
    notify();
  };

  const getStorage = () => {
    try {
      return adapter.getStorage();
    } catch {
      return null;
    }
  };

  const handleStorageEvent = (event: ApiCardsVisibilityStorageEvent) => {
    if (
      event.key !== null &&
      event.key !== API_CARDS_VISIBILITY_STORAGE_KEY
    ) {
      return;
    }

    const localStorage = getStorage();
    if (localStorage && event.storageArea !== localStorage) {
      return;
    }

    updateSnapshot(parseStoredApiCardsVisibility(event.newValue));
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    initialize: () => {
      if (snapshot.initialized) {
        return;
      }

      const storage = getStorage();
      if (!storage) {
        updateSnapshot(true);
        return;
      }

      try {
        updateSnapshot(
          parseStoredApiCardsVisibility(
            storage.getItem(API_CARDS_VISIBILITY_STORAGE_KEY),
          ),
        );
      } catch {
        updateSnapshot(true);
      }
    },
    setVisibility: (visible: boolean) => {
      updateSnapshot(visible);

      const storage = getStorage();
      if (!storage) {
        return;
      }

      try {
        storage.setItem(
          API_CARDS_VISIBILITY_STORAGE_KEY,
          serializeApiCardsVisibility(visible),
        );
      } catch {
        // The initialized in-memory snapshot remains authoritative.
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      if (listeners.size === 1) {
        unsubscribeFromStorage =
          adapter.subscribeToStorageEvents(handleStorageEvent);
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribeFromStorage?.();
          unsubscribeFromStorage = undefined;
        }
      };
    },
  };
}

export const apiCardsVisibilityStore = createApiCardsVisibilityStore({
  getStorage: () =>
    typeof window === "undefined" ? null : window.localStorage,
  subscribeToStorageEvents: (listener) => {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    const handleStorage = (event: StorageEvent) => {
      listener({
        key: event.key,
        newValue: event.newValue,
        storageArea: event.storageArea,
      });
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  },
});
