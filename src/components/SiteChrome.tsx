import type { ReactNode } from 'react';
import { InlineLink, Stack, Text } from '@primer/react-brand';

/**
 * Header and footer.
 *
 * Built from Primer's presentational primitives rather than `SubdomainNavBar`
 * or `MinimalFooter`. Both of those are stateful, so they would hydrate on
 * every page; `MinimalFooter` additionally hardcodes GitHub's own social links
 * and pulls their icons from githubassets.com, which is wrong for a personal
 * site and adds a third-party request to every page.
 */

export interface NavItem {
  label: string;
  href: string;
}

export function SiteHeader({ title, href, nav = [] }: { title: string; href: string; nav?: NavItem[] }) {
  return (
    <header className="octopage-header">
      <div className="octopage-header__inner">
        {/* Not `Heading`: it only accepts h1–h6, and the site name in a
            header is not a document heading — the page's own h1 is. */}
        <a className="octopage-header__brand" href={href}>
          <Text as="span" size="300" weight="semibold">
            {title}
          </Text>
        </a>

        {nav.length > 0 && (
          <nav aria-label="Main">
            <Stack direction="horizontal" gap="normal" padding="none" alignItems="center">
              {nav.map((item) => (
                <InlineLink key={item.href} href={item.href}>
                  {item.label}
                </InlineLink>
              ))}
            </Stack>
          </nav>
        )}
      </div>
    </header>
  );
}

export function SiteFooter({ title, repoUrl, children }: { title: string; repoUrl: string; children?: ReactNode }) {
  return (
    <footer className="octopage-footer">
      <div className="octopage-footer__inner">
        <Stack direction="vertical" gap="condensed" padding="none">
          <Text as="p" size="200" variant="muted">
            {title} · built with{' '}
            <InlineLink href="https://github.com/ggondim/octopage">octopage</InlineLink>
          </Text>
          <Text as="p" size="200" variant="muted">
            Content and comments live in <InlineLink href={repoUrl}>this repository</InlineLink>.
          </Text>
          {children}
        </Stack>
      </div>
    </footer>
  );
}
