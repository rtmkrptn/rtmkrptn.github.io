// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkDisplayMath } from './src/lib/remark-display-math.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://rtmkrptn.github.io',
  // User site (repo named <user>.github.io) serves from the domain root.
  base: '/',
  integrations: [
    mdx(),
    // /styleguide is an internal reference, not content — keep it out of
    // the sitemap so search engines are not pointed at it.
    sitemap({ filter: (page) => !page.includes('/styleguide') }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'min-light',
    },
    processor: unified({
      // remarkDisplayMath runs after remarkMath, which is what creates the
      // inlineMath nodes it promotes.
      remarkPlugins: [remarkMath, remarkDisplayMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
