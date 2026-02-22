/**
 * Conversion Cost Estimator
 * Commercial Lending Solutions — Conversion Feasibility Analyzer
 * Hard cost ranges based on 2026 LA market data
 */

const CostEstimator = (() => {

  // Base hard cost per SF ranges (2026 LA market)
  const BASE_COSTS = {
    'Office Low Rise':      { low: 145, high: 220 },
    'Office Mid Rise':      { low: 160, high: 240 },
    'Office High Rise':     { low: 185, high: 275 },
    'Warehouse/Industrial': { low: 85,  high: 145 },
    'Hotel/Motel':          { low: 65,  high: 110 },
    'Retail/Commercial':    { low: 120, high: 190 },
    'Parking Structure':    { low: 95,  high: 155 }
  };

  // Conversion type multipliers
  const CONVERSION_MULTIPLIERS = {
    'Standard':  { low: 1.00, high: 1.00 },
    'Historic':  { low: 1.15, high: 1.25 },
    'Affordable':{ low: 0.95, high: 0.95 },
    'Mixed':     { low: 0.98, high: 0.98 },
    'Creative':  { low: 0.85, high: 0.85 }
  };

  // Quality level multipliers
  const QUALITY_MULTIPLIERS = {
    'Standard': { low: 1.00, high: 1.00 },
    'Premium':  { low: 1.10, high: 1.15 },
    'Luxury':   { low: 1.20, high: 1.35 }
  };

  // Seismic retrofit cost per SF
  const SEISMIC_COST = { low: 25, high: 55 };

  // Window replacement cost per facade SF
  const WINDOW_COST = { low: 18, high: 35 };

  // Parking conversion to residential per SF
  const PARKING_CONVERSION_COST = { low: 85, high: 120 };

  // Soft cost percentages
  const AE_PCT = { low: 0.08, high: 0.12 };
  const PERMITS_PCT = { low: 0.03, high: 0.05 };
  const CONTINGENCY_PCT = { low: 0.10, high: 0.15 };
  const FINANCING_PCT = { low: 0.06, high: 0.09 };

  // LA Linkage Fee (commercial to residential, 2026 rate)
  const LINKAGE_FEE_PER_SF = 21.58;

  /**
   * Calculate conversion costs
   * @param {Object} params
   * @returns {Object} cost breakdown with low/high estimates
   */
  function calculate(params) {
    const buildingSF = parseFloat(params.totalBuildingSF) || 0;
    const stories = parseInt(params.stories) || 1;
    const floorplateWidth = parseFloat(params.floorplateWidth) || 70;
    const floorToFloor = parseFloat(params.floorToFloor) || 10;
    const buildingType = params.buildingClassification || 'Office Mid Rise';
    const conversionType = params.conversionType || 'Standard';
    const qualityLevel = params.qualityLevel || 'Standard';
    const includeSeismic = params.includeSeismic || false;
    const includeWindows = params.includeWindows || false;
    const includeParkingConversion = params.includeParkingConversion || false;
    const parkingConversionUnits = parseInt(params.parkingConversionUnits) || 0;
    const totalUnits = parseInt(params.totalUnits) || 1;
    const acquisitionPrice = parseFloat(params.acquisitionPrice) || 0;
    const foundation = params.foundation || 'Unknown';

    const baseCost = BASE_COSTS[buildingType] || BASE_COSTS['Office Mid Rise'];
    const convMult = CONVERSION_MULTIPLIERS[conversionType] || CONVERSION_MULTIPLIERS['Standard'];
    const qualMult = QUALITY_MULTIPLIERS[qualityLevel] || QUALITY_MULTIPLIERS['Standard'];

    // Hard costs
    const hardCostLow = Math.round(buildingSF * baseCost.low * convMult.low * qualMult.low);
    const hardCostHigh = Math.round(buildingSF * baseCost.high * convMult.high * qualMult.high);

    // Seismic retrofit
    let seismicLow = 0, seismicHigh = 0;
    if (includeSeismic) {
      seismicLow = Math.round(buildingSF * SEISMIC_COST.low);
      seismicHigh = Math.round(buildingSF * SEISMIC_COST.high);
    }

    // Window replacement — estimate facade SF as perimeter x height
    let windowLow = 0, windowHigh = 0;
    if (includeWindows) {
      const typicalFloorSF = buildingSF / stories;
      const estWidth = floorplateWidth || Math.sqrt(typicalFloorSF);
      const estDepth = typicalFloorSF / (estWidth || 1);
      const perimeter = 2 * (estWidth + estDepth);
      const buildingHeight = stories * floorToFloor;
      const facadeSF = perimeter * buildingHeight;
      windowLow = Math.round(facadeSF * WINDOW_COST.low);
      windowHigh = Math.round(facadeSF * WINDOW_COST.high);
    }

    // Parking conversion
    let parkingConvLow = 0, parkingConvHigh = 0;
    if (includeParkingConversion && parkingConversionUnits > 0) {
      const avgUnitSF = 550;
      const convertedSF = parkingConversionUnits * avgUnitSF;
      parkingConvLow = Math.round(convertedSF * PARKING_CONVERSION_COST.low);
      parkingConvHigh = Math.round(convertedSF * PARKING_CONVERSION_COST.high);
    }

    // Foundation remediation
    let foundationLow = 0, foundationHigh = 0;
    let foundationIncluded = false;
    let foundationLabel = 'Foundation Remediation (estimated)';
    let foundationWarning = null;
    let foundationWarningColor = null;
    if (foundation === 'Fair') {
      foundationLow = Math.round(buildingSF * 8);
      foundationHigh = Math.round(buildingSF * 15);
      foundationIncluded = true;
    } else if (foundation === 'Poor') {
      foundationLow = Math.round(buildingSF * 20);
      foundationHigh = Math.round(buildingSF * 45);
      foundationIncluded = true;
      foundationWarning = 'Foundation remediation at this severity may render conversion uneconomic. Structural assessment strongly recommended.';
      foundationWarningColor = 'red';
    } else if (foundation === 'Unknown') {
      foundationLow = 0;
      foundationHigh = 0;
      foundationIncluded = true;
      foundationLabel = 'Foundation Remediation (unknown)';
      foundationWarning = 'Foundation cost unknown — budget $10-30/SF contingency';
      foundationWarningColor = 'amber';
    }

    // Total hard costs
    const totalHardLow = hardCostLow + seismicLow + windowLow + parkingConvLow + foundationLow;
    const totalHardHigh = hardCostHigh + seismicHigh + windowHigh + parkingConvHigh + foundationHigh;

    // Soft costs
    const aeLow = Math.round(totalHardLow * AE_PCT.low);
    const aeHigh = Math.round(totalHardHigh * AE_PCT.high);

    const linkageFee = Math.round(buildingSF * LINKAGE_FEE_PER_SF);
    const permitsLow = Math.round(totalHardLow * PERMITS_PCT.low) + linkageFee;
    const permitsHigh = Math.round(totalHardHigh * PERMITS_PCT.high) + linkageFee;

    const subtotalLow = totalHardLow + aeLow + permitsLow;
    const subtotalHigh = totalHardHigh + aeHigh + permitsHigh;

    const contingencyLow = Math.round(subtotalLow * CONTINGENCY_PCT.low);
    const contingencyHigh = Math.round(subtotalHigh * CONTINGENCY_PCT.high);

    const preFinanceLow = subtotalLow + contingencyLow;
    const preFinanceHigh = subtotalHigh + contingencyHigh;

    const financingLow = Math.round(preFinanceLow * FINANCING_PCT.low);
    const financingHigh = Math.round(preFinanceHigh * FINANCING_PCT.high);

    const totalProjectCostLow = preFinanceLow + financingLow;
    const totalProjectCostHigh = preFinanceHigh + financingHigh;

    const costPerUnitLow = totalUnits > 0 ? Math.round(totalProjectCostLow / totalUnits) : 0;
    const costPerUnitHigh = totalUnits > 0 ? Math.round(totalProjectCostHigh / totalUnits) : 0;

    const netRSF = buildingSF * 0.72; // rough net residential SF
    const costPerRSFLow = netRSF > 0 ? Math.round(totalProjectCostLow / netRSF) : 0;
    const costPerRSFHigh = netRSF > 0 ? Math.round(totalProjectCostHigh / netRSF) : 0;

    // Measure ULA transfer tax warning
    let ulaLow = 0, ulaHigh = 0;
    if (acquisitionPrice >= 5000000 && acquisitionPrice < 10000000) {
      ulaLow = Math.round(acquisitionPrice * 0.04);
      ulaHigh = ulaLow;
    } else if (acquisitionPrice >= 10000000) {
      ulaLow = Math.round(acquisitionPrice * 0.04);
      ulaHigh = Math.round(acquisitionPrice * 0.055);
    }

    return {
      buildingType,
      conversionType,
      qualityLevel,
      buildingSF,

      hardCost: { low: hardCostLow, high: hardCostHigh },
      seismic: { low: seismicLow, high: seismicHigh, included: includeSeismic },
      windows: { low: windowLow, high: windowHigh, included: includeWindows },
      parkingConversion: { low: parkingConvLow, high: parkingConvHigh, included: includeParkingConversion },
      foundation: { low: foundationLow, high: foundationHigh, included: foundationIncluded, label: foundationLabel, warning: foundationWarning, warningColor: foundationWarningColor },
      ae: { low: aeLow, high: aeHigh },
      permits: { low: permitsLow, high: permitsHigh },
      contingency: { low: contingencyLow, high: contingencyHigh },
      financing: { low: financingLow, high: financingHigh },

      totalProjectCost: { low: totalProjectCostLow, high: totalProjectCostHigh },
      costPerUnit: { low: costPerUnitLow, high: costPerUnitHigh },
      costPerRSF: { low: costPerRSFLow, high: costPerRSFHigh },

      ula: { low: ulaLow, high: ulaHigh, applicable: acquisitionPrice >= 5000000 },
      linkageFee,

      // Midpoint for pro forma use
      midpoint: Math.round((totalProjectCostLow + totalProjectCostHigh) / 2)
    };
  }

  return { calculate, BASE_COSTS };
})();
