import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="panel mx-auto max-w-lg space-y-4 p-6 text-center" role="alert">
          <p className="font-heading text-lg text-foreground">Không tải được nội dung</p>
          <p className="text-sm text-muted">
            Đã xảy ra lỗi hiển thị. Vui lòng thử tải lại trang hoặc quay về trang chủ.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={this.retry}
              className="mobile-touch-target rounded-full bg-cyan/15 px-4 py-2 text-sm font-semibold text-cyan ring-1 ring-cyan/30"
            >
              Thử lại
            </button>
            <a
              href="/"
              className="mobile-touch-target inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Về trang chủ
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
