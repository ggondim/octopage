import { defineCollection } from 'astro:content';
import { octopageContentLoader } from 'octopage/loader';
import { octopageSchema } from 'octopage/schema';
import config from '../octopage.config.ts';
import { parseConfig } from 'octopage/config';

const content = defineCollection({
  loader: octopageContentLoader(parseConfig(config)),
  schema: octopageSchema,
});

export const collections = { content };
