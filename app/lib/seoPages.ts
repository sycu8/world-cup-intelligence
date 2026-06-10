export type SeoPageDef = {
  path: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  ctaPath: string;
  ctaLabelVi: string;
  ctaLabelEn: string;
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
    ctaPath: '/matches',
    ctaLabelVi: 'Xem lịch thi đấu',
    ctaLabelEn: 'View match schedule',
  },
  {
    path: '/ti-so-truc-tiep-world-cup-2026',
    titleVi: 'Tỉ số trực tiếp World Cup 2026',
    titleEn: 'World Cup 2026 live scores',
    descriptionVi:
      'Theo dõi tỉ số, phút trận và xác suất cập nhật theo thời gian thực từ mô hình PitchIntel.',
    descriptionEn: 'Live scores, match clock, and real-time model probabilities from PitchIntel.',
    ctaPath: '/',
    ctaLabelVi: 'Về trang chủ trận đấu',
    ctaLabelEn: 'Go to match hub',
  },
  {
    path: '/bang-xep-hang-world-cup-2026',
    titleVi: 'Bảng xếp hạng World Cup 2026',
    titleEn: 'World Cup 2026 standings',
    descriptionVi: 'Bảng xếp hạng 12 bảng A–L và xếp hạng hạng 3 tốt nhất cho vòng knockout.',
    descriptionEn: 'Group A–L standings and best third-place ranking for the knockout stage.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem bảng xếp hạng',
    ctaLabelEn: 'View standings',
  },
  {
    path: '/ket-qua-world-cup-2026',
    titleVi: 'Kết quả World Cup 2026',
    titleEn: 'World Cup 2026 results',
    descriptionVi: 'Kết quả các trận đã kết thúc và lịch sử đối đầu tại World Cup.',
    descriptionEn: 'Completed match results and World Cup head-to-head history.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem kết quả & lịch',
    ctaLabelEn: 'View results & schedule',
  },
  {
    path: '/du-doan-world-cup-2026',
    titleVi: 'Dự đoán World Cup 2026',
    titleEn: 'World Cup 2026 predictions',
    descriptionVi:
      'Xác suất thắng/hòa/thua, tỉ số dự đoán, độ tin cậy mô hình và kịch bản trận đấu.',
    descriptionEn: 'Win/draw/loss probability, predicted scorelines, model confidence, and scenarios.',
    ctaPath: '/guide',
    ctaLabelVi: 'Cách đọc dự đoán',
    ctaLabelEn: 'How to read predictions',
  },
  {
    path: '/phan-tich-world-cup-2026',
    titleVi: 'Phân tích World Cup 2026',
    titleEn: 'World Cup 2026 analysis',
    descriptionVi: 'Phân tích chiến thuật, đa kịch bản và tin tình báo World Cup từ PitchIntel.',
    descriptionEn: 'Tactical analysis, multi-scenario predictions, and World Cup news intelligence.',
    ctaPath: '/news-intelligence',
    ctaLabelVi: 'Tin & phân tích',
    ctaLabelEn: 'News & analysis',
  },
  {
    path: '/vong-bang-world-cup-2026',
    titleVi: 'Vòng bảng World Cup 2026',
    titleEn: 'World Cup 2026 group stage',
    descriptionVi: 'Lịch và bảng xếp hạng vòng bảng — 48 đội, 12 bảng A–L.',
    descriptionEn: 'Group stage fixtures and standings — 48 teams in groups A–L.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem vòng bảng',
    ctaLabelEn: 'View group stage',
  },
  {
    path: '/vong-knockout-world-cup-2026',
    titleVi: 'Vòng knockout World Cup 2026',
    titleEn: 'World Cup 2026 knockout stage',
    descriptionVi: 'Nhánh đấu Vòng 1/16 đến Chung kết — xác suất và phân tích từng trận.',
    descriptionEn: 'Knockout bracket from Round of 32 to the Final with match-level analysis.',
    ctaPath: '/matches',
    ctaLabelVi: 'Xem nhánh knockout',
    ctaLabelEn: 'View knockout bracket',
  },
];

export const SEO_PAGE_PATHS = SEO_PAGES.map((p) => p.path);

export function findSeoPage(path: string): SeoPageDef | undefined {
  return SEO_PAGES.find((p) => p.path === path);
}
