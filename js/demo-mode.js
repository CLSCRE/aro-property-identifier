/**
 * Demo Mode — Pre-built sample properties for demonstrations
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const DemoMode = (() => {
  let active = false;

  const SAMPLES = [
    {
      name: 'Mid-Wilshire Office Tower',
      tab1: {
        address: '3900 Wilshire Blvd, Los Angeles, CA 90010',
        neighborhood: 'Koreatown/Wilshire Center',
        zoning: 'C4',
        yearBuilt: '1972',
        buildingSF: '185000',
        useType: 'Office-Mid Rise 5-12fl',
        stories: '12',
        vacancyRate: '51-75%',
        estimatedValue: '28000000',
        floorplateShape: 'Narrow/Efficient \u226470ft deep',
        historicDesignation: 'None',
        affordableStrategy: 'None-market rate only'
      },
      tab3: {
        depth: 62,
        width: 180,
        f2f: 13.5,
        stories: 12,
        totalSF: 185000,
        typicalSF: 15400,
        windowType: 'Ribbon',
        facadeMaterial: 'Concrete',
        structural: 'Steel frame',
        seismic: '1980-1994',
        mep: 'Fair',
        elevators: 3,
        loadingDock: 'Yes',
        foundation: 'Good',
        surfaceParking: 25,
        structuredParking: 180,
        siteArea: 22000,
        acquisitionPrice: 28000000,
        studioRent: 2200,
        oneBRRent: 2800,
        twoBRRent: 3600
      }
    },
    {
      name: 'Downtown Historic Loft Building',
      tab1: {
        address: '416 S Spring St, Los Angeles, CA 90013',
        neighborhood: 'Downtown LA',
        zoning: 'C2',
        yearBuilt: '1924',
        buildingSF: '72000',
        useType: 'Office-Low Rise 1-4fl',
        stories: '6',
        vacancyRate: '76-100%',
        estimatedValue: '9500000',
        floorplateShape: 'Narrow/Efficient \u226470ft deep',
        historicDesignation: 'National Register',
        affordableStrategy: 'Partial \u226511%'
      },
      tab3: {
        depth: 45,
        width: 120,
        f2f: 14,
        stories: 6,
        totalSF: 72000,
        typicalSF: 12000,
        windowType: 'Operable',
        facadeMaterial: 'Brick',
        structural: 'Concrete frame',
        seismic: 'Pre-1980',
        mep: 'Poor',
        elevators: 1,
        loadingDock: 'No',
        foundation: 'Fair',
        surfaceParking: 0,
        structuredParking: 0,
        siteArea: 8000,
        acquisitionPrice: 9500000,
        studioRent: 2400,
        oneBRRent: 3200,
        twoBRRent: 4200
      }
    }
  ];

  function toggle() {
    if (active) {
      exit();
    } else {
      enter();
    }
  }

  function enter() {
    active = true;
    document.getElementById('demo-banner').style.display = '';
    document.getElementById('demo-mode-btn').textContent = 'Exit Demo';
    document.getElementById('demo-mode-btn').classList.add('active');

    // Load Sample 1 into Tab 1
    loadSampleToTab1(SAMPLES[0]);

    // Add both samples to pipeline
    SAMPLES.forEach(sample => {
      const parcel = {
        address: sample.tab1.address,
        ain: 'DEMO-' + sample.tab1.address.substring(0, 10),
        useDescription: sample.tab1.useType,
        yearBuilt: sample.tab1.yearBuilt,
        sqft: sample.tab1.buildingSF,
        neighborhood: sample.tab1.neighborhood,
        raw: sample.tab1
      };
      ExportModule.addToProspectingList(parcel);
    });

    if (typeof MapEngine !== 'undefined' && MapEngine.showToast) {
      MapEngine.showToast('Demo Mode activated \u2014 2 sample properties loaded');
    }
  }

  function exit() {
    active = false;
    document.getElementById('demo-banner').style.display = 'none';
    document.getElementById('demo-mode-btn').textContent = 'Demo Mode';
    document.getElementById('demo-mode-btn').classList.remove('active');
  }

  function loadSampleToTab1(sample) {
    const s = sample.tab1;
    const fields = {
      'input-address': s.address,
      'input-neighborhood': s.neighborhood,
      'input-zoning': s.zoning,
      'input-year-built': s.yearBuilt,
      'input-sf': s.buildingSF,
      'input-use-type': s.useType,
      'input-stories': s.stories,
      'input-vacancy': s.vacancyRate,
      'input-value': s.estimatedValue,
      'input-floorplate': s.floorplateShape,
      'input-historic': s.historicDesignation,
      'input-affordable': s.affordableStrategy
    };

    Object.keys(fields).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = fields[id];
    });

    // Auto-run analysis
    if (typeof analyzeProperty === 'function') {
      analyzeProperty();
    }
  }

  function loadSampleToTab3(sampleIndex) {
    const sample = SAMPLES[sampleIndex];
    if (!sample) return;

    // Pre-populate feasibility tab
    if (typeof FeasibilityTab !== 'undefined') {
      FeasibilityTab.prePopulateFromTab1();

      // Fill Module 1 fields
      const s = sample.tab3;
      setTimeout(() => {
        const m1Fields = {
          'm1-depth': s.depth,
          'm1-width': s.width,
          'm1-f2f': s.f2f,
          'm1-stories': s.stories,
          'm1-total-sf': s.totalSF,
          'm1-typical-sf': s.typicalSF,
          'm1-window-type': s.windowType,
          'm1-facade': s.facadeMaterial,
          'm1-structural': s.structural,
          'm1-seismic': s.seismic,
          'm1-mep': s.mep,
          'm1-elevators': s.elevators,
          'm1-loading': s.loadingDock,
          'm1-foundation': s.foundation,
          'm1-surface-parking': s.surfaceParking,
          'm1-structured-parking': s.structuredParking,
          'm1-site-area': s.siteArea,
          'm4-acquisition': s.acquisitionPrice,
          'm4-studio-rent': s.studioRent,
          'm4-1br-rent': s.oneBRRent,
          'm4-2br-rent': s.twoBRRent
        };

        Object.keys(m1Fields).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = m1Fields[id];
        });
      }, 300);
    }
  }

  function isActive() {
    return active;
  }

  function getSamples() {
    return SAMPLES;
  }

  return { toggle, enter, exit, loadSampleToTab1, loadSampleToTab3, isActive, getSamples };
})();
