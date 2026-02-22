/**
 * Next Best Action (NBA) Engine
 * Commercial Lending Solutions — One concrete next step per deal
 */

const NBAEngine = (() => {

  function fmt(n) {
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(n).toLocaleString();
  }

  function computeNextBestActions({
    dataReliability,
    dealScoreBand,
    timelineRisk,
    subsidyGapPerUnit,
    returnOnCost,
    targetROC,
    sponsorFit,
    missingInputs,
    estimatedUnits
  }) {
    const actions = [];
    const units = estimatedUnits || 0;

    // Missing data — always check first
    if (missingInputs && missingInputs.length > 3) {
      actions.push({
        priority: 1,
        label: 'Complete property data',
        detail: 'Missing: ' + missingInputs.slice(0, 4).join(', ') +
                '. Run Fast Underwrite to apply defaults, then verify.'
      });
    }

    // Strong deal, weak data
    if (dealScoreBand === 'A' && dataReliability === 'Low') {
      actions.push({
        priority: 2,
        label: 'Commission site walk + preliminary study',
        detail: 'High Deal Score but low data confidence. Obtain structural drawings, MEP one-lines, and LADBS permit history. Schedule architect/GC walk.'
      });
    }

    // Near-viable but subsidy gap exists
    if (subsidyGapPerUnit > 0 && subsidyGapPerUnit < 50000 &&
        returnOnCost >= targetROC * 0.85) {
      actions.push({
        priority: 3,
        label: 'Negotiate acquisition price or add affordable units',
        detail: 'Small subsidy gap (' + fmt(subsidyGapPerUnit) + '/unit). Test: (1) price reduction of ' + fmt(subsidyGapPerUnit * units) + ', (2) 25% affordable units for density bonus, (3) HCIDLA gap loan inquiry.'
      });
    }

    // Large subsidy gap
    if (subsidyGapPerUnit >= 50000) {
      actions.push({
        priority: 3,
        label: 'Engage affordable housing consultant',
        detail: 'Gap of ' + fmt(subsidyGapPerUnit) + '/unit suggests LIHTC, CDLAC bonds, or HCIDLA gap funding required. Verify with affordable housing counsel before advancing.'
      });
    }

    // High timeline risk
    if (timelineRisk === 'High') {
      actions.push({
        priority: 4,
        label: 'Schedule pre-application meeting',
        detail: 'High timeline risk. Request pre-app with LA Planning + LADBS. Engage entitlements counsel early. Budget for 30\u201336 month timeline.'
      });
    }

    // Sponsor fit mismatch
    if (sponsorFit === 'Low') {
      actions.push({
        priority: 5,
        label: 'Review sponsor mandate or deal structure',
        detail: 'Deal does not match current Sponsor Profile. Consider adjusting capital stack, bringing in a JV partner, or targeting a different investor for this asset type.'
      });
    }

    // Band A, good data, no subsidy — advance the deal
    if (dealScoreBand === 'A' && dataReliability !== 'Low' &&
        subsidyGapPerUnit === 0 && sponsorFit === 'High') {
      actions.push({
        priority: 6,
        label: 'Advance to IC \u2014 prepare LOI and lender pre-qualification',
        detail: 'Strong deal across all dimensions. Draft LOI, begin lender outreach, and commission architect feasibility study.'
      });
    }

    // Return top 3 by priority
    return actions.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }

  // ─── Compute from current Tab 3 state ───

  function computeFromState() {
    if (typeof FeasibilityTab === 'undefined') return [];
    const state = FeasibilityTab.getState ? FeasibilityTab.getState() : null;
    if (!state) return [];

    const pf = state.proFormaResult;
    const pre = state.prePopulatedData;

    // Data reliability
    let dataReliability = 'Medium';
    if (typeof FeasibilityTab.getState === 'function') {
      const drEl = document.querySelector('.dr-level');
      if (drEl) {
        const txt = drEl.textContent || '';
        if (txt.includes('Low')) dataReliability = 'Low';
        else if (txt.includes('High')) dataReliability = 'High';
      }
    }

    // Deal score band
    let dealScoreBand = 'C';
    if (typeof DealScore !== 'undefined' && state.physicalResult) {
      const totalUnits = state.yieldResult ? (state.yieldResult.base.total + state.yieldResult.parkingBonusUnits) : 0;
      const cpuMid = state.costResult ? Math.round((state.costResult.costPerUnit.low + state.costResult.costPerUnit.high) / 2) : 0;
      const aro = pre && pre.yearBuilt ? AROScoring.getEligibility(parseInt(pre.yearBuilt), pre.useType || '', pre.neighborhood || '') : null;
      const ds = DealScore.computeDealScore({
        aro: { eligibility: aro ? aro.status : 'ineligible' },
        physical: { totalScore: state.physicalResult.gensler.total },
        yieldBase: totalUnits,
        costs: { costPerUnitMid: cpuMid },
        proforma: { returnOnCost: pf ? pf.returnOnCost : 0 },
        subsidyGap: { subsidyPerUnit: 0 }
      });
      dealScoreBand = ds.band;
    }

    // Timeline risk
    let timelineRisk = 'Moderate';
    if (typeof TimelineClock !== 'undefined') {
      const tl = TimelineClock.computeFromState();
      if (tl) timelineRisk = tl.riskLabel;
    }

    // Subsidy gap
    const totalUnits = state.yieldResult ? (state.yieldResult.base.total + state.yieldResult.parkingBonusUnits) : 0;
    const targetROC = parseFloat((document.getElementById('m4-target-roc') || {}).value) || 6.5;
    let subsidyGapPerUnit = 0;
    if (pf && pf.totalProjectCost > 0) {
      const requiredCost = pf.noi / (targetROC / 100);
      const gap = Math.max(0, pf.totalProjectCost - requiredCost);
      subsidyGapPerUnit = totalUnits > 0 ? gap / totalUnits : 0;
    }

    // Sponsor fit
    let sponsorFit = 'Medium';
    if (typeof SponsorFit !== 'undefined') {
      const sf = SponsorFit.computeFromState();
      if (sf) sponsorFit = sf.fit;
    }

    // Missing inputs
    const missingInputs = [];
    const checks = [
      ['buildingSF', 'm1-building-sf'],
      ['yearBuilt', 'm1-year-built'],
      ['stories', 'm1-stories'],
      ['floorplate', 'm1-floorplate-sf'],
      ['rents', 'm4-rent-studio'],
      ['capRate', 'm4-cap-rate'],
      ['acqPrice', 'm4-acquisition-price']
    ];
    checks.forEach(([name, id]) => {
      const el = document.getElementById(id);
      if (!el || !el.value) missingInputs.push(name);
    });

    return computeNextBestActions({
      dataReliability,
      dealScoreBand,
      timelineRisk,
      subsidyGapPerUnit,
      returnOnCost: pf ? pf.returnOnCost : 0,
      targetROC,
      sponsorFit,
      missingInputs,
      estimatedUnits: totalUnits
    });
  }

  // ─── Render Helpers ───

  function renderNBABlock(actions) {
    if (!actions || actions.length === 0) return '';
    let html = `<div class="nba-block" style="margin:12px 0;">
      <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--mid);font-weight:700;margin-bottom:8px;">Next Best Actions</div>`;
    actions.forEach((a, i) => {
      html += `<div style="display:flex;gap:10px;padding:8px 12px;background:var(--cream);border:1px solid var(--rule);border-radius:2px;margin-bottom:6px;">
        <div style="font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;color:var(--gold);min-width:20px;">${i + 1}.</div>
        <div>
          <div style="font-weight:700;font-size:0.85rem;color:var(--ink);margin-bottom:2px;">${a.label}</div>
          <div style="font-size:0.78rem;color:var(--slate);line-height:1.5;">${a.detail}</div>
        </div>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  function renderNBATooltip(actions) {
    if (!actions || actions.length === 0) return '';
    return actions[0].label;
  }

  return {
    computeNextBestActions,
    computeFromState,
    renderNBABlock,
    renderNBATooltip
  };
})();
