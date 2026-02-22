/**
 * Residential Unit Yield Estimator
 * Commercial Lending Solutions — Conversion Feasibility Analyzer
 */

const YieldCalculator = (() => {

  // Gross-to-net efficiency by building type
  const EFFICIENCY_FACTORS = {
    'Office Low Rise':      { low: 0.75, high: 0.80 },
    'Office Mid Rise':      { low: 0.70, high: 0.75 },
    'Office High Rise':     { low: 0.65, high: 0.72 },
    'Warehouse/Industrial': { low: 0.80, high: 0.85 },
    'Hotel/Motel':          { low: 0.85, high: 0.90 },
    'Retail/Commercial':    { low: 0.72, high: 0.78 },
    'Parking Structure':    { low: 0.70, high: 0.78 }
  };

  // Core penalty by lease span (floorplate depth)
  function getCorePenalty(depth) {
    if (depth <= 40) return 0;
    if (depth <= 55) return 0.08;
    return 0.17; // midpoint of 15-20%
  }

  // Unit sizes and mix based on floorplate width
  function getUnitMix(floorplateWidth) {
    if (floorplateWidth <= 50) {
      return {
        studio: { sf_low: 380, sf_high: 500, sf_base: 420, pct: 0.50 },
        oneBR:  { sf_low: 550, sf_high: 750, sf_base: 650, pct: 0.45 },
        twoBR:  { sf_low: 850, sf_high: 950, sf_base: 900, pct: 0.05 }
      };
    } else if (floorplateWidth <= 80) {
      return {
        studio: { sf_low: 400, sf_high: 500, sf_base: 440, pct: 0.35 },
        oneBR:  { sf_low: 600, sf_high: 750, sf_base: 650, pct: 0.45 },
        twoBR:  { sf_low: 900, sf_high: 1050, sf_base: 950, pct: 0.20 }
      };
    } else {
      return {
        studio: { sf_low: 420, sf_high: 500, sf_base: 450, pct: 0.25 },
        oneBR:  { sf_low: 625, sf_high: 750, sf_base: 680, pct: 0.40 },
        twoBR:  { sf_low: 900, sf_high: 1100, sf_base: 950, pct: 0.35 }
      };
    }
  }

  // Map use type from Module 1 to efficiency category
  function mapUseType(useType, stories) {
    if (!useType) return 'Office Mid Rise';
    const u = useType.toLowerCase();
    if (u.includes('warehouse') || u.includes('industrial')) return 'Warehouse/Industrial';
    if (u.includes('hotel') || u.includes('motel')) return 'Hotel/Motel';
    if (u.includes('retail') || u.includes('shopping') || u.includes('commercial')) return 'Retail/Commercial';
    if (u.includes('parking')) return 'Parking Structure';
    // Office by story count
    const s = parseInt(stories) || 5;
    if (s <= 4) return 'Office Low Rise';
    if (s <= 12) return 'Office Mid Rise';
    return 'Office High Rise';
  }

  /**
   * Calculate unit yield
   * @param {Object} params - Module 1 data
   * @returns {Object} yield analysis with conservative/base/optimistic
   */
  function calculate(params) {
    const totalSF = parseFloat(params.totalBuildingSF) || 0;
    const stories = parseInt(params.stories) || 1;
    const floorplateWidth = parseFloat(params.floorplateWidth) || 70;
    const floorplateDepth = parseFloat(params.floorplateDepth) || 45;
    const typicalFloorSF = parseFloat(params.typicalFloorSF) || (totalSF / stories);
    const surfaceParking = parseInt(params.surfaceParking) || 0;
    const structuredParking = parseInt(params.structuredParking) || 0;
    const useType = params.useType || '';

    const buildingType = mapUseType(useType, stories);
    const eff = EFFICIENCY_FACTORS[buildingType] || EFFICIENCY_FACTORS['Office Mid Rise'];
    const corePenalty = getCorePenalty(floorplateDepth);
    const unitMix = getUnitMix(floorplateWidth);

    // Calculate net residential SF for each scenario
    const effLow = Math.max(eff.low - corePenalty, 0.45);
    const effBase = Math.max((eff.low + eff.high) / 2 - corePenalty, 0.50);
    const effHigh = Math.max(eff.high - corePenalty, 0.55);

    const netSF_conservative = totalSF * effLow;
    const netSF_base = totalSF * effBase;
    const netSF_optimistic = totalSF * effHigh;

    // Weighted average unit size
    function calcUnits(netSF, scenario) {
      const mix = unitMix;
      // scenario adjusts unit sizes: conservative=larger units, optimistic=smaller
      const sizeMult = scenario === 'conservative' ? 1.05 : (scenario === 'optimistic' ? 0.95 : 1.0);

      const studioSF = mix.studio.sf_base * sizeMult;
      const oneBRSF = mix.oneBR.sf_base * sizeMult;
      const twoBRSF = mix.twoBR.sf_base * sizeMult;

      const weightedAvg = (studioSF * mix.studio.pct) + (oneBRSF * mix.oneBR.pct) + (twoBRSF * mix.twoBR.pct);
      const totalUnits = Math.floor(netSF / weightedAvg);

      const studioUnits = Math.round(totalUnits * mix.studio.pct);
      const oneBRUnits = Math.round(totalUnits * mix.oneBR.pct);
      const twoBRUnits = Math.max(0, totalUnits - studioUnits - oneBRUnits);

      return {
        studio: { units: studioUnits, sf: Math.round(studioSF) },
        oneBR: { units: oneBRUnits, sf: Math.round(oneBRSF) },
        twoBR: { units: twoBRUnits, sf: Math.round(twoBRSF) },
        total: totalUnits,
        netSF: Math.round(netSF),
        efficiency: scenario === 'conservative' ? effLow : (scenario === 'optimistic' ? effHigh : effBase)
      };
    }

    const conservative = calcUnits(netSF_conservative, 'conservative');
    const base = calcUnits(netSF_base, 'base');
    const optimistic = calcUnits(netSF_optimistic, 'optimistic');

    // Parking conversion bonus
    const parkingBonusUnits = Math.floor(surfaceParking / 2);

    return {
      buildingType,
      conservative,
      base,
      optimistic,
      parkingBonusUnits,
      surfaceParking,
      structuredParking,
      unitMix,
      corePenalty: Math.round(corePenalty * 100),
      floorplateWidth,
      floorplateDepth,
      totalSF
    };
  }

  /**
   * Layout Feasibility Stress-Test (Enhancement B)
   * Adjusts yield based on corridor width and minimum window distance
   * Methodology: Office Shift Pro daylight stress-test
   * @param {Object} params - { floorplateDepth, corridorWidth, minWindowDist }
   * @returns {Object} { factor, label, usableDepthPerSide, windowStress }
   */
  function adjustYieldForLayout(params) {
    const floorplateDepth = parseFloat(params.floorplateDepth) || 45;
    const corridorWidth = parseFloat(params.corridorWidth) || 6;
    const minWindowDist = parseFloat(params.minWindowDist) || 25;

    const usableDepthPerSide = (floorplateDepth - corridorWidth) / 2;
    const windowStress = usableDepthPerSide - minWindowDist;

    let factor, label;
    if (windowStress <= -10) {
      factor = 1.08;
      label = 'Favorable';
    } else if (windowStress <= 0) {
      factor = 0.97;
      label = 'Neutral';
    } else if (windowStress <= 8) {
      factor = 0.91;
      label = 'Tight';
    } else {
      factor = 0.83;
      label = 'Stressed';
    }

    return { factor, label, usableDepthPerSide: Math.round(usableDepthPerSide * 10) / 10, windowStress: Math.round(windowStress * 10) / 10 };
  }

  return { calculate, adjustYieldForLayout, mapUseType, EFFICIENCY_FACTORS };
})();
