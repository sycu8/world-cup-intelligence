export type LocaleKey =
  | 'nav.command'
  | 'nav.home'
  | 'nav.matches'
  | 'nav.tournaments'
  | 'nav.news'
  | 'nav.signals'
  | 'nav.probabilitySignals'
  | 'nav.guide'
  | 'matches.pageTitle'
  | 'matches.pageSubtitle'
  | 'matches.loading'
  | 'matches.tabSchedule'
  | 'matches.tabStandings'
  | 'matches.tabBracket'
  | 'standings.title'
  | 'standings.subtitle'
  | 'standings.loading'
  | 'standings.unavailable'
  | 'standings.complete'
  | 'standings.team'
  | 'standings.pts'
  | 'standings.noResults'
  | 'standings.thirdPlace'
  | 'standings.played'
  | 'standings.gd'
  | 'standings.thirdBadge'
  | 'standings.thirdRowDetail'
  | 'standings.qualifiesR32'
  | 'bracket.title'
  | 'bracket.subtitle'
  | 'bracket.loading'
  | 'bracket.empty'
  | 'nav.articles'
  | 'nav.more'
  | 'news.pageTitle'
  | 'news.pageSubtitle'
  | 'news.feedTitle'
  | 'news.hot'
  | 'news.latest'
  | 'news.loading'
  | 'news.empty'
  | 'news.selectHint'
  | 'news.backToFeed'
  | 'news.openSource'
  | 'news.viewModeLabel'
  | 'news.readAtSource'
  | 'news.briefLabel'
  | 'news.tapToRead'
  | 'news.translating'
  | 'news.translatingBody'
  | 'news.translationFallback'
  | 'news.notFound'
  | 'news.articleLangLabel'
  | 'home.title'
  | 'home.subtitle'
  | 'home.badge'
  | 'home.calendar'
  | 'home.calendarTitle'
  | 'home.calendarSubtitle'
  | 'home.calendarLoading'
  | 'home.noFeatured'
  | 'home.featuredTitle'
  | 'home.pipeline'
  | 'home.loading'
  | 'match.loading'
  | 'match.history'
  | 'match.historyEmpty'
  | 'match.h2hSummary'
  | 'match.hints'
  | 'match.hintsNote'
  | 'match.probability'
  | 'match.confidence'
  | 'match.home'
  | 'match.draw'
  | 'match.away'
  | 'match.live'
  | 'match.scheduled'
  | 'match.completed'
  | 'match.fullAnalysis'
  | 'match.notFound'
  | 'match.backSchedule'
  | 'match.previewTitle'
  | 'match.previewSubtitle'
  | 'match.previewStrength'
  | 'match.previewLineup'
  | 'match.lineupOfficial'
  | 'match.lineupProjected'
  | 'match.lineupSquad'
  | 'match.lineupUnknown'
  | 'match.lineupPending'
  | 'lineups.title'
  | 'lineups.back'
  | 'lineups.loading'
  | 'match.previewForm'
  | 'match.previewContext'
  | 'match.previewTactical'
  | 'match.previewLoading'
  | 'match.briefingTitle'
  | 'match.briefingLoading'
  | 'match.briefingTakeaways'
  | 'tournaments.title'
  | 'tournaments.subtitle'
  | 'tournaments.hubTitle'
  | 'status.syncing'
  | 'footer.tagline'
  | 'footer.description'
  | 'footer.analytics'
  | 'footer.builtBy'
  | 'footer.github'
  | 'common.home'
  | 'common.draw'
  | 'common.away'
  | 'common.abbrHome'
  | 'common.abbrDraw'
  | 'common.abbrAway'
  | 'common.model'
  | 'common.market'
  | 'common.consensus'
  | 'common.delta'
  | 'common.confidence'
  | 'common.updated'
  | 'common.loading'
  | 'common.backHome'
  | 'common.fullGuide'
  | 'common.allNews'
  | 'common.hot'
  | 'common.live'
  | 'common.ft'
  | 'common.startingSoon'
  | 'common.group'
  | 'common.groupStage'
  | 'common.vs'
  | 'common.match'
  | 'common.prev'
  | 'common.next'
  | 'common.pageOf'
  | 'common.searchPlaceholder'
  | 'common.noFilterMatch'
  | 'common.data'
  | 'common.news'
  | 'common.draws'
  | 'common.form'
  | 'common.updatedAt'
  | 'market.title'
  | 'market.subtitle'
  | 'market.disclaimer'
  | 'market.loading'
  | 'market.empty'
  | 'market.volatility'
  | 'market.chartTitle'
  | 'team.title'
  | 'team.subtitle'
  | 'team.loading'
  | 'team.empty'
  | 'team.fifaRank'
  | 'team.elo'
  | 'scenario.title'
  | 'scenario.loading'
  | 'scenario.empty'
  | 'scenario.confidence'
  | 'scenario.predictionTitle'
  | 'scenario.predictionSubtitle'
  | 'scenario.pathA'
  | 'scenario.pathB'
  | 'scenario.comparisonToggle'
  | 'scenario.likelihoodLabel'
  | 'scenario.modelConfidence'
  | 'scenario.initialConditions'
  | 'scenario.triggers'
  | 'scenario.invalidation'
  | 'scenario.mostLikelyScore'
  | 'scenario.comparisonTitle'
  | 'scenario.likelihoodGap'
  | 'scenario.awayWinDelta'
  | 'scenario.lastUpdated'
  | 'scenario.legacyDisclaimer'
  | 'analysis.twoScenarios'
  | 'probMovement.title'
  | 'probMovement.subtitle'
  | 'probMovement.empty'
  | 'probMovement.timelineEmpty'
  | 'probMovement.subtitleDetail'
  | 'probMovement.intervalEmpty'
  | 'probMovement.trendRising'
  | 'probMovement.trendAway'
  | 'probMovement.trendBalanced'
  | 'probMovement.footerNote'
  | 'probMovement.explain'
  | 'probMovement.stable'
  | 'probMovement.baseline'
  | 'probMovement.update'
  | 'probMovement.reasonBaseline'
  | 'probMovement.reasonLive'
  | 'probMovement.reasonRecalc'
  | 'simulator.subtitleDetail'
  | 'simulator.preview'
  | 'simulator.homeEdge'
  | 'simulator.awayEdge'
  | 'simulator.tempo'
  | 'probStrip.subtitle'
  | 'probStrip.subtitleSim'
  | 'home.snapshot'
  | 'home.cohosts'
  | 'home.matches'
  | 'home.groups'
  | 'home.teams'
  | 'home.scheduled'
  | 'home.played'
  | 'home.quickStart'
  | 'home.headlines'
  | 'home.loadingHeadlines'
  | 'home.newHere'
  | 'guide.title'
  | 'guide.quickStart'
  | 'guide.newUsers'
  | 'guide.newUsersBody'
  | 'guide.newUsersBrainstorm'
  | 'match.fullArticle'
  | 'match.guideTitle'
  | 'match.guideIntro'
  | 'match.guideStrip'
  | 'match.guidePreview'
  | 'match.guideMatrix'
  | 'match.guideGlossary'
  | 'match.guideProbNote'
  | 'common.liveLabel'
  | 'match.topScores'
  | 'matchAnalysis.groupTitle'
  | 'matchAnalysis.stageTitle'
  | 'lineups.apiError'
  | 'matchAnalysis.back'
  | 'matchAnalysis.title'
  | 'matchAnalysis.subtitle'
  | 'matchAnalysis.modelProb'
  | 'matchAnalysis.marketNote'
  | 'pitch.title'
  | 'pitch.subtitle'
  | 'pitch.home'
  | 'pitch.away'
  | 'simulator.title'
  | 'simulator.subtitle'
  | 'simulator.reset'
  | 'simulator.scenarioOutput'
  | 'simulator.winProb'
  | 'editorial.mode'
  | 'editorial.takeaways'
  | 'editorial.context'
  | 'featured.modelNow'
  | 'featured.probLoading'
  | 'wc.title'
  | 'wc.underway'
  | 'wc.countdownTo'
  | 'multiVar.loading'
  | 'history.moreMeetings'
  | 'calendar.filterAll'
  | 'calendar.filterGroup'
  | 'calendar.filterKnockout'
  | 'calendar.filterLive'
  | 'calendar.filterScheduled'
  | 'calendar.filterCompleted'
  | 'calendar.showing'
  | 'calendar.countLabel'
  | 'calendar.seedLabel'
  | 'calendar.groupLabel'
  | 'home.newUserHint'
  | 'home.newUserHintLink'
  | 'home.newUserHintTail'
  | 'tournaments.teams'
  | 'tournaments.viewSchedule'
  | 'tournaments.viewFinal'
  | 'matchAnalysis.articleSubtitle'
  | 'matchAnalysis.scoreline'
  | 'matchAnalysis.notFound'
  | 'matchAnalysis.notFoundBack'
  | 'match.briefingAiSubtitle'
  | 'matchHeader.matchLabel'
  | 'news.pagination'
  | 'countdown.day'
  | 'countdown.hour'
  | 'countdown.min'
  | 'countdown.sec'
  | 'matrix.title'
  | 'matrix.subtitle'
  | 'multiVar.title'
  | 'multiVar.subtitle'
  | 'multiVar.analysisHeading'
  | 'player.title'
  | 'player.subtitle'
  | 'contribution.subtitle'
  | 'source.title'
  | 'source.subtitle'
  | 'history.avgGoals'
  | 'lang.label'
  | 'viewMode.label'
  | 'wc.days'
  | 'wc.hours'
  | 'wc.mins'
  | 'wc.secs'
  | 'contribution.title'
  | 'contribution.pressing'
  | 'contribution.chanceCreation'
  | 'contribution.finishing'
  | 'contribution.defensive'
  | 'contribution.transition'
  | 'contribution.mixCenter'
  | 'source.tierOfficial'
  | 'source.tierTrusted'
  | 'source.tierReview'
  | 'source.platformBriefing'
  | 'match.wcHistory'
  | 'match.wcHistoryHint'
  | 'match.wcHistoryEmpty'
  | 'team.wcH2hTitle'
  | 'team.wcH2hSubtitle'
  | 'team.wcH2hEmpty'
  | 'team.wcH2hRecord'
  | 'team.wcH2hMeetings'
  | 'history.stageR32'
  | 'history.stageR16'
  | 'history.stageQf'
  | 'history.stageSf'
  | 'history.stageThird'
  | 'history.stageFinal'
  | 'history.matchStage';

