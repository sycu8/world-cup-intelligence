import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../app/lib/i18n/I18nContext';

vi.mock('../../app/lib/apiDocsContent', async () => {
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

describe('ApiDocsPage optional description branch', () => {
  it('renders sections without description', async () => {
    const { ApiDocsPage } = await import('../../app/pages/ApiDocsPage');
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
});
