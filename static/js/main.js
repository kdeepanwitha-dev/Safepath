/* SafePath Frontend Controller (Pan-India Search + Compass GPS + Chart.js + Police Dispatch DB) */
(function () {
  "use strict";

  const QUOTES = [
    "“The shortest road in minutes is rarely the wisest road after dark.”",
    "“Safety is not an extra detour — it is the primary objective of every journey.”",
    "“Adaptive routing turns static city data into confident, human-centered decisions.”",
  ];

  const ROUTE_ORDER = ["adaptive", "fixed", "safety", "shortest"];

  const STRATEGY_META = {
    adaptive: {
      routeNum: 1,
      shortTag: "Route 1",
      name: "Adaptive / Multi-Objective",
      badge: "Proposed Method",
      color: "#059669",
      dashArray: null,
      weight: 6,
    },
    fixed: {
      routeNum: 2,
      shortTag: "Route 2",
      name: "Fixed Weighted Route",
      badge: "Static Trade-Off",
      color: "#4f46e5",
      dashArray: "10, 6",
      weight: 4,
    },
    safety: {
      routeNum: 3,
      shortTag: "Route 3",
      name: "Safety-Only Route",
      badge: "Max Safety",
      color: "#0284c7",
      dashArray: null,
      weight: 4,
    },
    shortest: {
      routeNum: 4,
      shortTag: "Route 4",
      name: "Shortest / Fastest Route",
      badge: "Min Time",
      color: "#e11d48",
      dashArray: "5, 7",
      weight: 4,
    },
  };

  const CATEGORY_BADGES = {
    shop: { label: "Shop / Mall", cls: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
    food: { label: "Food / Cafe", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    landmark: { label: "Landmark", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    transit: { label: "Transit", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    tech: { label: "Tech Hub", cls: "bg-cyan-50 text-cyan-800 border-cyan-200" },
    hospital: { label: "Hospital", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    city: { label: "City", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    hub: { label: "Area / Hub", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  };

  const state = {
    locations: [],
    allPlaces: [],
    presets: [],
    emergencyPois: [],
    defaultWeights: {},
    factorLabels: {},
    factorWeights: {},
    profile: null,
    activeCategory: "",
    source: "majestic",
    dest: "koramangala",
    sourcePlace: null,
    destPlace: null,
    timeOfDay: "night",
    travelMode: "car",
    riskPreference: 55,
    fixedSafetyWeight: 0.7,
    overallSensBalance: 50,
    disruptions: {},
    selectedStrategy: "adaptive",
    mapMode: "strategies",
    basemap: "osm",
    showPois: true,
    userGps: null, // { lat, lng, label, isLive, approachCoords }
    pickingGps: false,
    gpsWatchId: null,
    compassListening: false,
    hasCompassReading: false,
    navRunning: false,
    navWaypoints: [],
    lastMovedPos: null,
    currentVehiclePos: null,
    currentHeading: 0,
    totalMovedKm: 0,
    hasUserMoved: false,
    arrivedNotified: false,
    awaitingInitialWatchFix: false,
    latestResponse: null,
    latestRobustness: null,
    analysisSeq: 0,
    debounceTimer: null,
    searchTimers: { source: null, dest: null },
    gpsRoleTarget: "source",
    detectedIpLoc: null,
    curLocSearchTimer: null,
    emergencyActive: false,
    emergencyData: null,
    preEmergencySnapshot: null,
  };

  let map = null;
  let baseTileLayer = null;
  let satLabelsLayer = null;
  let routeLayerGroup = null;
  let poiLayerGroup = null;
  let nodeLayerGroup = null;
  let gpsLayerGroup = null;
  let vehicleMarker = null;

  // ---------------------------------------------------------------------------
  // Utility & Geo Helpers
  // ---------------------------------------------------------------------------
  function escapeHtml(val) {
    return String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(msg, isError) {
    const banner = document.getElementById("toast-banner");
    const dot = document.getElementById("toast-dot");
    const text = document.getElementById("toast-text");
    if (!banner || !text) return;
    text.textContent = msg;
    if (dot) {
      dot.className = "h-2.5 w-2.5 rounded-full shrink-0 " + (isError ? "bg-rose-400" : "bg-safe-400");
    }
    banner.classList.remove("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      banner.classList.add("hidden");
    }, 4200);
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }

  function computeBearingDeg(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function bearingToCompass(deg) {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
    return dirs[idx];
  }

  function startRotatingQuotes() {
    let idx = 0;
    const el = document.getElementById("rotating-quote");
    const dots = document.querySelectorAll(".quote-dot");
    if (!el || dots.length === 0) return;

    setInterval(() => {
      idx = (idx + 1) % QUOTES.length;
      el.style.opacity = "0";
      setTimeout(() => {
        el.textContent = QUOTES[idx];
        el.style.opacity = "1";
      }, 220);
      dots.forEach((d, i) => {
        d.className =
          i === idx
            ? "quote-dot h-1.5 w-3 rounded-full bg-safe-400 transition-all"
            : "quote-dot h-1.5 w-1.5 rounded-full bg-white/30 transition-all";
      });
    }, 5200);
  }

  function getQueryPayload() {
    return {
      source: state.source,
      dest: state.dest,
      source_place: state.sourcePlace,
      dest_place: state.destPlace,
      time_of_day: state.timeOfDay,
      travel_mode: state.travelMode,
      risk_preference: state.riskPreference,
      fixed_safety_weight: state.fixedSafetyWeight,
      factor_weights: state.factorWeights,
      overall_sens_balance: state.overallSensBalance,
      disruptions: state.disruptions,
      emergency_mode: state.emergencyActive,
    };
  }

  async function apiJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      let detail = "Request failed (" + res.status + ")";
      try {
        const err = await res.json();
        if (err && err.error) detail = err.error;
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Leaflet Map Initialization & Zero-Watermark Tile Layers
  // ---------------------------------------------------------------------------
  function applyBasemap(mode) {
    state.basemap = mode;
    if (!map) return;

    if (baseTileLayer) map.removeLayer(baseTileLayer);
    if (satLabelsLayer) {
      map.removeLayer(satLabelsLayer);
      satLabelsLayer = null;
    }

    if (mode === "sat") {
      baseTileLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
        }
      ).addTo(map);
      satLabelsLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.75 }
      ).addTo(map);
    } else {
      let fellBack = false;
      baseTileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      });
      baseTileLayer.on("tileerror", () => {
        if (fellBack || state.basemap !== "osm") return;
        fellBack = true;
        map.removeLayer(baseTileLayer);
        baseTileLayer = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19 }
        ).addTo(map);
      });
      baseTileLayer.addTo(map);
    }

    const osmBtn = document.getElementById("basemap-osm");
    const satBtn = document.getElementById("basemap-sat");
    if (osmBtn && satBtn) {
      osmBtn.className =
        mode === "osm"
          ? "px-2 py-1 rounded-md bg-navy-900 text-white transition"
          : "px-2 py-1 rounded-md text-slate-600 hover:text-navy-900 transition";
      satBtn.className =
        mode === "sat"
          ? "px-2 py-1 rounded-md bg-navy-900 text-white transition"
          : "px-2 py-1 rounded-md text-slate-600 hover:text-navy-900 transition";
    }
  }

  function initMap() {
    map = L.map("safepath-map", {
      center: [12.956, 77.602],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    applyBasemap("osm");

    routeLayerGroup = L.layerGroup().addTo(map);
    nodeLayerGroup = L.layerGroup().addTo(map);
    poiLayerGroup = L.layerGroup().addTo(map);
    gpsLayerGroup = L.layerGroup().addTo(map);

    map.on("click", (e) => {
      if (!state.pickingGps) return;
      if (state.navRunning) {
        handleUserMovement(e.latlng.lat, e.latlng.lng, null, null);
        updateGpsStatusPill(`Live GPS Position (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`, true);
      } else {
        const targetRole = state.gpsRoleTarget || "source";
        setUserGpsPosition(e.latlng.lat, e.latlng.lng, "Pinned GPS Position", false, targetRole);
        state.gpsRoleTarget = "source";
      }
      togglePickGpsMode(false);
    });
  }

  function renderEmergencyPois() {
    if (!poiLayerGroup) return;
    poiLayerGroup.clearLayers();
    if (!state.showPois) return;

    state.emergencyPois.forEach((poi) => {
      const isPolice = poi.type === "police";
      const safeName = escapeHtml(poi.name);
      const safeCity = escapeHtml(poi.city || "India");
      const icon = L.divIcon({
        className: "",
        html: `<div class="poi-marker-badge ${isPolice ? "poi-police" : "poi-hospital"}" title="${safeName}">${isPolice ? "P" : "H"}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([poi.lat, poi.lng], { icon })
        .bindPopup(`<div class="text-xs"><strong>${safeName}</strong><br/><span class="text-slate-600">${isPolice ? "Police Station" : "Hospital / Emergency Care"} · ${safeCity}</span></div>`)
        .addTo(poiLayerGroup);
    });
  }

  function segmentRiskColor(score) {
    if (score >= 70) return "#10b981";
    if (score >= 40) return "#f59e0b";
    return "#e11d48";
  }

  // ---------------------------------------------------------------------------
  // Rapido/Ola/Uber Style Pan-Bengaluru & Pan-India Place Autocomplete Search
  // ---------------------------------------------------------------------------
  function placeDisplayLabel(p) {
    if (!p) return "";
    if (p.area && p.city && !p.name.toLowerCase().includes(p.area.toLowerCase())) {
      return `${p.name} (${p.area})`;
    }
    return p.name;
  }

  function closeAllPlaceDropdowns() {
    const s = document.getElementById("source-dropdown");
    const d = document.getElementById("dest-dropdown");
    if (s) s.classList.add("hidden");
    if (d) d.classList.add("hidden");
  }

  function selectPlaceForRole(role, place) {
    if (!place) return;
    const other = role === "source" ? state.destPlace : state.sourcePlace;
    if (other && haversineKm(place.lat, place.lng, other.lat, other.lng) < 0.05 && place.id === other.id) {
      showToast("Pickup and Destination must be two distinct locations.", true);
      closeAllPlaceDropdowns();
      return;
    }
    if (role === "source") {
      state.sourcePlace = place;
      state.source = place.id || "custom";
      state.userGps =
        place.id === "current_location"
          ? { lat: place.lat, lng: place.lng, label: place.name, isLive: true, approachCoords: null }
          : null;
      const inp = document.getElementById("source-search-input");
      if (inp) inp.value = placeDisplayLabel(place);
      updateGpsStatusPill(
        place.id === "current_location"
          ? `GPS Vehicle at Current Location (${place.name})`
          : `GPS Vehicle anchored at ${place.name}`,
        place.id === "current_location"
      );
    } else {
      if (state.emergencyActive) {
        state.emergencyActive = false;
        state.emergencyData = null;
        state.preEmergencySnapshot = null;
        setEmergencyVisualState(false);
      }
      state.destPlace = place;
      state.dest = place.id || "custom";
      const inp = document.getElementById("dest-search-input");
      if (inp) inp.value = placeDisplayLabel(place);
    }

    state.disruptions = {};
    renderRobustnessPanel(null);
    closeAllPlaceDropdowns();

    if (state.emergencyActive && role === "source") {
      activateEmergencySos(false);
    } else {
      runAnalysis();
    }
  }

  function renderPlaceDropdown(role, places, queryStr) {
    const dd = document.getElementById(role === "source" ? "source-dropdown" : "dest-dropdown");
    if (!dd) return;

    const myLocRow = `
      <button type="button" data-use-my-loc="${role}" class="w-full text-left px-3.5 py-2.5 bg-sky-50/90 hover:bg-sky-100 transition flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="h-7 w-7 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">&#10148;</span>
          <div class="min-w-0">
            <div class="text-xs font-extrabold text-sky-900">Use My Current Location</div>
            <div class="text-[11px] text-sky-700 truncate">Detect live GPS &amp; turn compass arrow automatically</div>
          </div>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-600 text-white shrink-0">GPS</span>
      </button>
    `;

    const itemsHtml = (places || [])
      .map((p, idx) => {
        const badge = CATEGORY_BADGES[p.category] || CATEGORY_BADGES.hub;
        const distBadge = typeof p.dist_km === "number" ? `${p.dist_km.toFixed(1)} km` : "";
        return `
          <button type="button" data-place-idx="${idx}" class="w-full text-left px-3.5 py-2 hover:bg-emerald-50/80 transition flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold text-navy-900 truncate">${escapeHtml(p.name)}</div>
              <div class="text-[11px] text-slate-500 truncate">${escapeHtml(p.area || "")}${p.area && p.city ? " · " : ""}${escapeHtml(p.city || "")}</div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${distBadge ? `<span class="text-[10px] font-semibold text-slate-500">${escapeHtml(distBadge)}</span>` : ""}
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.cls}">${badge.label}</span>
            </div>
          </button>
        `;
      })
      .join("");

    const emptyNotice =
      !places || places.length === 0
        ? `<div class="px-3.5 py-3 text-xs text-slate-500">No places matched “${escapeHtml(queryStr)}”. Try another neighborhood, shop, food spot, or Indian city.</div>`
        : "";

    dd.innerHTML = myLocRow + itemsHtml + emptyNotice;
    dd.setAttribute("data-query-ready", queryStr || "");
    dd.classList.remove("hidden");

    const myLocBtn = dd.querySelector(`[data-use-my-loc="${role}"]`);
    if (myLocBtn) {
      myLocBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        closeAllPlaceDropdowns();
        requestRealGps(role);
      });
    }

    dd.querySelectorAll("[data-place-idx]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const i = Number(btn.getAttribute("data-place-idx"));
        if (places[i]) selectPlaceForRole(role, places[i]);
      });
    });
  }

  const placeSearchSeq = { source: 0, dest: 0 };

  async function queryPlacesDropdown(role, queryText) {
    const dd = document.getElementById(role === "source" ? "source-dropdown" : "dest-dropdown");
    if (!dd) return;
    const seq = ++placeSearchSeq[role];
    const refLat = state.userGps ? state.userGps.lat : state.sourcePlace?.lat ?? 12.9716;
    const refLng = state.userGps ? state.userGps.lng : state.sourcePlace?.lng ?? 77.5946;

    try {
      const qs = new URLSearchParams({
        q: queryText || "",
        category: state.activeCategory || "",
        lat: String(refLat),
        lng: String(refLng),
        limit: "18",
      });
      const data = await apiJson("/api/places/search?" + qs.toString());
      if (seq !== placeSearchSeq[role]) return;
      renderPlaceDropdown(role, data.places || [], queryText || "");
    } catch (_) {
      if (seq !== placeSearchSeq[role]) return;
      renderPlaceDropdown(role, state.allPlaces || [], queryText || "");
    }
  }

  function wirePlaceAutocomplete(role) {
    const inputId = role === "source" ? "source-search-input" : "dest-search-input";
    const ddId = role === "source" ? "source-dropdown" : "dest-dropdown";
    const clearId = role === "source" ? "source-clear-btn" : "dest-clear-btn";
    const inp = document.getElementById(inputId);
    const dd = document.getElementById(ddId);
    const clr = document.getElementById(clearId);
    if (!inp) return;

    inp.addEventListener("focus", () => {
      if (dd && dd.classList.contains("hidden")) {
        queryPlacesDropdown(role, "");
      }
    });

    inp.addEventListener("input", () => {
      if (dd) {
        dd.removeAttribute("data-query-ready");
        dd.querySelectorAll("[data-place-idx]").forEach((n) => n.remove());
      }
      clearTimeout(state.searchTimers[role]);
      state.searchTimers[role] = setTimeout(() => {
        queryPlacesDropdown(role, inp.value.trim());
      }, 100);
    });

    inp.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllPlaceDropdowns();
      }
    });

    if (clr) {
      clr.addEventListener("click", () => {
        inp.value = "";
        inp.focus();
        queryPlacesDropdown(role, "");
      });
    }
  }

  // ---------------------------------------------------------------------------
  // GPS Location, Compass Orientation & Vehicle Navigation Engine
  // ---------------------------------------------------------------------------
  function buildVehicleIcon(headingDeg) {
    const safeHeading = Number.isFinite(headingDeg) ? headingDeg : 0;
    let innerSvg = "";
    let innerRotateDeg = 0;
    if (state.travelMode === "walk") {
      innerRotateDeg = 0;
      innerSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="13" cy="4" r="2" fill="#34d399"/>
        <path d="M10 21l2-7 3 2v5"/><path d="M9 11l3-3 4 2 2-2"/><path d="M7 21l3-6"/>
      </svg>`;
    } else if (state.travelMode === "bike") {
      innerRotateDeg = 0;
      innerSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="5.5" cy="17.5" r="3"/><circle cx="18.5" cy="17.5" r="3"/>
        <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>
      </svg>`;
    } else {
      innerRotateDeg = safeHeading;
      innerSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L19.5 20.5L12 16.5L4.5 20.5L12 2Z" fill="#34d399" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>`;
    }

    return L.divIcon({
      className: "",
      html: `<div class="gps-vehicle-wrap" title="Your GPS position & live compass arrow">
        <div class="gps-vehicle-halo"></div>
        <div class="gps-heading-collar" style="transform: rotate(${safeHeading}deg);">
          <div class="gps-heading-arrow"></div>
        </div>
        <div class="gps-vehicle-core" style="transform: rotate(${innerRotateDeg}deg);">
          ${innerSvg}
        </div>
      </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }

  function applyLiveHeadingRotation(headingDeg) {
    if (!Number.isFinite(headingDeg)) return;
    const norm = ((headingDeg % 360) + 360) % 360;
    state.currentHeading = norm;

    if (vehicleMarker) {
      const el = vehicleMarker.getElement();
      if (el) {
        const collar = el.querySelector(".gps-heading-collar");
        if (collar) collar.style.transform = `rotate(${norm}deg)`;
        if (state.travelMode === "car") {
          const core = el.querySelector(".gps-vehicle-core");
          if (core) core.style.transform = `rotate(${norm}deg)`;
        }
      }
    }

    const roadHud = document.getElementById("nav-hud-road");
    if (roadHud && !state.arrivedNotified) {
      const comp = `${bearingToCompass(norm)} (${Math.round(norm)}°)`;
      if (!state.hasUserMoved) {
        roadHud.textContent = state.navRunning
          ? `Compass ${comp} · Waiting for movement`
          : `Stationary · Facing ${comp}`;
      }
    }
  }

  function handleDeviceOrientationEvent(ev) {
    let heading = null;
    if (typeof ev.webkitCompassHeading === "number" && Number.isFinite(ev.webkitCompassHeading)) {
      heading = ev.webkitCompassHeading;
    } else if (typeof ev.alpha === "number" && Number.isFinite(ev.alpha)) {
      const screenAngle =
        window.screen && window.screen.orientation && typeof window.screen.orientation.angle === "number"
          ? window.screen.orientation.angle
          : typeof window.orientation === "number"
          ? window.orientation
          : 0;
      heading = (360 - ev.alpha + screenAngle + 360) % 360;
    }

    if (heading === null) return;
    state.hasCompassReading = true;
    applyLiveHeadingRotation(heading);
  }

  function setupCompassOrientation(fromUserGesture) {
    if (typeof window === "undefined") return;
    if (
      fromUserGesture &&
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission()
        .then((perm) => {
          if (perm === "granted" && !state.compassListening) {
            window.addEventListener("deviceorientationabsolute", handleDeviceOrientationEvent, true);
            window.addEventListener("deviceorientation", handleDeviceOrientationEvent, true);
            state.compassListening = true;
          }
        })
        .catch(() => {});
      return;
    }

    if (!state.compassListening) {
      if ("ondeviceorientationabsolute" in window) {
        window.addEventListener("deviceorientationabsolute", handleDeviceOrientationEvent, true);
      }
      window.addEventListener("deviceorientation", handleDeviceOrientationEvent, true);
      state.compassListening = true;
    }
  }

  function updateGpsStatusPill(text, isLive) {
    const pillText = document.getElementById("gps-status-text");
    const pillDot = document.getElementById("gps-status-dot");
    if (pillText) pillText.textContent = text;
    if (pillDot) {
      pillDot.className = "h-2 w-2 rounded-full shrink-0 " + (isLive ? "bg-emerald-500 animate-pulse" : "bg-sky-500");
    }
  }

  async function fetchRoadApproach(fromLat, fromLng, toLat, toLng) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes[0]) {
        return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      }
    } catch (_) {}
    return null;
  }

  async function enhanceUniversalRoutesOnRoads(resData, seqToken) {
    const strategies = resData?.analysis?.strategies;
    if (!strategies) return;
    const isUniversal = Boolean(resData?.analysis?.adaptive_meta?.universal_routing);
    if (!isUniversal) return;

    const first = strategies.adaptive;
    if (!first || first.total_dist > 320) return;

    let updatedAny = false;
    await Promise.all(
      ROUTE_ORDER.map(async (key, idx) => {
        const route = strategies[key];
        if (!route || !route.segments || route.segments.length === 0) return;
        const sPt = route.segments[0].coords[0];
        const ePt = route.segments[route.segments.length - 1].coords.slice(-1)[0];
        if (!sPt || !ePt) return;
        // Request OSRM via mid waypoint on non-shortest routes for visual path diversity along real roads
        const midSeg = route.segments[1];
        const viaPt = idx > 0 && midSeg && midSeg.coords[0] ? `;${midSeg.coords[0][1]},${midSeg.coords[0][0]}` : "";
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${sPt[1]},${sPt[0]}${viaPt};${ePt[1]},${ePt[0]}?overview=full&geometries=geojson`;
          const resp = await fetch(url);
          if (!resp.ok) return;
          const json = await resp.json();
          if (json.code === "Ok" && json.routes && json.routes[0]) {
            const fullPts = json.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            if (fullPts.length >= 4) {
              const n = route.segments.length;
              const chunkSize = Math.max(2, Math.ceil(fullPts.length / n));
              route.segments.forEach((seg, sIdx) => {
                const startI = Math.max(0, sIdx * chunkSize - (sIdx > 0 ? 1 : 0));
                const endI = sIdx === n - 1 ? fullPts.length : Math.min(fullPts.length, (sIdx + 1) * chunkSize);
                const slice = fullPts.slice(startI, endI);
                if (slice.length >= 2) {
                  seg.coords = slice;
                }
              });
              updatedAny = true;
            }
          }
        } catch (_) {}
      })
    );

    if (updatedAny && state.analysisSeq === seqToken && !state.emergencyActive) {
      renderMapRoutes();
    }
  }

  function startLiveMovementWatch(silentErrors) {
    if (!navigator.geolocation) return;
    if (state.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(state.gpsWatchId);
      state.gpsWatchId = null;
    }
    state.awaitingInitialWatchFix = !state.hasUserMoved;
    state.gpsWatchId = navigator.geolocation.watchPosition(
      (wPos) => {
        if (state.awaitingInitialWatchFix) {
          state.awaitingInitialWatchFix = false;
          state.lastMovedPos = { lat: wPos.coords.latitude, lng: wPos.coords.longitude };
          state.currentVehiclePos = { lat: wPos.coords.latitude, lng: wPos.coords.longitude };
          updateVehicleAndHudAtPosition(wPos.coords.latitude, wPos.coords.longitude, state.currentHeading);
          return;
        }
        handleUserMovement(
          wPos.coords.latitude,
          wPos.coords.longitude,
          wPos.coords.heading,
          wPos.coords.speed
        );
      },
      () => {
        if (!silentErrors) {
          updateGpsStatusPill("Live GPS watch unavailable — move or drag marker manually", false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }

  function getSavedGpsFromStorage() {
    try {
      const raw = localStorage.getItem("safepath_saved_gps");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.lat === "number" &&
        typeof parsed.lng === "number" &&
        Number.isFinite(parsed.lat) &&
        Number.isFinite(parsed.lng)
      ) {
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  function saveGpsToStorage(place) {
    if (!place || !Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lng))) return;
    try {
      localStorage.setItem(
        "safepath_saved_gps",
        JSON.stringify({
          lat: Number(place.lat),
          lng: Number(place.lng),
          name: place.name || "Saved Location",
          area: place.area || "",
          city: place.city || "",
        })
      );
    } catch (_) {}
  }

  async function setUserGpsPosition(lat, lng, label, isLive, roleTarget) {
    let resolvedPlace = {
      id: "current_location",
      name: label || `Current Location (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`,
      area: "Current GPS",
      city: "India",
      category: "hub",
      lat: Number(lat),
      lng: Number(lng),
    };

    try {
      const rev = await apiJson(`/api/places/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
      if (rev && rev.name) {
        resolvedPlace = rev;
      }
    } catch (_) {}

    saveGpsToStorage(resolvedPlace);

    state.userGps = {
      lat: resolvedPlace.lat,
      lng: resolvedPlace.lng,
      label: resolvedPlace.name,
      isLive: Boolean(isLive),
      approachCoords: null,
    };
    resetNavMovementState();

    const targetRole = roleTarget === "dest" ? "dest" : "source";
    if (targetRole === "dest") {
      state.destPlace = resolvedPlace;
      state.dest = resolvedPlace.id;
      const dInp = document.getElementById("dest-search-input");
      if (dInp) dInp.value = placeDisplayLabel(resolvedPlace);
    } else {
      state.sourcePlace = resolvedPlace;
      state.source = resolvedPlace.id;
      const sInp = document.getElementById("source-search-input");
      if (sInp) sInp.value = placeDisplayLabel(resolvedPlace);
    }

    updateGpsStatusPill(
      isLive ? `Live GPS: ${resolvedPlace.name}` : `Current Location: ${resolvedPlace.name}`,
      true
    );
    showToast(`Current Location set to ${resolvedPlace.name}.`);
    state.disruptions = {};
    renderRobustnessPanel(null);

    if (state.emergencyActive) {
      await activateEmergencySos(false);
    } else {
      await runAnalysis();
    }
  }

  let curLocModalSeq = 0;

  function renderCurLocQuickCards() {
    const box = document.getElementById("cur-loc-quick-cards");
    if (!box) return;

    const cards = [];
    const saved = getSavedGpsFromStorage();
    if (saved) {
      const sub = [saved.area, saved.city].filter(Boolean).join(" · ") || `${saved.lat.toFixed(4)}, ${saved.lng.toFixed(4)}`;
      cards.push(`
        <button type="button" data-quick-loc="saved" class="w-full text-left rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 px-3.5 py-2.5 transition flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Saved Current Location</div>
            <div class="text-xs font-extrabold text-navy-900 truncate">${escapeHtml(saved.name)}</div>
            <div class="text-[11px] text-slate-600 truncate">${escapeHtml(sub)}</div>
          </div>
          <span class="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold shrink-0">Use Saved</span>
        </button>
      `);
    }

    if (state.detectedIpLoc && state.detectedIpLoc.detected) {
      const d = state.detectedIpLoc;
      const pName = d.place?.name || d.city || "Detected Area";
      const sub = [d.city, d.region, d.country].filter(Boolean).join(" · ");
      cards.push(`
        <button type="button" data-quick-loc="ip" class="w-full text-left rounded-xl border border-sky-200 bg-sky-50/80 hover:bg-sky-100 px-3.5 py-2.5 transition flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">Detected Network Area</div>
            <div class="text-xs font-extrabold text-navy-900 truncate">${escapeHtml(pName)}</div>
            <div class="text-[11px] text-slate-600 truncate">${escapeHtml(sub)}</div>
          </div>
          <span class="px-2 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-bold shrink-0">Use Area</span>
        </button>
      `);
    }

    if (cards.length === 0) {
      box.innerHTML = "";
      box.classList.add("hidden");
      return;
    }

    box.innerHTML = cards.join("");
    box.classList.remove("hidden");

    box.querySelector('[data-quick-loc="saved"]')?.addEventListener("click", () => {
      if (!saved) return;
      const targetRole = state.gpsRoleTarget || "source";
      closeCurrentLocationPicker();
      setUserGpsPosition(saved.lat, saved.lng, saved.name, false, targetRole);
    });

    box.querySelector('[data-quick-loc="ip"]')?.addEventListener("click", () => {
      const d = state.detectedIpLoc;
      if (!d || !d.detected) return;
      const targetRole = state.gpsRoleTarget || "source";
      closeCurrentLocationPicker();
      setUserGpsPosition(d.lat, d.lng, d.place?.name || d.city || "Detected Area", false, targetRole);
    });
  }

  async function queryCurrentLocationModalList(queryText) {
    const box = document.getElementById("cur-loc-results");
    if (!box) return;
    const seq = ++curLocModalSeq;
    const refLat = state.userGps ? state.userGps.lat : state.sourcePlace?.lat ?? 12.9716;
    const refLng = state.userGps ? state.userGps.lng : state.sourcePlace?.lng ?? 77.5946;

    let places = [];
    try {
      const qs = new URLSearchParams({
        q: queryText || "",
        lat: String(refLat),
        lng: String(refLng),
        limit: "16",
      });
      const data = await apiJson("/api/places/search?" + qs.toString());
      if (seq !== curLocModalSeq) return;
      places = data.places || [];
    } catch (_) {
      if (seq !== curLocModalSeq) return;
      places = (state.allPlaces || []).slice(0, 16);
    }

    if (!places.length) {
      box.innerHTML = `<div class="px-4 py-4 text-xs text-slate-500">No places matched “${escapeHtml(queryText)}”. Try another neighborhood, shop, landmark, or city — or click “Pin Exact Spot on Map”.</div>`;
      return;
    }

    box.innerHTML = places
      .map((p, idx) => {
        const badge = CATEGORY_BADGES[p.category] || CATEGORY_BADGES.hub;
        const sub = [p.area, p.city].filter(Boolean).join(" · ");
        return `
          <button type="button" data-cur-place-idx="${idx}" class="w-full text-left px-3.5 py-2.5 hover:bg-sky-50 transition flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold text-navy-900 truncate">${escapeHtml(p.name)}</div>
              <div class="text-[11px] text-slate-500 truncate">${escapeHtml(sub)}</div>
            </div>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.cls}">${badge.label}</span>
          </button>
        `;
      })
      .join("");

    box.querySelectorAll("[data-cur-place-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-cur-place-idx"));
        const chosen = places[i];
        if (!chosen) return;
        const targetRole = state.gpsRoleTarget || "source";
        closeCurrentLocationPicker();
        setUserGpsPosition(chosen.lat, chosen.lng, chosen.name, false, targetRole);
      });
    });
  }

  function closeCurrentLocationPicker() {
    document.getElementById("current-location-modal")?.classList.add("hidden");
  }

  function openCurrentLocationPicker(roleTarget, noticeText) {
    state.gpsRoleTarget = roleTarget === "dest" ? "dest" : "source";
    const modal = document.getElementById("current-location-modal");
    if (!modal) return;

    const noteEl = document.getElementById("cur-loc-status-note");
    if (noteEl && noticeText) {
      noteEl.textContent = noticeText;
    }

    const inp = document.getElementById("cur-loc-search-input");
    if (inp) inp.value = "";

    renderCurLocQuickCards();
    queryCurrentLocationModalList("");
    modal.classList.remove("hidden");

    if (!state.detectedIpLoc) {
      apiJson("/api/places/geolocate")
        .then((geo) => {
          state.detectedIpLoc = geo || { detected: false };
          renderCurLocQuickCards();
        })
        .catch(() => {
          state.detectedIpLoc = { detected: false };
        });
    }

    setTimeout(() => {
      inp?.focus();
    }, 50);
  }

  function requestRealGps(roleTarget, options) {
    const targetRole = roleTarget === "dest" ? "dest" : "source";
    state.gpsRoleTarget = targetRole;
    setupCompassOrientation(true);

    if (!navigator.geolocation) {
      openCurrentLocationPicker(
        targetRole,
        "Browser geolocation is not supported in this browser. Choose your current location below, search any place, or pin your exact spot on the map."
      );
      return;
    }

    updateGpsStatusPill("Acquiring live GPS fix...", true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        closeCurrentLocationPicker();
        setUserGpsPosition(pos.coords.latitude, pos.coords.longitude, "My Current Location", true, targetRole);
        startLiveMovementWatch(true);
      },
      () => {
        if (state.navRunning || state.hasUserMoved || state.gpsWatchId !== null) return;
        updateGpsStatusPill(
          state.userGps ? `Current Location: ${state.userGps.label}` : "GPS Vehicle anchored at Start Location",
          Boolean(state.userGps)
        );
        if (options && options.fromModalRetry) {
          const noteEl = document.getElementById("cur-loc-status-note");
          if (noteEl) {
            noteEl.textContent =
              "Live browser GPS is still blocked by browser or preview permissions. Select your location from the list below or tap “Pin Exact Spot on Map”.";
          }
        } else {
          openCurrentLocationPicker(
            targetRole,
            "Browser GPS permission is unavailable in this window. Choose your current location below, search any neighborhood/shop, or tap “Pin Exact Spot on Map”."
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 4500 }
    );
  }

  function togglePickGpsMode(forceState) {
    state.pickingGps = typeof forceState === "boolean" ? forceState : !state.pickingGps;
    const btn = document.getElementById("pick-gps-btn");
    const mapEl = document.getElementById("safepath-map");
    if (btn) {
      btn.className = state.pickingGps
        ? "px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white border border-emerald-700 text-xs font-semibold shadow-sm transition"
        : "px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition";
      btn.textContent = state.pickingGps ? "Click Map Now..." : "Pin GPS on Map";
    }
    if (mapEl) {
      mapEl.classList.toggle("is-picking-gps", state.pickingGps);
    }
    if (state.pickingGps) {
      showToast(
        state.navRunning
          ? "Click anywhere on the map to move your GPS vehicle."
          : "Click anywhere on the map to pin your starting GPS location."
      );
    }
  }

  function buildNavWaypoints(route) {
    const pts = [];
    if (!route || !route.segments) return pts;

    route.segments.forEach((seg) => {
      seg.coords.forEach((pt, idx) => {
        if (pts.length > 0 && idx === 0) {
          const prev = pts[pts.length - 1];
          if (Math.abs(prev.lat - pt[0]) < 1e-6 && Math.abs(prev.lng - pt[1]) < 1e-6) return;
        }
        pts.push({
          lat: pt[0],
          lng: pt[1],
          road: seg.road,
          safety: seg.safety_score,
        });
      });
    });
    return pts;
  }

  function projectPositionAlongRoute(lat, lng, pts) {
    if (!pts || pts.length === 0) {
      return { progress: 0, remainingDistKm: 0, road: "City Network", safety: 70, segBearing: 0 };
    }
    if (pts.length === 1) {
      return { progress: 0, remainingDistKm: 0, road: pts[0].road, safety: pts[0].safety, segBearing: 0 };
    }

    const cumDist = [0];
    let totalLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = haversineKm(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
      totalLen += len;
      cumDist.push(totalLen);
    }

    let bestDistFromPath = Infinity;
    let bestPassedKm = 0;
    let bestRoad = pts[0].road;
    let bestSafety = pts[0].safety;
    let bestBearing = computeBearingDeg(pts[0].lat, pts[0].lng, pts[1].lat, pts[1].lng);

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dLat = b.lat - a.lat;
      const dLng = b.lng - a.lng;
      const lenSq = dLat * dLat + dLng * dLng;
      const frac = lenSq > 0 ? Math.max(0, Math.min(1, ((lat - a.lat) * dLat + (lng - a.lng) * dLng) / lenSq)) : 0;
      const projLat = a.lat + dLat * frac;
      const projLng = a.lng + dLng * frac;
      const offKm = haversineKm(lat, lng, projLat, projLng);
      if (offKm < bestDistFromPath) {
        bestDistFromPath = offKm;
        const segLenKm = cumDist[i + 1] - cumDist[i];
        bestPassedKm = cumDist[i] + segLenKm * frac;
        bestRoad = b.road;
        bestSafety = b.safety;
        bestBearing = computeBearingDeg(a.lat, a.lng, b.lat, b.lng);
      }
    }

    return {
      progress: totalLen > 0 ? Math.max(0, Math.min(1, bestPassedKm / totalLen)) : 0,
      remainingDistKm: Math.max(0, totalLen - bestPassedKm),
      road: bestRoad,
      safety: bestSafety,
      segBearing: bestBearing,
    };
  }

  function getActiveFocusedRoute() {
    if (state.emergencyActive && state.emergencyData && state.emergencyData.emergency_route) {
      return state.emergencyData.emergency_route;
    }
    if (!state.latestResponse) return null;
    const strategies = state.latestResponse.analysis.strategies;
    return strategies[state.selectedStrategy] || strategies.adaptive;
  }

  function resetNavMovementState() {
    state.lastMovedPos = null;
    state.currentVehiclePos = null;
    state.totalMovedKm = 0;
    state.hasUserMoved = false;
    state.arrivedNotified = false;
  }

  function updateVehicleAndHudAtPosition(lat, lng, headingDeg) {
    if (!gpsLayerGroup || !state.latestResponse) return;
    const route = getActiveFocusedRoute();
    if (!route) return;
    const meta = STRATEGY_META[state.selectedStrategy] || STRATEGY_META.adaptive;

    if (!state.navWaypoints || state.navWaypoints.length === 0) {
      state.navWaypoints = buildNavWaypoints(route);
    }
    const proj = projectPositionAlongRoute(lat, lng, state.navWaypoints);
    const activeHeading = state.hasCompassReading
      ? state.currentHeading
      : Number.isFinite(headingDeg)
      ? headingDeg
      : proj.segBearing;

    if (!vehicleMarker) {
      vehicleMarker = L.marker([lat, lng], {
        icon: buildVehicleIcon(activeHeading),
        zIndexOffset: 1000,
        draggable: true,
      }).addTo(gpsLayerGroup);

      vehicleMarker.on("dragend", (ev) => {
        const pos = ev.target.getLatLng();
        if (!state.navRunning) {
          state.navRunning = true;
          const btn = document.getElementById("gps-drive-btn");
          if (btn) btn.textContent = "Stop GPS";
        }
        handleUserMovement(pos.lat, pos.lng, null, null);
      });
    } else {
      vehicleMarker.setLatLng([lat, lng]);
      vehicleMarker.setIcon(buildVehicleIcon(activeHeading));
      if (!gpsLayerGroup.hasLayer(vehicleMarker)) vehicleMarker.addTo(gpsLayerGroup);
    }

    const destPt = state.navWaypoints[state.navWaypoints.length - 1];
    const directDistToDestKm = destPt ? haversineKm(lat, lng, destPt.lat, destPt.lng) : proj.remainingDistKm;
    const hasArrived = state.hasUserMoved && directDistToDestKm <= 0.05;

    const avgSpeedKmPerMin = route.total_time > 0 ? route.total_dist / route.total_time : 0.4;
    const remDistKm = hasArrived
      ? 0
      : state.hasUserMoved
      ? proj.remainingDistKm
      : route.total_dist;
    const remTimeMin = hasArrived
      ? 0
      : state.hasUserMoved
      ? Math.max(0, Math.round(remDistKm / Math.max(0.05, avgSpeedKmPerMin)))
      : Math.round(route.total_time);

    const modeLabel = state.travelMode.toUpperCase();
    const hudTag = document.getElementById("nav-hud-route-tag");
    if (hudTag) {
      hudTag.textContent = state.emergencyActive
        ? `EMERGENCY SOS (${modeLabel}) · POLICE ROUTE`
        : (state.navRunning ? `GPS TRACKING (${modeLabel}) · ` : `GPS READY (${modeLabel}) · `) +
          `${meta.shortTag} (${meta.name.split(" /")[0]})`;
    }

    let roadText = "";
    const compText = `${bearingToCompass(activeHeading)} (${Math.round(activeHeading)}°)`;
    if (hasArrived) {
      roadText = state.emergencyActive ? "Arrived at Police Station!" : "Arrived at Destination!";
    } else if (!state.hasUserMoved) {
      roadText = state.navRunning
        ? `Compass ${compText} · Waiting for movement`
        : `Stationary · Facing ${compText}`;
    } else {
      roadText = `${proj.road} · Heading ${compText}`;
    }
    const hudRoad = document.getElementById("nav-hud-road");
    if (hudRoad) hudRoad.textContent = roadText;

    const hudSafe = document.getElementById("nav-hud-safety");
    if (hudSafe) {
      hudSafe.textContent = `${proj.safety}/100`;
      hudSafe.className =
        "text-[11px] font-extrabold px-2 py-0.5 rounded border shrink-0 " +
        (proj.safety >= 70
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
          : proj.safety >= 40
          ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
          : "bg-rose-500/20 text-rose-300 border-rose-400/30");
    }

    const hudMetrics = document.getElementById("nav-hud-metrics");
    if (hudMetrics) {
      hudMetrics.textContent = `${remDistKm.toFixed(1)} km left · ${remTimeMin} min ETA · ${state.totalMovedKm.toFixed(2)} km moved`;
    }

    if (hasArrived && !state.arrivedNotified) {
      state.arrivedNotified = true;
      showToast(state.emergencyActive ? "Arrived at nearest Police Station!" : "Arrived at Destination!");
    }
  }

  function renderCurrentVehicleMarker() {
    if (!gpsLayerGroup || !state.latestResponse) return;
    const route = getActiveFocusedRoute();
    if (!route) return;

    state.navWaypoints = buildNavWaypoints(route);
    if (state.navWaypoints.length === 0) return;

    if (state.hasUserMoved && state.currentVehiclePos) {
      updateVehicleAndHudAtPosition(
        state.currentVehiclePos.lat,
        state.currentVehiclePos.lng,
        state.currentHeading
      );
      return;
    }

    const startPt = state.navWaypoints[0];
    const nextPt = state.navWaypoints[1] || startPt;
    const anchorLat = state.userGps ? state.userGps.lat : startPt.lat;
    const anchorLng = state.userGps ? state.userGps.lng : startPt.lng;
    const initBearing = state.hasCompassReading
      ? state.currentHeading
      : computeBearingDeg(anchorLat, anchorLng, nextPt.lat, nextPt.lng);
    state.lastMovedPos = { lat: anchorLat, lng: anchorLng };
    state.currentVehiclePos = { lat: anchorLat, lng: anchorLng };
    state.currentHeading = initBearing;

    updateVehicleAndHudAtPosition(anchorLat, anchorLng, initBearing);
  }

  function handleUserMovement(newLat, newLng, deviceHeading, deviceSpeed) {
    const anchor = state.lastMovedPos || state.currentVehiclePos;
    if (!anchor) {
      state.lastMovedPos = { lat: newLat, lng: newLng };
      state.currentVehiclePos = { lat: newLat, lng: newLng };
      updateVehicleAndHudAtPosition(newLat, newLng, state.currentHeading);
      return;
    }

    const stepKm = haversineKm(anchor.lat, anchor.lng, newLat, newLng);
    // Filter out < 3m GPS jitter so arrow NEVER moves before the user actually moves
    if (stepKm < 0.003) {
      return;
    }

    const calcBearing = computeBearingDeg(anchor.lat, anchor.lng, newLat, newLng);
    const hasDeviceHeading =
      typeof deviceHeading === "number" &&
      Number.isFinite(deviceHeading) &&
      deviceHeading >= 0 &&
      (typeof deviceSpeed !== "number" || deviceSpeed === null || deviceSpeed > 0.4);
    const nextHeading = state.hasCompassReading
      ? state.currentHeading
      : hasDeviceHeading
      ? deviceHeading
      : calcBearing;

    state.lastMovedPos = { lat: newLat, lng: newLng };
    state.currentVehiclePos = { lat: newLat, lng: newLng };
    state.currentHeading = nextHeading;
    state.totalMovedKm += stepKm;
    state.hasUserMoved = true;
    state.userGps = {
      ...(state.userGps || {}),
      lat: newLat,
      lng: newLng,
      label: "Live GPS Moving",
      isLive: true,
    };

    updateGpsStatusPill(
      `Moving ${bearingToCompass(nextHeading)} (${Math.round(nextHeading)}°) · ${state.totalMovedKm.toFixed(2)} km moved`,
      true
    );
    updateVehicleAndHudAtPosition(newLat, newLng, nextHeading);

    if (state.emergencyActive && state.emergencyData?.incident_code) {
      const nowMs = Date.now();
      if (!state._lastSosGpsSyncMs || nowMs - state._lastSosGpsSyncMs >= 3000) {
        state._lastSosGpsSyncMs = nowMs;
        apiJson("/api/sos/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident_code: state.emergencyData.incident_code,
            status: "ACTIVE_DISPATCH",
            live_lat: newLat,
            live_lng: newLng,
          }),
        }).catch(() => {});
      }
    }
  }

  function stopNavigation() {
    state.navRunning = false;
    const btn = document.getElementById("gps-drive-btn");
    if (btn) btn.textContent = "Start GPS";
    if (state.currentVehiclePos) {
      updateVehicleAndHudAtPosition(
        state.currentVehiclePos.lat,
        state.currentVehiclePos.lng,
        state.currentHeading
      );
    }
  }

  function toggleNavigation() {
    setupCompassOrientation(true);
    if (state.navRunning) {
      stopNavigation();
      updateGpsStatusPill(
        state.hasUserMoved
          ? `GPS Paused · ${state.totalMovedKm.toFixed(2)} km moved`
          : "GPS Vehicle anchored at Start Location",
        false
      );
      return;
    }
    state.navRunning = true;
    const btn = document.getElementById("gps-drive-btn");
    if (btn) btn.textContent = "Stop GPS";

    startLiveMovementWatch(true);
    renderCurrentVehicleMarker();
    if (vehicleMarker && map) {
      map.panTo(vehicleMarker.getLatLng(), { animate: true });
    }
    updateGpsStatusPill(
      state.hasUserMoved
        ? `GPS Tracking · ${state.totalMovedKm.toFixed(2)} km moved`
        : "GPS Tracking Active — Stationary until you move",
      true
    );
    showToast("GPS & Compass armed — arrow turns with your device and moves only when you move.");
  }

  // ---------------------------------------------------------------------------
  // Route Picker Bar & Map Route Polylines
  // ---------------------------------------------------------------------------
  function renderRoutePickerBar() {
    const bar = document.getElementById("route-picker-bar");
    if (!bar || !state.latestResponse) return;
    const strategies = state.latestResponse.analysis.strategies;

    bar.innerHTML = ROUTE_ORDER.map((key) => {
      const r = strategies[key];
      const m = STRATEGY_META[key];
      const active = state.selectedStrategy === key;
      return `<button type="button" data-pick-route="${key}" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-2 ${
        active
          ? "bg-navy-900 text-white border-navy-900 shadow-sm"
          : "bg-white text-slate-700 border-slate-300 hover:border-navy-700 hover:bg-slate-50"
      }">
        <span class="h-2.5 w-2.5 rounded-full shrink-0" style="background:${m.color}"></span>
        <span><strong>${m.shortTag}:</strong> ${m.name.split(" /")[0].replace(" Route", "")}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded ${active ? "bg-white/15 text-emerald-300" : "bg-slate-100 text-slate-600"}">${r.total_time}m · ${r.safety_score}</span>
      </button>`;
    }).join("");

    bar.querySelectorAll("[data-pick-route]").forEach((btn) => {
      btn.addEventListener("click", () => selectStrategy(btn.getAttribute("data-pick-route")));
    });
  }

  function renderMapRoutes() {
    if (!map || !routeLayerGroup || !nodeLayerGroup || !gpsLayerGroup || !state.latestResponse) return;
    routeLayerGroup.clearLayers();
    nodeLayerGroup.clearLayers();
    gpsLayerGroup.clearLayers();
    vehicleMarker = null;

    const strategies = state.latestResponse.analysis.strategies;
    const isEmergency = state.emergencyActive && state.emergencyData && state.emergencyData.emergency_route;
    const focused = isEmergency
      ? state.emergencyData.emergency_route
      : strategies[state.selectedStrategy] || strategies.adaptive;
    const allBounds = [];

    if (state.mapMode === "strategies") {
      const drawOrder = ROUTE_ORDER.filter((k) => k !== state.selectedStrategy);
      if (!isEmergency) drawOrder.push(state.selectedStrategy);

      drawOrder.forEach((key) => {
        const route = strategies[key];
        const meta = STRATEGY_META[key];
        const isFocused = !isEmergency && key === state.selectedStrategy;
        const coords = [];
        route.segments.forEach((seg, idx) => {
          seg.coords.forEach((pt, pIdx) => {
            if (idx === 0 || pIdx > 0) coords.push(pt);
          });
        });
        if (!isEmergency) coords.forEach((pt) => allBounds.push(pt));

        const offsetLat = key === "shortest" ? 0.000045 : key === "fixed" ? -0.000045 : key === "safety" ? 0.000025 : 0;
        const offsetLng = key === "shortest" ? -0.000045 : key === "fixed" ? 0.000045 : key === "safety" ? -0.000025 : 0;
        const shiftedCoords = isFocused
          ? coords
          : coords.map((pt) => [pt[0] + offsetLat, pt[1] + offsetLng]);

        if (isFocused) {
          L.polyline(shiftedCoords, {
            color: "#071426",
            weight: meta.weight + 4,
            opacity: 0.85,
          }).addTo(routeLayerGroup);
        }

        const poly = L.polyline(shiftedCoords, {
          color: meta.color,
          weight: isFocused ? meta.weight : 3.5,
          opacity: isEmergency ? 0.22 : isFocused ? 0.98 : 0.55,
          dashArray: isFocused ? null : meta.dashArray,
        });

        poly.bindPopup(
          `<div class="text-xs space-y-1">
            <div class="font-bold text-slate-900">${meta.shortTag}: ${meta.name}</div>
            <div>Safety: <strong>${route.safety_score}/100</strong> | Time: <strong>${route.total_time} min</strong></div>
            <div>Distance: ${route.total_dist} km | High-Risk Segs: ${route.high_risk_count}</div>
          </div>`
        );
        if (!isEmergency) {
          poly.on("click", () => selectStrategy(key));
        }
        poly.addTo(routeLayerGroup);

        if (!isEmergency && shiftedCoords.length >= 2) {
          const midIdx = Math.floor(shiftedCoords.length / 2);
          const midPt = shiftedCoords[midIdx];
          const pillIcon = L.divIcon({
            className: "",
            html: `<div class="route-callout-pill" style="background:${isFocused ? meta.color : "#ffffff"};color:${isFocused ? "#ffffff" : "#0f172a"};border-color:${isFocused ? "#ffffff" : meta.color}">R${meta.routeNum} · ${route.total_time}m</div>`,
            iconSize: [72, 22],
            iconAnchor: [36, 11],
          });
          L.marker(midPt, { icon: pillIcon, zIndexOffset: isFocused ? 700 : 300 })
            .on("click", () => selectStrategy(key))
            .addTo(routeLayerGroup);
        }
      });

      // Active Emergency SOS Police Route rendered prominently in bright red/orange
      if (isEmergency) {
        const emCoords = [];
        focused.segments.forEach((seg, idx) => {
          seg.coords.forEach((pt, pIdx) => {
            if (idx === 0 || pIdx > 0) emCoords.push(pt);
          });
        });
        emCoords.forEach((pt) => allBounds.push(pt));

        L.polyline(emCoords, { color: "#991b1b", weight: 12, opacity: 0.85 }).addTo(routeLayerGroup);
        const emPoly = L.polyline(emCoords, { color: "#f97316", weight: 7, opacity: 1.0 });
        emPoly.bindPopup(
          `<div class="text-xs space-y-1">
            <div class="font-extrabold text-red-700">ACTIVE EMERGENCY POLICE ROUTE</div>
            <div>To: <strong>${escapeHtml(state.emergencyData.nearest_police.name)}</strong></div>
            <div>Safety: <strong>${focused.safety_score}/100</strong> | Time: <strong>${focused.total_time} min</strong> (${focused.total_dist} km)</div>
          </div>`
        );
        emPoly.addTo(routeLayerGroup);

        if (emCoords.length >= 2) {
          const midPt = emCoords[Math.floor(emCoords.length / 2)];
          const sosPill = L.divIcon({
            className: "",
            html: `<div class="route-callout-pill" style="background:#dc2626;color:#ffffff;border-color:#fef08a">SOS · ${focused.total_time}m</div>`,
            iconSize: [86, 22],
            iconAnchor: [43, 11],
          });
          L.marker(midPt, { icon: sosPill, zIndexOffset: 900 }).addTo(routeLayerGroup);
        }
      }
    } else {
      focused.segments.forEach((seg) => {
        seg.coords.forEach((pt) => allBounds.push(pt));
        L.polyline(seg.coords, { color: isEmergency ? "#991b1b" : "#071426", weight: 10, opacity: 0.75 }).addTo(routeLayerGroup);
        const poly = L.polyline(seg.coords, {
          color: isEmergency ? "#f97316" : segmentRiskColor(seg.safety_score),
          weight: 6.5,
          opacity: 0.98,
        });
        poly.bindPopup(
          `<div class="text-xs space-y-1">
            <div class="font-bold">${escapeHtml(seg.road)}</div>
            <div>${escapeHtml(seg.from_name)} → ${escapeHtml(seg.to_name)}</div>
            <div>Segment Safety: <strong>${seg.safety_score}/100</strong> ${seg.is_high_risk ? '<span style="color:#e11d48;font-weight:700;">(HIGH RISK)</span>' : ""}</div>
            <div>Lighting: ${seg.eff.lighting} | Crowd: ${seg.eff.crowd} | CCTV: ${seg.eff.cctv}</div>
          </div>`
        );
        poly.addTo(routeLayerGroup);
      });
    }

    // Add Start & Destination pins using segment endpoints so universal/India places always pin cleanly
    if (focused.segments.length > 0) {
      const firstPt = focused.segments[0].coords[0];
      const lastSeg = focused.segments[focused.segments.length - 1];
      const lastPt = lastSeg.coords[lastSeg.coords.length - 1];
      const startName = focused.node_names?.[0] || state.sourcePlace?.name || "Start";
      const destName = focused.node_names?.[focused.node_names.length - 1] || state.destPlace?.name || "Destination";

      if (firstPt) {
        L.circleMarker(firstPt, {
          radius: 6,
          color: "#ffffff",
          weight: 2,
          fillColor: isEmergency ? "#dc2626" : "#0284c7",
          fillOpacity: 1,
        })
          .bindTooltip(`START: ${startName.split(" (")[0]}`, {
            permanent: true,
            direction: "bottom",
            offset: [0, 18],
            className: "node-pin-label",
          })
          .addTo(nodeLayerGroup);
      }

      if (lastPt && !isEmergency) {
        L.circleMarker(lastPt, {
          radius: 9,
          color: "#ffffff",
          weight: 2,
          fillColor: "#059669",
          fillOpacity: 1,
        })
          .bindTooltip(`DEST: ${destName.split(" (")[0]}`, {
            permanent: true,
            direction: "top",
            offset: [0, -10],
            className: "node-pin-label",
          })
          .addTo(nodeLayerGroup);
      }
    }

    // Pulsing Police Destination Beacon when Emergency SOS is active
    if (isEmergency && state.emergencyData.nearest_police) {
      const pol = state.emergencyData.nearest_police;
      allBounds.push([pol.lat, pol.lng]);
      const polIcon = L.divIcon({
        className: "",
        html: `<div class="sos-police-beacon"><div class="sos-police-ring"></div><div class="sos-police-core">P</div></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([pol.lat, pol.lng], { icon: polIcon, zIndexOffset: 950 })
        .bindTooltip(`POLICE SOS: ${pol.name}`, {
          permanent: true,
          direction: "top",
          offset: [0, -14],
          className: "node-pin-label",
        })
        .addTo(nodeLayerGroup);
    }

    renderCurrentVehicleMarker();

    if (allBounds.length > 0 && !state.navRunning) {
      map.fitBounds(allBounds, { padding: [44, 44], maxZoom: isEmergency ? 15 : 14 });
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy Cards & Quantitative Comparison Table
  // ---------------------------------------------------------------------------
  function selectStrategy(key) {
    stopNavigation();
    resetNavMovementState();
    state.selectedStrategy = key;
    renderRoutePickerBar();
    renderStrategyCardsAndTable();
    renderMapRoutes();
  }

  function renderStrategyCardsAndTable() {
    if (!state.latestResponse) return;
    const analysis = state.latestResponse.analysis;
    const strategies = analysis.strategies;
    const metaInfo = analysis.adaptive_meta;

    const adaptiveWeightPill = document.getElementById("adaptive-weight-pill");
    if (adaptiveWeightPill) {
      adaptiveWeightPill.textContent = `Adaptive: ${Math.round(metaInfo.adaptive_safety_w * 100)}% Safe / ${Math.round(metaInfo.adaptive_time_w * 100)}% Time`;
    }

    const adaptiveExpPill = document.getElementById("adaptive-explanation-pill");
    if (adaptiveExpPill) {
      adaptiveExpPill.textContent = metaInfo.explanation;
    }

    const cardsGrid = document.getElementById("strategy-cards-grid");
    if (!cardsGrid) return;

    cardsGrid.innerHTML = ROUTE_ORDER.map((key) => {
      const r = strategies[key];
      const m = STRATEGY_META[key];
      const isSelected = state.selectedStrategy === key;
      const safetyTextCls = r.safety_score >= 70 ? "text-emerald-700" : r.safety_score >= 45 ? "text-amber-700" : "text-rose-700";

      return `<button type="button" data-strategy="${key}" class="strategy-card text-left w-full bg-white rounded-2xl border ${
        isSelected ? "is-selected border-navy-900" : "border-slate-300"
      } p-4 shadow-sm flex flex-col justify-between gap-3 cursor-pointer">
        <div class="space-y-2.5 w-full">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white shrink-0" style="background:${m.color}">${m.shortTag}</span>
              <div>
                <div class="text-sm font-extrabold text-navy-950 leading-tight">${m.name}</div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-700">${m.badge}</div>
              </div>
            </div>
            <span class="text-xs font-extrabold px-2 py-0.5 rounded-md ${
              r.rank === 1 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-900"
            }">Rank #${r.rank}</span>
          </div>

          <div class="grid grid-cols-2 gap-2 bg-slate-100/90 rounded-xl p-2.5 border border-slate-200">
            <div>
              <div class="text-[10px] text-slate-800 uppercase font-bold">Safety Score</div>
              <div class="text-lg font-extrabold ${safetyTextCls}">${r.safety_score}<span class="text-xs font-semibold text-slate-700">/100</span></div>
            </div>
            <div>
              <div class="text-[10px] text-slate-800 uppercase font-bold">Travel Time</div>
              <div class="text-lg font-extrabold text-navy-950">${r.total_time} <span class="text-xs font-semibold text-slate-800">min</span></div>
            </div>
            <div>
              <div class="text-[10px] text-slate-800 uppercase font-bold">Route Length</div>
              <div class="text-xs font-extrabold text-slate-950">${r.total_dist} km</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-800 uppercase font-bold">High-Risk Segs</div>
              <div class="text-xs font-extrabold ${r.high_risk_count > 0 ? "text-rose-700" : "text-emerald-700"}">${r.high_risk_count} ${r.high_risk_count === 0 ? "(Safe)" : "(&lt;40)"}</div>
            </div>
          </div>

          <p class="text-[11px] font-medium text-slate-900 leading-relaxed">${escapeHtml(r.reason)}</p>
        </div>

        <div class="pt-2 border-t border-slate-200 w-full flex items-center justify-between text-[11px]">
          <span class="font-extrabold ${isSelected ? "text-emerald-700" : "text-navy-900"}">${isSelected ? "Selected on Map" : "Select " + m.shortTag}</span>
          ${r.is_pareto ? '<span class="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 font-bold border border-sky-300">Pareto-Optimal</span>' : ""}
        </div>
      </button>`;
    }).join("");

    cardsGrid.querySelectorAll("[data-strategy]").forEach((btn) => {
      btn.addEventListener("click", () => selectStrategy(btn.getAttribute("data-strategy")));
    });

    const tbody = document.getElementById("comparison-table-body");
    if (!tbody) return;
    const rankedKeys = [...ROUTE_ORDER].sort((a, b) => strategies[a].rank - strategies[b].rank);
    tbody.innerHTML = rankedKeys
      .map((key) => {
        const r = strategies[key];
        const m = STRATEGY_META[key];
        return `<tr class="${key === state.selectedStrategy ? "bg-emerald-50/70" : "hover:bg-slate-50"}">
          <td class="px-4 py-3 font-extrabold text-navy-950">#${r.rank}</td>
          <td class="px-4 py-3 font-bold text-navy-950">
            <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-white mr-1.5" style="background:${m.color}">${m.shortTag}</span>${m.name}
          </td>
          <td class="px-4 py-3 font-extrabold ${r.safety_score >= 70 ? "text-emerald-700" : r.safety_score >= 45 ? "text-amber-700" : "text-rose-700"}">${r.safety_score}/100</td>
          <td class="px-4 py-3 font-bold text-slate-950">${r.total_time} min</td>
          <td class="px-4 py-3 font-bold text-slate-950">${r.total_dist} km</td>
          <td class="px-4 py-3 font-extrabold ${r.high_risk_count > 0 ? "text-rose-700" : "text-emerald-700"}">${r.high_risk_count}</td>
          <td class="px-4 py-3 font-bold text-slate-950">${r.min_seg_safety}/100</td>
          <td class="px-4 py-3 text-xs font-medium text-slate-900 max-w-md">${escapeHtml(r.reason)}</td>
        </tr>`;
      })
      .join("");
  }

  // (Chart analytics section removed)

  // ---------------------------------------------------------------------------
  // Robustness Panel Rendering
  // ---------------------------------------------------------------------------
  function renderRobustnessPanel(robData) {
    const panel = document.getElementById("robustness-alert-panel");
    const logsEl = document.getElementById("disruption-logs");
    const tbody = document.getElementById("robustness-table-body");
    if (!panel || !logsEl || !tbody) return;

    if (!robData) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    logsEl.innerHTML = robData.logs
      .map((line) => `<div class="bg-white border border-amber-200 rounded-lg px-3 py-2 text-amber-950 font-medium">${escapeHtml(line)}</div>`)
      .join("");

    tbody.innerHTML = robData.comparison
      .map((row) => {
        const name = `${STRATEGY_META[row.strategy].shortTag}: ${STRATEGY_META[row.strategy].name}`;
        const deltaCls = row.delta < -2 ? "text-rose-700 font-bold" : row.delta > 0 ? "text-emerald-700 font-bold" : "text-slate-700";
        return `<tr class="${row.strategy === "adaptive" ? "bg-emerald-50/70 font-semibold" : ""}">
          <td class="px-3 py-2">${name}</td>
          <td class="px-3 py-2">${row.baseline_safety}/100</td>
          <td class="px-3 py-2 font-bold">${row.after_safety}/100</td>
          <td class="px-3 py-2 ${deltaCls}">${row.delta >= 0 ? "+" : ""}${row.delta}</td>
          <td class="px-3 py-2 ${row.high_risk_count > 0 ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}">${row.high_risk_count}</td>
          <td class="px-3 py-2">${row.after_time} min</td>
          <td class="px-3 py-2">${
            row.rerouted
              ? '<span class="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">Yes (Protected)</span>'
              : '<span class="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold">No</span>'
          }</td>
        </tr>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Citizen & Family Profile Modal + Police Dispatch DB Table
  // ---------------------------------------------------------------------------
  function renderProfileSummary(profile) {
    state.profile = profile;
    const summaryEl = document.getElementById("profile-summary-line");
    const badgeEl = document.getElementById("profile-status-badge");
    if (!summaryEl || !badgeEl) return;

    if (!profile || (!profile.full_name && !profile.family_primary_phone)) {
      badgeEl.textContent = "Setup Needed";
      badgeEl.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0";
      summaryEl.textContent =
        "No citizen/family details saved yet. Configure your name, phone, blood group & family contact for immediate police transmission.";
      return;
    }

    badgeEl.textContent = profile.is_configured ? "Profile Ready" : "Partial Profile";
    badgeEl.className = profile.is_configured
      ? "text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0"
      : "text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0";

    summaryEl.innerHTML = `
      <div class="font-bold text-navy-900">${escapeHtml(profile.full_name || "Citizen")} ${profile.blood_group ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px]">${escapeHtml(profile.blood_group)}</span>` : ""}</div>
      <div class="text-[11px] text-slate-600">Mobile: <strong>${escapeHtml(profile.phone || "—")}</strong></div>
      <div class="text-[11px] text-slate-600">Family (${escapeHtml(profile.family_primary_relation || "Contact")}): <strong>${escapeHtml(profile.family_primary_name || "—")}</strong> · ${escapeHtml(profile.family_primary_phone || "—")}</div>
    `;
  }

  function fillProfileForm(profile) {
    if (!profile) return;
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v || "";
    };
    setVal("prof-full-name", profile.full_name);
    setVal("prof-phone", profile.phone);
    setVal("prof-age", profile.age);
    setVal("prof-gender", profile.gender);
    setVal("prof-blood", profile.blood_group);
    setVal("prof-vehicle", profile.vehicle_info);
    setVal("prof-address", profile.home_address);
    setVal("prof-medical", profile.medical_notes);
    setVal("prof-fam1-name", profile.family_primary_name);
    setVal("prof-fam1-rel", profile.family_primary_relation || "Mother");
    setVal("prof-fam1-phone", profile.family_primary_phone);
    setVal("prof-fam2-name", profile.family_secondary_name);
    setVal("prof-fam2-phone", profile.family_secondary_phone);
  }

  function openProfileModal() {
    fillProfileForm(state.profile);
    document.getElementById("profile-modal")?.classList.remove("hidden");
  }

  function closeProfileModal() {
    document.getElementById("profile-modal")?.classList.add("hidden");
  }

  async function saveCitizenProfileForm(ev) {
    ev.preventDefault();
    const getVal = (id) => (document.getElementById(id)?.value || "").trim();
    const payload = {
      full_name: getVal("prof-full-name"),
      phone: getVal("prof-phone"),
      age: getVal("prof-age"),
      gender: getVal("prof-gender"),
      blood_group: getVal("prof-blood"),
      vehicle_info: getVal("prof-vehicle"),
      home_address: getVal("prof-address"),
      medical_notes: getVal("prof-medical"),
      family_primary_name: getVal("prof-fam1-name"),
      family_primary_relation: getVal("prof-fam1-rel"),
      family_primary_phone: getVal("prof-fam1-phone"),
      family_secondary_name: getVal("prof-fam2-name"),
      family_secondary_phone: getVal("prof-fam2-phone"),
    };
    try {
      const res = await apiJson("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      renderProfileSummary(res.profile);
      closeProfileModal();
      if (state.emergencyActive && state.emergencyData?.incident_code) {
        const syncRes = await apiJson("/api/sos/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident_code: state.emergencyData.incident_code,
            status: "ACTIVE_DISPATCH",
            profile: payload,
          }),
        }).catch(() => null);
        if (syncRes && syncRes.updated && syncRes.updated.dispatch_packet) {
          state.emergencyData.profile = res.profile;
          state.emergencyData.police_dispatch_packet = syncRes.updated.dispatch_packet;
          populateSosModalAndBanner(state.emergencyData);
        }
      }
      showToast("Citizen & Family profile saved for emergency police dispatch.");
    } catch (err) {
      showToast("Failed to save profile: " + err.message, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Server Calls: Analyze, Robustness, JSON Reports, Emergency SOS
  // ---------------------------------------------------------------------------
  async function runAnalysis() {
    if (state.emergencyActive) {
      await activateEmergencySos(false);
      return;
    }
    const seq = ++state.analysisSeq;
    try {
      stopNavigation();
      resetNavMovementState();
      const data = await apiJson("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getQueryPayload()),
      });
      if (seq !== state.analysisSeq) return;
      state.latestResponse = data;
      renderRoutePickerBar();
      renderStrategyCardsAndTable();
      renderMapRoutes();
      enhanceUniversalRoutesOnRoads(data, seq);
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function setEmergencyVisualState(active) {
    const banner = document.getElementById("emergency-mode-banner");
    const compareWrap = document.getElementById("compare-content-wrap");
    const compareNote = document.getElementById("compare-emergency-note");
    const mapCard = document.querySelector("#map-section > div:first-child");
    const fabLabel = document.getElementById("sos-fab-label");

    if (banner) banner.classList.toggle("hidden", !active);
    if (compareNote) compareNote.classList.toggle("hidden", !active);
    if (compareWrap) {
      compareWrap.classList.toggle("bg-slate-100/80", active);
      compareWrap.classList.toggle("p-3", active);
      compareWrap.classList.toggle("rounded-2xl", active);
      compareWrap.classList.toggle("border", active);
      compareWrap.classList.toggle("border-slate-200", active);
    }
    if (mapCard) {
      mapCard.classList.toggle("ring-2", active);
      mapCard.classList.toggle("ring-red-500", active);
      mapCard.classList.toggle("border-red-400", active);
    }
    if (fabLabel) fabLabel.textContent = active ? "ACTIVE" : "SOS";
  }

  function openSosModal() {
    document.getElementById("sos-alert-modal")?.classList.remove("hidden");
  }

  function closeSosModal() {
    document.getElementById("sos-alert-modal")?.classList.add("hidden");
  }

  function populateSosModalAndBanner(res) {
    const pol = res.nearest_police;
    const em = res.emergency_route;
    const cur = res.current_location;
    const pkt = res.police_dispatch_packet || {};
    const cit = pkt.citizen || {};
    const fam = pkt.family_contacts?.primary || {};
    const fam2 = pkt.family_contacts?.secondary || {};

    const incBadge = document.getElementById("sos-incident-badge");
    if (incBadge) incBadge.textContent = res.incident_code || "SP-SOS";
    const bannerInc = document.getElementById("banner-incident-code");
    if (bannerInc) bannerInc.textContent = res.incident_code || "SOS DISPATCHED";

    const originText = `Live Coordinates: ${cur.source_name} (${Number(cur.lat).toFixed(5)}, ${Number(cur.lng).toFixed(5)})`;
    const originEl = document.getElementById("sos-origin-line");
    if (originEl) originEl.textContent = originText;

    const subEl = document.getElementById("sos-dispatch-sub");
    if (subEl) subEl.textContent = res.alert_message || "Police station and family emergency contacts notified.";

    document.getElementById("sos-police-name").textContent = pol.name;
    document.getElementById("sos-police-distance").textContent = `${pol.direct_dist_km} km direct distance`;
    const cityEl = document.getElementById("sos-police-city");
    if (cityEl) cityEl.textContent = `Jurisdiction: ${pol.city || "India"} · Locked Police Command Target`;

    document.getElementById("sos-route-metrics").textContent = `Safety ${em.safety_score}/100 · ${em.total_time} min`;
    document.getElementById("sos-route-dist").textContent = `${em.total_dist} km · ${em.high_risk_count} High-Risk Segments`;
    document.getElementById("sos-route-corridor").textContent = "Path: " + em.segments.map((s) => s.road).join(" → ");

    document.getElementById("emergency-banner-summary").textContent =
      `Nearest Police: ${pol.name} (${pol.direct_dist_km} km) · Safe Route: ${em.safety_score}/100 safety, ${em.total_time} min (${em.total_dist} km)`;

    const detailsEl = document.getElementById("sos-transmitted-details");
    if (detailsEl) {
      detailsEl.innerHTML = `
        <div class="rounded-xl bg-white border border-slate-200 p-3 space-y-1">
          <div class="text-[10px] font-bold uppercase text-slate-500">Citizen Identity Sent</div>
          <div class="font-bold text-navy-900">${escapeHtml(cit.full_name || "Unregistered Citizen")} ${cit.blood_group ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px]">${escapeHtml(cit.blood_group)}</span>` : ""}</div>
          <div class="text-slate-600">Mobile: <strong>${escapeHtml(cit.phone || "Not Provided")}</strong></div>
          <div class="text-slate-600">Address: ${escapeHtml(cit.home_address || "Not Provided")}</div>
          ${cit.vehicle_info ? `<div class="text-slate-600">Vehicle: ${escapeHtml(cit.vehicle_info)}</div>` : ""}
          ${cit.medical_notes ? `<div class="text-rose-700 font-semibold">Medical: ${escapeHtml(cit.medical_notes)}</div>` : ""}
        </div>
        <div class="rounded-xl bg-white border border-slate-200 p-3 space-y-1">
          <div class="text-[10px] font-bold uppercase text-slate-500">Family &amp; Live GPS Telemetry</div>
          <div class="font-bold text-navy-900">${escapeHtml(fam.name || "Not Provided")} (${escapeHtml(fam.relation || "Family")})</div>
          <div class="text-slate-600">Primary Family Phone: <strong>${escapeHtml(fam.phone || "Not Provided")}</strong></div>
          ${fam2.phone ? `<div class="text-slate-600">Secondary: ${escapeHtml(fam2.name || "Contact")} · ${escapeHtml(fam2.phone)}</div>` : ""}
          <div class="text-slate-600">GPS: <span class="font-mono">${Number(cur.lat).toFixed(5)}, ${Number(cur.lng).toFixed(5)}</span></div>
        </div>
      `;
    }

    const qName = document.getElementById("sos-quick-name");
    const qPhone = document.getElementById("sos-quick-phone");
    const qFamName = document.getElementById("sos-quick-fam-name");
    const qFamPhone = document.getElementById("sos-quick-fam-phone");
    if (qName) qName.value = res.profile?.full_name || "";
    if (qPhone) qPhone.value = res.profile?.phone || "";
    if (qFamName) qFamName.value = res.profile?.family_primary_name || "";
    if (qFamPhone) qFamPhone.value = res.profile?.family_primary_phone || "";

    const saveStatus = document.getElementById("sos-quick-save-status");
    if (saveStatus) saveStatus.textContent = "";
    const callStatus = document.getElementById("sos-call-status");
    if (callStatus) callStatus.classList.add("hidden");
  }

  async function activateEmergencySos(showModal = true) {
    if (state.emergencyActive && showModal && state.emergencyData && !arguments.length) {
      openSosModal();
      return;
    }

    if (!state.emergencyActive) {
      state.preEmergencySnapshot = {
        source: state.source,
        dest: state.dest,
        sourcePlace: state.sourcePlace,
        destPlace: state.destPlace,
        riskPreference: state.riskPreference,
        selectedStrategy: state.selectedStrategy,
      };
    }

    try {
      stopNavigation();
      resetNavMovementState();

      const curLat = state.userGps ? state.userGps.lat : state.sourcePlace ? state.sourcePlace.lat : null;
      const curLng = state.userGps ? state.userGps.lng : state.sourcePlace ? state.sourcePlace.lng : null;
      const detectedName = state.userGps
        ? state.userGps.label
        : state.sourcePlace
        ? state.sourcePlace.name
        : "";

      const payload = {
        ...getQueryPayload(),
        current_lat: curLat,
        current_lng: curLng,
        detected_location_name: detectedName,
      };
      const res = await apiJson("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      state.emergencyActive = true;
      state.emergencyData = res;
      state.selectedStrategy = "adaptive";
      state.riskPreference = 100;
      state.latestResponse = {
        analysis: res.analysis,
        tornado: res.tornado,
      };
      if (res.profile) renderProfileSummary(res.profile);

      const destInp = document.getElementById("dest-search-input");
      if (destInp) {
        destInp.value = `SOS POLICE: ${res.nearest_police.name} (${res.nearest_police.direct_dist_km} km)`;
      }

      const riskSlider = document.getElementById("risk-pref-slider");
      const riskLabel = document.getElementById("risk-pref-label");
      if (riskSlider) riskSlider.value = 100;
      if (riskLabel) riskLabel.textContent = "Cautious (100 · SOS Max)";

      setEmergencyVisualState(true);
      updateGpsStatusPill(`EMERGENCY SOS ACTIVE · Routing to ${res.nearest_police.name}`, true);
      populateSosModalAndBanner(res);
      renderRoutePickerBar();
      renderStrategyCardsAndTable();
      renderMapRoutes();

      if (showModal) openSosModal();

      // Road-snap final police spur leg asynchronously via OSRM
      const lastSeg = res.emergency_route?.segments?.[res.emergency_route.segments.length - 1];
      if (lastSeg && (lastSeg.id === "sos_final" || lastSeg.id === "sos_direct" || String(lastSeg.id).startsWith("uni_")) && lastSeg.coords.length >= 2) {
        const a = lastSeg.coords[0];
        const b = lastSeg.coords[lastSeg.coords.length - 1];
        fetchRoadApproach(a[0], a[1], b[0], b[1]).then((roadCoords) => {
          if (roadCoords && state.emergencyActive && state.emergencyData === res) {
            lastSeg.coords = roadCoords;
            renderMapRoutes();
          }
        });
      }
    } catch (err) {
      showToast("Emergency SOS failed: " + err.message, true);
    }
  }

  async function updateActiveSosPacket() {
    if (!state.emergencyData || !state.emergencyData.incident_code) return;
    const getVal = (id) => (document.getElementById(id)?.value || "").trim();
    const profPatch = {
      full_name: getVal("sos-quick-name"),
      phone: getVal("sos-quick-phone"),
      family_primary_name: getVal("sos-quick-fam-name"),
      family_primary_phone: getVal("sos-quick-fam-phone"),
    };
    try {
      const res = await apiJson("/api/sos/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_code: state.emergencyData.incident_code,
          status: "ACTIVE_DISPATCH",
          profile: profPatch,
        }),
      });
      const profRes = await apiJson("/api/profile");
      if (profRes.profile) {
        renderProfileSummary(profRes.profile);
        state.emergencyData.profile = profRes.profile;
      }
      if (res.updated && res.updated.dispatch_packet) {
        state.emergencyData.police_dispatch_packet = res.updated.dispatch_packet;
        populateSosModalAndBanner(state.emergencyData);
      }
      const saveStatus = document.getElementById("sos-quick-save-status");
      if (saveStatus) saveStatus.textContent = "Updated & transmitted to Police Control.";
      showToast("Police dispatch record updated with citizen & family contact details.");
    } catch (err) {
      showToast("Update failed: " + err.message, true);
    }
  }

  async function cancelEmergencySos() {
    const prevIncidentCode = state.emergencyData?.incident_code;
    state.emergencyActive = false;
    state.emergencyData = null;
    closeSosModal();
    setEmergencyVisualState(false);

    if (prevIncidentCode) {
      apiJson("/api/sos/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_code: prevIncidentCode, status: "CANCELLED" }),
      }).catch(() => {});
    }

    if (state.preEmergencySnapshot) {
      state.source = state.preEmergencySnapshot.source;
      state.dest = state.preEmergencySnapshot.dest;
      state.sourcePlace = state.preEmergencySnapshot.sourcePlace;
      state.destPlace = state.preEmergencySnapshot.destPlace;
      state.riskPreference = state.preEmergencySnapshot.riskPreference;
      state.selectedStrategy = state.preEmergencySnapshot.selectedStrategy;
      state.preEmergencySnapshot = null;
    }

    updateGpsStatusPill(
      state.userGps ? `${state.userGps.label}` : "GPS Vehicle anchored at Start Location",
      Boolean(state.userGps?.isLive)
    );
    syncControlsFromState();
    runAnalysis();
    showToast("Emergency Mode cancelled — normal route planning restored.");
  }

  function scheduleAnalysis() {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(runAnalysis, 140);
  }

  async function runRobustnessTest() {
    try {
      stopNavigation();
      resetNavMovementState();
      const data = await apiJson("/api/robustness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getQueryPayload()),
      });
      state.disruptions = data.disruptions;
      state.latestResponse = {
        analysis: data.after_analysis,
        tornado: data.tornado,
      };
      state.latestRobustness = data;
      renderRobustnessPanel(data);
      renderRoutePickerBar();
      renderStrategyCardsAndTable();
      renderMapRoutes();
      showToast("Safety condition degradation applied — Adaptive re-evaluated.");
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function resetDisruptions() {
    state.disruptions = {};
    state.latestRobustness = null;
    renderRobustnessPanel(null);
    runAnalysis();
    showToast("Disruptions cleared — baseline city conditions restored.");
  }

  async function downloadSafetyReport() {
    try {
      const payload = {
        ...getQueryPayload(),
        selected_strategy: state.selectedStrategy,
      };
      const res = await fetch("/api/report/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detail = "Failed to generate safety report";
        try {
          const err = await res.json();
          if (err && err.error) detail = err.error;
        } catch (_) {}
        throw new Error(detail);
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const match = disp.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : "safepath_safety_report.txt";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Safety report downloaded and saved to database.");
    } catch (err) {
      showToast(err.message || "Download failed.", true);
    }
  }

  // ---------------------------------------------------------------------------
  // Controls Wiring
  // ---------------------------------------------------------------------------
  function syncControlsFromState() {
    const srcInp = document.getElementById("source-search-input");
    const dstInp = document.getElementById("dest-search-input");
    if (srcInp && state.sourcePlace) srcInp.value = placeDisplayLabel(state.sourcePlace);
    if (dstInp && state.destPlace && !state.emergencyActive) dstInp.value = placeDisplayLabel(state.destPlace);

    const riskSlider = document.getElementById("risk-pref-slider");
    const riskLabel = document.getElementById("risk-pref-label");
    if (riskSlider) riskSlider.value = state.riskPreference;
    const prefLabel =
      state.riskPreference >= 70 ? "Cautious" : state.riskPreference <= 30 ? "Time-Priority" : "Balanced";
    if (riskLabel) riskLabel.textContent = `${prefLabel} (${state.riskPreference})`;

    document.querySelectorAll(".mode-btn").forEach((btn) => {
      const active = btn.getAttribute("data-mode") === state.travelMode;
      btn.className = active
        ? "mode-btn px-2.5 py-2 rounded-lg border text-xs font-semibold transition flex items-center justify-center gap-1.5 bg-safe-600 text-white border-safe-600 shadow-sm"
        : "mode-btn px-2.5 py-2 rounded-lg border text-xs font-semibold transition flex items-center justify-center gap-1.5 bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
    });

    document.querySelectorAll(".tod-btn").forEach((btn) => {
      const active = btn.getAttribute("data-tod") === state.timeOfDay;
      btn.className = active
        ? "tod-btn px-3 py-2 rounded-lg border text-xs font-semibold transition bg-navy-900 text-white border-navy-900 shadow-sm"
        : "tod-btn px-3 py-2 rounded-lg border text-xs font-semibold transition bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
    });
  }

  function bindEvents() {
    wirePlaceAutocomplete("source");
    wirePlaceAutocomplete("dest");

    document.addEventListener("click", (e) => {
      const t = e.target;
      if (
        !t.closest("#source-search-input") &&
        !t.closest("#source-dropdown") &&
        !t.closest("#source-clear-btn") &&
        !t.closest("#dest-search-input") &&
        !t.closest("#dest-dropdown") &&
        !t.closest("#dest-clear-btn")
      ) {
        closeAllPlaceDropdowns();
      }
    });

    document.querySelectorAll(".cat-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.activeCategory = chip.getAttribute("data-cat") || "";
        document.querySelectorAll(".cat-chip").forEach((c) => {
          const isAct = (c.getAttribute("data-cat") || "") === state.activeCategory;
          c.className = isAct
            ? "cat-chip px-2.5 py-1 rounded-lg border text-[11px] font-semibold bg-navy-900 text-white border-navy-900 transition"
            : "cat-chip px-2.5 py-1 rounded-lg border text-[11px] font-semibold bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 transition";
        });
        document.getElementById("dest-search-input")?.focus();
      });
    });

    document.getElementById("source-my-loc-btn")?.addEventListener("click", () => requestRealGps("source"));

    document.getElementById("swap-places-btn")?.addEventListener("click", () => {
      const tmpPlace = state.sourcePlace;
      const tmpId = state.source;
      state.sourcePlace = state.destPlace;
      state.source = state.dest;
      state.destPlace = tmpPlace;
      state.dest = tmpId;
      state.userGps = null;
      syncControlsFromState();
      runAnalysis();
    });

    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.travelMode = btn.getAttribute("data-mode");
        syncControlsFromState();
        runAnalysis();
      });
    });

    document.querySelectorAll(".tod-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.timeOfDay = btn.getAttribute("data-tod");
        syncControlsFromState();
        runAnalysis();
      });
    });

    document.getElementById("risk-pref-slider")?.addEventListener("input", (e) => {
      state.riskPreference = Number(e.target.value);
      syncControlsFromState();
      scheduleAnalysis();
    });

    document.getElementById("find-routes-btn")?.addEventListener("click", runAnalysis);
    document.getElementById("simulate-robustness-btn")?.addEventListener("click", runRobustnessTest);
    document.getElementById("reset-conditions-btn")?.addEventListener("click", resetDisruptions);
    document.getElementById("download-report-btn")?.addEventListener("click", downloadSafetyReport);
    document.getElementById("planner-download-report-btn")?.addEventListener("click", downloadSafetyReport);

    document.getElementById("use-gps-btn")?.addEventListener("click", () => requestRealGps("source"));
    document.getElementById("pick-gps-btn")?.addEventListener("click", () => togglePickGpsMode());
    document.getElementById("basemap-osm")?.addEventListener("click", () => applyBasemap("osm"));
    document.getElementById("basemap-sat")?.addEventListener("click", () => applyBasemap("sat"));

    document.getElementById("gps-drive-btn")?.addEventListener("click", toggleNavigation);
    document.getElementById("gps-recenter-btn")?.addEventListener("click", () => {
      if (vehicleMarker && map) {
        map.setView(vehicleMarker.getLatLng(), 15, { animate: true });
      }
    });

    document.getElementById("map-mode-strategies")?.addEventListener("click", () => {
      state.mapMode = "strategies";
      document.getElementById("map-mode-strategies").className = "px-2.5 py-1 rounded-md bg-navy-900 text-white transition";
      document.getElementById("map-mode-segments").className = "px-2.5 py-1 rounded-md text-slate-600 hover:text-navy-900 transition";
      document.getElementById("legend-strategies")?.classList.remove("hidden");
      document.getElementById("legend-segments")?.classList.add("hidden");
      renderMapRoutes();
    });

    document.getElementById("map-mode-segments")?.addEventListener("click", () => {
      state.mapMode = "segments";
      document.getElementById("map-mode-segments").className = "px-2.5 py-1 rounded-md bg-navy-900 text-white transition";
      document.getElementById("map-mode-strategies").className = "px-2.5 py-1 rounded-md text-slate-600 hover:text-navy-900 transition";
      document.getElementById("legend-strategies")?.classList.add("hidden");
      document.getElementById("legend-segments")?.classList.remove("hidden");
      renderMapRoutes();
    });

    document.getElementById("toggle-pois")?.addEventListener("change", (e) => {
      state.showPois = e.target.checked;
      renderEmergencyPois();
    });

    // Profile Modal Events
    document.getElementById("open-profile-modal-btn")?.addEventListener("click", openProfileModal);
    document.getElementById("close-profile-modal-btn")?.addEventListener("click", closeProfileModal);
    document.getElementById("cancel-profile-modal-btn")?.addEventListener("click", closeProfileModal);
    document.getElementById("citizen-profile-form")?.addEventListener("submit", saveCitizenProfileForm);

    // Current Location Chooser Modal Events
    document.getElementById("close-cur-loc-modal-btn")?.addEventListener("click", closeCurrentLocationPicker);
    document.getElementById("cancel-cur-loc-modal-btn")?.addEventListener("click", closeCurrentLocationPicker);
    document.getElementById("current-location-modal")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "current-location-modal") {
        closeCurrentLocationPicker();
      }
    });
    document.getElementById("cur-loc-pin-map-btn")?.addEventListener("click", () => {
      closeCurrentLocationPicker();
      togglePickGpsMode(true);
      document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("cur-loc-retry-gps-btn")?.addEventListener("click", () => {
      requestRealGps(state.gpsRoleTarget || "source", { fromModalRetry: true });
    });
    document.getElementById("cur-loc-search-input")?.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      clearTimeout(state.curLocSearchTimer);
      state.curLocSearchTimer = setTimeout(() => {
        queryCurrentLocationModalList(q);
      }, 100);
    });

    // Emergency SOS Events
    document.getElementById("sos-floating-btn")?.addEventListener("click", () => {
      if (state.emergencyActive) {
        openSosModal();
      } else {
        activateEmergencySos(true);
      }
    });
    document.getElementById("reopen-sos-modal-btn")?.addEventListener("click", openSosModal);
    document.getElementById("sos-view-map-btn")?.addEventListener("click", () => {
      closeSosModal();
      document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("sos-minimize-x-btn")?.addEventListener("click", closeSosModal);
    document.getElementById("sos-cancel-btn")?.addEventListener("click", cancelEmergencySos);
    document.getElementById("banner-cancel-sos-btn")?.addEventListener("click", cancelEmergencySos);
    document.getElementById("sos-update-packet-btn")?.addEventListener("click", updateActiveSosPacket);

    document.getElementById("sos-call-112-btn")?.addEventListener("click", () => {
      const box = document.getElementById("sos-call-status");
      if (box) {
        box.textContent = "Initiating emergency call to 112 National Emergency Response Helpline...";
        box.classList.remove("hidden");
      }
    });
    document.getElementById("sos-call-100-btn")?.addEventListener("click", () => {
      const box = document.getElementById("sos-call-status");
      const polName = state.emergencyData?.nearest_police?.name || "Nearest Police Station";
      if (box) {
        box.textContent = `Connecting to 100 Police Control Room / ${polName}...`;
        box.classList.remove("hidden");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap Application
  // ---------------------------------------------------------------------------
  async function bootstrap() {
    startRotatingQuotes();
    initMap();
    setupCompassOrientation(false);

    try {
      const initData = await apiJson("/api/init");
      state.locations = initData.locations || [];
      state.allPlaces = initData.all_places || [];
      state.presets = initData.presets || [];
      state.emergencyPois = initData.emergency_pois || [];
      state.defaultWeights = initData.default_weights || {};
      state.factorLabels = initData.factor_labels || {};
      state.factorWeights = { ...state.defaultWeights };

      const locById = (id) => state.locations.find((l) => l.id === id) || state.locations[0] || null;
      state.sourcePlace = locById(state.source);
      state.destPlace = locById(state.dest);

      if (initData.profile) {
        renderProfileSummary(initData.profile);
      }

      const presetBox = document.getElementById("preset-buttons");
      if (presetBox) {
        presetBox.innerHTML = state.presets
          .map(
            (p) =>
              `<button type="button" data-from="${escapeHtml(p.from)}" data-to="${escapeHtml(p.to)}" class="text-left px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 truncate transition">${escapeHtml(p.label)}</button>`
          )
          .join("");

        presetBox.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            const fId = btn.getAttribute("data-from");
            const tId = btn.getAttribute("data-to");
            state.source = fId;
            state.dest = tId;
            state.sourcePlace = locById(fId);
            state.destPlace = locById(tId);
            state.userGps = null;
            updateGpsStatusPill("GPS Vehicle anchored at Start Location", false);
            state.disruptions = {};
            renderRobustnessPanel(null);
            syncControlsFromState();
            runAnalysis();
          });
        });
      }

      syncControlsFromState();
      bindEvents();
      renderEmergencyPois();

      await runAnalysis();

      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: "geolocation" })
          .then((res) => {
            if (res.state === "granted") requestRealGps("source");
          })
          .catch(() => {});
      }
    } catch (err) {
      showToast("Initialization failed: " + err.message, true);
    }
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
