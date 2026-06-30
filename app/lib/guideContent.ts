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
  vi: 'PitchIntel giúp bạn theo dõi World Cup 2026 với lịch thi đấu, dự đoán trận, phân tích trước trận và tin tức đã lọc — không cần tài khoản.',
  en: 'PitchIntel helps you follow World Cup 2026 with schedules, match predictions, pre-match analysis, and filtered news — no account required.',
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
      vi: 'Tỉ lệ thắng/hòa/thua, xG, đội hình dự kiến, bối cảnh bảng và tóm tắt AI (nếu có).',
      en: 'Win/draw/loss odds, xG, projected lineups, group context, and AI summary when available.',
    },
  },
  {
    to: '/news-intelligence',
    accent: 'yellow',
    title: { vi: '3. Đọc tin đã lọc', en: '3. Read filtered news' },
    desc: {
      vi: 'Tin từ BBC, Guardian, FIFA, Reuters, AP, Sky — có ảnh, tóm tắt tiếng Việt và mức độ tin cậy nguồn.',
      en: 'Stories from BBC, Guardian, FIFA, Reuters, AP, Sky — thumbnails, Vietnamese summaries, source reliability.',
    },
  },
  {
    to: '/guide',
    accent: 'live',
    title: { vi: '4. Đọc thuật ngữ', en: '4. Learn the glossary' },
    desc: {
      vi: 'Hiểu C/H/K, xG, độ tin cậy — tránh nhầm với tỷ lệ nhà cái.',
      en: 'Understand H/D/A, xG, confidence — not bookmaker odds.',
    },
  },
];

export const guideSections: GuideSection[] = [
  {
    id: 'what',
    title: { vi: 'PitchIntel là gì?', en: 'What is PitchIntel?' },
    body: {
      vi: 'Trang theo dõi World Cup 2026 (48 đội, 104 trận, ba quốc gia đồng chủ). Lịch trận và dự đoán cập nhật thường xuyên; tin mới được bổ sung liên tục.',
      en: 'A World Cup 2026 hub (48 teams, 104 matches, three co-hosts). Fixtures and predictions refresh often; news is added throughout the day.',
    },
  },
  {
    id: 'match-page',
    title: { vi: 'Trang trận đấu gồm những gì?', en: 'What’s on a match page?' },
    body: {
      vi: 'Mỗi trận có trang riêng — nội dung thay đổi theo từng cặp đấu, không dùng chung một bài phân tích.',
      en: 'Each match has its own page — content is tailored to that fixture, not a generic template.',
    },
    bullets: [
      {
        vi: 'Dải dự đoán: tỉ lệ thắng chủ nhà (C), hòa (H), thắng khách (K) và xG kỳ vọng.',
        en: 'Forecast strip: home (H), draw (D), away (A) odds and expected goals (xG).',
      },
      {
        vi: 'Phân tích trước trận: sức mạnh, phong độ, đội hình 11 người, bối cảnh bảng.',
        en: 'Pre-match block: strength, form, full XI, group context.',
      },
      {
        vi: 'Bảng tỉ số khả dĩ & lịch sử dự đoán (khi đã tính xong).',
        en: 'Likely scorelines & forecast history when available.',
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
      vi: 'Các chỉ số dưới đây do PitchIntel tính — chỉ để tham khảo, không phải lời khuyên cược.',
      en: 'Metrics below come from PitchIntel — for reference only, not betting advice.',
    },
    bullets: [
      { vi: 'C / H / K — khả năng thắng chủ nhà, hòa, thắng khách.', en: 'H / D / A — home win, draw, away win chances.' },
      { vi: 'xG — bàn thắng kỳ vọng (chất lượng cơ hội).', en: 'xG — expected goals from chance quality.' },
      { vi: 'Độ tin cậy — PitchIntel tự tin đến mức nào với dự đoán lúc đó.', en: 'Confidence — how sure PitchIntel is about the forecast at that moment.' },
      { vi: 'Elo / hạng FIFA / sức mạnh tập thể — chỉ số nền của đội bóng.', en: 'Elo / FIFA rank / collective strength — underlying team indices.' },
      { vi: 'Tin nổi bật — bài được chọn theo độ tin nguồn và độ mới.', en: 'Hot picks — stories ranked by source reliability and recency.' },
    ],
  },
  {
    id: 'limits',
    title: { vi: 'Giới hạn cần biết', en: 'Good to know' },
    body: {
      vi: 'Một số đội WC 2026 dùng dữ liệu tạm cho đến khi có danh sách triệu tập chính thức. Đội hình có thể là dự kiến nếu chưa công bố. Đối đầu chỉ trong khuôn khổ giải 2026.',
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
      { vi: 'Bảng xếp hạng trực tiếp theo bảng / vòng loại trực tiếp.', en: 'Live group tables and knockout bracket.' },
      { vi: 'Hồ sơ đội & cầu thủ đầy đủ (thống kê, lịch sử CLB).', en: 'Rich team & player profiles (club history, stats).' },
      { vi: 'So sánh hai đội / hai trận cạnh nhau.', en: 'Side-by-side team or match comparison.' },
      { vi: 'Thông báo trận yêu thích & video tóm tắt.', en: 'Favorite-match alerts & video highlights.' },
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
      { vi: 'Ai được dự đoán thắng và tại sao (1–2 câu dễ hiểu).', en: 'Who is favored and why in plain language.' },
      { vi: 'Tỉ số có khả năng cao, không chỉ thắng/hòa/thua.', en: 'Likely scorelines, not only win/draw/loss.' },
    ],
  },
  {
    category: { vi: 'Tin & độ tin cậy', en: 'News & trust' },
    items: [
      { vi: 'Tin đến từ đâu, cập nhật lúc nào.', en: 'Where news comes from and when it was updated.' },
      { vi: 'Khác biệt tin “nổi bật” vs tin trong danh sách.', en: 'Difference between hot picks and the full feed.' },
      { vi: 'Link ra bài gốc để đọc tiếp.', en: 'Link to original article for full read.' },
    ],
  },
  {
    category: { vi: 'Tương tác', en: 'Interaction' },
    items: [
      { vi: 'Tìm đội / trận nhanh (search).', en: 'Quick team or match search.' },
      { vi: 'Lưu trận quan tâm (yêu thích).', en: 'Save matches to favorites.' },
      { vi: 'Chia sẻ link trận cho bạn bè.', en: 'Share a match link with friends.' },
    ],
  },
];
