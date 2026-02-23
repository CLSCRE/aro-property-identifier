/**
 * Brand Configuration
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 * All hardcoded brand strings centralized here
 */

const BRAND = {
  firmName: "Commercial Lending Solutions",
  tagline: "Commercial Real Estate | Mortgage Brokerage",
  website: "https://commerciallendingsolutions.ai",
  altWebsite: "https://commerciallendingsolutions.ai",
  productName: "LA ARO Conversion Engine",
  productVersion: "v2.0",
  contactEmail: "info@commerciallendingsolutions.ai",
  disclaimerShort: "Not legal, financial, or architectural advice.",
  disclaimerFull: "This analysis was prepared using the Commercial Lending Solutions ARO Feasibility Engine. All outputs are estimates based on publicly available data and market benchmarks. Not legal, financial, or architectural advice. Verify all assumptions with licensed professionals before committing capital.",
  copyrightYear: "2026",
  sisterProduct: "Land to Yield"
};

/**
 * Rate Defaults — fallback values when live feeds are unavailable
 */
const RATE_DEFAULTS = {
  sofr: 4.30,           // SOFR overnight rate (%)
  ust5y: 3.95,          // 5-Year Treasury yield (%)
  ust10y: 4.25,         // 10-Year Treasury yield (%)
  prime: 7.50,          // WSJ Prime Rate (%)
  spreads: {
    constructionLoan: 2.50,  // SOFR + 250bps
    htcBridge: 3.00,         // SOFR + 300bps
    cmbs: 1.80               // 10Y UST + 180bps
  },
  cacheTTL: 24 * 60 * 60 * 1000  // 24 hours in ms
};
