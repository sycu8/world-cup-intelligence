export type GuideBlock = { vi: string; en: string };

export function pickGuide(block: GuideBlock, mode: 'vi' | 'en'): string {
  return mode === 'en' ? block.en : block.vi;
}

export type GuideSection = {
  id: string;
  title: GuideBlock;
  body: GuideBlock;
  bullets?: GuideBlock[];
};

export const guideIntro: GuideBlock = {
  vi: 'PitchIntel giúp bạn theo dõi World Cup 2026 với lịch thi đấu, xác suất mô hình, phân tích trước trận và tin tức đã lọc — không cần tài khoản.',
  en: 'PitchIntel helps you follow World Cup 2026 with schedules, model probabilities, pre-match analysis, and filtered news — no account required.',
};

export const quickStartSteps: {
  to: string;
  title: GuideBlock;
  desc: GuideBlock;
  accent: 'cyan' | 'magenta' | 'yellow' | 'live';
}[] = [
  {
    to: '/',
    accent: 'cyan',
    title: { vi: '1. Xem lịch & trận nổi bật', en: '1. Calendar & featured match' },
    desc: {
      vi: 'Đếm ngược tới khai mạc, trận live hoặc sắp đá — bấm vào trận để mở phân tích.',
      en: 'Countdown to kickoff, live or next match — tap any fixture for analysis.',
    },
  },
  {
    to: '/matches/vong-bang-a-united-states-vs-mexico',
    accent: 'magenta',
    title: { vi: '2. Mở một trận cụ thể', en: '2. Open a specific match' },
    desc: {
      vi: 'Xác suất H/D/A, xG, đội hình dự kiến, bối cảnh bảng và briefing AI (nếu bật).',
      en: 'H/D/A probabilities, xG, projected lineups, group context, and AI briefing when enabled.',
    },
  },
  {
    to: '/news-intelligence',
    accent: 'yellow',
    title: { vi: '3. Đọc tin đã lọc', en: '3. Read filtered news' },
    desc: {
      vi: 'RSS BBC, Guardian, FIFA, Reuters, AP, Sky — ảnh, tóm tắt VI, điểm độ tin cậy nguồn.',
      en: 'BBC, Guardian, FIFA, Reuters, AP, Sky RSS — thumbnails, VI summaries, source reliability.',
    },
  },
  {
    to: '/guide',
    accent: 'live',
    title: { vi: '4. Đọc thuật ngữ', en: '4. Learn the glossary' },
    desc: {
      vi: 'Hiểu H, D, A, xG, confidence — tránh nhầm với tỷ lệ nhà cái.',
      en: 'Understand H, D, A, xG, confidence — not bookmaker odds.',
    },
  },
];

