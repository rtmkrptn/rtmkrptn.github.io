// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkDisplayMath } from './src/lib/remark-display-math.mjs';
import { remarkDesmos } from './src/lib/remark-desmos.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://rtmkrptn.github.io',
  // User site (repo named <user>.github.io) serves from the domain root.
  base: '/',
  integrations: [
    mdx(),
    // /styleguide is an internal reference and /portfolio is an unlisted page
    // (open to anyone with the link) — keep both out of the sitemap so search
    // engines are not pointed at them. Both also carry meta robots noindex.
    sitemap({
      filter: (page) => !page.includes('/styleguide') && !page.includes('/portfolio'),
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'min-light',
    },
    processor: unified({
      // remarkDisplayMath runs after remarkMath, which is what creates the
      // inlineMath nodes it promotes.
      remarkPlugins: [remarkMath, remarkDisplayMath, remarkDesmos],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
