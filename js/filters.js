/**
 * Filter Panel Logic — Map Screener sidebar filters
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const Filters = (() => {
  let currentFilters = {};

  function init() {
    bindEvents();
    resetFilters();
  }

  function bindEvents() {
    const applyBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filters');

    if (applyBtn) {
      applyBtn.addEventListener('click', applyFilters);
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetFilters();
        applyFilters();
      });
    }

    // Score slider live value display
    const scoreSlider = document.getElementById('filter-min-score');
    const scoreValue = document.getElementById('score-slider-value');
    if (scoreSlider && scoreValue) {
      scoreSlider.addEventListener('input', () => {
        scoreValue.textContent = scoreSlider.value;
      });
    }

    // Age slider live value display
    const ageMinSlider = document.getElementById('filter-age-min');
    const ageMaxSlider = document.getElementById('filter-age-max');
    const ageMinVal = document.getElementById('age-min-value');
    const ageMaxVal = document.getElementById('age-max-value');

    if (ageMinSlider && ageMinVal) {
      ageMinSlider.addEventListener('input', () => {
        ageMinVal.textContent = ageMinSlider.value;
        if (parseInt(ageMinSlider.value) > parseInt(ageMaxSlider.value)) {
          ageMaxSlider.value = ageMinSlider.value;
          ageMaxVal.textContent = ageMinSlider.value;
        }
      });
    }

    if (ageMaxSlider && ageMaxVal) {
      ageMaxSlider.addEventListener('input', () => {
        ageMaxVal.textContent = ageMaxSlider.value === '80' ? '80+' : ageMaxSlider.value;
        if (parseInt(ageMaxSlider.value) < parseInt(ageMinSlider.value)) {
          ageMinSlider.value = ageMaxSlider.value;
          ageMinVal.textContent = ageMaxSlider.value;
        }
      });
    }
  }

  function getCurrentFilters() {
    // Read current filter state from DOM
    const useTypes = [];
    document.querySelectorAll('.filter-use-type:checked').forEach(cb => {
      useTypes.push(cb.value);
    });

    const eligibilityEl = document.querySelector('input[name="eligibility-filter"]:checked');
    const eligibilityFilter = eligibilityEl ? eligibilityEl.value : 'all';

    const minScoreEl = document.getElementById('filter-min-score');
    const minScore = minScoreEl ? parseInt(minScoreEl.value) : 0;

    const minSFEl = document.getElementById('filter-min-sf');
    const minSF = minSFEl ? (minSFEl.value || 0) : 0;

    const ageMinEl = document.getElementById('filter-age-min');
    const ageMaxEl = document.getElementById('filter-age-max');
    const ageMin = ageMinEl ? parseInt(ageMinEl.value) : 0;
    const ageMax = ageMaxEl ? parseInt(ageMaxEl.value) : 80;

    const currentYear = AROScoring.CURRENT_YEAR;

    currentFilters = {
      useTypes: useTypes.length > 0 ? useTypes : null,
      eligibilityFilter,
      minScore: minScore > 0 ? minScore : null,
      minSF: parseInt(minSF) || null,
      minYearBuilt: ageMax < 80 ? currentYear - ageMax : null,
      maxYearBuilt: ageMin > 0 ? currentYear - ageMin : null
    };

    return currentFilters;
  }

  function applyFilters() {
    const filters = getCurrentFilters();
    MapEngine.refreshWithFilters(filters);
  }

  function resetFilters() {
    // Reset checkboxes
    document.querySelectorAll('.filter-use-type').forEach(cb => {
      cb.checked = false;
    });

    // Reset radio to "Show All"
    const allRadio = document.querySelector('input[name="eligibility-filter"][value="all"]');
    if (allRadio) allRadio.checked = true;

    // Reset sliders
    const scoreSlider = document.getElementById('filter-min-score');
    const scoreValue = document.getElementById('score-slider-value');
    if (scoreSlider) scoreSlider.value = 0;
    if (scoreValue) scoreValue.textContent = '0';

    const ageMinSlider = document.getElementById('filter-age-min');
    const ageMaxSlider = document.getElementById('filter-age-max');
    const ageMinVal = document.getElementById('age-min-value');
    const ageMaxVal = document.getElementById('age-max-value');
    if (ageMinSlider) ageMinSlider.value = 0;
    if (ageMaxSlider) ageMaxSlider.value = 80;
    if (ageMinVal) ageMinVal.textContent = '0';
    if (ageMaxVal) ageMaxVal.textContent = '80+';

    // Reset select
    const minSFEl = document.getElementById('filter-min-sf');
    if (minSFEl) minSFEl.value = '';

    currentFilters = {};
  }

  return {
    init,
    getCurrentFilters,
    applyFilters,
    resetFilters
  };
})();
