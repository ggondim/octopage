import { Card, Grid, Label, Stack, Text } from '@primer/react-brand';

export interface PostSummary {
  title: string;
  description?: string;
  href: string;
  date?: string;
  labels?: string[];
  category?: string;
}

/**
 * The index listing.
 *
 * `Card` is presentational — it renders an anchor with Primer's own hover
 * treatment in CSS, so a full index page still hydrates nothing.
 */
export function PostList({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) {
    return (
      <Text as="p" size="300" variant="muted">
        No content yet.
      </Text>
    );
  }

  return (
    <Grid>
      {posts.map((post) => (
        <Grid.Column key={post.href} span={{ small: 12, medium: 6 }}>
          <Card href={post.href} hasBorder fullWidth>
            {post.category && <Card.Label>{post.category}</Card.Label>}
            <Card.Heading>{post.title}</Card.Heading>
            <Card.Description>{post.description ?? ''}</Card.Description>
          </Card>
        </Grid.Column>
      ))}
    </Grid>
  );
}

export function PostMeta({ date, author, labels = [] }: { date?: string; author?: string | null; labels?: string[] }) {
  const published = date ? new Date(date) : null;
  const valid = published !== null && !Number.isNaN(published.getTime());

  return (
    <Stack direction="horizontal" gap="condensed" padding="none" alignItems="center" flexWrap="wrap">
      {valid && (
        <Text as="span" size="200" variant="muted">
          <time dateTime={published.toISOString()}>
            {published.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
        </Text>
      )}
      {author && (
        <Text as="span" size="200" variant="muted">
          by {author}
        </Text>
      )}
      {labels.map((label) => (
        <Label key={label} size="small">
          {label}
        </Label>
      ))}
    </Stack>
  );
}
