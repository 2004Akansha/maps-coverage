(function () {
  const DATA_KEY = "maps-coverage-embed-v1";
  const SAMPLE_CAP = 8000;

  const sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  const state = loadData();
  state.blockBusinesses = state.blockBusinesses || {};
  const $ = (id) => document.getElementById(id);
  const els = {};

  let persistTimer = 0;
  let selectedBlockKey = null;
  let editingBlockBusinessId = null;

  document.addEventListener("DOMContentLoaded", boot);

  function boot() {
    [
      "frame", "panel", "panelToggle", "recordingToggle", "statusLine", "storageNote",
      "zoomIn", "zoomOut", "mapTypeRoad", "mapTypeSat",
      "statLat", "statLng", "statZoom", "statType", "statSpan", "statBounds", "minimap",
      "statCells", "statArea", "statSamples", "statPlaces", "statInView",
      "selectedBlockId", "selectedBlockBounds", "selectCurrentBlock",
      "minZoom", "minZoomValue", "searchForm", "searchInput", "locateBtn",
      "projectSelect", "newProjectBtn", "newProjectForm", "newProjectName", "cancelProjectBtn",
      "exportJsonBtn", "exportCsvBtn","exportBusinessesBtn", "exportReviewsBtn",
       "clearBtn", "tabPlaces", "tabTrail", "placesPane", "trailPane",
      "placeFilter", "placeList", "trailList",
      "blockBusinessForm",
"businessFormHint",
"businessName",
"businessMapsUrl",
"openBusinessMaps",
"businessAddress",
"businessLat",
"businessLng",
"businessCategory",
"businessRating",
"businessReviewCount",
"businessNotes",
"blockBusinessCount",
"blockBusinessList",
"reviewBusinessSelect",
"reviewFile",
"importReviewsBtn",
"reviewImportStatus",
"reviewPreview",
    ].forEach((id) => {
      els[id] = $(id);
    });
    bind();
    applyToggles();
    renderProjects();
    renderFrame();
    record("idle");
    renderAll();
  }

  function bind() {
    document.querySelectorAll("[data-pan]").forEach((button) => {
      button.addEventListener("click", () => pan(button.dataset.pan));
    });
    els.zoomIn.addEventListener("click", () => changeZoom(1));
    els.zoomOut.addEventListener("click", () => changeZoom(-1));
    els.selectCurrentBlock.addEventListener("click", selectCurrentBlock);
    els.blockBusinessForm.addEventListener(
      "submit",
      saveBlockBusiness
    );

    els.openBusinessMaps.addEventListener(
      "click",
      openBusinessMaps
    );
    els.importReviewsBtn.addEventListener("click", importReviews);
    els.mapTypeRoad.addEventListener("click", () => setMapType("m"));
    els.mapTypeSat.addEventListener("click", () => setMapType("k"));
    els.recordingToggle.addEventListener("click", () => {
      state.recording = !state.recording;
      applyToggles();
      persistSoon();
      setStatus(state.recording ? "Recording each view you set with the pad." : "Recording is paused.");
    });
    els.minZoom.addEventListener("input", () => {
      state.minZoom = Number(els.minZoom.value);
      els.minZoomValue.textContent = String(state.minZoom);
      rebuildCells();
      persistSoon();
      renderAll();
    });
    els.panelToggle.addEventListener("click", () => {
      els.panel.classList.toggle("is-collapsed");
      els.panelToggle.textContent = els.panel.classList.contains("is-collapsed") ? "Show journal" : "Hide";
      requestAnimationFrame(() => {
        renderFrame();
        renderAll();
      });
    });
    els.searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = els.searchInput.value.trim();
      if (query) flyTo(query);
    });
    els.locateBtn.addEventListener("click", locateMe);
    els.projectSelect.addEventListener("change", () => {
      const next = state.projects.find((item) => item.id === els.projectSelect.value);
      if (!next || next.id === state.activeId) return;
      activate(next);
      setStatus("Showing " + next.name + ". Green blocks are only for this city.");
    });
    els.newProjectBtn.addEventListener("click", () => {
      els.newProjectForm.hidden = false;
      els.newProjectName.focus();
    });
    els.cancelProjectBtn.addEventListener("click", () => {
      els.newProjectForm.hidden = true;
      els.newProjectName.value = "";
    });
    els.newProjectForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = els.newProjectName.value.trim();
      if (name) openCity(name);
    });
    els.exportJsonBtn.addEventListener("click", exportJson);
    els.exportCsvBtn.addEventListener("click", exportCsv);
    els.exportBusinessesBtn.addEventListener(
  "click",
  exportBusinessesCsv
);

