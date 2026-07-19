export type LocaleKey =
  | 'nav.command'
  | 'nav.home'
  | 'nav.matches'
  | 'nav.tournaments'
  | 'nav.news'
  | 'nav.signals'
  | 'nav.probabilitySignals'
  | 'nav.guide'
  | 'nav.api'
  | 'matches.pageTitle'
  | 'matches.pageSubtitle'
  | 'matches.pageSubtitleCompact'
  | 'matches.hubSubtitle'
  | 'matches.hubNav'
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
  | 'news.impactAnalysis'
  | 'news.viewAffectedMatch'
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
  | 'match.score.half1'
  | 'match.score.half2'
  | 'match.score.stoppage'
  | 'match.score.extraTime'
  | 'match.score.extraTime1'
  | 'match.score.extraTime2'
  | 'match.score.penalties'
  | 'match.forecast.extraTime'
  | 'match.forecast.penalty'
  | 'match.forecast.extraTimeHint'
  | 'match.forecast.penaltyHint'
  | 'match.completed'
  | 'match.fullAnalysis'
  | 'match.notFound'
  | 'match.backSchedule'
  | 'match.thumbAlt'
  | 'match.metaDescription'
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
  | 'footer.privacy'
  | 'privacy.title'
  | 'privacy.effective'
  | 'privacy.intro'
  | 'privacy.disclaimer'
  | 'common.home'
  | 'common.draw'
  | 'common.win'
  | 'common.loss'
  | 'common.away'
  | 'common.abbrHome'
  | 'common.abbrDraw'
  | 'common.abbrAway'
  | 'common.tbd'
  | 'common.model'
  | 'dataKind.predicted'
  | 'dataKind.actual'
  | 'dataKind.simulated'
  | 'dataKind.legend'
  | 'dataKind.legendHint'
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
  | 'team.coach'
  | 'team.coachPending'
  | 'team.squadTitle'
  | 'team.squadSubtitle'
  | 'team.squadEmpty'
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
  | 'home.predictionAccuracy.title'
  | 'home.predictionAccuracy.subtitle'
  | 'home.predictionAccuracy.favoriteHit'
  | 'home.predictionAccuracy.scorelineHit'
  | 'home.predictionAccuracy.scorelineTop3Hit'
  | 'home.predictionAccuracy.avgActualScoreProb'
  | 'home.predictionAccuracy.avgBrier'
  | 'home.predictionAccuracy.evaluated'
  | 'home.predictionAccuracy.upcomingTitle'
  | 'home.predictionAccuracy.upcomingCoverage'
  | 'home.predictionAccuracy.disclaimer'
  | 'home.cohosts'
  | 'home.matches'
  | 'home.groups'
  | 'home.teams'
  | 'home.scheduled'
  | 'home.played'
  | 'home.championOdds.title'
  | 'home.championOdds.titleDecided'
  | 'home.championOdds.subtitle'
  | 'home.championOdds.subtitleFinal'
  | 'home.championOdds.subtitleDecided'
  | 'home.championOdds.championBadge'
  | 'home.championOdds.simulations'
  | 'home.championOdds.disclaimer'
  | 'home.topScorers.title'
  | 'home.topScorers.subtitle'
  | 'home.topScorers.empty'
  | 'home.quickStart'
  | 'home.headlines'
  | 'home.loadingHeadlines'
  | 'home.upcomingTitle'
  | 'home.upcomingSubtitle'
  | 'home.viewFullBoard'
  | 'home.moreInsights'
  | 'home.exploreSchedule'
  | 'home.exploreStandings'
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
  | 'lineups.substitutes'
  | 'lineups.groupGK'
  | 'lineups.groupDEF'
  | 'lineups.groupMID'
  | 'lineups.groupFWD'
  | 'lineups.viewFull'
  | 'lineups.detailHint'
  | 'matchAnalysis.back'
  | 'matchAnalysis.title'
  | 'matchAnalysis.subtitle'
  | 'matchAnalysis.modelProb'
  | 'matchAnalysis.marketNote'
  | 'pitch.title'
  | 'pitch.subtitle'
  | 'pitch.subtitleLineup'
  | 'pitch.loading'
  | 'pitch.unavailable'
  | 'pitch.minute'
  | 'pitch.ratingsNote'
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
  | 'featured.sectionLive'
  | 'featured.sectionUpcoming'
  | 'wc.title'
  | 'wc.underway'
  | 'wc.countdownTo'
  | 'wc.progress'
  | 'wc.liveNow'
  | 'wc.nextUp'
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
  | 'calendar.addGoogle'
  | 'calendar.downloadAll'
  | 'calendar.downloadOne'
  | 'calendar.syncHint'
  | 'schedule.hubTitle'
  | 'schedule.viewGrid'
  | 'schedule.viewList'
  | 'schedule.timezoneBannerGmt7'
  | 'schedule.localReference'
  | 'schedule.localTimeShort'
  | 'favorites.tab'
  | 'favorites.title'
  | 'favorites.subtitle'
  | 'favorites.matchesTab'
  | 'favorites.teamsTab'
  | 'favorites.noMatches'
  | 'favorites.noTeams'
  | 'favorites.teamFixtures'
  | 'favorites.add'
  | 'favorites.remove'
  | 'teams.tab'
  | 'teams.directoryTitle'
  | 'teams.directorySubtitle'
  | 'teams.searchPlaceholder'
  | 'groupBoard.title'
  | 'groupBoard.tabGroup'
  | 'groupBoard.tabKnockout'
  | 'groupBoard.knockoutEmpty'
  | 'groupBoard.subtitle'
  | 'groupBoard.loading'
  | 'groupBoard.probHint'
  | 'groupBoard.standingsHint'
  | 'groupBoard.knockoutTitle'
  | 'groupBoard.knockoutSubtitle'
  | 'groupBoard.knockoutLocked'
  | 'groupBoard.openAnalysis'
  | 'groupBoard.legendTitle'
  | 'groupBoard.legendQualified'
  | 'groupBoard.legendThird'
  | 'groupBoard.legendForecast'
  | 'compactProb.noAnalysis'
  | 'compactProb.noAnalysisTitle'
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
  | 'match.recentWcTitle'
  | 'match.recentWcHint'
  | 'match.recentWcEmpty'
  | 'match.recentWcHome'
  | 'match.recentWcAway'
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
  | 'history.matchStage'
  | 'match.tabOverview'
  | 'match.tabStats'
  | 'match.tabPrediction'
  | 'match.tabMomentum'
  | 'match.tabTactical'
  | 'match.tabScenarios'
  | 'match.sectionNav'
  | 'common.lastUpdated'
  | 'stats.title'
  | 'stats.subtitle'
  | 'stats.subtitleLive'
  | 'stats.loading'
  | 'stats.unavailable'
  | 'stats.officialSource'
  | 'recap.title'
  | 'recap.subtitle'
  | 'recap.loading'
  | 'recap.commentary'
  | 'recap.playerStats'
  | 'recap.sourceFifa'
  | 'staff.title'
  | 'staff.subtitle'
  | 'staff.loading'
  | 'staff.referee'
  | 'staff.assistants'
  | 'staff.nationality'
  | 'staff.wcApps'
  | 'staff.tenure'
  | 'staff.years'
  | 'staff.strictness'
  | 'staff.modelNote'
  | 'staff.role.fourth_official'
  | 'staff.role.var'
  | 'stats.possession'
  | 'stats.shots'
  | 'stats.shotsOnTarget'
  | 'stats.xg'
  | 'stats.passes'
  | 'stats.passAccuracy'
  | 'stats.cards'
  | 'stats.subs'
  | 'prediction.summaryTitle'
  | 'prediction.summarySubtitle'
  | 'prediction.loading'
  | 'prediction.predictedScore'
  | 'prediction.actualScore'
  | 'prediction.liveScore'
  | 'prediction.scoreMatch'
  | 'prediction.scoreDiff'
  | 'prediction.homeWin'
  | 'prediction.draw'
  | 'prediction.awayWin'
  | 'prediction.modelConfidence'
  | 'prediction.modelVersion'
  | 'prediction.drivers'
  | 'prediction.xgNote'
  | 'analytics.title'
  | 'analytics.subtitle'
  | 'analytics.loading'
  | 'analytics.unavailable'
  | 'analytics.momentum'
  | 'analytics.pressure'
  | 'analytics.turningPoint'
  | 'analytics.turningYes'
  | 'analytics.turningNo'
  | 'analytics.turningHint'
  | 'analytics.pressureHint'
  | 'analytics.momentumHome'
  | 'analytics.momentumAway'
  | 'analytics.momentumBalanced'
  | 'analytics.movementNote'
  | 'analytics.updates'
  | 'analytics.estimateNote'
  | 'seo.brandLine'
  | 'seo.footerNote';

