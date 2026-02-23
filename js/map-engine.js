/**
 * Map Engine — Leaflet map init, parcel rendering, heat coloring
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const MapEngine = (() => {
  let map = null;
  let markerClusterGroup = null;
  let markers = [];
  let selectedMarker = null;
  let debounceTimer = null;
  let currentParcels = [];
  let isLoading = false;
  let suppressReload = false;

  const LA_CENTER = [34.0522, -118.2437];
  const INITIAL_ZOOM = 11;

  const MARKER_STYLES = {
    eligible_high: { color: '#1a5c38', radius: 10, opacity: 0.85, fillOpacity: 0.85 },
    eligible_mid: { color: '#2d8f5c', radius: 8, opacity: 0.75, fillOpacity: 0.75 },
    eligible_low: { color: '#4ab87a', radius: 6, opacity: 0.65, fillOpacity: 0.65 },
    conditional: { color: '#b8960c', radius: 6, opacity: 0.6, fillOpacity: 0.6 },
    ineligible: { color: '#cccccc', radius: 4, opacity: 0.15, fillOpacity: 0.15 }
  };

  function init() {
    if (map) return;

    map = L.map('map', {
      center: LA_CENTER,
      zoom: INITIAL_ZOOM,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 19
    }).addTo(map);

    // Initialize marker cluster group
    if (typeof L.markerClusterGroup === 'function') {
      markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function (cluster) {
          const count = cluster.getChildCount();
          let size = 'small';
          let dim = 36;
          if (count > 50) { size = 'large'; dim = 48; }
          else if (count > 20) { size = 'medium'; dim = 42; }

          return L.divIcon({
            html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
            className: 'marker-cluster-custom',
            iconSize: L.point(dim, dim)
          });
        }
      });
      map.addLayer(markerClusterGroup);
    }

    // Add cluster CSS dynamically
    addClusterStyles();

    // Listen for map movement
    map.on('moveend', onMapMove);
    map.on('zoomend', onMapMove);

    // Add legend
    addLegend();

    // Initial load
    loadParcels();
  }

  function addClusterStyles() {
    if (document.getElementById('cluster-styles')) return;
    const style = document.createElement('style');
    style.id = 'cluster-styles';
    style.textContent = `
      .marker-cluster-custom { background: transparent !important; border: none !important; }
      .cluster-icon {
        display: flex; align-items: center; justify-content: center;
        background: rgba(184,150,12,0.9); color: #0d0d0d;
        font-family: 'DM Mono', monospace; font-weight: 700;
        border-radius: 50%; border: 2px solid rgba(245,242,235,0.8);
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .cluster-small { width: 36px; height: 36px; font-size: 11px; }
      .cluster-medium { width: 42px; height: 42px; font-size: 12px; }
      .cluster-large { width: 48px; height: 48px; font-size: 13px; }
    `;
    document.head.appendChild(style);
  }

  function addLegend() {
    const legend = document.querySelector('.map-legend');
    if (legend) {
      legend.innerHTML = `
        <h4>ARO Eligibility</h4>
        <div class="legend-item"><span class="legend-dot" style="background:#1a5c38"></span>Eligible — Score 80+</div>
        <div class="legend-item"><span class="legend-dot" style="background:#2d8f5c"></span>Eligible — Score 60–79</div>
        <div class="legend-item"><span class="legend-dot" style="background:#4ab87a"></span>Eligible — Score 40–59</div>
        <div class="legend-item"><span class="legend-dot" style="background:#b8960c"></span>Conditional — ZA Required</div>
        <div class="legend-item"><span class="legend-dot" style="background:#cccccc"></span>Ineligible</div>
      `;
    }
  }

  function onMapMove() {
    if (suppressReload) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadParcels();
    }, 500);
  }

  async function loadParcels(filters = null) {
    if (isLoading) return;
    if (!map) return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // Get current filters from UI
    const activeFilters = filters || Filters.getCurrentFilters();

    setLoading(true);

    try {
      const parcels = await ParcelAPI.fetchParcelsInBounds(bounds, activeFilters);
      currentParcels = parcels;

      if (parcels.length >= 500) {
        showToast('Zoom in to see more properties — showing top 500 results');
      }

      renderMarkers(parcels);
      updatePropertyList(parcels);
      updateResultsCounter(parcels.length);
    } catch (error) {
      console.error('Failed to load parcels:', error);
      showToast('Unable to load property data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function renderMarkers(parcels) {
    // Clear existing markers
    if (markerClusterGroup) {
      markerClusterGroup.clearLayers();
    }
    markers = [];

    parcels.forEach(parcel => {
      const score = AROScoring.calculateParcelScore(parcel.raw || parcel);
      const eligibility = AROScoring.getParcelEligibility(parcel.raw || parcel);
      const style = getMarkerStyle(eligibility.status, score);

      const marker = L.circleMarker([parcel.lat, parcel.lng], {
        radius: style.radius,
        color: style.color,
        fillColor: style.color,
        fillOpacity: style.fillOpacity,
        opacity: style.opacity,
        weight: 1
      });

      marker.parcelData = parcel;
      marker.parcelScore = score;
      marker.parcelEligibility = eligibility;

      marker.on('click', () => {
        openDetailPanel(parcel, score, eligibility);
        highlightMarker(marker);
      });

      marker.bindTooltip(
        `<strong>${parcel.address}</strong><br>${parcel.useDescription} | ${parcel.yearBuilt}<br>Score: ${score}`,
        { direction: 'top', offset: [0, -8] }
      );

      if (markerClusterGroup) {
        markerClusterGroup.addLayer(marker);
      } else {
        marker.addTo(map);
      }

      markers.push(marker);
    });
  }

  function getMarkerStyle(eligStatus, score) {
    if (eligStatus === 'ineligible') return MARKER_STYLES.ineligible;
    if (eligStatus === 'conditional') return MARKER_STYLES.conditional;

    // Eligible — color by score
    if (score >= 80) return MARKER_STYLES.eligible_high;
    if (score >= 60) return MARKER_STYLES.eligible_mid;
    return MARKER_STYLES.eligible_low;
  }

  function highlightMarker(marker) {
    if (selectedMarker) {
      const prevStyle = getMarkerStyle(selectedMarker.parcelEligibility.status, selectedMarker.parcelScore);
      selectedMarker.setStyle({ weight: 1, ...prevStyle });
    }
    selectedMarker = marker;
    marker.setStyle({ weight: 3, color: '#b8960c', fillColor: '#b8960c' });
  }

  function openDetailPanel(parcel, score, eligibility) {
    const panel = document.getElementById('detail-panel');
    if (!panel) return;

    const buildingAge = AROScoring.CURRENT_YEAR - parcel.yearBuilt;
    const sfFormatted = parcel.sqft ? parcel.sqft.toLocaleString() : 'N/A';
    const scoreColor = AROScoring.getScoreColor(score);
    const threshold = AROScoring.SCORE_THRESHOLDS.find(t => score >= t.min);

    // Generate deal angles based on available data
    const angles = getQuickDealAngles(parcel, eligibility);
    const financing = getQuickFinancing(parcel);

    panel.querySelector('.detail-address').textContent = parcel.address;
    panel.querySelector('.detail-ain').textContent = `AIN: ${parcel.ain}`;

    panel.querySelector('.detail-meta-grid').innerHTML = `
      <div class="detail-meta-item">
        <div class="detail-meta-label">Use Type</div>
        <div class="detail-meta-value">${parcel.useDescription}</div>
      </div>
      <div class="detail-meta-item">
        <div class="detail-meta-label">Year Built</div>
        <div class="detail-meta-value">${parcel.yearBuilt} (${buildingAge} yrs)</div>
      </div>
      <div class="detail-meta-item">
        <div class="detail-meta-label">Building SF</div>
        <div class="detail-meta-value">${sfFormatted}</div>
      </div>
      <div class="detail-meta-item">
        <div class="detail-meta-label">Eligibility</div>
        <div class="detail-meta-value"><span class="chip ${eligibility.status}">${eligibility.verdict}</span></div>
      </div>
    `;

    panel.querySelector('.detail-score-num').textContent = score;
    panel.querySelector('.detail-score-num').className = `detail-score-num`;
    panel.querySelector('.detail-score-num').style.color = `var(--${scoreColor})`;

    const scoreBar = panel.querySelector('.detail-score-fill');
    scoreBar.style.width = '0%';
    scoreBar.className = `detail-score-fill`;
    scoreBar.style.background = `var(--${scoreColor})`;
    setTimeout(() => { scoreBar.style.width = score + '%'; }, 50);

    const thresholdEl = panel.querySelector('.detail-threshold');
    if (thresholdEl) thresholdEl.textContent = threshold ? `${threshold.label} — ${threshold.desc}` : '';

    // Deal angles
    const anglesEl = panel.querySelector('.detail-angles');
    anglesEl.innerHTML = angles.map(a =>
      `<div class="detail-angle"><strong>${a.title}</strong><span>${a.desc}</span></div>`
    ).join('');

    // Financing
    panel.querySelector('.detail-financing').textContent = financing;

    // Store parcel data for actions
    panel.dataset.parcelJson = JSON.stringify(parcel);

    panel.classList.add('open');
  }

  function getQuickDealAngles(parcel, eligibility) {
    const angles = [];
    const age = AROScoring.CURRENT_YEAR - parcel.yearBuilt;
    const use = (parcel.useDescription || '').toLowerCase();

    if (eligibility.status === 'eligible') {
      angles.push({
        title: 'By-Right Speed',
        desc: 'No discretionary review required — staff-level approval only'
      });
    }

    if (use.includes('office')) {
      angles.push({
        title: 'Office-to-Resi Conversion',
        desc: 'Office vacancy at historic highs; residential demand acute in LA'
      });
    }

    if (age >= 40) {
      angles.push({
        title: 'Distressed Owner Opportunity',
        desc: `${age}-year-old asset likely facing deferred maintenance and declining NOI`
      });
    }

    if (angles.length === 0) {
      angles.push({
        title: 'ARO Conversion Candidate',
        desc: 'Evaluate physical characteristics and ownership situation for conversion potential'
      });
    }

    return angles.slice(0, 3);
  }

  function getQuickFinancing(parcel) {
    const sf = parcel.sqft || 0;
    if (sf > 50000) {
      return 'Large asset — consider construction/perm bridge (65-70% LTC) or debt fund bridge. CMBS post-stabilization for permanent financing.';
    }
    return 'Construction/perm bridge loan (65-70% LTC) or SBA 504 if owner-occupied. Debt fund bridge for faster execution.';
  }

  function closeDetailPanel() {
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.remove('open');
    if (selectedMarker) {
      const style = getMarkerStyle(selectedMarker.parcelEligibility.status, selectedMarker.parcelScore);
      selectedMarker.setStyle({ weight: 1, ...style });
      selectedMarker = null;
    }
  }

  function zoomToParcel(lat, lng) {
    if (!map) return;
    suppressReload = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    map.flyTo([lat, lng], 16, { duration: 0.8 });
    // flyTo fires moveend/zoomend multiple times during animation — suppress for duration + buffer
    setTimeout(() => { suppressReload = false; }, 1500);
  }

  function updatePropertyList(parcels) {
    const listEl = document.getElementById('property-list');
    if (!listEl) return;

    // Sort by score descending
    const sorted = [...parcels]
      .map(p => ({
        ...p,
        score: AROScoring.calculateParcelScore(p.raw || p),
        eligibility: AROScoring.getParcelEligibility(p.raw || p)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    if (sorted.length === 0) {
      listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--mid); font-size: 0.82rem;">No properties found in current view. Try adjusting filters or zooming out.</div>';
      return;
    }

    listEl.innerHTML = sorted.map(p => {
      const scoreClass = p.score >= 60 ? 'high' : p.score >= 40 ? 'medium' : 'low';
      return `
        <div class="property-list-item" data-lat="${p.lat}" data-lng="${p.lng}" data-ain="${p.ain}">
          <div class="pli-address">${p.address}</div>
          <div class="pli-meta">
            <span>${p.useDescription}</span>
            <span>\u00B7 ${p.yearBuilt}</span>
            <span class="pli-score ${scoreClass}">${p.score}</span>
            <span class="chip ${p.eligibility.status}">${p.eligibility.status}</span>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    listEl.querySelectorAll('.property-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const lat = parseFloat(item.dataset.lat);
        const lng = parseFloat(item.dataset.lng);
        const ain = item.dataset.ain;

        // Highlight in list
        listEl.querySelectorAll('.property-list-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');

        // Find matching parcel and marker
        const parcel = currentParcels.find(p => p.ain === ain);
        const marker = markers.find(m => m.parcelData && m.parcelData.ain === ain);

        zoomToParcel(lat, lng);

        if (parcel && marker) {
          const score = marker.parcelScore;
          const eligibility = marker.parcelEligibility;
          openDetailPanel(parcel, score, eligibility);
          highlightMarker(marker);
        }
      });
    });
  }

  function updateResultsCounter(count) {
    const counter = document.getElementById('results-counter');
    if (counter) {
      counter.textContent = `Showing ${count} eligible properties in current view`;
    }
  }

  function setLoading(loading) {
    isLoading = loading;
    const loadingEl = document.querySelector('.map-loading');
    if (loadingEl) {
      loadingEl.classList.toggle('active', loading);
    }
  }

  function showToast(message) {
    let toast = document.getElementById('map-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'map-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 4000);
  }

  function getCurrentParcels() {
    return currentParcels;
  }

  function refreshWithFilters(filters) {
    loadParcels(filters);
  }

  function getMap() { return map; }

  return {
    init,
    loadParcels,
    closeDetailPanel,
    zoomToParcel,
    getCurrentParcels,
    refreshWithFilters,
    openDetailPanel,
    showToast,
    getMap
  };
})();
