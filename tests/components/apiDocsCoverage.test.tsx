import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

describe('ApiDocsPage optional description branch', () => {
  afterEach(() => {
    vi.doUnmock('../../app/lib/apiDocsContent');
    vi.unstubAllGlobals();
  });

  it('renders sections without description', async () => {
    vi.doMock('../../app/lib/apiDocsContent', async () => {
      const actual = await vi.importActual<typeof import('../../app/lib/apiDocsContent')>(
        '../../app/lib/apiDocsContent',
      );
      return {
        ...actual,
        API_DOC_SECTIONS: [
          { id: 'no-desc', title: 'Undocumented Section', content: ['Only body copy.'] },
          ...actual.API_DOC_SECTIONS,
        ],
      };
    });
    const { ApiDocsPage } = await import('../../app/pages/ApiDocsPage');
    const { I18nProvider } = await import('../../app/lib/i18n/I18nContext');
    const view = render(
      <MemoryRouter initialEntries={['/docs/api']}>
        <I18nProvider>
          <ApiDocsPage />
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(view.container.textContent).toMatch(/Undocumented Section/i), {
      timeout: 8000,
    });
    expect(view.container.textContent).toMatch(/Only body copy/i);
  });

  it('renders external markdown links from introduction content', async () => {
    const { ApiDocsPage } = await import('../../app/pages/ApiDocsPage');
    const { I18nProvider } = await import('../../app/lib/i18n/I18nContext');
    render(
      <MemoryRouter>
        <I18nProvider>
          <ApiDocsPage />
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('link', { name: /GitHub repository/i })).toBeTruthy());
    expect(screen.getByRole('link', { name: /GitHub repository/i }).getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('link', { name: /GitHub repository/i }).getAttribute('rel')).toContain('noopener');
  });

});
