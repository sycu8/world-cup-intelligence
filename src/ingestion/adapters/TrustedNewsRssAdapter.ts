/** Trusted RSS feeds — global soccer + World Cup. */
export const WC_NEWS_FEEDS = [
  {
    id: 'rss-guardian-football',
    name: 'The Guardian Football',
    publisher: 'The Guardian',
    url: 'https://www.theguardian.com/football/rss',
    reliability: 0.84,
  },
  {
    id: 'rss-guardian-wc',
    name: 'The Guardian World Cup',
    publisher: 'The Guardian',
    url: 'https://www.theguardian.com/football/world-cup/rss',
    reliability: 0.82,
  },
  {
    id: 'rss-bbc-football',
    name: 'BBC Sport Football',
    publisher: 'BBC',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    reliability: 0.85,
  },
  {
    id: 'rss-fifa-news',
    name: 'FIFA News',
    publisher: 'FIFA',
    url: 'https://www.fifa.com/news/rss',
    reliability: 0.9,
  },
  {
    id: 'rss-ap-soccer',
    name: 'AP Soccer',
    publisher: 'Associated Press',
    url: 'https://apnews.com/hub/soccer?output=rss',
    reliability: 0.84,
  },
  {
    id: 'rss-sky-football',
    name: 'Sky Sports Football',
    publisher: 'Sky Sports',
    url: 'https://www.skysports.com/rss/12040',
    reliability: 0.8,
  },
  {
    id: 'rss-reuters-soccer',
    name: 'Reuters Soccer',
    publisher: 'Reuters',
    url: 'https://www.reuters.com/sports/soccer/rss',
    reliability: 0.86,
  },
  {
    id: 'rss-espn-soccer',
    name: 'ESPN FC',
    publisher: 'ESPN',
    url: 'https://www.espn.com/espn/rss/soccer/news',
    reliability: 0.8,
  },
  {
    id: 'rss-goal-com',
    name: 'GOAL.com',
    publisher: 'GOAL',
    url: 'https://www.goal.com/feeds/en/news',
    reliability: 0.78,
  },
  {
    id: 'rss-fourfourtwo',
    name: 'FourFourTwo',
    publisher: 'FourFourTwo',
    url: 'https://www.fourfourtwo.com/feeds/all',
    reliability: 0.77,
  },
  {
    id: 'rss-concacaf',
    name: 'CONCACAF',
    publisher: 'CONCACAF',
    url: 'https://www.concacaf.com/rss.xml',
    reliability: 0.82,
  },
  {
    id: 'rss-uefa-news',
    name: 'UEFA News',
    publisher: 'UEFA',
    url: 'https://www.uefa.com/rssfeed/news/rss.xml',
    reliability: 0.84,
  },
  {
    id: 'rss-ussoccer',
    name: 'U.S. Soccer',
    publisher: 'U.S. Soccer',
    url: 'https://www.ussoccer.com/rss.xml',
    reliability: 0.83,
  },
  {
    id: 'rss-canada-soccer',
    name: 'Canada Soccer',
    publisher: 'Canada Soccer',
    url: 'https://www.canadasoccer.com/feed',
    reliability: 0.81,
  },
  {
    id: 'rss-athletic-soccer',
    name: 'The Athletic Soccer',
    publisher: 'The Athletic',
    url: 'https://www.nytimes.com/athletic/rss/soccer/',
    reliability: 0.84,
  },
  {
    id: 'rss-90min',
    name: '90min',
    publisher: '90min',
    url: 'https://www.90min.com/posts.rss',
    reliability: 0.76,
  },
  {
    id: 'rss-marca-futbol',
    name: 'MARCA Fútbol',
    publisher: 'MARCA',
    url: 'https://www.marca.com/rss/futbol.xml',
    reliability: 0.79,
  },
  {
    id: 'rss-football-italia',
    name: 'Football Italia',
    publisher: 'Football Italia',
    url: 'https://www.football-italia.net/rss',
    reliability: 0.78,
  },
  {
    id: 'rss-football-espana',
    name: 'Football Espana',
    publisher: 'Football Espana',
    url: 'https://www.football-espana.net/feed',
    reliability: 0.77,
  },
  {
    id: 'rss-cbs-soccer',
    name: 'CBS Sports Soccer',
    publisher: 'CBS Sports',
    url: 'https://www.cbssports.com/rss/headlines/soccer/',
    reliability: 0.79,
  },
  {
    id: 'rss-mirror-football',
    name: 'Daily Mirror Football',
    publisher: 'Daily Mirror',
    url: 'https://www.mirror.co.uk/sport/football/rss.xml',
    reliability: 0.74,
  },
  {
    id: 'rss-espn-mx-soccer',
    name: 'ESPN México Fútbol',
    publisher: 'ESPN',
    url: 'https://www.espn.com.mx/espn/rss/soccer/news',
    reliability: 0.79,
  },
  {
    id: 'rss-ole-argentina',
    name: 'Olé',
    publisher: 'Olé',
    url: 'https://www.ole.com.ar/rss/',
    reliability: 0.77,
  },
  {
    id: 'rss-independent-football',
    name: 'The Independent Football',
    publisher: 'The Independent',
    url: 'https://www.independent.co.uk/sport/football/rss',
    reliability: 0.78,
  },
  {
    id: 'rss-standard-football',
    name: 'Evening Standard Football',
    publisher: 'Evening Standard',
    url: 'https://www.standard.co.uk/sport/football/rss',
    reliability: 0.76,
  },
  {
    id: 'rss-vnexpress-thethao',
    name: 'VnExpress Thể thao',
    publisher: 'VnExpress',
    url: 'https://vnexpress.net/rss/the-thao.rss',
    reliability: 0.78,
    contentLocale: 'vi' as const,
  },
  {
    id: 'rss-afc-news',
    name: 'Asian Football Confederation',
    publisher: 'AFC',
    url: 'https://www.the-afc.com/en/more/news.html?format=feed&type=rss',
    reliability: 0.8,
  },
] as const;

