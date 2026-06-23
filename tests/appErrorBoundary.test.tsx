import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from '../app/components/layout/AppErrorBoundary';

function Boom(): JSX.Element {
  throw new Error('render boom');
}

describe('AppErrorBoundary', () => {
  it('renders fallback when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/Không tải được nội dung/i);
    spy.mockRestore();
  });
});
