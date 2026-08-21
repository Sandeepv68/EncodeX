import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'EncodeX',
  description: 'A free, easy-to-use app to convert videos and audio, trim clips, extract music from video, and shrink photos. Works on Windows, Mac, and Linux.',
  base: '/',
  sitemap: { hostname: 'https://encodex.in' },
  head: [
    ['link', { rel: 'icon', href: '/images/favicon-64.png' }],
    ['link', { rel: 'preload', as: 'image', href: '/images/icon.webp' }],
    ['meta', { name: 'theme-color', content: '#0359AD' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'EncodeX' }],
    ['meta', { property: 'og:description', content: 'A free, easy-to-use app to convert videos and audio, trim clips, extract music from video, and shrink photos. Works on Windows, Mac, and Linux.' }],
    ['meta', { property: 'og:image', content: 'https://encodex.in/images/banner.jpg' }],
    ['meta', { property: 'og:url', content: 'https://encodex.in/' }],
  ],
  themeConfig: {
    siteTitle: 'EncodeX',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Features', link: '/features' },
      { text: 'Download', link: '/download' },
      {
        text: 'Docs',
        items: [
          { text: 'Architecture Overview', link: '/docs/architecture' },
          { text: 'Processes & Startup', link: '/docs/architecture-processes' },
          { text: 'Transcoders', link: '/docs/architecture-transcoders' },
          { text: 'Renderer & State', link: '/docs/architecture-renderer' },
          { text: 'Feature Reference', link: '/docs/features-reference' },
          { text: 'CLI Usage', link: '/docs/cli' },
          { text: 'IPC Channels', link: '/docs/ipc' },
          { text: 'Testing', link: '/docs/testing' },
          { text: 'Project Structure', link: '/docs/project-structure' },
          { text: 'Update Manager', link: '/docs/update-manager' },
        ],
      },
      { text: 'Blog', link: '/blog/' },
      { text: 'Contributing', link: '/contributing' },
    ],
    sidebar: {
      '/docs/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/docs/architecture' },
            { text: 'Processes & Startup', link: '/docs/architecture-processes' },
            { text: 'Transcoders', link: '/docs/architecture-transcoders' },
            { text: 'Renderer & State', link: '/docs/architecture-renderer' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Feature Reference', link: '/docs/features-reference' },
            { text: 'CLI Usage', link: '/docs/cli' },
            { text: 'IPC Channels', link: '/docs/ipc' },
            { text: 'Testing', link: '/docs/testing' },
            { text: 'Project Structure', link: '/docs/project-structure' },
            { text: 'Update Manager', link: '/docs/update-manager' },
          ],
        },
      ],
      '/blog/': [
        {
          text: 'Blog',
          items: [
            { text: 'All Posts', link: '/blog/' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Sandeepv68/EncodeX' },
    ],
    search: {
      provider: 'local',
    },
  },
})
