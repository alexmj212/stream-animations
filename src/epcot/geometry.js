/**
 * Pure geometry functions for the EPCOT Spaceship Earth scene.
 *
 * No canvas/DOM dependencies here on purpose - grid generation, facet
 * construction, and normal computation are all plain math so they can be
 * unit-tested without a canvas (see tests/epcot/geometry.test.js).
 *
 * Coordinate system matches the rest of the repo: origin top-left, X right,
 * Y down. The "3D" axis added here is Z, pointing OUT of the screen toward
 * the viewer (z-up out of screen = +z), per config.epcot / project docs.
 */

/**
 * Build a proper triangular lattice (alternating up/down equilateral
 * triangles) that fully covers [0,width] x [0,height] plus roughly one
 * triangle of margin on every side.
 *
 * Construction: vertices live on horizontal rows spaced `rowHeight` apart.
 * Row `r`'s vertices are offset by `size/2` in X whenever `r` is odd -
 * this alternating half-triangle offset is what makes it a real triangular
 * lattice (rather than the earlier per-strip-local offset, which reset
 * every strip and never let adjacent rows' vertices coincide).
 *
 * Each triangle is described purely by (row, halfStep) lattice coordinates,
 * where halfStep increments of 1 = size/2 in X. A triangle strip between
 * row r and r+1 is built from column index i (i = 0..numPerStrip-1) via
 * h = (r&1) + 2*i:
 *   down-triangle: (r,h), (r,h+2), (r+1,h+1)
 *   up-triangle:   (r+1,h+1), (r,h+2), (r+1,h+3)
 * Because h+1 always has the correct parity for row r+1 regardless of r's
 * parity, the same (row, halfStep) -> (x,y) formula produces bit-identical
 * coordinates for vertices shared between adjacent strips - i.e. every
 * interior vertex is generated the same way no matter which triangle(s)
 * reference it, so they coincide exactly (see buildLatticeVertices).
 *
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 * @param {number} size - Triangle side length in pixels
 * @returns {{triangles: Float32Array, triCount: number, numRows: number, numCols: number, rowHeight: number, startX: number, startY: number}}
 */
export function buildTriangleGrid(width, height, size) {
  const rowHeight = size * (Math.sqrt(3) / 2);
  const halfSize = size / 2;

  // Rows/cols needed to cover the content area from (0,0), rounded up.
  const contentRows = Math.ceil(height / rowHeight);
  const contentCols = Math.ceil(width / size);

  const rowSlack = contentRows * rowHeight - height; // in [0, rowHeight)
  const colSlack = contentCols * size - width;       // in [0, size)

  // Vertical margin: split the ceil() rounding slack evenly between top and
  // bottom, same approach as before - unaffected by the lattice-offset fix.
  const startY = -rowHeight - rowSlack / 2;

  // Horizontal margin: rows alternate an extra +halfSize offset, so the
  // worst case (an odd/shifted row) needs an extra halfSize of buffer on
  // the left to keep a full triangle of margin; numPerStrip gets a matching
  // extra column so the same is true on the right.
  const startX = -size - halfSize - colSlack / 2;

  const numStrips = contentRows + 2;   // triangle strips (each strip = down+up rows)
  const numPerStrip = contentCols + 2; // triangle pairs per strip

  const triCount = numStrips * numPerStrip * 2;
  const triangles = new Float32Array(triCount * 6);

  const rowX = (row, halfStep) => startX + halfStep * halfSize;
  const rowY = (row) => startY + row * rowHeight;

  let idx = 0;
  for (let r = 0; r < numStrips; r++) {
    const y0 = rowY(r);
    const y1 = rowY(r + 1);
    const base = r & 1;

    for (let i = 0; i < numPerStrip; i++) {
      const h = base + i * 2;
      const xTop0 = rowX(r, h);
      const xTop1 = rowX(r, h + 2);
      const xBot0 = rowX(r + 1, h + 1);
      const xBot1 = rowX(r + 1, h + 3);

      // Down-pointing triangle (base on top edge, apex on bottom edge)
      let o = idx * 6;
      triangles[o] = xTop0; triangles[o + 1] = y0;
      triangles[o + 2] = xTop1; triangles[o + 3] = y0;
      triangles[o + 4] = xBot0; triangles[o + 5] = y1;
      idx++;

      // Up-pointing triangle (base on bottom edge, apex on top edge)
      o = idx * 6;
      triangles[o] = xBot0; triangles[o + 1] = y1;
      triangles[o + 2] = xTop1; triangles[o + 3] = y0;
      triangles[o + 4] = xBot1; triangles[o + 5] = y1;
      idx++;
    }
  }

  return { triangles, triCount, numRows: numStrips, numCols: numPerStrip, rowHeight, startX, startY };
}

