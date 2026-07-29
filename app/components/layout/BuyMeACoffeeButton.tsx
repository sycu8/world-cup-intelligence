import { useEffect, useRef, useState } from 'react';

const BMC_SCRIPT_SRC = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';
const BMC_PAGE_URL = 'https://www.buymeacoffee.com/Sycule';

/**
 * Loads the official Buy Me a Coffee button widget (slug: Sycule).
 * Script must be injected via DOM — React does not execute <script> children.
 * Falls back to a direct link when the BMC CDN script cannot load.
 */
export function BuyMeACoffeeButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFallback, setShowFallback] = useState(() => import.meta.env.MODE === 'test');

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;

    const container = containerRef.current;
    if (!container) return;

    container.replaceChildren();

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = BMC_SCRIPT_SRC;
    script.async = true;
    script.dataset.name = 'bmc-button';
    script.dataset.slug = 'Sycule';
    script.dataset.color = '#FFDD00';
    script.dataset.emoji = '';
    script.dataset.font = 'Cookie';
    script.dataset.text = 'Buy me a coffee';
    script.dataset.outlineColor = '#000000';
    script.dataset.fontColor = '#000000';
    script.dataset.coffeeColor = '#ffffff';
    script.onerror = () => setShowFallback(true);

    try {
      container.appendChild(script);
    } catch {
      setShowFallback(true);
    }

    return () => {
      container.replaceChildren();
    };
  }, []);

  return (
    <div className="mt-1 min-h-[50px]" data-testid="buy-me-a-coffee">
      <div ref={containerRef} className="bmc-button-host" />
      {showFallback ? (
        <a
          href={BMC_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-yellow hover:underline"
        >
          Buy me a coffee
        </a>
      ) : null}
    </div>
  );
}
