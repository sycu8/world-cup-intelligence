import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/brand/BrandLogo';
import { CodeBlock } from '../components/docs/CodeBlock';
import { EndpointCard } from '../components/docs/EndpointCard';
import {
  API_DOC_NAV,
  API_DOC_SECTIONS,
  API_EVENT_TYPES,
} from '../lib/apiDocsContent';

function fillOrigin(text: string, origin: string) {
  return text.replaceAll('{origin}', origin);
}

export function renderInlineMarkdown(text: string, origin: string) {
  const filled = fillOrigin(text, origin);
  const parts = filled.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-panel2 px-1.5 py-0.5 font-mono text-sm text-cyan">
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const external = href.startsWith('http');
      return (
        <a
          key={i}
          href={href}
          className="text-cyan underline decoration-cyan/30 underline-offset-2 hover:decoration-cyan"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {label}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function resolveApiDocsOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'https://wcstat.orangecloud.vn';
}

export function ApiDocsPage() {
  const origin = resolveApiDocsOrigin();
  const [activeId, setActiveId] = useState(API_DOC_NAV[0]?.id ?? 'introduction');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id);
        }
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    );
    for (const { id } of API_DOC_NAV) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  const baseUrl = useMemo(() => `${origin}/api`, [origin]);

  return (
    <div className="api-docs-root min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-4">
            <BrandLogo />
            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
            <span className="hidden text-sm font-medium text-muted sm:inline">API Reference</span>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <a
              href={`${origin}/.well-known/openapi.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg px-3 py-1.5 text-muted transition hover:bg-panel2 hover:text-foreground sm:inline-block"
            >
              OpenAPI
            </a>
            <a
              href={`${origin}/docs/api.md`}
              className="hidden rounded-lg px-3 py-1.5 text-muted transition hover:bg-panel2 hover:text-foreground md:inline-block"
            >
              Markdown
            </a>
            <Link
              to="/"
              className="rounded-lg border border-border/60 px-3 py-1.5 text-muted transition hover:border-cyan/40 hover:text-cyan"
            >
              ← App
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Sidebar */}
        <aside className="api-docs-sidebar hidden w-60 shrink-0 lg:block">
          <nav className="sticky top-[4.25rem] max-h-[calc(100vh-5rem)] overflow-y-auto px-4 py-8">
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-widest text-muted">On this page</p>
            <ul className="space-y-0.5">
              {API_DOC_NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      activeId === item.id
                        ? 'bg-cyan/10 font-medium text-cyan'
                        : 'text-muted hover:bg-panel2/60 hover:text-foreground'
                    }`}
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:px-12 lg:py-10">
          {/* Mobile section picker */}
          <div className="mb-6 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-panel px-4 py-3 text-sm font-medium"
            >
              {API_DOC_NAV.find((n) => n.id === activeId)?.title ?? 'Navigate'}
              <span className="text-muted">{mobileNavOpen ? '▲' : '▼'}</span>
            </button>
            {mobileNavOpen ? (
              <ul className="mt-2 rounded-xl border border-border bg-panel p-2">
                {API_DOC_NAV.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={() => setMobileNavOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel2 hover:text-foreground"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Hero */}
          <section className="api-docs-hero mb-12 rounded-2xl border border-cyan/20 bg-gradient-to-br from-panel via-panel to-panel2 p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan">
                Open API
              </span>
              <span className="rounded-full border border-border bg-panel2 px-3 py-1 font-mono text-xs text-muted">
                v1.0
              </span>
              <span className="rounded-full border border-green/30 bg-green/10 px-3 py-1 text-xs text-green">
                WC 2026
              </span>
            </div>
            <h1 className="mt-5 font-heading text-4xl tracking-tight text-foreground md:text-5xl">
              PitchIntel API
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
              Live scores, tactical probabilities, FIFA stats, and real-time webhooks — built for developers and
              open integrations.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#quick-start"
                className="rounded-lg bg-cyan px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-cyan/90"
              >
                Get started
              </a>
              <a
                href="#public-api-v1"
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-cyan/40"
              >
                Integrations
              </a>
            </div>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">Base URL</span>
              <code className="api-base-url rounded-lg border border-border/60 bg-[#050a0e] px-4 py-2 font-mono text-sm text-cyan">
                {baseUrl}
              </code>
            </div>
          </section>

          {/* Event types strip (v1) */}
          <div className="mb-12 flex flex-wrap gap-2">
            {API_EVENT_TYPES.map((evt) => (
              <span
                key={evt}
                className="rounded-md border border-border/50 bg-panel2/50 px-2.5 py-1 font-mono text-xs text-muted"
              >
                {evt}
              </span>
            ))}
          </div>

          {/* Sections */}
          <div className="space-y-16 pb-20">
            {API_DOC_SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="font-heading text-2xl tracking-tight text-foreground md:text-3xl">{section.title}</h2>
                {section.description ? (
                  <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">{section.description}</p>
                ) : null}

                {section.content?.map((para, i) => (
                  <p key={i} className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground/85">
                    {renderInlineMarkdown(para, origin)}
                  </p>
                ))}

                {section.code ? (
                  <div className="mt-6 max-w-3xl">
                    <CodeBlock code={fillOrigin(section.code, origin)} language="javascript" />
                  </div>
                ) : null}

                {section.endpoints?.length ? (
                  <div className="mt-6 space-y-4">
                    {section.endpoints.map((ep) => (
                      <EndpointCard key={ep.path + ep.method} endpoint={ep} origin={origin} />
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>

          <footer className="border-t border-border/50 pt-8 text-center text-sm text-muted">
            <p>
              Open source ·{' '}
              <a
                href="https://github.com/sycu8/world-cup-intelligence"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan hover:underline"
              >
                world-cup-intelligence
              </a>
              {' · '}
              <a href={`${origin}/auth.md`} className="text-cyan hover:underline">
                Auth policy
              </a>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
