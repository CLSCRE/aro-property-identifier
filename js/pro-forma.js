/**
 * Back-of-Envelope Pro Forma Engine
 * Commercial Lending Solutions — Conversion Feasibility Analyzer
 */

const ProForma = (() => {

  // Capital Stack Scenario Presets (Enhancement C)
  const CAPITAL_SCENARIOS = {
    marketRate:     { label: 'Market Rate',      ltc: 0.67, hardCostMult: 1.00, rentMult: 1.00, htcQRE: 0 },
    historicCredit: { label: 'Historic (HTC)',   ltc: 0.65, hardCostMult: 1.20, rentMult: 1.00, htcQRE: 0.80 },
    affordable100:  { label: '100% Affordable',  ltc: 0.85, hardCostMult: 0.95, rentMult: 0.55, htcQRE: 0 },
    mixedIncome:    { label: 'Mixed-Income',     ltc: 0.70, hardCostMult: 0.98, rentMult: null, htcQRE: 0 }
  };

  // LTC percentages for equity/loan structures
  const LOAN_STRUCTURES = {
    '65% LTC':    0.65,
    '70% LTC':    0.70,
    'HUD 221d4':  0.85,
    'Bridge':     0.75
  };

  /**
   * Calculate pro forma
   * @param {Object} params - All inputs from Module 4 + data from prior modules
   * @returns {Object} Full pro forma analysis
   */
  function calculate(params) {
    const yieldData = params.yieldData;
    const costData = params.costData;

    const acquisitionPrice = parseFloat(params.acquisitionPrice) || 0;
    const studioRent = parseFloat(params.studioRent) || 0;
    const oneBRRent = parseFloat(params.oneBRRent) || 0;
    const twoBRRent = parseFloat(params.twoBRRent) || 0;
    const pctAffordable = parseFloat(params.pctAffordable) || 0;
    const affordableRentPct = parseFloat(params.affordableRentPct) || 60;
    const vacancyRate = parseFloat(params.vacancyRate) || 5;
    const opexRatio = parseFloat(params.opexRatio) || 40;
    const exitCapRate = parseFloat(params.exitCapRate) || 5.5;
    const constructionLoanRate = parseFloat(params.constructionLoanRate) || (typeof LiveRates !== 'undefined' ? LiveRates.getConstructionLoanRate() : 7.5);
    const loanStructure = params.loanStructure || '65% LTC';

    // Use base case unit counts
    const studioUnits = yieldData ? yieldData.base.studio.units : 0;
    const oneBRUnits = yieldData ? yieldData.base.oneBR.units : 0;
    const twoBRUnits = yieldData ? yieldData.base.twoBR.units : 0;
    const parkingBonusUnits = yieldData ? yieldData.parkingBonusUnits : 0;
    const totalUnits = studioUnits + oneBRUnits + twoBRUnits + parkingBonusUnits;

    // Distribute parking bonus units as studios
    const adjStudioUnits = studioUnits + parkingBonusUnits;

    // Revenue calculation
    const studioGPR = adjStudioUnits * studioRent * 12;
    const oneBRGPR = oneBRUnits * oneBRRent * 12;
    const twoBRGPR = twoBRUnits * twoBRRent * 12;
    let grossPotentialRent = studioGPR + oneBRGPR + twoBRGPR;

    // Affordable adjustment
    let affordableAdj = 0;
    if (pctAffordable > 0) {
      const affFraction = pctAffordable / 100;
      const marketRentReduction = 1 - (affordableRentPct / 100);
      affordableAdj = Math.round(grossPotentialRent * affFraction * marketRentReduction);
      grossPotentialRent -= affordableAdj;
    }

    const vacancyLoss = Math.round(grossPotentialRent * (vacancyRate / 100));
    const otherIncome = Math.round(grossPotentialRent * 0.03);
    const effectiveGrossIncome = grossPotentialRent - vacancyLoss + otherIncome;

    // Retained office income for partial conversions
    const retainedSF = parseFloat(params.retainedSF) || 0;
    let retainedOfficeNOI = 0;
    if (retainedSF > 0) {
      const retainedGrossRent = retainedSF * 2.50 * 12; // $2.50/SF/mo NNN
      const retainedEGI = retainedGrossRent * (1 - 0.10); // 10% vacancy
      retainedOfficeNOI = Math.round(retainedEGI * (1 - 0.40)); // 40% opex
    }

    // Expenses
    const operatingExpenses = Math.round(effectiveGrossIncome * (opexRatio / 100));
    const residentialNOI = effectiveGrossIncome - operatingExpenses;
    const noi = residentialNOI + retainedOfficeNOI;

    // Valuation
    const stabilizedValue = exitCapRate > 0 ? Math.round(noi / (exitCapRate / 100)) : 0;

    // Total project cost
    const totalConversionCost = costData ? costData.midpoint : 0;
    const totalProjectCost = acquisitionPrice + totalConversionCost;

    // Returns
    const profit = stabilizedValue - totalProjectCost;
    const returnOnCost = totalProjectCost > 0 ? (noi / totalProjectCost) * 100 : 0;

    // Debt service
    const ltcPct = LOAN_STRUCTURES[loanStructure] || 0.65;
    const loanAmount = Math.round(totalProjectCost * ltcPct);
    const monthlyInterest = Math.round(loanAmount * (constructionLoanRate / 100) / 12);
    const annualCarry = monthlyInterest * 12;

    // Historic Tax Credit benefit
    const isHistoric = params.conversionType === 'Historic';
    let federalHTC = 0, stateHTC = 0, totalHTCEquity = 0;
    let htcBridgeLoan = 0, htcBridgeCost = 0, netHTCEquity = 0;
    if (isHistoric) {
      const qre = costData ? costData.hardCost.low : 0;
      federalHTC = Math.round(qre * 0.20);
      stateHTC = Math.round(qre * 0.20);
      totalHTCEquity = federalHTC + stateHTC;
      // HTC bridge loan: 90% of anticipated equity, ~8% rate over 24-month construction
      htcBridgeLoan = Math.round(totalHTCEquity * 0.90);
      const htcBridgeRate = typeof LiveRates !== 'undefined' ? LiveRates.getHTCBridgeRate() / 100 : 0.08;
      htcBridgeCost = Math.round(htcBridgeLoan * htcBridgeRate * 2); // 2 years of interest
      netHTCEquity = totalHTCEquity - htcBridgeCost;
    }

    // Viability verdict
    let verdict, verdictColor;
    if (returnOnCost >= 6.5) {
      verdict = 'Strong Returns — Viable Project';
      verdictColor = 'green';
    } else if (returnOnCost >= 5.0) {
      verdict = 'Marginal Returns — Needs Incentives or Lower Acquisition';
      verdictColor = 'amber';
    } else {
      verdict = 'Challenging Economics — HTC/Subsidies or Price Reduction Required';
      verdictColor = 'red';
    }

    return {
      // Revenue
      studioGPR,
      oneBRGPR,
      twoBRGPR,
      grossPotentialRent: studioGPR + oneBRGPR + twoBRGPR + affordableAdj, // pre-affordable
      affordableAdj,
      vacancyLoss,
      otherIncome,
      effectiveGrossIncome,

      // Expenses
      operatingExpenses,
      noi,

      // Valuation
      stabilizedValue,
      totalProjectCost,
      acquisitionPrice,
      totalConversionCost,
      profit,
      returnOnCost,

      // Debt
      ltcPct,
      loanAmount,
      monthlyInterest,
      annualCarry,
      loanStructure,
      constructionLoanRate,

      // HTC
      isHistoric,
      federalHTC,
      stateHTC,
      totalHTCEquity,
      htcBridgeLoan,
      htcBridgeCost,
      netHTCEquity,

      // Partial conversion
      retainedOfficeNOI,
      retainedSF,

      // Verdict
      verdict,
      verdictColor,

      // Units
      totalUnits,
      exitCapRate
    };
  }

  /**
   * Generate sensitivity table data
   * Returns ROC at different cap rates and acquisition adjustments
   */
  function sensitivityAnalysis(params, baseResult) {
    const capRates = [4.5, 5.0, 5.5, 6.0];
    const acqMultipliers = [
      { label: 'Acq -20%', mult: 0.80 },
      { label: 'Acq at Ask', mult: 1.00 },
      { label: 'Acq +10%', mult: 1.10 }
    ];

    const noi = baseResult.noi;
    const conversionCost = baseResult.totalConversionCost;
    const baseAcq = baseResult.acquisitionPrice;

    const rows = capRates.map(cap => {
      const cells = acqMultipliers.map(adj => {
        const adjAcq = Math.round(baseAcq * adj.mult);
        const tpc = adjAcq + conversionCost;
        const roc = tpc > 0 ? (noi / tpc) * 100 : 0;
        let color = 'red';
        if (roc >= 6.5) color = 'green';
        else if (roc >= 5.0) color = 'amber';
        return { value: roc.toFixed(1) + '%', color };
      });
      return { capRate: cap.toFixed(1) + '% cap', cells };
    });

    return { columns: acqMultipliers.map(a => a.label), rows };
  }

  /**
   * Run a single capital stack scenario (Enhancement C)
   * @param {Object} baseInputs - Same params as calculate()
   * @param {Object} costData - From Module 3
   * @param {string} scenarioKey - Key from CAPITAL_SCENARIOS
   * @returns {Object} Scenario results
   */
  function runCapitalScenario(baseInputs, costData, scenarioKey) {
    const scenario = CAPITAL_SCENARIOS[scenarioKey];
    if (!scenario || !costData) return null;

    // Adjust hard costs
    const baseHardCost = costData.hardCost.low;
    const adjustedHardCost = Math.round(baseHardCost * scenario.hardCostMult);

    // Recalculate total cost with adjusted hard cost ratio
    const hardCostRatio = costData.hardCost.low > 0 ? adjustedHardCost / costData.hardCost.low : 1;
    const adjustedMidpoint = Math.round(costData.midpoint * hardCostRatio);
    const acquisitionPrice = parseFloat(baseInputs.acquisitionPrice) || 0;
    const totalCost = acquisitionPrice + adjustedMidpoint;

    // Adjust rents
    let rentMult = scenario.rentMult;
    if (rentMult === null) {
      // Mixed-income: blend 75% market + 25% affordable at 55%
      rentMult = 0.75 * 1.0 + 0.25 * 0.55;
    }

    const studioRent = Math.round((parseFloat(baseInputs.studioRent) || 0) * rentMult);
    const oneBRRent = Math.round((parseFloat(baseInputs.oneBRRent) || 0) * rentMult);
    const twoBRRent = Math.round((parseFloat(baseInputs.twoBRRent) || 0) * rentMult);

    // Calculate NOI using same logic as main calculate
    const yieldData = baseInputs.yieldData;
    const studioUnits = yieldData ? yieldData.base.studio.units + (yieldData.parkingBonusUnits || 0) : 0;
    const oneBRUnits = yieldData ? yieldData.base.oneBR.units : 0;
    const twoBRUnits = yieldData ? yieldData.base.twoBR.units : 0;

    const grossRent = (studioUnits * studioRent + oneBRUnits * oneBRRent + twoBRUnits * twoBRRent) * 12;
    const vacancyRate = parseFloat(baseInputs.vacancyRate) || 5;
    const opexRatio = parseFloat(baseInputs.opexRatio) || 40;
    const vacancyLoss = Math.round(grossRent * (vacancyRate / 100));
    const otherIncome = Math.round(grossRent * 0.03);
    const egi = grossRent - vacancyLoss + otherIncome;
    const opex = Math.round(egi * (opexRatio / 100));
    const noi = egi - opex;

    // HTC equity offset
    let equityOffset = 0;
    if (scenario.htcQRE > 0) {
      const qre = Math.round(adjustedHardCost * scenario.htcQRE);
      const federalHTC = Math.round(qre * 0.20);
      const stateHTC = Math.round(qre * 0.20);
      equityOffset = federalHTC + stateHTC;
    }

    const effectiveCost = totalCost - equityOffset;
    const roc = effectiveCost > 0 ? (noi / effectiveCost) * 100 : 0;

    return {
      key: scenarioKey,
      label: scenario.label,
      hardCost: adjustedHardCost,
      totalCost,
      noi,
      equityOffset,
      effectiveCost,
      roc,
      ltc: scenario.ltc
    };
  }

  /**
   * Run all 4 capital stack scenarios
   */
  function runAllCapitalScenarios(baseInputs, costData) {
    return Object.keys(CAPITAL_SCENARIOS).map(key =>
      runCapitalScenario(baseInputs, costData, key)
    ).filter(Boolean);
  }

  return { calculate, sensitivityAnalysis, runCapitalScenario, runAllCapitalScenarios, CAPITAL_SCENARIOS };
})();
