-- Rename WC 2026 placeholder teams to real nation names (groups B–L)
-- Group A uses team-usa, team-mex, team-arg, team-bra from reference seed
-- country_code = ISO 3166-1 alpha-2 (not name-prefix slices)

UPDATE teams SET name = 'United States', short_name = 'USA', country_code = 'US' WHERE id = 'team-w26-b3';
UPDATE teams SET name = 'Mexico', short_name = 'MEX', country_code = 'MX' WHERE id = 'team-w26-b4';
UPDATE teams SET name = 'Canada', short_name = 'CAN', country_code = 'CA' WHERE id = 'team-w26-c1';
UPDATE teams SET name = 'Argentina', short_name = 'ARG', country_code = 'AR' WHERE id = 'team-w26-c2';
UPDATE teams SET name = 'Brazil', short_name = 'BRA', country_code = 'BR' WHERE id = 'team-w26-c3';
UPDATE teams SET name = 'France', short_name = 'FRA', country_code = 'FR' WHERE id = 'team-w26-c4';
UPDATE teams SET name = 'England', short_name = 'ENG', country_code = 'GB' WHERE id = 'team-w26-d1';
UPDATE teams SET name = 'Spain', short_name = 'ESP', country_code = 'ES' WHERE id = 'team-w26-d2';
UPDATE teams SET name = 'Germany', short_name = 'GER', country_code = 'DE' WHERE id = 'team-w26-d3';
UPDATE teams SET name = 'Italy', short_name = 'ITA', country_code = 'IT' WHERE id = 'team-w26-d4';
UPDATE teams SET name = 'Netherlands', short_name = 'NED', country_code = 'NL' WHERE id = 'team-w26-e1';
UPDATE teams SET name = 'Portugal', short_name = 'POR', country_code = 'PT' WHERE id = 'team-w26-e2';
UPDATE teams SET name = 'Belgium', short_name = 'BEL', country_code = 'BE' WHERE id = 'team-w26-e3';
UPDATE teams SET name = 'Croatia', short_name = 'CRO', country_code = 'HR' WHERE id = 'team-w26-e4';
UPDATE teams SET name = 'Uruguay', short_name = 'URU', country_code = 'UY' WHERE id = 'team-w26-f1';
UPDATE teams SET name = 'Colombia', short_name = 'COL', country_code = 'CO' WHERE id = 'team-w26-f2';
UPDATE teams SET name = 'Ecuador', short_name = 'ECU', country_code = 'EC' WHERE id = 'team-w26-f3';
UPDATE teams SET name = 'Chile', short_name = 'CHI', country_code = 'CL' WHERE id = 'team-w26-f4';
UPDATE teams SET name = 'Paraguay', short_name = 'PAR', country_code = 'PY' WHERE id = 'team-w26-g1';
UPDATE teams SET name = 'Peru', short_name = 'PER', country_code = 'PE' WHERE id = 'team-w26-g2';
UPDATE teams SET name = 'Japan', short_name = 'JPN', country_code = 'JP' WHERE id = 'team-w26-g3';
UPDATE teams SET name = 'South Korea', short_name = 'KOR', country_code = 'KR' WHERE id = 'team-w26-g4';
UPDATE teams SET name = 'Australia', short_name = 'AUS', country_code = 'AU' WHERE id = 'team-w26-h1';
UPDATE teams SET name = 'Saudi Arabia', short_name = 'KSA', country_code = 'SA' WHERE id = 'team-w26-h2';
UPDATE teams SET name = 'Iran', short_name = 'IRN', country_code = 'IR' WHERE id = 'team-w26-h3';
UPDATE teams SET name = 'Qatar', short_name = 'QAT', country_code = 'QA' WHERE id = 'team-w26-h4';
UPDATE teams SET name = 'Morocco', short_name = 'MAR', country_code = 'MA' WHERE id = 'team-w26-i1';
UPDATE teams SET name = 'Senegal', short_name = 'SEN', country_code = 'SN' WHERE id = 'team-w26-i2';
UPDATE teams SET name = 'Nigeria', short_name = 'NGA', country_code = 'NG' WHERE id = 'team-w26-i3';
UPDATE teams SET name = 'Ghana', short_name = 'GHA', country_code = 'GH' WHERE id = 'team-w26-i4';
UPDATE teams SET name = 'Cameroon', short_name = 'CMR', country_code = 'CM' WHERE id = 'team-w26-j1';
UPDATE teams SET name = 'Tunisia', short_name = 'TUN', country_code = 'TN' WHERE id = 'team-w26-j2';
UPDATE teams SET name = 'Egypt', short_name = 'EGY', country_code = 'EG' WHERE id = 'team-w26-j3';
UPDATE teams SET name = 'Algeria', short_name = 'ALG', country_code = 'DZ' WHERE id = 'team-w26-j4';
UPDATE teams SET name = 'Poland', short_name = 'POL', country_code = 'PL' WHERE id = 'team-w26-k1';
UPDATE teams SET name = 'Switzerland', short_name = 'SUI', country_code = 'CH' WHERE id = 'team-w26-k2';
UPDATE teams SET name = 'Austria', short_name = 'AUT', country_code = 'AT' WHERE id = 'team-w26-k3';
UPDATE teams SET name = 'Denmark', short_name = 'DEN', country_code = 'DK' WHERE id = 'team-w26-k4';
UPDATE teams SET name = 'Sweden', short_name = 'SWE', country_code = 'SE' WHERE id = 'team-w26-l1';
UPDATE teams SET name = 'Norway', short_name = 'NOR', country_code = 'NO' WHERE id = 'team-w26-l2';
UPDATE teams SET name = 'Serbia', short_name = 'SRB', country_code = 'RS' WHERE id = 'team-w26-l3';
UPDATE teams SET name = 'Ukraine', short_name = 'UKR', country_code = 'UA' WHERE id = 'team-w26-l4';
