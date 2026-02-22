/**
 * AI-Recommended Prospects — Weighted scoring engine + UI
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const AIProspects = (() => {
  let allProperties = [];
  let rankedProperties = [];
  let visibleCount = 20;
  let initialized = false;
  let debounceTimer = null;

  // Factor keys in the same order as AROScoring.calculateScore() returns factors
  const FACTOR_KEYS = ['age', 'vacancy', 'useType', 'floorplate', 'historic', 'affordable', 'zoning'];
  const FACTOR_SHORT = ['Age', 'Vac', 'Use', 'Floor', 'Hist', 'Affd', 'Zone'];

  // ─── Strategy Presets ───
  const PRESETS = {
    balanced:    { label: 'Balanced',              weights: { age: 1.0, vacancy: 1.0, useType: 1.0, floorplate: 1.0, historic: 1.0, affordable: 1.0, zoning: 1.0 } },
    distress:    { label: 'Value-Add Distress',    weights: { age: 1.8, vacancy: 2.5, useType: 1.0, floorplate: 0.8, historic: 0.5, affordable: 0.5, zoning: 0.8 } },
    trophy:      { label: 'Trophy Conversion',     weights: { age: 0.8, vacancy: 0.8, useType: 2.0, floorplate: 2.5, historic: 1.0, affordable: 0.3, zoning: 1.0 } },
    affordable:  { label: 'Affordable Housing Play', weights: { age: 0.8, vacancy: 1.5, useType: 0.8, floorplate: 0.5, historic: 0.5, affordable: 3.0, zoning: 1.0 } },
    historic:    { label: 'Historic Tax Credit',   weights: { age: 1.5, vacancy: 0.8, useType: 0.8, floorplate: 0.8, historic: 3.0, affordable: 0.5, zoning: 0.5 } }
  };

  let activePreset = 'balanced';
  let currentWeights = { ...PRESETS.balanced.weights };

  // ─── Scoring Engine ───

  function scoreProperty(property) {
    const result = AROScoring.calculateScore(property);
    const baseFactors = result.factors; // always 7 elements, same order as FACTOR_KEYS

    // Calculate weighted score
    let weightedSum = 0;
    let maxPossibleWeighted = 0;
    const maxPoints = [20, 22, 16, 14, 12, 10, 8]; // max per factor from scoring engine

    const factorDetails = baseFactors.map((f, i) => {
      const key = FACTOR_KEYS[i];
      const w = currentWeights[key];
      const weighted = f.points * w;
      weightedSum += weighted;
      maxPossibleWeighted += maxPoints[i] * w;
      return {
        label: FACTOR_SHORT[i],
        basePts: f.points,
        weight: w,
        weighted: weighted,
        note: f.note,
        value: f.value,
        sentiment: f.sentiment
      };
    });

    // Normalize to 0-100
    const normalizedScore = maxPossibleWeighted > 0
      ? Math.round((weightedSum / maxPossibleWeighted) * 100)
      : 0;

    const threshold = AROScoring.SCORE_THRESHOLDS.find(t => normalizedScore >= t.min);
    const colorClass = AROScoring.getScoreColor(normalizedScore);

    return {
      property,
      score: normalizedScore,
      rawScore: result.score,
      factors: factorDetails,
      threshold,
      colorClass
    };
  }

  const MIN_SCORE = 60; // Only show Strong (60+) and Exceptional (80+) deals

  function rankAll() {
    rankedProperties = allProperties
      .map(p => scoreProperty(p))
      .filter(s => s.score >= MIN_SCORE);
    rankedProperties.sort((a, b) => b.score - a.score);
  }

  // ─── Narrative Generator ───

  function generateNarrative(scored) {
    const p = scored.property;
    const age = AROScoring.CURRENT_YEAR - (p.yearBuilt || AROScoring.CURRENT_YEAR);
    const topFactors = [...scored.factors]
      .filter(f => f.weighted > 0)
      .sort((a, b) => b.weighted - a.weighted)
      .slice(0, 3);

    const sfFormatted = p.buildingSF ? (p.buildingSF / 1000).toFixed(0) + 'k' : '';
    const useLabel = p.useType.replace(/\s*\d.*$/, '').toLowerCase();

    let sentences = [];

    // Opening sentence with property identity
    sentences.push(
      `This ${age}-year-old ${useLabel} building in ${p.submarket}` +
      (sfFormatted ? ` (${sfFormatted} SF)` : '') +
      ` presents a compelling adaptive reuse opportunity.`
    );

    // Key factor sentences
    const factorSentences = [];
    topFactors.forEach(f => {
      if (f.label === 'Vac' && f.basePts >= 16) {
        factorSentences.push(`With ${p.vacancyRate} vacancy, the owner faces declining NOI and may be motivated to transact.`);
      } else if (f.label === 'Age' && f.basePts >= 20) {
        factorSentences.push(`At ${age} years old, the building qualifies for by-right conversion with no discretionary review.`);
      } else if (f.label === 'Hist' && f.basePts > 0) {
        factorSentences.push(`Its ${p.historicDesignation} designation unlocks Federal and State Historic Tax Credits — a significant equity source.`);
      } else if (f.label === 'Affd' && f.basePts > 0) {
        factorSentences.push(`The affordable housing component unlocks density bonuses and access to public financing programs.`);
      } else if (f.label === 'Floor' && f.basePts >= 14) {
        factorSentences.push(`The narrow floorplate is ideal for residential unit layouts, minimizing dark interior space.`);
      } else if (f.label === 'Use' && f.basePts >= 16) {
        factorSentences.push(`As a ${useLabel} property, it falls squarely within the ARO's core conversion use cases.`);
      }
    });
    if (factorSentences.length > 0) sentences.push(factorSentences[0]);

    // Context sentence
    if (p.transitProximity) {
      sentences.push(`Transit access (${p.transitProximity}) strengthens the residential conversion thesis.`);
    } else if (p.neighborhoodContext) {
      sentences.push(p.neighborhoodContext + '.');
    }

    return sentences.join(' ');
  }

  // ─── Deal Angles ───

  function getTopDealAngles(property, limit) {
    const eligibility = AROScoring.getEligibility(
      parseInt(property.yearBuilt) || AROScoring.CURRENT_YEAR,
      property.useType,
      ''
    );
    const allAngles = AROScoring.getDealAngles(property, eligibility);
    return allAngles.slice(0, limit || 3);
  }

  // ─── Actions ───

  function addToMyList(index) {
    const scored = rankedProperties[index];
    if (!scored) return;
    const p = scored.property;

    const parcel = {
      address: p.address + ', ' + p.city,
      ain: p.id,
      useDescription: p.useType,
      yearBuilt: p.yearBuilt,
      sqft: p.buildingSF,
      lat: null,
      lng: null,
      raw: {
        effectiveyearbuilt: String(p.yearBuilt),
        usedescription: p.useType,
        sqftmain: String(p.buildingSF)
      }
    };

    const added = ExportModule.addToProspectingList(parcel);
    if (added) {
      // Update button state
      const btn = document.querySelector(`[data-ai-add="${index}"]`);
      if (btn) {
        btn.textContent = 'Added';
        btn.disabled = true;
        btn.classList.remove('btn-gold');
        btn.classList.add('btn-outline');
      }
    }
  }

  function runFullAnalysis(index) {
    const scored = rankedProperties[index];
    if (!scored) return;
    const p = scored.property;

    // Pre-populate Tab 1 fields
    const fields = {
      'input-address': p.address + ', ' + p.city,
      'input-neighborhood': p.submarket,
      'input-zoning': p.zoning,
      'input-year-built': p.yearBuilt,
      'input-sf': p.buildingSF,
      'input-use-type': p.useType,
      'input-stories': p.stories,
      'input-vacancy': p.vacancyRate,
      'input-floorplate': p.floorplateShape,
      'input-historic': p.historicDesignation,
      'input-affordable': p.affordableStrategy
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null) {
        el.value = String(value);
      }
    });

    // Switch to screener tab and run analysis
    if (typeof switchTab === 'function') switchTab('screener');
    setTimeout(() => {
      if (typeof analyzeProperty === 'function') analyzeProperty();
    }, 200);
  }

  // ─── Rendering ───

  function renderCards() {
    const container = document.getElementById('ai-prospects-cards');
    if (!container) return;

    const showing = rankedProperties.slice(0, visibleCount);

    container.innerHTML = showing.map((scored, i) => {
      const p = scored.property;
      const age = AROScoring.CURRENT_YEAR - (p.yearBuilt || AROScoring.CURRENT_YEAR);
      const sfFormatted = p.buildingSF ? (p.buildingSF / 1000).toFixed(0) + 'k SF' : '';
      const narrative = generateNarrative(scored);
      const angles = getTopDealAngles(p, 3);

      return `
        <div class="ai-card">
          <div class="ai-card-header">
            <div>
              <div class="ai-card-address">${p.address}, ${p.city}</div>
              <div class="ai-card-meta">${p.submarket} · ${p.useType} · ${p.yearBuilt} · ${sfFormatted}</div>
            </div>
            <div class="ai-card-score">${scored.score} <small>/ 100</small></div>
          </div>

          <div class="ai-score-bar-track">
            <div class="ai-score-bar-fill ${scored.colorClass}" data-score="${scored.score}"></div>
          </div>
          <span class="ai-score-label chip ${scored.colorClass}">${scored.threshold.label}</span>

          <div style="margin-top:16px;">
            <div class="ai-factor-title">Factor Breakdown</div>
            <div class="ai-factor-grid">
              ${scored.factors.map(f => `
                <div class="ai-factor-cell">
                  <div class="ai-factor-cell-label">${f.label}</div>
                  <div class="ai-factor-cell-pts">${f.basePts}pt</div>
                  <div class="ai-factor-cell-weight">&times;${f.weight.toFixed(1)}</div>
                  <div class="ai-factor-cell-result">=${f.weighted.toFixed(1)}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="ai-narrative-title">Why This Property</div>
          <div class="ai-narrative">${narrative}</div>

          <div class="ai-angles-title">Top Deal Angles</div>
          ${angles.map(a => `<div class="ai-angle">${a.icon} ${a.title}</div>`).join('')}

          <div class="ai-card-actions">
            <button class="btn-gold" data-ai-add="${i}" onclick="AIProspects.addToMyList(${i})">Add to My List</button>
            <button class="btn-outline" style="width:auto;" onclick="AIProspects.runFullAnalysis(${i})">Run Full Analysis</button>
          </div>
        </div>
      `;
    }).join('');

    // Show More button
    const showMoreContainer = document.getElementById('ai-show-more');
    if (showMoreContainer) {
      showMoreContainer.style.display = visibleCount < rankedProperties.length ? 'block' : 'none';
      showMoreContainer.innerHTML = visibleCount < rankedProperties.length
        ? `<button onclick="AIProspects.showMore()">Show More (${Math.min(20, rankedProperties.length - visibleCount)} more)</button>`
        : '';
    }

    // Meta line
    const meta = document.getElementById('ai-results-meta');
    if (meta) {
      meta.textContent = `Showing ${Math.min(visibleCount, rankedProperties.length)} of ${rankedProperties.length} properties · Ranked by ${PRESETS[activePreset]?.label || 'Custom'} weights`;
    }

    // Animate bars
    requestAnimationFrame(() => {
      container.querySelectorAll('.ai-score-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.score + '%';
      });
    });
  }

  function showMore() {
    visibleCount += 20;
    renderCards();
  }

  // ─── Preset & Weight Controls ───

  function selectPreset(presetKey) {
    if (!PRESETS[presetKey]) return;
    activePreset = presetKey;
    currentWeights = { ...PRESETS[presetKey].weights };
    visibleCount = 20;

    // Update preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetKey);
    });

    // Update sliders
    FACTOR_KEYS.forEach(key => {
      const slider = document.getElementById('weight-' + key);
      if (slider) {
        slider.value = currentWeights[key];
        const valEl = document.getElementById('weight-val-' + key);
        if (valEl) valEl.textContent = currentWeights[key].toFixed(1);
      }
    });

    rankAll();
    renderCards();
  }

  function onWeightChange(key, value) {
    currentWeights[key] = parseFloat(value);

    // Switch preset to custom
    activePreset = 'custom';
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));

    // Update display value
    const valEl = document.getElementById('weight-val-' + key);
    if (valEl) valEl.textContent = parseFloat(value).toFixed(1);

    // Debounce re-rank
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      visibleCount = 20;
      rankAll();
      renderCards();
    }, 150);
  }

  function toggleWeightsPanel() {
    const panel = document.getElementById('weights-panel');
    const toggle = document.getElementById('weights-toggle');
    if (panel) {
      panel.classList.toggle('open');
      if (toggle) {
        toggle.textContent = panel.classList.contains('open')
          ? '\u25B4 Hide Advanced Weights'
          : '\u25BE Advanced Weights';
      }
    }
  }

  // ─── Initialization ───

  function init() {
    if (initialized) {
      // Already loaded — just re-render in case prospecting list changed
      renderCards();
      return;
    }

    // Data loaded via <script> tag (AI_RECOMMENDED_PROPERTIES global) to avoid file:// CORS issues
    if (typeof AI_RECOMMENDED_PROPERTIES !== 'undefined') {
      allProperties = AI_RECOMMENDED_PROPERTIES;
    } else {
      console.warn('AI_RECOMMENDED_PROPERTIES data not found');
      allProperties = [];
    }

    rankAll();
    renderCards();

    // Bind preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => selectPreset(btn.dataset.preset));
    });

    // Bind weight sliders
    FACTOR_KEYS.forEach(key => {
      const slider = document.getElementById('weight-' + key);
      if (slider) {
        slider.addEventListener('input', (e) => onWeightChange(key, e.target.value));
      }
    });

    initialized = true;
  }

  return {
    init,
    addToMyList,
    runFullAnalysis,
    showMore,
    selectPreset,
    toggleWeightsPanel
  };
})();
