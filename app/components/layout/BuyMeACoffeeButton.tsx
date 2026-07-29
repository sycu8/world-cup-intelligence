import { useEffect, useRef } from 'react';

const BMC_SCRIPT_SRC = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';

/**
 * Loads the official Buy Me a Coffee button widget (slug: Sycule).
 * Script must be injected via DOM — React does not execute <script> children.
 */
export function BuyMeACoffeeButton() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="bmc-button-host mt-1 min-h-[50px]"
      data-testid="buy-me-a-coffee"
    />
  );
}