export const messages: Record<LocaleKey, { vi: string; en: string }> = {
  'nav.command': { vi: 'Trung tâm', en: 'Command' },
  'nav.home': { vi: 'Trang chủ', en: 'Home' },
  'nav.matches': { vi: 'Trận đấu', en: 'Matches' },
  'nav.tournaments': { vi: 'Giải đấu', en: 'Tournaments' },
  'nav.news': { vi: 'Tin tức', en: 'News' },
  'nav.signals': { vi: 'Tín hiệu', en: 'Signals' },
  'nav.probabilitySignals': { vi: 'Tín hiệu xác suất', en: 'Probability Signals' },
  'nav.guide': { vi: 'Hướng dẫn', en: 'Guide' },
  'matches.pageTitle': { vi: 'Lịch thi đấu', en: 'Match schedule' },
  'matches.pageSubtitle': {
    vi: 'Trận đang diễn ra hoặc sắp đá ở trên — toàn bộ lịch World Cup 2026 bên dưới.',
    en: 'Live or next-up match on top — full World Cup 2026 schedule below.',
  },
  'matches.loading': { vi: 'Đang tải lịch thi đấu…', en: 'Loading match schedule…' },
  'matches.tabSchedule': { vi: 'Lịch thi đấu', en: 'Schedule' },
  'matches.tabStandings': { vi: 'Bảng xếp hạng', en: 'Standings' },
  'matches.tabBracket': { vi: 'Nhánh đấu', en: 'Bracket' },
  'standings.title': { vi: 'Bảng xếp hạng vòng bảng', en: 'Group stage standings' },
  'standings.subtitle': {
    vi: 'Top 2 vào Vòng 1/16 · 8 hạng 3 tốt nhất vào các trận R32 13–16',
    en: 'Top 2 advance to R32 · 8 best third-place teams fill R32 matches 13–16',
  },
  'standings.loading': { vi: 'Đang tải bảng…', en: 'Loading standings…' },
  'standings.unavailable': { vi: 'Chưa có dữ liệu bảng.', en: 'Standings unavailable.' },
  'standings.complete': { vi: 'Xong', en: 'Done' },
  'standings.team': { vi: 'Đội', en: 'Team' },
  'standings.pts': { vi: 'Đ', en: 'Pts' },
  'standings.noResults': { vi: 'Chưa có trận kết thúc', en: 'No finished matches yet' },
  'standings.thirdPlace': { vi: 'Xếp hạng hạng 3 (8 suất tốt nhất → Vòng 1/16)', en: 'Third-place ranking (top 8 → Round of 32)' },
  'standings.played': { vi: 'Tr', en: 'P' },
  'standings.gd': { vi: 'HS', en: 'GD' },
  'standings.thirdBadge': { vi: 'H3', en: '3rd' },
  'standings.thirdRowDetail': {
    vi: '({group}) · {pts} đ · HS {gd}',
    en: '({group}) · {pts} pts · GD {gd}',
  },
  'standings.qualifiesR32': { vi: '→ Vòng 1/16', en: '→ R32' },
  'bracket.title': { vi: 'Nhánh knockout', en: 'Knockout bracket' },
  'bracket.subtitle': {
    vi: 'Vòng 1/16 → Chung kết — bấm trận để mở phân tích',
    en: 'Round of 32 → Final — tap a match for analysis',
  },
  'bracket.loading': { vi: 'Đang tải nhánh…', en: 'Loading bracket…' },
  'bracket.empty': { vi: 'Chưa có trận knockout.', en: 'No knockout matches yet.' },
  'nav.articles': { vi: 'Bài viết', en: 'Articles' },
  'nav.more': { vi: 'Thêm', en: 'More' },
  'news.pageTitle': { vi: 'Tin World Cup', en: 'World Cup News' },
  'news.pageSubtitle': {
    vi: 'Chạm vào bài để mở trang riêng — chuyển Tiếng Việt / English trên từng bài.',
    en: 'Tap an article for its own page — switch Vietnamese / English per article.',
  },
  'news.feedTitle': { vi: 'Tin tức & tình báo', en: 'News & intelligence' },
  'news.hot': { vi: 'Top 3 nổi bật', en: 'Top 3 hot' },
  'news.latest': { vi: 'Bài mới', en: 'Latest' },
  'news.loading': { vi: 'Đang tải tin…', en: 'Loading news…' },
  'news.empty': {
    vi: 'Chưa có tin — đồng bộ RSS mỗi 15 phút.',
    en: 'No articles yet — RSS syncs every 15 minutes.',
  },
  'news.selectHint': {
    vi: 'Chế độ Đọc bài — chọn một tin bên dưới để xem bài viết trong app.',
    en: 'Editorial mode — pick an article below to read in-app.',
  },
  'news.backToFeed': { vi: 'Quay lại danh sách', en: 'Back to feed' },
  'news.openSource': { vi: 'Mở nguồn', en: 'Open source' },
  'news.viewModeLabel': { vi: 'Chế độ xem', en: 'View mode' },
  'news.readAtSource': { vi: 'Đọc chi tiết tại nguồn →', en: 'Read full article at source →' },
  'news.briefLabel': { vi: 'Tóm tắt', en: 'Brief summary' },
  'news.tapToRead': { vi: 'Chạm để đọc tóm tắt', en: 'Tap to read summary' },
  'news.translating': { vi: 'Đang dịch sang tiếng Việt…', en: 'Translating to Vietnamese…' },
  'news.translatingBody': {
    vi: 'Nội dung đang được dịch — vui lòng đợi vài giây.',
    en: 'Content is being translated — please wait a moment.',
  },
  'news.translationFallback': {
    vi: 'Chưa dịch được tự động — hiển thị bản tiếng Anh. Bạn có thể mở nguồn gốc bên dưới.',
    en: 'Auto-translation unavailable — showing English. Open the source link below for the original.',
  },
  'news.notFound': { vi: 'Không tìm thấy bài viết.', en: 'Article not found.' },
  'news.articleLangLabel': { vi: 'Ngôn ngữ bài viết', en: 'Article language' },
  'home.title': { vi: 'Trung tâm Chiến thuật World Cup', en: 'World Cup Tactical Command' },
  'home.subtitle': {
    vi: 'Dữ liệu cập nhật mỗi phút. Xác suất tính trên backend. Tin tức crawl mỗi 15 phút.',
    en: 'Data refreshes every minute. Probabilities on the backend. News every 15 minutes.',
  },
  'home.badge': { vi: 'Chỉ xem · tự động backend', en: 'View only · backend automated' },
  'home.calendar': { vi: 'Lịch thi đấu', en: 'Match calendar' },
  'home.calendarTitle': {
    vi: 'Lịch thi đấu World Cup 2026',
    en: 'World Cup 2026 Match Schedule',
  },
  'home.calendarSubtitle': {
    vi: '104 trận — 48 đội, vòng bảng và vòng knock-out. Chọn trận để xem xác suất, lịch sử đối đầu và gợi ý.',
    en: '104 matches — 48 teams, group stage and knockout rounds. Open a match for probabilities, H2H history, and hints.',
  },
  'home.noFeatured': {
    vi: 'Chưa có trận sắp diễn ra.',
    en: 'No upcoming match to highlight.',
  },
  'home.featuredTitle': {
    vi: 'Trận sắp diễn ra',
    en: 'Upcoming match',
  },
  'home.calendarLoading': { vi: 'Đang tải lịch thi đấu…', en: 'Loading match schedule…' },
  'home.pipeline': { vi: 'Trạng thái pipeline', en: 'Pipeline status' },
  'home.loading': { vi: 'Đang tải trận gần nhất…', en: 'Loading nearest match…' },
  'match.loading': { vi: 'Đang tải trận đấu…', en: 'Loading match…' },
  'match.history': {
    vi: 'Đối đầu tại World Cup 2026',
    en: 'Head-to-head at World Cup 2026',
  },
  'match.historyEmpty': {
    vi: 'Chưa có trận đã kết thúc giữa hai đội tại World Cup 2026.',
    en: 'No completed meetings between these teams at World Cup 2026 yet.',
  },
  'match.h2hSummary': { vi: 'Tổng hợp đối đầu', en: 'H2H summary' },
  'match.wcHistory': {
    vi: 'Đối đầu tại các World Cup trước',
    en: 'Previous World Cup meetings',
  },
  'match.wcHistoryHint': {
    vi: 'Các trận đã kết thúc giữa hai đội ở các kỳ World Cup trước 2026.',
    en: 'Completed meetings between these teams at World Cups before 2026.',
  },
  'match.wcHistoryEmpty': {
    vi: 'Hai đội chưa từng gặp nhau tại World Cup trước 2026.',
    en: 'These teams have not met at a World Cup before 2026.',
  },
  'match.hints': { vi: 'Gợi ý xác suất', en: 'Probability hints' },
  'match.hintsNote': {
    vi: 'Số liệu từ mô hình thống kê — chỉ để phân tích, không phải hướng dẫn đặt cược.',
    en: 'Figures from the statistical model — for analysis only, not wagering guidance.',
  },
  'match.probability': { vi: 'Xác suất mô hình', en: 'Model probability' },
  'match.confidence': { vi: 'Độ tin cậy', en: 'Confidence' },
  'match.home': { vi: 'Chủ nhà', en: 'Home' },
  'match.draw': { vi: 'Hòa', en: 'Draw' },
  'match.away': { vi: 'Khách', en: 'Away' },
  'match.live': { vi: 'Đang diễn ra', en: 'Live' },
  'match.scheduled': { vi: 'Sắp diễn ra', en: 'Scheduled' },
  'match.completed': { vi: 'Đã kết thúc', en: 'Completed' },
  'match.fullAnalysis': { vi: 'Phân tích chiến thuật đầy đủ', en: 'Full tactical analysis' },
  'match.notFound': {
    vi: 'Không tìm thấy trận đấu này.',
    en: 'This match could not be found.',
  },
  'match.backSchedule': { vi: 'Lịch thi đấu', en: 'Match schedule' },
  'match.previewTitle': { vi: 'Phân tích trận', en: 'Match preview' },
  'match.previewSubtitle': {
    vi: 'Lực lượng · đội hình dự kiến · phong độ (từ dữ liệu đã thu thập)',
    en: 'Squad strength · expected lineups · form (from collected data)',
  },
  'match.previewStrength': { vi: 'Lực lượng', en: 'Squad strength' },
  'match.previewLineup': { vi: 'Đội hình', en: 'Lineups' },
  'match.lineupOfficial': { vi: 'Chính thức', en: 'Official' },
  'match.lineupProjected': { vi: 'Dự kiến', en: 'Projected' },
  'match.lineupSquad': { vi: 'Từ danh sách đội', en: 'From squad' },
  'match.lineupUnknown': { vi: 'Chưa rõ', en: 'Unknown' },
  'match.lineupPending': {
    vi: 'Chưa có thông tin chính xác, sẽ cập nhật sau.',
    en: 'No confirmed lineup yet — will update when official teams are published.',
  },
  'lineups.title': { vi: 'Đội hình trận đấu', en: 'Match lineups' },
  'lineups.back': { vi: '← Về trận đấu', en: '← Back to match' },
  'lineups.loading': { vi: 'Đang tải đội hình…', en: 'Loading lineups…' },
  'lineups.apiError': { vi: 'Lỗi tải dữ liệu', en: 'Failed to load data' },
  'match.previewForm': { vi: 'Phong độ', en: 'Form' },
  'match.previewContext': { vi: 'Bối cảnh giải', en: 'Tournament context' },
  'match.previewTactical': { vi: 'Góc chiến thuật', en: 'Tactical angle' },
  'match.previewLoading': { vi: 'Đang tạo phân tích riêng cho trận này…', en: 'Building match-specific analysis…' },
  'match.briefingTitle': { vi: 'Phân tích chiến thuật', en: 'Tactical briefing' },
  'match.briefingLoading': { vi: 'Đang tải phân tích chiến thuật…', en: 'Loading tactical briefing…' },
  'match.briefingTakeaways': { vi: 'Điểm chính', en: 'Key takeaways' },
  'tournaments.title': { vi: 'Giải đấu', en: 'Tournaments' },
  'tournaments.subtitle': {
    vi: 'World Cup từ 2006 — metadata giải; WC 2026 có đầy đủ lịch trận.',
    en: 'World Cups from 2006 — tournament metadata; WC 2026 has full match schedule.',
  },
  'tournaments.hubTitle': { vi: 'World Cup (từ 2006)', en: 'World Cups (2006+)' },
  'status.syncing': { vi: 'Đang đồng bộ…', en: 'Syncing…' },
  'footer.tagline': { vi: 'Tình báo chiến thuật bóng đá', en: 'Football tactical intelligence' },
  'footer.description': {
    vi: 'Phân tích trận dự đoán, insight chiến thuật và tình báo xác suất.',
    en: 'Predictive match analysis, tactical insights, and probability intelligence.',
  },
  'footer.analytics': { vi: 'Phân tích', en: 'Analytics' },
  'footer.builtBy': { vi: 'Xây dựng bởi', en: 'Built by' },
  'footer.github': { vi: 'GitHub', en: 'GitHub' },
  'common.home': { vi: 'Chủ nhà', en: 'Home' },
  'common.draw': { vi: 'Hòa', en: 'Draw' },
  'common.away': { vi: 'Khách', en: 'Away' },
  'common.abbrHome': { vi: 'C', en: 'H' },
  'common.abbrDraw': { vi: 'H', en: 'D' },
  'common.abbrAway': { vi: 'K', en: 'A' },
  'common.model': { vi: 'Mô hình', en: 'Model' },
  'common.market': { vi: 'Thị trường', en: 'Market' },
  'common.consensus': { vi: 'Đồng thuận', en: 'Consensus' },
  'common.delta': { vi: 'Chênh', en: 'Δ' },
  'common.confidence': { vi: 'Độ tin cậy', en: 'Confidence' },
  'common.updated': { vi: 'Cập nhật', en: 'Updated' },
  'common.loading': { vi: 'Đang tải…', en: 'Loading…' },
  'common.backHome': { vi: 'Về trang chủ', en: 'Back to home' },
  'common.fullGuide': { vi: 'Hướng dẫn đầy đủ →', en: 'Full guide →' },
  'common.allNews': { vi: 'Xem tất cả tin →', en: 'All news →' },
  'common.hot': { vi: 'Nổi bật', en: 'Hot' },
  'common.live': { vi: 'TRỰC TIẾP', en: 'LIVE' },
  'common.ft': { vi: 'KẾT THÚC', en: 'FT' },
  'common.startingSoon': { vi: 'Sắp bắt đầu', en: 'Starting soon' },
  'common.group': { vi: 'BẢNG', en: 'GROUP' },
  'common.groupStage': { vi: 'Vòng bảng', en: 'Group stage' },
  'common.vs': { vi: ' gặp ', en: ' vs ' },
  'common.match': { vi: 'TRẬN', en: 'MATCH' },
  'common.prev': { vi: 'Trước', en: 'Previous' },
  'common.next': { vi: 'Sau', en: 'Next' },
  'common.pageOf': { vi: 'Trang {page} / {total}', en: 'Page {page} of {total}' },
  'common.searchPlaceholder': { vi: 'Tìm đội hoặc bảng…', en: 'Search team or group…' },
  'common.noFilterMatch': { vi: 'Không có trận phù hợp bộ lọc.', en: 'No matches match your filters.' },
  'common.data': { vi: 'Dữ liệu', en: 'Data' },
  'common.news': { vi: 'Tin', en: 'News' },
  'common.draws': { vi: 'Hòa', en: 'Draws' },
  'common.form': { vi: 'Phong độ', en: 'Form' },
  'common.updatedAt': { vi: 'Cập nhật', en: 'Updated' },
  'market.title': { vi: 'Mô hình vs thị trường', en: 'Model vs market' },
  'market.subtitle': {
    vi: 'So sánh xác suất mô hình với odds đồng thuận — chỉ để tham khảo phân tích.',
    en: 'Model probability vs consensus odds — analytical reference only.',
  },
  'market.disclaimer': {
    vi: 'Không phải lời khuyên đặt cược.',
    en: 'Not betting advice.',
  },
  'market.loading': { vi: 'Đang tải dữ liệu so sánh…', en: 'Loading comparison data…' },
  'market.empty': {
    vi: 'Chưa có xác suất ngụ ý từ thị trường. Có thể bổ sung dữ liệu đồng thuận để so sánh với mô hình.',
    en: 'No market-implied probability on file. Consensus inputs can be added for model comparison only.',
  },
  'market.volatility': { vi: 'Biến động odds', en: 'Odds volatility' },
  'market.chartTitle': { vi: 'Mô hình vs thị trường', en: 'Model vs market' },
  'team.title': { vi: 'Hệ thống chiến thuật tập thể', en: 'Team collective system' },
  'team.subtitle': {
    vi: 'Đội bóng được mô hình hóa như một hệ thống chiến thuật — không chỉ cộng dồn cầu thủ.',
    en: 'Teams modeled as tactical systems — not only the sum of individual players.',
  },
  'team.loading': { vi: 'Đang tải hệ thống đội…', en: 'Loading team systems…' },
  'team.empty': {
    vi: 'Hồ sơ tập thể sẽ hiện sau khi engine xác suất chạy cho trận này.',
    en: 'Team collective profiles appear after the probability engine runs for this match.',
  },
  'team.fifaRank': { vi: 'Hạng FIFA', en: 'FIFA rank' },
  'team.elo': { vi: 'Elo', en: 'Elo' },
  'scenario.title': { vi: 'Xác suất kịch bản', en: 'Scenario likelihood' },
  'scenario.loading': { vi: 'Đang tải kịch bản…', en: 'Loading scenarios…' },
  'scenario.empty': {
    vi: 'Xác suất kịch bản sẽ hiện sau khi mô hình tính lại.',
    en: 'Scenario likelihoods appear after model recompute.',
  },
  'scenario.confidence': { vi: 'Độ tin cậy', en: 'Confidence' },
  'scenario.predictionTitle': { vi: 'Dự đoán theo kịch bản', en: 'Scenario predictions' },
  'scenario.predictionSubtitle': {
    vi: 'Xác suất kịch bản · lộ trình xác suất · bối cảnh phân tích (không phải khuyến nghị cược)',
    en: 'Scenario likelihood · probability path · analytical context (not betting advice)',
  },
  'scenario.pathA': { vi: 'Kịch bản A', en: 'Scenario A' },
  'scenario.pathB': { vi: 'Kịch bản B', en: 'Scenario B' },
  'scenario.comparisonToggle': { vi: 'So sánh kịch bản', en: 'Scenario comparison' },
  'scenario.likelihoodLabel': { vi: 'Xác suất kịch bản', en: 'Scenario likelihood' },
  'scenario.modelConfidence': { vi: 'Độ tin cậy mô hình', en: 'Model confidence' },
  'scenario.initialConditions': { vi: 'Điều kiện ban đầu', en: 'Initial conditions' },
  'scenario.triggers': { vi: 'Điều kiện kích hoạt', en: 'Triggers' },
  'scenario.invalidation': { vi: 'Điều kiện vô hiệu', en: 'Invalidation' },
  'scenario.mostLikelyScore': { vi: 'Tỉ số khả dĩ nhất', en: 'Most likely score' },
  'scenario.comparisonTitle': { vi: 'So sánh kịch bản', en: 'Scenario comparison' },
  'scenario.likelihoodGap': { vi: 'Chênh xác suất kịch bản', en: 'Likelihood gap' },
  'scenario.awayWinDelta': { vi: 'Chênh thắng khách', en: 'Away win delta' },
  'scenario.lastUpdated': { vi: 'Cập nhật lúc', en: 'Last updated' },
  'scenario.legacyDisclaimer': {
    vi: 'Xác suất kịch bản là ước lượng phân tích — không phải dự đoán chắc chắn.',
    en: 'Scenario likelihoods are model estimates — not outcome guarantees.',
  },
  'analysis.twoScenarios': {
    vi: 'Hai kịch bản trận đấu quan trọng nhất',
    en: 'Two most important match scenarios',
  },
  'probMovement.title': { vi: 'Biến động xác suất', en: 'Probability movement' },
  'probMovement.subtitle': {
    vi: 'Lịch sử cập nhật mô hình cho trận này.',
    en: 'Model update history for this match.',
  },
  'probMovement.empty': {
    vi: 'Chưa có điểm dữ liệu — sẽ có sau lần tính lại tiếp theo.',
    en: 'No data points yet — will appear after the next recompute.',
  },
  'probMovement.timelineEmpty': {
    vi: 'Chưa có lịch sử biến động.',
    en: 'No movement history yet.',
  },
  'probMovement.subtitleDetail': {
    vi: 'Các lần tính lại từ mô hình thống kê — chỉ để tham khảo phân tích.',
    en: 'Model recalculations over time — statistical engine only, for analytical context.',
  },
  'probMovement.intervalEmpty': {
    vi: 'Phân bổ theo hiệp sẽ hiện sau khi mô hình tính cho trận này.',
    en: 'Interval breakdown appears after the model runs for this match.',
  },
  'probMovement.trendRising': {
    vi: 'Xác suất thắng chủ nhà tăng theo hiệp',
    en: 'Home win probability rising through phases',
  },
  'probMovement.trendAway': {
    vi: 'Đội khách được mô hình ưu tiên hơn',
    en: 'Away side gaining through phases',
  },
  'probMovement.trendBalanced': {
    vi: 'Cân bằng — khối hòa ổn định giữa trận',
    en: 'Balanced — draw mass stable mid-game',
  },
  'probMovement.footerNote': {
    vi: 'Mỗi thanh là phân phối 1×3 theo giai đoạn — giúp giải thích biến động xác suất khi xem trực tiếp.',
    en: 'Each bar shows how the model redistributes 1×3 mass by match phase — statistical engine only.',
  },
  'probMovement.explain': {
    vi: 'Theo dõi mỗi lần mô hình cập nhật xác suất thắng/hòa/thua — chỉ hiện khi số liệu thực sự đổi (không phải tỷ lệ nhà cái).',
    en: 'Tracks each time the model updates win/draw/away probabilities — only shown when numbers actually change (not bookmaker odds).',
  },
  'probMovement.stable': {
    vi: 'Xác suất mô hình ổn định — chưa có biến động đáng kể. Các lần chạy lại cron không đổi input nên không tạo dòng mới.',
    en: 'Model probabilities are stable — no meaningful shifts yet. Cron reruns with unchanged inputs do not add new rows.',
  },
  'probMovement.baseline': { vi: 'Mốc ban đầu', en: 'Baseline' },
  'probMovement.update': { vi: 'Cập nhật {n}', en: 'Update {n}' },
  'probMovement.reasonBaseline': {
    vi: 'Ảnh chụp mô hình trước trận',
    en: 'Pre-match model snapshot',
  },
  'probMovement.reasonLive': {
    vi: 'Tính lại theo diễn biến trận (live)',
    en: 'Live game-state recalculation',
  },
  'probMovement.reasonRecalc': {
    vi: 'Mô hình tính lại (dữ liệu hoặc engine cập nhật)',
    en: 'Model recalculation (data or engine refresh)',
  },
  'simulator.subtitleDetail': {
    vi: 'Thanh kịch bản — xem trước cục bộ; không thay mô hình chính thức',
    en: 'What-if sliders — local preview only; does not change the official model',
  },
  'simulator.preview': { vi: 'Xem trước', en: 'Preview' },
  'simulator.homeEdge': { vi: 'Ưu thế chủ nhà', en: 'Home edge' },
  'simulator.awayEdge': { vi: 'Ưu thế khách', en: 'Away edge' },
  'simulator.tempo': { vi: 'Nhịp độ / pressing', en: 'Tempo / pressing' },
  'probStrip.subtitle': {
    vi: 'Mô hình thống kê — kết quả 1×3',
    en: 'Statistical engine — 1×3 outcomes',
  },
  'probStrip.subtitleSim': {
    vi: 'Điều chỉnh mô phỏng phân tích',
    en: 'Analyst simulator adjustment',
  },
  'home.snapshot': { vi: 'Tổng quan World Cup 2026', en: 'World Cup 2026 snapshot' },
  'home.cohosts': { vi: 'Đồng chủ: ', en: 'Co-hosts: ' },
  'home.matches': { vi: 'Trận', en: 'Matches' },
  'home.groups': { vi: 'Bảng', en: 'Groups' },
  'home.teams': { vi: 'Đội', en: 'Teams' },
  'home.scheduled': { vi: 'Sắp đá', en: 'Scheduled' },
  'home.played': { vi: 'Đã đá', en: 'Played' },
  'home.quickStart': { vi: 'Lần đầu vào? Bắt đầu trong 4 bước', en: 'New here? Start in 4 steps' },
  'home.headlines': { vi: 'Tin nổi bật', en: 'Headlines' },
  'home.loadingHeadlines': { vi: 'Đang tải tin nổi bật…', en: 'Loading headlines…' },
  'home.newHere': { vi: 'Lần đầu vào? Bắt đầu trong 4 bước', en: 'New here? Start in 4 steps' },
  'guide.title': { vi: 'Hướng dẫn PitchIntel', en: 'PitchIntel guide' },
  'guide.quickStart': { vi: 'Bắt đầu nhanh', en: 'Quick start' },
  'guide.newUsers': { vi: 'Người dùng mới thường cần gì?', en: 'What new users often need' },
  'guide.newUsersBody': {
    vi: 'Lịch 104 trận, xác suất mô hình, đối đầu, tin RSS và (khi có) tín hiệu thị trường so với mô hình.',
    en: '104-match schedule, model probabilities, H2H, RSS news, and (when available) model vs market signals.',
  },
  'guide.newUsersBrainstorm': {
    vi: 'Danh sách brainstorming — đang bổ sung dần trên sản phẩm.',
    en: 'Brainstorm checklist — we are gradually shipping these.',
  },
  'match.fullArticle': { vi: 'Bài phân tích đầy đủ →', en: 'Full article →' },
  'match.guideTitle': { vi: 'Cách đọc trang trận này', en: 'How to read this match page' },
  'match.guideIntro': {
    vi: 'Trang này gộp xác suất mô hình, phân tích trước trận, ma trận tỉ số và (nếu có) tín hiệu thị trường.',
    en: 'This page combines model probability, match preview, scoreline matrix, and market signals when available.',
  },
  'match.guideStrip': { vi: 'Dải trên: thắng/hòa/thua + xG', en: 'Strip: win/draw/away + expected goals' },
  'match.guidePreview': { vi: 'Khối phân tích: đội hình, phong độ, bối cảnh bảng', en: 'Preview: lineups, form, group context' },
  'match.guideMatrix': { vi: 'Ma trận tỉ số & đối đầu khi có dữ liệu', en: 'Matrix & H2H when data exists' },
  'match.guideGlossary': { vi: 'Thuật ngữ đầy đủ →', en: 'Full glossary →' },
  'match.guideProbNote': {
    vi: 'Xác suất H/D/A và xG từ mô hình nội bộ — không phải tỷ lệ nhà cái. Phân tích trước trận riêng cho trận này.',
    en: 'Probabilities (H/D/A) and xG come from our model — not bookmaker odds. Pre-match analysis is unique to this fixture.',
  },
  'common.liveLabel': { vi: 'Trực tiếp', en: 'Live' },
  'match.topScores': { vi: 'Tỉ số ML', en: 'Top scores' },
  'matchAnalysis.back': { vi: 'Bảng chiến thuật', en: 'Tactical dashboard' },
  'matchAnalysis.groupTitle': { vi: 'Bảng {group}: {versus}', en: 'Group {group}: {versus}' },
  'matchAnalysis.stageTitle': { vi: '{stage}: {versus}', en: '{stage}: {versus}' },
  'matchAnalysis.title': { vi: 'Phân tích chiến thuật đầy đủ', en: 'Full tactical analysis' },
  'matchAnalysis.subtitle': {
    vi: 'Hệ thống đội, kịch bản, tín hiệu thị trường và biến động xác suất.',
    en: 'Team systems, scenarios, market signals, and probability movement.',
  },
  'matchAnalysis.modelProb': { vi: 'Xác suất mô hình', en: 'Model probability' },
  'matchAnalysis.marketNote': {
    vi: 'So sánh mô hình vs thị trường (nếu có odds) chỉ để tham khảo phân tích.',
    en: 'Model vs market comparison (when odds exist) is for analytical reference only.',
  },
  'pitch.title': { vi: 'Sơ đồ sân', en: 'Pitch map' },
  'pitch.subtitle': { vi: 'Vị trí sự kiện & vector di chuyển', en: 'Event locations & movement vectors' },
  'pitch.home': { vi: 'CHỦ', en: 'HOME' },
  'pitch.away': { vi: 'KHÁCH', en: 'AWAY' },
  'simulator.title': { vi: 'Mô phỏng phân tích', en: 'Analyst simulator' },
  'simulator.subtitle': {
    vi: 'Điều chỉnh biến chiến thuật để xem ảnh hưởng lên xác suất (chỉ mô phỏng).',
    en: 'Adjust tactical variables to see probability impact (simulation only).',
  },
  'simulator.reset': { vi: 'Đặt lại kịch bản', en: 'Reset scenario' },
  'simulator.scenarioOutput': { vi: 'Kết quả kịch bản', en: 'Scenario output' },
  'simulator.winProb': { vi: 'Xác suất thắng', en: 'Win probability' },
  'editorial.mode': { vi: 'Chế độ đọc', en: 'Editorial mode' },
  'editorial.takeaways': { vi: 'Điểm chính', en: 'Key takeaways' },
  'editorial.context': { vi: 'Ngữ cảnh trận', en: 'Match context' },
  'featured.modelNow': { vi: 'Mô hình hiện tại', en: 'Model now' },
  'featured.probLoading': { vi: 'Đang tải xác suất…', en: 'Probability loading…' },
  'wc.title': { vi: 'World Cup 2026', en: 'FIFA World Cup 2026' },
  'wc.underway': { vi: 'Giải đấu đã bắt đầu', en: 'Tournament underway' },
  'wc.countdownTo': { vi: 'Đếm ngược tới World Cup 2026', en: 'Countdown to FIFA World Cup 2026' },
  'multiVar.loading': { vi: 'Đang phân tích đa biến…', en: 'Running multi-variable analysis…' },
  'history.moreMeetings': {
    vi: 'Các trận đã kết thúc giữa hai đội tại WC 2026.',
    en: 'Completed meetings between these teams at WC 2026.',
  },
  'calendar.filterAll': { vi: 'Tất cả', en: 'All' },
  'calendar.filterGroup': { vi: 'Vòng bảng', en: 'Group' },
  'calendar.filterKnockout': { vi: 'Knock-out', en: 'Knockout' },
  'calendar.filterLive': { vi: 'Đang diễn ra', en: 'Live' },
  'calendar.filterScheduled': { vi: 'Sắp đá', en: 'Scheduled' },
  'calendar.filterCompleted': { vi: 'Đã xong', en: 'Completed' },
  'calendar.showing': { vi: 'Hiển thị {n} / {total} trận', en: 'Showing {n} of {total} matches' },
  'calendar.countLabel': {
    vi: '{n} / {total} trận · World Cup 2026',
    en: '{n} of {total} matches · World Cup 2026',
  },
  'calendar.seedLabel': {
    vi: 'Dữ liệu lịch: {n}/{total} trận',
    en: 'Schedule seed: {n}/{total} matches loaded',
  },
  'calendar.groupLabel': { vi: 'Bảng', en: 'Group' },
  'home.newUserHint': { vi: 'Lần đầu? Xem', en: 'New? See the' },
  'home.newUserHintLink': { vi: 'hướng dẫn', en: 'guide' },
  'home.newUserHintTail': { vi: 'hoặc làm theo 4 bước bên dưới.', en: 'or follow the 4 steps below.' },
  'tournaments.teams': { vi: 'đội', en: 'teams' },
  'tournaments.viewSchedule': { vi: 'Xem lịch 104 trận →', en: 'View 104-match schedule →' },
  'tournaments.viewFinal': { vi: 'Xem trận chung kết →', en: 'View final match →' },
  'matchAnalysis.articleSubtitle': {
    vi: 'Bài phân tích dài — xác suất mô hình, hệ thống đội, kịch bản và so sánh thị trường (nếu có).',
    en: 'Long-form analysis — model probability, team systems, scenarios, and market comparison when available.',
  },
  'matchAnalysis.scoreline': {
    vi: 'Tỉ số ML {score} — {h} {hp} / {d} {dp} / {a} {ap}.',
    en: 'Most likely scoreline {score} — {h} {hp} / {d} {dp} / {a} {ap}.',
  },
  'matchAnalysis.notFound': { vi: 'Không tìm thấy trận.', en: 'Match not found.' },
  'matchAnalysis.notFoundBack': { vi: 'Quay lại', en: 'Back' },
  'match.briefingAiSubtitle': {
    vi: 'Lớp AI — số liệu mô hình là chuẩn',
    en: 'AI layer — stats lead',
  },
  'matchHeader.matchLabel': { vi: 'TRẬN ĐẤU', en: 'MATCH' },
  'news.pagination': { vi: 'Phân trang tin', en: 'News pagination' },
  'countdown.day': { vi: 'n', en: 'd' },
  'countdown.hour': { vi: 'g', en: 'h' },
  'countdown.min': { vi: 'p', en: 'm' },
  'countdown.sec': { vi: 's', en: 's' },
  'matrix.title': { vi: 'Ma trận tỉ số', en: 'Scoreline matrix' },
  'matrix.subtitle': { vi: 'Khối lượng tỉ số chính xác hàng đầu', en: 'Top exact-score masses' },
  'multiVar.title': { vi: 'Phân tích đa biến', en: 'Multi-variable' },
  'multiVar.subtitle': { vi: 'Lớp suy luận AI', en: 'AI reasoning layer' },
  'multiVar.analysisHeading': { vi: 'Phân tích', en: 'Analysis' },
  'player.title': { vi: 'Ảnh hưởng cầu thủ', en: 'Player impact' },
  'player.subtitle': { vi: 'Cầu thủ then chốt trận này', en: 'Key contributors this match' },
  'contribution.subtitle': { vi: 'Tỷ trọng theo giai đoạn chiến thuật', en: 'Radial share by tactical phase' },
  'source.title': { vi: 'Độ tin cậy nguồn', en: 'Source confidence' },
  'source.subtitle': { vi: 'Minh bạch cho người dùng', en: 'Transparency for retention' },
  'history.avgGoals': {
    vi: 'Bàn TB: {home} – {away} ({n} trận)',
    en: 'Avg goals: {home} – {away} ({n} matches)',
  },
  'lang.label': { vi: 'Ngôn ngữ', en: 'Language' },
  'viewMode.label': { vi: 'Chế độ xem', en: 'View mode' },
  'wc.days': { vi: 'Ngày', en: 'Days' },
  'wc.hours': { vi: 'Giờ', en: 'Hours' },
  'wc.mins': { vi: 'Phút', en: 'Mins' },
  'wc.secs': { vi: 'Giây', en: 'Secs' },
  'contribution.title': { vi: 'Cơ cấu đóng góp đội', en: 'Team contribution mix' },
  'contribution.pressing': { vi: 'Ép sân', en: 'Pressing' },
  'contribution.chanceCreation': { vi: 'Kiến tạo', en: 'Chance creation' },
  'contribution.finishing': { vi: 'Dứt điểm', en: 'Finishing' },
  'contribution.defensive': { vi: 'Phòng ngự', en: 'Defensive' },
  'contribution.transition': { vi: 'Chuyển tiếp', en: 'Transition' },
  'contribution.mixCenter': { vi: 'TỔNG', en: 'MIX' },
  'source.tierOfficial': { vi: 'Chính thức', en: 'Official' },
  'source.tierTrusted': { vi: 'Tin cậy', en: 'Trusted' },
  'source.tierReview': { vi: 'Cần xem lại', en: 'Review' },
  'source.platformBriefing': {
    vi: 'PitchIntel — Phân tích từ mô hình thống kê',
    en: 'PitchIntel — Statistical model preview',
  },
  'team.wcH2hTitle': {
    vi: 'Đối đầu tại World Cup',
    en: 'World Cup head-to-head',
  },
  'team.wcH2hSubtitle': {
    vi: '{team} — {n} trận tại các kỳ World Cup trước',
    en: '{team} — {n} meetings at past World Cups',
  },
  'team.wcH2hEmpty': {
    vi: 'Chưa có dữ liệu đối đầu World Cup cho đội này.',
    en: 'No World Cup head-to-head data for this team yet.',
  },
  'team.wcH2hRecord': {
    vi: 'Thắng {w} · Hòa {d} · Thua {l} · BT {gf}–{ga}',
    en: 'W {w} · D {d} · L {l} · GF {gf}–{ga}',
  },
  'team.wcH2hMeetings': { vi: 'trận', en: 'matches' },
  'history.stageR32': { vi: 'Vòng 1/16', en: 'Round of 32' },
  'history.stageR16': { vi: 'Vòng 1/8', en: 'Round of 16' },
  'history.stageQf': { vi: 'Tứ kết', en: 'Quarter-final' },
  'history.stageSf': { vi: 'Bán kết', en: 'Semi-final' },
  'history.stageThird': { vi: 'Tranh hạng 3', en: 'Third place' },
  'history.stageFinal': { vi: 'Chung kết', en: 'Final' },
  'history.matchStage': { vi: 'Trận', en: 'Match' },
};