export const messages: Record<LocaleKey, { vi: string; en: string }> = {
  'nav.command': { vi: 'Trung tâm', en: 'Command' },
  'nav.home': { vi: 'Trang chủ', en: 'Home' },
  'nav.matches': { vi: 'Trận đấu', en: 'Matches' },
  'nav.tournaments': { vi: 'Giải đấu', en: 'Tournaments' },
  'nav.news': { vi: 'Tin tức', en: 'News' },
  'nav.signals': { vi: 'Tín hiệu', en: 'Signals' },
  'nav.probabilitySignals': { vi: 'Biến động dự đoán', en: 'Forecast shifts' },
  'nav.guide': { vi: 'Hướng dẫn', en: 'Guide' },
  'nav.api': { vi: 'API', en: 'API' },
  'matches.pageTitle': { vi: 'Lịch thi đấu', en: 'Match schedule' },
  'matches.pageSubtitle': {
    vi: 'Trận đang diễn ra hoặc sắp đá ở trên — toàn bộ lịch World Cup 2026 bên dưới.',
    en: 'Live or next-up match on top — full World Cup 2026 schedule below.',
  },
  'matches.pageSubtitleCompact': {
    vi: '12 bảng · bảng xếp hạng và lịch từng bảng. Cột số là tỉ lệ C·H·K (%) — bấm trận để xem phân tích.',
    en: '12 groups · standings and fixtures per group. Numbers are H·D·A % — tap a match for analysis.',
  },
  'matches.hubSubtitle': {
    vi: 'Lịch trực quan · đồng bộ lịch · yêu thích trận/đội · bảng A–L · tra cứu đội tuyển.',
    en: 'Visual schedule · calendar sync · favorite matches & teams · groups A–L · team lookup.',
  },
  'matches.hubNav': { vi: 'Mục lịch World Cup', en: 'World Cup hub sections' },
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
  'bracket.title': { vi: 'Nhánh loại trực tiếp', en: 'Knockout bracket' },
  'bracket.subtitle': {
    vi: 'Vòng 1/16 → Chung kết — bấm trận để mở phân tích',
    en: 'Round of 32 → Final — tap a match for analysis',
  },
  'bracket.loading': { vi: 'Đang tải nhánh…', en: 'Loading bracket…' },
  'bracket.empty': { vi: 'Chưa có trận vòng loại trực tiếp.', en: 'No knockout matches yet.' },
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
    vi: 'Chưa có tin — chúng tôi cập nhật thường xuyên.',
    en: 'No articles yet — we add new stories regularly.',
  },
  'news.selectHint': {
    vi: 'Chọn một bài bên dưới để đọc ngay trên trang.',
    en: 'Pick an article below to read on this page.',
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
  'news.impactAnalysis': { vi: 'Phân tích tác động tới trận đấu', en: 'Match impact analysis' },
  'news.viewAffectedMatch': { vi: 'Xem trận', en: 'View match' },
  'news.articleLangLabel': { vi: 'Ngôn ngữ bài viết', en: 'Article language' },
  'home.title': { vi: 'Trung tâm Chiến thuật World Cup', en: 'World Cup Tactical Command' },
  'home.subtitle': {
    vi: 'Dữ liệu cập nhật mỗi phút. Dự đoán tính tự động. Tin mới mỗi 15 phút.',
    en: 'Data refreshes every minute. Predictions update automatically. News every 15 minutes.',
  },
  'home.badge': { vi: 'Chỉ xem · cập nhật tự động', en: 'View only · auto-updated' },
  'home.calendar': { vi: 'Lịch thi đấu', en: 'Match calendar' },
  'home.calendarTitle': {
    vi: 'Lịch thi đấu World Cup 2026',
    en: 'World Cup 2026 Match Schedule',
  },
  'home.calendarSubtitle': {
    vi: '12 bảng — bảng xếp hạng và lịch từng bảng. Số bên cạnh trận là tỉ lệ C·H·K; bấm trận khi cần phân tích.',
    en: '12 groups — standings and fixtures per group. Match numbers are H·D·A %; tap when you want analysis.',
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
  'home.pipeline': { vi: 'Trạng thái cập nhật dữ liệu', en: 'Data update status' },
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
  'match.recentWcTitle': {
    vi: '5 trận World Cup gần nhất',
    en: 'Last 5 World Cup matches',
  },
  'match.recentWcHint': {
    vi: 'Kết quả gần nhất của từng đội với các đối thủ khác tại các kỳ World Cup trước 2026.',
    en: 'Each team’s five most recent World Cup results against other opponents before 2026.',
  },
  'match.recentWcEmpty': {
    vi: 'Chưa có dữ liệu World Cup trước 2026.',
    en: 'No World Cup history before 2026.',
  },
  'match.recentWcHome': { vi: 'vs', en: 'vs' },
  'match.recentWcAway': { vi: '@', en: '@' },
  'match.hints': { vi: 'Gợi ý dự đoán', en: 'Prediction hints' },
  'match.hintsNote': {
    vi: 'Số liệu dự đoán của PitchIntel — chỉ để tham khảo, không phải lời khuyên cược.',
    en: 'PitchIntel forecast figures — for reference only, not betting advice.',
  },
  'match.probability': { vi: 'Dự đoán thắng/hòa/thua', en: 'Win/draw/loss forecast' },
  'match.confidence': { vi: 'Độ tin cậy', en: 'Confidence' },
  'match.home': { vi: 'Chủ nhà', en: 'Home' },
  'match.draw': { vi: 'Hòa', en: 'Draw' },
  'match.away': { vi: 'Khách', en: 'Away' },
  'match.live': { vi: 'Đang diễn ra', en: 'Live' },
  'match.scheduled': { vi: 'Sắp diễn ra', en: 'Scheduled' },
  'match.score.half1': { vi: 'H1', en: '1H' },
  'match.score.half2': { vi: 'H2', en: '2H' },
  'match.score.stoppage': { vi: 'Bù giờ', en: 'Added' },
  'match.score.extraTime': { vi: 'HP', en: 'ET' },
  'match.score.extraTime1': { vi: 'HP1', en: 'ET1' },
  'match.score.extraTime2': { vi: 'HP2', en: 'ET2' },
  'match.score.penalties': { vi: 'Pen', en: 'Pens' },
  'match.forecast.extraTime': { vi: 'HP ~{pct}', en: 'ET ~{pct}' },
  'match.forecast.penalty': { vi: 'Pen ~{pct}', en: 'Pens ~{pct}' },
  'match.forecast.extraTimeHint': {
    vi: 'Dự đoán: trận có thể kéo dài hiệp phụ',
    en: 'Forecast: match may go to extra time',
  },
  'match.forecast.penaltyHint': {
    vi: 'Dự đoán: trận có thể đến loạt penalty',
    en: 'Forecast: match may go to penalties',
  },
  'match.completed': { vi: 'Đã kết thúc', en: 'Completed' },
  'match.fullAnalysis': { vi: 'Phân tích chiến thuật đầy đủ', en: 'Full tactical analysis' },
  'match.notFound': {
    vi: 'Không tìm thấy trận đấu này.',
    en: 'This match could not be found.',
  },
  'match.backSchedule': { vi: 'Lịch thi đấu', en: 'Match schedule' },
  'match.thumbAlt': { vi: '{home} vs {away}', en: '{home} vs {away}' },
  'match.metaDescription': {
    vi: 'Phân tích {home} gặp {away} — dự đoán, thống kê và góc chiến thuật World Cup 2026.',
    en: '{home} vs {away} — predictions, stats, and tactical analysis for World Cup 2026.',
  },
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
  'lineups.substitutes': { vi: 'Dự bị', en: 'Substitutes' },
  'lineups.groupGK': { vi: 'Thủ môn', en: 'Goalkeepers' },
  'lineups.groupDEF': { vi: 'Hậu vệ', en: 'Defenders' },
  'lineups.groupMID': { vi: 'Tiền vệ', en: 'Midfielders' },
  'lineups.groupFWD': { vi: 'Tiền đạo', en: 'Forwards' },
  'lineups.viewFull': { vi: 'Xem đội hình đầy đủ', en: 'Full lineup page' },
  'lineups.detailHint': {
    vi: 'Ra sân theo vị trí · nguồn: chính thức / danh sách đội / dự kiến',
    en: 'Grouped by position · source: official / squad / projected',
  },
  'match.previewForm': { vi: 'Phong độ', en: 'Form' },
  'match.previewContext': { vi: 'Bối cảnh giải', en: 'Tournament context' },
  'match.previewTactical': { vi: 'Góc chiến thuật', en: 'Tactical angle' },
  'match.previewLoading': { vi: 'Đang tạo phân tích riêng cho trận này…', en: 'Building match-specific analysis…' },
  'match.briefingTitle': { vi: 'Phân tích chiến thuật', en: 'Tactical briefing' },
  'match.briefingLoading': { vi: 'Đang tải phân tích chiến thuật…', en: 'Loading tactical briefing…' },
  'match.briefingTakeaways': { vi: 'Điểm chính', en: 'Key takeaways' },
  'tournaments.title': { vi: 'Giải đấu', en: 'Tournaments' },
  'tournaments.subtitle': {
    vi: 'Các kỳ World Cup từ 2006 — World Cup 2026 có đầy đủ lịch 104 trận.',
    en: 'World Cups from 2006 — WC 2026 has the full 104-match schedule.',
  },
  'tournaments.hubTitle': { vi: 'World Cup (từ 2006)', en: 'World Cups (2006+)' },
  'status.syncing': { vi: 'Đang đồng bộ…', en: 'Syncing…' },
  'footer.tagline': { vi: 'Tình báo chiến thuật bóng đá', en: 'Football tactical intelligence' },
  'footer.description': {
    vi: 'Dự đoán trận đấu, góc chiến thuật và tin World Cup đã lọc.',
    en: 'Match predictions, tactical angles, and curated World Cup news.',
  },
  'footer.analytics': { vi: 'Phân tích', en: 'Analytics' },
  'footer.builtBy': { vi: 'Xây dựng bởi', en: 'Built by' },
  'footer.github': { vi: 'GitHub', en: 'GitHub' },
  'footer.privacy': { vi: 'Chính sách quyền riêng tư', en: 'Privacy policy' },
  'privacy.title': { vi: 'Chính sách quyền riêng tư', en: 'Privacy policy' },
  'privacy.effective': { vi: 'Có hiệu lực', en: 'Effective' },
  'privacy.intro': {
    vi: 'Chính sách này mô tả cách PitchIntel xử lý thông tin khi bạn dùng ứng dụng di động hoặc website. URL công khai cho cửa hàng ứng dụng: https://wcstat.orangecloud.vn/privacy',
    en: 'This policy describes how PitchIntel handles information when you use the mobile apps or website. Public URL for app stores: https://wcstat.orangecloud.vn/privacy',
  },
  'privacy.disclaimer': {
    vi: 'Xác suất và tín hiệu thị trường chỉ mang tính phân tích — không phải lời khuyên cá cược. PitchIntel không phải nhà cái và không xử lý tiền cược.',
    en: 'Probabilities and market signals are analytical context only — not betting advice. PitchIntel is not a bookmaker and does not handle wagers.',
  },
  'common.home': { vi: 'Chủ nhà', en: 'Home' },
  'common.draw': { vi: 'Hòa', en: 'Draw' },
  'common.win': { vi: 'Thắng', en: 'Win' },
  'common.loss': { vi: 'Thua', en: 'Loss' },
  'common.away': { vi: 'Khách', en: 'Away' },
  'common.abbrHome': { vi: 'C', en: 'H' },
  'common.abbrDraw': { vi: 'H', en: 'D' },
  'common.abbrAway': { vi: 'K', en: 'A' },
  'common.tbd': { vi: 'Chưa xác định', en: 'TBD' },
  'common.model': { vi: 'Dự đoán', en: 'Forecast' },
  'dataKind.predicted': { vi: 'Dự đoán', en: 'Forecast' },
  'dataKind.actual': { vi: 'Thực tế', en: 'Actual' },
  'dataKind.simulated': { vi: 'Giả lập', en: 'Simulated' },
  'dataKind.legend': {
    vi: 'Dự đoán · ● Thực tế · ≈ Giả lập',
    en: 'Forecast · ● Actual · ≈ Simulated',
  },
  'dataKind.legendHint': {
    vi: 'Phân biệt số dự đoán với số liệu trận đấu thật.',
    en: 'Symbols distinguish forecasts from official match data.',
  },
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
  'market.title': { vi: 'Dự đoán vs thị trường', en: 'Forecast vs market' },
  'market.subtitle': {
    vi: 'So sánh dự đoán PitchIntel với tỷ lệ cược chung — chỉ để tham khảo.',
    en: 'PitchIntel forecast vs common betting odds — reference only.',
  },
  'market.disclaimer': {
    vi: 'Không phải lời khuyên đặt cược.',
    en: 'Not betting advice.',
  },
  'market.loading': { vi: 'Đang tải dữ liệu so sánh…', en: 'Loading comparison data…' },
  'market.empty': {
    vi: 'Chưa có tỷ lệ cược để so sánh — sẽ bổ sung khi có dữ liệu.',
    en: 'No betting odds to compare yet — will appear when data is available.',
  },
  'market.volatility': { vi: 'Biến động tỷ lệ cược', en: 'Odds movement' },
  'market.chartTitle': { vi: 'Dự đoán vs thị trường', en: 'Forecast vs market' },
  'team.title': { vi: 'Phong cách chơi của đội', en: 'How the team plays' },
  'team.subtitle': {
    vi: 'Nhìn đội bóng như một tập thể — không chỉ cộng sức mạnh từng cầu thủ.',
    en: 'See the team as a unit — not just a sum of individual players.',
  },
  'team.loading': { vi: 'Đang tải hệ thống đội…', en: 'Loading team systems…' },
  'team.empty': {
    vi: 'Sẽ hiện sau khi PitchIntel phân tích trận này.',
    en: 'Appears after PitchIntel analyzes this match.',
  },
  'team.fifaRank': { vi: 'Hạng FIFA', en: 'FIFA rank' },
  'team.elo': { vi: 'Elo', en: 'Elo' },
  'team.coach': { vi: 'HLV', en: 'Head coach' },
  'team.coachPending': { vi: 'Đang cập nhật', en: 'To be updated' },
  'team.squadTitle': { vi: 'Đội hình triệu tập', en: 'Squad list' },
  'team.squadSubtitle': {
    vi: 'Danh sách cầu thủ chính thức tại World Cup 2026 (nếu đã có dữ liệu).',
    en: 'Official World Cup 2026 squad when available.',
  },
  'team.squadEmpty': {
    vi: 'Chưa có danh sách triệu tập — sẽ cập nhật khi có công bố chính thức.',
    en: 'Squad not published yet — will update when official lists are available.',
  },
  'scenario.title': { vi: 'Kịch bản có thể xảy ra', en: 'Possible scenarios' },
  'scenario.loading': { vi: 'Đang tải kịch bản…', en: 'Loading scenarios…' },
  'scenario.empty': {
    vi: 'Sẽ hiện sau khi PitchIntel tính lại dự đoán.',
    en: 'Appears after PitchIntel refreshes the forecast.',
  },
  'scenario.confidence': { vi: 'Độ tin cậy', en: 'Confidence' },
  'scenario.predictionTitle': { vi: 'Dự đoán theo kịch bản', en: 'Scenario predictions' },
  'scenario.predictionSubtitle': {
    vi: 'Các kịch bản có thể xảy ra — chỉ để tham khảo, không phải lời khuyên cược.',
    en: 'Possible match paths — reference only, not betting advice.',
  },
  'scenario.pathA': { vi: 'Kịch bản A', en: 'Scenario A' },
  'scenario.pathB': { vi: 'Kịch bản B', en: 'Scenario B' },
  'scenario.comparisonToggle': { vi: 'So sánh kịch bản', en: 'Scenario comparison' },
  'scenario.likelihoodLabel': { vi: 'Khả năng xảy ra', en: 'Likelihood' },
  'scenario.modelConfidence': { vi: 'Mức tin vào dự đoán', en: 'Forecast confidence' },
  'scenario.initialConditions': { vi: 'Điều kiện ban đầu', en: 'Initial conditions' },
  'scenario.triggers': { vi: 'Điều kiện kích hoạt', en: 'Triggers' },
  'scenario.invalidation': { vi: 'Điều kiện vô hiệu', en: 'Invalidation' },
  'scenario.mostLikelyScore': { vi: 'Tỉ số khả dĩ nhất', en: 'Most likely score' },
  'scenario.comparisonTitle': { vi: 'So sánh kịch bản', en: 'Scenario comparison' },
  'scenario.likelihoodGap': { vi: 'Chênh khả năng giữa hai kịch bản', en: 'Likelihood gap' },
  'scenario.awayWinDelta': { vi: 'Chênh thắng khách', en: 'Away win delta' },
  'scenario.lastUpdated': { vi: 'Cập nhật lúc', en: 'Last updated' },
  'scenario.legacyDisclaimer': {
    vi: 'Đây là ước lượng phân tích — không phải dự đoán chắc chắn.',
    en: 'These are analytical estimates — not guaranteed outcomes.',
  },
  'analysis.twoScenarios': {
    vi: 'Hai kịch bản trận đấu quan trọng nhất',
    en: 'Two most important match scenarios',
  },
  'probMovement.title': { vi: 'Dự đoán thay đổi thế nào', en: 'How the forecast changed' },
  'probMovement.subtitle': {
    vi: 'Dự đoán thay đổi thế nào theo thời gian.',
    en: 'How the forecast changed over time.',
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
    vi: 'Mỗi lần PitchIntel cập nhật dự đoán — chỉ để tham khảo.',
    en: 'Each time PitchIntel refreshed the forecast — reference only.',
  },
  'probMovement.intervalEmpty': {
    vi: 'Phân bổ theo hiệp sẽ hiện sau khi có dự đoán cho trận này.',
    en: 'Half-by-half breakdown appears once a forecast is available.',
  },
  'probMovement.trendRising': {
    vi: 'Dự đoán thắng chủ nhà tăng dần theo hiệp',
    en: 'Home win forecast rising through phases',
  },
  'probMovement.trendAway': {
    vi: 'Đội khách được dự đoán có lợi thế hơn',
    en: 'Away side gaining through phases',
  },
  'probMovement.trendBalanced': {
    vi: 'Cân bằng — khối hòa ổn định giữa trận',
    en: 'Balanced — draw mass stable mid-game',
  },
  'probMovement.footerNote': {
    vi: 'Mỗi thanh cho thấy tỉ lệ thắng/hòa/thua theo từng giai đoạn trận.',
    en: 'Each bar shows win/draw/loss shares by match phase.',
  },
  'probMovement.explain': {
    vi: 'Theo dõi khi nào dự đoán thắng/hòa/thua thay đổi — không phải tỷ lệ nhà cái.',
    en: 'Tracks when win/draw/loss forecasts change — not bookmaker odds.',
  },
  'probMovement.stable': {
    vi: 'Dự đoán ổn định — chưa có thay đổi đáng kể.',
    en: 'Forecast is stable — no meaningful shifts yet.',
  },
  'probMovement.baseline': { vi: 'Mốc ban đầu', en: 'Baseline' },
  'probMovement.update': { vi: 'Cập nhật {n}', en: 'Update {n}' },
  'probMovement.reasonBaseline': {
    vi: 'Dự đoán trước trận',
    en: 'Pre-match forecast',
  },
  'probMovement.reasonLive': {
    vi: 'Tính lại theo diễn biến trận (trực tiếp)',
    en: 'Live game-state recalculation',
  },
  'probMovement.reasonRecalc': {
    vi: 'Tính lại khi có dữ liệu mới',
    en: 'Recalculated with new data',
  },
  'simulator.subtitleDetail': {
    vi: 'Kéo thanh để thử kịch bản — chỉ xem trước, không đổi dự đoán chính.',
    en: 'Slide to try what-if scenarios — preview only, does not change the main forecast.',
  },
  'simulator.preview': { vi: 'Xem trước', en: 'Preview' },
  'simulator.homeEdge': { vi: 'Ưu thế chủ nhà', en: 'Home edge' },
  'simulator.awayEdge': { vi: 'Ưu thế khách', en: 'Away edge' },
  'simulator.tempo': { vi: 'Nhịp độ / pressing', en: 'Tempo / pressing' },
  'probStrip.subtitle': {
    vi: 'Dự đoán thắng / hòa / thua',
    en: 'Win / draw / loss forecast',
  },
  'probStrip.subtitleSim': {
    vi: 'Điều chỉnh mô phỏng phân tích',
    en: 'Analyst simulator adjustment',
  },
  'home.snapshot': { vi: 'Tổng quan World Cup 2026', en: 'World Cup 2026 overview' },
  'home.predictionAccuracy.title': {
    vi: 'Dự đoán của chúng ta đến giờ',
    en: 'How our picks have done so far',
  },
  'home.predictionAccuracy.subtitle': {
    vi: 'Dự đoán trước trận có khớp với kết quả thật không?',
    en: 'How our pre-match picks matched what actually happened.',
  },
  'home.predictionAccuracy.favoriteHit': {
    vi: 'Đoán đúng đội được ưu tiên · {n}/{total}',
    en: 'Picked the favorite correctly · {n}/{total}',
  },
  'home.predictionAccuracy.scorelineHit': {
    vi: 'Trùng tỉ số dự đoán',
    en: 'Matched the top predicted score',
  },
  'home.predictionAccuracy.scorelineTop3Hit': {
    vi: 'Tỉ số thật nằm trong top 3',
    en: 'Actual score in top 3 picks',
  },
  'home.predictionAccuracy.avgActualScoreProb': {
    vi: 'Xác suất tỉ số thật (TB)',
    en: 'Avg prob. of actual score',
  },
  'home.predictionAccuracy.avgBrier': {
    vi: 'Brier trung bình (W/D/L)',
    en: 'Avg Brier (W/D/L)',
  },
  'home.predictionAccuracy.evaluated': {
    vi: 'Trận đã có kết quả',
    en: 'Finished matches checked',
  },
  'home.predictionAccuracy.upcomingTitle': {
    vi: 'Trận tiếp theo',
    en: 'Upcoming fixtures',
  },
  'home.predictionAccuracy.upcomingCoverage': {
    vi: '{with}/{total} trận sắp đá đã có dự đoán',
    en: '{with}/{total} upcoming matches with a forecast',
  },
  'home.predictionAccuracy.disclaimer': {
    vi: 'Đội được ưu tiên = ai có khả năng thắng cao nhất trước trận. Không phải lời khuyên cược.',
    en: 'Favorite = team most likely to win before kickoff. Not betting advice.',
  },
  'home.cohosts': { vi: 'Đồng chủ: ', en: 'Co-hosts: ' },
  'home.matches': { vi: 'Trận', en: 'Matches' },
  'home.groups': { vi: 'Bảng', en: 'Groups' },
  'home.teams': { vi: 'Đội', en: 'Teams' },
  'home.scheduled': { vi: 'Sắp đá', en: 'Scheduled' },
  'home.played': { vi: 'Đã đá', en: 'Played' },
  'home.championOdds.title': {
    vi: 'Khả năng vô địch',
    en: 'Championship chances',
  },
  'home.championOdds.titleDecided': {
    vi: 'Đội vô địch',
    en: 'World Cup champion',
  },
  'home.championOdds.subtitle': {
    vi: 'Top 3 đội có khả năng vô địch cao nhất — cập nhật sau mỗi trận',
    en: 'Top 3 teams most likely to win — updated after each match',
  },
  'home.championOdds.subtitleFinal': {
    vi: 'Chỉ còn trận chung kết — xác suất thắng trực tiếp, cập nhật mỗi 5 phút',
    en: 'Final match set — head-to-head win chance, refreshed every 5 minutes',
  },
  'home.championOdds.subtitleDecided': {
    vi: 'Kết quả chung kết World Cup 2026',
    en: 'FIFA World Cup 2026 final result',
  },
  'home.championOdds.championBadge': {
    vi: 'Vô địch',
    en: 'Champion',
  },
  'home.championOdds.simulations': {
    vi: 'Cập nhật sau mỗi trận',
    en: 'Updated after each match',
  },
  'home.championOdds.disclaimer': {
    vi: 'Chỉ mang tính tham khảo — không phải dự đoán chính thức.',
    en: 'For reference only — not an official forecast.',
  },
  'home.topScorers.title': {
    vi: 'Vua phá lưới',
    en: 'Top scorers',
  },
  'home.topScorers.subtitle': {
    vi: 'Cầu thủ ghi nhiều bàn nhất tại World Cup 2026 (trận đã kết thúc)',
    en: 'Most goals at World Cup 2026 (completed matches)',
  },
  'home.topScorers.empty': {
    vi: 'Chưa có bàn thắng được ghi — bảng cập nhật sau mỗi trận FT.',
    en: 'No goals recorded yet — updates after each full-time result.',
  },
  'home.quickStart': { vi: 'Lần đầu vào? Bắt đầu trong 4 bước', en: 'New here? Start in 4 steps' },
  'home.headlines': { vi: 'Tin nổi bật', en: 'Headlines' },
  'home.upcomingTitle': { vi: 'Sắp diễn ra', en: 'Coming up' },
  'home.upcomingSubtitle': { vi: 'Trận live và trận sắp đá — chạm để xem chi tiết', en: 'Live and upcoming — tap for details' },
  'home.viewFullBoard': { vi: 'Xem đầy đủ bảng đấu →', en: 'View full tournament board →' },
  'home.moreInsights': { vi: 'Thêm số liệu & tin tức', en: 'More stats & news' },
  'home.exploreSchedule': { vi: 'Lịch thi đấu', en: 'Schedule' },
  'home.exploreStandings': { vi: 'Bảng xếp hạng', en: 'Standings' },
  'home.loadingHeadlines': { vi: 'Đang tải tin nổi bật…', en: 'Loading headlines…' },
  'home.newHere': { vi: 'Lần đầu vào? Bắt đầu trong 4 bước', en: 'New here? Start in 4 steps' },
  'guide.title': { vi: 'Hướng dẫn PitchIntel', en: 'PitchIntel guide' },
  'guide.quickStart': { vi: 'Bắt đầu nhanh', en: 'Quick start' },
  'guide.newUsers': { vi: 'Người dùng mới thường cần gì?', en: 'What new users often need' },
  'guide.newUsersBody': {
    vi: 'Lịch 104 trận, dự đoán thắng/hòa/thua, đối đầu, tin tức và (khi có) so sánh với tỷ lệ cược.',
    en: '104-match schedule, win/draw/loss forecasts, head-to-head, news, and odds comparison when available.',
  },
  'guide.newUsersBrainstorm': {
    vi: 'Danh sách tính năng — chúng tôi đang bổ sung dần.',
    en: 'Feature wishlist — we are adding these over time.',
  },
  'match.fullArticle': { vi: 'Bài phân tích đầy đủ →', en: 'Full article →' },
  'match.guideTitle': { vi: 'Cách đọc trang trận này', en: 'How to read this match page' },
  'match.guideIntro': {
    vi: 'Ở đây có dự đoán, phân tích trước trận, bảng tỉ số có thể xảy ra và (nếu có) so sánh với tỷ lệ cược.',
    en: 'Here you will find forecasts, pre-match analysis, likely scorelines, and odds comparison when available.',
  },
  'match.guideStrip': { vi: 'Dải trên: thắng/hòa/thua + xG', en: 'Strip: win/draw/away + expected goals' },
  'match.guidePreview': { vi: 'Khối phân tích: đội hình, phong độ, bối cảnh bảng', en: 'Preview: lineups, form, group context' },
  'match.guideMatrix': { vi: 'Bảng tỉ số có thể & đối đầu khi có dữ liệu', en: 'Likely scores & head-to-head when available' },
  'match.guideGlossary': { vi: 'Thuật ngữ đầy đủ →', en: 'Full glossary →' },
  'match.guideProbNote': {
    vi: 'Tỉ lệ thắng/hòa/thua và xG do PitchIntel tính — không phải tỷ lệ nhà cái.',
    en: 'Win/draw/loss and xG come from PitchIntel — not bookmaker odds.',
  },
  'common.liveLabel': { vi: 'Trực tiếp', en: 'Live' },
  'match.topScores': { vi: 'Tỉ số khả dĩ nhất', en: 'Top scores' },
  'matchAnalysis.back': { vi: 'Bảng chiến thuật', en: 'Tactical dashboard' },
  'matchAnalysis.groupTitle': { vi: 'Bảng {group}: {versus}', en: 'Group {group}: {versus}' },
  'matchAnalysis.stageTitle': { vi: '{stage}: {versus}', en: '{stage}: {versus}' },
  'matchAnalysis.title': { vi: 'Phân tích chiến thuật đầy đủ', en: 'Full tactical analysis' },
  'matchAnalysis.subtitle': {
    vi: 'Cách chơi của từng đội, kịch bản có thể xảy ra và biến động dự đoán.',
    en: 'How each team plays, possible scenarios, and how predictions shift.',
  },
  'matchAnalysis.modelProb': { vi: 'Dự đoán thắng/hòa/thua', en: 'Win/draw/loss forecast' },
  'matchAnalysis.marketNote': {
    vi: 'So sánh dự đoán với tỷ lệ cược (nếu có) — chỉ để tham khảo.',
    en: 'Forecast vs betting odds (when available) — for reference only.',
  },
  'pitch.title': { vi: 'Sơ đồ sân', en: 'Pitch map' },
  'pitch.subtitle': { vi: 'Vị trí sự kiện & vector di chuyển', en: 'Event locations & movement vectors' },
  'pitch.subtitleLineup': {
    vi: 'Đội hình thực tế theo sơ đồ chiến thuật · cập nhật khi trận LIVE',
    en: 'Live tactical formation · updates during LIVE matches',
  },
  'pitch.loading': { vi: 'Đang tải sơ đồ sân…', en: 'Loading pitch map…' },
  'pitch.unavailable': {
    vi: 'Chưa có đội hình chính thức cho trận này.',
    en: 'No official lineup available for this match yet.',
  },
  'pitch.minute': { vi: 'Phút', en: 'Min' },
  'pitch.ratingsNote': {
    vi: 'Điểm cầu thủ (4–10) tổng hợp từ thống kê trận sau hiệp một — không phải xếp hạng Opta/FIFA chính thức.',
    en: 'Player ratings (4–10) aggregated from match stats after half-time — not official Opta/FIFA scores.',
  },
  'pitch.home': { vi: 'CHỦ', en: 'HOME' },
  'pitch.away': { vi: 'KHÁCH', en: 'AWAY' },
  'simulator.title': { vi: 'Thử kịch bản', en: 'Try a scenario' },
  'simulator.subtitle': {
    vi: 'Chỉnh các yếu tố chiến thuật để xem dự đoán thay đổi thế nào (chỉ thử nghiệm).',
    en: 'Adjust tactical factors to see how the forecast changes (playground only).',
  },
  'simulator.reset': { vi: 'Đặt lại kịch bản', en: 'Reset scenario' },
  'simulator.scenarioOutput': { vi: 'Kết quả kịch bản', en: 'Scenario output' },
  'simulator.winProb': { vi: 'Dự đoán thắng/hòa/thua', en: 'Win/draw/loss forecast' },
  'editorial.mode': { vi: 'Chế độ đọc', en: 'Editorial mode' },
  'editorial.takeaways': { vi: 'Điểm chính', en: 'Key takeaways' },
  'editorial.context': { vi: 'Ngữ cảnh trận', en: 'Match context' },
  'featured.modelNow': { vi: 'Dự đoán hiện tại', en: 'Current forecast' },
  'featured.probLoading': { vi: 'Đang tải dự đoán…', en: 'Loading forecast…' },
  'featured.sectionLive': { vi: 'Trận đang diễn ra', en: 'Live match' },
  'featured.sectionUpcoming': { vi: 'Trận đấu gần nhất', en: 'Next up' },
  'wc.title': { vi: 'World Cup 2026', en: 'FIFA World Cup 2026' },
  'wc.underway': { vi: 'Đang diễn ra', en: 'Ongoing' },
  'wc.countdownTo': { vi: 'Đếm ngược tới World Cup 2026', en: 'Countdown to FIFA World Cup 2026' },
  'wc.progress': { vi: '{done}/{total} trận đã đá', en: '{done}/{total} matches played' },
  'wc.liveNow': { vi: '{n} trận đang live', en: '{n} live now' },
  'wc.nextUp': { vi: 'Tiếp theo', en: 'Up next' },
  'multiVar.loading': { vi: 'Đang phân tích…', en: 'Analyzing…' },
  'history.moreMeetings': {
    vi: 'Các trận đã kết thúc giữa hai đội tại WC 2026.',
    en: 'Completed meetings between these teams at WC 2026.',
  },
  'calendar.filterAll': { vi: 'Tất cả', en: 'All' },
  'calendar.filterGroup': { vi: 'Vòng bảng', en: 'Group' },
  'calendar.filterKnockout': { vi: 'Vòng loại trực tiếp', en: 'Knockout' },
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
  'calendar.addGoogle': { vi: 'Lịch Google', en: 'Google Calendar' },
  'calendar.downloadAll': { vi: 'Tải lịch .ics', en: 'Download .ics' },
  'calendar.downloadOne': { vi: 'Tải trận .ics', en: 'Download match .ics' },
  'calendar.syncHint': {
    vi: 'Tải file .ics để import vào iPhone, Outlook hoặc app lịch khác — tự nhắc giờ bóng lăn.',
    en: 'Download .ics to import into iPhone, Outlook, or other calendar apps — kickoff reminders included.',
  },
  'schedule.hubTitle': { vi: 'Lịch thi đấu trực quan', en: 'Visual match schedule' },
  'schedule.viewGrid': { vi: 'Lưới', en: 'Grid' },
  'schedule.viewList': { vi: 'Danh sách', en: 'List' },
  'schedule.timezoneBannerGmt7': {
    vi: 'Giờ thi đấu theo giờ Việt Nam ({tz}, GMT+7) — khớp lịch FIFA / VTV.',
    en: 'Kickoffs in Vietnam time ({tz}, GMT+7) — aligned with FIFA / VTV schedule.',
  },
  'schedule.localReference': {
    vi: 'giờ địa phương của bạn: {tz}',
    en: 'your local time: {tz}',
  },
  'schedule.localTimeShort': {
    vi: '{tz}',
    en: '{tz}',
  },
  'favorites.tab': { vi: 'Yêu thích', en: 'Favorites' },
  'favorites.title': { vi: 'Trận & đội yêu thích', en: 'Saved matches & teams' },
  'favorites.subtitle': {
    vi: 'Thả sao trên lịch hoặc trang đội — lưu trên thiết bị của bạn.',
    en: 'Star matches on the schedule or team pages — saved on your device.',
  },
  'favorites.matchesTab': { vi: 'Trận yêu thích', en: 'Favorite matches' },
  'favorites.teamsTab': { vi: 'Đội yêu thích', en: 'Favorite teams' },
  'favorites.noMatches': { vi: 'Chưa có trận yêu thích — bấm ☆ trên lịch thi đấu.', en: 'No favorite matches yet — tap ☆ on the schedule.' },
  'favorites.noTeams': { vi: 'Chưa có đội yêu thích — bấm ☆ ở mục Đội tuyển.', en: 'No favorite teams yet — tap ☆ in Teams.' },
  'favorites.teamFixtures': { vi: 'Lịch các đội yêu thích', en: 'Fixtures for your teams' },
  'favorites.add': { vi: 'Thêm yêu thích', en: 'Add favorite' },
  'favorites.remove': { vi: 'Bỏ yêu thích', en: 'Remove favorite' },
  'teams.tab': { vi: 'Đội tuyển', en: 'Teams' },
  'teams.directoryTitle': { vi: '48 đội tuyển World Cup 2026', en: '48 World Cup 2026 teams' },
  'teams.directorySubtitle': {
    vi: 'Tra cứu nhanh — bấm đội để xem HLV, đội hình triệu tập và lịch sử đối đầu.',
    en: 'Quick lookup — open a team for coach, squad, and head-to-head history.',
  },
  'teams.searchPlaceholder': { vi: 'Tìm đội…', en: 'Search teams…' },
  'groupBoard.title': { vi: 'Bảng đấu', en: 'Tournament board' },
  'groupBoard.tabGroup': { vi: 'Bảng đấu vòng bảng', en: 'Group stage' },
  'groupBoard.tabKnockout': { vi: 'Vòng loại trực tiếp', en: 'Knock Out' },
  'groupBoard.knockoutEmpty': { vi: 'Chưa có trận ở vòng này.', en: 'No matches in this round yet.' },
  'groupBoard.subtitle': {
    vi: 'Bảng xếp hạng và lịch thi đấu theo từng bảng — gọn như bảng đấu World Cup.',
    en: 'Standings and fixtures per group — compact tournament view.',
  },
  'groupBoard.loading': { vi: 'Đang tải bảng đấu…', en: 'Loading groups…' },
  'groupBoard.probHint': {
    vi: 'C · H · K = tỉ lệ chủ/hòa/khách (%) · «Chưa có» = chưa tính xong',
    en: 'H · D · A = home/draw/away % · «Pending» = not ready yet',
  },
  'compactProb.noAnalysis': { vi: 'Chưa có', en: 'Pending' },
  'compactProb.noAnalysisTitle': {
    vi: 'Chưa có dự đoán — sẽ cập nhật khi tính xong',
    en: 'No forecast yet — updates when ready',
  },
  'groupBoard.standingsHint': {
    vi: 'Tr · Trận · HS · Hiệu số · Đ · Điểm',
    en: 'P · Played · GD · Goal diff · Pts · Points',
  },
  'groupBoard.knockoutTitle': { vi: 'Vòng loại trực tiếp', en: 'Knockout stage' },
  'groupBoard.knockoutSubtitle': {
    vi: 'Hiện sau khi kết thúc vòng bảng — bấm trận để mở phân tích chi tiết.',
    en: 'Shown after the group stage — tap a match for full analysis.',
  },
  'groupBoard.knockoutLocked': {
    vi: 'Các trận vòng loại trực tiếp sẽ hiện khi 12 bảng đã đá xong.',
    en: 'Knockout fixtures appear once all 12 groups are complete.',
  },
  'groupBoard.openAnalysis': { vi: 'Phân tích', en: 'Analysis' },
  'groupBoard.legendTitle': { vi: 'Chú thích', en: 'Legend' },
  'groupBoard.legendQualified': { vi: 'Vào vòng knockout', en: 'Qualified for knockout' },
  'groupBoard.legendThird': { vi: 'Hạng 3 (có thể vào vòng 32)', en: '3rd place (may qualify for R32)' },
  'groupBoard.legendForecast': { vi: 'Tỉ số dự đoán', en: 'Predicted score' },
  'home.newUserHint': { vi: 'Lần đầu? Xem', en: 'New? See the' },
  'home.newUserHintLink': { vi: 'hướng dẫn', en: 'guide' },
  'home.newUserHintTail': { vi: 'hoặc làm theo 4 bước bên dưới.', en: 'or follow the 4 steps below.' },
  'tournaments.teams': { vi: 'đội', en: 'teams' },
  'tournaments.viewSchedule': { vi: 'Xem lịch 104 trận →', en: 'View 104-match schedule →' },
  'tournaments.viewFinal': { vi: 'Xem trận chung kết →', en: 'View final match →' },
  'matchAnalysis.articleSubtitle': {
    vi: 'Bài phân tích dài — dự đoán, cách chơi đội, kịch bản và so sánh tỷ lệ cược (nếu có).',
    en: 'Long-form analysis — forecast, team play styles, scenarios, and odds comparison when available.',
  },
  'matchAnalysis.scoreline': {
    vi: 'Tỉ số khả dĩ nhất {score} — {h} {hp} / {d} {dp} / {a} {ap}.',
    en: 'Most likely scoreline {score} — {h} {hp} / {d} {dp} / {a} {ap}.',
  },
  'matchAnalysis.notFound': { vi: 'Không tìm thấy trận.', en: 'Match not found.' },
  'matchAnalysis.notFoundBack': { vi: 'Quay lại', en: 'Back' },
  'match.briefingAiSubtitle': {
    vi: 'Phần phân tích AI — số liệu là chuẩn',
    en: 'AI analysis layer — stats lead',
  },
  'matchHeader.matchLabel': { vi: 'TRẬN ĐẤU', en: 'MATCH' },
  'news.pagination': { vi: 'Phân trang tin', en: 'News pagination' },
  'countdown.day': { vi: 'n', en: 'd' },
  'countdown.hour': { vi: 'g', en: 'h' },
  'countdown.min': { vi: 'p', en: 'm' },
  'countdown.sec': { vi: 's', en: 's' },
  'matrix.title': { vi: 'Bảng tỉ số khả dĩ', en: 'Likely scorelines' },
  'matrix.subtitle': {
    vi: 'Những tỉ số có khả năng cao nhất (≥ 0,1%)',
    en: 'Most likely exact scores (≥ 0.1%)',
  },
  'multiVar.title': { vi: 'Phân tích nhiều yếu tố', en: 'Multi-factor analysis' },
  'multiVar.subtitle': { vi: 'Góc nhìn AI bổ sung', en: 'Extra AI angle' },
  'multiVar.analysisHeading': { vi: 'Phân tích', en: 'Analysis' },
  'player.title': { vi: 'Ảnh hưởng cầu thủ', en: 'Player impact' },
  'player.subtitle': { vi: 'Cầu thủ then chốt trận này', en: 'Key contributors this match' },
  'contribution.subtitle': { vi: 'Tỷ trọng theo giai đoạn chiến thuật', en: 'Radial share by tactical phase' },
  'source.title': { vi: 'Độ tin cậy nguồn', en: 'Source confidence' },
  'source.subtitle': { vi: 'Chúng tôi cho bạn biết tin đến từ đâu', en: 'We show where each story comes from' },
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
    vi: 'PitchIntel — Phân tích thống kê',
    en: 'PitchIntel — Statistical preview',
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
  'match.tabOverview': { vi: 'Tổng quan', en: 'Overview' },
  'match.tabStats': { vi: 'Thống kê', en: 'Stats' },
  'match.tabPrediction': { vi: 'Dự đoán', en: 'Prediction' },
  'match.tabMomentum': { vi: 'Đà trận', en: 'Momentum' },
  'match.tabTactical': { vi: 'Chiến thuật', en: 'Tactical' },
  'match.tabScenarios': { vi: 'Kịch bản', en: 'Scenarios' },
  'match.sectionNav': { vi: 'Mục trận đấu', en: 'Match sections' },
  'common.lastUpdated': { vi: 'Cập nhật lần cuối', en: 'Last updated' },
  'stats.title': { vi: 'Thống kê trận đấu', en: 'Match statistics' },
  'stats.subtitle': {
    vi: 'Số liệu ghi nhận khi có — không hiển thị số liệu giả lập.',
    en: 'Recorded stats when available — no fabricated official numbers.',
  },
  'stats.subtitleLive': {
    vi: 'Cập nhật theo trận đang diễn ra (khi có dữ liệu).',
    en: 'Updates during live play when data is available.',
  },
  'stats.loading': { vi: 'Đang tải thống kê…', en: 'Loading statistics…' },
  'stats.unavailable': {
    vi: 'Chưa có thống kê chính thức cho trận này. PitchIntel sẽ cập nhật khi có dữ liệu.',
    en: 'No official stats for this match yet. PitchIntel will update when data is available.',
  },
  'stats.officialSource': { vi: 'Nguồn', en: 'Source' },
  'recap.title': { vi: 'Tóm tắt trận đấu', en: 'Match summary' },
  'recap.subtitle': {
    vi: 'Kết quả và diễn biến chính thức (FIFA Match Centre)',
    en: 'Official result and key moments (FIFA Match Centre)',
  },
  'recap.loading': { vi: 'Đang tải tóm tắt…', en: 'Loading match summary…' },
  'recap.commentary': { vi: 'Tường thuật', en: 'Commentary' },
  'recap.playerStats': { vi: 'Số liệu cầu thủ', en: 'Player statistics' },
  'recap.sourceFifa': {
    vi: 'Nguồn: FIFA Match Centre · tham chiếu Opta/FotMob',
    en: 'Source: FIFA Match Centre · Opta/FotMob reference',
  },
  'staff.title': { vi: 'Ban huấn luyện & trọng tài', en: 'Coaching staff & officials' },
  'staff.subtitle': {
    vi: 'HLV trưởng và trọng tài chính thức — ảnh hưởng đến dự đoán trận này.',
    en: 'Head coaches and appointed officials — factored into this match forecast.',
  },
  'staff.loading': { vi: 'Đang tải thông tin ban huấn luyện…', en: 'Loading staff data…' },
  'staff.referee': { vi: 'Trọng tài chính', en: 'Referee' },
  'staff.assistants': { vi: 'Trợ lý', en: 'Assistant referees' },
  'staff.nationality': { vi: 'Quốc tịch', en: 'Nationality' },
  'staff.wcApps': { vi: 'Số lần dự World Cup (HLV)', en: 'WC apps (as coach)' },
  'staff.tenure': { vi: 'Thâm niên', en: 'Tenure' },
  'staff.years': { vi: 'năm', en: 'yrs' },
  'staff.strictness': { vi: 'Mức thẻ', en: 'Card strictness' },
  'staff.modelNote': {
    vi: 'Kinh nghiệm HLV và cách trọng tài điều khiển trận được tính vào dự đoán.',
    en: 'Coach experience and referee style are factored into the forecast.',
  },
  'staff.role.fourth_official': { vi: 'Trọng tài thứ 4', en: 'Fourth official' },
  'staff.role.var': { vi: 'VAR', en: 'VAR' },
  'stats.possession': { vi: 'Kiểm soát bóng', en: 'Possession' },
  'stats.shots': { vi: 'Cú sút', en: 'Shots' },
  'stats.shotsOnTarget': { vi: 'Sút trúng đích', en: 'Shots on target' },
  'stats.xg': { vi: 'Bàn thắng kỳ vọng / xG', en: 'Expected goals / xG' },
  'stats.passes': { vi: 'Đường chuyền', en: 'Passes' },
  'stats.passAccuracy': { vi: 'Độ chính xác chuyền', en: 'Pass accuracy' },
  'stats.cards': { vi: 'Thẻ', en: 'Cards' },
  'stats.subs': { vi: 'Thay người', en: 'Subs' },
  'prediction.summaryTitle': { vi: 'Tóm tắt dự đoán', en: 'Prediction summary' },
  'prediction.summarySubtitle': {
    vi: 'Tỉ lệ thắng/hòa/thua và tỉ số dự đoán từ PitchIntel.',
    en: 'Win/draw/loss odds and predicted scorelines from PitchIntel.',
  },
  'prediction.loading': { vi: 'Đang tải dự đoán…', en: 'Loading prediction…' },
  'prediction.predictedScore': { vi: 'Tỉ số dự đoán', en: 'Predicted score' },
  'prediction.actualScore': { vi: 'Tỉ số thực tế', en: 'Actual score' },
  'prediction.liveScore': { vi: 'Tỉ số hiện tại', en: 'Current score' },
  'prediction.scoreMatch': { vi: 'Trùng dự đoán', en: 'Matched prediction' },
  'prediction.scoreDiff': { vi: 'Khác dự đoán', en: 'Differs from prediction' },
  'prediction.homeWin': { vi: 'Khả năng đội nhà thắng', en: 'Home win chance' },
  'prediction.draw': { vi: 'Khả năng hòa', en: 'Draw chance' },
  'prediction.awayWin': { vi: 'Khả năng đội khách thắng', en: 'Away win chance' },
  'prediction.modelConfidence': { vi: 'Độ tin cậy dự đoán', en: 'Forecast confidence' },
  'prediction.modelVersion': { vi: 'Phiên bản dự đoán', en: 'Forecast version' },
  'prediction.drivers': { vi: 'Lý do chính ảnh hưởng dự đoán', en: 'Key prediction drivers' },
  'prediction.xgNote': {
    vi: 'xG ước tính bởi PitchIntel — không phải số liệu Opta/FIFA chính thức.',
    en: 'xG estimated by PitchIntel — not official Opta/FIFA data.',
  },
  'analytics.title': { vi: 'Đà trận đấu', en: 'Match momentum' },
  'analytics.subtitle': {
    vi: 'Ai đang lấn lướt, áp lực lên khung thành và những bước ngoặt quan trọng.',
    en: 'Who is on top, pressure on goal, and key turning points.',
  },
  'analytics.loading': { vi: 'Đang tính phân tích…', en: 'Computing analytics…' },
  'analytics.unavailable': {
    vi: 'Chưa đủ dữ liệu — sẽ có sau khi trận có thêm diễn biến.',
    en: 'Not enough data yet — updates as the match unfolds.',
  },
  'analytics.momentum': { vi: 'Đà trận đấu', en: 'Momentum' },
  'analytics.pressure': { vi: 'Chỉ số gây áp lực', en: 'Pressure index' },
  'analytics.turningPoint': { vi: 'Bước ngoặt trận đấu', en: 'Turning point' },
  'analytics.turningYes': { vi: 'Có dấu hiệu', en: 'Detected' },
  'analytics.turningNo': { vi: 'Chưa rõ', en: 'Not yet' },
  'analytics.turningHint': {
    vi: 'Phát hiện khi dự đoán thắng thay đổi mạnh giữa các lần cập nhật.',
    en: 'Detected when the win forecast shifts significantly between updates.',
  },
  'analytics.pressureHint': {
    vi: 'Mức biến động dự đoán — cao hơn nghĩa là trận đấu đang mở.',
    en: 'Forecast volatility — higher means a more open contest.',
  },
  'analytics.momentumHome': { vi: 'Đà nghiêng về đội nhà', en: 'Momentum toward home' },
  'analytics.momentumAway': { vi: 'Đà nghiêng về đội khách', en: 'Momentum toward away' },
  'analytics.momentumBalanced': { vi: 'Cân bằng', en: 'Balanced' },
  'analytics.movementNote': { vi: 'Lịch sử cập nhật dự đoán', en: 'Forecast update history' },
  'analytics.updates': { vi: 'lần', en: 'updates' },
  'analytics.estimateNote': {
    vi: 'Chỉ số từ PitchIntel — ước tính, không phải số liệu phát sóng chính thức.',
    en: 'PitchIntel estimates — not official broadcast stats.',
  },
  'seo.brandLine': { vi: 'PitchIntel · World Cup 2026', en: 'PitchIntel · World Cup 2026' },
  'seo.footerNote': {
    vi: 'Theo dõi World Cup 2026 miễn phí — dự đoán, kịch bản và tin đã lọc.',
    en: 'Free World Cup 2026 hub — predictions, scenarios, and curated news.',
  },
};