export const guideSections: GuideSection[] = [
  {
    id: 'what',
    title: { vi: 'PitchIntel là gì?', en: 'What is PitchIntel?' },
    body: {
      vi: 'Nền tảng tình báo chiến thuật cho FIFA World Cup 2026 (48 đội, 104 trận, ba quốc gia đồng chủ). Dữ liệu tự làm mới: trận mỗi phút, tin mỗi 15 phút.',
      en: 'A tactical intelligence hub for FIFA World Cup 2026 (48 teams, 104 matches, three co-hosts). Data auto-refreshes: matches every minute, news every 15 minutes.',
    },
  },
  {
    id: 'match-page',
    title: { vi: 'Trang trận đấu gồm những gì?', en: 'What’s on a match page?' },
    body: {
      vi: 'Mỗi trận là một “hồ sơ” riêng — nội dung thay đổi theo matchId, không dùng chung một bài phân tích.',
      en: 'Each match is its own dossier — content is keyed by matchId, not a generic template.',
    },
    bullets: [
      {
        vi: 'Dải xác suất: thắng chủ nhà (H), hòa (D), thắng khách (A) và xG kỳ vọng.',
        en: 'Probability strip: home (H), draw (D), away (A) and expected goals (xG).',
      },
      {
        vi: 'Phân tích trước trận: sức mạnh, phong độ, đội hình 11 người, bối cảnh bảng.',
        en: 'Pre-match block: strength, form, full XI, group context.',
      },
      {
        vi: 'Ma trận tỉ số & timeline xác suất (khi mô hình đã tính).',
        en: 'Scoreline matrix & probability timeline when the model has run.',
      },
      {
        vi: 'Đối đầu trong phạm vi WC 2026 (cập nhật khi có trận đã kết thúc).',
        en: 'Head-to-head within WC 2026 scope (fills in as results arrive).',
      },
    ],
  },
  {
    id: 'glossary',
    title: { vi: 'Thuật ngữ nhanh', en: 'Quick glossary' },
    body: {
      vi: 'Các chỉ số dưới đây đến từ engine thống kê nội bộ — không phải khuyến nghị cá cược.',
      en: 'Metrics below come from our statistical engine — not betting advice.',
    },
    bullets: [
      { vi: 'H / D / A — xác suất thắng chủ nhà, hòa, thắng khách.', en: 'H / D / A — home win, draw, away win probabilities.' },
      { vi: 'xG — bàn thắng kỳ vọng (chất lượng cơ hội).', en: 'xG — expected goals from chance quality.' },
      { vi: 'Confidence — độ tin cậy snapshot mô hình tại thời điểm tính.', en: 'Confidence — model certainty at snapshot time.' },
      { vi: 'Elo / FIFA rank / collective strength — chỉ số nền đội bóng.', en: 'Elo / FIFA rank / collective strength — underlying team indices.' },
      { vi: 'Hot score tin — độ “nóng” theo độ tin nguồn + độ mới bài.', en: 'News hot score — source reliability plus recency.' },
    ],
  },
  {
    id: 'limits',
    title: { vi: 'Giới hạn cần biết', en: 'Good to know' },
    body: {
      vi: 'Một số đội WC 2026 dùng dữ liệu placeholder cho đến khi có squad chính thức. Đội hình có thể là dự kiến nếu chưa công bố. H2H chỉ trong khuôn khổ giải 2026.',
      en: 'Some WC 2026 sides still use placeholder data until squads are final. Lineups may be projected if not announced. H2H is scoped to the 2026 tournament only.',
    },
  },
  {
    id: 'roadmap',
    title: { vi: 'Hướng phát triển (gợi ý)', en: 'Roadmap ideas' },
    body: {
      vi: 'Dựa trên phản hồi người dùng mới — các hạng mục sau có thể bổ sung dần:',
      en: 'Based on new-user needs — we may add over time:',
    },
    bullets: [
      { vi: 'Bảng xếp hạng live theo bảng / vòng knock-out.', en: 'Live group tables and knockout bracket.' },
      { vi: 'Hồ sơ đội & cầu thủ đầy đủ (stats, lịch sử CLB).', en: 'Rich team & player profiles (club history, stats).' },
      { vi: 'So sánh hai đội / hai trận cạnh nhau.', en: 'Side-by-side team or match comparison.' },
      { vi: 'Thông báo trận yêu thích & highlight video.', en: 'Favorite-match alerts & video highlights.' },
      { vi: 'Chế độ “người mới” ẩn bớt panel nâng cao.', en: 'Beginner mode hiding advanced panels.' },
    ],
  },
];

export const newUserNeedsBrainstorm: { category: GuideBlock; items: GuideBlock[] }[] = [
  {
    category: { vi: 'Bối cảnh giải', en: 'Tournament context' },
    items: [
      { vi: 'Ai đồng chủ, khi nào khai mạc, có bao nhiêu trận/bảng.', en: 'Hosts, opening date, match and group counts.' },
      { vi: 'Luật vòng bảng (48 đội) vs knock-out.', en: 'Group stage (48 teams) vs knockout rules.' },
      { vi: 'Múi giờ địa phương cho kickoff.', en: 'Local timezone for kickoffs.' },
    ],
  },
  {
    category: { vi: 'Trước & trong trận', en: 'Before & during matches' },
    items: [
      { vi: 'Ai đá, sơ đồ, chấn thương / treo giò (khi có nguồn).', en: 'Who plays, formation, injuries/suspensions when sourced.' },
      { vi: 'Ai được dự đoán thắng và tại sao (1–2 câu plain language).', en: 'Who is favored and why in plain language.' },
      { vi: 'Tỉ số có khả năng cao, không chỉ H/D/A.', en: 'Likely scorelines, not only H/D/A.' },
    ],
  },
  {
    category: { vi: 'Tin & độ tin cậy', en: 'News & trust' },
    items: [
      { vi: 'Tin đến từ đâu, cập nhật lúc nào.', en: 'Where news comes from and when it was updated.' },
      { vi: 'Khác biệt tin “nóng” vs tin trong danh sách.', en: 'Difference between hot picks and the full feed.' },
      { vi: 'Link ra bài gốc để đọc tiếp.', en: 'Link to original article for full read.' },
    ],
  },
  {
    category: { vi: 'Tương tác', en: 'Interaction' },
    items: [
      { vi: 'Tìm đội / trận nhanh (search).', en: 'Quick team or match search.' },
      { vi: 'Lưu trận quan tâm (watchlist).', en: 'Save matches to a watchlist.' },
      { vi: 'Chia sẻ link trận cho bạn bè.', en: 'Share a match link with friends.' },
    ],
  },
];