els.exportReviewsBtn.addEventListener(
  "click",
  exportReviewsCsv
);
    els.clearBtn.addEventListener("click", clearJournal);
    els.placeFilter.addEventListener("input", renderPlaces);
    els.tabPlaces.addEventListener("click", () => selectTab("places"));
    els.tabTrail.addEventListener("click", () => selectTab("trail"));
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", persistNow);
    window.addEventListener("resize", () => {
      renderAll();
    });
  }

  function onKey(event) {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const pans = { ArrowUp: "n", ArrowDown: "s", ArrowLeft: "w", ArrowRight: "e" };
    if (pans[event.key]) {
      event.preventDefault();
      pan(pans[event.key]);
    } else if (event.key === "+" || event.key === "=") {
      changeZoom(1);
    } else if (event.key === "-" || event.key === "_") {
      changeZoom(-1);
    }
  }

  function pan(direction) {
    const bounds = currentBounds();
    const span = Coverage.spanMeters(bounds);
    const stepX = span.width * 0.45;
    const stepY = span.height * 0.45;
    const latRad = (state.view.lat * Math.PI) / 180;
    const east = stepX / Math.max(111320 * Math.cos(latRad), 1);
    const north = stepY / 111320;
    if (direction === "n") state.view.lat += north;
    if (direction === "s") state.view.lat -= north;
    if (direction === "e") state.view.lng += east;
    if (direction === "w") state.view.lng -= east;
    state.view.lat = clamp(state.view.lat, -80, 80);
    state.view.lng = wrapLng(state.view.lng);
    commit("move");
  }

  function changeZoom(delta) {
    state.view.zoom = clamp(state.view.zoom + delta, 3, 20);
    commit("zoom");
  }

  function setMapType(type) {
    state.view.mapType = type;
    commit("type");
  }

  function commit(reason) {
    renderFrame();
    record(reason);
    renderAll();
    persistSoon();
  }

  function renderFrame() {
    const lat = state.view.lat.toFixed(6);
    const lng = state.view.lng.toFixed(6);
    const type = state.view.mapType === "k" ? "k" : "m";
    const src = "https://maps.google.com/maps?hl=en&ll=" + lat + "," + lng + "&z=" + state.view.zoom + "&t=" + type + "&output=embed";
    if (els.frame.src !== src) els.frame.src = src;
  }

  function record(reason) {
    if (!state.recording) return;
    const bounds = currentBounds();
    const span = Coverage.spanMeters(bounds);
    const sample = {
      t: Date.now(),
      session: sessionId,
      reason,
      lat: round(state.view.lat, 6),
      lng: round(state.view.lng, 6),
      zoom: state.view.zoom,
      mapType: state.view.mapType === "k" ? "satellite" : "roadmap",
      bounds: {
        north: round(bounds.north, 6),
        south: round(bounds.south, 6),
        east: round(bounds.east, 6),
        west: round(bounds.west, 6),
      },
      widthM: Math.round(span.width),
      heightM: Math.round(span.height),
      widthPx: frameSize().width,
      heightPx: frameSize().height,
    };
    const previous = state.samples[state.samples.length - 1];
    if (previous && !Coverage.materialChange(previous, sample)) return;
    state.samples.push(sample);
    if (state.samples.length > SAMPLE_CAP) state.samples.splice(0, state.samples.length - SAMPLE_CAP);
    if (sample.zoom >= state.minZoom) Coverage.markCells(state.cells, sample, Coverage.GRID_ZOOM);
  }

  async function flyTo(query) {
    setStatus("Looking up “" + query + "”…");
    try {
      const response = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Place search returned " + response.status + ".");
      const rows = await response.json();
      if (!rows.length) {
        setStatus("No place matched that search.");
        return;
      }
      state.view.lat = Number(rows[0].lat);
      state.view.lng = Number(rows[0].lon);
      state.view.zoom = Math.max(state.view.zoom, state.minZoom);
      commit("search");
      setStatus("Moved to " + (rows[0].display_name || query) + ".");
    } catch (error) {
      setStatus(error && error.message ? error.message : "Place search failed.");
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setStatus("This browser has no location service. Search for a place instead.");
      return;
    }
    setStatus("Requesting this device’s location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.view.lat = position.coords.latitude;
        state.view.lng = position.coords.longitude;
        state.view.zoom = Math.max(state.view.zoom, state.minZoom);
        commit("locate");
        setStatus("Moved to your location.");
      },
      () => setStatus("Location permission was denied. Search for a place instead.")
    );
  }

  function selectCurrentBlock() {
  // Get the grid tile containing the current map center.
  const tile = Coverage.latLngToTile(
    state.view.lat,
    state.view.lng,
    Coverage.GRID_ZOOM
  );

  // Create the block ID, for example: 16/37824/24861.
  selectedBlockKey = Coverage.cellKey(tile);

  // Get the geographic boundaries of this tile.
  const bounds = Coverage.tileBounds(
    tile.x,
    tile.y,
    tile.z
  );

  // Display the selected block ID.
  els.selectedBlockId.textContent =
    "Block ID: " + selectedBlockKey;

  // Display its geographic boundaries.
  els.selectedBlockBounds.textContent =
    "North: " + bounds.north.toFixed(6) +
    " | South: " + bounds.south.toFixed(6) +
    " | East: " + bounds.east.toFixed(6) +
    " | West: " + bounds.west.toFixed(6);

  // Update the application status.
  setStatus(
    "Selected block " + selectedBlockKey +
    ". You can now work with this block."
  );
  renderBlockBusinesses();
}

  
function isAllowedMapsUrl(value) {
  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();

    return (
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "maps.app.goo.gl" ||
      host === "goo.gl"
    ) && (
      host !== "google.com" ||
      url.pathname.startsWith("/maps")
    );
  } catch {
    return false;
  }
}

