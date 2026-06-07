/**
 * ISO 3166-1 alpha-2 codes and FIFA-style short names for all 48 WC 2026 nations.
 * Keep in sync with app/lib/nationIsoCodes.ts
 */
export const NATION_ISO = {
  Mexico: { iso: 'MX', short: 'MEX' },
  'South Africa': { iso: 'ZA', short: 'RSA' },
  'Korea Republic': { iso: 'KR', short: 'KOR' },
  'South Korea': { iso: 'KR', short: 'KOR' },
  Czechia: { iso: 'CZ', short: 'CZE' },
  Canada: { iso: 'CA', short: 'CAN' },
  'Bosnia and Herzegovina': { iso: 'BA', short: 'BIH' },
  Qatar: { iso: 'QA', short: 'QAT' },
  Switzerland: { iso: 'CH', short: 'SUI' },
  Haiti: { iso: 'HT', short: 'HAI' },
  Scotland: { iso: 'GB', short: 'SCO' },
  Brazil: { iso: 'BR', short: 'BRA' },
  Morocco: { iso: 'MA', short: 'MAR' },
  'United States': { iso: 'US', short: 'USA' },
  Paraguay: { iso: 'PY', short: 'PAR' },
  Australia: { iso: 'AU', short: 'AUS' },
  Türkiye: { iso: 'TR', short: 'TUR' },
  Turkey: { iso: 'TR', short: 'TUR' },
  "Côte d'Ivoire": { iso: 'CI', short: 'CIV' },
  Ecuador: { iso: 'EC', short: 'ECU' },
  Germany: { iso: 'DE', short: 'GER' },
  Curaçao: { iso: 'CW', short: 'CUW' },
  Netherlands: { iso: 'NL', short: 'NED' },
  Japan: { iso: 'JP', short: 'JPN' },
  Sweden: { iso: 'SE', short: 'SWE' },
  Tunisia: { iso: 'TN', short: 'TUN' },
  'IR Iran': { iso: 'IR', short: 'IRN' },
  Iran: { iso: 'IR', short: 'IRN' },
  'New Zealand': { iso: 'NZ', short: 'NZL' },
  Belgium: { iso: 'BE', short: 'BEL' },
  Egypt: { iso: 'EG', short: 'EGY' },
  'Saudi Arabia': { iso: 'SA', short: 'KSA' },
  Uruguay: { iso: 'UY', short: 'URU' },
  Spain: { iso: 'ES', short: 'ESP' },
  'Cabo Verde': { iso: 'CV', short: 'CPV' },
  France: { iso: 'FR', short: 'FRA' },
  Senegal: { iso: 'SN', short: 'SEN' },
  Iraq: { iso: 'IQ', short: 'IRQ' },
  Norway: { iso: 'NO', short: 'NOR' },
  Argentina: { iso: 'AR', short: 'ARG' },
  Algeria: { iso: 'DZ', short: 'ALG' },
  Austria: { iso: 'AT', short: 'AUT' },
  Jordan: { iso: 'JO', short: 'JOR' },
  Portugal: { iso: 'PT', short: 'POR' },
  'Congo DR': { iso: 'CD', short: 'COD' },
  Uzbekistan: { iso: 'UZ', short: 'UZB' },
  Colombia: { iso: 'CO', short: 'COL' },
  Ghana: { iso: 'GH', short: 'GHA' },
  Panama: { iso: 'PA', short: 'PAN' },
  England: { iso: 'GB', short: 'ENG' },
  Croatia: { iso: 'HR', short: 'CRO' },
};

/** @param {string} nation */
export function nationMeta(nation) {
  const meta = NATION_ISO[nation];
  if (!meta) {
    throw new Error(`Missing ISO mapping for nation: ${nation}`);
  }
  return meta;
}
