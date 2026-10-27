// Public label projection only. Never authenticates, assigns ownership or evaluates policy.
(() => {
  const enabled = window.mapGameNamingConfig?.enabled === true,
    cache = new Map(),
    pending = new Map();
  let timer = null, busy = false;
  const fallback = (kind) => kind === "username" ? "Player" : "Unnamed city";
  function enqueue(kind, entity) {
    const key = kind + ":" + entity;
    if (pending.size < 1024) pending.set(key, { kind, entity });
    if (!timer) timer = setTimeout(flush, 50);
  }
  async function flush() {
    timer = null;
    if (!enabled || busy || !window.mapGameAuth?.client) return;
    const entries = [...pending.entries()].slice(0, 100);
    if (!entries.length) return;
    for (const [key] of entries) pending.delete(key);
    busy = true;
    try {
      const { data, error } = await window.mapGameAuth.client.rpc(
        "cw041_names_public_batch",
        { p_requests: entries.map(([, v]) => v) },
      );
      if (error) throw Error("Public names unavailable");
      for (const [key, entry] of entries) {
        const row = data?.enabled &&
          data.names?.find((n) =>
            n.kind === entry.kind && n.entity === entry.entity
          );
        cache.delete(key);
        cache.set(key, {
          value: typeof row?.display === "string"
            ? row.display
            : fallback(entry.kind),
          until: Date.now() + 10000,
        });
      }
    } catch (_) {
      for (const [key, entry] of entries) {
        cache.set(key, {
          value: fallback(entry.kind),
          until: Date.now() + 10000,
        });
      }
    } finally {
      busy = false;
      while (cache.size > 2048) cache.delete(cache.keys().next().value);
      window.dispatchEvent(new CustomEvent("mapgame:public-names-updated"));
      if (pending.size && !timer) timer = setTimeout(flush, 50);
    }
  }
  function get(kind, id) {
    if (!id) return fallback(kind);
    const key = kind + ":" + id, entry = cache.get(key);
    if (!entry || entry.until <= Date.now()) enqueue(kind, String(id));
    return entry && entry.until > Date.now() ? entry.value : fallback(kind);
  }
  function project(row, type) {
    if (!enabled || !row) return row;
    const next = { ...row };
    if (type === "presence") next.username = "Player";
    else next.owner_username = get("username", row.owner_id);
    if (type === "capital") next.name = get("city", row.owner_id);
    return next;
  }
  if (enabled) {
    setInterval(() => {
      if (!window.mapGameMultiplayer?.getState().connected) return;
      for (const [key, value] of cache) {
        if (value.until <= Date.now()) {
          const i = key.indexOf(":");
          enqueue(key.slice(0, i), key.slice(i + 1));
        }
      }
    }, 10000);
  }
  if (enabled) {
    window.document?.addEventListener("visibilitychange", () => {
      if (!window.document.hidden) {
        cache.clear();
        window.dispatchEvent(new CustomEvent("mapgame:public-names-updated"));
      }
    });
  }
  window.mapGamePublicNames = {
    enabled,
    username: (id) => get("username", id),
    project,
  };
})();