export type NewsFeed =
  | (typeof WC_NEWS_FEEDS)[number]
  | {
      readonly id: 'rss-fifa-wc2026';
      readonly name: string;
      readonly publisher: string;
      readonly url: string;
      readonly reliability: number;
    }
  | {
      readonly id: 'rss-vnexpress-wc2026';
      readonly name: string;
      readonly publisher: string;
      readonly url: string;
      readonly reliability: number;
      readonly contentLocale: 'vi';
    }
  | {
      readonly id: string;
      readonly name: string;
      readonly publisher: string;
      readonly url: string;
      readonly reliability: number;
      readonly tournamentId?: string;
      readonly contentLocale?: 'vi';
    };

export function newsFeedSourceId(feedId: string): string {
  return `src-${feedId}`;
}

export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl: string | null;
};

export function parseRssItems(xml: string, maxItems = 15): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks.slice(0, maxItems)) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description') || extractTag(block, 'summary');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published');
    if (title && link) {
      items.push({
        title: decodeEntities(stripHtml(title)),
        link: link.trim(),
        description: decodeEntities(stripHtml(description)),
        pubDate: pubDate || new Date().toISOString(),
        imageUrl: extractImageUrl(block, description),
      });
    }
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(block);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  return plain ? plain[1].trim() : '';
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

export function extractImageUrl(block: string, description: string): string | null {
  const fromAttr = (tag: string, attr = 'url') => {
    return new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, 'i').exec(block)?.[1]?.trim() ?? null;
  };
  const mediaUrl =
    /<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i.exec(block)?.[1]?.trim() ?? null;
  const enclosure = /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i.exec(block);
  const encoded = extractTag(block, 'content:encoded') || extractTag(block, 'content');
  const imgInEncoded = encoded ? /<img[^>]+src=["']([^"']+)["']/i.exec(encoded) : null;
  const imgInDesc = /<img[^>]+src=["']([^"']+)["']/i.exec(description);
  return (
    fromAttr('media:content') ||
    fromAttr('media:thumbnail') ||
    mediaUrl ||
    enclosure?.[1]?.trim() ||
    imgInEncoded?.[1]?.trim() ||
    imgInDesc?.[1]?.trim() ||
    null
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const WC_NEWS_KEYWORDS = [
  // Tournament & branding
  'world cup',
  'fifa',
  'wc 2026',
  'wc2026',
  'world cup 2026',
  'canadamexicousa',
  'canada 2026',
  'mexico 2026',
  'usa 2026',
  'qatar 2022',
  'mundial',
  'copa del mundo',
  // Format & schedule
  'group stage',
  'knockout',
  'semi-final',
  'semifinal',
  'quarter-final',
  'quarterfinal',
  'round of 16',
  'last 16',
  'playoff',
  'play-off',
  'qualifier',
  'qualifying',
  'draw',
  'seeding',
  'host city',
  'host cities',
  'opening match',
  'final',
  // Confederations
  'concacaf',
  'conmebol',
  'uefa',
  'caf',
  'afc',
  // Host nations & cities
  'usmnt',
  'canmnt',
  'el tri',
  'selección mexicana',
  'atlanta',
  'los angeles',
  'miami',
  'new york',
  'dallas',
  'seattle',
  'houston',
  'kansas city',
  'philadelphia',
  'san francisco',
  'toronto',
  'vancouver',
  'monterrey',
  'guadalajara',
  'mexico city',
  // Star players & contenders
  'messi',
  'mbappé',
  'mbappe',
  'ronaldo',
  'neymar',
  'vinícius',
  'vinicius',
  'bellingham',
  'haaland',
  'kane',
  'lewandowski',
  'salah',
  'yamal',
  // National teams (frequent WC participants)
  'argentina',
  'france',
  'mexico',
  'canada',
  'usa',
  'united states',
  'south africa',
  'brazil',
  'england',
  'germany',
  'spain',
  'portugal',
  'netherlands',
  'italy',
  'belgium',
  'croatia',
  'morocco',
  'japan',
  'south korea',
  'korea republic',
  'senegal',
  'uruguay',
  'colombia',
  'ecuador',
  'chile',
  'australia',
  'saudi arabia',
  'iran',
  'nigeria',
  'ghana',
  'cameroon',
  'tunisia',
  'algeria',
  'poland',
  'switzerland',
  'denmark',
  'sweden',
  'norway',
  'wales',
  'scotland',
  'republic of ireland',
  'austria',
  'serbia',
  'turkey',
  'ukraine',
  'peru',
  'paraguay',
  'venezuela',
  'costa rica',
  'jamaica',
  'panama',
  'honduras',
  // Squad & match news
  'injury',
  'lineup',
  'line-up',
  'squad',
  'roster',
  'call-up',
  'callup',
  'starting xi',
  'preview',
  'prediction',
] as const;

export function isWorldCupRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return WC_NEWS_KEYWORDS.some((k) => text.includes(k));
}

