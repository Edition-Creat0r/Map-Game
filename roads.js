// ============================================================
// MAP GAME — roads.js
// Alpha 0.2.2C1.5 — curved / elevated road graph
//
// Major changes:
// - roads store sampled 3D alignments instead of only straight endpoints
// - same-level crossings become graph intersections
// - grade-separated crossings do NOT connect
// - spline/elevation data survives save/load
// - road access uses the real curved alignment
// ============================================================
(() => {
  "use strict";

  const ROAD_TYPES =
    window.mapGameWorldConfig?.roadClasses || {};

  const ROAD_ORDER = [
    "dirt",
    "road2",
    "avenue4",
    "highway",
    "freeway"
  ];

  const graphs = new Map();

  const SAME_LEVEL_TOLERANCE = 2.75;
  const DEFAULT_SAMPLES = 22;

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

  function dist2D(a, b) {
    return Math.hypot(
      Number(b.x) - Number(a.x),
      Number(b.z) - Number(a.z)
    );
  }

  function clonePoint(p) {
    return {
      x: Number(p.x || 0),
      y: Number(p.y || 0),
      z: Number(p.z || 0)
    };
  }

  function smoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  function quadraticPoint(a, c, b, t) {
    const u = 1 - t;
    return {
      x:
        u * u * a.x +
        2 * u * t * c.x +
        t * t * b.x,
      z:
        u * u * a.z +
        2 * u * t * c.z +
        t * t * b.z
    };
  }

  function buildPath({
    ax,
    ay = 0,
    az,
    bx,
    by = 0,
    bz,
    curve = 0,
    samples = DEFAULT_SAMPLES
  }) {
    const a = {
      x: Number(ax),
      y: Number(ay),
      z: Number(az)
    };

    const b = {
      x: Number(bx),
      y: Number(by),
      z: Number(bz)
    };

    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);

    if (length < 0.001) {
      return [a, b];
    }

    const nx = -dz / length;
    const nz = dx / length;

    const maxOffset =
      Math.min(
        length * 0.65,
        420
      );

    const offset =
      Math.max(
        -1,
        Math.min(1, Number(curve || 0))
      ) * maxOffset;

    const control = {
      x: (a.x + b.x) / 2 + nx * offset,
      z: (a.z + b.z) / 2 + nz * offset
    };

    const count =
      Math.max(
        6,
        Math.min(
          80,
          Number(samples || DEFAULT_SAMPLES)
        )
      );

    const out = [];

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const horizontal =
        quadraticPoint(
          a,
          control,
          b,
          t
        );

      const verticalT =
        smoothstep(t);

      out.push({
        x: horizontal.x,
        y:
          a.y +
          (b.y - a.y) *
          verticalT,
        z: horizontal.z
      });
    }

    return out;
  }

  function pathLength(path) {
    let length = 0;

    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];

      length += Math.hypot(
        b.x - a.x,
        b.y - a.y,
        b.z - a.z
      );
    }

    return length;
  }

  function pathGrade(path) {
    let worst = 0;

    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];

      const horizontal =
        Math.hypot(
          b.x - a.x,
          b.z - a.z
        );

      if (horizontal <= 0.01) continue;

      worst =
        Math.max(
          worst,
          Math.abs(b.y - a.y) /
          horizontal
        );
    }

    return worst;
  }

  function pointToLine2D(
    px,
    pz,
    ax,
    az,
    bx,
    bz
  ) {
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;

    if (len2 <= 0.000001) {
      return {
        distance:
          Math.hypot(
            px - ax,
            pz - az
          ),
        x: ax,
        z: az,
        t: 0
      };
    }

    const t =
      Math.max(
        0,
        Math.min(
          1,
          (
            (px - ax) * dx +
            (pz - az) * dz
          ) / len2
        )
      );

    const x = ax + dx * t;
    const z = az + dz * t;

    return {
      distance:
        Math.hypot(
          px - x,
          pz - z
        ),
      x,
      z,
      t
    };
  }

  function nearestOnPath(
    path,
    x,
    z
  ) {
    if (!path?.length) return null;

    let best = null;

    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];

      const hit =
        pointToLine2D(
          x,
          z,
          a.x,
          a.z,
          b.x,
          b.z
        );

      if (
        !best ||
        hit.distance < best.distance
      ) {
        best = {
          ...hit,
          y:
            a.y +
            (b.y - a.y) * hit.t,
          pathIndex: i - 1
        };
      }
    }

    return best;
  }

  function addNode(
    territoryId,
    x,
    z,
    metadata = {},
    y = 0
  ) {
    const g = graphFor(territoryId);

    const node = {
      id: `N${g.nextNode++}`,
      x: Number(x),
      y: Number(y || 0),
      z: Number(z),
      metadata: {
        ...metadata
      }
    };

    g.nodes.set(node.id, node);
    return node;
  }

  function nearestNode(
    territoryId,
    x,
    z,
    maxDistance = Infinity,
    y = null,
    verticalTolerance = Infinity
  ) {
    const g = graphFor(territoryId);
    let best = null;
    let bestD =
      Number(maxDistance);

    for (const node of g.nodes.values()) {
      if (
        y !== null &&
        Math.abs(
          Number(node.y || 0) -
          Number(y)
        ) > verticalTolerance
      ) {
        continue;
      }

      const d =
        Math.hypot(
          node.x - x,
          node.z - z
        );

      if (d <= bestD) {
        best = node;
        bestD = d;
      }
    }

    return best;
  }

  function normalizeSegmentPath(
    g,
    segment
  ) {
    if (
      Array.isArray(segment.path) &&
      segment.path.length >= 2
    ) {
      return segment.path.map(clonePoint);
    }

    const a = g.nodes.get(segment.a);
    const b = g.nodes.get(segment.b);

    if (!a || !b) return [];

    return [
      clonePoint(a),
      clonePoint(b)
    ];
  }

  function nearestSegment(
    territoryId,
    x,
    z,
    maxDistance = Infinity,
    y = null,
    verticalTolerance = Infinity
  ) {
    const g = graphFor(territoryId);

    let best = null;
    let bestD =
      Number(maxDistance);

    for (const segment of g.segments.values()) {
      const path =
        normalizeSegmentPath(
          g,
          segment
        );

      const hit =
        nearestOnPath(
          path,
          x,
          z
        );

      if (!hit) continue;

      if (
        y !== null &&
        Math.abs(
          hit.y - Number(y)
        ) > verticalTolerance
      ) {
        continue;
      }

      if (hit.distance <= bestD) {
        best = {
          segment,
          ...hit
        };

        bestD = hit.distance;
      }
    }

    return best;
  }

  function rawAddPathSegment(
    territoryId,
    aId,
    bId,
    type = "road2",
    path = null,
    metadata = {}
  ) {
    const g = graphFor(territoryId);
    const spec =
      ROAD_TYPES[type] || {
        id: type,
        width: 14,
        speed: 50,
        lanes: 2,
        costPer100m: 240
      };

    const a = g.nodes.get(aId);
    const b = g.nodes.get(bId);

    if (!a || !b) {
      throw new Error(
        "Road endpoint does not exist."
      );
    }

    const actualPath =
      Array.isArray(path) &&
      path.length >= 2
        ? path.map(clonePoint)
        : [
            clonePoint(a),
            clonePoint(b)
          ];

    const length =
      pathLength(actualPath);

    if (length < 3) {
      throw new Error(
        "Road segment is too short."
      );
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
      maxGrade:
        pathGrade(actualPath),
      path: actualPath,
      elevationMode:
        metadata.elevationMode ||
        (
          actualPath.some(
            p => Math.abs(p.y) > 0.5
          )
            ? "elevated"
            : "surface"
        ),
      cost:
        Math.ceil(
          length / 100 *
          Number(
            spec.costPer100m || 0
          )
        ),
      metadata: {
        ...metadata
      }
    };

    g.segments.set(
      segment.id,
      segment
    );

    return segment;
  }

  function cleanupOrphanNodes(
    territoryId
  ) {
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

  function lineIntersection(
    a,
    b,
    c,
    d
  ) {
    const rX = b.x - a.x;
    const rZ = b.z - a.z;
    const sX = d.x - c.x;
    const sZ = d.z - c.z;

    const denom =
      rX * sZ -
      rZ * sX;

    if (
      Math.abs(denom) <
      0.00001
    ) {
      return null;
    }

    const cax = c.x - a.x;
    const caz = c.z - a.z;

    const t =
      (
        cax * sZ -
        caz * sX
      ) / denom;

    const u =
      (
        cax * rZ -
        caz * rX
      ) / denom;

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

  function slicePathAt(
    path,
    pathIndex,
    t,
    point
  ) {
    const p = clonePoint(point);

    const before =
      path
        .slice(0, pathIndex + 1)
        .map(clonePoint);

    const after =
      path
        .slice(pathIndex + 1)
        .map(clonePoint);

    before.push(p);
    after.unshift(p);

    return {
      before,
      after
    };
  }

  function splitSegmentAtPathHit(
    territoryId,
    segmentId,
    hit
  ) {
    const g = graphFor(territoryId);
    const segment =
      g.segments.get(segmentId);

    if (!segment) return null;

    const path =
      normalizeSegmentPath(
        g,
        segment
      );

    const a =
      g.nodes.get(segment.a);
    const b =
      g.nodes.get(segment.b);

    if (!a || !b) return null;

    if (
      Math.hypot(
        a.x - hit.x,
        a.z - hit.z
      ) <= 2
    ) {
      return a;
    }

    if (
      Math.hypot(
        b.x - hit.x,
        b.z - hit.z
      ) <= 2
    ) {
      return b;
    }

    const split =
      slicePathAt(
        path,
        hit.pathIndex,
        hit.t,
        {
          x: hit.x,
          y: hit.y,
          z: hit.z
        }
      );

    const middle =
      addNode(
        territoryId,
        hit.x,
        hit.z,
        {
          intersection: true
        },
        hit.y
      );

    g.segments.delete(
      segment.id
    );

    rawAddPathSegment(
      territoryId,
      a.id,
      middle.id,
      segment.type,
      split.before,
      {
        ...segment.metadata,
        splitFrom:
          segment.metadata?.splitFrom ||
          segment.id,
        elevationMode:
          segment.elevationMode
      }
    );

    rawAddPathSegment(
      territoryId,
      middle.id,
      b.id,
      segment.type,
      split.after,
      {
        ...segment.metadata,
        splitFrom:
          segment.metadata?.splitFrom ||
          segment.id,
        elevationMode:
          segment.elevationMode
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
      allowSplit = true,
      y = null,
      verticalTolerance =
        SAME_LEVEL_TOLERANCE
    } = {}
  ) {
    const node =
      nearestNode(
        territoryId,
        x,
        z,
        maxDistance,
        y,
        verticalTolerance
      );

    if (node) {
      return {
        x: node.x,
        y: Number(node.y || 0),
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
        maxDistance,
        y,
        verticalTolerance
      );

    if (hit) {
      if (
        allowSplit &&
        hit.t > 0.04 &&
        hit.t < 0.96
      ) {
        const split =
          splitSegmentAtPathHit(
            territoryId,
            hit.segment.id,
            hit
          );

        if (split) {
          return {
            x: split.x,
            y:
              Number(
                split.y || 0
              ),
            z: split.z,
            node: split,
            kind: "segment",
            snapped: true
          };
        }
      }

      const g =
        graphFor(territoryId);

      const a =
        g.nodes.get(
          hit.segment.a
        );

      const b =
        g.nodes.get(
          hit.segment.b
        );

      const endpoint =
        Math.hypot(
          a.x - hit.x,
          a.z - hit.z
        ) <
        Math.hypot(
          b.x - hit.x,
          b.z - hit.z
        )
          ? a
          : b;

      return {
        x: endpoint.x,
        y:
          Number(
            endpoint.y || 0
          ),
        z: endpoint.z,
        node: endpoint,
        kind: "segment-end",
        snapped: true
      };
    }

    return {
      x,
      y:
        Number(
          y || 0
        ),
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
      ay = 0,
      az,
      bx,
      by = 0,
      bz,
      type = "road2",
      curve = 0
    }
  ) {
    const spec =
      ROAD_TYPES[type] || {};

    const path =
      buildPath({
        ax,
        ay,
        az,
        bx,
        by,
        bz,
        curve
      });

    const length =
      pathLength(path);

    return {
      length,
      cost:
        Math.ceil(
          length / 100 *
          Number(
            spec.costPer100m ||
            0
          )
        ),
      width:
        Number(
          spec.width || 14
        ),
      speed:
        Number(
          spec.speed || 50
        ),
      lanes:
        Number(
          spec.lanes || 2
        ),
      maxGrade:
        pathGrade(path),
      path
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
    const g =
      graphFor(territoryId);

    if (
      g.segments.size === 0
    ) {
      if (!capitalPoint) {
        return {
          allowed: false,
          reason:
            "Establish a capital before starting the road network."
        };
      }

      const d =
        Math.hypot(
          point.x -
            capitalPoint.x,
          point.z -
            capitalPoint.z
        );

      return d <=
        capitalStartDistance
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

    const targetY =
      point.y ?? null;

    const node =
      nearestNode(
        territoryId,
        point.x,
        point.z,
        snapDistance,
        targetY,
        4
      );

    const segment =
      nearestSegment(
        territoryId,
        point.x,
        point.z,
        snapDistance,
        targetY,
        4
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

  function segmentIntersections(
    territoryId,
    newPath
  ) {
    const g =
      graphFor(territoryId);

    const hits = [];

    for (
      const segment of
      [...g.segments.values()]
    ) {
      const oldPath =
        normalizeSegmentPath(
          g,
          segment
        );

      for (
        let ni = 1;
        ni < newPath.length;
        ni++
      ) {
        const na =
          newPath[ni - 1];
        const nb =
          newPath[ni];

        for (
          let oi = 1;
          oi < oldPath.length;
          oi++
        ) {
          const oa =
            oldPath[oi - 1];
          const ob =
            oldPath[oi];

          const cross =
            lineIntersection(
              na,
              nb,
              oa,
              ob
            );

          if (!cross) continue;

          const newY =
            na.y +
            (nb.y - na.y) *
            cross.t;

          const oldY =
            oa.y +
            (ob.y - oa.y) *
            cross.u;

          hits.push({
            segmentId:
              segment.id,
            x: cross.x,
            z: cross.z,
            newY,
            oldY,
            sameLevel:
              Math.abs(
                newY - oldY
              ) <=
              SAME_LEVEL_TOLERANCE,
            newPathIndex:
              ni - 1,
            newT:
              cross.t,
            oldPathIndex:
              oi - 1,
            oldT:
              cross.u
          });
        }
      }
    }

    return hits;
  }

  function splitNewPathAtHits(
    path,
    orderedHits
  ) {
    if (!orderedHits.length) {
      return [
        {
          path:
            path.map(clonePoint),
          hit: null
        }
      ];
    }

    const parts = [];
    let cursorIndex = 0;
    let cursorPoint =
      clonePoint(path[0]);

    for (
      const hit of orderedHits
    ) {
      const part = [
        cursorPoint
      ];

      for (
        let i =
          cursorIndex + 1;
        i <= hit.newPathIndex;
        i++
      ) {
        part.push(
          clonePoint(path[i])
        );
      }

      const crossingPoint = {
        x: hit.x,
        y: hit.newY,
        z: hit.z
      };

      part.push(
        crossingPoint
      );

      parts.push({
        path: part,
        hit
      });

      cursorIndex =
        hit.newPathIndex;

      cursorPoint =
        crossingPoint;
    }

    const tail = [
      cursorPoint
    ];

    for (
      let i =
        cursorIndex + 1;
      i < path.length;
      i++
    ) {
      tail.push(
        clonePoint(path[i])
      );
    }

    parts.push({
      path: tail,
      hit: null
    });

    return parts.filter(
      part =>
        part.path.length >= 2 &&
        pathLength(part.path) >
          1
    );
  }

  function addConnectedSegment(
    territoryId,
    {
      ax,
      ay = 0,
      az,
      bx,
      by = 0,
      bz,
      type = "road2",
      curve = 0,
      snapDistance = 28,
      capitalPoint = null,
      metadata = {}
    }
  ) {
    const g =
      graphFor(territoryId);

    const startValidation =
      validateConnectedStart(
        territoryId,
        {
          x: ax,
          y: ay,
          z: az
        },
        capitalPoint,
        {
          snapDistance
        }
      );

    if (
      !startValidation.allowed
    ) {
      throw new Error(
        startValidation.reason
      );
    }

    const startSnap =
      snapPoint(
        territoryId,
        ax,
        az,
        snapDistance,
        {
          allowSplit: true,
          y: ay,
          verticalTolerance: 4
        }
      );

    let startNode =
      startSnap.node;

    if (!startNode) {
      startNode =
        addNode(
          territoryId,
          startSnap.x,
          startSnap.z,
          {
            starter:
              g.segments.size ===
              0
          },
          startSnap.y
        );
    }

    const endSnap =
      snapPoint(
        territoryId,
        bx,
        bz,
        snapDistance,
        {
          allowSplit: true,
          y: by,
          verticalTolerance: 4
        }
      );

    let endNode =
      endSnap.node;

    if (!endNode) {
      endNode =
        addNode(
          territoryId,
          endSnap.x,
          endSnap.z,
          {},
          endSnap.y
        );
    }

    if (
      startNode.id ===
      endNode.id
    ) {
      throw new Error(
        "Road segment is too short."
      );
    }

    const path =
      buildPath({
        ax: startNode.x,
        ay:
          Number(
            startNode.y || ay
          ),
        az: startNode.z,
        bx: endNode.x,
        by:
          Number(
            endNode.y || by
          ),
        bz: endNode.z,
        curve
      });

    const crossings =
      segmentIntersections(
        territoryId,
        path
      );

    // Only same-level crossings create intersections.
    // Different-height crossings are deliberately grade-separated.
    const sameLevel =
      crossings
        .filter(hit => hit.sameLevel)
        .sort((a, b) => {
          if (
            a.newPathIndex !==
            b.newPathIndex
          ) {
            return (
              a.newPathIndex -
              b.newPathIndex
            );
          }

          return a.newT - b.newT;
        });

    // De-duplicate near-identical intersection hits.
    const filtered = [];

    for (const hit of sameLevel) {
      const duplicate =
        filtered.some(
          other =>
            Math.hypot(
              other.x - hit.x,
              other.z - hit.z
            ) < 3
        );

      if (!duplicate) {
        filtered.push(hit);
      }
    }

    const junctions = [];

    for (const hit of filtered) {
      const current =
        g.segments.get(
          hit.segmentId
        );

      if (!current) continue;

      const currentPath =
        normalizeSegmentPath(
          g,
          current
        );

      const nearest =
        nearestOnPath(
          currentPath,
          hit.x,
          hit.z
        );

      if (!nearest) continue;

      nearest.y = hit.oldY;

      const node =
        splitSegmentAtPathHit(
          territoryId,
          current.id,
          nearest
        );

      if (node) {
        node.metadata = {
          ...(node.metadata || {}),
          intersection: true
        };

        junctions.push({
          hit,
          node
        });
      }
    }

    // Re-map filtered hits to the nodes we actually created.
    const withNodes =
      filtered.map(hit => {
        const existing =
          nearestNode(
            territoryId,
            hit.x,
            hit.z,
            4,
            hit.newY,
            4
          );

        return {
          ...hit,
          node:
            existing || null
        };
      });

    const parts =
      splitNewPathAtHits(
        path,
        withNodes
      );

    const created = [];
    let previousNode =
      startNode;

    for (
      let i = 0;
      i < parts.length;
      i++
    ) {
      const part =
        parts[i];

      let nextNode;

      if (
        part.hit &&
        part.hit.node
      ) {
        nextNode =
          part.hit.node;
      } else if (
        i ===
        parts.length - 1
      ) {
        nextNode =
          endNode;
      } else {
        const last =
          part.path[
            part.path.length - 1
          ];

        nextNode =
          addNode(
            territoryId,
            last.x,
            last.z,
            {
              intersection: true
            },
            last.y
          );
      }

      if (
        previousNode.id ===
        nextNode.id
      ) {
        continue;
      }

      const adjustedPath =
        part.path.map(
          clonePoint
        );

      adjustedPath[0] = {
        x: previousNode.x,
        y:
          Number(
            previousNode.y || 0
          ),
        z: previousNode.z
      };

      adjustedPath[
        adjustedPath.length - 1
      ] = {
        x: nextNode.x,
        y:
          Number(
            nextNode.y || 0
          ),
        z: nextNode.z
      };

      created.push(
        rawAddPathSegment(
          territoryId,
          previousNode.id,
          nextNode.id,
          type,
          adjustedPath,
          {
            ...metadata,
            curve,
            gradeSeparatedCrossings:
              crossings.filter(
                h => !h.sameLevel
              ).map(h => ({
                x: h.x,
                z: h.z,
                clearance:
                  Math.abs(
                    h.newY -
                    h.oldY
                  )
              }))
          }
        )
      );

      previousNode =
        nextNode;
    }

    return created;
  }

  function removeSegment(
    territoryId,
    segmentId
  ) {
    const g =
      graphFor(territoryId);

    const removed =
      g.segments.delete(
        segmentId
      );

    cleanupOrphanNodes(
      territoryId
    );

    return removed;
  }

  function upgradeSegment(
    territoryId,
    segmentId,
    newType
  ) {
    const g =
      graphFor(territoryId);

    const segment =
      g.segments.get(
        segmentId
      );

    if (!segment) {
      throw new Error(
        "Road segment not found."
      );
    }

    const currentRank =
      ROAD_ORDER.indexOf(
        segment.type
      );

    const nextRank =
      ROAD_ORDER.indexOf(
        newType
      );

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
      Number(
        segment.cost || 0
      );

    const newCost =
      Math.ceil(
        segment.length / 100 *
        Number(
          spec.costPer100m || 0
        )
      );

    segment.type =
      newType;

    segment.width =
      Number(
        spec.width ||
        segment.width
      );

    segment.speed =
      Number(
        spec.speed ||
        segment.speed
      );

    segment.lanes =
      Number(
        spec.lanes ||
        segment.lanes
      );

    segment.cost =
      newCost;

    return {
      segment,
      upgradeCost:
        Math.max(
          0,
          newCost - oldCost
        )
    };
  }

  function neighbors(
    g,
    id
  ) {
    const out = [];

    for (
      const segment of
      g.segments.values()
    ) {
      if (
        segment.a === id
      ) {
        out.push({
          nodeId:
            segment.b,
          segment
        });
      } else if (
        segment.b === id
      ) {
        out.push({
          nodeId:
            segment.a,
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
    const g =
      graphFor(territoryId);

    if (
      !g.nodes.has(
        startNodeId
      ) ||
      !g.nodes.has(
        endNodeId
      )
    ) {
      return false;
    }

    const queue = [
      startNodeId
    ];

    const seen =
      new Set(queue);

    while (queue.length) {
      const id =
        queue.shift();

      if (
        id === endNodeId
      ) {
        return true;
      }

      for (
        const next of
        neighbors(g, id)
      ) {
        if (
          !seen.has(
            next.nodeId
          )
        ) {
          seen.add(
            next.nodeId
          );

          queue.push(
            next.nodeId
          );
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
      allowed:
        Boolean(hit),
      distance:
        hit?.distance ??
        Infinity,
      segmentId:
        hit?.segment?.id ||
        null,
      type:
        hit?.segment?.type ||
        null
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
      allowed:
        connected,
      reason:
        connected
          ? "Connected to the existing civilization."
          : "This site is not connected to your existing civilization by road.",
      capitalNodeId:
        a.id,
      cityNodeId:
        b.id
    };
  }

  function serialize(
    territoryId
  ) {
    const g =
      graphFor(territoryId);

    return {
      version:
        "0.2.2C1.5",
      territoryId,
      nextNode:
        g.nextNode,
      nextSegment:
        g.nextSegment,
      nodes:
        [...g.nodes.values()],
      segments:
        [...g.segments.values()]
    };
  }

  function load(data) {
    if (
      !data?.territoryId
    ) {
      return;
    }

    const g =
      graphFor(
        data.territoryId
      );

    g.nodes.clear();
    g.segments.clear();

    for (
      const node of
      data.nodes || []
    ) {
      g.nodes.set(
        node.id,
        {
          ...node,
          y:
            Number(
              node.y || 0
            )
        }
      );
    }

    for (
      const incoming of
      data.segments || []
    ) {
      const segment = {
        ...incoming
      };

      segment.path =
        normalizeSegmentPath(
          g,
          segment
        );

      segment.maxGrade =
        pathGrade(
          segment.path
        );

      g.segments.set(
        segment.id,
        segment
      );
    }

    const nodeNums =
      [...g.nodes.keys()]
        .map(id =>
          Number(
            String(id)
              .replace(
                /\D/g,
                ""
              )
          ) || 0
        );

    const segmentNums =
      [...g.segments.keys()]
        .map(id =>
          Number(
            String(id)
              .replace(
                /\D/g,
                ""
              )
          ) || 0
        );

    g.nextNode =
      Math.max(
        Number(
          data.nextNode ||
          1
        ),
        ...nodeNums.map(
          v => v + 1
        ),
        1
      );

    g.nextSegment =
      Math.max(
        Number(
          data.nextSegment ||
          1
        ),
        ...segmentNums.map(
          v => v + 1
        ),
        1
      );

    cleanupOrphanNodes(
      data.territoryId
    );
  }

  function storageKey(
    worldType,
    territoryId
  ) {
    return (
      "mapgame_roads_022c15_" +
      String(
        worldType ||
        "singleplayer"
      ) +
      "_" +
      String(
        territoryId ||
        "unknown"
      )
    );
  }

  function legacyStorageKey(
    worldType,
    territoryId
  ) {
    return (
      "mapgame_roads_022c1_" +
      String(
        worldType ||
        "singleplayer"
      ) +
      "_" +
      String(
        territoryId ||
        "unknown"
      )
    );
  }

  function saveLocal(
    worldType,
    territoryId
  ) {
    if (!territoryId) {
      return;
    }

    localStorage.setItem(
      storageKey(
        worldType,
        territoryId
      ),
      JSON.stringify(
        serialize(
          territoryId
        )
      )
    );
  }

  function loadLocal(
    worldType,
    territoryId
  ) {
    if (!territoryId) {
      return null;
    }

    const key =
      storageKey(
        worldType,
        territoryId
      );

    const legacy =
      legacyStorageKey(
        worldType,
        territoryId
      );

    const raw =
      localStorage.getItem(
        key
      ) ||
      localStorage.getItem(
        legacy
      );

    if (!raw) return null;

    try {
      const data =
        JSON.parse(raw);

      load(data);

      // Automatically migrate old straight-road saves.
      if (
        !localStorage.getItem(
          key
        )
      ) {
        saveLocal(
          worldType,
          territoryId
        );
      }

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
    VERSION:
      "0.2.2C1.5",
    ROAD_TYPES,
    ROAD_ORDER,
    SAME_LEVEL_TOLERANCE,
    graphFor,
    buildPath,
    pathLength,
    pathGrade,
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
    "Map Game roads 0.2.2C1.5 curved/elevated graph ready."
  );
})();
