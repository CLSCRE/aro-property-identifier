/**
 * Export Module — Deal Pipeline + CSV export + TXT export
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const ExportModule = (() => {
  let prospectingList = [];
  let activeFilters = {};
  let sortField = 'dealScore';
  let sortDir = 'desc';
  let viewMode = 'table'; // 'table' or 'kanban'

  const STAGES = ['New', 'Screening', 'LOI', 'IC', 'Won', 'Lost'];
  const STAGE_COLORS = { New: 'var(--mid)', Screening: 'var(--conditional)', LOI: 'var(--gold)', IC: 'var(--slate)', Won: 'var(--eligible)', Lost: 'var(--ineligible)' };

  function init() {
    loadFromSession();
    updateProspectingBadge();
  }

  // ─── Single Property TXT Export ───

  function exportDealSummary(data) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const eligibility = AROScoring.getEligibility(
      parseInt(data.yearBuilt) || 2026,
      data.useType,
      data.neighborhood
    );

    const scoring = AROScoring.calculateScore(data);
    const angles = AROScoring.getDealAngles(data, eligibility);
    const pathways = AROScoring.getFinancingPathways(data);
    const notes = AROScoring.getFinancingNotes(data);

    const sfFormatted = data.buildingSF ? parseInt(data.buildingSF).toLocaleString() : 'N/A';
    const valueFormatted = data.estimatedValue ? '$' + parseInt(data.estimatedValue).toLocaleString() : 'N/A';

    let txt = '';
    txt += '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n';
    txt += `  ${BRAND.firmName} \u2014 LA Adaptive Reuse Property Analysis\n`;
    txt += '  Deal Summary Report\n';
    txt += '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n';
    txt += `  Generated: ${dateStr} at ${timeStr}\n`;
    txt += `  ${BRAND.website} | ${BRAND.altWebsite}\n`;
    txt += '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n';

    txt += '\u2500\u2500 PROPERTY DETAILS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n';
    txt += `  Address:          ${data.address || 'N/A'}\n`;
    txt += `  Neighborhood:     ${data.neighborhood || 'N/A'}\n`;
    txt += `  Zoning:           ${data.zoning || 'N/A'}\n`;
    txt += `  Year Built:       ${data.yearBuilt || 'N/A'} (${eligibility.buildingAge} years old)\n`;
    txt += `  Building SF:      ${sfFormatted}\n`;
    txt += `  Current Use:      ${data.useType || 'N/A'}\n`;
    txt += `  Stories:          ${data.stories || 'N/A'}\n`;
    txt += `  Vacancy Rate:     ${data.vacancyRate || 'N/A'}\n`;
    txt += `  Estimated Value:  ${valueFormatted}\n`;
    txt += `  Floorplate:       ${data.floorplateShape || 'N/A'}\n`;
    txt += `  Historic Status:  ${data.historicDesignation || 'None'}\n`;
    txt += `  Affordable Plan:  ${data.affordableStrategy || 'None'}\n`;
    if (data.notes) {
      txt += `  Notes:            ${data.notes}\n`;
    }
    txt += '\n';

    txt += '\u2500\u2500 ARO ELIGIBILITY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n';
    txt += `  Verdict:  ${eligibility.verdict}\n\n`;
    txt += `  ${eligibility.explanation}\n\n`;

    txt += '\u2500\u2500 OPPORTUNITY SCORE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n';
    txt += `  Score:  ${scoring.score} / 100\n`;
    txt += `  Rating: ${scoring.threshold.label}\n`;
    txt += `  ${scoring.threshold.desc}\n\n`;

    txt += '  Factor Breakdown:\n';
    scoring.factors.forEach(f => {
      const indicator = f.sentiment === 'positive' ? '+' : f.sentiment === 'negative' ? '-' : '\u00B7';
      txt += `  [${indicator}] ${f.label}: ${f.value} (+${f.points} pts)\n`;
      txt += `      ${f.note}\n`;
    });
    txt += '\n';

    txt += '\u2500\u2500 BROKER DEAL ANGLES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n';
    angles.forEach((a, i) => {
      txt += `  ${i + 1}. ${a.title}\n`;
      txt += `     ${a.desc}\n\n`;
    });

    txt += '\u2500\u2500 FINANCING PATHWAYS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n';
    pathways.forEach(p => {
      txt += `  ${p.title}\n`;
      txt += `  ${p.detail}\n`;
      txt += `  ${p.desc}\n\n`;
    });

    if (notes.length > 0) {
      txt += '\u2500\u2500 FINANCING NOTES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n';
      notes.forEach(n => {
        txt += `  [${n.type.toUpperCase()}] ${n.title}\n`;
        txt += `  ${n.text}\n\n`;
      });
    }

    txt += '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n';
    txt += `  ${BRAND.disclaimerShort}\n`;
    txt += '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n';
    txt += `  ${BRAND.firmName} | ${BRAND.website} | ${BRAND.altWebsite}\n`;
    txt += `  ${BRAND.productName}\n`;
    txt += '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n';

    const addressSlug = (data.address || 'property').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
    downloadFile(`CLS_CRE_ARO_${addressSlug}.txt`, txt, 'text/plain');
  }

  // ─── Deal Pipeline (formerly Prospecting List) ───

  function addToProspectingList(parcel) {
    const exists = prospectingList.find(p => p.ain === parcel.ain || p.address === parcel.address);
    if (exists) {
      if (typeof MapEngine !== 'undefined' && MapEngine.showToast) { MapEngine.showToast('Property already in pipeline'); }
      return false;
    }

    const score = AROScoring.calculateParcelScore(parcel.raw || parcel);
    const eligibility = AROScoring.getParcelEligibility(parcel.raw || parcel);

    // Compute Deal Score if available
    let dealScore = 0, dealBand = 'C', dealCommentary = '';
    if (typeof DealScore !== 'undefined') {
      const ds = DealScore.computeAROScore(parcel.raw || parcel);
      dealScore = ds.score;
      dealBand = ds.band;
      dealCommentary = ds.commentary;
    }

    prospectingList.push({
      address: parcel.address,
      ain: parcel.ain,
      useDescription: parcel.useDescription,
      yearBuilt: parcel.yearBuilt,
      sqft: parcel.sqft,
      lat: parcel.lat,
      lng: parcel.lng,
      score,
      eligibility: eligibility.status,
      verdict: eligibility.verdict,
      dealScore,
      dealBand,
      dealCommentary,
      estimatedUnits: parcel.estimatedUnits || null,
      costPerUnitMid: parcel.costPerUnitMid || null,
      returnOnCost: parcel.returnOnCost || null,
      subsidyGapPerUnit: parcel.subsidyGapPerUnit || null,
      submarket: parcel.submarket || parcel.neighborhood || '',
      stage: 'New',
      addedAt: new Date().toISOString()
    });

    saveToSession();
    updateProspectingBadge();
    renderProspectingList();
    if (typeof MapEngine !== 'undefined' && MapEngine.showToast) { MapEngine.showToast('Added to pipeline'); }
    return true;
  }

  function removeFromProspectingList(index) {
    prospectingList.splice(index, 1);
    saveToSession();
    updateProspectingBadge();
    renderProspectingList();
  }

  function clearProspectingList() {
    prospectingList = [];
    saveToSession();
    updateProspectingBadge();
    renderProspectingList();
  }

  // ─── Pipeline Sorting ───
  function sortPipeline(field) {
    if (sortField === field) {
      sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      sortField = field;
      sortDir = 'desc';
    }
    renderProspectingList();
  }

  // ─── Pipeline Filtering ───
  function togglePipelineFilter(filterKey) {
    if (activeFilters[filterKey]) {
      delete activeFilters[filterKey];
    } else {
      activeFilters[filterKey] = true;
    }
    // Update button active states
    document.querySelectorAll('.pipeline-filter-btn[data-filter]').forEach(btn => {
      const f = btn.dataset.filter;
      if (f) btn.classList.toggle('active', !!activeFilters[f]);
    });
    renderProspectingList();
  }

  function clearPipelineFilters() {
    activeFilters = {};
    document.querySelectorAll('.pipeline-filter-btn[data-filter]').forEach(btn => {
      btn.classList.remove('active');
    });
    renderProspectingList();
  }

  // ─── View Mode Toggle ───
  function setViewMode(mode) {
    viewMode = mode;
    document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.view-toggle-btn[data-view="${mode}"]`);
    if (btn) btn.classList.add('active');
    renderProspectingList();
  }

  // ─── Stage Management ───
  function setDealStage(index, stage) {
    if (index >= 0 && index < prospectingList.length && STAGES.includes(stage)) {
      prospectingList[index].stage = stage;
      saveToSession();
      renderProspectingList();
    }
  }

  // ─── KPI Dashboard ───
  function renderKPIDashboard() {
    const deals = prospectingList;
    const totalDeals = deals.length;
    const totalUnits = deals.reduce((s, d) => s + (d.estimatedUnits || 0), 0);
    const projectedProfit = deals.reduce((s, d) => {
      if (!d.returnOnCost || !d.costPerUnitMid || !d.estimatedUnits) return s;
      return s + (d.estimatedUnits * d.costPerUnitMid * (d.returnOnCost / 100) * 0.3);
    }, 0);
    const icReady = deals.filter(d => d.dealScore >= 80).length;

    const fmt = n => {
      if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
      if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
      return '$' + Math.round(n).toLocaleString();
    };

    return `<div class="kpi-dashboard">
      <div class="kpi-card"><div class="kpi-value">${totalDeals}</div><div class="kpi-label">Total Deals</div></div>
      <div class="kpi-card"><div class="kpi-value">${totalUnits.toLocaleString()}</div><div class="kpi-label">Potential Units</div></div>
      <div class="kpi-card"><div class="kpi-value">${projectedProfit > 0 ? fmt(projectedProfit) : '\u2014'}</div><div class="kpi-label">Est. Value Created</div></div>
      <div class="kpi-card"><div class="kpi-value">${icReady}</div><div class="kpi-label">IC-Ready</div></div>
    </div>`;
  }

  // ─── Stage Summary Bar ───
  function renderStageSummary() {
    const counts = {};
    STAGES.forEach(s => counts[s] = 0);
    prospectingList.forEach(d => { counts[d.stage || 'New']++; });

    let html = '<div class="stage-summary-bar">';
    STAGES.forEach(s => {
      html += `<div class="stage-summary-item"><span class="stage-dot" style="background:${STAGE_COLORS[s]};"></span><span class="stage-name">${s}</span><span class="stage-count">${counts[s]}</span></div>`;
    });
    html += '</div>';
    return html;
  }

  // ─── Kanban View ───
  function renderKanbanView(displayed) {
    let html = '<div class="kanban-board">';
    STAGES.forEach(stage => {
      const stageDeals = displayed.filter(d => (d.stage || 'New') === stage);
      html += `<div class="kanban-column" data-stage="${stage}" ondragover="event.preventDefault()" ondrop="ExportModule.onKanbanDrop(event, '${stage}')">
        <div class="kanban-column-header" style="border-top-color:${STAGE_COLORS[stage]};">
          <span>${stage}</span><span class="kanban-count">${stageDeals.length}</span>
        </div>
        <div class="kanban-cards">`;
      stageDeals.forEach(p => {
        const origIdx = prospectingList.indexOf(p);
        const bc = typeof DealScore !== 'undefined' ? DealScore.bandColor(p.dealBand) : 'conditional';
        html += `<div class="kanban-card" draggable="true" ondragstart="ExportModule.onKanbanDragStart(event, ${origIdx})" onclick="DealSnapshot.openFromPipeline(ExportModule.getProspectingList()[${origIdx}])">
          <div class="kanban-card-address">${p.address}</div>
          <div class="kanban-card-meta">
            <span class="pipeline-score-badge ${bc}" style="font-size:0.72rem;padding:1px 6px;">${p.dealScore}<span class="pipeline-band">${p.dealBand}</span></span>
            <span style="font-size:0.72rem;color:var(--mid);">${p.useDescription || ''}</span>
          </div>
        </div>`;
      });
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function onKanbanDragStart(e, index) {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }

  function onKanbanDrop(e, stage) {
    e.preventDefault();
    const index = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(index)) setDealStage(index, stage);
  }

  function applyFilters(list) {
    let filtered = list;
    if (activeFilters.icReady) {
      filtered = filtered.filter(p => p.dealScore >= 80);
    }
    if (activeFilters.rocTarget) {
      filtered = filtered.filter(p => p.returnOnCost && p.returnOnCost >= 6.5);
    }
    if (activeFilters.lowGap) {
      filtered = filtered.filter(p => !p.subsidyGapPerUnit || p.subsidyGapPerUnit < 50000);
    }
    return filtered;
  }

  function applySorting(list) {
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => {
      let va = a[sortField] || 0;
      let vb = b[sortField] || 0;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  // ─── Pipeline Render ───
  // ─── Phase 7 Pipeline Cell Renderers ───

  function renderFitCell(p) {
    if (typeof SponsorFit === 'undefined') return '<span style="color:var(--mid);">&mdash;</span>';
    const sponsor = SponsorFit.loadProfile();
    const deal = {
      totalProjectCost: p.totalProjectCost || 0,
      returnOnCost: p.returnOnCost || 0,
      loanLTC: p.loanLTC || 0.65,
      dealScore: p.dealScore || 0,
      dealBand: p.dealBand || 'C',
      subsidyGapPerUnit: p.subsidyGapPerUnit || 0
    };
    if (!deal.totalProjectCost && !deal.returnOnCost) return '<span style="color:var(--mid);">&mdash;</span>';
    const result = SponsorFit.computeSponsorFit({ sponsor, deal });
    return SponsorFit.renderFitPill(result.fit);
  }

  function renderTimelineCell(p) {
    if (typeof TimelineClock === 'undefined') return '<span style="color:var(--mid);">&mdash;</span>';
    const aro = p.eligibility ? { eligibility: p.eligibility } : { eligibility: 'conditional' };
    const tl = TimelineClock.estimateTimeline({
      aro,
      neighborhood: p.submarket || '',
      riskSummary: null,
      physical: null
    });
    return TimelineClock.renderTimelinePill(tl);
  }

  function renderNBACell(p) {
    if (typeof NBAEngine === 'undefined') return '';
    const actions = NBAEngine.computeNextBestActions({
      dataReliability: 'Medium',
      dealScoreBand: p.dealBand || 'C',
      timelineRisk: 'Moderate',
      subsidyGapPerUnit: p.subsidyGapPerUnit || 0,
      returnOnCost: p.returnOnCost || 0,
      targetROC: 6.5,
      sponsorFit: 'Medium',
      missingInputs: [],
      estimatedUnits: p.estimatedUnits || 0
    });
    if (!actions || actions.length === 0) return '';
    const tip = NBAEngine.renderNBATooltip(actions);
    return `<span class="nba-icon" title="${tip}" style="cursor:help;font-size:1rem;">\uD83C\uDFAF</span>`;
  }

  function renderRankCell(p) {
    if (typeof InternalComps === 'undefined') return '<span style="color:var(--mid);">&mdash;</span>';
    if (prospectingList.length < 2) return '<span style="color:var(--mid);">&mdash;</span>';
    const comps = InternalComps.computeInternalComps(p, prospectingList);
    return InternalComps.renderRankPill(comps);
  }

  function renderProspectingList() {
    const container = document.getElementById('prospecting-list-items');
    if (!container) return;

    // Render KPI dashboard
    const kpiContainer = document.getElementById('pipeline-kpi');
    if (kpiContainer) kpiContainer.innerHTML = renderKPIDashboard();

    // Render stage summary
    const stageContainer = document.getElementById('pipeline-stage-summary');
    if (stageContainer) stageContainer.innerHTML = renderStageSummary();

    // Render criteria profiles
    const criteriaContainer = document.getElementById('criteria-profiles-container');
    if (criteriaContainer && typeof CriteriaProfiles !== 'undefined') {
      criteriaContainer.innerHTML = CriteriaProfiles.renderProfilesPanel();
    }

    if (prospectingList.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="min-height: 200px;">
          <div class="empty-state-icon">\uD83D\uDCCB</div>
          <h3>No properties in pipeline</h3>
          <p>Use the Map Screener to find and save ARO-eligible properties to your Deal Pipeline.</p>
        </div>
      `;
      return;
    }

    let displayed = applyFilters(prospectingList);

    // Apply criteria profile filter
    if (typeof CriteriaProfiles !== 'undefined') {
      displayed = CriteriaProfiles.filterByActiveCriteria(displayed);
    }

    displayed = applySorting(displayed);

    // Kanban view
    if (viewMode === 'kanban') {
      container.innerHTML = renderKanbanView(displayed);
      if (displayed.length < prospectingList.length) {
        container.innerHTML += `<div style="font-size:0.78rem;color:var(--mid);text-align:center;margin-top:8px;">Showing ${displayed.length} of ${prospectingList.length} properties (filters active)</div>`;
      }
      return;
    }

    // Table view
    const sortIcon = (field) => {
      if (sortField !== field) return '';
      return sortDir === 'desc' ? ' \u25BC' : ' \u25B2';
    };

    let html = `<table class="pipeline-table">
      <thead>
        <tr>
          <th class="sortable" onclick="ExportModule.sortPipeline('address')">Address${sortIcon('address')}</th>
          <th class="sortable" onclick="ExportModule.sortPipeline('dealScore')">Deal Score${sortIcon('dealScore')}</th>
          <th>Stage</th>
          <th class="sortable" onclick="ExportModule.sortPipeline('useDescription')">Use${sortIcon('useDescription')}</th>
          <th class="sortable" onclick="ExportModule.sortPipeline('yearBuilt')">Year${sortIcon('yearBuilt')}</th>
          <th class="sortable" onclick="ExportModule.sortPipeline('sqft')">SF${sortIcon('sqft')}</th>
          <th>Eligibility</th>
          <th>Fit</th>
          <th>Timeline</th>
          <th>NBA</th>
          <th>Rank</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>`;

    displayed.forEach((p, i) => {
      const origIdx = prospectingList.indexOf(p);
      const bc = typeof DealScore !== 'undefined' ? DealScore.bandColor(p.dealBand) : 'conditional';
      const stage = p.stage || 'New';
      const stageColor = STAGE_COLORS[stage] || 'var(--mid)';

      html += `<tr class="pipeline-row" onclick="DealSnapshot.openFromPipeline(ExportModule.getProspectingList()[${origIdx}])">
        <td class="pipeline-address">${p.address}</td>
        <td><span class="pipeline-score-badge ${bc}">${p.dealScore}<span class="pipeline-band">${p.dealBand}</span></span></td>
        <td><select class="stage-pill" style="color:${stageColor};border-color:${stageColor};" onclick="event.stopPropagation();" onchange="ExportModule.setDealStage(${origIdx}, this.value)">
          ${STAGES.map(s => `<option value="${s}" ${s === stage ? 'selected' : ''}>${s}</option>`).join('')}
        </select></td>
        <td class="pipeline-use">${p.useDescription || '\u2014'}</td>
        <td>${p.yearBuilt || '\u2014'}</td>
        <td>${p.sqft ? parseInt(p.sqft).toLocaleString() : '\u2014'}</td>
        <td><span class="chip ${p.eligibility}">${p.eligibility}</span></td>
        <td>${renderFitCell(p)}</td>
        <td>${renderTimelineCell(p)}</td>
        <td>${renderNBACell(p)}</td>
        <td>${renderRankCell(p)}</td>
        <td class="pipeline-actions">
          <button class="btn-sm" onclick="event.stopPropagation();ExportModule.removeFromProspectingList(${origIdx})" title="Remove">\u00D7</button>
        </td>
      </tr>`;
    });

    html += `</tbody></table>`;

    if (displayed.length < prospectingList.length) {
      html += `<div style="font-size:0.78rem;color:var(--mid);text-align:center;margin-top:8px;">Showing ${displayed.length} of ${prospectingList.length} properties (filters active)</div>`;
    }

    container.innerHTML = html;
  }

  function updateProspectingBadge() {
    const badge = document.getElementById('prospect-count');
    if (badge) {
      badge.textContent = prospectingList.length;
    }
  }

  // ─── Enhanced CSV Export ───

  function exportProspectingCSV() {
    if (prospectingList.length === 0) {
      alert('No properties in pipeline to export.');
      return;
    }

    const headers = ['Address', 'AIN', 'Use Type', 'Year Built', 'Building SF', 'Eligibility', 'Opportunity Score', 'Deal Score', 'Deal Band', 'Stage', 'Est. Units', 'Cost/Unit Mid', 'ROC', 'Subsidy Gap/Unit', 'Submarket', 'Sponsor Fit', 'Timeline (mo)', 'Added'];
    const rows = prospectingList.map(p => [
      `"${(p.address || '').replace(/"/g, '""')}"`,
      p.ain || '',
      `"${(p.useDescription || '').replace(/"/g, '""')}"`,
      p.yearBuilt || '',
      p.sqft || '',
      p.eligibility || '',
      p.score || '',
      p.dealScore || '',
      p.dealBand || '',
      p.stage || 'New',
      p.estimatedUnits || '',
      p.costPerUnitMid || '',
      p.returnOnCost ? p.returnOnCost.toFixed(1) : '',
      p.subsidyGapPerUnit ? Math.round(p.subsidyGapPerUnit) : '',
      `"${(p.submarket || '').replace(/"/g, '""')}"`,
      typeof SponsorFit !== 'undefined' && (p.totalProjectCost || p.returnOnCost) ? SponsorFit.computeSponsorFit({ sponsor: SponsorFit.loadProfile(), deal: { totalProjectCost: p.totalProjectCost || 0, returnOnCost: p.returnOnCost || 0, loanLTC: p.loanLTC || 0.65, dealScore: p.dealScore || 0, dealBand: p.dealBand || 'C', subsidyGapPerUnit: p.subsidyGapPerUnit || 0 } }).fit : '',
      typeof TimelineClock !== 'undefined' ? TimelineClock.estimateTimeline({ aro: { eligibility: p.eligibility || 'conditional' }, neighborhood: p.submarket || '', riskSummary: null, physical: null }).expected : '',
      p.addedAt ? p.addedAt.slice(0, 10) : ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => { csv += row.join(',') + '\n'; });

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(`CLS_CRE_Deal_Pipeline_${dateStr}.csv`, csv, 'text/csv');
  }

  // ─── Session Storage ───

  function saveToSession() {
    try {
      sessionStorage.setItem('aro_prospecting_list', JSON.stringify(prospectingList));
    } catch (e) {
      console.warn('Could not save to session storage');
    }
  }

  function loadFromSession() {
    try {
      const saved = sessionStorage.getItem('aro_prospecting_list');
      if (saved) {
        prospectingList = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not load from session storage');
    }
  }

  // ─── Print Report ───

  function printReport() {
    window.print();
  }

  // ─── Utility ───

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getProspectingList() {
    return prospectingList;
  }

  return {
    init,
    exportDealSummary,
    addToProspectingList,
    removeFromProspectingList,
    clearProspectingList,
    renderProspectingList,
    exportProspectingCSV,
    printReport,
    getProspectingList,
    updateProspectingBadge,
    sortPipeline,
    togglePipelineFilter,
    clearPipelineFilters,
    setViewMode,
    setDealStage,
    onKanbanDragStart,
    onKanbanDrop
  };
})();
