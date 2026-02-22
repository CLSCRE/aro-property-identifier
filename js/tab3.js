/**
 * Tab 3: Conversion Feasibility Analyzer
 * Commercial Lending Solutions — UI controller, module progression, ESG, report generation
 */

const FeasibilityTab = (() => {
  // Module state
  const modules = {
    1: { completed: false, expanded: false },
    2: { completed: false, expanded: false },
    3: { completed: false, expanded: false },
    4: { completed: false, expanded: false },
    5: { completed: false, expanded: false }
  };

  // Cached calculation results
  let physicalResult = null;
  let yieldResult = null;
  let costResult = null;
  let proFormaResult = null;
  let esgResult = null;
  let prePopulatedData = null;

  // ─── Dollar Formatting ───
  function fmt(n) {
    if (n === 0) return '$0';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(n).toLocaleString();
  }

  function fmtFull(n) {
    return '$' + Math.round(n).toLocaleString();
  }

  function pct(n) {
    return n.toFixed(1) + '%';
  }

  // ─── Module Progression ───
  function toggleModule(num) {
    const card = document.getElementById('module-' + num);
    if (!card || card.classList.contains('locked')) return;

    if (card.classList.contains('expanded')) {
      card.classList.remove('expanded');
      modules[num].expanded = false;
    } else {
      // Collapse others
      document.querySelectorAll('.module-card.expanded').forEach(c => c.classList.remove('expanded'));
      Object.keys(modules).forEach(k => modules[k].expanded = false);
      card.classList.add('expanded');
      modules[num].expanded = true;
    }
  }

  function completeModule(num) {
    modules[num].completed = true;
    const card = document.getElementById('module-' + num);
    if (card) {
      card.classList.add('completed');
      card.classList.remove('active');
    }

    // Update progress bar
    updateProgress();

    // Unlock and auto-expand next module
    const next = num + 1;
    if (next <= 5) {
      const nextCard = document.getElementById('module-' + next);
      if (nextCard) {
        nextCard.classList.remove('locked');
        nextCard.classList.add('active');
        setTimeout(() => {
          toggleModule(next);
          nextCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }

    // Show report when all 5 complete
    if (num === 5) {
      setTimeout(() => generateReport(), 400);
    }
  }

  function updateProgress() {
    for (let i = 1; i <= 5; i++) {
      const step = document.getElementById('progress-step-' + i);
      const conn = document.getElementById('progress-conn-' + i);
      if (!step) continue;

      step.classList.remove('active', 'completed');
      if (modules[i].completed) {
        step.classList.add('completed');
        if (conn) conn.classList.add('completed');
      } else if (i === 1 || modules[i - 1].completed) {
        step.classList.add('active');
      }
    }

    // Report step
    const reportStep = document.getElementById('progress-step-report');
    if (reportStep) {
      reportStep.classList.remove('active', 'completed');
      if (modules[5].completed) reportStep.classList.add('completed');
    }
  }

  // ─── Conversion Scope ───
  function getConversionScope() {
    const radios = document.querySelectorAll('input[name="conversion-scope"]');
    let scope = 'full';
    radios.forEach(r => { if (r.checked) scope = r.value; });
    return scope;
  }

  function isPartialConversion() {
    return getConversionScope() === 'partial';
  }

  function getConversionSF() {
    if (!physicalResult) return 0;
    if (!isPartialConversion()) return physicalResult.totalSF;
    const storiesToConvert = parseInt(document.getElementById('m1-stories-to-convert').value) || 0;
    const totalStories = physicalResult.stories;
    if (totalStories <= 0 || storiesToConvert <= 0) return physicalResult.totalSF;
    return Math.round(physicalResult.totalSF * (storiesToConvert / totalStories));
  }

  function getRetainedSF() {
    if (!physicalResult || !isPartialConversion()) return 0;
    return physicalResult.totalSF - getConversionSF();
  }

  function onScopeChange() {
    const partial = isPartialConversion();
    document.getElementById('partial-conversion-inputs').style.display = partial ? '' : 'none';
    updateRetainedStories();
  }

  function updateRetainedStories() {
    const totalStories = parseInt(document.getElementById('m1-stories').value) || 0;
    const storiesToConvert = parseInt(document.getElementById('m1-stories-to-convert').value) || 0;
    const retained = Math.max(0, totalStories - storiesToConvert);
    document.getElementById('m1-retained-stories').value = retained > 0 ? retained : '';
  }

  // ─── MODULE 1: Physical Feasibility (Gensler 5-Category) ───
  function calculatePhysical() {
    const depth = parseFloat(document.getElementById('m1-depth').value) || 0;
    const width = parseFloat(document.getElementById('m1-width').value) || 0;
    const f2f = parseFloat(document.getElementById('m1-f2f').value) || 0;
    const stories = parseInt(document.getElementById('m1-stories').value) || 0;
    const totalSF = parseFloat(document.getElementById('m1-total-sf').value) || 0;
    const typicalFloorSF = parseFloat(document.getElementById('m1-typical-sf').value) || 0;
    const windowType = document.getElementById('m1-window-type').value;
    const facadeMaterial = document.getElementById('m1-facade').value;
    const structural = document.getElementById('m1-structural').value;
    const seismic = document.getElementById('m1-seismic').value;
    const mep = document.getElementById('m1-mep').value;
    const elevators = parseInt(document.getElementById('m1-elevators').value) || 0;
    const loadingDock = document.getElementById('m1-loading').value;
    const foundation = document.getElementById('m1-foundation').value;
    const surfaceParking = parseInt(document.getElementById('m1-surface-parking').value) || 0;
    const structuredParking = parseInt(document.getElementById('m1-structured-parking').value) || 0;
    const siteArea = parseFloat(document.getElementById('m1-site-area').value) || 0;

    // Character features
    const characterChecks = document.querySelectorAll('.character-check input:checked');
    const characterCount = characterChecks.length;
    const characterFeatures = Array.from(characterChecks).map(c => c.value);

    // Validation
    if (!depth || !width || !f2f || !stories || !totalSF) {
      return;
    }

    // Update retained stories if partial
    updateRetainedStories();

    // Neighborhood from pre-populated data
    const neighborhood = prePopulatedData ? (prePopulatedData.neighborhood || '') : '';

    // ═══ GENSLER 5-CATEGORY SCORING ═══

    // CATEGORY 1 — SITE CONTEXT
    let cat1Score = 8, cat1Text = 'Location not specified — verify residential demand';
    const nbLower = neighborhood.toLowerCase();
    if (nbLower.includes('downtown') || nbLower.includes('arts district') || nbLower.includes('culver') || nbLower.includes('santa monica')) {
      cat1Score = 19; cat1Text = 'Strong urban location with walkable amenities and transit access';
    } else if (nbLower.includes('hollywood') || nbLower.includes('koreatown') || nbLower.includes('wilshire') || nbLower.includes('west la') || nbLower.includes('brentwood') || nbLower.includes('century')) {
      cat1Score = 16; cat1Text = 'Established submarket with strong residential demand';
    } else if (nbLower.includes('sherman') || nbLower.includes('burbank') || nbLower.includes('glendale') || nbLower.includes('pasadena') || nbLower.includes('el segundo') || nbLower.includes('playa')) {
      cat1Score = 12; cat1Text = 'Suburban location — residential demand needs verification';
    } else if (nbLower.includes('long beach')) {
      cat1Score = 14; cat1Text = 'Growing urban market with conversion precedent';
    } else if (neighborhood && neighborhood !== 'Other LA') {
      cat1Score = 12; cat1Text = 'Submarket identified — verify transit and amenity access';
    }

    // CATEGORY 2 — BUILDING SHAPE
    let cat2Score = 12, cat2Text = 'Building profile assessment pending';
    if (stories >= 2 && stories <= 8) {
      cat2Score = 19; cat2Text = 'Low-rise profile ideal for cost-effective conversion';
    } else if (stories >= 9 && stories <= 14) {
      cat2Score = 16; cat2Text = 'Mid-rise — manageable conversion complexity';
    } else if (stories >= 15) {
      cat2Score = 11; cat2Text = 'High-rise adds structural and MEP complexity';
    } else if (stories === 1) {
      cat2Score = 11; cat2Text = 'Single story — may lack unit count for efficient economics';
    }
    // Character bonus
    if (characterCount >= 5) {
      cat2Score = Math.min(20, cat2Score + 2);
      cat2Text += '. Strong character features add premium positioning.';
    }

    // CATEGORY 3 — FLOORPLATE EFFICIENCY
    let cat3Score = 8, cat3Text = 'Depth unknown — field verify before proceeding';
    if (depth > 0 && depth <= 35) {
      cat3Score = 20; cat3Text = 'Exceptional — ideal residential depth';
    } else if (depth >= 36 && depth <= 45) {
      cat3Score = 18; cat3Text = 'Excellent — efficient unit layouts achievable';
    } else if (depth >= 46 && depth <= 55) {
      cat3Score = 13; cat3Text = 'Workable — light well or atrium may help';
    } else if (depth >= 56 && depth <= 70) {
      cat3Score = 7; cat3Text = 'Challenging — significant core intervention needed';
    } else if (depth > 70) {
      cat3Score = 3; cat3Text = 'Very difficult — may require courtyard cut';
    }

    // CATEGORY 4 — ENVELOPE (WINDOWS)
    let cat4Score = 8, cat4Text = 'Window type unknown — field assessment needed';
    if (windowType.includes('Operable')) {
      cat4Score = 19; cat4Text = 'Original operable windows — residential-ready, character asset';
    } else if (windowType.includes('Ribbon')) {
      cat4Score = 19; cat4Text = 'Ribbon windows — excellent for residential, character asset';
    } else if (windowType.includes('Fixed')) {
      cat4Score = 15; cat4Text = 'Replaceable windows — cost adder but solvable';
    } else if (windowType.includes('Sealed')) {
      cat4Score = 7; cat4Text = 'Sealed curtain wall — full window replacement required, significant cost';
    }

    // CATEGORY 5 — SERVICING (PARKING)
    const excessParking = surfaceParking;
    let cat5Score = 6, cat5Text = 'Parking assessment needed';
    if (excessParking >= 10) {
      cat5Score = 19; cat5Text = 'Surplus surface parking = bonus unit yield opportunity';
    } else if (excessParking >= 1 && excessParking <= 9) {
      cat5Score = 16; cat5Text = 'Adequate parking with some excess capacity';
    } else if (structuredParking > 0) {
      cat5Score = 12; cat5Text = 'Parking at or near residential requirement';
    } else {
      // Urban/transit offset
      if (cat1Score >= 16) {
        cat5Score = 8; cat5Text = 'No parking — offset by strong transit/urban location';
      } else {
        cat5Score = 5; cat5Text = 'Parking deficit — may need to acquire or lease parking';
      }
    }

    // TOTAL SCORE
    const totalPhysicalScore = cat1Score + cat2Score + cat3Score + cat4Score + cat5Score;

    let totalLabel, totalColor;
    if (totalPhysicalScore >= 85) {
      totalLabel = 'Exceptional Physical Candidate';
      totalColor = 'green';
    } else if (totalPhysicalScore >= 70) {
      totalLabel = 'Strong Physical Candidate';
      totalColor = 'green';
    } else if (totalPhysicalScore >= 50) {
      totalLabel = 'Good Candidate — Some Design Intervention Required';
      totalColor = 'amber';
    } else if (totalPhysicalScore >= 30) {
      totalLabel = 'Conditional — Significant Challenges to Solve';
      totalColor = 'amber';
    } else {
      totalLabel = 'Difficult — Detailed Study Required Before Proceeding';
      totalColor = 'red';
    }

    // Foundation condition flags
    let foundationFlag = null;
    if (foundation === 'Poor') {
      foundationFlag = { color: 'red', text: 'High Risk — foundation remediation may exceed project economics. Structural engineer review required before proceeding.' };
    } else if (foundation === 'Unknown') {
      foundationFlag = { color: 'amber', text: 'Foundation condition unverified — order Phase I/structural assessment before committing capital.' };
    } else if (foundation === 'Fair') {
      foundationFlag = { color: 'amber', text: 'Moderate foundation remediation expected (5-15% of budget).' };
    }

    physicalResult = {
      depth, width, f2f, stories, totalSF, typicalFloorSF,
      windowType, facadeMaterial, structural, seismic, mep,
      elevators, loadingDock, foundation, surfaceParking, structuredParking, siteArea,
      characterCount, characterFeatures,
      // Gensler 5-category scores
      gensler: {
        siteContext: { score: cat1Score, text: cat1Text },
        buildingShape: { score: cat2Score, text: cat2Text },
        floorplate: { score: cat3Score, text: cat3Text },
        envelope: { score: cat4Score, text: cat4Text },
        servicing: { score: cat5Score, text: cat5Text },
        total: totalPhysicalScore,
        totalLabel,
        totalColor
      },
      foundationFlag,
      overall: { color: totalColor, text: totalLabel }
    };

    renderPhysicalOutput();
  }

  function scoreColor(score) {
    if (score >= 16) return 'green';
    if (score >= 10) return 'amber';
    return 'red';
  }

  // ─── Enhancement 1: Code & Life-Safety Risk Flags ───
  function assessLifeSafety(p) {
    const flags = [];

    // EGRESS — based on stories, elevators, structural
    const elevPerFloor = p.stories > 0 ? p.elevators / p.stories : 0;
    if (p.stories >= 8 && p.elevators < 2) {
      flags.push({ category: 'Egress', level: 'high', text: 'High-rise with fewer than 2 elevators — code requires minimum 2 means of egress. Elevator addition likely required ($150K-400K per shaft).', icon: '\uD83D\uDEA8' });
    } else if (p.stories >= 4 && p.elevators < 1) {
      flags.push({ category: 'Egress', level: 'high', text: 'Mid-rise with no elevator — ADA and fire code require elevator access. New shaft installation required.', icon: '\uD83D\uDEA8' });
    } else if (p.stories >= 4 && p.elevators >= 2) {
      flags.push({ category: 'Egress', level: 'low', text: 'Adequate elevator count for egress compliance. Verify stair width meets residential code (44" minimum).', icon: '\u2705' });
    }

    // FIRE / LIFE SAFETY — based on seismic, structural, stories
    if (p.seismic.includes('Pre-1980')) {
      flags.push({ category: 'Fire/Life Safety', level: 'high', text: 'Pre-1980 construction — likely requires seismic retrofit + fire sprinkler upgrade to meet current residential code (LAMC 91.8903). Budget $25-55/SF for seismic + $4-8/SF for sprinklers.', icon: '\uD83D\uDEA8' });
    } else if (p.seismic.includes('1980-1994')) {
      flags.push({ category: 'Fire/Life Safety', level: 'medium', text: 'Pre-Northridge construction — seismic assessment recommended. Sprinkler system likely needs residential upgrade.', icon: '\u26A0\uFE0F' });
    } else {
      flags.push({ category: 'Fire/Life Safety', level: 'low', text: 'Post-1994 construction meets current seismic code. Verify sprinkler coverage meets R-2 occupancy requirements.', icon: '\u2705' });
    }

    if (p.windowType.includes('Sealed')) {
      flags.push({ category: 'Fire/Life Safety', level: 'medium', text: 'Sealed curtain wall — California Building Code requires operable windows or mechanical ventilation in every habitable room. Full window replacement or HVAC redesign required.', icon: '\u26A0\uFE0F' });
    }

    if (p.stories >= 13) {
      flags.push({ category: 'Fire/Life Safety', level: 'medium', text: 'High-rise (75ft+) — requires fire command center, standpipe system, emergency generator, and enhanced fire alarm per LAFD High-Rise Ordinance.', icon: '\u26A0\uFE0F' });
    }

    // ACCESSIBILITY — based on elevators, stories
    if (p.elevators > 0) {
      flags.push({ category: 'Accessibility', level: 'low', text: 'Existing elevators provide ADA vertical access. Verify cab dimensions meet residential standards (minimum 68" x 51" clear). Ground floor and common areas require ADA path of travel.', icon: '\u2705' });
    } else if (p.stories >= 2) {
      flags.push({ category: 'Accessibility', level: 'high', text: 'No elevator in multi-story building — ADA requires elevator access for buildings with 4+ units on upper floors. New elevator shaft required.', icon: '\uD83D\uDEA8' });
    }

    if (p.loadingDock === 'No' && p.stories >= 4) {
      flags.push({ category: 'Accessibility', level: 'medium', text: 'No loading dock — construction staging and move-in logistics will be constrained. Consider temporary loading zone permit.', icon: '\u26A0\uFE0F' });
    }

    return flags;
  }

  // ─── Enhancement 2: Data Reliability Indicator ───
  function getDataReliability() {
    const coreFields = [
      { id: 'm1-depth', label: 'Floorplate Depth' },
      { id: 'm1-width', label: 'Floorplate Width' },
      { id: 'm1-f2f', label: 'Floor-to-Floor Height' },
      { id: 'm1-stories', label: 'Stories' },
      { id: 'm1-total-sf', label: 'Total Building SF' },
      { id: 'm1-typical-sf', label: 'Typical Floor SF' },
      { id: 'm1-window-type', label: 'Window Type', isSelect: true },
      { id: 'm1-structural', label: 'Structural System', isSelect: true },
      { id: 'm1-seismic', label: 'Seismic Compliance', isSelect: true },
      { id: 'm1-mep', label: 'MEP Condition', isSelect: true },
      { id: 'm1-foundation', label: 'Foundation Condition', isSelect: true }
    ];

    let filled = 0;
    const missing = [];
    coreFields.forEach(f => {
      const el = document.getElementById(f.id);
      if (!el) return;
      if (f.isSelect) {
        if (el.value && el.value !== 'Unknown') { filled++; } else { missing.push(f.label); }
      } else {
        if (el.value && parseFloat(el.value) > 0) { filled++; } else { missing.push(f.label); }
      }
    });

    let level, color, text;
    if (filled >= 9) {
      level = 'High'; color = 'green';
      text = 'Strong data basis — estimates are well-supported by input data.';
    } else if (filled >= 5) {
      level = 'Medium'; color = 'amber';
      text = `Moderate data basis — ${missing.length} fields unverified. Estimates carry higher uncertainty.`;
    } else {
      level = 'Low'; color = 'red';
      text = `Limited data — ${missing.length} of ${coreFields.length} core fields missing. Results should be treated as preliminary only.`;
    }

    return { level, color, text, filled, total: coreFields.length, missing };
  }

  // ─── Enhancement 3: Program Recommendation Engine ───
  function recommendProgram() {
    if (!physicalResult || !yieldResult || !proFormaResult) return null;

    const p = physicalResult;
    const y = yieldResult;
    const pf = proFormaResult;
    const totalUnits = y.base.total + y.parkingBonusUnits;
    const isHistoric = prePopulatedData && prePopulatedData.historicDesignation && prePopulatedData.historicDesignation !== 'None' && prePopulatedData.historicDesignation !== 'Unknown';
    const hasAffordable = prePopulatedData && prePopulatedData.affordableStrategy && prePopulatedData.affordableStrategy.includes('%');
    const depth = p.depth;
    const stories = p.stories;
    const roc = pf.returnOnCost;

    let primary, backup, alternative;

    // Primary recommendation
    if (roc >= 6.5 && totalUnits >= 60) {
      primary = { name: 'Market-Rate Multifamily Conversion', desc: 'Strong economics support conventional market-rate residential conversion. Seek construction-to-perm financing at 65-70% LTC with stabilized agency debt takeout.', icon: '\uD83C\uDFE2' };
    } else if (isHistoric && roc >= 4.5) {
      primary = { name: 'Historic Tax Credit Conversion', desc: 'Historic designation unlocks 20% Federal + 20% California HTC equity. Even with marginal base economics, HTC equity fills the gap. Engage HTC syndicator early.', icon: '\uD83C\uDFDB' };
    } else if (hasAffordable || roc < 5.0) {
      primary = { name: 'Affordable / Mixed-Income Conversion', desc: 'Economics favor affordable housing structure with LIHTC/tax-exempt bond financing. HUD 221(d)(4) provides 85% LTV non-recourse permanent debt. Contact HCIDLA for gap financing.', icon: '\uD83C\uDFE0' };
    } else {
      primary = { name: 'Value-Add Conversion', desc: 'Moderate returns suggest value-add approach — negotiate acquisition below ask, pursue density bonuses, or phase construction to manage capital requirements.', icon: '\uD83D\uDCC8' };
    }

    // Backup recommendation
    if (totalUnits < 40 && depth <= 45) {
      backup = { name: 'Boutique Condo Conversion', desc: 'Low unit count may support for-sale strategy at premium pricing. Condos eliminate ongoing operating risk and can achieve higher per-unit value in strong submarkets.', icon: '\uD83C\uDFE8' };
    } else if (isHistoric) {
      backup = { name: 'Historic Mixed-Use (Residential + Retail)', desc: 'Preserve ground floor commercial/retail with upper floor residential conversion. Maintains neighborhood character and diversifies income streams.', icon: '\uD83C\uDFEA' };
    } else if (stories <= 3 && depth > 55) {
      backup = { name: 'Creative / Live-Work Lofts', desc: 'Deep floorplates suit open-plan live-work layouts with minimal interior partitions. Lower construction cost per unit, appeals to creative/tech tenants.', icon: '\uD83C\uDFA8' };
    } else {
      backup = { name: 'Mixed-Income with Density Bonus', desc: 'Incorporate 11-25% affordable units to unlock AB 2011/SB 1227 density bonuses. Additional units improve per-unit economics and open additional financing sources.', icon: '\uD83C\uDFD8' };
    }

    // Alternative / creative option
    if (p.characterCount >= 5 && p.f2f >= 12) {
      alternative = { name: 'Hospitality / Short-Term Rental', desc: 'Exceptional character features and high ceilings could support boutique hotel or branded short-term rental conversion. Higher revenue potential but different entitlement path.', icon: '\uD83C\uDF1F' };
    } else if (totalUnits >= 100) {
      alternative = { name: 'Senior Living / Assisted Living', desc: 'Large unit count and existing elevator infrastructure suit senior housing conversion. Strong demographic demand and specialized financing (HUD 232) available.', icon: '\uD83C\uDFE5' };
    } else {
      alternative = { name: 'Student / Co-Living Housing', desc: 'Smaller unit sizes and shared amenity model can increase effective unit count by 20-30%. Strong demand near universities and transit hubs.', icon: '\uD83C\uDF93' };
    }

    return { primary, backup, alternative };
  }

  // ─── Enhancement 4: Process Roadmap ───
  function generateRoadmap() {
    const isARO = prePopulatedData && prePopulatedData.yearBuilt && (2026 - parseInt(prePopulatedData.yearBuilt)) >= 15;
    const isHistoric = prePopulatedData && prePopulatedData.historicDesignation && prePopulatedData.historicDesignation !== 'None' && prePopulatedData.historicDesignation !== 'Unknown';
    const totalUnits = yieldResult ? (yieldResult.base.total + yieldResult.parkingBonusUnits) : 0;
    const stories = physicalResult ? physicalResult.stories : 0;

    // Phase 3 (construction) duration varies by scale
    let constructionLow = 12, constructionHigh = 18;
    if (totalUnits >= 100) { constructionLow = 18; constructionHigh = 24; }
    else if (totalUnits >= 60) { constructionLow = 14; constructionHigh = 20; }
    if (stories >= 13) { constructionLow += 3; constructionHigh += 4; }

    const phases = [
      {
        num: 1, name: 'Due Diligence & Feasibility',
        duration: '1-3 months',
        tasks: ['Phase I ESA ($3-6K)', 'Structural assessment ($5-15K)', 'Architect feasibility study ($15-40K)', 'Title & survey', isHistoric ? 'SHPO pre-consultation' : null].filter(Boolean),
        note: 'Go/no-go decision point. Budget $25-60K for pre-development.'
      },
      {
        num: 2, name: 'Design & Entitlement',
        duration: isARO ? '3-6 months (ARO by-right)' : '6-12 months (discretionary)',
        tasks: ['Schematic design + design development', isARO ? 'ARO by-right plan check (no hearing required)' : 'Discretionary planning review + public hearing', 'Building permit application', isHistoric ? 'Part 2 NPS application (historic)' : null, 'Financing commitment letters'].filter(Boolean),
        note: isARO ? 'ARO by-right eliminates public hearing — fastest entitlement path.' : 'Discretionary review adds 3-6 months. Consider ARO eligibility strategies.'
      },
      {
        num: 3, name: 'Construction',
        duration: `${constructionLow}-${constructionHigh} months`,
        tasks: ['Demolition / abatement', 'Structural / seismic work', 'MEP rough-in (plumbing stacks, electrical)', 'Unit buildout + finishes', 'Common areas + amenities', isHistoric ? 'NPS Part 3 certification (post-completion)' : null].filter(Boolean),
        note: `Based on ${totalUnits} units / ${stories} stories. ${isHistoric ? 'Historic projects must maintain Secretary of Interior Standards throughout.' : ''}`
      },
      {
        num: 4, name: 'Lease-Up & Stabilization',
        duration: '6-12 months',
        tasks: ['Certificate of Occupancy', 'Marketing + pre-leasing (start 3 months before CO)', 'Initial lease-up (target 15-20 units/month)', 'Stabilization (93-95% occupancy)', 'Permanent financing conversion / refi'],
        note: 'Target 12-18 months from groundbreaking to first move-in.'
      }
    ];

    return phases;
  }

  // ─── Enhancement 5: Risk & Complexity Summary ───
  function assessRiskComplexity() {
    if (!physicalResult || !costResult || !proFormaResult) return null;

    const p = physicalResult;
    const pf = proFormaResult;
    const isARO = prePopulatedData && prePopulatedData.yearBuilt && (2026 - parseInt(prePopulatedData.yearBuilt)) >= 15;
    const isHistoric = prePopulatedData && prePopulatedData.historicDesignation && prePopulatedData.historicDesignation !== 'None' && prePopulatedData.historicDesignation !== 'Unknown';
    const totalUnits = yieldResult ? (yieldResult.base.total + yieldResult.parkingBonusUnits) : 0;

    // Entitlement Risk
    let entitlementLevel, entitlementText;
    if (isARO) {
      entitlementLevel = 'Low';
      entitlementText = 'ARO by-right approval — no public hearing or discretionary review required. Fastest entitlement path in LA.';
    } else if (prePopulatedData && prePopulatedData.yearBuilt && (2026 - parseInt(prePopulatedData.yearBuilt)) >= 5) {
      entitlementLevel = 'Medium';
      entitlementText = 'Conditional ARO eligibility — may require discretionary review. Building age between 5-14 years.';
    } else {
      entitlementLevel = 'High';
      entitlementText = 'No ARO eligibility — standard discretionary entitlement process with public hearing and environmental review.';
    }

    // Construction Risk
    let constructionScore = 0;
    if (p.seismic.includes('Pre-1980')) constructionScore += 3;
    else if (p.seismic.includes('1980-1994')) constructionScore += 2;
    if (p.windowType.includes('Sealed')) constructionScore += 2;
    if (p.foundation === 'Poor') constructionScore += 3;
    else if (p.foundation === 'Unknown') constructionScore += 2;
    else if (p.foundation === 'Fair') constructionScore += 1;
    if (p.depth > 55) constructionScore += 2;
    else if (p.depth > 45) constructionScore += 1;
    if (p.stories >= 13) constructionScore += 2;
    if (isHistoric) constructionScore += 1;

    let constructionLevel, constructionText;
    if (constructionScore >= 7) {
      constructionLevel = 'High';
      constructionText = 'Multiple structural/envelope challenges compound construction risk. Detailed engineering required before committing. Budget generous contingency (15%+).';
    } else if (constructionScore >= 4) {
      constructionLevel = 'Medium';
      constructionText = 'Moderate construction complexity — some structural or envelope work required but manageable with experienced contractor.';
    } else {
      constructionLevel = 'Low';
      constructionText = 'Straightforward conversion — building condition and geometry favor efficient construction execution.';
    }

    // Capital Stack Risk
    let capitalLevel, capitalText;
    if (pf.returnOnCost >= 6.5 && totalUnits >= 60) {
      capitalLevel = 'Low';
      capitalText = 'Strong returns and scale attract conventional financing. Multiple lender options available at competitive terms.';
    } else if (pf.returnOnCost >= 5.0 || (isHistoric && pf.returnOnCost >= 4.0)) {
      capitalLevel = 'Medium';
      capitalText = 'Workable returns but may require structured financing (HTC equity, mezzanine, or preferred equity) to achieve target returns.';
    } else {
      capitalLevel = 'High';
      capitalText = 'Challenging economics — requires significant incentives (HTC, LIHTC, gap financing) or acquisition price reduction to achieve viable returns.';
    }

    return {
      entitlement: { level: entitlementLevel, text: entitlementText },
      construction: { level: constructionLevel, text: constructionText },
      capitalStack: { level: capitalLevel, text: capitalText }
    };
  }

  function riskColor(level) {
    if (level === 'Low') return 'green';
    if (level === 'Medium') return 'amber';
    return 'red';
  }

  function renderPhysicalOutput() {
    const r = physicalResult;
    if (!r) return;
    const g = r.gensler;

    const output = document.getElementById('m1-output');
    let html = `
      <table class="gensler-scorecard">
        <thead>
          <tr><th>Category</th><th>Score</th><th>Assessment</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="sc-category">1. Site Context</td>
            <td class="sc-score ${scoreColor(g.siteContext.score)}">${g.siteContext.score}/20</td>
            <td class="sc-assessment">${g.siteContext.text}</td>
          </tr>
          <tr>
            <td class="sc-category">2. Building Shape</td>
            <td class="sc-score ${scoreColor(g.buildingShape.score)}">${g.buildingShape.score}/20</td>
            <td class="sc-assessment">${g.buildingShape.text}</td>
          </tr>
          <tr>
            <td class="sc-category">3. Floorplate Efficiency</td>
            <td class="sc-score ${scoreColor(g.floorplate.score)}">${g.floorplate.score}/20</td>
            <td class="sc-assessment">${g.floorplate.text}</td>
          </tr>
          <tr>
            <td class="sc-category">4. Envelope (Windows)</td>
            <td class="sc-score ${scoreColor(g.envelope.score)}">${g.envelope.score}/20</td>
            <td class="sc-assessment">${g.envelope.text}</td>
          </tr>
          <tr>
            <td class="sc-category">5. Servicing (Parking)</td>
            <td class="sc-score ${scoreColor(g.servicing.score)}">${g.servicing.score}/20</td>
            <td class="sc-assessment">${g.servicing.text}</td>
          </tr>
          <tr class="sc-total-row">
            <td class="sc-category">TOTAL PHYSICAL SCORE</td>
            <td class="sc-score ${g.totalColor}">${g.total}/100</td>
            <td class="sc-assessment">${g.totalLabel}</td>
          </tr>
        </tbody>
      </table>
      <div class="scorecard-attribution">Physical scoring methodology informed by Gensler's Conversions+ framework (deployed in 129 cities), Studio One Eleven's adaptive reuse practice (36+ LA conversions), and ULI/NMHC Behind the Facade research (2023).</div>`;

    // Foundation condition flags
    if (r.foundationFlag) {
      const icon = r.foundationFlag.color === 'red' ? '\uD83D\uDED1' : '\u26A0\uFE0F';
      html += `<div class="foundation-flag ${r.foundationFlag.color}"><span class="flag-icon">${icon}</span><span>${r.foundationFlag.text}</span></div>`;
    }

    // Enhancement 1: Life-Safety Risk Flags
    const lsFlags = assessLifeSafety(r);
    if (lsFlags.length > 0) {
      html += `<div class="life-safety-section">
        <div class="ls-section-title">Code & Life-Safety Risk Flags</div>`;
      lsFlags.forEach(f => {
        const levelClass = f.level === 'high' ? 'red' : f.level === 'medium' ? 'amber' : 'green';
        html += `<div class="ls-flag ${levelClass}">
          <span class="ls-icon">${f.icon}</span>
          <div class="ls-content">
            <span class="ls-category">${f.category}</span>
            <span class="ls-text">${f.text}</span>
          </div>
        </div>`;
      });
      html += `</div>`;
    }

    // Enhancement 2: Data Reliability Indicator
    const reliability = getDataReliability();
    html += `<div class="data-reliability-badge ${reliability.color}">
      <span class="dr-level">Data Reliability: ${reliability.level}</span>
      <span class="dr-detail">${reliability.filled}/${reliability.total} core fields — ${reliability.text}</span>
    </div>`;

    // Partial conversion deal angle card
    if (isPartialConversion()) {
      html += `
        <div class="partial-conversion-card">
          <div class="deal-card-icon">\uD83C\uDFE2</div>
          <div class="deal-card-title">Partial Conversion Play</div>
          <div class="deal-card-text">Converting only the vacant floors while retaining paying tenants reduces capital requirements and preserves existing cash flow during construction. This structure can be treated more like a tenant improvement than a full change-of-use, potentially qualifying for less onerous permitting. ATC Research and LA City Planning have identified partial conversions as an underutilized strategy under the new ARO. Lenders may view this as lower risk than a full vacant-building conversion.</div>
        </div>`;
    }

    html += `
      <div class="verdict-banner ${g.totalColor}">
        <div class="verdict-text">${g.totalLabel}</div>
      </div>`;

    output.innerHTML = html;
    output.style.display = 'block';

    // Enable complete button
    document.getElementById('m1-complete').style.display = '';
  }

  function onModule1Complete() {
    if (!physicalResult) { calculatePhysical(); }
    if (!physicalResult) return;

    // Auto-populate Module 2 and 3 where possible
    autoPopulateModule2();
    autoPopulateModule3();
    completeModule(1);
  }

  // ─── MODULE 2: Unit Yield ───
  function autoPopulateModule2() {
    if (!physicalResult) return;
    // Module 2 uses data from Module 1 directly via physicalResult
    // Calculate immediately
    calculateYield();
  }

  // Layout stress-test result cache
  let layoutResult = null;

  function calculateYield() {
    if (!physicalResult) return;

    // Use conversion SF for partial conversions
    const conversionSF = getConversionSF();

    const params = {
      totalBuildingSF: conversionSF,
      stories: isPartialConversion() ? (parseInt(document.getElementById('m1-stories-to-convert').value) || physicalResult.stories) : physicalResult.stories,
      floorplateWidth: physicalResult.width,
      floorplateDepth: physicalResult.depth,
      typicalFloorSF: physicalResult.typicalFloorSF,
      surfaceParking: physicalResult.surfaceParking,
      structuredParking: physicalResult.structuredParking,
      useType: prePopulatedData ? prePopulatedData.useType : ''
    };

    yieldResult = YieldCalculator.calculate(params);

    // Enhancement B: Layout Feasibility Stress-Test
    const corridorWidth = parseFloat(document.getElementById('m2-corridor-width').value) || 6;
    const minWindowDist = parseFloat(document.getElementById('m2-min-window-dist').value) || 25;
    layoutResult = YieldCalculator.adjustYieldForLayout({
      floorplateDepth: physicalResult.depth,
      corridorWidth,
      minWindowDist
    });

    // Apply layout factor to all three scenarios
    if (layoutResult && layoutResult.factor !== 1.0) {
      const applyFactor = (scenario) => {
        scenario.studio.units = Math.round(scenario.studio.units * layoutResult.factor);
        scenario.oneBR.units = Math.round(scenario.oneBR.units * layoutResult.factor);
        scenario.twoBR.units = Math.max(0, Math.round(scenario.twoBR.units * layoutResult.factor));
        scenario.total = scenario.studio.units + scenario.oneBR.units + scenario.twoBR.units;
      };
      applyFactor(yieldResult.conservative);
      applyFactor(yieldResult.base);
      applyFactor(yieldResult.optimistic);
    }

    renderYieldOutput();
  }

  function renderYieldOutput() {
    const r = yieldResult;
    if (!r) return;

    const output = document.getElementById('m2-output');
    let html = `
      <div class="yield-range-tabs">
        <button class="yield-range-tab" data-range="conservative" onclick="FeasibilityTab.switchYieldRange('conservative')">Conservative</button>
        <button class="yield-range-tab active" data-range="base" onclick="FeasibilityTab.switchYieldRange('base')">Base Case</button>
        <button class="yield-range-tab" data-range="optimistic" onclick="FeasibilityTab.switchYieldRange('optimistic')">Optimistic</button>
      </div>
      <table class="data-table" id="yield-table">
        <thead>
          <tr>
            <th>Unit Type</th>
            <th>Est. SF</th>
            <th># Conservative</th>
            <th># Base</th>
            <th># Optimistic</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Studio</td>
            <td>${r.base.studio.sf} SF</td>
            <td>${r.conservative.studio.units}</td>
            <td><strong>${r.base.studio.units}</strong></td>
            <td>${r.optimistic.studio.units}</td>
          </tr>
          <tr>
            <td>1 Bedroom</td>
            <td>${r.base.oneBR.sf} SF</td>
            <td>${r.conservative.oneBR.units}</td>
            <td><strong>${r.base.oneBR.units}</strong></td>
            <td>${r.optimistic.oneBR.units}</td>
          </tr>
          <tr>
            <td>2 Bedroom</td>
            <td>${r.base.twoBR.sf} SF</td>
            <td>${r.conservative.twoBR.units}</td>
            <td><strong>${r.base.twoBR.units}</strong></td>
            <td>${r.optimistic.twoBR.units}</td>
          </tr>
          <tr class="total-row">
            <td>TOTAL (building)</td>
            <td></td>
            <td>${r.conservative.total}</td>
            <td><strong>${r.base.total}</strong></td>
            <td>${r.optimistic.total}</td>
          </tr>
        </tbody>
      </table>`;

    // Stats Strip — compact unit summary
    const totalEstUnitsStrip = r.base.total + r.parkingBonusUnits;
    const layoutFactor = layoutResult ? (layoutResult.factor * 100).toFixed(0) + '%' : '100%';
    html += `<div class="stats-strip">
      <div class="stat-cell"><span class="value">${totalEstUnitsStrip}</span><span class="label">Total Units</span></div>
      <div class="stat-cell"><span class="value">${r.base.studio.units}</span><span class="label">Studios</span></div>
      <div class="stat-cell"><span class="value">${r.base.oneBR.units}</span><span class="label">1-Bed</span></div>
      <div class="stat-cell"><span class="value">${r.base.twoBR.units}</span><span class="label">2-Bed</span></div>
      <div class="stat-cell"><span class="value">${layoutFactor}</span><span class="label">Layout Factor</span></div>
    </div>`;

    // Enhancement B: Layout Stress-Test Row
    if (layoutResult) {
      const lColor = layoutResult.factor < 0.88 ? 'amber' : layoutResult.factor > 1.02 ? 'green' : '';
      const lColorClass = lColor === 'amber' ? 'conditional' : lColor === 'green' ? 'eligible' : 'mid';
      html += `<div class="layout-stress-row" style="margin:12px 0;padding:12px 16px;border-radius:8px;background:${lColor === 'amber' ? 'var(--conditional-bg)' : lColor === 'green' ? 'var(--eligible-bg)' : 'var(--paper)'};border:1px solid ${lColor === 'amber' ? 'rgba(122,79,0,0.2)' : lColor === 'green' ? 'rgba(26,92,56,0.15)' : 'rgba(13,13,13,0.08)'};">
        <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--${lColorClass});font-weight:700;margin-bottom:4px;">Layout Feasibility: ${layoutResult.label}</div>
        <div style="font-size:0.82rem;color:var(--slate);line-height:1.5;">
          Usable depth per side: ${layoutResult.usableDepthPerSide} ft | Window stress: ${layoutResult.windowStress > 0 ? '+' : ''}${layoutResult.windowStress} ft | Yield adjustment: ${layoutResult.factor > 1 ? '+' : ''}${Math.round((layoutResult.factor - 1) * 100)}%
        </div>
        ${layoutResult.factor < 0.88 ? '<div style="font-size:0.78rem;color:var(--conditional);margin-top:4px;font-weight:600;">Unit depth exceeds daylight comfort zone — consider light wells, atrium cuts, or wider window spacing to improve layout efficiency.</div>' : ''}
        ${layoutResult.factor > 1.02 ? '<div style="font-size:0.78rem;color:var(--eligible);margin-top:4px;font-weight:600;">Favorable floorplate geometry — shallow depth supports efficient double-loaded corridor layouts with excellent natural light.</div>' : ''}
      </div>`;
    }

    const totalEstUnits = r.base.total + r.parkingBonusUnits;

    if (r.parkingBonusUnits > 0) {
      html += `<div style="margin:12px 0;font-size:0.88rem;color:var(--eligible);font-weight:600;">
        + ${r.parkingBonusUnits} bonus units from ${r.surfaceParking} surface parking spaces
      </div>
      <div style="font-size:0.95rem;font-weight:700;color:var(--ink);">
        Total estimated units (base case): ${totalEstUnits}
      </div>`;
    }

    // ── 60-Unit Minimum Threshold Warning (Upgrade 2) ──
    if (totalEstUnits < 30) {
      html += `<div class="scale-warning-card red">
        <div class="sw-title">\uD83D\uDEAB SCALE CHALLENGE — ${totalEstUnits} Estimated Units</div>
        <div class="sw-text">At fewer than 30 units, this building faces significant financing challenges. Conventional construction lenders typically require minimum 20-30 units. HUD 221(d)(4) requires minimum 5 units but functions best at 50+. Consider whether this property is better suited for boutique condo conversion, creative office reuse, or ground-up replacement rather than residential adaptive reuse.</div>
      </div>`;
    } else if (totalEstUnits < 60) {
      html += `<div class="scale-warning-card amber">
        <div class="sw-title">\u26A0\uFE0F SCALE RISK — ${totalEstUnits} Estimated Units</div>
        <div class="sw-text">ULI and NMHC research (Behind the Facade, 2023) finds that at least 60 units is typically required for conversion economics to work efficiently. At ${totalEstUnits} units, per-unit costs rise significantly and lender appetite narrows. Consider: (1) Does the site allow additional new construction to supplement unit count? (2) Is a partial floor conversion viable to reduce scope? (3) Would a boutique/luxury positioning at premium rents offset lower unit count?</div>
      </div>`;
    } else if (totalEstUnits < 100) {
      html += `<div class="scale-warning-card green">
        <div class="sw-title">\u2713 Viable scale — 60+ units supports conventional construction financing.</div>
      </div>`;
    } else {
      html += `<div class="scale-warning-card green">
        <div class="sw-title">\u2713 Strong scale — 100+ units qualifies for full institutional financing stack including HUD 221(d)(4).</div>
      </div>`;
    }

    html += `
      <div style="margin-top:8px;font-size:0.82rem;color:var(--mid);">
        Building type: ${r.buildingType} | Efficiency: ${Math.round(r.base.efficiency * 100)}% | Core penalty: ${r.corePenalty}%
      </div>
      <div class="table-disclaimer">
        Unit yield estimates are preliminary and subject to architectural design. Studio One Eleven's 200 W Ocean produced 106 units from a similar mid-rise office building. Actual yield requires architect study.
      </div>
    `;

    output.innerHTML = html;
    output.style.display = 'block';
    document.getElementById('m2-complete').style.display = '';
  }

  function switchYieldRange(range) {
    document.querySelectorAll('.yield-range-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.yield-range-tab[data-range="${range}"]`).classList.add('active');
  }

  function onModule2Complete() {
    if (!yieldResult) calculateYield();
    if (!yieldResult) return;
    completeModule(2);
  }

  // ─── MODULE 3: Cost Estimator ───
  function autoPopulateModule3() {
    if (!physicalResult) return;

    // Auto-select building classification
    const classSelect = document.getElementById('m3-classification');
    if (classSelect && prePopulatedData) {
      const ut = (prePopulatedData.useType || '').toLowerCase();
      if (ut.includes('warehouse') || ut.includes('industrial')) classSelect.value = 'Warehouse/Industrial';
      else if (ut.includes('hotel')) classSelect.value = 'Hotel/Motel';
      else if (ut.includes('retail')) classSelect.value = 'Retail/Commercial';
      else if (ut.includes('parking')) classSelect.value = 'Parking Structure';
      else {
        const s = physicalResult.stories;
        if (s <= 4) classSelect.value = 'Office Low Rise';
        else if (s <= 12) classSelect.value = 'Office Mid Rise';
        else classSelect.value = 'Office High Rise';
      }
    }

    // Show/hide seismic checkbox
    const seismicRow = document.getElementById('m3-seismic-row');
    if (seismicRow) {
      seismicRow.style.display = (physicalResult.seismic.includes('Pre-1980') || physicalResult.seismic.includes('1980-1994')) ? '' : 'none';
      if (physicalResult.seismic.includes('Pre-1980') || physicalResult.seismic.includes('1980-1994')) {
        document.getElementById('m3-seismic').checked = true;
      }
    }

    // Show/hide window checkbox
    const windowRow = document.getElementById('m3-window-row');
    if (windowRow) {
      windowRow.style.display = physicalResult.windowType.includes('Sealed') ? '' : 'none';
      if (physicalResult.windowType.includes('Sealed')) {
        document.getElementById('m3-windows').checked = true;
      }
    }
  }

  function calculateCost() {
    if (!physicalResult || !yieldResult) return;

    const totalUnits = yieldResult.base.total + yieldResult.parkingBonusUnits;
    const includeParkingConv = document.getElementById('m3-parking-conv').checked;
    const parkingUnits = includeParkingConv ? (parseInt(document.getElementById('m3-parking-units').value) || yieldResult.parkingBonusUnits) : 0;
    const acquisitionPrice = prePopulatedData ? (parseFloat(prePopulatedData.estimatedValue) || 0) : 0;

    // Use conversion SF for partial conversions
    const conversionSF = getConversionSF();

    const params = {
      totalBuildingSF: conversionSF,
      stories: isPartialConversion() ? (parseInt(document.getElementById('m1-stories-to-convert').value) || physicalResult.stories) : physicalResult.stories,
      floorplateWidth: physicalResult.width,
      floorToFloor: physicalResult.f2f,
      buildingClassification: document.getElementById('m3-classification').value,
      conversionType: document.getElementById('m3-conversion-type').value,
      qualityLevel: document.getElementById('m3-quality').value,
      includeSeismic: document.getElementById('m3-seismic').checked,
      includeWindows: document.getElementById('m3-windows').checked,
      includeParkingConversion: includeParkingConv,
      parkingConversionUnits: parkingUnits,
      totalUnits,
      acquisitionPrice,
      foundation: physicalResult.foundation || 'Unknown'
    };

    costResult = CostEstimator.calculate(params);
    renderCostOutput();
  }

  function renderCostOutput() {
    const r = costResult;
    if (!r) return;

    const output = document.getElementById('m3-output');
    let html = `<div class="cost-table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Cost Category</th><th>Low Estimate</th><th>High Estimate</th></tr>
        </thead>
        <tbody>
          <tr><td>Hard Costs (conversion)</td><td>${fmtFull(r.hardCost.low)}</td><td>${fmtFull(r.hardCost.high)}</td></tr>`;

    if (r.seismic.included) {
      html += `<tr><td>Seismic Retrofit</td><td>${fmtFull(r.seismic.low)}</td><td>${fmtFull(r.seismic.high)}</td></tr>`;
    }
    if (r.windows.included) {
      html += `<tr><td>Window Replacement</td><td>${fmtFull(r.windows.low)}</td><td>${fmtFull(r.windows.high)}</td></tr>`;
    }
    if (r.parkingConversion.included) {
      html += `<tr><td>Parking Conversion</td><td>${fmtFull(r.parkingConversion.low)}</td><td>${fmtFull(r.parkingConversion.high)}</td></tr>`;
    }
    if (r.foundation && r.foundation.included) {
      html += `<tr><td>${r.foundation.label}</td><td>${fmtFull(r.foundation.low)}</td><td>${fmtFull(r.foundation.high)}</td></tr>`;
      if (r.foundation.warning) {
        html += `<tr><td colspan="3"><div class="foundation-flag ${r.foundation.warningColor}" style="margin:4px 0;"><span class="flag-icon">${r.foundation.warningColor === 'red' ? '\uD83D\uDED1' : '\u26A0\uFE0F'}</span><span>${r.foundation.warning}</span></div></td></tr>`;
      }
    }

    html += `
          <tr><td>Architecture & Engineering</td><td>${fmtFull(r.ae.low)}</td><td>${fmtFull(r.ae.high)}</td></tr>
          <tr><td>Permits & Linkage Fees</td><td>${fmtFull(r.permits.low)}</td><td>${fmtFull(r.permits.high)}</td></tr>
          <tr><td>Contingency</td><td>${fmtFull(r.contingency.low)}</td><td>${fmtFull(r.contingency.high)}</td></tr>
          <tr><td>Financing / Carry</td><td>${fmtFull(r.financing.low)}</td><td>${fmtFull(r.financing.high)}</td></tr>
          <tr class="total-row">
            <td>TOTAL PROJECT COST</td><td>${fmtFull(r.totalProjectCost.low)}</td><td>${fmtFull(r.totalProjectCost.high)}</td>
          </tr>
          <tr class="subtotal-row">
            <td>Cost Per Unit</td><td>${fmtFull(r.costPerUnit.low)}</td><td>${fmtFull(r.costPerUnit.high)}</td>
          </tr>
          <tr>
            <td>Cost Per RSF</td><td>${fmtFull(r.costPerRSF.low)}/SF</td><td>${fmtFull(r.costPerRSF.high)}/SF</td>
          </tr>
        </tbody>
      </table>
    </div>`;

    // Cost Stats Strip — compact summary
    const cpuMidStrip = Math.round((r.costPerUnit.low + r.costPerUnit.high) / 2);
    html += `<div class="stats-strip">
      <div class="stat-cell"><span class="value">${fmt(r.totalProjectCost.low)}&ndash;${fmt(r.totalProjectCost.high)}</span><span class="label">Total Range</span></div>
      <div class="stat-cell"><span class="value">${fmt(r.costPerUnit.low)}&ndash;${fmt(r.costPerUnit.high)}</span><span class="label">Per Unit</span></div>
      <div class="stat-cell"><span class="value">${fmt(cpuMidStrip)}</span><span class="label">Mid Estimate</span></div>
    </div>`;

    if (r.ula.applicable) {
      html += `<div class="warning-callout">
        <strong>Measure ULA Transfer Tax Warning</strong>
        If acquisition price exceeds $5M, add Measure ULA transfer tax: ${fmtFull(r.ula.low)} (4%) to ${fmtFull(r.ula.high)} (5.5%) — factor into total capitalization.
      </div>`;
    }

    html += `<div class="table-disclaimer">
      Cost estimates are ranges based on 2026 LA market data. Actual costs require contractor bids and architect construction documents. Studio One Eleven reports 60-80% embodied carbon reduction vs. ground-up.
    </div>`;

    output.innerHTML = html;
    output.style.display = 'block';
    document.getElementById('m3-complete').style.display = '';
  }

  function onModule3Complete() {
    if (!costResult) calculateCost();
    if (!costResult) return;
    autoPopulateModule4();
    completeModule(3);
  }

  // ─── MODULE 4: Pro Forma ───
  function autoPopulateModule4() {
    if (prePopulatedData && prePopulatedData.estimatedValue) {
      const acqInput = document.getElementById('m4-acquisition');
      if (acqInput && !acqInput.value) acqInput.value = prePopulatedData.estimatedValue;
    }
  }

  function calculateProForma() {
    if (!yieldResult || !costResult) return;

    const convTypeSelect = document.getElementById('m3-conversion-type');
    let convType = convTypeSelect ? convTypeSelect.value : 'Standard';

    // Also trigger Historic if historic designation is set (not just conversion type)
    const histDesig = prePopulatedData ? (prePopulatedData.historicDesignation || 'None') : 'None';
    if (histDesig !== 'None' && histDesig !== 'Unknown' && convType !== 'Historic') {
      // Don't override user choice, but flag it
    }

    const params = {
      yieldData: yieldResult,
      costData: costResult,
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
      loanStructure: document.getElementById('m4-loan-structure').value,
      conversionType: convType,
      retainedSF: getRetainedSF()
    };

    proFormaResult = ProForma.calculate(params);
    const sensitivity = ProForma.sensitivityAnalysis(params, proFormaResult);

    // Enhancement A: Subsidy Gap
    const targetROC = parseFloat(document.getElementById('m4-target-roc').value) || 6.5;
    const subsidyGap = computeSubsidyGap(proFormaResult, targetROC);

    // Enhancement C: Capital Stack Scenarios
    const capitalScenarios = ProForma.runAllCapitalScenarios ? ProForma.runAllCapitalScenarios(params, costResult) : null;

    renderProFormaOutput(proFormaResult, sensitivity, subsidyGap, capitalScenarios);
  }

  // ─── Enhancement A: Subsidy Gap / Required Incentive Calculator ───
  function computeSubsidyGap(pfResult, targetROC) {
    const currentROC = pfResult.totalProjectCost > 0 ? (pfResult.noi / pfResult.totalProjectCost) * 100 : 0;
    const requiredCost = targetROC > 0 ? pfResult.noi / (targetROC / 100) : 0;
    const subsidyGap = pfResult.totalProjectCost - requiredCost;
    const subsidyPerUnit = pfResult.totalUnits > 0 ? subsidyGap / pfResult.totalUnits : 0;
    const meetsTarget = currentROC >= targetROC;

    return {
      currentROC,
      targetROC,
      requiredCost,
      subsidyGap: Math.max(0, subsidyGap),
      subsidyPerUnit: Math.max(0, subsidyPerUnit),
      meetsTarget
    };
  }

  function renderProFormaOutput(r, sensitivity, subsidyGap, capitalScenarios) {
    const output = document.getElementById('m4-output');

    let html = `
      <div class="proforma-section">
        <div class="proforma-section-title">Income Analysis</div>
        <div class="proforma-line"><span class="pf-label">Gross Potential Rent (annual)</span><span class="pf-value">${fmtFull(r.grossPotentialRent)}</span></div>`;
    if (r.affordableAdj > 0) {
      html += `<div class="proforma-line"><span class="pf-label">Affordable Rent Adjustment</span><span class="pf-value negative">-${fmtFull(r.affordableAdj)}</span></div>`;
    }
    html += `
        <div class="proforma-line"><span class="pf-label">Vacancy Loss</span><span class="pf-value negative">-${fmtFull(r.vacancyLoss)}</span></div>
        <div class="proforma-line"><span class="pf-label">Other Income</span><span class="pf-value positive">+${fmtFull(r.otherIncome)}</span></div>
        <div class="proforma-line"><span class="pf-label">Effective Gross Income</span><span class="pf-value">${fmtFull(r.effectiveGrossIncome)}</span></div>
        <div class="proforma-line"><span class="pf-label">Operating Expenses</span><span class="pf-value negative">-${fmtFull(r.operatingExpenses)}</span></div>`;
    if (r.retainedOfficeNOI > 0) {
      html += `<div class="proforma-line"><span class="pf-label">Retained Office Cash Flow (in-place leases)</span><span class="pf-value positive">+${fmtFull(r.retainedOfficeNOI)}</span></div>`;
    }
    html += `
        <div class="proforma-line highlight"><span class="pf-label">NET OPERATING INCOME</span><span class="pf-value">${fmtFull(r.noi)}</span></div>
      </div>

      <div class="proforma-section">
        <div class="proforma-section-title">Valuation</div>
        <div class="proforma-line"><span class="pf-label">Stabilized Value (@ ${r.exitCapRate}% cap)</span><span class="pf-value">${fmtFull(r.stabilizedValue)}</span></div>
        <div class="proforma-line"><span class="pf-label">Total Project Cost</span><span class="pf-value negative">-${fmtFull(r.totalProjectCost)}</span></div>
        <div class="proforma-line highlight"><span class="pf-label">ESTIMATED PROFIT / (LOSS)</span><span class="pf-value ${r.profit >= 0 ? 'positive' : 'negative'}">${fmtFull(r.profit)}</span></div>
        <div class="proforma-line"><span class="pf-label">Return on Cost</span><span class="pf-value">${pct(r.returnOnCost)}</span></div>
      </div>

      <div class="proforma-section">
        <div class="proforma-section-title">Debt Service (construction period)</div>
        <div class="proforma-line"><span class="pf-label">Loan Amount (${Math.round(r.ltcPct * 100)}% LTC)</span><span class="pf-value">${fmtFull(r.loanAmount)}</span></div>
        <div class="proforma-line"><span class="pf-label">Monthly Interest Carry</span><span class="pf-value">${fmtFull(r.monthlyInterest)}</span></div>
      </div>`;

    if (r.isHistoric) {
      html += `
      <div class="proforma-section">
        <div class="proforma-section-title">Tax Credit Benefit</div>
        <div class="proforma-line"><span class="pf-label">Federal HTC (20% of QRE)</span><span class="pf-value positive">${fmtFull(r.federalHTC)}</span></div>
        <div class="proforma-line"><span class="pf-label">California HTC (20% of QRE)</span><span class="pf-value positive">${fmtFull(r.stateHTC)}</span></div>
        <div class="proforma-line"><span class="pf-label tooltip-trigger" title="HTC equity is syndicated to a bank or tax credit investor in exchange for a capital contribution. Investors receive the tax credits and depreciation benefits. Common HTC investors include US Bank, Raymond James, Enterprise Community Partners, and Raymond James Tax Credit Funds.">Total HTC Equity Offset</span><span class="pf-value positive">${fmtFull(r.totalHTCEquity)}</span></div>
        <div class="proforma-line"><span class="pf-label">HTC Bridge Loan Cost (est.)</span><span class="pf-value negative">-${fmtFull(r.htcBridgeCost)}</span></div>
        <div class="proforma-line highlight"><span class="pf-label">NET HTC Equity After Bridge</span><span class="pf-value positive">${fmtFull(r.netHTCEquity)}</span></div>
      </div>`;

      // HTC Bridge Loan Info Card (collapsible)
      html += `
      <div class="htc-info-card" id="htc-info-card" onclick="this.classList.toggle('expanded')">
        <div class="htc-info-header">
          <span>\uD83D\uDCCB Historic Tax Credit Financing — How the Money Actually Flows</span>
          <span class="htc-chevron">\u25BC</span>
        </div>
        <div class="htc-info-body">
          <div class="htc-content">
            <p><strong>Historic Tax Credit equity is NOT delivered at closing.</strong> It is delivered AFTER construction completion and NPS certification — typically 18-36 months into the project.</p>
            <p>This creates a financing gap that requires a <strong>BRIDGE LOAN</strong>:</p>
            <p><strong>Construction Period:</strong> Use construction loan + HTC bridge loan<br>
            <strong>HTC Bridge Loan:</strong> Secured by anticipated HTC equity. Lenders advance 90-95% of expected HTC. Bridge interest qualifies as QRE (adds to your HTC calculation — self-funding).</p>
            <p><strong>After Completion:</strong> HTC equity investor pays in their equity. HTC bridge loan is repaid from equity. Construction loan converts to perm.</p>
            <div style="margin:12px 0;padding:12px;background:rgba(13,13,13,0.03);border-radius:8px;">
              <div class="htc-row"><span class="htc-label">Anticipated HTC Equity:</span><span class="htc-val">${fmtFull(r.totalHTCEquity)}</span></div>
              <div class="htc-row"><span class="htc-label">Bridge Loan (90% of HTC):</span><span class="htc-val">${fmtFull(r.htcBridgeLoan)}</span></div>
              <div class="htc-row"><span class="htc-label">Approximate Bridge Rate:</span><span class="htc-val">SOFR + 2.5-3.5% (currently ~8%)</span></div>
            </div>
            <div class="htc-warning">\u26A0\uFE0F PENDING LEGISLATION: The HTC-GO Act (H.R. 2941/S. 1459) currently before Congress would increase the HTC from 20% to 30% for projects under $3.75M. Monitor for passage.</div>
          </div>
        </div>
      </div>`;
    }

    // Verdict
    html += `<div class="verdict-banner ${r.verdictColor}"><div class="verdict-text">${r.verdict}</div></div>`;

    // Sensitivity table
    html += `
      <div style="margin-top:24px;">
        <div class="proforma-section-title">Return on Cost Sensitivity</div>
        <table class="sensitivity-table">
          <thead><tr><th></th>`;
    sensitivity.columns.forEach(c => { html += `<th>${c}</th>`; });
    html += `</tr></thead><tbody>`;
    sensitivity.rows.forEach(row => {
      html += `<tr><td>${row.capRate}</td>`;
      row.cells.forEach(cell => {
        html += `<td class="${cell.color}">${cell.value}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;

    // Enhancement A: Subsidy Gap Analysis
    if (subsidyGap) {
      if (subsidyGap.meetsTarget) {
        html += `<div class="subsidy-gap-section" style="margin:16px 0;padding:14px 18px;border-radius:8px;background:var(--eligible-bg);border:1px solid rgba(26,92,56,0.15);">
          <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--eligible);font-weight:700;margin-bottom:4px;">No Subsidy Required</div>
          <div style="font-size:0.85rem;color:var(--slate);">Current ROC of ${pct(subsidyGap.currentROC)} meets or exceeds target of ${pct(subsidyGap.targetROC)}. Project economics support market-rate execution without additional incentives.</div>
        </div>`;
      } else {
        const isLargeGap = subsidyGap.subsidyGap > 10000000;
        const gapColor = isLargeGap ? 'amber' : 'red';
        const convType = document.getElementById('m3-conversion-type') ? document.getElementById('m3-conversion-type').value : 'Standard';
        html += `<div class="subsidy-gap-section" style="margin:16px 0;padding:16px 20px;border-radius:8px;background:${isLargeGap ? 'var(--conditional-bg)' : 'var(--ineligible-bg)'};border:1px solid ${isLargeGap ? 'rgba(122,79,0,0.2)' : 'rgba(180,40,40,0.2)'};">
          <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--${isLargeGap ? 'conditional' : 'ineligible'});font-weight:700;margin-bottom:6px;">Subsidy Gap / Required Incentive</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;font-size:0.85rem;color:var(--slate);">
            <div>Current ROC: <strong style="font-family:'DM Mono',monospace;">${pct(subsidyGap.currentROC)}</strong></div>
            <div>Target ROC: <strong style="font-family:'DM Mono',monospace;">${pct(subsidyGap.targetROC)}</strong></div>
            <div>Total Subsidy Needed: <strong style="font-family:'DM Mono',monospace;color:var(--${isLargeGap ? 'conditional' : 'ineligible'});">${fmt(subsidyGap.subsidyGap)}</strong></div>
            <div>Per Unit: <strong style="font-family:'DM Mono',monospace;">${fmtFull(Math.round(subsidyGap.subsidyPerUnit))}</strong></div>
            <div>Max Viable TPC: <strong style="font-family:'DM Mono',monospace;">${fmt(subsidyGap.requiredCost)}</strong></div>
          </div>`;
        if (isLargeGap) {
          html += `<div style="font-size:0.78rem;color:var(--conditional);margin-top:8px;font-weight:600;">Gap exceeds $10M — explore LIHTC 9% allocation (CDLAC/TCAC), HCIDLA gap financing, or tax-exempt bond + 4% LIHTC structure.</div>`;
        }
        if (subsidyGap.subsidyGap > 0 && (convType === 'Standard' || convType === 'Creative')) {
          html += `<div style="font-size:0.78rem;color:var(--slate);margin-top:6px;">Market-rate project: consider negotiating ${fmt(Math.round(subsidyGap.subsidyGap * 0.5))}-${fmt(subsidyGap.subsidyGap)} acquisition price reduction, or add affordable component to unlock density bonuses and alternative financing.</div>`;
        }
        html += `</div>`;
      }
    }

    // Enhancement C: Capital Stack Scenario Comparison Table
    if (capitalScenarios && capitalScenarios.length > 0) {
      html += `<div style="margin-top:24px;">
        <div class="proforma-section-title">Capital Stack Scenario Comparison</div>
        <div style="overflow-x:auto;">
        <table class="sensitivity-table" style="min-width:500px;">
          <thead><tr><th>Scenario</th><th>Hard Cost</th><th>Total Cost</th><th>NOI</th><th>ROC</th><th>Equity Offset</th></tr></thead>
          <tbody>`;
      let bestScenario = capitalScenarios[0];
      capitalScenarios.forEach(s => {
        if (s.roc > bestScenario.roc) bestScenario = s;
        const rocColor = s.roc >= 6.5 ? 'green' : s.roc >= 5.0 ? 'amber' : 'red';
        html += `<tr>
          <td style="text-align:left;font-weight:600;">${s.label}</td>
          <td>${fmt(s.hardCost)}</td>
          <td>${fmt(s.totalCost)}</td>
          <td>${fmtFull(s.noi)}</td>
          <td class="${rocColor}">${pct(s.roc)}</td>
          <td>${s.equityOffset > 0 ? fmt(s.equityOffset) : '—'}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      // Best scenario sentence
      const complexityMap = { 'Market Rate': 'Low', 'Historic (HTC)': 'High', '100% Affordable': 'High', 'Mixed-Income': 'Medium' };
      html += `<div style="margin-top:8px;font-size:0.85rem;color:var(--slate);line-height:1.5;">
        <strong>Strongest scenario:</strong> ${bestScenario.label} at ${pct(bestScenario.roc)} ROC (complexity: ${complexityMap[bestScenario.label] || 'Medium'}). ${bestScenario.roc >= 6.5 ? 'Viable for conventional financing.' : bestScenario.roc >= 5.0 ? 'Marginal — may require structured capital.' : 'Challenging — requires significant incentives.'}
      </div>`;
      html += `</div>`;
    }

    // Sensitivity Stress Test (Base / Downside / Upside)
    if (typeof ScenarioEngine !== 'undefined') {
      const baseInputs = ScenarioEngine.gatherBaseInputs();
      const scenarios = ScenarioEngine.runStandardScenarios(baseInputs);
      if (scenarios) {
        html += ScenarioEngine.renderScenarioTable(scenarios);
      }
    }

    // Max Offer Estimator
    const targetROCVal = parseFloat(document.getElementById('m4-target-roc') ? document.getElementById('m4-target-roc').value : 6.5) || 6.5;
    if (r.noi > 0 && targetROCVal > 0) {
      const maxTotalCostCalc = r.noi / (targetROCVal / 100);
      const conversionCostCalc = r.totalConversionCost || (r.totalProjectCost - (r.acquisitionPrice || 0));
      const maxOfferCalc = maxTotalCostCalc - conversionCostCalc;
      const acqPrice = r.acquisitionPrice || 0;
      let maxOfferNote = '';
      if (acqPrice > 0) {
        if (maxOfferCalc >= acqPrice) {
          maxOfferNote = `Current ask (${fmt(acqPrice)}) is at or below max offer — deal pencils at target ROC.`;
        } else {
          maxOfferNote = `Current ask (${fmt(acqPrice)}) exceeds max offer by ${fmt(Math.round(acqPrice - maxOfferCalc))} — negotiate down or seek subsidy.`;
        }
      }
      html += `<div style="margin-top:20px;padding:16px 20px;border-radius:10px;background:rgba(13,13,13,0.02);border:1px solid rgba(13,13,13,0.08);">
        <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:8px;">Max Offer Estimator</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--mid);text-transform:uppercase;">Max Total Cost</div>
            <div style="font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;">${fmt(Math.round(maxTotalCostCalc))}</div>
            <div style="font-size:0.72rem;color:var(--mid);">NOI ÷ ${pct(targetROCVal)}</div>
          </div>
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--mid);text-transform:uppercase;">Less: Conv. Cost</div>
            <div style="font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;color:var(--ineligible);">-${fmt(Math.round(conversionCostCalc))}</div>
          </div>
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--mid);text-transform:uppercase;">Max Offer</div>
            <div style="font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;color:${maxOfferCalc > 0 ? 'var(--eligible)' : 'var(--ineligible)'};">${maxOfferCalc > 0 ? fmt(Math.round(maxOfferCalc)) : 'Negative'}</div>
          </div>
        </div>
        ${maxOfferNote ? `<div style="font-size:0.82rem;color:var(--slate);margin-top:10px;text-align:center;">${maxOfferNote}</div>` : ''}
      </div>`;
    }

    output.innerHTML = html;
    output.style.display = 'block';
    document.getElementById('m4-complete').style.display = '';
  }

  function onModule4Complete() {
    if (!proFormaResult) calculateProForma();
    if (!proFormaResult) return;
    completeModule(4);
    // Auto-calculate ESG
    setTimeout(calculateESG, 200);
  }

  // ─── MODULE 5: ESG & Sustainability (Enhancement 6: Three-Pillar Scorecard) ───
  function calculateESG() {
    if (!physicalResult) return;

    const sf = physicalResult.totalSF;
    const stories = physicalResult.stories;
    const totalUnits = yieldResult ? (yieldResult.base.total + yieldResult.parkingBonusUnits) : Math.round(sf / 700);

    // ═══ E — ENVIRONMENTAL PILLAR ═══
    const concreteSavedLbs = sf * 8;
    const steelSavedLbs = sf * 2;
    const miscDebris = sf * 15;
    const totalDebrisTons = Math.round((concreteSavedLbs + steelSavedLbs + miscDebris) / 2000);

    const concreteCO2 = (concreteSavedLbs / 2000) * 900;
    const steelCO2 = (steelSavedLbs / 2000) * 3300;
    const co2AvoidedTons = Math.round((concreteCO2 + steelCO2) / 2000);

    const officeTrips = Math.round(sf / 1000 * 3.5);
    const resiTrips = Math.round(totalUnits * 0.5);
    const tripReduction = Math.max(0, officeTrips - resiTrips);

    // Energy: adaptive reuse uses ~30% less operational energy vs new construction
    const annualEnergyKWh = Math.round(sf * 12); // typical office
    const energySavingKWh = Math.round(annualEnergyKWh * 0.30);

    const envMetrics = [
      { label: 'Construction Debris Diverted', value: totalDebrisTons.toLocaleString() + ' tons', note: 'Estimated demolition waste avoided vs. ground-up' },
      { label: 'Embodied Carbon Avoided', value: co2AvoidedTons.toLocaleString() + ' tons CO2e', note: '60-80% reduction vs. new construction' },
      { label: 'Daily Vehicle Trip Reduction', value: tripReduction.toLocaleString() + '/day', note: 'Office-to-residential trip differential' },
      { label: 'Embodied Energy Preserved', value: energySavingKWh.toLocaleString() + ' kWh/yr', note: 'Estimated operational energy savings' }
    ];

    let envScore = 0;
    if (co2AvoidedTons > 500) envScore += 10; else if (co2AvoidedTons > 100) envScore += 7; else envScore += 4;
    if (tripReduction > 50) envScore += 5; else if (tripReduction > 20) envScore += 3; else envScore += 1;
    if (totalDebrisTons > 500) envScore += 5; else if (totalDebrisTons > 100) envScore += 3; else envScore += 1;

    // ═══ S — SOCIAL PILLAR ═══
    const isHistoric = prePopulatedData && prePopulatedData.historicDesignation && prePopulatedData.historicDesignation !== 'None' && prePopulatedData.historicDesignation !== 'Unknown';
    const hasAffordable = prePopulatedData && prePopulatedData.affordableStrategy && !prePopulatedData.affordableStrategy.includes('None') && prePopulatedData.affordableStrategy !== 'Unknown';
    const hasHighCeilings = physicalResult.characterFeatures && physicalResult.characterFeatures.includes('High ceilings (12ft+)');
    const nearTransit = physicalResult.characterFeatures && physicalResult.characterFeatures.includes('Adjacent to transit or walkable retail');

    const socialMetrics = [
      { label: 'New Housing Units Created', value: totalUnits.toString(), note: 'Net new residential units from conversion' },
      { label: 'Affordable Component', value: hasAffordable ? 'Yes' : 'None specified', note: hasAffordable ? 'Affordable units address housing crisis directly' : 'Consider 11%+ affordable for density bonus' },
      { label: 'Community Impact', value: 'Positive', note: 'Residential conversions generate less opposition than new construction — no demolition, no height increase' },
      { label: 'Neighborhood Preservation', value: isHistoric ? 'Historic Character Preserved' : 'Existing Streetscape Maintained', note: 'Adaptive reuse maintains existing urban fabric' }
    ];

    let socialScore = 0;
    if (totalUnits >= 100) socialScore += 8; else if (totalUnits >= 60) socialScore += 6; else if (totalUnits >= 30) socialScore += 4; else socialScore += 2;
    if (hasAffordable) socialScore += 6; else socialScore += 2;
    if (isHistoric) socialScore += 3;
    if (nearTransit) socialScore += 3; else socialScore += 1;

    // ═══ G — GOVERNANCE PILLAR ═══
    const certs = [
      { name: 'LEED Gold (adaptive reuse credits)', eligible: true },
      { name: 'WELL Certification', eligible: hasHighCeilings || physicalResult.f2f >= 10 },
      { name: 'GreenPoint Rated (CA residential)', eligible: true },
      { name: 'Federal Historic Tax Credit (20%)', eligible: isHistoric },
      { name: 'California Historic Tax Credit (20%)', eligible: isHistoric },
      { name: 'Mills Act Property Tax Reduction', eligible: isHistoric },
      { name: 'LADBS Green Building Incentives', eligible: true }
    ];

    const eligibleCertCount = certs.filter(c => c.eligible).length;

    const govMetrics = [
      { label: 'Eligible Certifications', value: eligibleCertCount + ' of ' + certs.length, note: 'Green certifications strengthen ESG reporting' },
      { label: 'ARO Compliance', value: 'By-Right Eligible', note: 'Streamlined entitlement reduces governance risk' },
      { label: 'ESG Reporting Alignment', value: 'GRESB / SASB Compatible', note: 'Adaptive reuse metrics align with institutional ESG frameworks' },
      { label: 'Community Engagement Risk', value: 'Low', note: 'No demolition + no height increase = minimal opposition' }
    ];

    let govScore = 0;
    if (eligibleCertCount >= 5) govScore += 8; else if (eligibleCertCount >= 3) govScore += 5; else govScore += 3;
    govScore += 5; // ARO compliance baseline
    govScore += 4; // ESG reporting compatibility
    if (isHistoric) govScore += 3;

    const useType = prePopulatedData ? (prePopulatedData.useType || 'commercial') : 'commercial';
    const eligibleCerts = certs.filter(c => c.eligible).map(c => c.name).join(', ');
    const narrative = `This ${stories}-story ${useType} conversion would divert approximately ${totalDebrisTons.toLocaleString()} tons of construction debris from landfill, reduce embodied carbon by an estimated 60-80% compared to ground-up development, and reduce daily vehicle trips by ${tripReduction.toLocaleString()}. The project is eligible for ${eligibleCerts}. These metrics align with ESG mandates from institutional equity investors and support strong community reception.`;

    esgResult = {
      totalDebrisTons, co2AvoidedTons, tripReduction, certs, narrative, sf, totalUnits,
      pillars: {
        environmental: { score: Math.min(20, envScore), metrics: envMetrics },
        social: { score: Math.min(20, socialScore), metrics: socialMetrics },
        governance: { score: Math.min(20, govScore), metrics: govMetrics }
      },
      totalScore: Math.min(60, envScore + socialScore + govScore)
    };

    renderESGOutput();
  }

  function renderESGOutput() {
    const r = esgResult;
    if (!r) return;

    const output = document.getElementById('m5-output');
    const pillars = r.pillars;

    let html = `
      <div class="esg-pillar-header">
        <div class="esg-total-score">
          <span class="esg-total-num">${r.totalScore}</span><span class="esg-total-denom">/60</span>
        </div>
        <div class="esg-total-label">ESG Impact Score</div>
      </div>

      <table class="esg-pillar-table">
        <thead>
          <tr><th>Pillar</th><th>Score</th><th>Key Metrics</th></tr>
        </thead>
        <tbody>`;

    // Environmental
    html += `<tr class="esg-pillar-row">
      <td class="esg-pillar-name"><span class="esg-pillar-icon">\uD83C\uDF3F</span> Environmental</td>
      <td class="esg-pillar-score ${scoreColor(pillars.environmental.score)}">${pillars.environmental.score}/20</td>
      <td class="esg-pillar-metrics">`;
    pillars.environmental.metrics.forEach(m => {
      html += `<div class="esg-metric-row"><span class="esg-metric-label">${m.label}</span><span class="esg-metric-value">${m.value}</span></div>`;
    });
    html += `</td></tr>`;

    // Social
    html += `<tr class="esg-pillar-row">
      <td class="esg-pillar-name"><span class="esg-pillar-icon">\uD83C\uDFE0</span> Social</td>
      <td class="esg-pillar-score ${scoreColor(pillars.social.score)}">${pillars.social.score}/20</td>
      <td class="esg-pillar-metrics">`;
    pillars.social.metrics.forEach(m => {
      html += `<div class="esg-metric-row"><span class="esg-metric-label">${m.label}</span><span class="esg-metric-value">${m.value}</span></div>`;
    });
    html += `</td></tr>`;

    // Governance
    html += `<tr class="esg-pillar-row">
      <td class="esg-pillar-name"><span class="esg-pillar-icon">\uD83C\uDFDB</span> Governance</td>
      <td class="esg-pillar-score ${scoreColor(pillars.governance.score)}">${pillars.governance.score}/20</td>
      <td class="esg-pillar-metrics">`;
    pillars.governance.metrics.forEach(m => {
      html += `<div class="esg-metric-row"><span class="esg-metric-label">${m.label}</span><span class="esg-metric-value">${m.value}</span></div>`;
    });
    html += `</td></tr>`;

    html += `<tr class="esg-pillar-total">
      <td>TOTAL ESG SCORE</td>
      <td class="esg-pillar-score ${r.totalScore >= 40 ? 'green' : r.totalScore >= 25 ? 'amber' : 'red'}">${r.totalScore}/60</td>
      <td></td>
    </tr>`;

    html += `</tbody></table>`;

    // Certifications
    html += `<div class="proforma-section-title" style="margin-top:20px;">Certifications & Incentives</div>
      <ul class="cert-list">`;
    r.certs.forEach(c => {
      html += `<li class="cert-item">
        <span class="cert-check ${c.eligible ? 'yes' : 'no'}">${c.eligible ? '&#x2713;' : '&#x2014;'}</span>
        ${c.name}
      </li>`;
    });
    html += `</ul>`;

    html += `<div class="esg-narrative">${r.narrative}</div>`;

    output.innerHTML = html;
    output.style.display = 'block';
    document.getElementById('m5-complete').style.display = '';
  }

  function onModule5Complete() {
    if (!esgResult) calculateESG();
    if (!esgResult) return;
    completeModule(5);
  }

  // ─── Final Report Generation ───
  function generateReport() {
    const report = document.getElementById('final-report');
    if (!report) return;

    const address = prePopulatedData ? (prePopulatedData.address || 'Subject Property') : 'Subject Property';
    const useType = prePopulatedData ? (prePopulatedData.useType || '') : '';
    const yearBuilt = prePopulatedData ? (prePopulatedData.yearBuilt || '') : '';
    const sf = physicalResult ? physicalResult.totalSF : 0;

    // ARO eligibility
    let aroHtml = '';
    if (prePopulatedData && prePopulatedData.yearBuilt) {
      const elig = AROScoring.getEligibility(
        parseInt(prePopulatedData.yearBuilt),
        prePopulatedData.useType || '',
        prePopulatedData.neighborhood || ''
      );
      aroHtml = `<div class="eligibility-badge ${elig.status}" style="padding:14px 18px;margin:12px 0;">
        <div class="badge-verdict" style="font-size:1rem;">${elig.verdict}</div>
        <p class="badge-explanation" style="font-size:0.82rem;">${elig.explanation}</p>
      </div>`;
    }

    // Physical feasibility — Gensler 5-category scorecard (compact)
    const p = physicalResult;
    let physicalHtml = '';
    if (p && p.gensler) {
      const g = p.gensler;
      physicalHtml = `
        <table class="gensler-scorecard" style="font-size:0.8rem;">
          <thead><tr><th>Category</th><th>Score</th><th>Assessment</th></tr></thead>
          <tbody>
            <tr><td class="sc-category">1. Site Context</td><td class="sc-score ${scoreColor(g.siteContext.score)}">${g.siteContext.score}/20</td><td class="sc-assessment">${g.siteContext.text}</td></tr>
            <tr><td class="sc-category">2. Building Shape</td><td class="sc-score ${scoreColor(g.buildingShape.score)}">${g.buildingShape.score}/20</td><td class="sc-assessment">${g.buildingShape.text}</td></tr>
            <tr><td class="sc-category">3. Floorplate Efficiency</td><td class="sc-score ${scoreColor(g.floorplate.score)}">${g.floorplate.score}/20</td><td class="sc-assessment">${g.floorplate.text}</td></tr>
            <tr><td class="sc-category">4. Envelope (Windows)</td><td class="sc-score ${scoreColor(g.envelope.score)}">${g.envelope.score}/20</td><td class="sc-assessment">${g.envelope.text}</td></tr>
            <tr><td class="sc-category">5. Servicing (Parking)</td><td class="sc-score ${scoreColor(g.servicing.score)}">${g.servicing.score}/20</td><td class="sc-assessment">${g.servicing.text}</td></tr>
            <tr class="sc-total-row"><td class="sc-category">TOTAL</td><td class="sc-score ${g.totalColor}">${g.total}/100</td><td class="sc-assessment">${g.totalLabel}</td></tr>
          </tbody>
        </table>`;

      // Foundation flags in report
      if (p.foundationFlag && (p.foundationFlag.color === 'red' || p.foundationFlag.color === 'amber')) {
        const fIcon = p.foundationFlag.color === 'red' ? '\uD83D\uDED1' : '\u26A0\uFE0F';
        physicalHtml += `<div class="foundation-flag ${p.foundationFlag.color}" style="margin-top:8px;"><span class="flag-icon">${fIcon}</span><span>${p.foundationFlag.text}</span></div>`;
      }
    }

    // Unit yield summary
    const y = yieldResult;
    const totalUnits = y ? (y.base.total + y.parkingBonusUnits) : 0;

    // Cost summary
    const c = costResult;

    // Pro forma summary
    const pf = proFormaResult;

    // ESG summary
    const e = esgResult;

    // Financing recommendation
    let finRec = '';
    if (prePopulatedData) {
      const aff = prePopulatedData.affordableStrategy || '';
      const hist = prePopulatedData.historicDesignation || 'None';
      if (aff.includes('100%') || aff.includes('25%')) {
        finRec = 'Given the affordable housing component, we recommend exploring HUD 221(d)(4) permanent financing for non-recourse, 40-year fully amortizing debt at below-market rates. Pair with LIHTC equity allocation through CDLAC/TCAC tax-exempt bonds. Contact HCIDLA for gap financing through available NOFA rounds.';
      } else if (hist !== 'None' && hist !== 'Unknown') {
        finRec = 'The historic designation opens Federal (20%) and California (20%) Historic Tax Credits, creating up to 40% equity fill on qualified rehabilitation expenditures. We recommend HTC bridge equity paired with a conventional construction loan from a bank experienced in adaptive reuse projects.';
      } else {
        finRec = `For a market-rate conversion, we recommend a construction-to-permanent bridge loan at 65-70% LTC from a bank or credit union experienced in adaptive reuse. Upon stabilization, refinance into agency debt (Freddie Mac SBL or Fannie Mae) or a CMBS conduit for long-term permanent financing. Contact ${BRAND.firmName} for lender introductions.`;
      }
    } else {
      finRec = `Contact ${BRAND.firmName} for a tailored financing strategy based on the specific characteristics of this conversion project. We work with banks, debt funds, HUD/FHA lenders, and tax credit investors experienced in adaptive reuse.`;
    }

    // Deal Score for report header
    const totalUnitsForScore = y ? (y.base.total + y.parkingBonusUnits) : 0;
    const cpuMidForScore = c ? Math.round((c.costPerUnit.low + c.costPerUnit.high) / 2) : 0;
    const aroForScore = prePopulatedData && prePopulatedData.yearBuilt ? AROScoring.getEligibility(parseInt(prePopulatedData.yearBuilt), prePopulatedData.useType || '', prePopulatedData.neighborhood || '') : null;
    const targetROCForScore = parseFloat(document.getElementById('m4-target-roc') ? document.getElementById('m4-target-roc').value : 6.5) || 6.5;
    let subsidyPerUnitForScore = 0;
    if (pf && pf.totalProjectCost > 0) {
      const reqCost = pf.noi / (targetROCForScore / 100);
      subsidyPerUnitForScore = Math.max(0, (pf.totalProjectCost - reqCost) / (totalUnitsForScore || 1));
    }
    const ds = typeof DealScore !== 'undefined' ? DealScore.computeDealScore({
      aro: { eligibility: aroForScore ? aroForScore.status : 'ineligible' },
      physical: { totalScore: p ? p.gensler.total : 0 },
      yieldBase: totalUnitsForScore,
      costs: { costPerUnitMid: cpuMidForScore },
      proforma: { returnOnCost: pf ? pf.returnOnCost : 0 },
      subsidyGap: { subsidyPerUnit: subsidyPerUnitForScore }
    }) : null;
    const dsBandColor = ds ? DealScore.bandColor(ds.band) : 'conditional';

    // Max Offer Estimator
    const maxTotalCost = pf && targetROCForScore > 0 ? pf.noi / (targetROCForScore / 100) : 0;
    const conversionCostForMax = pf ? pf.totalConversionCost : 0;
    const maxOffer = maxTotalCost - conversionCostForMax;

    let html = `
      <div class="report-header">
        <div class="report-brand">${BRAND.firmName} — Conversion Feasibility Report</div>
        <div class="report-title">Conversion Feasibility Report</div>
        <div class="report-subtitle">${address}</div>
        ${ds ? `<div class="report-deal-score ${dsBandColor}">
          <span class="rds-label">${BRAND.firmName} Deal Score</span>
          <span class="rds-value">${ds.score}/100 — Band ${ds.band}</span>
          <span class="rds-commentary">${ds.commentary}</span>
        </div>
        ${ds.components ? DealScore.renderScoreBreakdown(ds.components) : ''}` : ''}
      </div>

      <div class="report-section">
        <div class="report-section-title">Property Summary</div>
        <div class="report-metrics-row">
          <div class="report-metric"><div class="report-metric-value">${useType || 'N/A'}</div><div class="report-metric-label">Use Type</div></div>
          <div class="report-metric"><div class="report-metric-value">${yearBuilt || 'N/A'}</div><div class="report-metric-label">Year Built</div></div>
          <div class="report-metric"><div class="report-metric-value">${sf ? sf.toLocaleString() : 'N/A'}</div><div class="report-metric-label">Building SF</div></div>
          <div class="report-metric"><div class="report-metric-value">${p ? p.stories : 'N/A'}</div><div class="report-metric-label">Stories</div></div>
        </div>
      </div>`;

    if (aroHtml) {
      html += `<div class="report-section">
        <div class="report-section-title">ARO Eligibility</div>
        ${aroHtml}
      </div>`;
    }

    if (physicalHtml) {
      html += `<div class="report-section">
        <div class="report-section-title">Physical Feasibility (Gensler 5-Category Assessment)</div>
        ${physicalHtml}
      </div>`;
    }

    // Timeline Estimate (Phase 7)
    if (typeof TimelineClock !== 'undefined') {
      const tl = TimelineClock.computeFromState();
      if (tl) {
        html += `<div class="report-section">
          <div class="report-section-title">Timeline Estimate</div>
          ${TimelineClock.renderTimelineBlock(tl)}
        </div>`;
      }
    }

    if (y) {
      html += `<div class="report-section">
        <div class="report-section-title">Unit Yield Estimate</div>
        <div class="report-metrics-row">
          <div class="report-metric"><div class="report-metric-value">${totalUnits}</div><div class="report-metric-label">Total Units (Base)</div></div>
          <div class="report-metric"><div class="report-metric-value">${y.base.studio.units}</div><div class="report-metric-label">Studios</div></div>
          <div class="report-metric"><div class="report-metric-value">${y.base.oneBR.units}</div><div class="report-metric-label">1 Bedroom</div></div>
          <div class="report-metric"><div class="report-metric-value">${y.base.twoBR.units}</div><div class="report-metric-label">2 Bedroom</div></div>
        </div>
      </div>`;
    }

    if (c) {
      html += `<div class="report-section">
        <div class="report-section-title">Total Project Cost</div>
        <div class="report-metrics-row">
          <div class="report-metric"><div class="report-metric-value">${fmt(c.totalProjectCost.low)} - ${fmt(c.totalProjectCost.high)}</div><div class="report-metric-label">Total Range</div></div>
          <div class="report-metric"><div class="report-metric-value">${fmtFull(c.costPerUnit.low)} - ${fmtFull(c.costPerUnit.high)}</div><div class="report-metric-label">Per Unit</div></div>
        </div>
      </div>`;
    }

    if (pf) {
      html += `<div class="report-section">
        <div class="report-section-title">Pro Forma Summary</div>
        <div class="report-metrics-row">
          <div class="report-metric"><div class="report-metric-value">${fmtFull(pf.noi)}</div><div class="report-metric-label">NOI</div></div>
          <div class="report-metric"><div class="report-metric-value">${fmtFull(pf.stabilizedValue)}</div><div class="report-metric-label">Stabilized Value</div></div>
          <div class="report-metric"><div class="report-metric-value">${pct(pf.returnOnCost)}</div><div class="report-metric-label">Return on Cost</div></div>
        </div>
        <div class="verdict-banner ${pf.verdictColor}" style="margin-top:12px;"><div class="verdict-text" style="font-size:1rem;">${pf.verdict}</div></div>
      </div>`;

      // Enhancement A: Subsidy Gap in Report
      const reportTargetROC = parseFloat(document.getElementById('m4-target-roc').value) || 6.5;
      const reportSubsidyGap = computeSubsidyGap(pf, reportTargetROC);
      if (reportSubsidyGap && !reportSubsidyGap.meetsTarget) {
        html += `<div class="report-section">
          <div class="report-section-title">Subsidy Gap Analysis</div>
          <p style="font-size:0.88rem;color:var(--slate);line-height:1.6;">
            At a target ROC of ${pct(reportSubsidyGap.targetROC)}, this project requires approximately <strong>${fmt(reportSubsidyGap.subsidyGap)}</strong> in subsidy or incentive equity (${fmtFull(Math.round(reportSubsidyGap.subsidyPerUnit))} per unit) to achieve viable returns. Current ROC is ${pct(reportSubsidyGap.currentROC)}. ${reportSubsidyGap.subsidyGap > 10000000 ? 'The gap exceeds $10M — LIHTC 9% allocation, CDLAC/TCAC bonds, or HCIDLA gap financing should be explored.' : 'Consider acquisition price reduction, density bonuses, or alternative capital stack structures.'}
          </p>
        </div>`;
      }

      // Max Offer Estimator in Report
      if (maxOffer !== 0) {
        const maxOfferLabel = maxOffer > 0 ? fmt(Math.round(maxOffer)) : 'Negative — conversion cost exceeds viable total cost';
        html += `<div class="report-section">
          <div class="report-section-title">Max Offer Estimator</div>
          <div class="report-metrics-row">
            <div class="report-metric"><div class="report-metric-value">${pct(targetROCForScore)}</div><div class="report-metric-label">Target ROC</div></div>
            <div class="report-metric"><div class="report-metric-value">${fmt(Math.round(maxTotalCost))}</div><div class="report-metric-label">Max Total Cost</div></div>
            <div class="report-metric"><div class="report-metric-value">${fmt(Math.round(conversionCostForMax))}</div><div class="report-metric-label">Less: Conversion Cost</div></div>
            <div class="report-metric"><div class="report-metric-value" style="color:${maxOffer > 0 ? 'var(--eligible)' : 'var(--ineligible)'};">${maxOfferLabel}</div><div class="report-metric-label">Max Offer</div></div>
          </div>
          <p style="font-size:0.82rem;color:var(--slate);margin-top:8px;">Formula: Max Offer = (NOI ÷ Target ROC) − Total Conversion Cost. ${maxOffer > 0 && pf.acquisitionPrice > 0 ? (maxOffer >= pf.acquisitionPrice ? 'Current ask (' + fmt(pf.acquisitionPrice) + ') is at or below max offer — deal pencils at target ROC.' : 'Current ask (' + fmt(pf.acquisitionPrice) + ') exceeds max offer by ' + fmt(Math.round(pf.acquisitionPrice - maxOffer)) + ' — price reduction or subsidy needed.') : ''}</p>
        </div>`;
      }

      // Enhancement C: Capital Stack Scenarios in Report
      const reportParams = {
        yieldData: yieldResult,
        costData: costResult,
        acquisitionPrice: pf.acquisitionPrice,
        studioRent: document.getElementById('m4-studio-rent').value,
        oneBRRent: document.getElementById('m4-1br-rent').value,
        twoBRRent: document.getElementById('m4-2br-rent').value,
        vacancyRate: document.getElementById('m4-vacancy').value,
        opexRatio: document.getElementById('m4-opex').value
      };
      const reportScenarios = ProForma.runAllCapitalScenarios ? ProForma.runAllCapitalScenarios(reportParams, costResult) : null;
      if (reportScenarios && reportScenarios.length > 0) {
        let bestS = reportScenarios[0];
        reportScenarios.forEach(s => { if (s.roc > bestS.roc) bestS = s; });
        const cMap = { 'Market Rate': 'Low', 'Historic (HTC)': 'High', '100% Affordable': 'High', 'Mixed-Income': 'Medium' };
        html += `<div class="report-section">
          <div class="report-section-title">Capital Stack Scenarios</div>
          <p style="font-size:0.88rem;color:var(--slate);line-height:1.6;">
            Four capital stack scenarios were modeled. The strongest scenario is <strong>${bestS.label}</strong> at ${pct(bestS.roc)} ROC (complexity: ${cMap[bestS.label] || 'Medium'}).
            ${reportScenarios.map(s => `${s.label}: ${pct(s.roc)} ROC`).join(' | ')}.
          </p>
        </div>`;
      }

      // Scenario Stress Test in Report
      if (typeof ScenarioEngine !== 'undefined') {
        const riskText = ScenarioEngine.getRiskSummaryText();
        if (riskText) {
          html += `<div class="report-section">
            <div class="report-section-title">Sensitivity Stress Test</div>
            <p style="font-size:0.88rem;color:var(--slate);line-height:1.6;">${riskText}</p>
          </div>`;
        }
      }
    }

    if (e) {
      html += `<div class="report-section">
        <div class="report-section-title">ESG Impact (E/S/G Three-Pillar Scorecard)</div>`;
      if (e.pillars) {
        html += `<table class="esg-pillar-table" style="font-size:0.8rem;">
          <thead><tr><th>Pillar</th><th>Score</th><th>Highlights</th></tr></thead>
          <tbody>
            <tr><td>\uD83C\uDF3F Environmental</td><td class="${scoreColor(e.pillars.environmental.score)}" style="text-align:center;font-weight:700;">${e.pillars.environmental.score}/20</td><td>${e.co2AvoidedTons.toLocaleString()} tons CO2e avoided, ${e.totalDebrisTons.toLocaleString()} tons debris diverted</td></tr>
            <tr><td>\uD83C\uDFE0 Social</td><td class="${scoreColor(e.pillars.social.score)}" style="text-align:center;font-weight:700;">${e.pillars.social.score}/20</td><td>${e.totalUnits} housing units created, ${e.tripReduction.toLocaleString()} fewer daily trips</td></tr>
            <tr><td>\uD83C\uDFDB Governance</td><td class="${scoreColor(e.pillars.governance.score)}" style="text-align:center;font-weight:700;">${e.pillars.governance.score}/20</td><td>${e.certs.filter(c => c.eligible).length} certifications eligible, GRESB/SASB aligned</td></tr>
            <tr class="sc-total-row"><td>TOTAL</td><td style="text-align:center;font-weight:700;">${e.totalScore}/60</td><td></td></tr>
          </tbody>
        </table>`;
      } else {
        html += `<div class="report-metrics-row">
          <div class="report-metric"><div class="report-metric-value">${e.totalDebrisTons.toLocaleString()}</div><div class="report-metric-label">Tons Debris Diverted</div></div>
          <div class="report-metric"><div class="report-metric-value">${e.co2AvoidedTons.toLocaleString()}</div><div class="report-metric-label">Tons CO2e Avoided</div></div>
          <div class="report-metric"><div class="report-metric-value">${e.tripReduction.toLocaleString()}/day</div><div class="report-metric-label">Trips Reduced</div></div>
          <div class="report-metric"><div class="report-metric-value">60-80%</div><div class="report-metric-label">Carbon Reduction</div></div>
        </div>`;
      }
      html += `</div>`;
    }

    // Enhancement 3: Program Recommendation
    const programRec = recommendProgram();
    if (programRec) {
      html += `<div class="report-section">
        <div class="report-section-title">Program Recommendation</div>
        <div class="program-rec-grid">
          <div class="program-rec-card primary">
            <div class="prc-badge">Primary</div>
            <div class="prc-icon">${programRec.primary.icon}</div>
            <div class="prc-name">${programRec.primary.name}</div>
            <div class="prc-desc">${programRec.primary.desc}</div>
          </div>
          <div class="program-rec-card backup">
            <div class="prc-badge">Backup</div>
            <div class="prc-icon">${programRec.backup.icon}</div>
            <div class="prc-name">${programRec.backup.name}</div>
            <div class="prc-desc">${programRec.backup.desc}</div>
          </div>
          <div class="program-rec-card alternative">
            <div class="prc-badge">Alternative</div>
            <div class="prc-icon">${programRec.alternative.icon}</div>
            <div class="prc-name">${programRec.alternative.name}</div>
            <div class="prc-desc">${programRec.alternative.desc}</div>
          </div>
        </div>
      </div>`;
    }

    // Enhancement 5: Risk & Complexity Summary
    const riskSummary = assessRiskComplexity();
    if (riskSummary) {
      html += `<div class="report-section">
        <div class="report-section-title">Risk & Complexity Summary</div>
        <div class="risk-summary-grid">
          <div class="risk-card ${riskColor(riskSummary.entitlement.level)}">
            <div class="risk-card-header">Entitlement Risk</div>
            <div class="risk-card-level">${riskSummary.entitlement.level}</div>
            <div class="risk-card-text">${riskSummary.entitlement.text}</div>
          </div>
          <div class="risk-card ${riskColor(riskSummary.construction.level)}">
            <div class="risk-card-header">Construction Risk</div>
            <div class="risk-card-level">${riskSummary.construction.level}</div>
            <div class="risk-card-text">${riskSummary.construction.text}</div>
          </div>
          <div class="risk-card ${riskColor(riskSummary.capitalStack.level)}">
            <div class="risk-card-header">Capital Stack Risk</div>
            <div class="risk-card-level">${riskSummary.capitalStack.level}</div>
            <div class="risk-card-text">${riskSummary.capitalStack.text}</div>
          </div>
        </div>
      </div>`;
    }

    html += `<div class="report-section">
      <div class="report-section-title">Financing Recommendation</div>
      <div class="financing-rec">${finRec}</div>
    </div>`;

    // Enhancement 4: Process Roadmap
    const roadmap = generateRoadmap();
    html += `<div class="report-section">
      <div class="report-section-title">Process Roadmap</div>
      <div class="roadmap-timeline">`;
    roadmap.forEach((phase, idx) => {
      html += `<div class="roadmap-phase">
        <div class="roadmap-phase-header">
          <span class="roadmap-phase-num">Phase ${phase.num}</span>
          <span class="roadmap-phase-name">${phase.name}</span>
          <span class="roadmap-phase-duration">${phase.duration}</span>
        </div>
        <ul class="roadmap-tasks">`;
      phase.tasks.forEach(t => { html += `<li>${t}</li>`; });
      html += `</ul>
        <div class="roadmap-note">${phase.note}</div>
      </div>`;
      if (idx < roadmap.length - 1) {
        html += `<div class="roadmap-connector"></div>`;
      }
    });
    html += `</div></div>`;

    // Sponsor Notes in Report
    const rSponsorExp = document.getElementById('sponsor-experience') ? document.getElementById('sponsor-experience').value : '';
    const rSponsorJV = document.getElementById('sponsor-jv') ? document.getElementById('sponsor-jv').value : '';
    const rSponsorHold = document.getElementById('sponsor-hold') ? document.getElementById('sponsor-hold').value : '';
    const rSponsorExit = document.getElementById('sponsor-exit') ? document.getElementById('sponsor-exit').value : '';
    if (rSponsorExp || rSponsorJV || rSponsorHold || rSponsorExit) {
      html += `<div class="report-section">
        <div class="report-section-title">Sponsor Notes</div>
        <div style="font-size:0.88rem;color:var(--slate);line-height:1.7;">`;
      if (rSponsorExp) html += `<p><strong>Experience:</strong> ${rSponsorExp}</p>`;
      if (rSponsorJV) html += `<p><strong>JV Structure:</strong> ${rSponsorJV}</p>`;
      if (rSponsorHold) html += `<p><strong>Hold Period:</strong> ${rSponsorHold}</p>`;
      if (rSponsorExit) html += `<p><strong>Exit Strategy:</strong> ${rSponsorExit}</p>`;
      html += `</div></div>`;
    }

    // Sponsor Fit (Phase 7)
    if (typeof SponsorFit !== 'undefined') {
      const sfResult = SponsorFit.computeFromState();
      if (sfResult) {
        html += `<div class="report-section">
          <div class="report-section-title">Sponsor Fit</div>
          ${SponsorFit.renderSponsorFitBlock(sfResult)}
        </div>`;
      }
    }

    // Internal Comps (Phase 7)
    if (typeof InternalComps !== 'undefined' && typeof ExportModule !== 'undefined') {
      const pipeline = ExportModule.getProspectingList();
      if (pipeline.length >= 2) {
        const currentDeal = {
          address: address,
          submarket: prePopulatedData ? (prePopulatedData.neighborhood || '') : '',
          useDescription: useType,
          sqft: sf,
          dealScore: ds ? ds.score : 0,
          returnOnCost: pf ? pf.returnOnCost : null,
          costPerUnitMid: c ? Math.round((c.costPerUnit.low + c.costPerUnit.high) / 2) : null
        };
        const compsResult = InternalComps.computeInternalComps(currentDeal, pipeline);
        if (compsResult) {
          html += `<div class="report-section">
            ${InternalComps.renderCompsBlock(compsResult, currentDeal)}
          </div>`;
        }
      }
    }

    // Next Best Actions (Phase 7) — replaces static Recommended Next Steps
    if (typeof NBAEngine !== 'undefined') {
      const nbaActions = NBAEngine.computeFromState();
      if (nbaActions && nbaActions.length > 0) {
        html += `<div class="report-section">
          <div class="report-section-title">Recommended Next Steps</div>
          ${NBAEngine.renderNBABlock(nbaActions)}
        </div>`;
      } else {
        html += `
        <div class="report-section">
          <div class="report-section-title">Recommended Next Steps</div>
          <ul class="report-next-steps">
            <li><span class="step-num">01</span>Order Phase I Environmental Site Assessment ($3,000-6,000)</li>
            <li><span class="step-num">02</span>Commission architect feasibility study (Studio One Eleven or similar — $15,000-40,000)</li>
            <li><span class="step-num">03</span>Engage structural engineer for preliminary assessment ($5,000-15,000)</li>
            <li><span class="step-num">04</span>Contact ${BRAND.firmName} for financing pre-qualification and lender introductions</li>
          </ul>
        </div>`;
      }
    } else {
      html += `
      <div class="report-section">
        <div class="report-section-title">Recommended Next Steps</div>
        <ul class="report-next-steps">
          <li><span class="step-num">01</span>Order Phase I Environmental Site Assessment ($3,000-6,000)</li>
          <li><span class="step-num">02</span>Commission architect feasibility study (Studio One Eleven or similar — $15,000-40,000)</li>
          <li><span class="step-num">03</span>Engage structural engineer for preliminary assessment ($5,000-15,000)</li>
          <li><span class="step-num">04</span>Contact ${BRAND.firmName} for financing pre-qualification and lender introductions</li>
        </ul>
      </div>`;
    }

    // Enhancement 2: Data Reliability in Report
    const reliability = getDataReliability();
    if (reliability.level === 'Low') {
      html += `<div class="report-section">
        <div class="data-reliability-badge ${reliability.color}" style="margin:0;">
          <span class="dr-level">Data Reliability: ${reliability.level}</span>
          <span class="dr-detail">${reliability.filled}/${reliability.total} core fields provided. Missing: ${reliability.missing.join(', ')}. Results should be treated as preliminary.</span>
        </div>
      </div>`;
    }

    // Enhancement 7: Assumptions & Version Footer
    html += `<div class="report-assumptions">
      <div class="report-section-title">Key Assumptions</div>
      <ul class="assumptions-list">
        <li>Cost estimates based on 2026 Los Angeles market data (RSMeans, Rider Levett Bucknall, local contractor surveys)</li>
        <li>Residential unit sizes: Studio 450-500 SF, 1BR 600-700 SF, 2BR 850-950 SF (net rentable)</li>
        <li>Net-to-gross efficiency: 72% (office-to-residential conversion standard)</li>
        <li>Operating expense ratio: 35-45% of EGI (market standard for LA multifamily)</li>
        <li>ARO eligibility based on LA City Ordinance effective February 1, 2026 (ARO 2.0)</li>
        <li>Historic Tax Credit rates: 20% Federal + 20% California on qualified rehabilitation expenditures</li>
        <li>Parking requirement: None under ARO by-right (LAMC 12.24.Y)</li>
      </ul>
    </div>

    <div class="report-footer">
      <div class="report-footer-brand"><span>${BRAND.firmName}</span> — ${BRAND.tagline}</div>
      <div class="report-footer-sub">${BRAND.productName} — Conversion Feasibility Report</div>
      <div class="report-version">${BRAND.productVersion} — Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="report-disclaimer">${BRAND.disclaimerFull}</div>
    </div>`;

    report.innerHTML = html;
    report.classList.add('visible');

    // Show export buttons
    document.getElementById('report-export-row').style.display = '';

    setTimeout(() => {
      report.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }

  function exportReport() {
    const reportEl = document.getElementById('final-report');
    if (!reportEl) return;

    // Enhancement 8: Outcome Tracking Block
    const address = prePopulatedData ? (prePopulatedData.address || 'Unknown') : 'Unknown';
    const now = new Date();
    const trackingBlock = `
    <div class="outcome-tracking no-print" style="margin-top:32px;padding:24px;background:#f9f9f6;border:2px dashed rgba(13,13,13,0.15);border-radius:12px;">
      <div style="font-family:'DM Mono',monospace;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:#999;margin-bottom:12px;">Internal Outcome Tracking — ${BRAND.firmName}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem;color:#333;">
        <div><strong>Property:</strong> ${address}</div>
        <div><strong>Report Generated:</strong> ${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
        <div><strong>Report Version:</strong> ${BRAND.productVersion}</div>
        <div><strong>Generated By:</strong> ${BRAND.firmName} ${BRAND.productName}</div>
        <div><strong>Physical Score:</strong> ${physicalResult ? physicalResult.gensler.total + '/100' : 'N/A'}</div>
        <div><strong>Return on Cost:</strong> ${proFormaResult ? proFormaResult.returnOnCost.toFixed(1) + '%' : 'N/A'}</div>
        <div><strong>Total Units:</strong> ${yieldResult ? (yieldResult.base.total + yieldResult.parkingBonusUnits) : 'N/A'}</div>
        <div><strong>Verdict:</strong> ${proFormaResult ? proFormaResult.verdict : 'N/A'}</div>
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(13,13,13,0.1);">
        <div style="font-size:0.78rem;color:#666;margin-bottom:8px;">Outcome Status (update manually):</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span style="padding:4px 12px;border:1px solid #ccc;border-radius:6px;font-size:0.78rem;color:#666;">&#9675; Pursuing</span>
          <span style="padding:4px 12px;border:1px solid #ccc;border-radius:6px;font-size:0.78rem;color:#666;">&#9675; LOI Submitted</span>
          <span style="padding:4px 12px;border:1px solid #ccc;border-radius:6px;font-size:0.78rem;color:#666;">&#9675; Under Contract</span>
          <span style="padding:4px 12px;border:1px solid #ccc;border-radius:6px;font-size:0.78rem;color:#666;">&#9675; Closed</span>
          <span style="padding:4px 12px;border:1px solid #ccc;border-radius:6px;font-size:0.78rem;color:#666;">&#9675; Passed</span>
        </div>
        <div style="margin-top:8px;font-size:0.75rem;color:#999;">Notes: ________________________________________</div>
      </div>
    </div>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Conversion Feasibility Report — ${BRAND.firmName}</title>
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/tab3.css">
  <style>
    body { background: white; padding: 20px; }
    body::before { display: none !important; }
    .final-report { display: block !important; box-shadow: none !important; margin: 0 !important; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="final-report visible">${reportEl.innerHTML}</div>
  ${trackingBlock}
  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="padding:12px 32px;font-size:1rem;cursor:pointer;background:#0d0d0d;color:#f5f2eb;border:none;border-radius:8px;">Print / Save as PDF</button>
  </div>
</body>
</html>`);
    printWindow.document.close();
  }

  // ─── Pre-populate from Tab 1 or Tab 2 ───
  function prePopulateFromTab1() {
    const data = {
      address: document.getElementById('input-address').value,
      neighborhood: document.getElementById('input-neighborhood').value,
      yearBuilt: document.getElementById('input-year-built').value,
      buildingSF: document.getElementById('input-sf').value,
      useType: document.getElementById('input-use-type').value,
      stories: document.getElementById('input-stories').value,
      vacancyRate: document.getElementById('input-vacancy').value,
      estimatedValue: document.getElementById('input-value').value,
      floorplateShape: document.getElementById('input-floorplate').value,
      historicDesignation: document.getElementById('input-historic').value,
      affordableStrategy: document.getElementById('input-affordable').value,
      zoning: document.getElementById('input-zoning').value
    };

    prePopulatedData = data;

    // Fill Module 1 fields where applicable
    if (data.buildingSF) document.getElementById('m1-total-sf').value = data.buildingSF;
    if (data.stories) document.getElementById('m1-stories').value = data.stories;

    // Estimate typical floor SF
    if (data.buildingSF && data.stories) {
      document.getElementById('m1-typical-sf').value = Math.round(parseFloat(data.buildingSF) / parseInt(data.stories));
    }

    switchTab('feasibility');
  }

  function prePopulateFromParcel(parcel) {
    prePopulatedData = {
      address: parcel.address || '',
      yearBuilt: parcel.yearBuilt || parcel.effectiveyearbuilt || '',
      buildingSF: parcel.sqft || parcel.sqftmain || '',
      useType: parcel.useDescription || parcel.usedescription || '',
      stories: '',
      estimatedValue: '',
      neighborhood: '',
      historicDesignation: 'Unknown',
      affordableStrategy: 'Unknown',
      vacancyRate: 'Unknown',
      zoning: 'Unknown'
    };

    if (prePopulatedData.buildingSF) document.getElementById('m1-total-sf').value = prePopulatedData.buildingSF;

    switchTab('feasibility');
  }

  // ─── Input Change Listeners ───
  function initListeners() {
    // Module 1 — recalculate on any input change
    const m1Inputs = document.querySelectorAll('#module-1 input, #module-1 select');
    m1Inputs.forEach(input => {
      input.addEventListener('change', () => {
        calculatePhysical();
        // Recalculate downstream if already completed
        if (modules[2].completed) { calculateYield(); renderYieldOutput(); }
        if (modules[3].completed) { calculateCost(); renderCostOutput(); }
        if (modules[4].completed) { calculateProForma(); }
        if (modules[5].completed) { calculateESG(); }
      });
    });

    // Module 3 — recalculate cost on change
    const m3Inputs = document.querySelectorAll('#module-3 input, #module-3 select');
    m3Inputs.forEach(input => {
      input.addEventListener('change', () => {
        if (modules[2].completed) {
          calculateCost();
          if (modules[4].completed) calculateProForma();
        }
      });
    });

    // Module 4 — recalculate pro forma on change
    const m4Inputs = document.querySelectorAll('#module-4 input, #module-4 select');
    m4Inputs.forEach(input => {
      input.addEventListener('change', () => {
        if (modules[3].completed) calculateProForma();
      });
    });

    // Stories to convert → auto-update retained stories
    const storiesToConvert = document.getElementById('m1-stories-to-convert');
    if (storiesToConvert) {
      storiesToConvert.addEventListener('input', updateRetainedStories);
    }

    // Module 2 layout inputs — recalculate yield on change
    const m2Inputs = document.querySelectorAll('#module-2 input');
    m2Inputs.forEach(input => {
      input.addEventListener('change', () => {
        if (modules[1].completed) {
          calculateYield();
          if (modules[3].completed) { calculateCost(); renderCostOutput(); }
          if (modules[4].completed) { calculateProForma(); }
        }
      });
    });

    // Parking conversion toggle
    const parkingConvCheck = document.getElementById('m3-parking-conv');
    if (parkingConvCheck) {
      parkingConvCheck.addEventListener('change', () => {
        const unitsField = document.getElementById('m3-parking-units-row');
        if (unitsField) unitsField.style.display = parkingConvCheck.checked ? '' : 'none';
      });
    }
  }

  // ─── Init ───
  function init() {
    initListeners();
    updateProgress();
  }

  // ─── getState() — expose all cached results for IC Memo / Snapshot ───
  function getState() {
    return {
      prePopulatedData,
      physicalResult,
      yieldResult,
      costResult,
      proFormaResult,
      esgResult,
      riskSummary: assessRiskComplexity(),
      roadmap: generateRoadmap()
    };
  }

  return {
    init,
    toggleModule,
    onModule1Complete,
    onModule2Complete,
    onModule3Complete,
    onModule4Complete,
    onModule5Complete,
    calculatePhysical,
    calculateYield,
    calculateCost,
    calculateProForma,
    calculateESG,
    switchYieldRange,
    prePopulateFromTab1,
    prePopulateFromParcel,
    exportReport,
    onScopeChange,
    getState
  };
})();
