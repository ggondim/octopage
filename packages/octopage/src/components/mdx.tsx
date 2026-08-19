import type { ComponentProps, ReactNode } from 'react';
import { Heading, InlineLink, Text } from '@primer/react-brand';

/**
 * The MDX component map.
 *
 * Every element here renders without hydration: these are among the 37 of 55
 * Primer Brand components that hold no state and register no listeners, so a
 * prose page ships zero client JavaScript. Anything interactive an author drops
 * into a body (Accordion, Tabs, SubNav…) becomes an island on its own and pays
 * for itself only on the pages that use it.
 */

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

function heading(as: HeadingLevel, size: ComponentProps<typeof Heading>['size']) {
  return function MdxHeading({ children, id }: { children?: ReactNode; id?: string }) {
    return (
      <Heading as={as} size={size} id={id}>
        {children}
      </Heading>
    );
  };
}

/**
 * External links get the usual `rel` hardening. Content comes from discussion
 * bodies, which anyone with write access to the repo can edit, so
 * `noopener noreferrer` is a real boundary rather than a formality.
 */
function MdxLink({ href = '', children }: { href?: string; children?: ReactNode }) {
  const external = /^https?:\/\//.test(href);
  return (
    <InlineLink
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </InlineLink>
  );
}

export const mdxComponents = {
  h1: heading('h1', '2'),
  h2: heading('h2', '3'),
  h3: heading('h3', '4'),
  h4: heading('h4', '5'),
  h5: heading('h5', '6'),
  h6: heading('h6', 'subhead-large'),
  p: ({ children }: { children?: ReactNode }) => <Text as="p" size="300">{children}</Text>,
  a: MdxLink,
};

export default mdxComponents;
