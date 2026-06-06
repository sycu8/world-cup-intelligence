/**
 * ISO 3166-1 alpha-2 codes and FIFA-style short names for WC 2026 placeholder nations.
 * Do not derive codes from nation name prefixes — many collide (CA, SE, AU, DE, …).
 */
export const NATION_ISO = {
  'United States': { iso: 'US', short: 'USA' },
  Mexico: { iso: 'MX', short: 'MEX' },
  Canada: { iso: 'CA', short: 'CAN' },
  Argentina: { iso: 'AR', short: 'ARG' },
  Brazil: { iso: 'BR', short: 'BRA' },
  France: { iso: 'FR', short: 'FRA' },
  England: { iso: 'GB', short: 'ENG' },
  Spain: { iso: 'ES', short: 'ESP' },
  Germany: { iso: 'DE', short: 'GER' },
  Italy: { iso: 'IT', short: 'ITA' },
  Netherlands: { iso: 'NL', short: 'NED' },
  Portugal: { iso: 'PT', short: 'POR' },
  Belgium: { iso: 'BE', short: 'BEL' },
  Croatia: { iso: 'HR', short: 'CRO' },
  Uruguay: { iso: 'UY', short: 'URU' },
  Colombia: { iso: 'CO', short: 'COL' },
  Ecuador: { iso: 'EC', short: 'ECU' },
  Chile: { iso: 'CL', short: 'CHI' },
  Paraguay: { iso: 'PY', short: 'PAR' },
  Peru: { iso: 'PE', short: 'PER' },
  Japan: { iso: 'JP', short: 'JPN' },
  'South Korea': { iso: 'KR', short: 'KOR' },
  Australia: { iso: 'AU', short: 'AUS' },
  'Saudi Arabia': { iso: 'SA', short: 'KSA' },
  Iran: { iso: 'IR', short: 'IRN' },
  Qatar: { iso: 'QA', short: 'QAT' },
  Morocco: { iso: 'MA', short: 'MAR' },
  Senegal: { iso: 'SN', short: 'SEN' },
  Nigeria: { iso: 'NG', short: 'NGA' },
  Ghana: { iso: 'GH', short: 'GHA' },
  Cameroon: { iso: 'CM', short: 'CMR' },
  Tunisia: { iso: 'TN', short: 'TUN' },
  Egypt: { iso: 'EG', short: 'EGY' },
  Algeria: { iso: 'DZ', short: 'ALG' },
  Poland: { iso: 'PL', short: 'POL' },
  Switzerland: { iso: 'CH', short: 'SUI' },
  Austria: { iso: 'AT', short: 'AUT' },
  Denmark: { iso: 'DK', short: 'DEN' },
  Sweden: { iso: 'SE', short: 'SWE' },
  Norway: { iso: 'NO', short: 'NOR' },
  Serbia: { iso: 'RS', short: 'SRB' },
  Ukraine: { iso: 'UA', short: 'UKR' },
  Turkey: { iso: 'TR', short: 'TUR' },
  Wales: { iso: 'GB', short: 'WAL' },
  Scotland: { iso: 'GB', short: 'SCO' },
  'Costa Rica': { iso: 'CR', short: 'CRC' },
  Panama: { iso: 'PA', short: 'PAN' },
  Jamaica: { iso: 'JM', short: 'JAM' },
};

/** @param {string} nation */
export function nationMeta(nation) {
  const meta = NATION_ISO[nation];
  if (!meta) {
    throw new Error(`Missing ISO mapping for nation: ${nation}`);
  }
  return meta;
}
