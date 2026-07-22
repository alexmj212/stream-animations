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
 * Build a grid of equilateral triangles (alternating up/down orientation)
 * that fully covers [0,width] x [0,height] plus one triangle of margin on
 * every side.
 *
 * Construction: each horizontal strip of height `rowHeight` contains a
 * zig-zag of alternating triangles. "Top" vertices sit on the strip's upper
 * edge at x = c*size; "bottom" vertices sit on the lower edge, offset by
 * half a triangle (x = c*size + size/2). Consecutive top/bottom vertices are
 * exactly `size` apart, so every triangle formed is equilateral.
 *
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 * @param {number} size - Triangle side length in pixels
 * @returns {{triangles: Float32Array, triCount: number, numRows: number, numCols: number, rowHeight: number, startX: number, startY: number}}
 */
export function buildTriangleGrid(width, height, size) {
  const rowHeight = size * (Math.sqrt(3) / 2);

  // Rows/cols needed to cover the content area from (0,0), rounded up.
  const contentRows = Math.ceil(height / rowHeight);
  const contentCols = Math.ceil(width / size);

  // One triangle-strip margin on every side. A naive "+1 whole row" start
  // offset (e.g. startRow = -1) gives an exact 1-triangle margin on the
  // leading edge but dumps all of the ceil() rounding slack onto the
  // trailing edge, ballooning it toward ~2 triangles. Splitting that slack
  // evenly between both edges keeps every side within [1, 1.5) triangles.
  const rowSlack = contentRows * rowHeight - height; // in [0, rowHeight)
  const colSlack = contentCols * size - width;       // in [0, size)

  const startY = -rowHeight - rowSlack / 2;
  const startX = -size - colSlack / 2;

  const numRows = contentRows + 2;
  const numCols = contentCols + 2;

  const triCount = numRows * numCols * 2;
  const triangles = new Float32Array(triCount * 6);

  let idx = 0;
  for (let ri = 0; ri < numRows; ri++) {
    const y0 = startY + ri * rowHeight;
    const y1 = y0 + rowHeight;

    for (let ci = 0; ci < numCols; ci++) {
      const xTop0 = startX + ci * size;
      const xTop1 = xTop0 + size;
      const xBot0 = xTop0 + size / 2;
      const xBot1 = xTop1 + size / 2;

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

  return { triangles, triCount, numRows, numCols, rowHeight, startX, startY };
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
