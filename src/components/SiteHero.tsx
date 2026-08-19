import { Hero } from '@primer/react-brand';

/**
 * The home hero, composed inside a single React component on purpose.
 *
 * Primer's compound components (`Hero`, `Card`, `Accordion`, …) coordinate
 * through React context between the parent and its `Hero.Heading` /
 * `Hero.Description` children. Writing that composition directly in an `.astro`
 * file gives each subcomponent its own React root, the context lookup finds no
 * provider, and the render dies with "useHeroContext must be used within a
 * HeroProvider".
 *
 * This is separate from theming: `ThemeProvider`'s context genuinely has no
 * consumers, which is why `data-color-mode` on <body> is enough. Compound
 * components are the case where the React tree has to stay whole, so the rule
 * is to compose them in `.tsx` and expose one component to Astro.
 */
export interface SiteHeroProps {
  label?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionText?: string;
}

export function SiteHero({ label, title, description, actionHref, actionText }: SiteHeroProps) {
  return (
    <Hero align="start">
      {label && <Hero.Label>{label}</Hero.Label>}
      <Hero.Heading size="2">{title}</Hero.Heading>
      {description && <Hero.Description>{description}</Hero.Description>}
      {actionHref && actionText && <Hero.PrimaryAction href={actionHref}>{actionText}</Hero.PrimaryAction>}
    </Hero>
  );
}
