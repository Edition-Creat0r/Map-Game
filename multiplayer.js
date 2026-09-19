// ============================================================
// MAP GAME — multiplayer.js
// Alpha 0.2.2B1.1 multiplayer + durable Central ownership recovery
//
// Current responsibilities:
// - Join / leave Central World
// - Realtime online presence
// - Persistent world membership
// - Shared territory claims
// - Shared capital records
// - Realtime territory/capital change events
// - One active Central session per account
//
// IMPORTANT:
// The old browser-device "alternate account" heuristic was removed because
// it can falsely flag normal relogins and stale browser sessions.
// Fast combat and authoritative simulation come later.
// ============================================================

(() => {
  "use strict";

  const WORLD_ID = "central";
  const WORLD_NAME = "Central World";

  let client = null;
  let channel = null;
  let currentUser = null;
  let connected = false;
  let joining = false;
  let heartbeatTimer = null;
  let sessionHeartbeatTimer = null;
  let sessionId = null;
  let sessionConflictHandling = false;

  const onlinePlayers = new Map();
  const territoryClaims = new Map();
  const capitals = new Map();
  const listeners = new Set();

  function requireClient() {
    if (
      !window.mapGameAuth ||
      !window.mapGameAuth.client
    ) {
      throw new Error(
        "Account service is unavailable. Make sure auth.js loads before multiplayer.js."
      );
    }

    client = window.mapGameAuth.client;
    return client;
  }

  function usernameFromUser(user) {
    const username =
      user &&
      user.user_metadata &&
      typeof user.user_metadata.username === "string"
        ? user.user_metadata.username.trim()
        : "";

    if (username) {
      return username;
    }

    if (
      user &&
      typeof user.email === "string" &&
      user.email.includes("@")
    ) {
      return user.email.split("@")[0];
    }

    return "Player";
  }

  function createSessionId() {
    return (
      (crypto && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : "session_" + Date.now() + "_" + Math.random().toString(36).slice(2)
    );
  }

  async function startProtectedSession(user) {
    const db = requireClient();
    sessionId = createSessionId();

    const { data, error } = await db.rpc(
      "map_game_start_session",
      {
        p_world_id: WORLD_ID,
        p_session_id: sessionId,
        p_username: usernameFromUser(user)
      }
    );

    if (error) {
      throw new Error(
        "Could not validate this Central World session: " +
        error.message
      );
    }

    if (data !== true) {
      throw new Error(
        "Central World could not start this session. Please try joining again."
      );
    }
  }

  async function checkProtectedSession() {
    if (!currentUser || !sessionId || sessionConflictHandling) {
      return;
    }

    const db = requireClient();

    const { data, error } = await db.rpc(
      "map_game_session_heartbeat",
      {
        p_world_id: WORLD_ID,
        p_session_id: sessionId
      }
    );

    if (error) {
      console.warn(
        "Map Game session heartbeat failed:",
        error.message
      );
      return;
    }

    if (data !== true) {
      await handleSessionConflict();
    }
  }

  async function endProtectedSession() {
    if (!sessionId) return;

    const db = client || window.mapGameAuth?.client;
    const endingSession = sessionId;
    sessionId = null;

    if (!db) return;

    try {
      await db.rpc(
        "map_game_end_session",
        {
          p_world_id: WORLD_ID,
          p_session_id: endingSession
        }
      );
    } catch (_) {}
  }

  async function handleSessionConflict() {
    if (sessionConflictHandling) return;
    sessionConflictHandling = true;

    try {
      window.dispatchEvent(
        new CustomEvent(
          "mapgame:session-conflict",
          {
            detail: {
              message:
                "This account joined Central World in another session, so this older session was disconnected."
            }
          }
        )
      );

      await leaveWorld({ skipSessionEnd: true });

      try {
        await window.mapGameAuth?.signOut?.();
      } catch (_) {}
    } finally {
      sessionConflictHandling = false;
    }
  }

  function stateSnapshot() {
    return {
      connected,
      worldId: WORLD_ID,
      worldName: WORLD_NAME,
      user: currentUser,
      onlineCount: onlinePlayers.size,
      onlinePlayers: Array.from(onlinePlayers.values()),
      territoryClaims: Array.from(territoryClaims.values()),
      capitals: Array.from(capitals.values())
    };
  }

  function emitState() {
    const snapshot = stateSnapshot();

    listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (error) {
        console.error(
          "Map Game multiplayer state listener failed:",
          error
        );
      }
    });
  }

  function rebuildPresence(presenceState) {
    onlinePlayers.clear();

    Object.keys(presenceState || {}).forEach(key => {
      const entries = presenceState[key];

      if (!Array.isArray(entries)) {
        return;
      }

      entries.forEach(entry => {
        if (!entry || !entry.userId) {
          return;
        }

        onlinePlayers.set(
          entry.userId,
          {
            userId: entry.userId,
            username: entry.username || "Player",
            onlineAt: entry.onlineAt || null
          }
        );
      });
    });

    emitState();
  }

  async function ensureMembership(user) {
    const db = requireClient();

    const payload = {
      world_id: WORLD_ID,
      user_id: user.id,
      username: usernameFromUser(user),
      last_seen: new Date().toISOString()
    };

    const {
      error
    } =
      await db
        .from("world_members")
        .upsert(
          payload,
          {
            onConflict: "world_id,user_id"
          }
        );

    if (error) {
      throw new Error(
        "Could not register this player in Central World: " +
        error.message
      );
    }
  }

  async function touchMembership() {
    if (!currentUser) {
      return;
    }

    const db = requireClient();

    const {
      error
    } =
      await db
        .from("world_members")
        .update({
          last_seen:
            new Date().toISOString()
        })
        .eq(
          "world_id",
          WORLD_ID
        )
        .eq(
          "user_id",
          currentUser.id
        );

    if (error) {
      console.warn(
        "Map Game multiplayer heartbeat failed:",
        error.message
      );
    }
  }

  async function loadTerritories() {
    const db = requireClient();

    const {
      data,
      error
    } =
      await db
        .from("territory_claims")
        .select("*")
        .eq(
          "world_id",
          WORLD_ID
        );

    if (error) {
      throw new Error(
        "Could not load territory ownership: " +
        error.message
      );
    }

    territoryClaims.clear();

    (data || []).forEach(row => {
      territoryClaims.set(
        row.territory_id,
        row
      );
    });
  }

  async function refreshMyOwnership() {
    if (!currentUser) return [];

    const db = requireClient();

    const {
      data: ownedRows,
      error: ownedError
    } =
      await db
        .from("territory_claims")
        .select("*")
        .eq("world_id", WORLD_ID)
        .eq("owner_id", currentUser.id);

    if (ownedError) {
      console.warn(
        "Map Game direct ownership recovery failed:",
        ownedError.message
      );
    } else {
      (ownedRows || []).forEach(row => {
        if (row?.territory_id) {
          territoryClaims.set(
            row.territory_id,
            row
          );
        }
      });
    }

    let mine =
      Array.from(territoryClaims.values())
        .filter(
          row =>
            row &&
            row.owner_id === currentUser.id
        );

    // Legacy recovery from an existing capital record.
    if (!mine.length) {
      const {
        data: capitalRow,
        error: capitalError
      } =
        await db
          .from("capitals")
          .select("*")
          .eq("world_id", WORLD_ID)
          .eq("owner_id", currentUser.id)
          .maybeSingle();

      if (!capitalError && capitalRow?.territory_id) {
        capitals.set(
          currentUser.id,
          capitalRow
        );

        const {
          data: territoryRow,
          error: territoryError
        } =
          await db
            .from("territory_claims")
            .select("*")
            .eq("world_id", WORLD_ID)
            .eq(
              "territory_id",
              capitalRow.territory_id
            )
            .maybeSingle();

        if (
          !territoryError &&
          territoryRow?.owner_id === currentUser.id
        ) {
          territoryClaims.set(
            territoryRow.territory_id,
            territoryRow
          );
        } else if (
          !territoryError &&
          !territoryRow
        ) {
          const recoveryRow = {
            world_id: WORLD_ID,
            territory_id:
              capitalRow.territory_id,
            owner_id:
              currentUser.id,
            owner_username:
              usernameFromUser(currentUser)
          };

          const {
            data: repaired,
            error: repairError
          } =
            await db
              .from("territory_claims")
              .insert(recoveryRow)
              .select()
              .single();

          if (!repairError && repaired) {
            territoryClaims.set(
              repaired.territory_id,
              repaired
            );

            console.log(
              "Map Game restored legacy territory ownership:",
              repaired.territory_id
            );
          } else if (repairError) {
            console.warn(
              "Map Game could not restore legacy territory claim:",
              repairError.message
            );
          }
        }
      }
    }

    mine =
      Array.from(territoryClaims.values())
        .filter(
          row =>
            row &&
            row.owner_id === currentUser.id
        );

    emitState();
    return mine;
  }


  async function loadCapitals() {
    const db = requireClient();

    const {
      data,
      error
    } =
      await db
        .from("capitals")
        .select("*")
        .eq(
          "world_id",
          WORLD_ID
        );

    if (error) {
      throw new Error(
        "Could not load capitals: " +
        error.message
      );
    }

    capitals.clear();

    (data || []).forEach(row => {
      capitals.set(
        row.owner_id,
        row
      );
    });
  }

  function applyTerritoryRealtime(payload) {
    if (!payload) {
      return;
    }

    if (
      payload.eventType === "DELETE" &&
      payload.old &&
      payload.old.territory_id
    ) {
      territoryClaims.delete(
        payload.old.territory_id
      );
      emitState();
      return;
    }

    const row =
      payload.new;

    if (
      row &&
      row.world_id === WORLD_ID &&
      row.territory_id
    ) {
      territoryClaims.set(
        row.territory_id,
        row
      );
      emitState();
    }
  }

  function applyCapitalRealtime(payload) {
    if (!payload) {
      return;
    }

    if (
      payload.eventType === "DELETE" &&
      payload.old &&
      payload.old.owner_id
    ) {
      capitals.delete(
        payload.old.owner_id
      );
      emitState();
      return;
    }

    const row =
      payload.new;

    if (
      row &&
      row.world_id === WORLD_ID &&
      row.owner_id
    ) {
      capitals.set(
        row.owner_id,
        row
      );
      emitState();
    }
  }

  async function createRealtimeChannel() {
    const db = requireClient();

    if (channel) {
      try {
        await db.removeChannel(channel);
      } catch (_) {}
      channel = null;
    }

    channel =
      db.channel(
        "map-game-central-world",
        {
          config: {
            presence: {
              key:
                currentUser.id
            }
          }
        }
      );

    channel
      .on(
        "presence",
        {
          event: "sync"
        },
        () => {
          rebuildPresence(
            channel.presenceState()
          );
        }
      )
      .on(
        "presence",
        {
          event: "join"
        },
        () => {
          rebuildPresence(
            channel.presenceState()
          );
        }
      )
      .on(
        "presence",
        {
          event: "leave"
        },
        () => {
          rebuildPresence(
            channel.presenceState()
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "territory_claims",
          filter:
            `world_id=eq.${WORLD_ID}`
        },
        applyTerritoryRealtime
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "capitals",
          filter:
            `world_id=eq.${WORLD_ID}`
        },
        applyCapitalRealtime
      );

    await new Promise(
      (resolve, reject) => {
        let finished = false;

        const timeout =
          setTimeout(
            () => {
              if (finished) {
                return;
              }

              finished = true;

              reject(
                new Error(
                  "Central World connection timed out."
                )
              );
            },
            12000
          );

        channel.subscribe(
          async status => {
            if (finished) {
              return;
            }

            if (
              status ===
              "SUBSCRIBED"
            ) {
              try {
                await channel.track({
                  userId:
                    currentUser.id,
                  username:
                    usernameFromUser(
                      currentUser
                    ),
                  onlineAt:
                    new Date().toISOString()
                });

                finished = true;
                clearTimeout(timeout);
                resolve();
              } catch (error) {
                finished = true;
                clearTimeout(timeout);
                reject(error);
              }
            } else if (
              status ===
                "CHANNEL_ERROR" ||
              status ===
                "TIMED_OUT"
            ) {
              finished = true;
              clearTimeout(timeout);

              reject(
                new Error(
                  "Supabase Realtime could not connect."
                )
              );
            }
          }
        );
      }
    );
  }

  async function joinCentralWorld() {
    if (joining) {
      throw new Error(
        "Already connecting to Central World."
      );
    }

    if (connected) {
      return stateSnapshot();
    }

    joining = true;

    try {
      const db =
        requireClient();

      const {
        data,
        error
      } =
        await db.auth.getUser();

      if (error) {
        throw error;
      }

      if (
        !data ||
        !data.user
      ) {
        throw new Error(
          "Sign in before joining Central World."
        );
      }

      currentUser =
        data.user;

      // Server-backed duplicate-session guard.
      // Exactly one active Central World session is kept per account.
      // A new join replaces any stale/older session for the same account.
      await startProtectedSession(
        currentUser
      );

      await ensureMembership(
        currentUser
      );

      await Promise.all([
        loadTerritories(),
        loadCapitals()
      ]);

      await refreshMyOwnership();

      await createRealtimeChannel();

      connected = true;

      if (heartbeatTimer) {
        clearInterval(
          heartbeatTimer
        );
      }

      heartbeatTimer =
        setInterval(
          touchMembership,
          60000
        );

      if (sessionHeartbeatTimer) {
        clearInterval(sessionHeartbeatTimer);
      }

      sessionHeartbeatTimer =
        setInterval(
          checkProtectedSession,
          10000
        );

      emitState();

      console.log(
        "Map Game multiplayer connected:",
        WORLD_ID
      );

      return stateSnapshot();
    } finally {
      joining = false;
    }
  }

  async function leaveWorld(options = {}) {
    const db =
      client ||
      (
        window.mapGameAuth &&
        window.mapGameAuth.client
      );

    if (
      channel &&
      db
    ) {
      try {
        await channel.untrack();
      } catch (_) {}

      try {
        await db.removeChannel(
          channel
        );
      } catch (_) {}
    }

    channel = null;
    connected = false;
    onlinePlayers.clear();

    if (heartbeatTimer) {
      clearInterval(
        heartbeatTimer
      );
      heartbeatTimer = null;
    }

    if (sessionHeartbeatTimer) {
      clearInterval(sessionHeartbeatTimer);
      sessionHeartbeatTimer = null;
    }

    if (!options.skipSessionEnd) {
      await endProtectedSession();
    } else {
      sessionId = null;
    }

    emitState();
  }

  async function claimTerritory(
    territoryId
  ) {
    if (!connected) {
      throw new Error(
        "Join Central World before claiming territory."
      );
    }

    if (
      typeof territoryId !== "string" ||
      territoryId.trim().length < 1
    ) {
      throw new Error(
        "Invalid territory."
      );
    }

    const id =
      territoryId.trim();

    const existing =
      territoryClaims.get(id);

    if (existing) {
      if (
        existing.owner_id ===
        currentUser.id
      ) {
        return existing;
      }

      throw new Error(
        "That territory has already been claimed."
      );
    }

    const db =
      requireClient();

    const row = {
      world_id:
        WORLD_ID,
      territory_id:
        id,
      owner_id:
        currentUser.id,
      owner_username:
        usernameFromUser(
          currentUser
        )
    };

    const {
      data,
      error
    } =
      await db
        .from(
          "territory_claims"
        )
        .insert(row)
        .select()
        .single();

    if (error) {
      if (
        error.code === "23505"
      ) {
        throw new Error(
          "Another player claimed that territory first."
        );
      }

      throw new Error(
        "Could not claim territory: " +
        error.message
      );
    }

    territoryClaims.set(
      id,
      data
    );

    emitState();

    return data;
  }

  async function establishCapital({
    territoryId,
    name,
    x,
    z
  }) {
    if (!connected) {
      throw new Error(
        "Join Central World before establishing a capital."
      );
    }

    const territory =
      territoryClaims.get(
        territoryId
      );

    if (
      !territory ||
      territory.owner_id !==
        currentUser.id
    ) {
      throw new Error(
        "Your capital must be inside territory you own."
      );
    }

    const cleanName =
      String(name || "")
        .trim()
        .slice(0, 32);

    if (
      cleanName.length < 2
    ) {
      throw new Error(
        "Capital name must be at least 2 characters."
      );
    }

    const safeX =
      Number(x);

    const safeZ =
      Number(z);

    if (
      !Number.isFinite(safeX) ||
      !Number.isFinite(safeZ)
    ) {
      throw new Error(
        "Invalid capital position."
      );
    }

    const db =
      requireClient();

    const row = {
      world_id:
        WORLD_ID,
      owner_id:
        currentUser.id,
      owner_username:
        usernameFromUser(
          currentUser
        ),
      territory_id:
        territoryId,
      name:
        cleanName,
      x:
        safeX,
      z:
        safeZ
    };

    const {
      data,
      error
    } =
      await db
        .from("capitals")
        .upsert(
          row,
          {
            onConflict:
              "world_id,owner_id"
          }
        )
        .select()
        .single();

    if (error) {
      throw new Error(
        "Could not establish capital: " +
        error.message
      );
    }

    capitals.set(
      currentUser.id,
      data
    );

    emitState();

    return data;
  }

  function getTerritory(
    territoryId
  ) {
    return (
      territoryClaims.get(
        territoryId
      ) || null
    );
  }

  function getMyTerritories() {
    if (!currentUser) {
      return [];
    }

    return Array.from(
      territoryClaims.values()
    ).filter(
      row =>
        row.owner_id ===
        currentUser.id
    );
  }

  function getMyCapital() {
    if (!currentUser) {
      return null;
    }

    return (
      capitals.get(
        currentUser.id
      ) || null
    );
  }

  function onStateChange(
    listener
  ) {
    if (
      typeof listener !==
      "function"
    ) {
      return () => {};
    }

    listeners.add(
      listener
    );

    try {
      listener(
        stateSnapshot()
      );
    } catch (_) {}

    return () => {
      listeners.delete(
        listener
      );
    };
  }

  window.addEventListener(
    "beforeunload",
    () => {
      if (
        channel &&
        typeof channel.untrack ===
          "function"
      ) {
        try {
          channel.untrack();
        } catch (_) {}
      }

      // Best effort only. Stale sessions are automatically ignored
      // server-side after the heartbeat timeout.
      try {
        endProtectedSession();
      } catch (_) {}
    }
  );

  window.mapGameMultiplayer = {
    WORLD_ID,
    WORLD_NAME,
    joinCentralWorld,
    leaveWorld,
    claimTerritory,
    establishCapital,
    getTerritory,
    getMyTerritories,
    getMyCapital,
    refreshMyOwnership,
    getState:
      stateSnapshot,
    onStateChange
  };

  console.log(
    "Map Game multiplayer 0.2.2B1.1 durable ownership recovery ready."
  );
})();
