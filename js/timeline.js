/**
 * Time-to-Close / Complexity Clock
 * Commercial Lending Solutions — How long will this deal actually take?
 */

const TimelineClock = (() => {

  function estimateTimeline({ aro, neighborhood, riskSummary, physical }) {
    const isDowntown = neighborhood === 'Downtown LA';
    const isByRight  = aro && aro.eligibility === 'eligible';

    // Entitlement
    let entitleLow, entitleHigh;
    if (isByRight) {
      entitleLow  = 3;
      entitleHigh = 6;
    } else {
      entitleLow  = 6;
      entitleHigh = 12;
    }
    if (isDowntown) { entitleLow += 3; entitleHigh += 6; }

    // Design + Construction Documents
    const designLow  = 6;
    const designHigh = 10;

    // Construction + lease-up
    const highComplexity = (riskSummary && riskSummary.complexityScore === 'High') ||
                           (physical && physical.seismicFlag) ||
                           (physical && physical.curtainWallFlag);
    const constructLow  = 18;
    const constructHigh = highComplexity ? 36 : 30;

    const best     = entitleLow  + designLow  + constructLow;
    const expected = Math.round((entitleLow + entitleHigh) / 2 +
                                (designLow + designHigh) / 2 +
                                (constructLow + constructHigh) / 2);
    const high     = entitleHigh + designHigh + constructHigh;

    const spread = high - best;
    let riskLabel;
    if (spread <= 12)      riskLabel = 'Low';
    else if (spread <= 24) riskLabel = 'Moderate';
    else                   riskLabel = 'High';

    return {
      best,
      expected,
      high,
      riskLabel,
      breakdown: {
        entitlement:  { low: entitleLow,   high: entitleHigh },
        design:       { low: designLow,    high: designHigh },
        construction: { low: constructLow, high: constructHigh }
      }
    };
  }

  // ─── Compute from current Tab 3 state ───

  function computeFromState() {
    if (typeof FeasibilityTab === 'undefined') return null;
    const state = FeasibilityTab.getState ? FeasibilityTab.getState() : null;
    if (!state) return null;

    const pre = state.prePopulatedData;
    if (!pre) return null;

    let aro = null;
    if (pre.yearBuilt && typeof AROScoring !== 'undefined') {
      aro = AROScoring.getEligibility(
        parseInt(pre.yearBuilt),
        pre.useType || '',
        pre.neighborhood || ''
      );
    }

    return estimateTimeline({
      aro: aro ? { eligibility: aro.status } : { eligibility: 'conditional' },
      neighborhood: pre.neighborhood || '',
      riskSummary: state.riskSummary || null,
      physical: state.physicalResult || null
    });
  }

  // ─── Render Helpers ───

  function riskColor(label) {
    if (label === 'Low') return 'eligible';
    if (label === 'Moderate') return 'conditional';
    return 'ineligible';
  }

  function renderTimelineBlock(tl) {
    if (!tl) return '';
    const rc = riskColor(tl.riskLabel);
    return `<div class="timeline-block" style="margin:12px 0;">
      <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--mid);font-weight:700;margin-bottom:8px;">Timeline Estimate</div>
      <div style="display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap;">
        <div style="text-align:center;">
          <div style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;color:var(--eligible);">${tl.best}</div>
          <div style="font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--mid);">Best (mo)</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;color:var(--ink);">${tl.expected}</div>
          <div style="font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--mid);">Expected (mo)</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;color:var(--ineligible);">${tl.high}</div>
          <div style="font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--mid);">High (mo)</div>
        </div>
      </div>
      <table style="width:100%;font-size:0.82rem;border-collapse:collapse;margin-bottom:8px;">
        <tr style="border-bottom:1px solid var(--rule);">
          <td style="padding:4px 0;color:var(--mid);font-family:'DM Mono',monospace;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;">Entitlement</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${tl.breakdown.entitlement.low}&ndash;${tl.breakdown.entitlement.high} mo</td>
        </tr>
        <tr style="border-bottom:1px solid var(--rule);">
          <td style="padding:4px 0;color:var(--mid);font-family:'DM Mono',monospace;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;">Design + CDs</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${tl.breakdown.design.low}&ndash;${tl.breakdown.design.high} mo</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:var(--mid);font-family:'DM Mono',monospace;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;">Construction</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${tl.breakdown.construction.low}&ndash;${tl.breakdown.construction.high} mo</td>
        </tr>
      </table>
      <div style="display:inline-block;padding:3px 10px;border-radius:2px;font-size:0.75rem;font-weight:700;font-family:'DM Mono',monospace;background:var(--${rc}-bg);color:var(--${rc});border:1px solid var(--${rc});">Timeline Risk: ${tl.riskLabel}</div>
    </div>`;
  }

  function renderTimelinePill(tl) {
    if (!tl) return '<span style="color:var(--mid);">&mdash;</span>';
    const rc = riskColor(tl.riskLabel);
    return `<span style="font-size:0.78rem;font-weight:600;">${tl.expected} mo</span> <span class="fit-pill" style="display:inline-block;padding:1px 6px;border-radius:2px;font-size:0.65rem;font-weight:700;font-family:'DM Mono',monospace;background:var(--${rc}-bg);color:var(--${rc});">${tl.riskLabel.charAt(0)}</span>`;
  }

  return {
    estimateTimeline,
    computeFromState,
    riskColor,
    renderTimelineBlock,
    renderTimelinePill
  };
})();
