export type SeoPageDef = {
  path: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  /** Direct answer for AI/search snippets (Vietnamese-first). */
  answerVi: string;
  answerEn: string;
  ctaPath: string;
  ctaLabelVi: string;
  ctaLabelEn: string;
  relatedPaths: string[];
};

/** Vietnamese-first SEO landing pages — link to existing product routes. */
export const SEO_PAGES: SeoPageDef[] = [
  {
    path: '/lich-thi-dau-world-cup-2026',
    titleVi: 'Lịch thi đấu World Cup 2026',
    titleEn: 'World Cup 2026 schedule',
    descriptionVi:
      'Lịch đầy đủ 104 trận World Cup 2026 — giờ Việt Nam, bảng đấu A–L, xác suất mô hình PitchIntel.',
    descriptionEn: 'Full 104-match WC 2026 schedule with Vietnam kickoff times and model probabilities.',
    answerVi:
      'PitchIntel cung cấp lịch thi đấu đầy đủ 104 trận World Cup 2026 theo giờ Việt Nam, chia theo 12 bảng A–L và vòng knockout, kèm xác suất thắng/hòa/thua từ mô hình.',
    answerEn:
      'PitchIntel lists all 104 World Cup 2026 fixtures in Vietnam time, grouped by groups A–L and knockout rounds, with model win/draw/loss probabilities.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem lịch thi đấu',
    ctaLabelEn: 'View match schedule',
    relatedPaths: ['/matches', '/vong-bang-world-cup-2026', '/guide'],
  },
  {
    path: '/ti-so-truc-tiep-world-cup-2026',
    titleVi: 'Tỉ số trực tiếp World Cup 2026',
    titleEn: 'World Cup 2026 live scores',
    descriptionVi:
      'Theo dõi tỉ số, phút trận và xác suất cập nhật theo thời gian thực từ mô hình PitchIntel.',
    descriptionEn: 'Live scores, match clock, and real-time model probabilities from PitchIntel.',
    answerVi:
      'Theo dõi tỉ số trực tiếp World Cup 2026 trên PitchIntel: cập nhật phút trận, bàn thắng, thẻ và xác suất mô hình theo thời gian thực cho trận đang diễn ra.',
    answerEn:
      'Follow live World Cup 2026 scores on PitchIntel with real-time clocks, goals, cards, and updating model probabilities for in-play matches.',
    ctaPath: '/',
    ctaLabelVi: 'Về trang chủ trận đấu',
    ctaLabelEn: 'Go to match hub',
    relatedPaths: ['/', '/matches', '/ket-qua-world-cup-2026'],
  },
  {
    path: '/bang-xep-hang-world-cup-2026',
    titleVi: 'Bảng xếp hạng World Cup 2026',
    titleEn: 'World Cup 2026 standings',
    descriptionVi: 'Bảng xếp hạng 12 bảng A–L và xếp hạng hạng 3 tốt nhất cho vòng knockout.',
    descriptionEn: 'Group A–L standings and best third-place ranking for the knockout stage.',
    answerVi:
      'Bảng xếp hạng World Cup 2026 trên PitchIntel hiển thị điểm, hiệu số và thứ hạng 12 bảng A–L, cùng bảng xếp hạng các đội hạng 3 tốt nhất để xác định suất vào vòng knockout.',
    answerEn:
      'World Cup 2026 standings on PitchIntel show points, goal difference, and ranks for groups A–L plus best third-place teams for knockout qualification.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem bảng xếp hạng',
    ctaLabelEn: 'View standings',
    relatedPaths: ['/matches', '/vong-bang-world-cup-2026', '/vong-knockout-world-cup-2026'],
  },
  {
    path: '/ket-qua-world-cup-2026',
    titleVi: 'Kết quả World Cup 2026',
    titleEn: 'World Cup 2026 results',
    descriptionVi: 'Kết quả các trận đã kết thúc và lịch sử đối đầu tại World Cup.',
    descriptionEn: 'Completed match results and World Cup head-to-head history.',
    answerVi:
      'Xem kết quả các trận World Cup 2026 đã kết thúc trên PitchIntel, kèm lịch sử đối đầu World Cup giữa hai đội và phân tích xác suất sau trận.',
    answerEn:
      'View completed World Cup 2026 match results on PitchIntel with World Cup head-to-head history and post-match probability analysis.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem kết quả & lịch',
    ctaLabelEn: 'View results & schedule',
    relatedPaths: ['/matches', '/lich-thi-dau-world-cup-2026', '/ti-so-truc-tiep-world-cup-2026'],
  },
  {
    path: '/du-doan-world-cup-2026',
    titleVi: 'Dự đoán World Cup 2026',
    titleEn: 'World Cup 2026 predictions',
    descriptionVi:
      'Xác suất thắng/hòa/thua, tỉ số dự đoán, độ tin cậy mô hình và kịch bản trận đấu.',
    descriptionEn: 'Win/draw/loss probability, predicted scorelines, model confidence, and scenarios.',
    answerVi:
      'Dự đoán World Cup 2026 trên PitchIntel dựa trên mô hình xác suất: thắng/hòa/thua, tỉ số có khả năng cao, độ tin cậy mô hình và nhiều kịch bản trận đấu.',
    answerEn:
      'World Cup 2026 predictions on PitchIntel use a probability model for win/draw/loss, likely scorelines, model confidence, and multi-scenario match outcomes.',
    ctaPath: '/guide',
    ctaLabelVi: 'Cách đọc dự đoán',
    ctaLabelEn: 'How to read predictions',
    relatedPaths: ['/guide', '/matches', '/phan-tich-world-cup-2026'],
  },
  {
    path: '/phan-tich-world-cup-2026',
    titleVi: 'Phân tích World Cup 2026',
    titleEn: 'World Cup 2026 analysis',
    descriptionVi: 'Phân tích chiến thuật, đa kịch bản và tin tình báo World Cup từ PitchIntel.',
    descriptionEn: 'Tactical analysis, multi-scenario predictions, and World Cup news intelligence.',
    answerVi:
      'Phân tích World Cup 2026 trên PitchIntel gồm briefing chiến thuật, kịch bản đa trận, tin tình báo có nguồn và trích dẫn xác suất mô hình cho từng trận.',
    answerEn:
      'World Cup 2026 analysis on PitchIntel includes tactical briefings, multi-scenario predictions, sourced news intelligence, and model probability citations per match.',
    ctaPath: '/news-intelligence',
    ctaLabelVi: 'Tin & phân tích',
    ctaLabelEn: 'News & analysis',
    relatedPaths: ['/news-intelligence', '/matches', '/guide'],
  },
  {
    path: '/vong-bang-world-cup-2026',
    titleVi: 'Vòng bảng World Cup 2026',
    titleEn: 'World Cup 2026 group stage',
    descriptionVi: 'Lịch và bảng xếp hạng vòng bảng — 48 đội, 12 bảng A–L.',
    descriptionEn: 'Group stage fixtures and standings — 48 teams in groups A–L.',
    answerVi:
      'Vòng bảng World Cup 2026 có 48 đội chia 12 bảng A–L; PitchIntel hiển thị lịch từng bảng, bảng xếp hạng và xác suất đi tiếp cho mỗi trận.',
    answerEn:
      'The World Cup 2026 group stage has 48 teams in groups A–L; PitchIntel shows fixtures, standings, and advancement probabilities per match.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem vòng bảng',
    ctaLabelEn: 'View group stage',
    relatedPaths: ['/matches', '/bang-xep-hang-world-cup-2026', '/lich-thi-dau-world-cup-2026'],
  },
  {
    path: '/vong-knockout-world-cup-2026',
    titleVi: 'Vòng knockout World Cup 2026',
    titleEn: 'World Cup 2026 knockout stage',
    descriptionVi: 'Nhánh đấu Vòng 1/16 đến Chung kết — xác suất và phân tích từng trận.',
    descriptionEn: 'Knockout bracket from Round of 32 to the Final with match-level analysis.',
    answerVi:
      'Nhánh knockout World Cup 2026 từ Vòng 1/16 đến Chung kết trên PitchIntel, với xác suất thắng và phân tích chi tiết cho từng trận loại trực tiếp.',
    answerEn:
      'The World Cup 2026 knockout bracket from the Round of 32 to the Final on PitchIntel includes win probabilities and analysis for each elimination match.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem nhánh knockout',
    ctaLabelEn: 'View knockout bracket',
    relatedPaths: ['/matches', '/bang-xep-hang-world-cup-2026', '/du-doan-world-cup-2026'],
  },
];

export const SEO_PAGE_PATHS = SEO_PAGES.map((p) => p.path);

export function findSeoPageByPath(path: string): SeoPageDef | undefined {
  return SEO_PAGES.find((p) => p.path === path);
}
