/* Pure map-coverage math. Used by the page and by tests.cjs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Coverage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GRID_ZOOM = 16;
  const MAX_TILES = 1500;

  // Geographic containers. A place with any other type is kept.
  const NON_BUSINESS_TYPES = new Set([
    "locality",
    "political",
    "country",
    "administrative_area_level_1",
    "administrative_area_level_2",
    "administrative_area_level_3",
    "administrative_area_level_4",
    "administrative_area_level_5",
    "colloquial_area",
    "neighborhood",
    "sublocality",
    "sublocality_level_1",
    "sublocality_level_2",
    "sublocality_level_3",
    "sublocality_level_4",
    "sublocality_level_5",
    "route",
    "intersection",
    "postal_code",
    "postal_code_prefix",
    "postal_code_suffix",
    "plus_code",
    "continent",
    "archipelago",
    "floor",
    "geocode",
    "street_address",
    "premise",
    "subpremise",
    "natural_feature",
  ]);

  function cellKey(tile) {
    return tile.z + "/" + tile.x + "/" + tile.y;
  }

  function parseKey(key) {
    const parts = String(key).split("/").map(Number);
    return { z: parts[0], x: parts[1], y: parts[2] };
  }

  function haversine(a, b) {
    const radius = 6371000;
    const toRad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toRad;
    const dLng = (b.lng - a.lng) * toRad;
    const chord =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
    return 2 * radius * Math.asin(Math.min(1, Math.sqrt(chord)));
  }

  function latLngToTile(lat, lng, z) {
    const n = 2 ** z;
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    return {
      z,
      x: Math.min(n - 1, Math.max(0, x)),
      y: Math.min(n - 1, Math.max(0, y)),
    };
  }

  function projectPoint(lat, lng, zoom) {
    const size = 256 * 2 ** zoom;
    const latRad = (lat * Math.PI) / 180;
    return {
      x: ((lng + 180) / 360) * size,
      y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * size,
    };
  }

  function unprojectPoint(x, y, zoom) {
    const size = 256 * 2 ** zoom;
    return {
      lng: (x / size) * 360 - 180,
      lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / size))) * 180) / Math.PI,
    };
  }

  function viewBounds(lat, lng, zoom, widthPx, heightPx) {
    const center = projectPoint(lat, lng, zoom);
    const halfW = Math.max(1, widthPx) / 2;
    const halfH = Math.max(1, heightPx) / 2;
    const northWest = unprojectPoint(center.x - halfW, center.y - halfH, zoom);
    const southEast = unprojectPoint(center.x + halfW, center.y + halfH, zoom);
    return {
      north: northWest.lat,
      south: southEast.lat,
      west: northWest.lng,
      east: southEast.lng,
    };
  }

  function tileBounds(x, y, z) {
    const n = 2 ** z;
    const west = (x / n) * 360 - 180;
    const east = ((x + 1) / n) * 360 - 180;
    const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
    const south =
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
    return { north, south, east, west };
  }

  function splitAntimeridian(bounds) {
    if (bounds.west <= bounds.east) return [bounds];
    return [
      { north: bounds.north, south: bounds.south, west: bounds.west, east: 180 },
      { north: bounds.north, south: bounds.south, west: -180, east: bounds.east },
    ];
  }

function tileRange(bounds, z) {
  const nw = latLngToTile(Math.min(85, bounds.north), bounds.west, z);
  const se = latLngToTile(Math.max(-85, bounds.south), bounds.east, z);
  return {
    x0: Math.min(nw.x, se.x),
    x1: Math.max(nw.x, se.x),
    y0: Math.min(nw.y, se.y),
    y1: Math.max(nw.y, se.y),
  };
}

function tileSpan(bounds, z) {
  return splitAntimeridian(bounds).reduce((sum, part) => {
    const range = tileRange(part, z);
    return sum + (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1);
  }, 0);
}

function tilesInBounds(bounds, z) {
  // Refuse to allocate a continental tile list. Callers check tileSpan first.
  if (tileSpan(bounds, z) > 5000) return [];
  return splitAntimeridian(bounds).flatMap((part) => {
    const range = tileRange(part, z);
    const tiles = [];
    for (let x = range.x0; x <= range.x1; x += 1) {
      for (let y = range.y0; y <= range.y1; y += 1) tiles.push({ z, x, y });
    }
    return tiles;
  });
}

  function spanMeters(bounds) {
    const midLat = (bounds.north + bounds.south) / 2;
    const midLng = bounds.west <= bounds.east
      ? (bounds.east + bounds.west) / 2
      : bounds.east;
    const height = haversine(
      { lat: bounds.south, lng: midLng },
      { lat: bounds.north, lng: midLng }
    );
    const width = bounds.west <= bounds.east
      ? haversine({ lat: midLat, lng: bounds.west }, { lat: midLat, lng: bounds.east })
      : haversine({ lat: midLat, lng: bounds.west }, { lat: midLat, lng: 180 }) +
        haversine({ lat: midLat, lng: -180 }, { lat: midLat, lng: bounds.east });
    return { width, height };
  }

  function cellAreaM2(x, y, z) {
    const bounds = tileBounds(x, y, z);
    const midLat = (bounds.north + bounds.south) / 2;
    const height = haversine(
      { lat: bounds.south, lng: bounds.west },
      { lat: bounds.north, lng: bounds.west }
    );
    const width = haversine(
      { lat: midLat, lng: bounds.west },
      { lat: midLat, lng: bounds.east }
    );
    return height * width;
  }

  function inBounds(point, bounds) {
    if (point.lat > bounds.north || point.lat < bounds.south) return false;
    if (bounds.west <= bounds.east) {
      return point.lng >= bounds.west && point.lng <= bounds.east;
    }
    return point.lng >= bounds.west || point.lng <= bounds.east;
  }

  function isBusiness(place) {
    const types = [];
    if (Array.isArray(place.types)) types.push(...place.types);
    if (place.primaryType) types.push(place.primaryType);
    if (types.length === 0) return true;
    return types.some((type) => !NON_BUSINESS_TYPES.has(type));
  }

  function materialChange(previous, next) {
    if (!previous || !next) return true;
    if (Math.abs(previous.zoom - next.zoom) >= 0.2) return true;
    if (Math.abs((previous.heading || 0) - (next.heading || 0)) >= 12) return true;
    if (Math.abs((previous.tilt || 0) - (next.tilt || 0)) >= 4) return true;
    if (previous.mapType !== next.mapType) return true;
    const span = spanMeters(previous.bounds);
    const threshold = Math.max(12, Math.min(span.width, span.height) * 0.08);
    return haversine(previous, next) >= threshold;
  }

  function assessView(bounds, zoom, gridZoom, minZoom, maxTiles) {
    const limit = maxTiles || MAX_TILES;
    if (!Number.isFinite(zoom) || zoom < minZoom) {
      return { ok: false, reason: "zoom", tiles: [] };
    }
    if (tileSpan(bounds, gridZoom) > limit) return { ok: false, reason: "wide", tiles: [] };
    const tiles = tilesInBounds(bounds, gridZoom);
    return { ok: true, reason: "ok", tiles };
  }

  function markCells(cells, sample, gridZoom, options) {
    const maxTiles = options?.maxTiles || MAX_TILES;
    const span = tileSpan(sample.bounds, gridZoom);
    if (span > maxTiles) return { marked: 0, skipped: true, tiles: span };
    const tiles = tilesInBounds(sample.bounds, gridZoom);
    for (const tile of tiles) {
      const key = cellKey(tile);
      const existing = cells[key];
      if (!existing) {
        cells[key] = {
          z: tile.z,
          x: tile.x,
          y: tile.y,
          key,
          maxZoom: sample.zoom,
          minZoom: sample.zoom,
          firstSeen: sample.t,
          lastSeen: sample.t,
          samples: 1,
          business: null,
        };
      } else {
        existing.maxZoom = Math.max(existing.maxZoom, sample.zoom);
        existing.minZoom = Math.min(existing.minZoom, sample.zoom);
        existing.lastSeen = sample.t;
        existing.samples += 1;
      }
    }
    return { marked: tiles.length, skipped: false, tiles: tiles.length };
  }

  function gridSteps(bounds, radiusM) {
    const midLat = (bounds.north + bounds.south) / 2;
    const metersPerDegLat = 111320;
    const metersPerDegLng = Math.max(111320 * Math.cos((midLat * Math.PI) / 180), 1);
    const step = radiusM * Math.SQRT2;
    const dLat = step / metersPerDegLat;
    const dLng = step / metersPerDegLng;
    const latSpan = Math.max(bounds.north - bounds.south, 1e-9);
    const lngSpan = Math.max(bounds.east - bounds.west, 1e-9);
    return {
      rows: Math.max(1, Math.ceil(latSpan / dLat)),
      cols: Math.max(1, Math.ceil(lngSpan / dLng)),
      dLat,
      dLng,
    };
  }

  function circleCount(bounds, radiusM) {
    return splitAntimeridian(bounds).reduce((sum, part) => {
      const steps = gridSteps(part, radiusM);
      return sum + steps.rows * steps.cols;
    }, 0);
  }

  function planCircles(bounds, radiusM) {
    return splitAntimeridian(bounds).flatMap((part) => {
      const steps = gridSteps(part, radiusM);
      const lat0 = (part.north + part.south) / 2 - ((steps.rows - 1) * steps.dLat) / 2;
      const lng0 = (part.west + part.east) / 2 - ((steps.cols - 1) * steps.dLng) / 2;
      const circles = [];
      for (let row = 0; row < steps.rows; row += 1) {
        for (let col = 0; col < steps.cols; col += 1) {
          circles.push({
            lat: lat0 + row * steps.dLat,
            lng: lng0 + col * steps.dLng,
            radiusM,
          });
        }
      }
      return circles;
    });
  }

  function planScan(bounds, opts) {
    const options = opts || {};
    const maxCircles = options.maxCircles ?? 12;
    const maxRadius = options.maxRadius ?? 4000;
    let radius = options.targetRadius ?? 200;
    let count = circleCount(bounds, radius);
    while (count > maxCircles && radius < maxRadius) {
      radius = Math.min(maxRadius, radius * 1.5);
      count = circleCount(bounds, radius);
      if (radius >= maxRadius) break;
    }
    if (count > maxCircles) {
      return { circles: [], radius, partial: true, reason: "zoom-in" };
    }
    const circles = planCircles(bounds, radius);
    if (circles.length > maxCircles) {
      return { circles: [], radius, partial: true, reason: "zoom-in" };
    }
    return { circles, radius, partial: false, reason: "ok" };
  }

  function subdivide(circle) {
    const radiusM = circle.radiusM / 2;
    const shift = circle.radiusM / 2;
    const dLat = shift / 111320;
    const dLng = shift / Math.max(111320 * Math.cos((circle.lat * Math.PI) / 180), 1);
    const scale = 0.7;
    return [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ].map(([latSign, lngSign]) => ({
      lat: circle.lat + latSign * dLat * scale,
      lng: circle.lng + lngSign * dLng * scale,
      radiusM,
    }));
  }

  function clusterTiles(tiles) {
    const unused = new Set(tiles.map(cellKey));
    const clusters = [];
    for (const tile of tiles) {
      const start = cellKey(tile);
      if (!unused.has(start)) continue;
      const group = [];
      const stack = [tile];
      unused.delete(start);
      while (stack.length) {
        const current = stack.pop();
        group.push(current);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const neighbor = { z: current.z, x: current.x + dx, y: current.y + dy };
          const key = cellKey(neighbor);
          if (!unused.has(key)) continue;
          unused.delete(key);
          stack.push(neighbor);
        }
      }
      clusters.push(group);
    }
    return clusters;
  }

  function boundsFromTiles(group) {
    let north = -Infinity;
    let south = Infinity;
    let east = -Infinity;
    let west = Infinity;
    for (const tile of group) {
      const bounds = tileBounds(tile.x, tile.y, tile.z);
      north = Math.max(north, bounds.north);
      south = Math.min(south, bounds.south);
      east = Math.max(east, bounds.east);
      west = Math.min(west, bounds.west);
    }
    return { north, south, east, west };
  }

function tileNeedsScan(cells, tile, zoom) {
  const cell = cells[cellKey(tile)];
  if (!cell?.business) return true;
  // Partial and complete blocks both wait for a closer zoom before another
  // automatic search. The manual capture button searches the screen anyway.
  return zoom > cell.business.zoom + 0.4;
}

  function needyTiles(cells, tiles, zoom) {
    return tiles.filter((tile) => tileNeedsScan(cells, tile, zoom));
  }

  function viewNeedsScan(cells, tiles, zoom) {
    return tiles.some((tile) => tileNeedsScan(cells, tile, zoom));
  }

  function trailSegments(samples, maxGapMs, maxJumpM) {
    const gap = maxGapMs ?? 120000;
    const jump = maxJumpM ?? 2000;
    const segments = [];
    let current = [];
    for (const sample of samples) {
      const previous = current[current.length - 1];
      if (previous && (sample.t - previous.t > gap || haversine(previous, sample) > jump)) {
        if (current.length) segments.push(current);
        current = [];
      }
      current.push(sample);
    }
    if (current.length) segments.push(current);
    return segments;
  }

  function coveredCells(cells, minZoom) {
    return Object.values(cells).filter(
      (cell) => cell.maxZoom >= minZoom && (cell.samples > 0 || cell.business)
    );
  }

  return {
    GRID_ZOOM,
    MAX_TILES,
    NON_BUSINESS_TYPES,
    cellKey,
    parseKey,
    haversine,
    latLngToTile,
    viewBounds,
    tileBounds,
    splitAntimeridian,
    tileSpan,
    tilesInBounds,
    spanMeters,
    cellAreaM2,
    inBounds,
    isBusiness,
    materialChange,
    assessView,
    markCells,
    circleCount,
    planCircles,
    planScan,
    subdivide,
    clusterTiles,
    boundsFromTiles,
    needyTiles,
    viewNeedsScan,
    trailSegments,
    coveredCells,
  };
});
