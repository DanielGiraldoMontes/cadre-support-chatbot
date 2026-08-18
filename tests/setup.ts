import "@testing-library/jest-dom/vitest";

// Node 22+ ships an experimental global `localStorage` that, depending on
// version/flags, can end up shadowing jsdom's implementation and leaving
// `window.localStorage` undefined. Force jsdom's own storage in whenever
// that happens, so tests don't depend on the Node version running them.
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
}
