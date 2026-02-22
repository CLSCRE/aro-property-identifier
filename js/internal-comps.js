/**
 * Internal Comps (Comps-Lite)
 * Commercial Lending Solutions — Benchmark each deal against others in your pipeline
 */

const InternalComps = (() => {

  function useTypeFamily(useType) {
    if (!useType) return 'other';
    const t = useType.toLowerCase();
    if (t.includes('office')) return 'office';
    if (t.includes('hotel') || t.includes('motel')) return 'hospitality';
    if (t.includes('industrial') || t.includes('warehouse')) return 'industrial';
    return 'other';
  }

  function median(arr) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function pctile(val, arr) {
    if (val == null || !arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const below = sorted.filter(v => v < val).length;
    return Math.round(below / sorted.length * 100);
  }

  function computeInternalComps(deal, pipeline) {
    if (!deal || !pipeline || pipeline.length < 2) return null;

    // Step 1: Find comparable deals
    const comps = pipeline.filter(d => {
      if (d === deal || (d.address && deal.address && d.address === deal.address)) return false;

      const sameNeighborhood = d.submarket && deal.submarket && d.submarket === deal.submarket;
      const sameUseFamily = useTypeFamily(d.useDescription || d.useType) ===
                           useTypeFamily(deal.useDescription || deal.useType);

      const dealSF = parseInt(deal.sqft || deal.buildingSF) || 0;
      const compSF = parseInt(d.sqft || d.buildingSF) || 0;
      const inBand = dealSF > 0 && compSF > 0 &&
                     compSF >= dealSF * 0.50 &&
                     compSF <= dealSF * 1.50;

      return (sameNeighborhood || sameUseFamily) && inBand;
    });

    if (comps.length < 2) return null;

    // Step 2: Compute medians
    const rocValues   = comps.map(d => d.returnOnCost).filter(Boolean);
    const cpuValues   = comps.map(d => d.costPerUnitMid).filter(Boolean);
    const scoreValues = comps.map(d => d.dealScore).filter(Boolean);

    const medianROC   = median(rocValues);
    const medianCPU   = median(cpuValues);
    const medianScore = median(scoreValues);

    return {
      compCount:         comps.length,
      medianROC,
      medianCostPerUnit: medianCPU,
      medianScore,
      rocPercentile:     pctile(deal.returnOnCost || deal.returnOnCost, rocValues),
      scorePercentile:   pctile(deal.dealScore, scoreValues),
      costPercentile:    pctile(deal.costPerUnitMid, cpuValues),
      submarket:         deal.submarket || '',
      useFamily:         useTypeFamily(deal.useDescription || deal.useType)
    };
  }

  // ─── Percentile Labels ───

  function rocLabel(pct) {
    if (pct == null) return '\u2014';
    if (pct >= 75) return 'Top ' + (100 - pct) + '%';
    if (pct >= 50) return 'Upper Half';
    if (pct >= 25) return 'Lower Half';
    return 'Bottom Quartile';
  }

  function scoreLabel(pct) {
    if (pct == null) return '\u2014';
    if (pct >= 75) return 'Top ' + (100 - pct) + '%';
    if (pct >= 50) return 'Upper Half';
    if (pct >= 25) return 'Lower Half';
    return 'Bottom Quartile';
  }

  function costLabel(pct) {
    if (pct == null) return '\u2014';
    // Lower cost = better, so reverse labeling
    if (pct <= 25) return 'Below Median (favorable)';
    if (pct <= 50) return 'Below Median (favorable)';
    if (pct <= 75) return 'Near Median';
    return 'Above Median (unfavorable)';
  }

  function rankLabel(rocPct) {
    if (rocPct == null) return '\u2014';
    if (rocPct >= 75) return 'Top Quartile';
    if (rocPct >= 50) return 'Upper Half';
    if (rocPct >= 25) return 'Lower Half';
    return 'Bottom Quartile';
  }

  // ─── Render Helpers ───

  function fmt(n) {
    if (n == null) return '\u2014';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(n).toLocaleString();
  }

  function renderCompsBlock(comps, deal) {
    if (!comps) return '';
    const familyLabel = comps.useFamily !== 'other' ? comps.useFamily : '';
    const locationLabel = comps.submarket || '';
    const descriptor = [locationLabel, familyLabel].filter(Boolean).join(' ');

    let html = `<div class="internal-comps-block" style="margin:12px 0;padding:12px 16px;background:var(--cream);border:1px solid var(--rule);border-radius:2px;">
      <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--mid);font-weight:700;margin-bottom:8px;">Internal Ranking</div>
      <div style="font-size:0.78rem;color:var(--slate);margin-bottom:8px;">Within your <strong>${comps.compCount}</strong> analyzed ${descriptor} deals:</div>
      <table style="width:100%;font-size:0.82rem;border-collapse:collapse;">`;

    // ROC
    if (comps.rocPercentile != null && comps.medianROC != null && deal.returnOnCost) {
      html += `<tr style="border-bottom:1px solid var(--rule);">
        <td style="padding:4px 0;font-weight:600;color:var(--ink);">ROC</td>
        <td style="padding:4px 0;color:var(--slate);">${rocLabel(comps.rocPercentile)}</td>
        <td style="padding:4px 0;text-align:right;color:var(--mid);font-size:0.75rem;">(deal ${deal.returnOnCost.toFixed(1)}% vs median ${comps.medianROC.toFixed(1)}%)</td>
      </tr>`;
    }

    // Deal Score
    if (comps.scorePercentile != null && comps.medianScore != null && deal.dealScore) {
      html += `<tr style="border-bottom:1px solid var(--rule);">
        <td style="padding:4px 0;font-weight:600;color:var(--ink);">Deal Score</td>
        <td style="padding:4px 0;color:var(--slate);">${scoreLabel(comps.scorePercentile)}</td>
        <td style="padding:4px 0;text-align:right;color:var(--mid);font-size:0.75rem;">(deal ${deal.dealScore} vs median ${Math.round(comps.medianScore)})</td>
      </tr>`;
    }

    // Cost/Unit
    if (comps.costPercentile != null && comps.medianCostPerUnit != null && deal.costPerUnitMid) {
      html += `<tr>
        <td style="padding:4px 0;font-weight:600;color:var(--ink);">Cost/Unit</td>
        <td style="padding:4px 0;color:var(--slate);">${costLabel(comps.costPercentile)}</td>
        <td style="padding:4px 0;text-align:right;color:var(--mid);font-size:0.75rem;">(deal ${fmt(deal.costPerUnitMid)} vs median ${fmt(comps.medianCostPerUnit)})</td>
      </tr>`;
    }

    html += `</table></div>`;
    return html;
  }

  function renderRankPill(comps) {
    if (!comps || comps.rocPercentile == null) return '<span style="color:var(--mid);">\u2014</span>';
    const label = rankLabel(comps.rocPercentile);
    const isGood = comps.rocPercentile >= 50;
    const color = isGood ? 'eligible' : 'conditional';
    return `<span style="font-size:0.72rem;font-weight:600;color:var(--${color});">${label}</span>`;
  }

  return {
    computeInternalComps,
    useTypeFamily,
    median,
    rocLabel,
    scoreLabel,
    costLabel,
    rankLabel,
    renderCompsBlock,
    renderRankPill
  };
})();
