/**
 * ARO Scoring Engine — Shared between Tab 1 (Single Screener) and Tab 2 (Map)
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const AROScoring = (() => {
  const CURRENT_YEAR = 2026;

  const SCORE_THRESHOLDS = [
    { min: 80, label: 'Exceptional', desc: 'Prioritize for outreach and deal packaging' },
    { min: 60, label: 'Strong', desc: 'Merits deeper due diligence and lender conversations' },
    { min: 40, label: 'Moderate', desc: 'Viable with right ownership motivation and structure' },
    { min: 20, label: 'Limited', desc: 'Monitor as market conditions evolve' },
    { min: 0, label: 'Low', desc: 'Confirm eligibility details before pursuing' }
  ];

  function getEligibility(yearBuilt, useType, neighborhood) {
    const buildingAge = CURRENT_YEAR - yearBuilt;
    const isParking = useType === 'Parking Structure';

    if (neighborhood === 'Downtown LA') {
      return {
        status: 'conditional',
        verdict: 'Downtown: Separate Program',
        explanation: 'Downtown Los Angeles operates under the Downtown Community Plan Adaptive Reuse Program, which has its own set of regulations and incentives separate from the Citywide ARO. Properties in DTLA should be evaluated under that program\'s specific criteria.',
        buildingAge
      };
    } else if (buildingAge >= 15 || (isParking && buildingAge >= 5)) {
      return {
        status: 'eligible',
        verdict: '\u2713 By-Right Eligible',
        explanation: `This property qualifies for by-right adaptive reuse conversion under the 2026 Citywide ARO. At ${buildingAge} years old, it meets the minimum age threshold${isParking ? ' (5-year minimum for parking structures)' : ' (15-year minimum)'}. Conversion requires only city staff approval with no discretionary review, meaning faster timelines and lower entitlement risk.`,
        buildingAge
      };
    } else if (buildingAge >= 5 && buildingAge < 15) {
      return {
        status: 'conditional',
        verdict: '\u25D0 Conditional \u2014 ZA Approval Required',
        explanation: `At ${buildingAge} years old, this property falls in the conditional eligibility window (5\u201314 years). Conversion is possible but requires Zoning Administrator (ZA) approval, which introduces discretionary review, longer timelines, and potential conditions of approval. Prepare for a more involved entitlement process.`,
        buildingAge
      };
    } else {
      return {
        status: 'ineligible',
        verdict: '\u2717 Below Minimum Age Threshold',
        explanation: `At ${buildingAge} year${buildingAge !== 1 ? 's' : ''} old, this property does not meet the minimum building age requirement for adaptive reuse under the Citywide ARO. Buildings must be at least 5 years old for conditional eligibility or 15 years old for by-right approval.`,
        buildingAge
      };
    }
  }

  function calculateScore(params) {
    let score = 0;
    const factors = [];
    const buildingAge = CURRENT_YEAR - (params.yearBuilt || CURRENT_YEAR);

    // Building Age
    if (buildingAge >= 40) {
      score += 20;
      factors.push({ label: 'Building Age', value: `${buildingAge} years`, note: 'Well-seasoned asset — higher conversion likelihood', points: 20, sentiment: 'positive' });
    } else if (buildingAge >= 15) {
      score += 14;
      factors.push({ label: 'Building Age', value: `${buildingAge} years`, note: 'Meets by-right age threshold', points: 14, sentiment: 'positive' });
    } else if (buildingAge >= 5) {
      score += 6;
      factors.push({ label: 'Building Age', value: `${buildingAge} years`, note: 'Conditional path — ZA approval needed', points: 6, sentiment: 'neutral' });
    } else {
      factors.push({ label: 'Building Age', value: `${buildingAge} years`, note: 'Below minimum age threshold', points: 0, sentiment: 'negative' });
    }

    // Vacancy Rate
    const vacancy = params.vacancyRate || 'Unknown';
    if (vacancy === '76-100%') {
      score += 22;
      factors.push({ label: 'Vacancy Rate', value: vacancy, note: 'Severely distressed — strong conversion catalyst', points: 22, sentiment: 'positive' });
    } else if (vacancy === '51-75%') {
      score += 16;
      factors.push({ label: 'Vacancy Rate', value: vacancy, note: 'Significant vacancy supports conversion thesis', points: 16, sentiment: 'positive' });
    } else if (vacancy === '31-50%') {
      score += 10;
      factors.push({ label: 'Vacancy Rate', value: vacancy, note: 'Material vacancy — conversion may pencil', points: 10, sentiment: 'neutral' });
    } else if (vacancy === '11-30%') {
      score += 4;
      factors.push({ label: 'Vacancy Rate', value: vacancy, note: 'Moderate vacancy', points: 4, sentiment: 'neutral' });
    } else {
      factors.push({ label: 'Vacancy Rate', value: vacancy, note: vacancy === 'Unknown' ? 'Vacancy data not provided' : 'Low vacancy — owner less motivated to convert', points: 0, sentiment: vacancy === 'Unknown' ? 'neutral' : 'negative' });
    }

    // Use Type
    const useType = params.useType || '';
    const officeOrHotel = useType.includes('Office') || useType === 'Hotel';
    const industrialRetailParking = useType.includes('Industrial') || useType.includes('Retail') || useType === 'Parking Structure';

    if (officeOrHotel) {
      score += 16;
      factors.push({ label: 'Current Use', value: useType, note: 'Prime conversion candidate — office/hotel to residential is core ARO use case', points: 16, sentiment: 'positive' });
    } else if (industrialRetailParking) {
      score += 12;
      factors.push({ label: 'Current Use', value: useType, note: 'Eligible use type with conversion potential', points: 12, sentiment: 'positive' });
    } else {
      factors.push({ label: 'Current Use', value: useType || 'Not specified', note: 'Use type not in primary ARO conversion categories', points: 0, sentiment: 'neutral' });
    }

    // Floorplate
    const floorplate = params.floorplateShape || 'Unknown';
    if (floorplate.includes('Narrow')) {
      score += 14;
      factors.push({ label: 'Floorplate', value: 'Narrow/Efficient', note: 'Ideal for residential unit layout — minimizes dark interior space', points: 14, sentiment: 'positive' });
    } else if (floorplate.includes('Medium')) {
      score += 8;
      factors.push({ label: 'Floorplate', value: 'Medium depth', note: 'Workable for residential with some interior units needing light wells', points: 8, sentiment: 'neutral' });
    } else if (floorplate.includes('Deep')) {
      score += 2;
      factors.push({ label: 'Floorplate', value: 'Deep/Challenging', note: 'Deep floorplate increases conversion cost — may need light wells or courts', points: 2, sentiment: 'negative' });
    } else {
      factors.push({ label: 'Floorplate', value: 'Unknown', note: 'Floorplate data not available', points: 0, sentiment: 'neutral' });
    }

    // Historic Designation
    const historic = params.historicDesignation || 'None';
    if (historic !== 'None' && historic !== 'Unknown') {
      score += 12;
      factors.push({ label: 'Historic Status', value: historic, note: '20% Federal HTC + CA HTC stackable — significant equity source', points: 12, sentiment: 'positive' });
    } else {
      factors.push({ label: 'Historic Status', value: historic, note: historic === 'Unknown' ? 'Research historic status for potential tax credit equity' : 'No historic designation — standard conversion path', points: 0, sentiment: 'neutral' });
    }

    // Affordable Strategy
    const affordable = params.affordableStrategy || 'None-market rate only';
    if (affordable === '100% Affordable') {
      score += 10;
      factors.push({ label: 'Affordable Strategy', value: '100% Affordable', note: 'Maximum density bonus + height increase + HUD financing eligible', points: 10, sentiment: 'positive' });
    } else if (affordable.includes('25%')) {
      score += 8;
      factors.push({ label: 'Affordable Strategy', value: '\u226525% of units', note: 'Strong density bonus tier + tax-exempt bond financing potential', points: 8, sentiment: 'positive' });
    } else if (affordable.includes('11%')) {
      score += 5;
      factors.push({ label: 'Affordable Strategy', value: '\u226511% of units', note: 'Base density bonus tier qualifying', points: 5, sentiment: 'positive' });
    } else {
      factors.push({ label: 'Affordable Strategy', value: 'Market rate', note: 'No density bonus — standard unit count', points: 0, sentiment: 'neutral' });
    }

    // Zoning
    const zoning = params.zoning || 'Unknown';
    if (['C2', 'C4', 'CM'].includes(zoning)) {
      score += 6;
      factors.push({ label: 'Zoning', value: zoning, note: 'Commercial zone — standard ARO pathway', points: 6, sentiment: 'positive' });
    } else if (zoning === 'P \u2013 Parking') {
      score += 8;
      factors.push({ label: 'Zoning', value: 'P \u2013 Parking', note: 'Parking zone with unique conversion opportunity', points: 8, sentiment: 'positive' });
    } else if (['M1', 'M2'].includes(zoning)) {
      score += 4;
      factors.push({ label: 'Zoning', value: zoning, note: 'Industrial zone — conversion eligible under ARO', points: 4, sentiment: 'neutral' });
    } else {
      factors.push({ label: 'Zoning', value: zoning, note: zoning === 'Unknown' ? 'Verify zoning via ZIMAS' : 'Check ARO eligibility for this zone', points: 0, sentiment: 'neutral' });
    }

    score = Math.min(score, 100);

    const threshold = SCORE_THRESHOLDS.find(t => score >= t.min);

    return { score, factors, threshold };
  }

  function getDealAngles(params, eligibility) {
    const angles = [];
    const buildingAge = CURRENT_YEAR - (params.yearBuilt || CURRENT_YEAR);
    const vacancy = params.vacancyRate || '';
    const historic = params.historicDesignation || 'None';
    const affordable = params.affordableStrategy || 'None-market rate only';

    // Always include these three
    angles.push({
      icon: '\u26A1',
      title: 'By-Right Speed Advantage',
      desc: 'ARO eliminates discretionary review for eligible buildings. No public hearings, no CEQA, no conditional use permits — just city staff approval. This means 6\u201312 month faster entitlement vs. traditional rezoning.'
    });

    angles.push({
      icon: '\uD83C\uDF31',
      title: 'ESG & Sustainability Story',
      desc: 'Adaptive reuse preserves embodied carbon, reduces construction waste, and revitalizes existing urban fabric. Increasingly attractive to ESG-focused institutional investors and green bond programs.'
    });

    angles.push({
      icon: '\uD83D\uDCC8',
      title: 'Office-to-Resi Market Timing',
      desc: 'LA office vacancy at historic highs while housing demand remains acute. Conversion economics increasingly favorable as office values decline and residential rents strengthen.'
    });

    // Conditional angles
    if (buildingAge >= 40) {
      angles.push({
        icon: '\uD83C\uDFDA\uFE0F',
        title: 'Distressed Owner / Legacy Asset',
        desc: `At ${buildingAge} years old, the current owner may face rising deferred maintenance costs, declining NOI, and limited refinancing options. This creates acquisition opportunities at favorable basis.`
      });
    }

    if (historic !== 'None' && historic !== 'Unknown') {
      angles.push({
        icon: '\uD83C\uDFDB\uFE0F',
        title: 'Historic Tax Credit Bridge',
        desc: '20% Federal Historic Tax Credit + California State HTC are stackable, creating significant equity fill. HTC equity can bridge 15\u201325% of total development cost when combined with NMTC or other programs.'
      });
    }

    if (affordable !== 'None-market rate only' && affordable !== 'Unknown') {
      angles.push({
        icon: '\uD83C\uDFE2',
        title: 'Bonus Density & Height Play',
        desc: 'Affordable component unlocks AB 2011/SB 1227 density bonuses. Depending on AMI tier and percentage, projects can receive 35\u201380% additional density plus height increases, dramatically improving unit count.'
      });
    }

    if (vacancy === '51-75%' || vacancy === '76-100%') {
      angles.push({
        icon: '\uD83D\uDCB0',
        title: 'Distressed Debt / Note Sale',
        desc: `With ${vacancy} vacancy, the existing loan may be in special servicing or default. Monitor for note sales or REO opportunities — potential to acquire at significant discount to replacement cost.`
      });
    }

    return angles;
  }

  function getFinancingPathways(params) {
    const pathways = [];
    const affordable = params.affordableStrategy || 'None-market rate only';
    const historic = params.historicDesignation || 'None';
    const value = parseFloat(params.estimatedValue) || 0;
    const sf = parseFloat(params.buildingSF) || 0;
    const hasAffordable = affordable !== 'None-market rate only' && affordable !== 'Unknown';
    const hasHistoric = historic !== 'None' && historic !== 'Unknown';

    // Always include these
    pathways.push({
      title: 'Construction / Perm Bridge',
      detail: '65\u201370% LTC  |  Float + 2.5\u20133.5%',
      desc: 'Bank or credit union construction-to-permanent loan. Best for well-capitalized sponsors with track record. 12\u201324 month construction draw period, converting to 5\u20137 year mini-perm.'
    });

    pathways.push({
      title: 'Debt Fund / Bridge Loan',
      detail: '12\u201336mo IO  |  70\u201380% LTC',
      desc: 'Non-bank bridge lender for faster execution. Higher cost of capital (8\u201312%) but accommodates transitional assets, lighter documentation, and value-add business plans.'
    });

    pathways.push({
      title: 'SBA 504 (Owner-Occupied)',
      detail: 'Up to 90% LTV  |  Below-market rate',
      desc: 'If any portion is owner-occupied (e.g., ground floor commercial retained by sponsor), SBA 504 offers up to 90% LTV with 25-year fixed-rate terms through CDC participation.'
    });

    // Conditional pathways
    if (hasAffordable || hasHistoric) {
      pathways.push({
        title: 'HUD 221(d)(4)',
        detail: 'Non-recourse  |  40yr term  |  85\u201390% LTV',
        desc: 'FHA-insured permanent loan for new construction / substantial rehab of multifamily. Non-recourse, fully amortizing, lowest long-term cost of capital. 12\u201318 month approval timeline.'
      });
    }

    if (hasHistoric) {
      pathways.push({
        title: 'Historic Tax Credit Equity',
        detail: '20% Federal HTC  |  Syndication',
        desc: 'Federal 20% HTC on qualified rehabilitation expenditures. Typically syndicated through tax credit investor at $0.90\u2013$0.95 per dollar of credit. Can be combined with LIHTC for affordable projects.'
      });
    }

    if (value > 10000000 || sf > 50000) {
      pathways.push({
        title: 'CMBS / Conduit',
        detail: 'Post-stabilization  |  ~70\u201375% LTV',
        desc: 'Conduit securitized loan for stabilized asset. Non-recourse, 10-year term, competitive pricing. Best deployed after conversion and lease-up are complete. Minimum $5M loan size typical.'
      });
    }

    return pathways;
  }

  function getFinancingNotes(params) {
    const notes = [];
    const value = parseFloat(params.estimatedValue) || 0;
    const affordable = params.affordableStrategy || 'None-market rate only';
    const hasAffordable = affordable !== 'None-market rate only' && affordable !== 'Unknown';

    if (value >= 5000000) {
      notes.push({
        type: 'warning',
        title: 'Measure ULA Transfer Tax',
        text: `At an estimated value of $${(value / 1000000).toFixed(1)}M, this transaction is subject to Measure ULA (effective April 2023). Transactions $5M\u2013$10M incur a 4% transfer tax; over $10M incur 5.5%. Factor this into acquisition basis and return modeling.`
      });
    }

    if (hasAffordable) {
      notes.push({
        type: 'info',
        title: 'Affordable Financing Resources',
        text: 'CDLAC/TCAC tax-exempt bond allocation may be available for projects with \u226550% affordable units. HCIDLA (LA Housing Department) provides gap financing through NOFA rounds for qualifying projects. TOD incentives may apply near transit.'
      });
    }

    return notes;
  }

  function getScoreColor(score) {
    if (score >= 60) return 'eligible';
    if (score >= 40) return 'conditional';
    return 'ineligible';
  }

  // Simplified scoring for map parcels with limited data
  function calculateParcelScore(parcel) {
    const yearBuilt = parseInt(parcel.effectiveyearbuilt) || 0;
    const buildingAge = CURRENT_YEAR - yearBuilt;
    const useDesc = (parcel.usedescription || '').toLowerCase();
    let score = 0;

    // Age scoring
    if (buildingAge >= 40) score += 20;
    else if (buildingAge >= 15) score += 14;
    else if (buildingAge >= 5) score += 6;

    // Use type scoring
    if (useDesc.includes('office') || useDesc.includes('hotel')) score += 16;
    else if (useDesc.includes('industrial') || useDesc.includes('retail') || useDesc.includes('warehouse') || useDesc.includes('parking')) score += 12;
    else if (useDesc.includes('commercial') || useDesc.includes('store') || useDesc.includes('bank') || useDesc.includes('restaurant')) score += 10;

    // Size bonus (larger = more units potential)
    const sf = parseInt(parcel.sqftmain) || 0;
    if (sf >= 50000) score += 10;
    else if (sf >= 25000) score += 7;
    else if (sf >= 10000) score += 4;

    return Math.min(score, 100);
  }

  function getParcelEligibility(parcel) {
    const yearBuilt = parseInt(parcel.effectiveyearbuilt) || 0;
    const useDesc = (parcel.usedescription || '').toLowerCase();
    const isParking = useDesc.includes('parking');
    return getEligibility(yearBuilt, isParking ? 'Parking Structure' : '', '');
  }

  return {
    CURRENT_YEAR,
    SCORE_THRESHOLDS,
    getEligibility,
    calculateScore,
    getDealAngles,
    getFinancingPathways,
    getFinancingNotes,
    getScoreColor,
    calculateParcelScore,
    getParcelEligibility
  };
})();
