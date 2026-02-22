/**
 * Scenario Stress Test Engine — Base / Downside / Upside
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const ScenarioEngine = (() => {

  let lastScenarios = null;

  /**
   * Build variant inputs from base case
   */
  function buildScenarioInputs(baseInputs, variant) {
    if (variant === 'downside') {
      return {
        ...baseInputs,
        studioRent: baseInputs.studioRent * 0.90,
        oneBRRent: baseInputs.oneBRRent * 0.90,
        twoBRRent: baseInputs.twoBRRent * 0.90,
        hardCostMult: 1.10,
        exitCapRate: baseInputs.exitCapRate + 0.375
      };
    }
    if (variant === 'upside') {
      return {
        ...baseInputs,
        studioRent: baseInputs.studioRent * 1.05,
        oneBRRent: baseInputs.oneBRRent * 1.05,
        twoBRRent: baseInputs.twoBRRent * 1.05,
        hardCostMult: 1.0,
        exitCapRate: baseInputs.exitCapRate - 0.25
      };
    }
    return { ...baseInputs, hardCostMult: 1.0 };
  }

  /**
   * Run a single scenario pro forma
   */
  function runScenarioProForma(inputs) {
    // Get yield data and cost data from current state
    const state = FeasibilityTab.getState ? FeasibilityTab.getState() : {};
    const yieldData = state.yieldResult;
    const costData = state.costResult;

    if (!yieldData || !costData) return null;

    // Apply hard cost multiplier to cost data
    const adjustedCost = inputs.hardCostMult && inputs.hardCostMult !== 1.0 ? {
      ...costData,
      midpoint: costData.midpoint * inputs.hardCostMult,
      totalProjectCost: {
        low: costData.totalProjectCost.low * inputs.hardCostMult,
        high: costData.totalProjectCost.high * inputs.hardCostMult
      },
      costPerUnit: {
        low: costData.costPerUnit.low * inputs.hardCostMult,
        high: costData.costPerUnit.high * inputs.hardCostMult
      }
    } : costData;

    const params = {
      yieldData,
      costData: adjustedCost,
      acquisitionPrice: inputs.acquisitionPrice || 0,
      studioRent: inputs.studioRent,
      oneBRRent: inputs.oneBRRent,
      twoBRRent: inputs.twoBRRent,
      pctAffordable: inputs.pctAffordable || 0,
      affordableRentPct: inputs.affordableRentPct || 60,
      vacancyRate: inputs.vacancyRate || 5,
      opexRatio: inputs.opexRatio || 40,
      exitCapRate: inputs.exitCapRate,
      constructionLoanRate: inputs.constructionLoanRate || 7.5,
      loanStructure: inputs.loanStructure || '65% LTC',
      retainedSF: inputs.retainedSF || 0
    };

    return ProForma.calculate(params);
  }

  /**
   * Run all three standard scenarios
   */
  function runStandardScenarios(baseInputs) {
    const base = runScenarioProForma(buildScenarioInputs(baseInputs, 'base'));
    const downside = runScenarioProForma(buildScenarioInputs(baseInputs, 'downside'));
    const upside = runScenarioProForma(buildScenarioInputs(baseInputs, 'upside'));

    if (!base || !downside || !upside) return null;

    // Risk assessment
    let riskLevel, riskText;
    if (downside.returnOnCost < 3.0) {
      riskLevel = 'high';
      riskText = 'High Downside Risk \u2014 project does not survive a 10% rent correction. Significant margin of safety required.';
    } else if (downside.returnOnCost <= 5.0) {
      riskLevel = 'moderate';
      riskText = 'Moderate Downside Risk \u2014 project survives stress but returns compress materially.';
    } else {
      riskLevel = 'resilient';
      riskText = 'Resilient \u2014 project maintains acceptable returns under stress assumptions.';
    }

    lastScenarios = { base, downside, upside, riskLevel, riskText };
    return lastScenarios;
  }

  /**
   * Gather current Module 4 inputs as base scenario
   */
  function gatherBaseInputs() {
    return {
      acquisitionPrice: parseFloat(document.getElementById('m4-acquisition').value) || 0,
      studioRent: parseFloat(document.getElementById('m4-studio-rent').value) || 0,
      oneBRRent: parseFloat(document.getElementById('m4-1br-rent').value) || 0,
      twoBRRent: parseFloat(document.getElementById('m4-2br-rent').value) || 0,
      pctAffordable: parseFloat(document.getElementById('m4-pct-affordable').value) || 0,
      affordableRentPct: parseFloat(document.getElementById('m4-affordable-pct').value) || 60,
      vacancyRate: parseFloat(document.getElementById('m4-vacancy').value) || 5,
      opexRatio: parseFloat(document.getElementById('m4-opex').value) || 40,
      exitCapRate: parseFloat(document.getElementById('m4-cap-rate').value) || 5.5,
      constructionLoanRate: parseFloat(document.getElementById('m4-loan-rate').value) || 7.5,
      loanStructure: document.getElementById('m4-loan-structure').value
    };
  }

  /**
   * Render scenario table HTML
   */
  function renderScenarioTable(scenarios) {
    if (!scenarios) return '';

    const fmt = n => {
      if (n === 0) return '$0';
      if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
      return '$' + Math.round(n).toLocaleString();
    };
    const pct = n => n.toFixed(1) + '%';
    const rocColor = n => n >= 6.5 ? 'green' : n >= 5.0 ? 'amber' : 'red';
    const profitColor = n => n >= 0 ? 'green' : 'red';

    const riskIcon = scenarios.riskLevel === 'high' ? '\uD83D\uDD34' : scenarios.riskLevel === 'moderate' ? '\uD83D\uDFE1' : '\uD83D\uDFE2';

    let html = `
      <div class="scenario-section" id="scenario-stress-test">
        <div class="proforma-section-title" style="cursor:pointer;" onclick="document.getElementById('scenario-table-content').classList.toggle('collapsed')">
          Sensitivity Stress Test \u2014 Base / Downside / Upside
          <span style="float:right;font-size:0.72rem;color:var(--mid);">\u25BC</span>
        </div>
        <div id="scenario-table-content">
          <div style="overflow-x:auto;">
          <table class="sensitivity-table scenario-table" style="min-width:450px;">
            <thead>
              <tr>
                <th></th>
                <th style="color:var(--ineligible);">Downside</th>
                <th style="color:var(--ink);">Base</th>
                <th style="color:var(--eligible);">Upside</th>
              </tr>
            </thead>
            <tbody>
              <tr class="scenario-assumption-row">
                <td>Rents</td><td>-10%</td><td>Base</td><td>+5%</td>
              </tr>
              <tr class="scenario-assumption-row">
                <td>Hard Costs</td><td>+10%</td><td>Base</td><td>Flat</td>
              </tr>
              <tr class="scenario-assumption-row">
                <td>Exit Cap</td><td>+37.5bps</td><td>Base</td><td>-25bps</td>
              </tr>
              <tr class="scenario-divider"><td colspan="4"></td></tr>
              <tr>
                <td>NOI</td>
                <td>${fmt(scenarios.downside.noi)}</td>
                <td><strong>${fmt(scenarios.base.noi)}</strong></td>
                <td>${fmt(scenarios.upside.noi)}</td>
              </tr>
              <tr>
                <td>Stabilized Value</td>
                <td>${fmt(scenarios.downside.stabilizedValue)}</td>
                <td><strong>${fmt(scenarios.base.stabilizedValue)}</strong></td>
                <td>${fmt(scenarios.upside.stabilizedValue)}</td>
              </tr>
              <tr>
                <td>Return on Cost</td>
                <td class="${rocColor(scenarios.downside.returnOnCost)}">${pct(scenarios.downside.returnOnCost)}</td>
                <td class="${rocColor(scenarios.base.returnOnCost)}"><strong>${pct(scenarios.base.returnOnCost)}</strong></td>
                <td class="${rocColor(scenarios.upside.returnOnCost)}">${pct(scenarios.upside.returnOnCost)}</td>
              </tr>
              <tr>
                <td>Profit / (Loss)</td>
                <td class="${profitColor(scenarios.downside.profit)}">${fmt(scenarios.downside.profit)}</td>
                <td class="${profitColor(scenarios.base.profit)}"><strong>${fmt(scenarios.base.profit)}</strong></td>
                <td class="${profitColor(scenarios.upside.profit)}">${fmt(scenarios.upside.profit)}</td>
              </tr>
            </tbody>
          </table>
          </div>
          <div class="scenario-risk-meter ${scenarios.riskLevel}">
            <span class="scenario-risk-icon">${riskIcon}</span>
            <span class="scenario-risk-text">${scenarios.riskText}</span>
          </div>
        </div>
      </div>`;

    return html;
  }

  function getLastScenarios() {
    return lastScenarios;
  }

  function getRiskSummaryText() {
    if (!lastScenarios) return '';
    const s = lastScenarios;
    const pct = n => n.toFixed(1) + '%';
    return `Stress test: Base ROC ${pct(s.base.returnOnCost)} / Downside ${pct(s.downside.returnOnCost)} / Upside ${pct(s.upside.returnOnCost)}. Risk level: ${s.riskLevel === 'high' ? 'High Downside' : s.riskLevel === 'moderate' ? 'Moderate' : 'Resilient'}.`;
  }

  return {
    buildScenarioInputs,
    runStandardScenarios,
    gatherBaseInputs,
    renderScenarioTable,
    getLastScenarios,
    getRiskSummaryText
  };
})();
