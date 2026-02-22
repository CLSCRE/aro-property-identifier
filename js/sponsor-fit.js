/**
 * Sponsor Fit Score
 * Commercial Lending Solutions — How well does this deal match your investor's mandate?
 */

const SponsorFit = (() => {
  const STORAGE_KEY = 'aro_sponsor_profile';

  const defaultSponsorProfile = {
    name:            'Default Sponsor',
    targetHoldYears: 5,
    riskTolerance:   'value-add',
    minDealSize:     5000000,
    maxDealSize:     80000000,
    minROC:          6.0,
    maxLeverage:     0.75
  };

  function loadProfile() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return { ...defaultSponsorProfile };
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) { /* ignore */ }
  }

  function resetToDefaults() {
    const profile = { ...defaultSponsorProfile };
    saveProfile(profile);
    fillPanelFromProfile(profile);
    return profile;
  }

  function saveFromPanel() {
    const profile = {
      name:            (document.getElementById('sp-name') || {}).value || 'Default Sponsor',
      targetHoldYears: parseFloat((document.getElementById('sp-hold') || {}).value) || 5,
      riskTolerance:   (document.getElementById('sp-risk') || {}).value || 'value-add',
      minDealSize:     parseFloat((document.getElementById('sp-min-size') || {}).value) || 5000000,
      maxDealSize:     parseFloat((document.getElementById('sp-max-size') || {}).value) || 80000000,
      minROC:          parseFloat((document.getElementById('sp-min-roc') || {}).value) || 6.0,
      maxLeverage:     parseFloat((document.getElementById('sp-max-ltc') || {}).value) / 100 || 0.75
    };
    saveProfile(profile);
    return profile;
  }

  function fillPanelFromProfile(profile) {
    const el = (id) => document.getElementById(id);
    if (el('sp-name'))     el('sp-name').value     = profile.name;
    if (el('sp-hold'))     el('sp-hold').value     = profile.targetHoldYears;
    if (el('sp-risk'))     el('sp-risk').value     = profile.riskTolerance;
    if (el('sp-min-size')) el('sp-min-size').value  = profile.minDealSize;
    if (el('sp-max-size')) el('sp-max-size').value  = profile.maxDealSize;
    if (el('sp-min-roc'))  el('sp-min-roc').value   = profile.minROC;
    if (el('sp-max-ltc'))  el('sp-max-ltc').value   = Math.round(profile.maxLeverage * 100);
  }

  function initPanel() {
    const profile = loadProfile();
    fillPanelFromProfile(profile);
  }

  // ─── Sponsor Fit Computation ───

  function fmt(n) {
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(n).toLocaleString();
  }

  function computeSponsorFit({ sponsor, deal }) {
    const reasons = [];
    let points = 0;

    // Deal size check
    const inSizeRange = deal.totalProjectCost >= sponsor.minDealSize &&
                        deal.totalProjectCost <= sponsor.maxDealSize;
    if (inSizeRange) {
      points += 30;
      reasons.push('Deal size within mandate');
    } else if (deal.totalProjectCost < sponsor.minDealSize) {
      reasons.push('Below minimum deal size (' + fmt(sponsor.minDealSize) + ')');
    } else {
      reasons.push('Exceeds maximum deal size (' + fmt(sponsor.maxDealSize) + ')');
    }

    // ROC check
    if (deal.returnOnCost >= sponsor.minROC) {
      points += 30;
      reasons.push('ROC ' + deal.returnOnCost.toFixed(1) + '% meets ' + sponsor.minROC + '% target');
    } else {
      reasons.push('ROC ' + deal.returnOnCost.toFixed(1) + '% below ' + sponsor.minROC + '% target');
    }

    // Leverage check
    if (deal.loanLTC <= sponsor.maxLeverage) {
      points += 20;
      reasons.push('Leverage ' + (deal.loanLTC * 100).toFixed(0) + '% within ' + (sponsor.maxLeverage * 100).toFixed(0) + '% limit');
    } else {
      reasons.push('Leverage ' + (deal.loanLTC * 100).toFixed(0) + '% exceeds ' + (sponsor.maxLeverage * 100).toFixed(0) + '% limit');
    }

    // Risk tolerance vs deal band
    const riskMap = { 'core': 'C', 'core-plus': 'B', 'value-add': 'B', 'opportunistic': 'A' };
    const minAcceptableBand = riskMap[sponsor.riskTolerance] || 'B';
    const bandOrder = { 'A': 3, 'B': 2, 'C': 1 };
    if (bandOrder[deal.dealBand] >= bandOrder[minAcceptableBand]) {
      points += 20;
      reasons.push('Deal Band ' + deal.dealBand + ' compatible with ' + sponsor.riskTolerance + ' mandate');
    } else {
      reasons.push('Deal complexity may exceed ' + sponsor.riskTolerance + ' risk tolerance');
    }

    const fit = points >= 80 ? 'High' : points >= 50 ? 'Medium' : 'Low';
    return { fit, points, reasons };
  }

  // ─── Compute from current Tab 3 state ───

  function computeFromState() {
    if (typeof FeasibilityTab === 'undefined') return null;
    const state = FeasibilityTab.getState ? FeasibilityTab.getState() : null;
    if (!state || !state.proFormaResult) return null;

    const sponsor = loadProfile();
    const pf = state.proFormaResult;

    const deal = {
      totalProjectCost: pf.totalProjectCost || 0,
      returnOnCost:     pf.returnOnCost || 0,
      loanLTC:          pf.loanLTC || pf.ltc || 0.65,
      dealScore:        0,
      dealBand:         'C',
      subsidyGapPerUnit: 0
    };

    // Get deal score
    if (typeof DealScore !== 'undefined') {
      const ds = DealScore.computeDealScore({
        aro: { eligibility: state.prePopulatedData ? 'eligible' : 'ineligible' },
        physical: { totalScore: state.physicalResult ? state.physicalResult.gensler.total : 0 },
        yieldBase: state.yieldResult ? (state.yieldResult.base.total + state.yieldResult.parkingBonusUnits) : 0,
        costs: { costPerUnitMid: state.costResult ? Math.round((state.costResult.costPerUnit.low + state.costResult.costPerUnit.high) / 2) : 0 },
        proforma: { returnOnCost: pf.returnOnCost || 0 },
        subsidyGap: { subsidyPerUnit: 0 }
      });
      deal.dealScore = ds.score;
      deal.dealBand = ds.band;
    }

    return computeSponsorFit({ sponsor, deal });
  }

  // ─── Render Helpers ───

  function fitColor(fit) {
    if (fit === 'High') return 'eligible';
    if (fit === 'Medium') return 'conditional';
    return 'ineligible';
  }

  function renderSponsorFitBlock(result) {
    if (!result) return '';
    const color = fitColor(result.fit);
    let html = `<div class="sponsor-fit-block" style="padding:12px 16px;border-radius:4px;background:var(--${color}-bg);border:1px solid var(--${color});margin:12px 0;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--${color});font-weight:700;">Sponsor Fit</span>
        <span style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;color:var(--${color});">${result.fit}</span>
        <span style="font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--${color});">(${result.points}/100)</span>
      </div>
      <ul style="list-style:none;margin:0;padding:0;">`;
    result.reasons.slice(0, 2).forEach(r => {
      html += `<li style="font-size:0.8rem;color:var(--slate);padding:2px 0 2px 14px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:var(--${color});font-weight:700;">&bull;</span>${r}</li>`;
    });
    html += `</ul></div>`;
    return html;
  }

  function renderFitPill(fit) {
    if (!fit) return '<span style="color:var(--mid);">&mdash;</span>';
    const letter = fit.charAt(0);
    const color = fitColor(fit);
    return `<span class="fit-pill" style="display:inline-block;padding:2px 8px;border-radius:2px;font-size:0.72rem;font-weight:700;font-family:'DM Mono',monospace;background:var(--${color}-bg);color:var(--${color});border:1px solid var(--${color});">${letter}</span>`;
  }

  // ─── Toggle Panel ───

  function togglePanel() {
    const panel = document.getElementById('sponsor-profile-panel');
    if (!panel) return;
    const content = panel.querySelector('.sponsor-panel-content');
    if (!content) return;
    const isCollapsed = content.style.display === 'none';
    content.style.display = isCollapsed ? '' : 'none';
    const chevron = panel.querySelector('.sp-chevron');
    if (chevron) chevron.textContent = isCollapsed ? '\u25BC' : '\u25B6';
  }

  return {
    loadProfile,
    saveProfile,
    resetToDefaults,
    saveFromPanel,
    initPanel,
    computeSponsorFit,
    computeFromState,
    fitColor,
    renderSponsorFitBlock,
    renderFitPill,
    togglePanel,
    fmt
  };
})();
