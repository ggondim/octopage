import { useEffect, useRef } from 'react';

/**
 * giscus, mounted from React.
 *
 * The `.astro` version writes the script tag at build time; this one exists for
 * discussion-backed pages, where the discussion number is only known after the
 * fetch resolves. giscus reads its configuration off the script element's
 * attributes when the script executes, so the element has to be created after
 * the number is in hand rather than patched afterwards.
 */
export function GiscusWidget({ attrs }: { attrs: Record<string, string> }) {
  const host = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(attrs);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    node.replaceChildren();

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    for (const [name, value] of Object.entries(attrs)) script.setAttribute(name, value);
    node.appendChild(script);

    return () => node.replaceChildren();
  }, [key]);

  return <section className="octopage-comments" aria-label="Comments" ref={host} />;
}

export default GiscusWidget;
