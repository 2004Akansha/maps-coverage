const assert = require("assert");
const Coverage = require("./coverage.js");

function approx(actual, expected, tolerance) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} within ${tolerance} of ${expected}`
  );
}

const tile = Coverage.latLngToTile(45.4642, 9.19, 16);
const tileBox = Coverage.tileBounds(tile.x, tile.y, 16);
const center = {
  lat: (tileBox.north + tileBox.south) / 2,
  lng: (tileBox.east + tileBox.west) / 2,
};
const roundTrip = Coverage.latLngToTile(center.lat, center.lng, 16);
assert.strictEqual(roundTrip.x, tile.x);
assert.strictEqual(roundTrip.y, tile.y);
assert.ok(center.lat < tileBox.north && center.lat > tileBox.south);
assert.ok(center.lng > tileBox.west && center.lng < tileBox.east);

const nearby = Coverage.tilesInBounds(
  {
    north: center.lat + 0.0001,
    south: center.lat - 0.0001,
    east: center.lng + 0.0001,
    west: center.lng - 0.0001,
  },
  16
);
assert.ok(nearby.some((item) => item.x === tile.x && item.y === tile.y));

const wrapped = Coverage.tilesInBounds({ north: 1, south: -1, west: 179, east: -179 }, 5);
const xs = new Set(wrapped.map((item) => item.x));
assert.ok(xs.size > 1);

const span = Coverage.spanMeters({ north: 1, south: 0, east: 0, west: 0 });
approx(span.height, 111195, 2000);

assert.strictEqual(
  Coverage.inBounds({ lat: 1, lng: 179.5 }, { north: 2, south: 0, west: 179, east: -179 }),
  true
);
assert.strictEqual(
  Coverage.inBounds({ lat: 1, lng: 0 }, { north: 2, south: 0, west: 179, east: -179 }),
  false
);

assert.strictEqual(Coverage.isBusiness({ types: ["restaurant", "establishment"] }), true);
assert.strictEqual(Coverage.isBusiness({ types: ["locality", "political"] }), false);
assert.strictEqual(Coverage.isBusiness({ types: ["restaurant", "political"] }), true);
assert.strictEqual(Coverage.isBusiness({ primaryType: "cafe" }), true);
assert.strictEqual(Coverage.isBusiness({ types: [] }), true);

const camera = {
  lat: 0,
  lng: 0,
  zoom: 16,
  heading: 0,
  tilt: 0,
  mapType: "roadmap",
  bounds: { north: 0.001, south: -0.001, east: 0.001, west: -0.001 },
};
assert.strictEqual(Coverage.materialChange(camera, { ...camera, zoom: 16.3 }), true);
assert.strictEqual(Coverage.materialChange(camera, { ...camera, heading: 20 }), true);
assert.strictEqual(Coverage.materialChange(camera, { ...camera, t: 5 }), false);

const street = {
  t: 1,
  zoom: 16,
  bounds: { north: 45.465, south: 45.463, east: 9.192, west: 9.188 },
};
const cells = {};
const marked = Coverage.markCells(cells, street, 16);
assert.ok(marked.marked > 0 && marked.skipped === false);
const key = Object.keys(cells)[0];
cells[key].business = { status: "complete", zoom: 16, t: 1 };
Coverage.markCells(cells, { ...street, t: 2, zoom: 17.5 }, 16);
assert.strictEqual(cells[key].business.status, "complete");
assert.strictEqual(cells[key].maxZoom, 17.5);
assert.strictEqual(cells[key].samples, 2);

const huge = Coverage.markCells(
  {},
  { t: 1, zoom: 4, bounds: { north: 70, south: 10, east: 40, west: -20 } },
  16
);
assert.strictEqual(huge.skipped, true);
assert.strictEqual(huge.marked, 0);

const block = Coverage.planScan(
  { north: 51.505, south: 51.5, east: -0.12, west: -0.128 },
  { targetRadius: 200, maxCircles: 12 }
);
assert.strictEqual(block.reason, "ok");
assert.ok(block.circles.length > 0 && block.circles.length <= 12);
assert.ok(block.circles.every((circle) => circle.radiusM === block.radius));

const continent = Coverage.planScan(
  { north: 60, south: 40, east: 20, west: 0 },
  { maxCircles: 12, maxRadius: 4000, targetRadius: 200 }
);
assert.strictEqual(continent.reason, "zoom-in");
assert.strictEqual(continent.circles.length, 0);

const children = Coverage.subdivide({ lat: 10, lng: 10, radiusM: 200 });
assert.strictEqual(children.length, 4);
assert.ok(children.every((circle) => circle.radiusM === 100));

const clusters = Coverage.clusterTiles([
  { z: 16, x: 1, y: 1 },
  { z: 16, x: 2, y: 1 },
  { z: 16, x: 5, y: 5 },
]);
assert.strictEqual(clusters.length, 2);
assert.deepStrictEqual(
  clusters.map((group) => group.length).sort((a, b) => a - b),
  [1, 2]
);

const oneTile = [{ z: 16, x: 1, y: 1 }];
assert.strictEqual(Coverage.viewNeedsScan({}, oneTile, 16), true);
const done = { "16/1/1": { business: { status: "complete", zoom: 16 } } };
assert.strictEqual(Coverage.viewNeedsScan(done, oneTile, 16), false);
assert.strictEqual(Coverage.viewNeedsScan(done, oneTile, 17), true);
assert.strictEqual(
  Coverage.viewNeedsScan(
    { "16/1/1": { business: { status: "partial", zoom: 16 } } },
    oneTile,
    16
  ),
  false
);
assert.strictEqual(
  Coverage.viewNeedsScan(
    { "16/1/1": { business: { status: "partial", zoom: 16 } } },
    oneTile,
    17
  ),
  true
);

assert.strictEqual(
  Coverage.assessView({ north: 1, south: 0, east: 1, west: 0 }, 10, 16, 16).reason,
  "zoom"
);
assert.strictEqual(
  Coverage.assessView(street.bounds, 16, 16, 16).ok,
  true
);

const segments = Coverage.trailSegments([
  { t: 0, lat: 0, lng: 0 },
  { t: 1000, lat: 0, lng: 0.001 },
  { t: 2000, lat: 10, lng: 10 },
]);
assert.strictEqual(segments.length, 2);
assert.strictEqual(segments[0].length, 2);
assert.strictEqual(segments[1].length, 1);

const covered = Coverage.coveredCells(
  {
    a: { maxZoom: 17, samples: 2, business: null },
    b: { maxZoom: 14, samples: 4, business: null },
    c: { maxZoom: 16, samples: 0, business: { status: "complete", zoom: 16 } },
  },
  16
);
assert.strictEqual(covered.length, 2);

const view = Coverage.viewBounds(45.4642, 9.19, 16, 1024, 768);
assert.ok(view.north > 45.4642 && view.south < 45.4642);
assert.ok(view.east > 9.19 && view.west < 9.19);
const mid = { lat: (view.north + view.south) / 2, lng: (view.east + view.west) / 2 };
assert.ok(Coverage.haversine(mid, { lat: 45.4642, lng: 9.19 }) < 50);

console.log("maps-coverage tests passed");