/** Global club / league / football vocabulary — keeps worldwide soccer in the blog feed. */
const SOCCER_NEWS_KEYWORDS = [
  'football',
  'soccer',
  'futbol',
  'fútbol',
  'bóng đá',
  'premier league',
  'la liga',
  'laliga',
  'serie a',
  'bundesliga',
  'ligue 1',
  'eredivisie',
  'primeira liga',
  'championship',
  'champions league',
  'europa league',
  'conference league',
  'mls',
  'major league soccer',
  'liga mx',
  'brasileirão',
  'brasileirao',
  'copa libertadores',
  'copa sudamericana',
  'v.league',
  'v-league',
  'j1',
  'j-league',
  'j.league',
  'jleague',
  'asean championship',
  'aff cup',
  'aff championship',
  'caf champions',
  'african champions',
  'afcon',
  'africa cup',
  'asian cup',
  'afc champions',
  'transfer',
  'transfers',
  'striker',
  'midfielder',
  'goalkeeper',
  'manager',
  'head coach',
  'hat-trick',
  'hattrick',
  'clean sheet',
  'penalty',
  'free kick',
  'matchday',
  'fixture',
  'relegation',
  'promotion',
  'derby',
  'el clasico',
  'el clásico',
  'manchester',
  'liverpool',
  'chelsea',
  'arsenal',
  'tottenham',
  'real madrid',
  'barcelona',
  'bayern',
  'juventus',
  'inter milan',
  'ac milan',
  'psg',
  'paris saint',
  'napoli',
  'dortmund',
  'atletico',
  'atlético',
  'giải vô địch',
  'ngoại hạng anh',
  'cúp c1',
  'đội tuyển',
] as const;

const NON_SOCCER_NOISE = [
  'cricket',
  'rugby',
  'tennis',
  'nba',
  'nfl',
  'mlb',
  'nhl',
  'formula 1',
  'f1 ',
  'nascar',
  'golf ',
  'boxing',
  'ufc',
  'wrestling',
  'olympics swimming',
  'athletics',
] as const;

export function isSoccerRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  const hasNoise = NON_SOCCER_NOISE.some((k) => text.includes(k));
  const strongSoccer = [
    'football',
    'soccer',
    'futbol',
    'fútbol',
    'bóng đá',
    'premier league',
    'la liga',
    'serie a',
    'bundesliga',
    'champions league',
    'world cup',
  ].some((k) => text.includes(k));
  if (hasNoise && !strongSoccer) return false;
  if (isWorldCupRelated(title, description)) return true;
  return SOCCER_NEWS_KEYWORDS.some((k) => text.includes(k));
}

/** Keep soccer-topic RSS items for the global blog (WC + club + worldwide football). */
export function shouldKeepSoccerNews(title: string, description: string): boolean {
  return isSoccerRelated(title, description);
}
