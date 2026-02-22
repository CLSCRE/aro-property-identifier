/**
 * OM/Flyer Paste Parser — regex extraction from pasted offering memorandum text
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const OMParser = (() => {

  /**
   * Parse pasted OM/flyer text and extract structured property data
   * Uses heuristic regex patterns — no external AI dependency
   */
  function parseFlyerText(text) {
    if (!text || text.trim().length < 20) return null;

    const result = {
      address: extractAddress(text),
      buildingSF: extractNumber(text, /(\d{1,3}[,.]?\d{3,})\s*(?:sf|sq\.?\s*ft|square\s*feet)/i),
      yearBuilt: extractYear(text),
      stories: extractNumber(text, /(\d{1,3})\s*(?:stor(?:y|ies)|floor(?:s)?|level(?:s)?)/i),
      askingPrice: extractCurrency(text, /(?:asking|list|price|offered?\s*at|sale\s*price)[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:m(?:illion)?|mm)?/i),
      units: extractNumber(text, /(\d{1,4})\s*(?:units?|apartments?|residences?|rooms?)/i),
      capRate: extractPercentage(text, /(?:cap\s*rate|capitalization\s*rate)[:\s]*([\d.]+)\s*%?/i),
      vacancy: extractPercentage(text, /(?:vacancy|vacant)[:\s]*([\d.]+)\s*%/i),
      useType: extractUseType(text),
      neighborhood: extractNeighborhood(text),
      lotSize: extractNumber(text, /(?:lot|land|site)\s*(?:size|area)[:\s]*(\d{1,3}[,.]?\d{3,})\s*(?:sf|sq\.?\s*ft)/i),
      parking: extractNumber(text, /(\d{1,4})\s*(?:parking\s*(?:spaces?|stalls?|spots?))/i),
      zoning: extractZoning(text),
      noi: extractCurrency(text, /(?:noi|net\s*operating\s*income)[:\s]*\$?([\d,]+(?:\.\d+)?)\s*(?:m(?:illion)?|mm)?/i),
      confidence: 0
    };

    // Calculate confidence based on how many fields were extracted
    const fields = ['address', 'buildingSF', 'yearBuilt', 'stories', 'askingPrice', 'useType'];
    const filled = fields.filter(f => result[f] !== null && result[f] !== '').length;
    result.confidence = Math.round((filled / fields.length) * 100);

    return result;
  }

  function extractAddress(text) {
    // Look for LA-style addresses: number + street + optional city/state
    const patterns = [
      /(\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][a-zA-Z]+\s+){1,4}(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Way|Rd|Road|Pl(?:ace)?|Ct|Court|Ln|Lane|Pkwy|Parkway)\.?(?:\s*,?\s*(?:Los\s*Angeles|LA|Hollywood|Downtown|DTLA|Koreatown|Mid[- ]?Wilshire|Santa\s*Monica|Culver\s*City|Pasadena|Long\s*Beach|Burbank|Glendale)[,\s]*(?:CA|California)?(?:\s*\d{5})?)?)/im
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) return m[1].trim();
    }
    return null;
  }

  function extractYear(text) {
    // Look for year built patterns
    const patterns = [
      /(?:built|constructed|year\s*built|vintage)[:\s]*(?:in\s+)?(\d{4})/i,
      /(?:circa|c\.\s*)(\d{4})/i
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const yr = parseInt(m[1]);
        if (yr >= 1880 && yr <= 2026) return yr;
      }
    }
    // Fallback: look for standalone 4-digit years near "built" context
    const yearMatch = text.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
    if (yearMatch) {
      const yr = parseInt(yearMatch[1]);
      if (yr >= 1900 && yr <= 2026) return yr;
    }
    return null;
  }

  function extractNumber(text, pattern) {
    const m = text.match(pattern);
    if (m) {
      const num = parseInt(m[1].replace(/[,. ]/g, ''));
      return isNaN(num) ? null : num;
    }
    return null;
  }

  function extractCurrency(text, pattern) {
    const m = text.match(pattern);
    if (m) {
      let num = parseFloat(m[1].replace(/,/g, ''));
      // Check for "million" or "M" suffix
      const suffix = text.substring(m.index + m[0].length - 10, m.index + m[0].length + 15).toLowerCase();
      if (suffix.includes('million') || suffix.includes(' m') || m[0].toLowerCase().includes('m')) {
        if (num < 1000) num *= 1000000;
      }
      return isNaN(num) ? null : num;
    }
    return null;
  }

  function extractPercentage(text, pattern) {
    const m = text.match(pattern);
    if (m) {
      const num = parseFloat(m[1]);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  function extractUseType(text) {
    const lower = text.toLowerCase();
    if (lower.includes('office')) return 'Office';
    if (lower.includes('hotel') || lower.includes('motel')) return 'Hotel';
    if (lower.includes('warehouse') || lower.includes('industrial')) return 'Industrial/Warehouse';
    if (lower.includes('retail') || lower.includes('strip center') || lower.includes('shopping')) return 'Retail/Strip Center';
    if (lower.includes('parking structure') || lower.includes('parking garage')) return 'Parking Structure';
    if (lower.includes('mixed use') || lower.includes('mixed-use')) return 'Mixed Use';
    return null;
  }

  function extractNeighborhood(text) {
    const neighborhoods = [
      'Downtown LA', 'DTLA', 'Hollywood', 'Koreatown', 'Wilshire Center',
      'Mid-Wilshire', 'Chinatown', 'Lincoln Heights', 'Culver City',
      'West LA', 'Brentwood', 'Century City', 'Santa Monica',
      'Sherman Oaks', 'Van Nuys', 'Burbank', 'Glendale',
      'El Segundo', 'Playa Vista', 'Pasadena', 'Long Beach'
    ];
    for (const nb of neighborhoods) {
      if (text.toLowerCase().includes(nb.toLowerCase())) {
        if (nb === 'DTLA') return 'Downtown LA';
        return nb;
      }
    }
    return null;
  }

  function extractZoning(text) {
    const zonings = ['C2', 'C4', 'CM', 'M1', 'M2', 'CR', 'R3', 'R4'];
    for (const z of zonings) {
      const re = new RegExp('\\b' + z + '\\b', 'i');
      if (re.test(text)) return z;
    }
    return null;
  }

  /**
   * Auto-fill Tab 1 form from parsed data
   */
  function autoFillFromParsed(parsed) {
    if (!parsed) return;

    if (parsed.address) {
      const el = document.getElementById('input-address');
      if (el && !el.value) el.value = parsed.address;
    }
    if (parsed.yearBuilt) {
      const el = document.getElementById('input-year-built');
      if (el && !el.value) el.value = parsed.yearBuilt;
    }
    if (parsed.buildingSF) {
      const el = document.getElementById('input-sf');
      if (el && !el.value) el.value = parsed.buildingSF;
    }
    if (parsed.stories) {
      const el = document.getElementById('input-stories');
      if (el && !el.value) el.value = parsed.stories;
    }
    if (parsed.askingPrice) {
      const el = document.getElementById('input-value');
      if (el && !el.value) el.value = Math.round(parsed.askingPrice);
    }
    if (parsed.useType) {
      const el = document.getElementById('input-use-type');
      if (el && !el.value) {
        // Find best match in select options
        const opts = el.options;
        for (let i = 0; i < opts.length; i++) {
          if (opts[i].text.toLowerCase().includes(parsed.useType.toLowerCase())) {
            el.value = opts[i].value;
            break;
          }
        }
      }
    }
    if (parsed.neighborhood) {
      const el = document.getElementById('input-neighborhood');
      if (el && !el.value) {
        const opts = el.options;
        for (let i = 0; i < opts.length; i++) {
          if (opts[i].value.toLowerCase().includes(parsed.neighborhood.toLowerCase()) ||
              opts[i].text.toLowerCase().includes(parsed.neighborhood.toLowerCase())) {
            el.value = opts[i].value;
            break;
          }
        }
      }
    }
    if (parsed.zoning) {
      const el = document.getElementById('input-zoning');
      if (el && el.value === 'Unknown') {
        const opts = el.options;
        for (let i = 0; i < opts.length; i++) {
          if (opts[i].value.includes(parsed.zoning)) {
            el.value = opts[i].value;
            break;
          }
        }
      }
    }
    if (parsed.vacancy) {
      const el = document.getElementById('input-vacancy');
      if (el && el.value === 'Unknown') {
        if (parsed.vacancy <= 10) el.value = '0-10%';
        else if (parsed.vacancy <= 30) el.value = '11-30%';
        else if (parsed.vacancy <= 50) el.value = '31-50%';
        else if (parsed.vacancy <= 75) el.value = '51-75%';
        else el.value = '76-100%';
      }
    }
  }

  /**
   * Render parser results preview
   */
  function renderParsePreview(parsed) {
    if (!parsed) return '<div style="color:var(--mid);font-size:0.82rem;">Could not extract data. Try pasting more text.</div>';

    const fields = [
      { label: 'Address', value: parsed.address },
      { label: 'Building SF', value: parsed.buildingSF ? parsed.buildingSF.toLocaleString() + ' SF' : null },
      { label: 'Year Built', value: parsed.yearBuilt },
      { label: 'Stories', value: parsed.stories },
      { label: 'Use Type', value: parsed.useType },
      { label: 'Asking Price', value: parsed.askingPrice ? '$' + Math.round(parsed.askingPrice).toLocaleString() : null },
      { label: 'Cap Rate', value: parsed.capRate ? parsed.capRate + '%' : null },
      { label: 'Vacancy', value: parsed.vacancy ? parsed.vacancy + '%' : null },
      { label: 'Neighborhood', value: parsed.neighborhood },
      { label: 'Zoning', value: parsed.zoning },
      { label: 'Parking', value: parsed.parking ? parsed.parking + ' spaces' : null },
      { label: 'NOI', value: parsed.noi ? '$' + Math.round(parsed.noi).toLocaleString() : null }
    ];

    const confColor = parsed.confidence >= 60 ? 'eligible' : parsed.confidence >= 30 ? 'conditional' : 'ineligible';

    let html = `<div class="parse-confidence" style="margin-bottom:12px;">
      <span class="chip ${confColor}">${parsed.confidence}% confidence</span>
      <span style="font-size:0.75rem;color:var(--mid);margin-left:8px;">${fields.filter(f => f.value).length} fields extracted</span>
    </div>`;
    html += '<div class="parse-results-grid">';
    fields.forEach(f => {
      if (f.value) {
        html += `<div class="parse-result-row">
          <span class="parse-label">${f.label}</span>
          <span class="parse-value">${f.value}</span>
        </div>`;
      }
    });
    html += '</div>';
    return html;
  }

  /**
   * Handle paste and parse from the parser panel
   */
  function parseFromPanel() {
    const textarea = document.getElementById('om-paste-input');
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) return;

    const parsed = parseFlyerText(text);
    const preview = document.getElementById('om-parse-preview');
    const fillBtn = document.getElementById('om-fill-btn');

    if (preview) preview.innerHTML = renderParsePreview(parsed);
    if (fillBtn) fillBtn.style.display = parsed && parsed.confidence > 0 ? '' : 'none';

    // Store parsed result for auto-fill
    if (preview) preview.dataset.parsed = JSON.stringify(parsed);
  }

  function fillFromPanel() {
    const preview = document.getElementById('om-parse-preview');
    if (!preview || !preview.dataset.parsed) return;

    const parsed = JSON.parse(preview.dataset.parsed);
    autoFillFromParsed(parsed);

    // Show toast
    if (typeof MapEngine !== 'undefined' && MapEngine.showToast) {
      MapEngine.showToast('Form fields populated from OM text');
    }
  }

  function clearPanel() {
    const textarea = document.getElementById('om-paste-input');
    const preview = document.getElementById('om-parse-preview');
    const fillBtn = document.getElementById('om-fill-btn');
    if (textarea) textarea.value = '';
    if (preview) { preview.innerHTML = ''; delete preview.dataset.parsed; }
    if (fillBtn) fillBtn.style.display = 'none';
  }

  return {
    parseFlyerText,
    autoFillFromParsed,
    renderParsePreview,
    parseFromPanel,
    fillFromPanel,
    clearPanel
  };
})();
