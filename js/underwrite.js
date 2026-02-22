/**
 * Fast Underwrite + Offer Summary
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const FastUnderwrite = (() => {
  let lastResult = null;

  // ─── Neighborhood Rent Defaults ───
  const MARKET_DEFAULTS = {
    'Downtown LA':            { studio: 2100, oneBR: 2800, twoBR: 3800, exitCap: 5.25 },
    'Hollywood':              { studio: 2000, oneBR: 2700, twoBR: 3600, exitCap: 5.25 },
    'Koreatown/Wilshire Center': { studio: 1800, oneBR: 2400, twoBR: 3200, exitCap: 5.25 },
    'West LA/Brentwood':      { studio: 2600, oneBR: 3400, twoBR: 4600, exitCap: 4.75 },
    'Century City':           { studio: 2700, oneBR: 3600, twoBR: 4900, exitCap: 4.75 },
    'Santa Monica':           { studio: 2800, oneBR: 3700, twoBR: 5000, exitCap: 4.75 },
    'Culver City':            { studio: 2400, oneBR: 3100, twoBR: 4200, exitCap: 4.75 },
    'Mid-Wilshire':           { studio: 2000, oneBR: 2600, twoBR: 3500, exitCap: 5.50 },
    'Sherman Oaks/Van Nuys':  { studio: 1900, oneBR: 2500, twoBR: 3300, exitCap: 5.50 },
    'Burbank/Glendale':       { studio: 1900, oneBR: 2500, twoBR: 3300, exitCap: 5.50 },
    'El Segundo/Playa Vista': { studio: 2300, oneBR: 3000, twoBR: 4100, exitCap: 5.00 },
    'Pasadena':               { studio: 2100, oneBR: 2800, twoBR: 3700, exitCap: 5.25 },
    'Long Beach':             { studio: 1800, oneBR: 2400, twoBR: 3200, exitCap: 5.50 },
    'Other LA':               { studio: 1900, oneBR: 2500, twoBR: 3300, exitCap: 5.50 }
  };

  const UNIVERSAL_DEFAULTS = {
    vacancyRate: 5,
    opexRatio: 40,
    targetROC: 6.5,
    corridorWidth: 6,
    minWindowDist: 25
  };

  function inferFastDefaults(params) {
    const nb = params.neighborhood || 'Other LA';
    const market = MARKET_DEFAULTS[nb] || MARKET_DEFAULTS['Other LA'];
    return {
      studioRent: market.studio,
      oneBRRent: market.oneBR,
      twoBRRent: market.twoBR,
      exitCap: market.exitCap,
      vacancyRate: UNIVERSAL_DEFAULTS.vacancyRate,
      opexRatio: UNIVERSAL_DEFAULTS.opexRatio,
      targetROC: UNIVERSAL_DEFAULTS.targetROC,
      corridorWidth: UNIVERSAL_DEFAULTS.corridorWidth,
      minWindowDist: UNIVERSAL_DEFAULTS.minWindowDist
    };
  }

  // ─── Auto-fill helper: only fill if field is empty or at browser default ───
  function autoFillIfEmpty(fieldId, value) {
    const el = document.getElementById(fieldId);
    if (!el) return false;

    // For selects, check if at default option
    if (el.tagName === 'SELECT') {
      // Don't override user-selected values
      return false;
    }

    // For inputs, only fill if empty (no user value)
    const current = el.value;
    if (current === '' || current === '0') {
      el.value = value;
      return true;
    }
    return false;
  }

  // ─── Main Fast Underwrite ───
  function runFastUnderwrite() {
    // Step 1: Gather state
    const state = FeasibilityTab.getState ? FeasibilityTab.getState() : {};
    const pre = state.prePopulatedData || {};
    const neighborhood = pre.neighborhood || document.getElementById('input-neighborhood').value || 'Other LA';
    const useType = pre.useType || '';
    const yearBuilt = pre.yearBuilt || '';
    const buildingSF = pre.buildingSF || '';
    const stories = pre.stories || '';
    const estimatedValue = pre.estimatedValue || document.getElementById('input-value').value || '';

    if (!state.physicalResult) {
      alert('Please complete Module 1 (Physical Feasibility) before running Fast Underwrite.');
      return;
    }

    // Step 2: Infer defaults
    const defaults = inferFastDefaults({ neighborhood, useType });
    const applied = [];

    // Step 3: Auto-fill only empty fields
    const fieldMap = {
      'm2-corridor-width': { val: defaults.corridorWidth, label: 'Corridor Width: ' + defaults.corridorWidth + 'ft' },
      'm2-min-window-dist': { val: defaults.minWindowDist, label: 'Min Window Dist: ' + defaults.minWindowDist + 'ft' },
      'm4-studio-rent': { val: defaults.studioRent, label: 'Studio rent: $' + defaults.studioRent.toLocaleString() + '/mo' },
      'm4-1br-rent': { val: defaults.oneBRRent, label: '1BR rent: $' + defaults.oneBRRent.toLocaleString() + '/mo' },
      'm4-2br-rent': { val: defaults.twoBRRent, label: '2BR rent: $' + defaults.twoBRRent.toLocaleString() + '/mo' },
      'm4-target-roc': { val: defaults.targetROC, label: 'Target ROC: ' + defaults.targetROC + '%' }
    };

    // Handle selects differently — set value on vacancy and opex if they match browser default
    const vacancyEl = document.getElementById('m4-vacancy');
    if (vacancyEl) {
      vacancyEl.value = String(defaults.vacancyRate);
      applied.push({ field: 'm4-vacancy', label: 'Vacancy: ' + defaults.vacancyRate + '%' });
    }
    const opexEl = document.getElementById('m4-opex');
    if (opexEl) {
      opexEl.value = String(defaults.opexRatio);
      applied.push({ field: 'm4-opex', label: 'Opex: ' + defaults.opexRatio + '%' });
    }
    const capEl = document.getElementById('m4-cap-rate');
    if (capEl) {
      capEl.value = String(defaults.exitCap);
      applied.push({ field: 'm4-cap-rate', label: 'Exit cap: ' + defaults.exitCap + '%' });
    }

    Object.keys(fieldMap).forEach(id => {
      const filled = autoFillIfEmpty(id, fieldMap[id].val);
      if (filled) applied.push({ field: id, label: fieldMap[id].label });
    });

    // Step 4: Run module calculators in sequence
    FeasibilityTab.calculateYield();
    FeasibilityTab.calculateCost();
    FeasibilityTab.calculateProForma();

    // Step 5: Gather results
    const updatedState = FeasibilityTab.getState();
    const pf = updatedState.proFormaResult;
    const y = updatedState.yieldResult;
    const c = updatedState.costResult;
    const p = updatedState.physicalResult;

    if (!pf || !y) {
      alert('Could not complete underwrite. Ensure Module 1 data is sufficient.');
      return;
    }

    const totalUnits = y.base.total + y.parkingBonusUnits;
    const cpuMid = c ? Math.round((c.costPerUnit.low + c.costPerUnit.high) / 2) : 0;
    const targetROC = defaults.targetROC;
    const maxTotalCost = pf.noi > 0 && targetROC > 0 ? pf.noi / (targetROC / 100) : 0;
    const convCost = pf.totalConversionCost || 0;
    const maxOffer = maxTotalCost - convCost;
    const currentAsk = parseFloat(estimatedValue) || parseFloat(document.getElementById('m4-acquisition').value) || 0;
    const headroom = maxOffer - currentAsk;

    // Subsidy gap
    let subsidyPerUnit = 0;
    if (pf.totalProjectCost > 0) {
      const reqCost = pf.noi / (targetROC / 100);
      subsidyPerUnit = Math.max(0, (pf.totalProjectCost - reqCost) / (totalUnits || 1));
    }

    // Deal Score
    const aro = pre.yearBuilt ? AROScoring.getEligibility(parseInt(pre.yearBuilt), pre.useType || '', pre.neighborhood || '') : null;
    const ds = DealScore.computeDealScore({
      aro: { eligibility: aro ? aro.status : 'ineligible' },
      physical: { totalScore: p ? p.gensler.total : 0 },
      yieldBase: totalUnits,
      costs: { costPerUnitMid: cpuMid },
      proforma: { returnOnCost: pf.returnOnCost },
      subsidyGap: { subsidyPerUnit }
    });

    lastResult = {
      address: pre.address || 'Subject Property',
      neighborhood,
      useType: pre.useType || '',
      yearBuilt: pre.yearBuilt || '',
      buildingSF: pre.buildingSF || '',
      stories: pre.stories || '',
      targetROC,
      maxAcquisition: maxOffer,
      currentAsk,
      headroom,
      baseUnits: totalUnits,
      costPerUnit: cpuMid,
      noi: pf.noi,
      returnOnCost: pf.returnOnCost,
      stabilizedValue: pf.stabilizedValue,
      profit: pf.profit,
      subsidyPerUnit,
      dealScore: ds.score,
      dealBand: ds.band,
      dealCommentary: ds.commentary,
      dealScoreComponents: ds.components || [],
      costRange: c ? { low: c.costPerUnit.low, high: c.costPerUnit.high } : null,
      totalCostRange: c ? { low: c.totalProjectCost.low, high: c.totalProjectCost.high } : null,
      unitRange: y ? { low: y.conservative.total, base: y.base.total, high: y.optimistic.total } : null,
      pf,
      defaultsApplied: applied,
      aroPath: aro ? aro.verdict : 'Unknown',
      dealAngles: aro && pre ? AROScoring.getDealAngles(pre, aro) : []
    };

    // Step 6: Open panel
    openFastUnderwritePanel();
  }

  // ─── Format helpers ───
  function fmt(n) {
    if (n === 0) return '$0';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(n).toLocaleString();
  }
  function fmtFull(n) { return '$' + Math.round(n).toLocaleString(); }
  function pct(n) { return n.toFixed(1) + '%'; }

  // ─── Fast Underwrite Panel ───
  function openFastUnderwritePanel() {
    if (!lastResult) return;
    const r = lastResult;

    // Remove existing overlay
    const existing = document.getElementById('fast-underwrite-overlay');
    if (existing) existing.remove();

    const bc = DealScore.bandColor(r.dealBand);
    const headColor = r.headroom > 0 ? 'var(--eligible)' : (Math.abs(r.headroom) / Math.max(r.currentAsk, 1) < 0.05 ? 'var(--conditional)' : 'var(--ineligible)');
    const headIcon = r.headroom > 0 ? '\u2713' : (r.headroom === 0 ? '\u2014' : '\u26A0');
    const headNote = r.headroom > 0 ? 'Max offer exceeds ask' : (r.headroom === 0 ? 'Break-even' : 'Ask exceeds max offer');

    let defaultsHtml = '';
    if (r.defaultsApplied.length > 0) {
      defaultsHtml = r.defaultsApplied.map(d =>
        `<span class="fu-default-chip" onclick="FastUnderwrite.scrollToField('${d.field}')">${d.label}</span>`
      ).join(' ');
    }

    // Score breakdown
    let scoreHtml = '';
    if (r.dealScoreComponents && r.dealScoreComponents.length > 0) {
      const positives = r.dealScoreComponents.filter(c => c.direction === 'positive').slice(0, 3);
      const negatives = r.dealScoreComponents.filter(c => c.direction !== 'positive').slice(0, 2);
      const all = [...positives, ...negatives].slice(0, 5);
      scoreHtml = '<div class="fu-score-breakdown">';
      all.forEach(c => {
        const icon = c.direction === 'positive' ? '\u2713' : (c.direction === 'negative' ? '\u25BC' : '\u2500');
        const cls = c.direction === 'positive' ? 'positive' : (c.direction === 'negative' ? 'negative' : 'neutral');
        scoreHtml += `<div class="fu-score-row ${cls}"><span class="fu-score-icon">${icon}</span><span class="fu-score-name">${c.name}</span><span class="fu-score-pts">+${c.contribution}</span><span class="fu-score-reason">${c.reason}</span></div>`;
      });
      scoreHtml += '</div>';
    }

    const overlay = document.createElement('div');
    overlay.id = 'fast-underwrite-overlay';
    overlay.className = 'fu-overlay';
    overlay.innerHTML = `
      <div class="fu-panel">
        <div class="fu-header">
          <div class="fu-header-title">\u26A1 FAST UNDERWRITE RESULTS</div>
          <button class="fu-close" onclick="FastUnderwrite.closePanel()">&times;</button>
        </div>
        <div class="fu-address">${r.address}</div>
        <div class="fu-subtext">Defaults applied \u2014 edit modules to refine</div>

        <div class="fu-deal-score ${bc}">
          <span class="fu-ds-label">DEAL SCORE</span>
          <span class="fu-ds-value">${r.dealScore}/100</span>
          <span class="fu-ds-band">Band ${r.dealBand} \u2014 ${r.dealCommentary}</span>
        </div>

        ${scoreHtml}

        <div class="fu-metrics-grid">
          <div class="fu-metric"><div class="fu-metric-label">Units (base)</div><div class="fu-metric-value">${r.baseUnits}</div></div>
          <div class="fu-metric"><div class="fu-metric-label">Cost/Unit</div><div class="fu-metric-value">${fmt(r.costPerUnit)} avg</div></div>
          <div class="fu-metric"><div class="fu-metric-label">NOI</div><div class="fu-metric-value">${fmtFull(r.noi)}</div></div>
          <div class="fu-metric"><div class="fu-metric-label">ROC</div><div class="fu-metric-value" style="color:${r.returnOnCost >= 6.5 ? 'var(--eligible)' : r.returnOnCost >= 5.0 ? 'var(--conditional)' : 'var(--ineligible)'}">${pct(r.returnOnCost)} ${r.returnOnCost >= r.targetROC ? '\u2713' : ''}</div></div>
          <div class="fu-metric"><div class="fu-metric-label">Max Offer</div><div class="fu-metric-value">${fmt(Math.round(r.maxAcquisition))}</div></div>
          <div class="fu-metric"><div class="fu-metric-label">Current Ask</div><div class="fu-metric-value">${r.currentAsk > 0 ? fmt(r.currentAsk) : '\u2014'}</div></div>
          <div class="fu-metric full-width"><div class="fu-metric-label">Headroom</div><div class="fu-metric-value" style="color:${headColor}">${r.currentAsk > 0 ? (r.headroom >= 0 ? '+' : '') + fmt(Math.round(r.headroom)) : '\u2014'} ${r.currentAsk > 0 ? headIcon + ' ' + headNote : ''}</div></div>
          <div class="fu-metric full-width"><div class="fu-metric-label">Subsidy Gap</div><div class="fu-metric-value">${r.subsidyPerUnit > 0 ? fmtFull(Math.round(r.subsidyPerUnit)) + '/unit' : 'None required'}</div></div>
        </div>

        ${defaultsHtml ? `<div class="fu-defaults-section">
          <div class="fu-defaults-title">DEFAULTS APPLIED (click to edit):</div>
          <div class="fu-defaults-chips">${defaultsHtml}</div>
        </div>` : ''}

        <div class="fu-actions">
          <button class="btn-gold" onclick="FastUnderwrite.copyOfferSummary()">Copy Offer Summary</button>
          <button class="btn-primary" onclick="FastUnderwrite.openFullFeasibility()">Open Full Feasibility \u2192</button>
        </div>
        <div class="fu-copied-tooltip" id="fu-copied" style="display:none;">Copied!</div>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) FastUnderwrite.closePanel();
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  function closePanel() {
    const overlay = document.getElementById('fast-underwrite-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    }
  }

  function scrollToField(fieldId) {
    closePanel();
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (!el) return;

      // Find parent module and expand it
      const moduleCard = el.closest('.module-card');
      if (moduleCard && !moduleCard.classList.contains('expanded')) {
        const moduleNum = moduleCard.id.replace('module-', '');
        FeasibilityTab.toggleModule(parseInt(moduleNum));
      }

      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('gold-pulse');
        setTimeout(() => el.classList.remove('gold-pulse'), 1500);
      }, 350);
    }, 350);
  }

  function openFullFeasibility() {
    closePanel();
    setTimeout(() => {
      // Expand Module 2
      const m2 = document.getElementById('module-2');
      if (m2 && !m2.classList.contains('expanded')) {
        FeasibilityTab.toggleModule(2);
      }
      if (m2) m2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  }

  // ─── Offer Summary (Feature 2) ───
  function buildOfferSummary(dealState) {
    const r = dealState || lastResult;
    if (!r) return { text: '', html: '' };

    const age = r.yearBuilt ? (2026 - parseInt(r.yearBuilt)) : 0;
    const sfFormatted = r.buildingSF ? parseInt(r.buildingSF).toLocaleString() : 'N/A';
    const unitRange = r.unitRange ? `${r.unitRange.low}\u2013${r.unitRange.high}` : String(r.baseUnits);
    const cpuRange = r.costRange ? `$${Math.round(r.costRange.low).toLocaleString()} \u2013 $${Math.round(r.costRange.high).toLocaleString()}` : fmt(r.costPerUnit);
    const tcRange = r.totalCostRange ? `$${Math.round(r.totalCostRange.low).toLocaleString()} \u2013 $${Math.round(r.totalCostRange.high).toLocaleString()}` : '\u2014';
    const angles = r.dealAngles || [];

    let text = '';
    text += '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n';
    text += `${BRAND.firmName} \u2014 OFFER SUMMARY\n`;
    text += '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n';
    text += `Property:     ${r.address}\n`;
    text += `Use Type:     ${r.useType || 'N/A'}, ${r.stories || 'N/A'} stories, ${sfFormatted} SF\n`;
    text += `Year Built:   ${r.yearBuilt || 'N/A'} (${age} years old)\n`;
    text += `ARO Path:     ${r.aroPath || 'Unknown'}\n`;
    text += '\n';
    text += `UNIT YIELD:   ${r.baseUnits} units (range: ${unitRange})\n`;
    text += `COST/UNIT:    ${cpuRange}\n`;
    text += `TOTAL COST:   ${tcRange} (excl. acquisition)\n`;
    text += '\n';
    text += 'FINANCIALS:\n';
    text += `  NOI (stabilized):      ${fmtFull(r.noi)}\n`;
    text += `  Return on Cost:        ${pct(r.returnOnCost)}\n`;
    text += `  Max Offer (${pct(r.targetROC)} ROC):  ${fmt(Math.round(r.maxAcquisition))}\n`;
    text += `  Current Ask:           ${r.currentAsk > 0 ? fmt(r.currentAsk) : 'N/A'}\n`;
    text += `  Headroom:              ${r.currentAsk > 0 ? (r.headroom >= 0 ? '+' : '') + fmt(Math.round(r.headroom)) : 'N/A'}\n`;
    text += `  Subsidy Gap/Unit:      ${r.subsidyPerUnit > 0 ? '$' + Math.round(r.subsidyPerUnit).toLocaleString() : 'None required'}\n`;
    text += '\n';
    if (angles.length > 0) {
      text += 'DEAL ANGLES:\n';
      angles.slice(0, 3).forEach(a => { text += `  \u2022 ${a.title}\n`; });
      text += '\n';
    }
    text += `DEAL SCORE: ${r.dealScore}/100 \u2014 Band ${r.dealBand} \u2014 ${r.dealCommentary}\n`;
    text += '\n';
    text += `Prepared by ${BRAND.firmName} ${BRAND.productName} ${BRAND.productVersion} | ${BRAND.website}\n`;
    text += `${BRAND.disclaimerShort}\n`;
    text += '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n';

    return { text, html: '' };
  }

  function copyOfferSummary() {
    const summary = buildOfferSummary();
    if (!summary.text) return;

    navigator.clipboard.writeText(summary.text).then(() => {
      showCopiedTooltip('fu-copied');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = summary.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopiedTooltip('fu-copied');
    });
  }

  function copyOfferSummaryFromState() {
    const state = FeasibilityTab.getState ? FeasibilityTab.getState() : {};
    if (!state.proFormaResult) {
      alert('Complete Modules 1\u20134 before copying offer summary.');
      return;
    }

    // Build from current state if no fast underwrite run yet
    const dealState = lastResult || buildDealStateFromFeasibility(state);
    const summary = buildOfferSummary(dealState);
    if (!summary.text) return;

    navigator.clipboard.writeText(summary.text).then(() => {
      showCopiedTooltipNear(event.target);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = summary.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopiedTooltipNear(event.target);
    });
  }

  function buildDealStateFromFeasibility(state) {
    const pre = state.prePopulatedData || {};
    const pf = state.proFormaResult;
    const y = state.yieldResult;
    const c = state.costResult;
    const p = state.physicalResult;
    const totalUnits = y ? (y.base.total + y.parkingBonusUnits) : 0;
    const cpuMid = c ? Math.round((c.costPerUnit.low + c.costPerUnit.high) / 2) : 0;
    const targetROC = parseFloat(document.getElementById('m4-target-roc') ? document.getElementById('m4-target-roc').value : 6.5) || 6.5;
    const maxTotalCost = pf && pf.noi > 0 ? pf.noi / (targetROC / 100) : 0;
    const convCost = pf ? (pf.totalConversionCost || 0) : 0;
    const maxOffer = maxTotalCost - convCost;
    const currentAsk = pf ? (pf.acquisitionPrice || 0) : 0;
    let subsidyPerUnit = 0;
    if (pf && pf.totalProjectCost > 0) {
      const reqCost = pf.noi / (targetROC / 100);
      subsidyPerUnit = Math.max(0, (pf.totalProjectCost - reqCost) / (totalUnits || 1));
    }
    const aro = pre.yearBuilt ? AROScoring.getEligibility(parseInt(pre.yearBuilt), pre.useType || '', pre.neighborhood || '') : null;
    const ds = typeof DealScore !== 'undefined' ? DealScore.computeDealScore({
      aro: { eligibility: aro ? aro.status : 'ineligible' },
      physical: { totalScore: p ? p.gensler.total : 0 },
      yieldBase: totalUnits,
      costs: { costPerUnitMid: cpuMid },
      proforma: { returnOnCost: pf ? pf.returnOnCost : 0 },
      subsidyGap: { subsidyPerUnit }
    }) : { score: 0, band: 'C', commentary: '', components: [] };

    return {
      address: pre.address || 'Subject Property',
      neighborhood: pre.neighborhood || '',
      useType: pre.useType || '',
      yearBuilt: pre.yearBuilt || '',
      buildingSF: pre.buildingSF || '',
      stories: pre.stories || '',
      targetROC,
      maxAcquisition: maxOffer,
      currentAsk,
      headroom: maxOffer - currentAsk,
      baseUnits: totalUnits,
      costPerUnit: cpuMid,
      noi: pf ? pf.noi : 0,
      returnOnCost: pf ? pf.returnOnCost : 0,
      stabilizedValue: pf ? pf.stabilizedValue : 0,
      profit: pf ? pf.profit : 0,
      subsidyPerUnit,
      dealScore: ds.score,
      dealBand: ds.band,
      dealCommentary: ds.commentary,
      dealScoreComponents: ds.components || [],
      costRange: c ? { low: c.costPerUnit.low, high: c.costPerUnit.high } : null,
      totalCostRange: c ? { low: c.totalProjectCost.low, high: c.totalProjectCost.high } : null,
      unitRange: y ? { low: y.conservative.total, base: y.base.total, high: y.optimistic.total } : null,
      pf,
      defaultsApplied: [],
      aroPath: aro ? aro.verdict : 'Unknown',
      dealAngles: aro && pre ? AROScoring.getDealAngles(pre, aro) : []
    };
  }

  function showCopiedTooltip(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 2000);
    }
  }

  function showCopiedTooltipNear(btn) {
    if (!btn) return;
    const tip = document.createElement('span');
    tip.textContent = 'Copied!';
    tip.className = 'copied-tooltip';
    btn.style.position = 'relative';
    btn.appendChild(tip);
    setTimeout(() => tip.remove(), 2000);
  }

  function getLastResult() {
    return lastResult;
  }

  return {
    runFastUnderwrite,
    inferFastDefaults,
    buildOfferSummary,
    openFastUnderwritePanel,
    closePanel,
    scrollToField,
    openFullFeasibility,
    copyOfferSummary,
    copyOfferSummaryFromState,
    getLastResult,
    buildDealStateFromFeasibility
  };
})();
