/**
 * Investment Criteria Profiles — save thesis, auto-match pipeline deals
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const CriteriaProfiles = (() => {

  const STORAGE_KEY = 'aro_criteria_profiles';
  const ACTIVE_KEY = 'aro_active_criteria';

  function loadProfiles() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveProfiles(profiles) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); } catch (e) {}
  }

  function getActiveProfileId() {
    return localStorage.getItem(ACTIVE_KEY) || null;
  }

  function setActiveProfile(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }

  function getActiveProfile() {
    const id = getActiveProfileId();
    if (!id) return null;
    return loadProfiles().find(p => p.id === id) || null;
  }

  /**
   * Create a new criteria profile
   * @param {Object} criteria - { name, minScore, minROC, maxCostPerUnit, maxSubsidyGap, useTypes[], minUnits, maxUnits }
   */
  function createProfile(criteria) {
    const profiles = loadProfiles();
    const profile = {
      id: 'cp_' + Date.now(),
      name: criteria.name || 'Untitled Profile',
      minScore: criteria.minScore || 0,
      minROC: criteria.minROC || 0,
      maxCostPerUnit: criteria.maxCostPerUnit || 0,
      maxSubsidyGap: criteria.maxSubsidyGap || 0,
      useTypes: criteria.useTypes || [],
      minUnits: criteria.minUnits || 0,
      maxUnits: criteria.maxUnits || 0,
      createdAt: new Date().toISOString()
    };
    profiles.push(profile);
    saveProfiles(profiles);
    return profile;
  }

  function deleteProfile(id) {
    let profiles = loadProfiles();
    profiles = profiles.filter(p => p.id !== id);
    saveProfiles(profiles);
    if (getActiveProfileId() === id) setActiveProfile(null);
  }

  /**
   * Match a single deal against a criteria profile (AND logic)
   * @returns {boolean}
   */
  function matchesCriteria(deal, profile) {
    if (!profile) return true;

    if (profile.minScore > 0 && (deal.dealScore || 0) < profile.minScore) return false;
    if (profile.minROC > 0 && (deal.returnOnCost || 0) < profile.minROC) return false;
    if (profile.maxCostPerUnit > 0 && deal.costPerUnitMid && deal.costPerUnitMid > profile.maxCostPerUnit) return false;
    if (profile.maxSubsidyGap > 0 && deal.subsidyGapPerUnit && deal.subsidyGapPerUnit > profile.maxSubsidyGap) return false;
    if (profile.minUnits > 0 && (deal.estimatedUnits || 0) < profile.minUnits) return false;
    if (profile.maxUnits > 0 && deal.estimatedUnits && deal.estimatedUnits > profile.maxUnits) return false;

    if (profile.useTypes && profile.useTypes.length > 0) {
      const useDesc = (deal.useDescription || '').toLowerCase();
      const matches = profile.useTypes.some(t => useDesc.includes(t.toLowerCase()));
      if (!matches) return false;
    }

    return true;
  }

  /**
   * Filter pipeline deals by active criteria profile
   */
  function filterByActiveCriteria(deals) {
    const profile = getActiveProfile();
    if (!profile) return deals;
    return deals.filter(d => matchesCriteria(d, profile));
  }

  /**
   * Count matches for each profile against a deal list
   */
  function countMatches(deals) {
    const profiles = loadProfiles();
    return profiles.map(p => ({
      id: p.id,
      name: p.name,
      matchCount: deals.filter(d => matchesCriteria(d, p)).length
    }));
  }

  /**
   * Render criteria profiles panel HTML
   */
  function renderProfilesPanel() {
    const profiles = loadProfiles();
    const activeId = getActiveProfileId();
    const pipeline = typeof ExportModule !== 'undefined' ? ExportModule.getProspectingList() : [];

    let html = '<div class="criteria-profiles-section">';
    html += '<div class="criteria-header">';
    html += '<div style="font-family:\'DM Mono\',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--mid);font-weight:700;">Investment Criteria Profiles</div>';
    html += '<button class="btn-sm-gold" onclick="CriteriaProfiles.openCreateModal()">+ New Profile</button>';
    html += '</div>';

    if (profiles.length === 0) {
      html += '<div style="font-size:0.82rem;color:var(--mid);padding:12px 0;">No criteria profiles yet. Create one to auto-filter your pipeline.</div>';
    } else {
      profiles.forEach(p => {
        const isActive = p.id === activeId;
        const matchCount = pipeline.filter(d => matchesCriteria(d, p)).length;
        const criteriaChips = [];
        if (p.minScore > 0) criteriaChips.push('Score \u2265 ' + p.minScore);
        if (p.minROC > 0) criteriaChips.push('ROC \u2265 ' + p.minROC + '%');
        if (p.maxCostPerUnit > 0) criteriaChips.push('CPU \u2264 $' + Math.round(p.maxCostPerUnit / 1000) + 'K');
        if (p.maxSubsidyGap > 0) criteriaChips.push('Gap \u2264 $' + Math.round(p.maxSubsidyGap / 1000) + 'K');
        if (p.minUnits > 0) criteriaChips.push('Units \u2265 ' + p.minUnits);
        if (p.useTypes && p.useTypes.length > 0) criteriaChips.push(p.useTypes.join(', '));

        html += `<div class="criteria-card ${isActive ? 'active' : ''}">
          <div class="criteria-card-top">
            <div class="criteria-card-name">${p.name}</div>
            <div class="criteria-card-match">${matchCount} match${matchCount !== 1 ? 'es' : ''}</div>
          </div>
          <div class="criteria-chips">${criteriaChips.map(c => '<span class="criteria-chip">' + c + '</span>').join('')}</div>
          <div class="criteria-card-actions">
            <button class="${isActive ? 'btn-sm-active' : 'btn-sm-gold'}" onclick="CriteriaProfiles.toggleActive('${p.id}')">${isActive ? 'Active \u2713' : 'Apply'}</button>
            <button class="btn-sm-outline" onclick="CriteriaProfiles.deleteProfile('${p.id}');CriteriaProfiles.renderAndRefresh()">\u00D7</button>
          </div>
        </div>`;
      });
    }

    html += '</div>';
    return html;
  }

  function toggleActive(id) {
    const current = getActiveProfileId();
    if (current === id) {
      setActiveProfile(null);
    } else {
      setActiveProfile(id);
    }
    renderAndRefresh();
  }

  function renderAndRefresh() {
    const container = document.getElementById('criteria-profiles-container');
    if (container) container.innerHTML = renderProfilesPanel();
    if (typeof ExportModule !== 'undefined') ExportModule.renderProspectingList();
  }

  /**
   * Open create profile modal
   */
  function openCreateModal() {
    let overlay = document.getElementById('criteria-modal-overlay');
    if (overlay) { overlay.style.display = 'flex'; return; }

    overlay = document.createElement('div');
    overlay.id = 'criteria-modal-overlay';
    overlay.className = 'criteria-modal-overlay';
    overlay.innerHTML = `
      <div class="criteria-modal">
        <div style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;color:var(--ink);margin-bottom:16px;">New Investment Criteria Profile</div>
        <div class="m-form-grid" style="gap:12px;">
          <div class="m-form-group full-width">
            <label>Profile Name</label>
            <input type="text" id="cp-name" placeholder="e.g., Core Conversion Target">
          </div>
          <div class="m-form-group">
            <label>Min Deal Score</label>
            <input type="number" id="cp-min-score" placeholder="e.g., 60" min="0" max="100">
          </div>
          <div class="m-form-group">
            <label>Min ROC (%)</label>
            <input type="number" id="cp-min-roc" placeholder="e.g., 6.5" step="0.5" min="0">
          </div>
          <div class="m-form-group">
            <label>Max Cost/Unit ($)</label>
            <input type="number" id="cp-max-cpu" placeholder="e.g., 300000" min="0">
          </div>
          <div class="m-form-group">
            <label>Max Subsidy Gap/Unit ($)</label>
            <input type="number" id="cp-max-gap" placeholder="e.g., 50000" min="0">
          </div>
          <div class="m-form-group">
            <label>Min Units</label>
            <input type="number" id="cp-min-units" placeholder="e.g., 50" min="0">
          </div>
          <div class="m-form-group">
            <label>Max Units</label>
            <input type="number" id="cp-max-units" placeholder="e.g., 200" min="0">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button class="btn-gold" style="flex:1;" onclick="CriteriaProfiles.saveFromModal()">Save Profile</button>
          <button class="btn-outline" style="flex:1;margin-top:0;" onclick="CriteriaProfiles.closeCreateModal()">Cancel</button>
        </div>
      </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCreateModal(); });
    document.body.appendChild(overlay);
  }

  function closeCreateModal() {
    const overlay = document.getElementById('criteria-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function saveFromModal() {
    const name = document.getElementById('cp-name').value.trim();
    if (!name) { alert('Please enter a profile name.'); return; }

    createProfile({
      name,
      minScore: parseFloat(document.getElementById('cp-min-score').value) || 0,
      minROC: parseFloat(document.getElementById('cp-min-roc').value) || 0,
      maxCostPerUnit: parseFloat(document.getElementById('cp-max-cpu').value) || 0,
      maxSubsidyGap: parseFloat(document.getElementById('cp-max-gap').value) || 0,
      minUnits: parseInt(document.getElementById('cp-min-units').value) || 0,
      maxUnits: parseInt(document.getElementById('cp-max-units').value) || 0,
      useTypes: []
    });

    closeCreateModal();
    renderAndRefresh();
  }

  return {
    loadProfiles,
    createProfile,
    deleteProfile,
    matchesCriteria,
    filterByActiveCriteria,
    countMatches,
    getActiveProfile,
    getActiveProfileId,
    setActiveProfile,
    toggleActive,
    renderProfilesPanel,
    renderAndRefresh,
    openCreateModal,
    closeCreateModal,
    saveFromModal
  };
})();
