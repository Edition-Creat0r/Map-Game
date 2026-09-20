// ============================================================
// MAP GAME — roads.js
// Alpha 0.2.2C1 — connected road graph foundation
// ============================================================
(() => {
  "use strict";

  const ROAD_TYPES =
    window.mapGameWorldConfig?.roadClasses || {};

  const graphs = new Map();

  const ROAD_ORDER = [
    "dirt",
    "road2",
    "avenue4",
    "highway",
    "freeway"
  ];

  function graphFor(territoryId) {
    if (!graphs.has(territoryId)) {
      graphs.set(territoryId, {
        territoryId,
        nodes: new Map(),
        segments: new Map(),
        nextNode: 1,
        nextSegment: 1
      });
    }

    return graphs.get(territoryId);
  }

  function distancePointToSegment(px, pz, ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;

    if (len2 <= 0.000001) {
      return {
        distance: Math.hypot(px - ax, pz - az),
        x: ax,
        z: az,
        t: 0
      };
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((px - ax) * dx + (pz - az) * dz) / len2
      )
    );

    const x = ax + dx * t;
    const z = az + dz * t;

    return {
      distance: Math.hypot(px - x, pz - z),
      x,
      z,
      t
    };
  }

  function nearestNode(territoryId, x, z, maxDistance = Infinity) {
    const g = graphFor(territoryId);
    let best = null;
    let bestD = Number(maxDistance);

    for (const node of g.nodes.values()) {
      const d = Math.hypot(node.x - x, node.z - z);

      if (d <= bestD) {
        best = node;
        bestD = d;
      }
    }

    return best;
  }

  function nearestSegment(territoryId, x, z, maxDistance = Infinity) {
    const g = graphFor(territoryId);
    let best = null;
    let bestProjection = null;
    let bestD = Number(maxDistance);

    for (const segment of g.segments.values()) {
      const a = g.nodes.get(segment.a);
      const b = g.nodes.get(segment.b);

      if (!a || !b) continue;

      const projection =
        distancePointToSegment(
          x,
          z,
          a.x,
          a.z,
          b.x,
          b.z
        );

      if (projection.distance <= bestD) {
        best = segment;
        bestProjection = projection;
        bestD = projection.distance;
      }
    }

    return best
      ? {
          segment: best,
          ...bestProjection
        }
      : null;
  }

  function addNode(territoryId, x, z, metadata = {}) {
    const g = graphFor(territoryId);

    const node = {
      id: `N${g.nextNode++}`,
      x: Number(x),
      z: Number(z),
      metadata: { ...metadata }
    };

    g.nodes.set(node.id, node);
    return node;
  }

  function rawAddSegment(
    territoryId,
    aId,
    bId,
    type = "road2",
    metadata = {}
  ) {
    const g = graphFor(territoryId);
    const spec = ROAD_TYPES[type] || {
      id: type,
      width: 14,
      speed: 50,
      costPer100m: 240
    };

    const a = g.nodes.get(aId);
    const b = g.nodes.get(bId);

    if (!a || !b) {
      throw new Error("Road endpoint does not exist.");
    }

    const length =
      Math.hypot(
        b.x - a.x,
        b.z - a.z
      );

    if (length < 3) {
      throw new Error("Road segment is too short.");
    }

    const segment = {
      id: `R${g.nextSegment++}`,
      a: a.id,
      b: b.id,
      type: spec.id || type,
      width: Number(spec.width || 14),
      speed: Number(spec.speed || 50),
      lanes: Number(spec.lanes || 2),
      length,
      cost:
        Math.ceil(
          length / 100 *
          Number(spec.costPer100m || 0)
        ),
      metadata: { ...metadata }
    };

    g.segments.set(segment.id, segment);
    return segment;
  }

  function cleanupOrphanNodes(territoryId) {
    const g = graphFor(territoryId);
    const used = new Set();

    for (const segment of g.segments.values()) {
      used.add(segment.a);
      used.add(segment.b);
    }

    for (const id of [...g.nodes.keys()]) {
      if (!used.has(id)) {
        g.nodes.delete(id);
      }
    }
  }

  function lineIntersection(a, b, c, d) {
    const rX = b.x - a.x;
    const rZ = b.z - a.z;
    const sX = d.x - c.x;
    const sZ = d.z - c.z;

    const denom = rX * sZ - rZ * sX;

    if (Math.abs(denom) < 0.00001) {
      return null;
    }

    const cax = c.x - a.x;
    const caz = c.z - a.z;

    const t =
      (cax * sZ - caz * sX) / denom;

    const u =
      (cax * rZ - caz * rX) / denom;

    if (
      t <= 0.002 ||
      t >= 0.998 ||
      u <= 0.002 ||
      u >= 0.998
    ) {
      return null;
    }

    return {
      x: a.x + t * rX,
      z: a.z + t * rZ,
      t,
      u
    };
  }

  function splitSegmentAt(
    territoryId,
    segmentId,
    x,
    z
  ) {
    const g = graphFor(territoryId);
    const segment = g.segments.get(segmentId);

    if (!segment) return null;

    const a = g.nodes.get(segment.a);
    const b = g.nodes.get(segment.b);

    if (!a || !b) return null;

    if (Math.hypot(a.x - x, a.z - z) <= 2) {
      return a;
    }

    if (Math.hypot(b.x - x, b.z - z) <= 2) {
      return b;
    }

    const middle =
      addNode(
        territoryId,
        x,
        z,
        { intersection: true }
      );

    g.segments.delete(segment.id);

    rawAddSegment(
      territoryId,
      a.id,
      middle.id,
      segment.type,
      {
        ...segment.metadata,
        splitFrom: segment.id
      }
    );

    rawAddSegment(
      territoryId,
      middle.id,
      b.id,
      segment.type,
      {
        ...segment.metadata,
        splitFrom: segment.id
      }
    );

    return middle;
  }

  function snapPoint(
    territoryId,
    x,
    z,
    maxDistance = 24,
    {
      allowSplit = true
    } = {}
  ) {
    const node =
      nearestNode(
        territoryId,
        x,
        z,
        maxDistance
      );

    if (node) {
      return {
        x: node.x,
        z: node.z,
        node,
        kind: "node",
        snapped: true
      };
    }

    const hit =
      nearestSegment(
        territoryId,
        x,
        z,
        maxDistance
      );

    if (hit) {
      if (
        allowSplit &&
        hit.t > 0.04 &&
        hit.t < 0.96
      ) {
        const split =
          splitSegmentAt(
            territoryId,
            hit.segment.id,
            hit.x,
            hit.z
          );

        if (split) {
          return {
            x: split.x,
            z: split.z,
            node: split,
            kind: "segment",
            snapped: true
          };
        }
      }

      const g = graphFor(territoryId);
      const a = g.nodes.get(hit.segment.a);
      const b = g.nodes.get(hit.segment.b);

      const endpoint =
        Math.hypot(a.x - hit.x, a.z - hit.z) <
        Math.hypot(b.x - hit.x, b.z - hit.z)
          ? a
          : b;

      return {
        x: endpoint.x,
        z: endpoint.z,
        node: endpoint,
        kind: "segment-end",
        snapped: true
      };
    }

    return {
      x,
      z,
      node: null,
      kind: "free",
      snapped: false
    };
  }

  function estimateSegment(
    territoryId,
    {
      ax,
      az,
      bx,
      bz,
      type = "road2"
    }
  ) {
    const spec = ROAD_TYPES[type] || {};
    const length =
      Math.hypot(
        Number(bx) - Number(ax),
        Number(bz) - Number(az)
      );

    return {
      length,
      cost:
        Math.ceil(
          length / 100 *
          Number(spec.costPer100m || 0)
        ),
      width: Number(spec.width || 14),
      speed: Number(spec.speed || 50),
      lanes: Number(spec.lanes || 2)
    };
  }

  function validateConnectedStart(
    territoryId,
    point,
    capitalPoint,
    {
      snapDistance = 28,
      capitalStartDistance = 130
    } = {}
  ) {
    const g = graphFor(territoryId);

    if (g.segments.size === 0) {
      if (!capitalPoint) {
        return {
          allowed: false,
          reason:
            "Establish a capital before starting the road network."
        };
      }

      const d =
        Math.hypot(
          point.x - capitalPoint.x,
          point.z - capitalPoint.z
        );

      return d <= capitalStartDistance
        ? {
            allowed: true,
            reason:
              "Starter road connected to the capital."
          }
        : {
            allowed: false,
            reason:
              "Your first road must begin near the capital."
          };
    }

    const node =
      nearestNode(
        territoryId,
        point.x,
        point.z,
        snapDistance
      );

    const segment =
      nearestSegment(
        territoryId,
        point.x,
        point.z,
        snapDistance
      );

    return node || segment
      ? {
          allowed: true,
          reason:
            "Connected to the existing road network."
        }
      : {
          allowed: false,
          reason:
            "Start from an existing road or intersection."
        };
  }

  function addConnectedSegment(
    territoryId,
    {
      ax,
      az,
      bx,
      bz,
      type = "road2",
      snapDistance = 28,
      capitalPoint = null,
      metadata = {}
    }
  ) {
    const g = graphFor(territoryId);

    const startValidation =
      validateConnectedStart(
        territoryId,
        { x: ax, z: az },
        capitalPoint,
        { snapDistance }
      );

    if (!startValidation.allowed) {
      throw new Error(startValidation.reason);
    }

    const startSnap =
      snapPoint(
        territoryId,
        ax,
        az,
        snapDistance,
        { allowSplit: true }
      );

    let startNode = startSnap.node;

    if (!startNode) {
      startNode =
        addNode(
          territoryId,
          startSnap.x,
          startSnap.z,
          {
            starter:
              g.segments.size === 0
          }
        );
    }

    const endSnap =
      snapPoint(
        territoryId,
        bx,
        bz,
        snapDistance,
        { allowSplit: true }
      );

    let endNode = endSnap.node;

    if (!endNode) {
      endNode =
        addNode(
          territoryId,
          endSnap.x,
          endSnap.z,
          {}
        );
    }

    if (startNode.id === endNode.id) {
      throw new Error(
        "Road segment is too short."
      );
    }

    const a = {
      x: startNode.x,
      z: startNode.z
    };

    const b = {
      x: endNode.x,
      z: endNode.z
    };

    const intersections = [];

    for (const existing of [...g.segments.values()]) {
      const cNode = g.nodes.get(existing.a);
      const dNode = g.nodes.get(existing.b);

      if (!cNode || !dNode) continue;

      if (
        existing.a === startNode.id ||
        existing.b === startNode.id ||
        existing.a === endNode.id ||
        existing.b === endNode.id
      ) {
        continue;
      }

      const hit =
        lineIntersection(
          a,
          b,
          cNode,
          dNode
        );

      if (!hit) continue;

      intersections.push({
        ...hit,
        segmentId: existing.id
      });
    }

    intersections.sort(
      (p, q) => p.t - q.t
    );

    const chain = [startNode];

    for (const hit of intersections) {
      const middle =
        splitSegmentAt(
          territoryId,
          hit.segmentId,
          hit.x,
          hit.z
        );

      if (
        middle &&
        chain[chain.length - 1].id !== middle.id
      ) {
        chain.push(middle);
      }
    }

    chain.push(endNode);

    const created = [];

    for (let i = 0; i < chain.length - 1; i++) {
      if (chain[i].id === chain[i + 1].id) {
        continue;
      }

      created.push(
        rawAddSegment(
          territoryId,
          chain[i].id,
          chain[i + 1].id,
          type,
          metadata
        )
      );
    }

    return created;
  }

  function removeSegment(
    territoryId,
    segmentId
  ) {
    const g = graphFor(territoryId);
    const removed =
      g.segments.delete(segmentId);

    cleanupOrphanNodes(territoryId);
    return removed;
  }

  function upgradeSegment(
    territoryId,
    segmentId,
    newType
  ) {
    const g = graphFor(territoryId);
    const segment =
      g.segments.get(segmentId);

    if (!segment) {
      throw new Error(
        "Road segment not found."
      );
    }

    const currentRank =
      ROAD_ORDER.indexOf(segment.type);

    const nextRank =
      ROAD_ORDER.indexOf(newType);

    if (nextRank < 0) {
      throw new Error(
        "Unknown road type."
      );
    }

    if (
      currentRank >= 0 &&
      nextRank <= currentRank
    ) {
      throw new Error(
        "Choose a higher road class to upgrade."
      );
    }

    const spec =
      ROAD_TYPES[newType];

    const oldCost =
      Number(segment.cost || 0);

    const newCost =
      Math.ceil(
        segment.length / 100 *
        Number(spec.costPer100m || 0)
      );

    segment.type = newType;
    segment.width =
      Number(spec.width || segment.width);
    segment.speed =
      Number(spec.speed || segment.speed);
    segment.lanes =
      Number(spec.lanes || segment.lanes);
    segment.cost = newCost;

    return {
      segment,
      upgradeCost:
        Math.max(
          0,
          newCost - oldCost
        )
    };
  }

  function neighbors(g, id) {
    const out = [];

    for (const segment of g.segments.values()) {
      if (segment.a === id) {
        out.push({
          nodeId: segment.b,
          segment
        });
      } else if (segment.b === id) {
        out.push({
          nodeId: segment.a,
          segment
        });
      }
    }

    return out;
  }

  function pathExists(
    territoryId,
    startNodeId,
    endNodeId
  ) {
    const g = graphFor(territoryId);

    if (
      !g.nodes.has(startNodeId) ||
      !g.nodes.has(endNodeId)
    ) {
      return false;
    }

    const queue = [startNodeId];
    const seen = new Set(queue);

    while (queue.length) {
      const id = queue.shift();

      if (id === endNodeId) {
        return true;
      }

      for (const next of neighbors(g, id)) {
        if (!seen.has(next.nodeId)) {
          seen.add(next.nodeId);
          queue.push(next.nodeId);
        }
      }
    }

    return false;
  }

  function pointHasRoadAccess(
    territoryId,
    x,
    z,
    maxDistance = 45
  ) {
    const hit =
      nearestSegment(
        territoryId,
        x,
        z,
        maxDistance
      );

    return {
      allowed: Boolean(hit),
      distance:
        hit?.distance ?? Infinity,
      segmentId:
        hit?.segment?.id || null,
      type:
        hit?.segment?.type || null
    };
  }

  function canFoundSecondaryCity(
    territoryId,
    capitalPoint,
    proposedPoint,
    {
      maxCapitalSnap = 120,
      maxCitySnap = 120
    } = {}
  ) {
    const a =
      nearestNode(
        territoryId,
        capitalPoint.x,
        capitalPoint.z,
        maxCapitalSnap
      );

    const b =
      nearestNode(
        territoryId,
        proposedPoint.x,
        proposedPoint.z,
        maxCitySnap
      );

    if (!a || !b) {
      return {
        allowed: false,
        reason:
          "Build a connected road, highway or freeway to this site first."
      };
    }

    const connected =
      pathExists(
        territoryId,
        a.id,
        b.id
      );

    return {
      allowed: connected,
      reason:
        connected
          ? "Connected to the existing civilization."
          : "This site is not connected to your existing civilization by road.",
      capitalNodeId: a.id,
      cityNodeId: b.id
    };
  }

  function serialize(territoryId) {
    const g = graphFor(territoryId);

    return {
      version: "0.2.2C1",
      territoryId,
      nextNode: g.nextNode,
      nextSegment: g.nextSegment,
      nodes: [...g.nodes.values()],
      segments: [...g.segments.values()]
    };
  }

  function load(data) {
    if (!data?.territoryId) return;

    const g =
      graphFor(data.territoryId);

    g.nodes.clear();
    g.segments.clear();

    for (const node of data.nodes || []) {
      g.nodes.set(
        node.id,
        { ...node }
      );
    }

    for (const segment of data.segments || []) {
      g.segments.set(
        segment.id,
        { ...segment }
      );
    }

    const nodeNums =
      [...g.nodes.keys()]
        .map(id =>
          Number(
            String(id).replace(/\D/g, "")
          ) || 0
        );

    const segmentNums =
      [...g.segments.keys()]
        .map(id =>
          Number(
            String(id).replace(/\D/g, "")
          ) || 0
        );

    g.nextNode =
      Math.max(
        Number(data.nextNode || 1),
        ...nodeNums.map(v => v + 1),
        1
      );

    g.nextSegment =
      Math.max(
        Number(data.nextSegment || 1),
        ...segmentNums.map(v => v + 1),
        1
      );

    cleanupOrphanNodes(data.territoryId);
  }

  function storageKey(
    worldType,
    territoryId
  ) {
    return (
      "mapgame_roads_022c1_" +
      String(worldType || "singleplayer") +
      "_" +
      String(territoryId || "unknown")
    );
  }

  function saveLocal(
    worldType,
    territoryId
  ) {
    if (!territoryId) return;

    localStorage.setItem(
      storageKey(
        worldType,
        territoryId
      ),
      JSON.stringify(
        serialize(territoryId)
      )
    );
  }

  function loadLocal(
    worldType,
    territoryId
  ) {
    if (!territoryId) return null;

    const raw =
      localStorage.getItem(
        storageKey(
          worldType,
          territoryId
        )
      );

    if (!raw) return null;

    try {
      const data = JSON.parse(raw);
      load(data);
      return data;
    } catch (error) {
      console.warn(
        "Could not load saved road graph:",
        error
      );
      return null;
    }
  }

  window.mapGameRoads = {
    VERSION: "0.2.2C1",
    ROAD_TYPES,
    ROAD_ORDER,
    graphFor,
    nearestNode,
    nearestSegment,
    snapPoint,
    estimateSegment,
    validateConnectedStart,
    addConnectedSegment,
    removeSegment,
    upgradeSegment,
    pointHasRoadAccess,
    pathExists,
    canFoundSecondaryCity,
    serialize,
    load,
    saveLocal,
    loadLocal
  };

  console.log(
    "Map Game roads 0.2.2C1 connected road graph ready."
  );
})();