function openBusinessMaps() {
  const value = els.businessMapsUrl.value.trim();

  if (!isAllowedMapsUrl(value)) {
    setStatus("Enter a valid HTTPS Google Maps listing URL first.");
    els.businessMapsUrl.focus();
    return;
  }

  // Open directly from the user's click to avoid popup blocking.
  window.open(value, "_blank", "noopener,noreferrer");
}

function saveBlockBusiness(event) {
  event.preventDefault();

  if (!selectedBlockKey) {
    setStatus("Select a block before saving a business.");
    return;
  }

  const name = els.businessName.value.trim();
  const mapsUrl = els.businessMapsUrl.value.trim();

  if (!name || !mapsUrl) {
    setStatus("Business name and Google Maps URL are required.");
    return;
  }

  if (!isAllowedMapsUrl(mapsUrl)) {
    setStatus("Enter a valid HTTPS Google Maps listing URL.");
    els.businessMapsUrl.focus();
    return;
  }

  const latText = els.businessLat.value.trim();
  const lngText = els.businessLng.value.trim();

  if ((latText === "") !== (lngText === "")) {
    setStatus("Enter both latitude and longitude, or leave both empty.");
    return;
  }

  const lat = latText === "" ? null : Number(latText);
  const lng = lngText === "" ? null : Number(lngText);

  if (
    (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) ||
    (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
  ) {
    setStatus("Latitude or longitude is outside the valid range.");
    return;
  }

  // Verify that the coordinates belong to the selected grid block.
if (lat !== null && lng !== null) {
  const tile = Coverage.latLngToTile(
    lat,
    lng,
    Coverage.GRID_ZOOM
  );

  const calculatedBlockKey = Coverage.cellKey(tile);

  if (calculatedBlockKey !== selectedBlockKey) {
    const confirmed = window.confirm(
      "The business coordinates belong to block " +
      calculatedBlockKey +
      ", but you selected block " +
      selectedBlockKey +
      ".\n\nSave this business to the selected block anyway?"
    );

    if (!confirmed) {
      setStatus(
        "Business not saved. Select the correct block or update the coordinates."
      );
      return;
    }
  }
} else {
  const confirmed = window.confirm(
    "No coordinates were provided, so the business's block cannot be verified.\n\n" +
    "Save it to block " + selectedBlockKey + " anyway?"
  );

  if (!confirmed) return;
}

  const ratingText = els.businessRating.value.trim();
  const countText = els.businessReviewCount.value.trim();

  const rating = ratingText === "" ? null : Number(ratingText);
  const reviewCount = countText === "" ? null : Number(countText);

  if (
    rating !== null &&
    (!Number.isFinite(rating) || rating < 0 || rating > 5)
  ) {
    setStatus("Google rating must be between 0 and 5.");
    return;
  }

  if (
    reviewCount !== null &&
    (!Number.isSafeInteger(reviewCount) || reviewCount < 0)
  ) {
    setStatus("Review count must be a non-negative whole number.");
    return;
  }

  const id = editingBlockBusinessId || (
  window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 10)
);

const previousBusiness = state.blockBusinesses[id];

const business = {
  ...(previousBusiness || {}),
  id,
  blockKey: selectedBlockKey,
  name,
  mapsUrl,
  address: els.businessAddress.value.trim(),
  lat,
  lng,
  category: els.businessCategory.value.trim(),
  rating,
  reviewCount:
  previousBusiness && (previousBusiness.reviews || []).length > 0
    ? previousBusiness.reviews.length
    : reviewCount,
  notes: els.businessNotes.value.trim(),
  reviews: previousBusiness
    ? (previousBusiness.reviews || [])
    : [],
  createdAt: previousBusiness
    ? previousBusiness.createdAt
    : new Date().toISOString()
};

state.blockBusinesses[id] = business;
editingBlockBusinessId = null;

persistSoon();
renderBlockBusinesses();

els.blockBusinessForm.reset();

setStatus(
  '"' + name + '" was saved to block ' + selectedBlockKey + "."
);
}


