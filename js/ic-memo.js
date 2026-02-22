/**
 * IC Memo Mode — Investment Committee Memorandum Generator
 * Commercial Lending Solutions — opens print-ready memo in new browser tab
 */

const ICMemo = (() => {

  function generate() {
    const state = FeasibilityTab.getState ? FeasibilityTab.getState() : null;
    if (!state || !state.proFormaResult) {
      alert('Please complete Modules 1-4 before generating an IC Memo.');
      return;
    }

    const pre = state.prePopulatedData || {};
    const p = state.physicalResult;
    const y = state.yieldResult;
    const c = state.costResult;
    const pf = state.proFormaResult;
    const esg = state.esgResult;
    const address = pre.address || 'Subject Property';
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const totalUnits = y ? (y.base.total + y.parkingBonusUnits) : 0;
    const cpuMid = c ? Math.round((c.costPerUnit.low + c.costPerUnit.high) / 2) : 0;

    // Deal Score
    const aro = pre.yearBuilt ? AROScoring.getEligibility(parseInt(pre.yearBuilt), pre.useType || '', pre.neighborhood || '') : null;
    const targetROC = parseFloat(document.getElementById('m4-target-roc') ? document.getElementById('m4-target-roc').value : 6.5) || 6.5;
    let subsidyPerUnit = 0;
    if (pf && pf.totalProjectCost > 0) {
      const reqCost = pf.noi / (targetROC / 100);
      subsidyPerUnit = Math.max(0, (pf.totalProjectCost - reqCost) / (totalUnits || 1));
    }
    const ds = DealScore.computeDealScore({
      aro: { eligibility: aro ? aro.status : 'ineligible' },
      physical: { totalScore: p ? p.gensler.total : 0 },
      yieldBase: totalUnits,
      costs: { costPerUnitMid: cpuMid },
      proforma: { returnOnCost: pf.returnOnCost },
      subsidyGap: { subsidyPerUnit }
    });

    // Max Offer
    const acqPrice = pf.acquisitionPrice || 0;
    const convCost = pf.totalConversionCost || 0;
    const maxTotalCost = targetROC > 0 ? pf.noi / (targetROC / 100) : 0;
    const maxOffer = maxTotalCost - convCost;

    // Deal Angles
    const angles = aro ? AROScoring.getDealAngles(pre, aro) : [];

    // Program Recommendation — use FeasibilityTab internal functions via state
    // Capital Stack Scenarios
    const scenarios = ProForma.runAllCapitalScenarios ? ProForma.runAllCapitalScenarios({
      yieldData: y, costData: c,
      acquisitionPrice: acqPrice,
      studioRent: document.getElementById('m4-studio-rent') ? document.getElementById('m4-studio-rent').value : 2200,
      oneBRRent: document.getElementById('m4-1br-rent') ? document.getElementById('m4-1br-rent').value : 2800,
      twoBRRent: document.getElementById('m4-2br-rent') ? document.getElementById('m4-2br-rent').value : 3600,
      vacancyRate: document.getElementById('m4-vacancy') ? document.getElementById('m4-vacancy').value : 5,
      opexRatio: document.getElementById('m4-opex') ? document.getElementById('m4-opex').value : 40
    }, c) : [];
    let bestScenario = scenarios[0];
    if (scenarios.length > 0) scenarios.forEach(s => { if (s.roc > bestScenario.roc) bestScenario = s; });

    // Risk Summary
    const risk = state.riskSummary || null;

    // Sponsor Notes
    const sponsorExp = document.getElementById('sponsor-experience') ? document.getElementById('sponsor-experience').value : '';
    const sponsorJV = document.getElementById('sponsor-jv') ? document.getElementById('sponsor-jv').value : '';
    const sponsorHold = document.getElementById('sponsor-hold') ? document.getElementById('sponsor-hold').value : '';
    const sponsorExit = document.getElementById('sponsor-exit') ? document.getElementById('sponsor-exit').value : '';
    const hasSponsor = sponsorExp || sponsorJV || sponsorHold || sponsorExit;

    // Roadmap
    const roadmap = state.roadmap || [];

    // Build memo HTML
    const bc = DealScore.bandColor(ds.band);
    const fmt = n => { if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; return '$' + Math.round(n).toLocaleString(); };
    const pct = n => n.toFixed(1) + '%';

    let memo = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>IC Memo \u2014 ${address}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; color: #0d0d0d; background: white; padding: 40px; max-width: 850px; margin: 0 auto; line-height: 1.6; }
  .gold-rule { height: 3px; background: #b8960c; margin: 24px 0; }
  .thin-rule { height: 1px; background: #e0ddd4; margin: 16px 0; }
  h1 { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 800; }
  h2 { font-family: 'DM Mono', monospace; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: #999; margin: 24px 0 12px; }
  .header-sub { font-size: 0.88rem; color: #666; }
  .brand { font-family: 'DM Mono', monospace; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: #b8960c; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin: 12px 0; }
  th { font-family: 'DM Mono', monospace; font-size: 0.65rem; letter-spacing: 0.06em; text-transform: uppercase; color: #999; text-align: left; padding: 8px 12px; border-bottom: 2px solid #e0ddd4; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0ede6; }
  td:last-child { text-align: right; font-family: 'DM Mono', monospace; font-weight: 600; }
  .score-box { text-align: center; padding: 16px; border-radius: 10px; margin: 12px 0; }
  .score-box.green { background: #f0f7f2; border: 2px solid #1a5c38; color: #1a5c38; }
  .score-box.amber { background: #fdf6e6; border: 2px solid #7a4f00; color: #7a4f00; }
  .score-box.red { background: #fdf0f0; border: 2px solid #b42828; color: #b42828; }
  .score-num { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 800; }
  .risk-row { display: flex; gap: 16px; margin: 8px 0; }
  .risk-item { flex: 1; padding: 10px; border-radius: 8px; font-size: 0.82rem; }
  .risk-item.green { background: #f0f7f2; border-left: 3px solid #1a5c38; }
  .risk-item.amber { background: #fdf6e6; border-left: 3px solid #7a4f00; }
  .risk-item.red { background: #fdf0f0; border-left: 3px solid #b42828; }
  .risk-label { font-family: 'DM Mono', monospace; font-size: 0.65rem; letter-spacing: 0.06em; text-transform: uppercase; color: #999; }
  .roadmap-item { padding: 10px 0; border-bottom: 1px solid #f0ede6; }
  .phase-label { font-family: 'DM Mono', monospace; font-size: 0.72rem; color: #b8960c; font-weight: 700; }
  .print-btn { display: block; margin: 24px auto; padding: 12px 32px; font-size: 1rem; cursor: pointer; background: #0d0d0d; color: #f5f2eb; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; }
  @media print { .print-btn { display: none !important; } body { padding: 20px; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
<div class="gold-rule"></div>
<div class="brand">${BRAND.firmName} \u2014 INVESTMENT COMMITTEE MEMORANDUM</div>
<h1>${address}</h1>
<div class="header-sub">Prepared: ${dateStr} | ${BRAND.productName} ${BRAND.productVersion}</div>
<div class="gold-rule"></div>

<h2>Section 1 \u2014 Executive Summary</h2>
<div class="score-box ${bc}">
  <div style="font-family:'DM Mono',monospace;font-size:0.65rem;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">${BRAND.firmName} Deal Score</div>
  <div class="score-num">${ds.score}/100 \u2014 Band ${ds.band}</div>
  <div style="font-size:0.88rem;">${ds.commentary}</div>
</div>
${ds.components ? (() => {
  const drivers = ds.components.filter(c => c.contribution !== 0).slice(0, 4);
  let driverHtml = '<table style="margin:8px 0;"><thead><tr><th>Factor</th><th>Pts</th><th>Assessment</th></tr></thead><tbody>';
  drivers.forEach(c => {
    const pts = c.contribution >= 0 ? '+' + c.contribution : String(c.contribution);
    driverHtml += '<tr><td>' + c.name + '</td><td style="text-align:right;font-weight:700;color:' + (c.direction === 'positive' ? '#1a5c38' : c.direction === 'negative' ? '#8b1c1c' : '#666') + ';">' + pts + '</td><td style="font-size:0.82rem;">' + c.reason + '</td></tr>';
  });
  driverHtml += '</tbody></table>';
  return driverHtml;
})() : ''}
<table>
  <tr><td>ARO Path</td><td>${aro ? aro.verdict : 'Unknown'}</td></tr>
  <tr><td>Deal Thesis</td><td>${angles.slice(0, 2).map(a => a.title).join('; ') || 'Run full analysis for deal angles'}</td></tr>
</table>
${typeof NBAEngine !== 'undefined' ? (() => {
  const nba = NBAEngine.computeFromState();
  if (nba && nba.length > 0) return '<p style="font-size:0.88rem;margin:8px 0;background:#f9f9f6;padding:10px 14px;border-radius:8px;border-left:3px solid #b8960c;"><strong>Recommended Next Step:</strong> ' + nba[0].label + '</p>';
  return '';
})() : ''}

<h2>Section 2 \u2014 Key Metrics</h2>
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    <tr><td>Estimated Units (Base Case)</td><td>${totalUnits || '\u2014'}</td></tr>
    <tr><td>Cost Per Unit (Low \u2013 High)</td><td>${c ? fmt(c.costPerUnit.low) + ' \u2013 ' + fmt(c.costPerUnit.high) : '\u2014'}</td></tr>
    <tr><td>Total Project Cost (Low \u2013 High)</td><td>${c ? fmt(c.totalProjectCost.low) + ' \u2013 ' + fmt(c.totalProjectCost.high) : '\u2014'}</td></tr>
    <tr><td>Return on Cost</td><td>${pf ? pct(pf.returnOnCost) : '\u2014'}</td></tr>
    <tr><td>Subsidy Gap (per unit)</td><td>${subsidyPerUnit > 0 ? '$' + Math.round(subsidyPerUnit).toLocaleString() : 'None'}</td></tr>
    <tr><td>Max Offer at ${pct(targetROC)} Target ROC</td><td>${fmt(Math.round(maxOffer))}</td></tr>
    <tr><td>Stabilized Value</td><td>${pf ? fmt(pf.stabilizedValue) : '\u2014'}</td></tr>
    <tr><td>Physical Feasibility Score</td><td>${p ? p.gensler.total + '/100' : '\u2014'}</td></tr>
    <tr><td>ARO Eligibility</td><td>${aro ? aro.status : 'Unknown'}</td></tr>
  </tbody>
</table>

<h2>Section 3 \u2014 Business Plan</h2>`;

    // Capital Stack Scenario
    if (bestScenario) {
      memo += `<p style="font-size:0.88rem;margin:8px 0;"><strong>Strongest Capital Stack:</strong> ${bestScenario.label} at ${pct(bestScenario.roc)} ROC (${Math.round(bestScenario.ltc * 100)}% LTC).</p>`;
    }

    // Computed Timeline (Phase 7) — replaces static roadmap when available
    if (typeof TimelineClock !== 'undefined') {
      const tl = TimelineClock.computeFromState();
      if (tl) {
        memo += `<p style="font-size:0.88rem;margin:8px 0;"><strong>Timeline to Stabilization:</strong> Best ${tl.best} mo | Expected ${tl.expected} mo | High ${tl.high} mo</p>`;
        memo += `<table><thead><tr><th>Phase</th><th>Duration</th></tr></thead><tbody>`;
        memo += `<tr><td>Entitlement</td><td>${tl.breakdown.entitlement.low}\u2013${tl.breakdown.entitlement.high} months</td></tr>`;
        memo += `<tr><td>Design + CDs</td><td>${tl.breakdown.design.low}\u2013${tl.breakdown.design.high} months</td></tr>`;
        memo += `<tr><td>Construction + Lease-Up</td><td>${tl.breakdown.construction.low}\u2013${tl.breakdown.construction.high} months</td></tr>`;
        memo += `</tbody></table>`;
        memo += `<p style="font-size:0.82rem;color:${tl.riskLabel === 'Low' ? '#1a5c38' : tl.riskLabel === 'Moderate' ? '#7a4f00' : '#8b1c1c'};font-weight:700;">Timeline Risk: ${tl.riskLabel}</p>`;
      } else if (roadmap.length > 0) {
        roadmap.forEach(phase => {
          memo += `<div class="roadmap-item"><span class="phase-label">Phase ${phase.num}: ${phase.name}</span> <span style="color:#999;font-size:0.82rem;">${phase.duration}</span></div>`;
        });
      }
    } else if (roadmap.length > 0) {
      roadmap.forEach(phase => {
        memo += `<div class="roadmap-item"><span class="phase-label">Phase ${phase.num}: ${phase.name}</span> <span style="color:#999;font-size:0.82rem;">${phase.duration}</span></div>`;
      });
    }

    memo += `<h2>Section 4 \u2014 Risk Summary</h2>`;
    if (typeof ScenarioEngine !== 'undefined') {
      const riskText = ScenarioEngine.getRiskSummaryText();
      if (riskText) memo += `<p style="font-size:0.88rem;margin:8px 0;background:#f9f9f6;padding:10px 14px;border-radius:8px;border-left:3px solid #b8960c;">${riskText}</p>`;
    }
    if (risk) {
      const rc = l => l === 'Low' ? 'green' : l === 'Medium' ? 'amber' : 'red';
      memo += `<div class="risk-row">
        <div class="risk-item ${rc(risk.entitlement.level)}"><div class="risk-label">Entitlement</div><strong>${risk.entitlement.level}</strong><br>${risk.entitlement.text}</div>
        <div class="risk-item ${rc(risk.construction.level)}"><div class="risk-label">Construction</div><strong>${risk.construction.level}</strong><br>${risk.construction.text}</div>
        <div class="risk-item ${rc(risk.capitalStack.level)}"><div class="risk-label">Capital Stack</div><strong>${risk.capitalStack.level}</strong><br>${risk.capitalStack.text}</div>
      </div>`;
    } else {
      memo += '<p style="font-size:0.88rem;color:#666;">Risk assessment not available \u2014 complete all modules for full analysis.</p>';
    }

    memo += `<h2>Section 5 \u2014 ESG Impact</h2>`;
    if (esg) {
      memo += `<p style="font-size:0.88rem;margin:8px 0;">${esg.co2AvoidedTons.toLocaleString()} tons CO2e avoided, ${esg.totalDebrisTons.toLocaleString()} tons debris diverted, ${esg.totalUnits} housing units created. ESG Score: ${esg.totalScore}/60.</p>`;
    } else {
      memo += '<p style="font-size:0.88rem;color:#666;">ESG analysis not available.</p>';
    }

    memo += `<h2>Section 6 \u2014 Sponsor Notes</h2>`;
    if (hasSponsor) {
      if (sponsorExp) memo += `<p style="font-size:0.88rem;margin:6px 0;"><strong>Experience:</strong> ${sponsorExp}</p>`;
      if (sponsorJV) memo += `<p style="font-size:0.88rem;margin:6px 0;"><strong>JV Structure:</strong> ${sponsorJV}</p>`;
      if (sponsorHold) memo += `<p style="font-size:0.88rem;margin:6px 0;"><strong>Hold Period:</strong> ${sponsorHold}</p>`;
      if (sponsorExit) memo += `<p style="font-size:0.88rem;margin:6px 0;"><strong>Exit Strategy:</strong> ${sponsorExit}</p>`;
    } else {
      memo += '<p style="font-size:0.88rem;color:#666;">Not provided.</p>';
    }

    memo += `<h2>Section 7 \u2014 Assumptions & Disclaimer</h2>
<ul style="font-size:0.82rem;color:#666;line-height:1.7;padding-left:18px;">
  <li>Cost estimates based on 2026 Los Angeles market data</li>
  <li>Unit sizes: Studio 450-500 SF, 1BR 600-700 SF, 2BR 850-950 SF</li>
  <li>Net-to-gross efficiency: 72%</li>
  <li>ARO eligibility per LA City Ordinance effective Feb 1, 2026</li>
  <li>HTC rates: 20% Federal + 20% California on QRE</li>
</ul>
<p style="font-size:0.78rem;color:#999;margin-top:12px;font-style:italic;">${BRAND.disclaimerFull}</p>

<div class="gold-rule"></div>
<div style="text-align:center;font-size:0.82rem;color:#999;">
  <div style="font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;color:#0d0d0d;">${BRAND.firmName}</div>
  <div>${BRAND.website} | ${BRAND.altWebsite}</div>
</div>
<div class="gold-rule"></div>
</body></html>`;

    const memoWindow = window.open('', '_blank');
    memoWindow.document.write(memo);
    memoWindow.document.close();
  }

  return { generate };
})();
