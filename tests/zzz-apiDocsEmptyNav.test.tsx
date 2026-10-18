import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../app/lib/apiDocsContent', () => ({
  API_EVENT_TYPES: ['match.score_updated'],
  API_DOC_NAV: [],
  API_DOC_SECTIONS: [{ id: 'intro', title: 'Intro', content: ['Hello'] }],
}));

describe('ApiDocsPage empty nav branches', () => {
  it('uses introduction fallback id and Navigate title', async () => {
    const { ApiDocsPage } = await import('../app/pages/ApiDocsPage');
    const { I18nProvider } = await import('../app/lib/i18n/I18nContext');
    render(
      <MemoryRouter>
        <I18nProvider>
          <ApiDocsPage />
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /Navigate/i })).toBeTruthy());
  });
});
