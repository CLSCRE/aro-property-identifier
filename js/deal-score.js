/**
 * Commercial Lending Solutions Deal Score — Composite 0-100 scoring engine
 * Aggregates ARO eligibility, physical, yield, cost, ROC, and subsidy gap
 * Returns explainable components array for each scoring factor
 */

const DealScore = (() => {

  function computeDealScore({ aro, physical, yieldBase, costs, proforma, subsidyGap }) {
    let score = 0;
    const components = [];

    // ARO ELIGIBILITY (max 20 pts)
    let aroPts = 0, aroDir = 'neutral', aroReason = '';
    if (aro && aro.eligibility === 'eligible') {
      aroPts = 20; aroDir = 'positive';
      aroReason = 'By-right eligible \u2014 no discretionary review required.';
    } else if (aro && aro.eligibility === 'conditional') {
      aroPts = 10; aroDir = 'neutral';
      aroReason = 'Conditional eligibility \u2014 may require discretionary review.';
    } else {
      aroPts = 0; aroDir = 'negative';
      aroReason = 'Not ARO eligible \u2014 standard entitlement process required.';
    }
    score += aroPts;
    components.push({ name: 'ARO Eligibility', contribution: aroPts, max: 20, direction: aroDir, reason: aroReason });

    // PHYSICAL VIABILITY (max 20 pts)
    let physPts = 0, physDir = 'neutral', physReason = '';
    if (physical && physical.totalScore > 0) {
      physPts = Math.round((physical.totalScore / 100) * 20);
      if (physPts >= 16) { physDir = 'positive'; physReason = 'Strong physical candidate \u2014 favorable geometry and building condition.'; }
      else if (physPts >= 10) { physDir = 'neutral'; physReason = 'Moderate physical feasibility \u2014 some design intervention needed.'; }
      else { physDir = 'negative'; physReason = 'Challenging physical profile \u2014 significant renovation required.'; }
    } else {
      physReason = 'Physical assessment not available.';
    }
    score += physPts;
    components.push({ name: 'Physical Score', contribution: physPts, max: 20, direction: physDir, reason: physReason });

    // UNIT YIELD STRENGTH (max 15 pts)
    const units = yieldBase || 0;
    let yieldPts = 0, yieldDir = 'neutral', yieldReason = '';
    if (units >= 100) { yieldPts = 15; yieldDir = 'positive'; yieldReason = units + ' units \u2014 institutional scale, strong lender appetite.'; }
    else if (units >= 60) { yieldPts = 10; yieldDir = 'positive'; yieldReason = units + ' units \u2014 good scale for conventional financing.'; }
    else if (units >= 30) { yieldPts = 5; yieldDir = 'negative'; yieldReason = units + ' units \u2014 below 60 units, per-unit costs rise, lender appetite narrows.'; }
    else if (units > 0) { yieldPts = 0; yieldDir = 'negative'; yieldReason = units + ' units \u2014 very low count limits financing options.'; }
    else { yieldReason = 'Unit yield not calculated.'; }
    score += yieldPts;
    components.push({ name: 'Unit Yield', contribution: yieldPts, max: 15, direction: yieldDir, reason: yieldReason });

    // COST EFFICIENCY (max 20 pts)
    const cpuMid = costs ? (costs.costPerUnitMid || 0) : 0;
    let costPts = 0, costDir = 'neutral', costReason = '';
    if (cpuMid > 0) {
      if (cpuMid <= 200000) { costPts = 20; costDir = 'positive'; costReason = '$' + Math.round(cpuMid).toLocaleString() + '/unit \u2014 excellent cost efficiency.'; }
      else if (cpuMid <= 275000) { costPts = 15; costDir = 'positive'; costReason = '$' + Math.round(cpuMid).toLocaleString() + '/unit \u2014 competitive conversion cost.'; }
      else if (cpuMid <= 350000) { costPts = 8; costDir = 'neutral'; costReason = '$' + Math.round(cpuMid).toLocaleString() + '/unit \u2014 above average, monitor closely.'; }
      else { costPts = 2; costDir = 'negative'; costReason = '$' + Math.round(cpuMid).toLocaleString() + '/unit \u2014 high cost, may need value engineering.'; }
    } else {
      costReason = 'Cost data not available.';
    }
    score += costPts;
    components.push({ name: 'Cost Efficiency', contribution: costPts, max: 20, direction: costDir, reason: costReason });

    // RETURN ON COST (max 25 pts)
    const roc = proforma ? (proforma.returnOnCost || 0) : 0;
    let rocPts = 0, rocDir = 'neutral', rocReason = '';
    if (roc >= 7.0) { rocPts = 25; rocDir = 'positive'; rocReason = roc.toFixed(1) + '% ROC \u2014 strong returns, well above target.'; }
    else if (roc >= 6.5) { rocPts = 20; rocDir = 'positive'; rocReason = roc.toFixed(1) + '% ROC \u2014 meets 6.5% target, no subsidy needed.'; }
    else if (roc >= 5.5) { rocPts = 12; rocDir = 'neutral'; rocReason = roc.toFixed(1) + '% ROC \u2014 below target, structured capital may help.'; }
    else if (roc >= 4.5) { rocPts = 5; rocDir = 'negative'; rocReason = roc.toFixed(1) + '% ROC \u2014 marginal returns, requires incentives or price reduction.'; }
    else if (roc > 0) { rocPts = 0; rocDir = 'negative'; rocReason = roc.toFixed(1) + '% ROC \u2014 challenging economics.'; }
    else { rocReason = 'Pro forma not available.'; }
    score += rocPts;
    components.push({ name: 'Return on Cost', contribution: rocPts, max: 25, direction: rocDir, reason: rocReason });

    // SUBSIDY GAP PENALTY (max -20 pts)
    const gapPerUnit = subsidyGap ? (subsidyGap.subsidyPerUnit || 0) : 0;
    let gapPts = 0, gapDir = 'neutral', gapReason = '';
    if (gapPerUnit > 75000) { gapPts = -20; gapDir = 'negative'; gapReason = '$' + Math.round(gapPerUnit).toLocaleString() + '/unit gap \u2014 large subsidy required.'; }
    else if (gapPerUnit > 25000) { gapPts = -12; gapDir = 'negative'; gapReason = '$' + Math.round(gapPerUnit).toLocaleString() + '/unit gap \u2014 moderate incentive needed.'; }
    else if (gapPerUnit > 0) { gapPts = -5; gapDir = 'neutral'; gapReason = '$' + Math.round(gapPerUnit).toLocaleString() + '/unit gap \u2014 small subsidy may be needed.'; }
    else { gapDir = 'neutral'; gapReason = 'No gap \u2014 project self-sufficient at target ROC.'; }
    score += gapPts;
    components.push({ name: 'Subsidy Gap', contribution: gapPts, max: 0, direction: gapDir, reason: gapReason });

    // Cap at 0-100
    score = Math.max(0, Math.min(100, score));

    // Band and commentary
    let band, commentary;
    if (score >= 80) {
      band = 'A';
      commentary = 'IC-Ready \u2014 strong across all dimensions';
    } else if (score >= 60) {
      band = 'B';
      commentary = 'Watchlist \u2014 viable with right structure or price';
    } else {
      band = 'C';
      commentary = 'Long-Shot \u2014 significant challenges to solve first';
    }

    return { score, band, commentary, components };
  }

  /**
   * Quick parcel score — uses AROScoring when available for consistency.
   * Falls back to a basic heuristic if AROScoring is not loaded.
   */
  function computeAROScore(parcel) {
    // Use the full AROScoring engine if available — keeps Deal Score aligned with Opportunity Score
    if (typeof AROScoring !== 'undefined') {
      const result = AROScoring.calculateScore({
        yearBuilt: parcel.yearBuilt || parcel.effectiveyearbuilt,
        useType: parcel.useDescription || parcel.usedescription || parcel.useType || '',
        vacancyRate: parcel.vacancyRate || parcel.vacancy || '',
        floorplateShape: parcel.floorplateShape || parcel.floorplate || '',
        historicDesignation: parcel.historicDesignation || parcel.historic || 'None',
        affordableStrategy: parcel.affordableStrategy || parcel.affordable || 'None',
        zoning: parcel.zoning || '',
        buildingSF: parcel.sqft || parcel.sqftmain || parcel.buildingSF || 0,
        neighborhood: parcel.neighborhood || parcel.submarket || ''
      });
      const score = result.score;
      let band, commentary;
      if (score >= 80) {
        band = 'A';
        commentary = 'IC-Ready \u2014 strong across all dimensions';
      } else if (score >= 60) {
        band = 'B';
        commentary = 'Watchlist \u2014 viable with right structure or price';
      } else {
        band = 'C';
        commentary = 'Long-Shot \u2014 significant challenges to solve first';
      }
      return { score, band, commentary };
    }

    // Fallback: basic heuristic if AROScoring not loaded
    let score = 0;
    const yearBuilt = parseInt(parcel.yearBuilt || parcel.effectiveyearbuilt) || 2026;
    const age = 2026 - yearBuilt;

    if (age >= 15) score += 20;
    else if (age >= 5) score += 10;

    const useDesc = (parcel.useDescription || parcel.usedescription || '').toLowerCase();
    if (useDesc.includes('office')) score += 14;
    else if (useDesc.includes('hotel') || useDesc.includes('motel')) score += 16;
    else if (useDesc.includes('warehouse') || useDesc.includes('industrial')) score += 12;
    else if (useDesc.includes('retail') || useDesc.includes('commercial')) score += 10;
    else if (useDesc.includes('parking')) score += 11;
    else score += 8;

    if (age >= 40) score += 8;
    else if (age >= 25) score += 5;
    else if (age >= 15) score += 3;

    const sqft = parseInt(parcel.sqft || parcel.sqftmain) || 0;
    if (sqft >= 50000) score += 10;
    else if (sqft >= 25000) score += 7;
    else if (sqft >= 10000) score += 4;

    score = Math.max(0, Math.min(100, score));

    let band, commentary;
    if (score >= 80) {
      band = 'A';
      commentary = 'IC-Ready \u2014 strong across all dimensions';
    } else if (score >= 60) {
      band = 'B';
      commentary = 'Watchlist \u2014 viable with right structure or price';
    } else {
      band = 'C';
      commentary = 'Long-Shot \u2014 significant challenges to solve first';
    }

    return { score, band, commentary };
  }

  /**
   * Render score breakdown HTML (used in Snapshot, Report, IC Memo)
   */
  function renderScoreBreakdown(components) {
    if (!components || components.length === 0) return '';

    const positives = components.filter(c => c.direction === 'positive').slice(0, 3);
    const others = components.filter(c => c.direction !== 'positive').slice(0, 2);
    const display = [...positives, ...others].slice(0, 5);

    let html = '<div class="score-breakdown">';
    display.forEach(c => {
      const icon = c.direction === 'positive' ? '\u2713' : (c.direction === 'negative' ? '\u25BC' : '\u2500');
      const cls = c.direction === 'positive' ? 'positive' : (c.direction === 'negative' ? 'negative' : 'neutral');
      const pts = c.contribution >= 0 ? '+' + c.contribution : String(c.contribution);
      html += `<div class="sb-row ${cls}">
        <span class="sb-icon">${icon}</span>
        <span class="sb-name">${c.name}</span>
        <span class="sb-pts">${pts}</span>
        <span class="sb-reason">${c.reason}</span>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  function bandColor(band) {
    if (band === 'A') return 'eligible';
    if (band === 'B') return 'conditional';
    return 'ineligible';
  }

  return { computeDealScore, computeAROScore, bandColor, renderScoreBreakdown };
})();
