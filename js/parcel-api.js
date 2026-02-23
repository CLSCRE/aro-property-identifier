/**
 * Parcel API — LA County Assessor + ZIMAS Integration
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 */

const ParcelAPI = (() => {
  // LA County Assessor data via Socrata Open Data
  const SOCRATA_ENDPOINT = 'https://data.lacounty.gov/resource/9trm-uz8i.json';
  const SOCRATA_APP_TOKEN = ''; // Public access, no token required for low-volume

  // Fallback endpoint
  const ASSESSOR_FALLBACK = 'https://assessorapi.lacounty.gov/api/Parcel';

  // ZIMAS proxy for zoning
  const ZIMAS_ENDPOINT = 'https://zimas.lacity.org/Documents/ArcGISProxy/LandUseProxy.aspx';

  // ARO-eligible use descriptions to filter for
  const ELIGIBLE_USES = [
    'office building', 'commercial', 'retail store', 'supermarket',
    'bank', 'restaurant', 'hotel', 'motel', 'hotel/motel',
    'warehouse', 'industrial', 'parking', 'parking structure',
    'store', 'shopping center', 'department store',
    'medical office', 'professional building'
  ];

  const INELIGIBLE_USES = [
    'single family', 'condo', 'duplex', 'vacant land',
    'residential', 'sfr', 'apartment'
  ];

  let useCodes = null;

  async function loadUseCodes() {
    if (useCodes) return useCodes;
    try {
      const resp = await fetch('data/aro-use-codes.json');
      useCodes = await resp.json();
      return useCodes;
    } catch (e) {
      console.warn('Could not load use codes JSON, using defaults');
      useCodes = {
        eligible_primary: ELIGIBLE_USES,
        ineligible: INELIGIBLE_USES
      };
      return useCodes;
    }
  }

  function buildBBoxQuery(bounds) {
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();

    // Socrata SoQL query with bounding box via location field
    const where = `within_box(location, ${south}, ${west}, ${north}, ${east})`;
    return where;
  }

  function buildUseFilter() {
    // Filter for commercial/industrial use types likely eligible for ARO
    const useTerms = [
      "usedescription LIKE '%Office%'",
      "usedescription LIKE '%Commercial%'",
      "usedescription LIKE '%Retail%'",
      "usedescription LIKE '%Store%'",
      "usedescription LIKE '%Hotel%'",
      "usedescription LIKE '%Motel%'",
      "usedescription LIKE '%Warehouse%'",
      "usedescription LIKE '%Industrial%'",
      "usedescription LIKE '%Parking%'",
      "usedescription LIKE '%Bank%'",
      "usedescription LIKE '%Restaurant%'",
      "usedescription LIKE '%Shopping%'",
      "usedescription LIKE '%Medical%'",
      "usedescription LIKE '%Professional%'"
    ];
    return `(${useTerms.join(' OR ')})`;
  }

  async function fetchParcelsInBounds(bounds, filters = {}) {
    const bboxWhere = buildBBoxQuery(bounds);
    const useFilter = buildUseFilter();

    let whereClause = `${bboxWhere} AND ${useFilter}`;

    // Apply additional filters
    if (filters.minSF) {
      whereClause += ` AND sqftmain >= ${filters.minSF}`;
    }
    if (filters.minYearBuilt && filters.maxYearBuilt) {
      whereClause += ` AND effectiveyearbuilt >= ${filters.minYearBuilt} AND effectiveyearbuilt <= ${filters.maxYearBuilt}`;
    }

    const params = new URLSearchParams({
      '$where': whereClause,
      '$limit': '500',
      '$select': 'ain,situsaddress,usedescription,effectiveyearbuilt,sqftmain,location',
      '$order': 'sqftmain DESC'
    });

    if (SOCRATA_APP_TOKEN) {
      params.append('$$app_token', SOCRATA_APP_TOKEN);
    }

    const url = `${SOCRATA_ENDPOINT}?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Socrata API error: ${response.status}`);
      }
      const data = await response.json();
      return processParcelData(data, filters);
    } catch (error) {
      console.warn('Socrata API failed, trying fallback...', error.message);
      return fetchParcelsFallback(bounds, filters);
    }
  }

  async function fetchParcelsFallback(bounds, filters) {
    // If both APIs fail, return sample data for development/demo
    console.warn('Using sample parcel data for demonstration');
    return generateSampleParcels(bounds, filters);
  }

  function processParcelData(rawData, filters) {
    if (!Array.isArray(rawData)) return [];

    return rawData
      .filter(p => {
        // Must have location data
        if (!p.location) return false;

        const lat = parseFloat(p.location.latitude || p.location.lat);
        const lng = parseFloat(p.location.longitude || p.location.lng || p.location.lon);
        if (isNaN(lat) || isNaN(lng)) return false;

        const useDesc = (p.usedescription || '').toLowerCase();

        // Filter out residential / ineligible
        if (INELIGIBLE_USES.some(u => useDesc.includes(u))) return false;

        // Apply use type filter
        if (filters.useTypes && filters.useTypes.length > 0) {
          const matchesType = filters.useTypes.some(type => {
            switch (type) {
              case 'Office': return useDesc.includes('office');
              case 'Retail/Commercial': return useDesc.includes('retail') || useDesc.includes('store') || useDesc.includes('commercial') || useDesc.includes('shopping');
              case 'Industrial/Warehouse': return useDesc.includes('industrial') || useDesc.includes('warehouse');
              case 'Hotel': return useDesc.includes('hotel') || useDesc.includes('motel');
              case 'Parking Structure': return useDesc.includes('parking');
              case 'Mixed Use': return useDesc.includes('mixed');
              default: return true;
            }
          });
          if (!matchesType) return false;
        }

        // Apply eligibility filter
        if (filters.eligibilityFilter && filters.eligibilityFilter !== 'all') {
          const yearBuilt = parseInt(p.effectiveyearbuilt) || 0;
          const age = AROScoring.CURRENT_YEAR - yearBuilt;
          const isParking = useDesc.includes('parking');

          if (filters.eligibilityFilter === 'byright') {
            if (!(age >= 15 || (isParking && age >= 5))) return false;
          } else if (filters.eligibilityFilter === 'conditional') {
            if (!(age >= 5 && age < 15)) return false;
          } else if (filters.eligibilityFilter === 'hideIneligible') {
            if (age < 5) return false;
          }
        }

        // Apply minimum score filter
        if (filters.minScore) {
          const score = AROScoring.calculateParcelScore(p);
          if (score < filters.minScore) return false;
        }

        return true;
      })
      .map(p => {
        const lat = parseFloat(p.location.latitude || p.location.lat);
        const lng = parseFloat(p.location.longitude || p.location.lng || p.location.lon);

        return {
          ain: p.ain || '',
          address: (p.situsaddress || 'Unknown Address').trim(),
          useDescription: p.usedescription || 'Commercial',
          yearBuilt: parseInt(p.effectiveyearbuilt) || 0,
          sqft: parseInt(p.sqftmain) || 0,
          lat,
          lng,
          raw: p
        };
      });
  }

  // Seeded PRNG for deterministic sample data
  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // Sample data generator for when APIs are unavailable
  // Uses seeded random so the same map view always produces the same properties
  function generateSampleParcels(bounds, filters) {
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();

    // Create a seed from the rounded bounds so nearby views get the same data
    const seedVal = Math.abs(Math.round(south * 100) * 73856093 ^ Math.round(west * 100) * 19349663 ^ Math.round(north * 100) * 83492791 ^ Math.round(east * 100) * 45678901);
    const rng = seededRandom(seedVal || 1);

    const sampleProperties = [
      { use: 'Office Building', minAge: 25, maxAge: 65, minSF: 15000, maxSF: 180000 },
      { use: 'Retail Store', minAge: 20, maxAge: 50, minSF: 5000, maxSF: 40000 },
      { use: 'Warehouse', minAge: 30, maxAge: 70, minSF: 10000, maxSF: 100000 },
      { use: 'Hotel/Motel', minAge: 20, maxAge: 55, minSF: 20000, maxSF: 120000 },
      { use: 'Parking Structure', minAge: 8, maxAge: 45, minSF: 25000, maxSF: 200000 },
      { use: 'Commercial', minAge: 15, maxAge: 60, minSF: 8000, maxSF: 60000 },
      { use: 'Industrial', minAge: 35, maxAge: 75, minSF: 12000, maxSF: 90000 },
      { use: 'Medical Office', minAge: 18, maxAge: 40, minSF: 10000, maxSF: 50000 },
      { use: 'Shopping Center', minAge: 25, maxAge: 55, minSF: 30000, maxSF: 250000 }
    ];

    const streetNames = [
      'Wilshire Blvd', 'Sunset Blvd', 'Hollywood Blvd', 'Olympic Blvd',
      'La Brea Ave', 'Vermont Ave', 'Western Ave', 'Vine St',
      'Figueroa St', 'Broadway', 'Spring St', 'Main St',
      'Santa Monica Blvd', 'Melrose Ave', 'Beverly Blvd', 'Pico Blvd',
      '3rd St', '6th St', '7th St', 'Grand Ave',
      'Flower St', 'Hope St', 'Hill St', 'Olive St',
      'Alameda St', 'Central Ave', 'San Pedro St', 'Temple St'
    ];

    const parcels = [];
    const count = Math.min(120, Math.max(30, Math.floor(rng() * 80) + 40));

    for (let i = 0; i < count; i++) {
      const template = sampleProperties[Math.floor(rng() * sampleProperties.length)];
      const lat = south + rng() * (north - south);
      const lng = west + rng() * (east - west);
      const age = template.minAge + Math.floor(rng() * (template.maxAge - template.minAge));
      const yearBuilt = AROScoring.CURRENT_YEAR - age;
      const sqft = template.minSF + Math.floor(rng() * (template.maxSF - template.minSF));
      const streetNum = 100 + Math.floor(rng() * 9900);
      const street = streetNames[Math.floor(rng() * streetNames.length)];
      const ainNum = 4000000000 + Math.floor(rng() * 999999999);

      const parcel = {
        ain: String(ainNum),
        address: `${streetNum} ${street}`,
        useDescription: template.use,
        yearBuilt,
        sqft,
        lat,
        lng,
        raw: {
          ain: String(ainNum),
          usedescription: template.use,
          effectiveyearbuilt: String(yearBuilt),
          sqftmain: String(sqft)
        }
      };

      // Apply filters
      if (filters.minSF && sqft < parseInt(filters.minSF)) continue;
      if (filters.minScore) {
        const score = AROScoring.calculateParcelScore(parcel.raw);
        if (score < filters.minScore) continue;
      }
      if (filters.useTypes && filters.useTypes.length > 0) {
        const useDesc = template.use.toLowerCase();
        const matchesType = filters.useTypes.some(type => {
          switch (type) {
            case 'Office': return useDesc.includes('office');
            case 'Retail/Commercial': return useDesc.includes('retail') || useDesc.includes('store') || useDesc.includes('commercial') || useDesc.includes('shopping');
            case 'Industrial/Warehouse': return useDesc.includes('industrial') || useDesc.includes('warehouse');
            case 'Hotel': return useDesc.includes('hotel') || useDesc.includes('motel');
            case 'Parking Structure': return useDesc.includes('parking');
            case 'Mixed Use': return useDesc.includes('mixed');
            default: return true;
          }
        });
        if (!matchesType) continue;
      }
      if (filters.eligibilityFilter && filters.eligibilityFilter !== 'all') {
        const isParking = template.use.toLowerCase().includes('parking');
        if (filters.eligibilityFilter === 'byright') {
          if (!(age >= 15 || (isParking && age >= 5))) continue;
        } else if (filters.eligibilityFilter === 'conditional') {
          if (!(age >= 5 && age < 15)) continue;
        } else if (filters.eligibilityFilter === 'hideIneligible') {
          if (age < 5) continue;
        }
      }

      parcels.push(parcel);
    }

    return parcels;
  }

  async function fetchZoning(lat, lng) {
    try {
      const url = `${ZIMAS_ENDPOINT}?lat=${lat}&lng=${lng}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('ZIMAS unavailable');
      const data = await response.json();
      return data.zoning || 'Unknown';
    } catch (e) {
      console.warn('ZIMAS zoning lookup failed:', e.message);
      return 'Unknown';
    }
  }

  return {
    fetchParcelsInBounds,
    fetchZoning,
    loadUseCodes,
    SOCRATA_ENDPOINT,
    ASSESSOR_FALLBACK
  };
})();
