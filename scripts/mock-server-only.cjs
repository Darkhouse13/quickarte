// Suppress server-only guard when running scripts outside Next.js
try {
  require.cache[require.resolve("server-only")] = {
    id: "server-only",
    filename: "server-only",
    loaded: true,
    exports: {},
    children: [],
    paths: [],
    parent: null,
  };
} catch {}