/**
 * Deduplicate the triangle grid's vertices into a unique lattice point list,
 * matching coincident vertices within `epsilon` pixels. These unique points
 * are the panel vertices where lights sit (see lighting.js) and also let the
 * gap-line renderer avoid double-stroking shared edges.
 *
 * @param {Float32Array} triangles - Flat [ax,ay,bx,by,cx,cy, ...] per triangle (from buildTriangleGrid)
 * @param {number} triCount - Number of base triangles
 * @param {number} epsilon - Coordinate quantization step in pixels for coincidence matching
 * @returns {{positions: Float32Array, count: number, triVertexIndex: Int32Array}}
 *   positions: flat [x,y, ...] per unique vertex
 *   count: number of unique vertices
 *   triVertexIndex: Int32Array(triCount*3) - unique vertex index for each (triangle, corner)
 */
export function buildLatticeVertices(triangles, triCount, epsilon = 0.01) {
  const map = new Map();
  const positions = [];
  const triVertexIndex = new Int32Array(triCount * 3);

  let nextIndex = 0;
  for (let t = 0; t < triCount; t++) {
    const o = t * 6;
    for (let c = 0; c < 3; c++) {
      const x = triangles[o + c * 2];
      const y = triangles[o + c * 2 + 1];

      // Quantize to a fine integer grid so bit-identical (or near-identical,
      // within float rounding) coordinates collide to the same key.
      const qx = Math.round(x / epsilon);
      const qy = Math.round(y / epsilon);
      const key = qx * 1e7 + qy;

      let vi = map.get(key);
      if (vi === undefined) {
        vi = nextIndex++;
        map.set(key, vi);
        positions.push(x, y);
      }
      triVertexIndex[t * 3 + c] = vi;
    }
  }

  return {
    positions: Float32Array.from(positions),
    count: nextIndex,
    triVertexIndex
  };
}

/**
 * Expand a per-triangle unique-vertex index into a per-facet one: every
 * facet is shaded by the lights at its own base triangle's 3 vertices (all
 * 3, regardless of which 2 of those the facet's own edge touches), so all 3
 * facets split from a triangle share that triangle's 3 vertex indices.
 *
 * @param {Int32Array} triVertexIndex - Int32Array(triCount*3), from buildLatticeVertices
 * @param {number} triCount - Number of base triangles
 * @returns {Int32Array} Int32Array(triCount*3*3) = Int32Array(facetCount*3), 3 vertex-light indices per facet
 */
export function expandVertexIndexToFacets(triVertexIndex, triCount) {
  const out = new Int32Array(triCount * 3 * 3);
  let o = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = triVertexIndex[t * 3], i1 = triVertexIndex[t * 3 + 1], i2 = triVertexIndex[t * 3 + 2];
    for (let e = 0; e < 3; e++) {
      out[o] = i0; out[o + 1] = i1; out[o + 2] = i2;
      o += 3;
    }
  }
  return out;
}

/**
 * Raise every base triangle's centroid toward the viewer to form a
 * tetrahedral spike, splitting each triangle into 3 shaded facets
 * (v0,v1,apex), (v1,v2,apex), (v2,v0,apex).
 *
 * Orthographic projection: screen x,y are world x,y everywhere, including
 * the apex, which projects exactly onto the base triangle's centroid - the
 * silhouette on screen is unchanged from the flat grid. All the 3D
 * appearance comes from per-facet lighting (see lighting.js).
 *
 * @param {Float32Array} triangles - Flat [ax,ay,bx,by,cx,cy, ...] per triangle (from buildTriangleGrid)
 * @param {number} triCount - Number of base triangles
 * @param {number} spikeHeight - Base spike height in pixels (world Z of the apex)
 * @param {number} spikeVariation - Fractional +/- random variation applied per triangle (e.g. 0.15 = +/-15%)
 * @param {Function} random - Deterministic RNG (0..1), matches options.random convention used across the repo
 * @returns {{positions2D: Float32Array, normals: Float32Array, centroids3D: Float32Array, facetCount: number}}
 */
