import assert from "node:assert/strict";
import test from "node:test";

import {
  API_CARDS_VISIBILITY_STORAGE_KEY,
  createApiCardsVisibilityStore,
  parseStoredApiCardsVisibility,
  serializeApiCardsVisibility,
  shouldRenderApiCards,
  type ApiCardsVisibilityStorage,
  type ApiCardsVisibilityStorageEvent,
} from "../lib/api-card-visibility";

function createHarness(options?: {
  storedValue?: string | null;
  readError?: Error;
  writeError?: Error;
}) {
  let storedValue = options?.storedValue ?? null;
  let storageListener:
    | ((event: ApiCardsVisibilityStorageEvent) => void)
    | undefined;
  let storageSubscriptions = 0;
  let storageUnsubscriptions = 0;
  let writes = 0;

  const storage: ApiCardsVisibilityStorage = {
    getItem() {
      if (options?.readError) throw options.readError;
      return storedValue;
    },
    setItem(_key, value) {
      writes += 1;
      if (options?.writeError) throw options.writeError;
      storedValue = value;
    },
  };

  const store = createApiCardsVisibilityStore({
    getStorage: () => storage,
    subscribeToStorageEvents(listener) {
      storageSubscriptions += 1;
      storageListener = listener;
      return () => {
        storageUnsubscriptions += 1;
        storageListener = undefined;
      };
    },
  });

  return {
    store,
    storage,
    emitStorage(event: ApiCardsVisibilityStorageEvent) {
      storageListener?.(event);
    },
    get writes() {
      return writes;
    },
    get storageSubscriptions() {
      return storageSubscriptions;
    },
    get storageUnsubscriptions() {
      return storageUnsubscriptions;
    },
  };
}

test("uses a hydration-safe server snapshot then initializes visible by default", () => {
  const { store } = createHarness();

  assert.deepEqual(store.getServerSnapshot(), {
    initialized: false,
    visible: true,
  });
  assert.equal(store.getSnapshot(), store.getServerSnapshot());

  store.initialize();

  assert.deepEqual(store.getSnapshot(), {
    initialized: true,
    visible: true,
  });
});

test("renders documentation cards only after an initialized visible snapshot", () => {
  assert.equal(
    shouldRenderApiCards({ initialized: false, visible: true }),
    false,
  );
  assert.equal(
    shouldRenderApiCards({ initialized: true, visible: false }),
    false,
  );
  assert.equal(
    shouldRenderApiCards({ initialized: true, visible: true }),
    true,
  );
});

test("initializes to the visible default when storage reads throw", () => {
  const { store } = createHarness({ readError: new Error("blocked") });

  store.initialize();

  assert.deepEqual(store.getSnapshot(), {
    initialized: true,
    visible: true,
  });
});

test("keeps the in-memory value authoritative when storage writes throw", () => {
  const { store } = createHarness({
    storedValue: "true",
    writeError: new Error("quota"),
  });
  store.initialize();

  store.setVisibility(false);

  assert.deepEqual(store.getSnapshot(), {
    initialized: true,
    visible: false,
  });
});

test("notifies every same-tab subscriber once when visibility changes", () => {
  const { store } = createHarness();
  store.initialize();
  let firstCalls = 0;
  let secondCalls = 0;
  const unsubscribeFirst = store.subscribe(() => {
    firstCalls += 1;
  });
  const unsubscribeSecond = store.subscribe(() => {
    secondCalls += 1;
  });

  store.setVisibility(false);

  assert.equal(firstCalls, 1);
  assert.equal(secondCalls, 1);
  unsubscribeFirst();
  unsubscribeSecond();
});

test("applies relevant localStorage updates and key-null clears", () => {
  const harness = createHarness();
  const { store, storage } = harness;
  store.initialize();
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });

  harness.emitStorage({
    key: API_CARDS_VISIBILITY_STORAGE_KEY,
    newValue: "false",
    storageArea: storage,
  });
  assert.equal(store.getSnapshot().visible, false);

  harness.emitStorage({
    key: null,
    newValue: null,
    storageArea: storage,
  });
  assert.equal(store.getSnapshot().visible, true);
  assert.equal(calls, 2);
  unsubscribe();
});

test("ignores unrelated keys and non-local storage areas", () => {
  const harness = createHarness();
  const { store, storage } = harness;
  const sessionStorage: ApiCardsVisibilityStorage = {
    getItem: () => "false",
    setItem: () => undefined,
  };
  store.initialize();
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });

  harness.emitStorage({
    key: "another-key",
    newValue: "false",
    storageArea: storage,
  });
  harness.emitStorage({
    key: API_CARDS_VISIBILITY_STORAGE_KEY,
    newValue: "false",
    storageArea: sessionStorage,
  });

  assert.equal(store.getSnapshot().visible, true);
  assert.equal(calls, 0);
  unsubscribe();
});

test("removes storage listeners after the last subscriber unsubscribes", () => {
  const harness = createHarness();
  const firstUnsubscribe = harness.store.subscribe(() => undefined);
  const secondUnsubscribe = harness.store.subscribe(() => undefined);

  assert.equal(harness.storageSubscriptions, 1);
  firstUnsubscribe();
  assert.equal(harness.storageUnsubscriptions, 0);
  secondUnsubscribe();
  assert.equal(harness.storageUnsubscriptions, 1);
});

test("cross-tab updates do not write or create an event feedback loop", () => {
  const harness = createHarness();
  const { store, storage } = harness;
  store.initialize();
  const unsubscribe = store.subscribe(() => undefined);

  harness.emitStorage({
    key: API_CARDS_VISIBILITY_STORAGE_KEY,
    newValue: "false",
    storageArea: storage,
  });

  assert.equal(harness.writes, 0);
  unsubscribe();
});

test("parses only the stored false value as hidden", () => {
  assert.equal(parseStoredApiCardsVisibility(null), true);
  assert.equal(parseStoredApiCardsVisibility("false"), false);
  assert.equal(parseStoredApiCardsVisibility("true"), true);
  assert.equal(parseStoredApiCardsVisibility("invalid"), true);
});

test("serializes API request card visibility as stable boolean strings", () => {
  assert.equal(serializeApiCardsVisibility(true), "true");
  assert.equal(serializeApiCardsVisibility(false), "false");
  assert.equal(
    API_CARDS_VISIBILITY_STORAGE_KEY,
    "employees-management:show-api-request-cards",
  );
});