function renderBlockBusinesses() {
  const hasBlock = Boolean(selectedBlockKey);

  els.blockBusinessForm.hidden = !hasBlock;

  els.businessFormHint.textContent = hasBlock
    ? "New businesses will be attached to block " + selectedBlockKey + "."
    : "Select a block first. Then enter the business details manually.";

  const businesses = Object.values(state.blockBusinesses || {})
    .filter((business) => business.blockKey === selectedBlockKey)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  els.blockBusinessCount.textContent =
    businesses.length +
    (businesses.length === 1 ? " business" : " businesses");

  els.blockBusinessList.replaceChildren();

  // Fill the business selector used by the review importer.
  if (els.reviewBusinessSelect) {
    const previousSelection = els.reviewBusinessSelect.value;
    els.reviewBusinessSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a business";
    els.reviewBusinessSelect.append(placeholder);

    businesses.forEach((business) => {
      const option = document.createElement("option");
      option.value = business.id;
      option.textContent = business.name || "Unnamed business";
      els.reviewBusinessSelect.append(option);
    });

    if (businesses.some((business) => business.id === previousSelection)) {
      els.reviewBusinessSelect.value = previousSelection;
    }
  }

  if (!hasBlock || businesses.length === 0) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = !hasBlock
      ? "Select a block to see its businesses."
      : "No businesses have been added to this block yet.";

    els.blockBusinessList.append(note);
    return;
  }

  businesses.forEach((business) => {
    const card = document.createElement("article");
    card.className = "block-business-card";

    const title = document.createElement("h4");
    title.textContent = business.name || "Unnamed business";

    const details = document.createElement("p");
    details.className = "note";
    details.textContent = [
      business.category || "",
      business.address || "",
      business.rating == null ? "" : "Rating: " + business.rating + "/5",
      "Imported reviews: " + (business.reviews || []).length,
      "Block: " + business.blockKey,
      business.lat == null || business.lng == null
        ? "Coordinates unverified"
        : "Coordinates available"
    ].filter(Boolean).join(" · ");

    card.append(title, details);

    if (business.notes) {
      const notes = document.createElement("p");
      notes.textContent = business.notes;
      card.append(notes);
    }

    // Open the saved Maps listing.
    const mapsButton = document.createElement("button");
    mapsButton.type = "button";
    mapsButton.textContent = "Open Google Maps";

    mapsButton.addEventListener("click", () => {
      if (!isAllowedMapsUrl(business.mapsUrl || "")) {
        setStatus("This saved Google Maps URL is invalid.");
        return;
      }

      window.open(
        business.mapsUrl,
        "_blank",
        "noopener,noreferrer"
      );
    });

    // Show or hide only this business's reviews.
    const viewReviewsButton = document.createElement("button");
    viewReviewsButton.type = "button";
    viewReviewsButton.textContent = "View Reviews";

    const reviewList = document.createElement("div");
    reviewList.className = "business-review-list";
    reviewList.hidden = true;

    viewReviewsButton.addEventListener("click", () => {
      reviewList.hidden = !reviewList.hidden;
      viewReviewsButton.textContent = reviewList.hidden
        ? "View Reviews"
        : "Hide Reviews";

      if (!reviewList.hidden) {
        reviewList.replaceChildren();

        const reviews = business.reviews || [];

        if (!reviews.length) {
          const empty = document.createElement("p");
          empty.className = "note";
          empty.textContent = "No reviews have been imported for this business.";
          reviewList.append(empty);
        } else {
          reviews.forEach((review) => {
            const reviewCard = document.createElement("article");
            reviewCard.className = "business-review";

            const reviewer = document.createElement("strong");
            reviewer.textContent = [
              review.reviewer || "Unknown reviewer",
              review.rating == null ? "" : review.rating + "/5"
            ].filter(Boolean).join(" · ");

            const reviewText = document.createElement("p");
            reviewText.textContent = review.text || "(No review text)";

            const date = document.createElement("small");
            date.textContent = review.reviewDate || "";

            reviewCard.append(reviewer, reviewText, date);
            reviewList.append(reviewCard);
          });
        }
      }
    });

    // Load the selected business into the existing form.
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      editingBlockBusinessId = business.id;

      els.businessName.value = business.name || "";
      els.businessMapsUrl.value = business.mapsUrl || "";
      els.businessAddress.value = business.address || "";
      els.businessLat.value = business.lat ?? "";
      els.businessLng.value = business.lng ?? "";
      els.businessCategory.value = business.category || "";
      els.businessRating.value = business.rating ?? "";
      els.businessReviewCount.value = business.reviewCount ?? "";
      els.businessNotes.value = business.notes || "";

      els.businessFormHint.textContent =
        "Editing " + (business.name || "this business") +
        ". Submit the form to save changes.";

      els.blockBusinessForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      els.businessName.focus();
    });

    // Delete this business and its attached reviews.
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Delete " + (business.name || "this business") +
        " and its imported reviews?"
      );

      if (!confirmed) return;

      delete state.blockBusinesses[business.id];

      if (editingBlockBusinessId === business.id) {
        editingBlockBusinessId = null;
        els.blockBusinessForm.reset();
      }

      persistSoon();
      renderBlockBusinesses();
      setStatus("Business and its reviews deleted.");
    });

    const actions = document.createElement("div");
    actions.className = "business-card-actions";
    actions.append(
      mapsButton,
      viewReviewsButton,
      editButton,
      deleteButton
    );

    card.append(actions, reviewList);
    els.blockBusinessList.append(card);
  });
}
 

  function currentBounds() {
    const size = frameSize();
    return Coverage.viewBounds(state.view.lat, state.view.lng, state.view.zoom, size.width, size.height);
  }

  function frameSize() {
    const rect = els.frame.getBoundingClientRect();
    return {
      width: Math.max(320, Math.round(rect.width || window.innerWidth)),
      height: Math.max(320, Math.round(rect.height || window.innerHeight)),
    };
  }

  function rebuildCells() {
    const businessByKey = {};
    Object.values(state.cells).forEach((cell) => {
      if (cell.business) businessByKey[cell.key] = cell.business;
    });
    const next = {};
    state.samples.forEach((sample) => {
      if (sample.zoom >= state.minZoom) Coverage.markCells(next, sample, Coverage.GRID_ZOOM);
    });
    Object.entries(businessByKey).forEach(([key, business]) => {
      if (!next[key]) {
        const tile = Coverage.parseKey(key);
        next[key] = {
          z: tile.z, x: tile.x, y: tile.y, key,
          maxZoom: business.zoom, minZoom: business.zoom,
          firstSeen: business.t, lastSeen: business.t, samples: 0, business,
        };
      } else {
        next[key].business = business;
      }
    });
    state.cells = next;
  }

  function renderAll() {
  paintReadout();
  updateCounts();
  paintMinimap();
  renderPlaces();
  renderTrail();
  renderBlockBusinesses();
}

  function paintReadout() {
    const bounds = currentBounds();
    const span = Coverage.spanMeters(bounds);
    els.statLat.textContent = state.view.lat.toFixed(5);
    els.statLng.textContent = state.view.lng.toFixed(5);
    els.statZoom.textContent = state.view.zoom.toFixed(0);
    els.statType.textContent = state.view.mapType === "k" ? "satellite" : "roadmap";
    els.statSpan.textContent = formatDistance(span.width) + " × " + formatDistance(span.height);
    els.statBounds.textContent =
      bounds.north.toFixed(4) + " to " + bounds.south.toFixed(4) + " · " +
      bounds.west.toFixed(4) + " to " + bounds.east.toFixed(4);
  }

  function updateCounts() {
    const covered = Coverage.coveredCells(state.cells, state.minZoom);
    const area = covered.reduce((sum, cell) => sum + Coverage.cellAreaM2(cell.x, cell.y, cell.z), 0);
    els.statCells.textContent = String(covered.length);
    els.statArea.textContent = (area / 1e6).toFixed(area > 1e7 ? 0 : 2) + " km²";
    els.statSamples.textContent = String(state.samples.length);
    els.statPlaces.textContent = String(Object.keys(state.businesses).length);
    els.statInView.textContent = String(placesInView().length);
    els.storageNote.hidden = !state.storageWarning;
    els.storageNote.textContent = state.storageWarning || "";
  }

  function paintMinimap() {
    const canvas = els.minimap;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 120;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const cells = Coverage.coveredCells(state.cells, state.minZoom);
    if (!cells.length) return;
    let north = -Infinity;
    let south = Infinity;
    let east = -Infinity;
    let west = Infinity;
    const boxes = cells.map((cell) => {
      const box = Coverage.tileBounds(cell.x, cell.y, cell.z);
      north = Math.max(north, box.north);
      south = Math.min(south, box.south);
      east = Math.max(east, box.east);
      west = Math.min(west, box.west);
      return { cell, box };
    });
    const pad = 8;
    const lonSpan = Math.max(east - west, 1e-6);
    const latSpan = Math.max(north - south, 1e-6);
    boxes.forEach(({ cell, box }) => {
      const x = pad + ((box.west - west) / lonSpan) * (width - pad * 2);
      const y = pad + ((north - box.north) / latSpan) * (height - pad * 2);
      const rectW = Math.max(2, ((box.east - box.west) / lonSpan) * (width - pad * 2));
      const rectH = Math.max(2, ((box.north - box.south) / latSpan) * (height - pad * 2));
      context.fillStyle = "rgba(31, 107, 74, 0.45)";
      context.fillRect(x, y, rectW, rectH);
      if (cell.business) {
        context.strokeStyle = cell.business.status === "complete" ? "#a67c2d" : "#a84b38";
        context.lineWidth = 2;
        context.strokeRect(x + 1, y + 1, Math.max(0, rectW - 2), Math.max(0, rectH - 2));
      }
    });
  }

  function placesInView() {
    const bounds = currentBounds();
    const query = els.placeFilter.value.trim().toLowerCase();
    return Object.values(state.businesses)
      .filter((place) => placeOnScreen(place, bounds))
      .filter((place) => !query || (place.name + " " + place.address + " " + place.primaryTypeLabel).toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function placeOnScreen(place, bounds) {
    const seen = place.seenBounds;
    if (!seen) return Coverage.inBounds(place, bounds);
    return seen.south <= bounds.north && seen.north >= bounds.south && seen.west <= bounds.east && seen.east >= bounds.west;
  }

  function renderPlaces() {
    const places = placesInView();
    fillList(els.placeList, places.slice(0, 200), placeButton, places.length > 200
      ? "Showing 200 of " + places.length + " places in this view."
      : places.length === 0 ? "No saved places in this view yet." : "");
  }

  function renderTrail() {
    const recent = state.samples.slice(-40).reverse();
    fillList(els.trailList, recent, trailButton, recent.length ? "" : "The camera trail is empty.");
  }

  function fillList(container, items, renderItem, noteText) {
    container.replaceChildren();
    if (noteText && items.length === 0) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = noteText;
      container.append(note);
      return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.append(renderItem(item)));
    if (noteText) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = noteText;
      fragment.append(note);
    }
    container.append(fragment);
  }

  function placeButton(place) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "row";
    const title = document.createElement("strong");
    title.textContent = place.name;
    const detail = document.createElement("small");
    detail.textContent = [place.primaryTypeLabel, place.address, "zoom " + place.capturedZoom].filter(Boolean).join(" · ");
    button.append(title, detail);
    button.addEventListener("click", () => {
      state.view.lat = place.lat;
      state.view.lng = place.lng;
      state.view.zoom = Math.max(state.view.zoom, 17);
      commit("place");
    });
    return button;
  }

  function trailButton(sample) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "row";
    const title = document.createElement("strong");
    title.textContent = "Zoom " + sample.zoom + " · " + sample.mapType;
    const detail = document.createElement("small");
    detail.textContent = formatTime(sample.t) + " · " + sample.lat.toFixed(5) + ", " + sample.lng.toFixed(5) +
      " · " + formatDistance(sample.widthM) + " wide";
    button.append(title, detail);
    button.addEventListener("click", () => {
      state.view.lat = sample.lat;
      state.view.lng = sample.lng;
      state.view.zoom = sample.zoom;
      state.view.mapType = sample.mapType === "satellite" ? "k" : "m";
      commit("resume");
    });
    return button;
  }

  function selectTab(tab) {
    const places = tab === "places";
    els.tabPlaces.setAttribute("aria-selected", places ? "true" : "false");
    els.tabTrail.setAttribute("aria-selected", places ? "false" : "true");
    els.placesPane.hidden = !places;
    els.trailPane.hidden = places;
  }

  function applyToggles() {
    setSwitch(els.recordingToggle, state.recording, "Recording", "Paused");
    setSwitch(els.mapTypeRoad, state.view.mapType !== "k", "Map", "Map");
    setSwitch(els.mapTypeSat, state.view.mapType === "k", "Satellite", "Satellite");
    els.minZoom.value = String(state.minZoom);
    els.minZoomValue.textContent = String(state.minZoom);
  }

  function setSwitch(button, on, onLabel, offLabel) {
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.textContent = on ? onLabel : offLabel;
  }

  function exportJson() {
    snapshotProjects();
    download("map-coverage-" + fileStamp() + ".json", JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      gridZoom: Coverage.GRID_ZOOM,
      minZoom: state.minZoom,
      activeId: state.activeId,
      projects: state.projects,
    }), "application/json");
  }

  function exportCsv() {
    const header = ["id", "name", "address", "lat", "lng", "primaryType", "capturedZoom", "capturedMapType", "firstSeen", "lastSeen", "mapsUri"];
    const lines = [header.join(",")];
    Object.values(state.businesses).forEach((place) => {
      lines.push(header.map((column) => csvField(place[column])).join(","));
    });
    download("map-coverage-places-" + fileStamp() + ".csv", lines.join("\n"), "text/csv");
  }

  
function parseReviewCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"' && quoted && text[i + 1] === '"') {
      value += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;

      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);

      row = [];
      value = "";
    } else {
      value += ch;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) =>
    header.trim().toLowerCase().replace(/^\uFEFF/, "")
  );

  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] || "").trim();
    });
    return record;
  });
}

function normaliseReview(raw) {
  const get = (...keys) => {
    for (const key of keys) {
      const value = raw[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  };

  const ratingText = get("rating", "stars", "review rating");
  const rating = ratingText ? Number(ratingText) : null;

  return {
    id: get("review id", "reviewid", "id") || null,
    rating: Number.isFinite(rating) ? rating : null,
    text: get("review", "review text", "text", "content", "comment"),
    reviewer: get("reviewer", "author", "user", "name"),
    reviewDate: get("date", "review date", "reviewdate", "published at") || null,
    source: "browser-extension"
  };
}


function exportBusinessesCsv() {
  snapshotProjects();

  const header = [
    "projectId",
    "projectName",
    "businessId",
    "blockKey",
    "name",
    "address",
    "mapsUrl",
    "lat",
    "lng",
    "category",
    "rating",
    "reviewCount",
    "notes"
  ];

  const lines = [header.map(csvField).join(",")];

  state.projects.forEach((project) => {
    Object.values(project.blockBusinesses || {}).forEach((business) => {
      const row = [
        project.id,
        project.name,
        business.id,
        business.blockKey,
        business.name,
        business.address,
        business.mapsUrl,
        business.lat,
        business.lng,
        business.category,
        business.rating,
        (business.reviews || []).length,
        business.notes
      ];

      lines.push(row.map(csvField).join(","));
    });
  });

  download(
    "block-businesses-" + fileStamp() + ".csv",
    lines.join("\r\n"),
    "text/csv;charset=utf-8"
  );
}

function exportReviewsCsv() {
  snapshotProjects();

  const header = [
    "projectId",
    "projectName",
    "blockKey",
    "businessId",
    "businessName",
    "reviewId",
    "reviewer",
    "rating",
    "reviewText",
    "reviewDate",
    "source"
  ];

  const lines = [header.map(csvField).join(",")];

  state.projects.forEach((project) => {
    Object.values(project.blockBusinesses || {}).forEach((business) => {
      (business.reviews || []).forEach((review) => {
        const row = [
          project.id,
          project.name,
          business.blockKey,
          business.id,
          business.name,
          review.id,
          review.reviewer,
          review.rating,
          review.text,
          review.reviewDate,
          review.source
        ];

        lines.push(row.map(csvField).join(","));
      });
    });
  });

  download(
    "business-reviews-" + fileStamp() + ".csv",
    lines.join("\r\n"),
    "text/csv;charset=utf-8"
  );
}

  function clearJournal() {
    const name = activeProject().name;
    if (!window.confirm("Delete recorded views, covered blocks, and saved places for " + name + "?")) return;
    state.samples = [];
    state.cells = {};
    state.businesses = {};
    state.requests = 0;
    const project = activeProject();
    project.samples = state.samples;
    project.cells = state.cells;
    project.businesses = state.businesses;
    project.requests = 0;
    persistNow();
    renderAll();
    setStatus(name + " was cleared. Other cities are unchanged.");
  }

  function blankProject(name, view) {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.slice(0, 60),
      requests: 0,
      view: {
        lat: view.lat,
        lng: view.lng,
        zoom: clamp(view.zoom, 3, 20),
        mapType: view.mapType === "k" ? "k" : "m",
      },
      samples: [],
      cells: {},
      businesses: {},
      blockBusinesses: {},
    };
  }

  function activeProject() {
    return state.projects.find((item) => item.id === state.activeId) || state.projects[0];
  }

  function snapshotProjects() {
    const project = activeProject();
    project.view = state.view;
    project.samples = state.samples;
    project.cells = state.cells;
    project.businesses = state.businesses;
    project.blockBusinesses = state.blockBusinesses;
    project.requests = state.requests;
  }

  function activate(project) {
    snapshotProjects();
    state.activeId = project.id;
    state.view = project.view;
    state.samples = project.samples;
    state.cells = project.cells;
    state.businesses = project.businesses;
    state.blockBusinesses = project.blockBusinesses || {};
    state.requests = project.requests;
    selectedBlockKey = null;

    els.selectedBlockId.textContent = "No block selected";
    els.selectedBlockBounds.textContent =
      "Select a block to see its geographic boundaries.";
    renderProjects();
    renderFrame();
    record("project");
    renderAll();
    persistSoon();
  }

  function renderProjects() {
    els.projectSelect.replaceChildren();
    state.projects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      els.projectSelect.append(option);
    });
    els.projectSelect.value = state.activeId;
  }

  async function openCity(name) {
    if (state.projects.length >= 40) {
      setStatus("Forty cities are already open. Clear one before adding another.");
      return;
    }
    setStatus("Looking up “" + name + "”…");
    try {
      const response = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(name), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("City search returned " + response.status + ".");
      const rows = await response.json();
      if (!rows.length) {
        setStatus("No city matched that name.");
        return;
      }
      const project = blankProject(name, {
        lat: Number(rows[0].lat),
        lng: Number(rows[0].lon),
        zoom: state.minZoom,
        mapType: state.view.mapType,
      });
      state.projects.push(project);
      els.newProjectForm.hidden = true;
      els.newProjectName.value = "";
      activate(project);
      setStatus("Opened " + project.name + ". Green blocks are only for this city.");
    } catch (error) {
      setStatus(error && error.message ? error.message : "City search failed.");
    }
  }

  function normalizeView(view, fallback) {
    const source = view || {};
    return {
      lat: Number.isFinite(source.lat) ? source.lat : fallback.lat,
      lng: Number.isFinite(source.lng) ? source.lng : fallback.lng,
      zoom: clamp(Number(source.zoom) || fallback.zoom, 3, 20),
      mapType: source.mapType === "k" ? "k" : "m",
    };
  }

  function normalizeProject(raw, fallbackView) {
    const view = normalizeView(raw && raw.view, fallbackView);
    const project = blankProject(
      typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : "City",
      view
    );
    if (typeof raw?.id === "string" && raw.id) project.id = raw.id;
    project.requests = Number.isFinite(raw?.requests) ? raw.requests : 0;
    project.samples = Array.isArray(raw?.samples) ? raw.samples.slice(-SAMPLE_CAP) : [];
    project.cells = raw?.cells && typeof raw.cells === "object" && !Array.isArray(raw.cells) ? raw.cells : {};
    project.businesses = raw?.businesses && typeof raw.businesses === "object" && !Array.isArray(raw.businesses) ? raw.businesses : {};   
    const savedBlockBusinesses = raw?.blockBusinesses;

    project.blockBusinesses =
      savedBlockBusinesses &&
      typeof savedBlockBusinesses === "object" &&
      !Array.isArray(savedBlockBusinesses)
        ? Object.fromEntries(
            Object.entries(savedBlockBusinesses)
              .filter(([id, business]) =>
                typeof id === "string" &&
                business !== null &&
                typeof business === "object" &&
                !Array.isArray(business)
              )
              .map(([id, business]) => [
                id,
                {
                  ...business,

                  // Ensure every business has an ID.
                  id:
                    typeof business.id === "string" && business.id
                      ? business.id
                      : id,

                  // Keep the block association.
                  blockKey:
                    typeof business.blockKey === "string"
                      ? business.blockKey
                      : "",

                  // Older records may not contain reviews.
                  reviews: Array.isArray(business.reviews)
                    ? business.reviews
                    : []
                }
              ])
          )
        : {};
    return project;
  }

  function shellFrom(project, settings) {
    return {
      version: 2,
      minZoom: settings.minZoom,
      recording: settings.recording,
      storageWarning: "",
      projects: settings.projects,
      activeId: project.id,
      requests: project.requests,
      view: project.view,
      samples: project.samples,
      cells: project.cells,
      businesses: project.businesses,
      blockBusinesses: project.blockBusinesses || {},
    };
  }

  function loadData() {
    const fallbackView = { lat: 20, lng: 0, zoom: 3, mapType: "m" };
    const fresh = blankProject("City 1", fallbackView);
    const emptySettings = { minZoom: 16, recording: true, projects: [fresh] };
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (!raw) return shellFrom(fresh, emptySettings);
      const data = JSON.parse(raw);
      if (!data) return shellFrom(fresh, emptySettings);
      const minZoom = clamp(Number(data.minZoom) || 16, 13, 18);
      const recording = data.recording !== false;
      if (data.version === 2 && Array.isArray(data.projects) && data.projects.length) {
        const projects = data.projects.slice(0, 40).map((item) => normalizeProject(item, fallbackView));
        const active = projects.find((item) => item.id === data.activeId) || projects[0];
        return shellFrom(active, { minZoom, recording, projects });
      }
      if (data.version !== 1) return shellFrom(fresh, emptySettings);
      const saved = normalizeProject({
      name: "Saved city",
      requests: data.requests,
      view: data.view,
      samples: data.samples,
      cells: data.cells,
      businesses: data.businesses,

      // Preserve block businesses if they exist in the saved data
      blockBusinesses: data.blockBusinesses,
    }, fallbackView);
      return shellFrom(saved, { minZoom, recording, projects: [saved] });
    } catch {
      return shellFrom(fresh, emptySettings);
    }
  }

  function persistSoon() {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(persistNow, 400);
  }

  function persistNow() {
    snapshotProjects();
    const payload = {
      version: 2,
      minZoom: state.minZoom,
      recording: state.recording,
      activeId: state.activeId,
      projects: state.projects,
    };
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(payload));
      state.storageWarning = "";
    } catch {
      state.storageWarning = "This browser blocked local storage. The journal stays in memory until you export it.";
    }
  }

  function setStatus(text) {
    els.statusLine.textContent = text;
  }

  function formatDistance(meters) {
    if (!Number.isFinite(meters)) return "—";
    if (meters < 1000) return Math.round(meters) + " m";
    const km = meters / 1000;
    return (km < 10 ? km.toFixed(2) : km.toFixed(1)) + " km";
  }

  function formatTime(value) {
    return new Date(value).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }

  function csvField(value) {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function fileStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function wrapLng(lng) {
    let value = lng;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  
async function importReviews() {
  const businessId = els.reviewBusinessSelect.value;
  const file = els.reviewFile.files[0];

  if (!businessId) {
    els.reviewImportStatus.textContent =
      "Select a business first.";
    return;
  }

  if (!file) {
    els.reviewImportStatus.textContent =
      "Choose a CSV or JSON file first.";
    return;
  }

  const business = state.blockBusinesses?.[businessId];

  if (!business) {
    els.reviewImportStatus.textContent =
      "The selected business was not found.";
    return;
  }

  try {
    const text = await file.text();
    let records;

    if (file.name.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);

      records = Array.isArray(parsed)
        ? parsed
        : parsed.reviews || parsed.data || parsed.items;

      if (!Array.isArray(records)) {
        throw new Error(
          "The JSON file does not contain a review array."
        );
      }
    } else {
      records = parseReviewCsv(text);
    }

    const reviews = records
      .map(normaliseReview)
      .filter((review) => review.text);

    if (!reviews.length) {
      throw new Error(
        "No review text was found. Check the export's column names."
      );
    }

    const existing = new Set(
      (business.reviews || []).map(reviewFingerprint)
    );

    const unique = reviews.filter((review) => {
      const key = reviewFingerprint(review);

      if (existing.has(key)) return false;

      existing.add(key);
      return true;
    });

    const duplicates = reviews.length - unique.length;

    els.reviewPreview.replaceChildren();

    unique.slice(0, 10).forEach((review) => {
      const item = document.createElement("div");
      item.className = "row";

      const title = document.createElement("strong");
      title.textContent =
        (review.rating == null ? "" : review.rating + "/5 · ") +
        (review.reviewer || "Unknown reviewer");

      const detail = document.createElement("small");
      detail.textContent = review.text;

      item.append(title, detail);
      els.reviewPreview.append(item);
    });

    const confirmed = window.confirm(
      "Found " + reviews.length + " reviews.\n" +
      "New reviews: " + unique.length + "\n" +
      "Duplicates skipped: " + duplicates + "\n\n" +
      "Import the new reviews into " + business.name + "?"
    );

    if (!confirmed) {
      els.reviewImportStatus.textContent =
        "Import cancelled. No reviews were saved.";
      return;
    }

    business.reviews = [
      ...(business.reviews || []),
      ...unique
    ];

    business.reviewCount = business.reviews.length;
    business.lastImportedAt = new Date().toISOString();

    persistSoon();
    renderBlockBusinesses();

    els.reviewImportStatus.textContent =
      "Imported " + unique.length +
      " new reviews. Skipped " + duplicates + " duplicates.";

  } catch (error) {
    els.reviewImportStatus.textContent =
      error.message || "Could not import this file.";
  }
}

function reviewFingerprint(review) {
  if (review.id) return "id:" + review.id;

  return [
    review.reviewer,
    review.rating,
    review.text,
    review.reviewDate
  ].map((value) =>
    String(value || "").trim().toLowerCase()
  ).join("|");
}

})();
