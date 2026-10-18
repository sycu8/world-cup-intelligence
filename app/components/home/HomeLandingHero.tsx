import { Link } from 'react-router-dom';
import { brandTheme } from '../../lib/brand/brandTheme';
import { useI18n } from '../../lib/i18n/I18nContext';

type Props = {
  liveCount: number;
  leagueCount: number;
};

/** Full-bleed club-leagues landing hero — brand first, one CTA group. */
export function HomeLandingHero({ liveCount, leagueCount }: Props) {
  const { t, mode } = useI18n();

  return (
    <section className="home-landing-hero" aria-labelledby="home-landing-brand">
      <div className="home-landing-hero__atmosphere" aria-hidden />
      <div className="home-landing-hero__pitch" aria-hidden />
      <div className="home-landing-hero__inner">
        <p id="home-landing-brand" className="home-landing-hero__brand home-landing-anim-1">
          {brandTheme.name}
        </p>
        <h1 className="home-landing-hero__headline home-landing-anim-2">
          {t('home.landing.headline')}
        </h1>
        <p className="home-landing-hero__lede home-landing-anim-3">{t('home.landing.lede')}</p>
        <div className="home-landing-hero__cta home-landing-anim-4">
          <Link to="/leagues" className="btn-primary">
            {t('home.landing.ctaLeagues')}
          </Link>
          <Link to="/leagues" className="btn-ghost border border-border/60 bg-background/20">
            {t('home.landing.ctaLive')}
          </Link>
        </div>
        <p className="home-landing-hero__meta home-landing-anim-4">
          {mode === 'vi'
            ? `${leagueCount} giải · ${liveCount} trận đang diễn ra`
            : `${leagueCount} leagues · ${liveCount} live now`}
        </p>
      </div>
    </section>
  );
}