export function buildFacets(triangles, triCount, spikeHeight, spikeVariation, random) {
  const rand = random || Math.random;
  const facetCount = triCount * 3;

  // positions2D: screen-space triangle per facet = [ax,ay, bx,by, apexX,apexY]
  const positions2D = new Float32Array(facetCount * 6);
  // normals: unit normal per facet, z always >= 0 (apex faces the viewer)
  const normals = new Float32Array(facetCount * 3);
  // centroids3D: 3D centroid of each facet triangle, used for light distance
  const centroids3D = new Float32Array(facetCount * 3);

  let f = 0;
  for (let t = 0; t < triCount; t++) {
    const o = t * 6;
    const ax = triangles[o], ay = triangles[o + 1];
    const bx = triangles[o + 2], by = triangles[o + 3];
    const cx = triangles[o + 4], cy = triangles[o + 5];

    const centroidX = (ax + bx + cx) / 3;
    const centroidY = (ay + by + cy) / 3;

    // Seeded per-triangle variation so the surface reads as organic rather
    // than perfectly uniform, while remaining deterministic under a seeded RNG.
    const variation = 1 + (rand() - 0.5) * 2 * spikeVariation;
    const apexZ = spikeHeight * variation;

    const edges = [
      [ax, ay, bx, by],
      [bx, by, cx, cy],
      [cx, cy, ax, ay]
    ];

    for (let e = 0; e < 3; e++) {
      const v0x = edges[e][0], v0y = edges[e][1];
      const v1x = edges[e][2], v1y = edges[e][3];

      // Edge vectors from v0, in 3D (base vertices at z=0, apex at z=apexZ)
      const e1x = v1x - v0x, e1y = v1y - v0y, e1z = 0;
      const e2x = centroidX - v0x, e2y = centroidY - v0y, e2z = apexZ;

      // Cross product e1 x e2
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;

      // Apex is always raised toward the viewer (+z); flip if winding gave
      // us the opposite-facing normal so nz is always >= 0.
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }

      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;

      const fo = f * 3;
      normals[fo] = nx; normals[fo + 1] = ny; normals[fo + 2] = nz;

      centroids3D[fo] = (v0x + v1x + centroidX) / 3;
      centroids3D[fo + 1] = (v0y + v1y + centroidY) / 3;
      centroids3D[fo + 2] = (0 + 0 + apexZ) / 3;

      const po = f * 6;
      positions2D[po] = v0x; positions2D[po + 1] = v0y;
      positions2D[po + 2] = v1x; positions2D[po + 3] = v1y;
      positions2D[po + 4] = centroidX; positions2D[po + 5] = centroidY;

      f++;
    }
  }

  return { positions2D, normals, centroids3D, facetCount };
}

/**
 * Build edge-adjacency between base triangles: two triangles are neighbors
 * when they share an edge (i.e. two lattice vertex indices). Used by the
 * bounce-light pass - a brightly lit panel spills a fraction of its light
 * onto the panels it borders.
 *
 * @param {Int32Array} triVertexIndex - Int32Array(triCount*3), from buildLatticeVertices
 * @param {number} triCount - Number of base triangles
 * @returns {Int32Array} Int32Array(triCount*3): up to 3 neighbor triangle
 *   indices per triangle, -1 padded (border triangles have fewer neighbors)
 */
export function buildTriangleAdjacency(triVertexIndex, triCount) {
  // Map each undirected edge (vertex index pair) to the triangles touching it
  const edgeMap = new Map();
  for (let t = 0; t < triCount; t++) {
    for (let e = 0; e < 3; e++) {
      const a = triVertexIndex[t * 3 + e];
      const b = triVertexIndex[t * 3 + ((e + 1) % 3)];
      const key = a < b ? a * 0x100000 + b : b * 0x100000 + a;
      const list = edgeMap.get(key);
      if (list === undefined) {
        edgeMap.set(key, [t]);
      } else {
        list.push(t);
      }
    }
  }

  const neighbors = new Int32Array(triCount * 3).fill(-1);
  const counts = new Int32Array(triCount);
  for (const tris of edgeMap.values()) {
    if (tris.length === 2) {
      const [t0, t1] = tris;
      neighbors[t0 * 3 + counts[t0]++] = t1;
      neighbors[t1 * 3 + counts[t1]++] = t0;
    }
  }
  return neighbors;
}

/**
 * Move a 2D point directly away from a centroid by a fixed pixel amount.
 * Used to inflate each facet's screen-space triangle outward from its own
 * centroid so adjacent facets overlap by a fraction of a pixel instead of
 * exactly abutting - this hides hairline anti-aliasing seams between fills
 * without needing a per-facet stroke() pass.
 *
 * @param {number} x - Point x
 * @param {number} y - Point y
 * @param {number} cx - Centroid x
 * @param {number} cy - Centroid y
 * @param {number} amount - Distance in pixels to push the point outward
 * @returns {[number, number]} Inflated [x, y]
 */
export function inflatePoint(x, y, cx, cy, amount) {
  const dx = x - cx, dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  return [x + (dx / len) * amount, y + (dy / len) * amount];
}
