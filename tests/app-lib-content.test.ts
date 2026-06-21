import { describe, expect, it } from 'vitest';
import {
  API_DOC_NAV,
  API_DOC_SECTIONS,
  API_EVENT_TYPES,
} from '../app/lib/apiDocsContent';
import {
  guideIntro,
  guideSections,
  newUserNeedsBrainstorm,
  pickGuide,
  quickStartSteps,
} from '../app/lib/guideContent';
import {
  findSeoPage,
  SEO_PAGE_PATHS,
  SEO_PAGES,
} from '../app/lib/seoPages';

describe('guideContent', () => {
  it('pickGuide selects by mode', () => {
    expect(pickGuide(guideIntro, 'vi')).toBe(guideIntro.vi);
    expect(pickGuide(guideIntro, 'en')).toBe(guideIntro.en);
  });

  it('has structured quick start and sections', () => {
    expect(quickStartSteps.length).toBeGreaterThanOrEqual(4);
    for (const step of quickStartSteps) {
      expect(step.to.startsWith('/')).toBe(true);
      expect(step.title.vi.length).toBeGreaterThan(0);
      expect(step.title.en.length).toBeGreaterThan(0);
      expect(step.desc.vi.length).toBeGreaterThan(0);
      expect(step.desc.en.length).toBeGreaterThan(0);
    }

    expect(guideSections.length).toBeGreaterThanOrEqual(4);
    for (const section of guideSections) {
      expect(section.id.length).toBeGreaterThan(0);
      expect(section.title.vi).toBeTruthy();
      expect(section.body.en).toBeTruthy();
      section.bullets?.forEach((bullet) => {
        expect(bullet.vi).toBeTruthy();
        expect(bullet.en).toBeTruthy();
      });
    }

    expect(newUserNeedsBrainstorm.length).toBeGreaterThanOrEqual(3);
    for (const group of newUserNeedsBrainstorm) {
      expect(group.category.vi).toBeTruthy();
      expect(group.items.length).toBeGreaterThan(0);
    }
  });
});

describe('apiDocsContent', () => {
  it('defines event types and navigable sections', () => {
    expect(API_EVENT_TYPES).toContain('match.score_updated');
    expect(API_EVENT_TYPES.length).toBeGreaterThanOrEqual(5);
  });

  it('has well-formed API doc sections', () => {
    expect(API_DOC_SECTIONS.length).toBeGreaterThanOrEqual(6);
    expect(API_DOC_NAV.length).toBe(API_DOC_SECTIONS.length);

    for (const section of API_DOC_SECTIONS) {
      expect(section.id.length).toBeGreaterThan(0);
      expect(section.title.length).toBeGreaterThan(0);
      section.endpoints?.forEach((endpoint) => {
        expect(endpoint.path.startsWith('/api')).toBe(true);
        expect(['GET', 'POST', 'DELETE', 'PATCH']).toContain(endpoint.method);
        expect(endpoint.title.length).toBeGreaterThan(0);
      });
    }

    const core = API_DOC_SECTIONS.find((s) => s.id === 'core-api');
    expect(core?.endpoints?.some((e) => e.path === '/api/health')).toBe(true);
  });
});

describe('seoPages', () => {
  it('lists unique SEO landing paths', () => {
    expect(SEO_PAGES.length).toBeGreaterThanOrEqual(6);
    expect(SEO_PAGE_PATHS.every((p) => p.startsWith('/'))).toBe(true);
    expect(new Set(SEO_PAGE_PATHS).size).toBe(SEO_PAGE_PATHS.length);
  });

  it('findSeoPage returns page metadata', () => {
    const page = findSeoPage('/lich-thi-dau-world-cup-2026');
    expect(page?.titleVi).toContain('Lịch');
    expect(page?.ctaPath.startsWith('/')).toBe(true);
    expect(findSeoPage('/missing-page')).toBeUndefined();
  });

  it('every SEO page has bilingual copy and CTA', () => {
    for (const page of SEO_PAGES) {
      expect(page.titleVi.length).toBeGreaterThan(0);
      expect(page.titleEn.length).toBeGreaterThan(0);
      expect(page.descriptionVi.length).toBeGreaterThan(0);
      expect(page.descriptionEn.length).toBeGreaterThan(0);
      expect(page.ctaLabelVi.length).toBeGreaterThan(0);
      expect(page.ctaLabelEn.length).toBeGreaterThan(0);
    }
  });
});
