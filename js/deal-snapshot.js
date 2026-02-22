/**
 * 90-Second Deal Snapshot Panel
 * Commercial Lending Solutions — slide-in panel for rapid deal assessment
 */

const DealSnapshot = (() => {
  let currentData = null;

  function open(data) {
    currentData = data;
    const panel = document.getElementById('snapshot-panel');
    const overlay = document.getElementById('snapshot-overlay');
    const body = document.getElementById('snapshot-body');
    if (!panel || !body) return;

    body.innerHTML = renderContent(data);
    overlay.style.display = 'block';
    panel.style.display = 'flex';
    setTimeout(() => {
      panel.classList.add('open');
      overlay.classList.add('open');
    }, 10);
  }

  function close() {
    const panel = document.getElementById('snapshot-panel');
    const overlay = document.getElementById('snapshot-overlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    setTimeout(() => {
      if (panel) panel.style.display = 'none';
      if (overlay) overlay.style.display = 'none';
    }, 300);
  }

  function renderContent(d) {
    const address = d.address || 'Unknown Property';
    const score = d.dealScore || 0;
    const band = d.dealBand || 'C';
    const commentary = d.dealCommentary || '';
    const bc = DealScore.bandColor(band);

    let html = `
      <div style="margin-bottom:16px;">
        <div style="font-family:'Playfair Display',serif;font-size:1.15rem;font-weight:700;color:var(--ink);line-height:1.3;">${address}</div>
      </div>
      <div style="text-align:center;padding:16px;border-radius:10px;background:var(--${bc}-bg);border:1px solid var(--${bc});margin-bottom:16px;">
        <div style="font-family:'DM Mono',monospace;font-size:0.65rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--${bc});font-weight:700;">Deal Score</div>
        <div style="font-family:'Playfair Display',serif;font-size:2rem;font-weight:800;color:var(--${bc});">${score}/100</div>
        <div style="font-family:'DM Mono',monospace;font-size:0.82rem;font-weight:700;color:var(--${bc});">Band ${band}</div>
        <div style="font-size:0.78rem;color:var(--slate);margin-top:2px;">${commentary}</div>
      </div>`;

    // Score breakdown (explainable components)
    if (d.dealComponents && d.dealComponents.length > 0 && typeof DealScore !== 'undefined' && DealScore.renderScoreBreakdown) {
      html += DealScore.renderScoreBreakdown(d.dealComponents);
    }

    // Key metrics
    const metrics = [
      { label: 'ARO PATH', value: d.aroPath || 'Unknown' },
      { label: 'EST. UNITS', value: d.estimatedUnits ? d.estimatedUnits + ' units (base case)' : '\u2014' },
      { label: 'COST/UNIT', value: d.costPerUnitRange || '\u2014' },
      { label: 'ROC', value: d.returnOnCost ? d.returnOnCost.toFixed(1) + '%' + (d.returnOnCost >= 6.5 ? ' \u2713 meets target' : '') : '\u2014' },
      { label: 'SUBSIDY GAP', value: d.subsidyGapPerUnit ? (d.subsidyGapPerUnit <= 0 ? 'None required' : '$' + Math.round(d.subsidyGapPerUnit).toLocaleString() + '/unit') : '\u2014' }
    ];

    html += '<div style="margin-bottom:16px;">';
    metrics.forEach(m => {
      html += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(13,13,13,0.06);font-size:0.85rem;">
        <span style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--mid);font-weight:600;">${m.label}</span>
        <span style="font-weight:600;color:var(--ink);">${m.value}</span>
      </div>`;
    });
    html += '</div>';

    // Deal Angles (top 3)
    if (d.dealAngles && d.dealAngles.length > 0) {
      html += `<div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--mid);font-weight:700;margin-bottom:8px;">Deal Angles</div>
        <ul style="list-style:none;margin:0 0 16px;padding:0;">`;
      d.dealAngles.slice(0, 3).forEach(a => {
        html += `<li style="font-size:0.82rem;color:var(--slate);padding:4px 0 4px 16px;position:relative;line-height:1.4;"><span style="position:absolute;left:0;color:var(--gold);font-weight:700;">\u2022</span>${a.title}</li>`;
      });
      html += '</ul>';
    }

    // Sponsor Fit (Phase 7)
    if (typeof SponsorFit !== 'undefined' && d.sponsorFit) {
      html += SponsorFit.renderSponsorFitBlock(d.sponsorFit);
    } else if (typeof SponsorFit !== 'undefined' && d.totalProjectCost) {
      const sponsor = SponsorFit.loadProfile();
      const sfResult = SponsorFit.computeSponsorFit({
        sponsor,
        deal: {
          totalProjectCost: d.totalProjectCost || 0,
          returnOnCost: d.returnOnCost || 0,
          loanLTC: d.loanLTC || 0.65,
          dealScore: score,
          dealBand: band,
          subsidyGapPerUnit: d.subsidyGapPerUnit || 0
        }
      });
      html += SponsorFit.renderSponsorFitBlock(sfResult);
    }

    // Internal Comps (Phase 7)
    if (typeof InternalComps !== 'undefined' && typeof ExportModule !== 'undefined') {
      const pipeline = ExportModule.getProspectingList();
      if (pipeline.length >= 2) {
        const dealForComps = {
          address: d.address,
          submarket: d.submarket || '',
          useDescription: d.useType || '',
          sqft: d.buildingSF || 0,
          dealScore: score,
          returnOnCost: d.returnOnCost || null,
          costPerUnitMid: d.costPerUnitMid || null
        };
        const compsResult = InternalComps.computeInternalComps(dealForComps, pipeline);
        if (compsResult) {
          html += InternalComps.renderCompsBlock(compsResult, dealForComps);
          if (compsResult.compCount) {
            html += `<div style="font-size:0.72rem;color:var(--mid);margin:-8px 0 12px;text-align:center;">(vs. ${compsResult.compCount} comparable deals in pipeline)</div>`;
          }
        }
      }
    }

    // Verdict
    const verdicts = {
      A: 'Strong deal \u2014 recommend advancing to architect feasibility study and lender pre-qualification.',
      B: 'Viable with right structure \u2014 price sensitivity or subsidy strategy needed before advancing.',
      C: 'Significant challenges \u2014 confirm physical viability and ownership motivation before committing time.'
    };
    html += `<div style="padding:14px 16px;border-radius:8px;background:var(--${bc}-bg);border:1px solid var(--${bc});margin-bottom:16px;">
      <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--${bc});font-weight:700;margin-bottom:4px;">Verdict</div>
      <div style="font-size:0.82rem;color:var(--slate);line-height:1.5;">${verdicts[band] || verdicts.C}</div>
    </div>`;

    // Action buttons
    html += `<div style="display:flex;gap:8px;">
      <button class="btn-primary" style="flex:1;font-size:0.82rem;padding:10px;" onclick="DealSnapshot.openFullAnalysis()">Open Full Analysis \u2192</button>
      <button class="btn-gold" style="flex:1;font-size:0.82rem;padding:10px;" onclick="DealSnapshot.saveToPipeline()">Save to Pipeline</button>
    </div>`;

    return html;
  }

  function openFromReport() {
    const data = buildFromFeasibility();
    if (data) open(data);
  }

  function openFromPipeline(pipelineItem) {
    const data = {
      address: pipelineItem.address,
      dealScore: pipelineItem.dealScore || 0,
      dealBand: pipelineItem.dealBand || 'C',
      dealCommentary: pipelineItem.dealCommentary || '',
      dealComponents: pipelineItem.dealComponents || [],
      aroPath: pipelineItem.verdict || 'Unknown',
      estimatedUnits: pipelineItem.estimatedUnits,
      costPerUnitRange: pipelineItem.costPerUnitMid ? '$' + Math.round(pipelineItem.costPerUnitMid).toLocaleString() : null,
      returnOnCost: pipelineItem.returnOnCost,
      subsidyGapPerUnit: pipelineItem.subsidyGapPerUnit,
      dealAngles: [],
      raw: pipelineItem
    };
    open(data);
  }

  function openFromParcel(parcel) {
    const aroScore = DealScore.computeAROScore(parcel);
    const eligibility = typeof AROScoring !== 'undefined' ? AROScoring.getEligibility(parseInt(parcel.yearBuilt || parcel.effectiveyearbuilt) || 2026, parcel.useDescription || '', '') : null;
    const angles = typeof AROScoring !== 'undefined' && eligibility ? AROScoring.getDealAngles({
      yearBuilt: parcel.yearBuilt || parcel.effectiveyearbuilt,
      useType: parcel.useDescription || '',
      buildingSF: parcel.sqft || parcel.sqftmain,
      vacancyRate: 'Unknown'
    }, eligibility) : [];

    open({
      address: parcel.address || 'Unknown',
      dealScore: aroScore.score,
      dealBand: aroScore.band,
      dealCommentary: aroScore.commentary,
      dealComponents: aroScore.components || [],
      aroPath: eligibility ? eligibility.verdict : 'Unknown',
      estimatedUnits: null,
      costPerUnitRange: null,
      returnOnCost: null,
      subsidyGapPerUnit: null,
      dealAngles: angles,
      raw: parcel
    });
  }

  function buildFromFeasibility() {
    if (typeof FeasibilityTab === 'undefined') return null;
    const state = FeasibilityTab.getState ? FeasibilityTab.getState() : null;
    if (!state) return null;

    const pf = state.proFormaResult;
    const y = state.yieldResult;
    const c = state.costResult;
    const p = state.physicalResult;
    const pre = state.prePopulatedData;

    const totalUnits = y ? (y.base.total + y.parkingBonusUnits) : 0;
    const cpuMid = c ? Math.round((c.costPerUnit.low + c.costPerUnit.high) / 2) : 0;

    const aro = pre && pre.yearBuilt ? AROScoring.getEligibility(parseInt(pre.yearBuilt), pre.useType || '', pre.neighborhood || '') : null;
    const targetROC = parseFloat(document.getElementById('m4-target-roc') ? document.getElementById('m4-target-roc').value : 6.5) || 6.5;

    let subsidyPerUnit = 0;
    if (pf && pf.totalProjectCost > 0) {
      const requiredCost = pf.noi / (targetROC / 100);
      const gap = Math.max(0, pf.totalProjectCost - requiredCost);
      subsidyPerUnit = totalUnits > 0 ? gap / totalUnits : 0;
    }

    const ds = DealScore.computeDealScore({
      aro: { eligibility: aro ? aro.status : 'ineligible' },
      physical: { totalScore: p ? p.gensler.total : 0 },
      yieldBase: totalUnits,
      costs: { costPerUnitMid: cpuMid },
      proforma: { returnOnCost: pf ? pf.returnOnCost : 0 },
      subsidyGap: { subsidyPerUnit }
    });

    const angles = pre && aro ? AROScoring.getDealAngles(pre, aro) : [];

    return {
      address: pre ? (pre.address || 'Subject Property') : 'Subject Property',
      dealScore: ds.score,
      dealBand: ds.band,
      dealCommentary: ds.commentary,
      dealComponents: ds.components || [],
      aroPath: aro ? aro.verdict : 'Unknown',
      estimatedUnits: totalUnits || null,
      costPerUnitRange: c ? '$' + Math.round(c.costPerUnit.low).toLocaleString() + ' \u2013 $' + Math.round(c.costPerUnit.high).toLocaleString() : null,
      returnOnCost: pf ? pf.returnOnCost : null,
      subsidyGapPerUnit: subsidyPerUnit,
      dealAngles: angles,
      raw: pre
    };
  }

  function openFullAnalysis() {
    close();
    if (currentData && currentData.raw) {
      if (typeof FeasibilityTab !== 'undefined' && currentData.raw.address) {
        FeasibilityTab.prePopulateFromParcel(currentData.raw);
      }
    }
  }

  function saveToPipeline() {
    if (!currentData) return;
    const parcel = currentData.raw || {};
    ExportModule.addToProspectingList({
      address: currentData.address || parcel.address,
      ain: parcel.ain || '',
      useDescription: parcel.useDescription || parcel.useType || '',
      yearBuilt: parcel.yearBuilt || parcel.effectiveyearbuilt || '',
      sqft: parcel.sqft || parcel.sqftmain || parcel.buildingSF || '',
      lat: parcel.lat,
      lng: parcel.lng,
      raw: parcel,
      dealScore: currentData.dealScore,
      dealBand: currentData.dealBand,
      dealCommentary: currentData.dealCommentary,
      estimatedUnits: currentData.estimatedUnits,
      costPerUnitMid: null,
      returnOnCost: currentData.returnOnCost,
      subsidyGapPerUnit: currentData.subsidyGapPerUnit,
      submarket: parcel.neighborhood || ''
    });
    close();
  }

  return { open, close, openFromReport, openFromPipeline, openFromParcel, openFullAnalysis, saveToPipeline, buildFromFeasibility };
})();
