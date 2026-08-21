import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'EncodeX',
  description: 'A cross-platform multimedia conversion tool built on FFmpeg, React, TypeScript, and Electron',
  base: '/EncodeX/',
  head: [
    ['link', { rel: 'icon', href: '/EncodeX/images/icon.png' }],
    ['meta', { name: 'theme-color', content: '#47848F' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'EncodeX' }],
    ['meta', { property: 'og:description', content: 'A cross-platform multimedia conversion tool built on FFmpeg, React, TypeScript, and Electron' }],
    ['meta', { property: 'og:image', content: '/EncodeX/images/banner.png' }],
  ],
  themeConfig: {
    logo: '/images/icon.png',
    siteTitle: 'EncodeX',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Features', link: '/features' },
      { text: 'Download', link: '/download' },
      {
        text: 'Docs',
        items: [
          { text: 'Architecture', link: '/docs/architecture' },
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
          text: 'Documentation',
          items: [
            { text: 'Architecture', link: '/docs/architecture' },
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
    footer: {
      message: 'Released under the MIT License.',
      copyright: `Copyright \u00a9 ${new Date().getFullYear()} EncodeX Contributors`,
    },
    search: {
      provider: 'local',
    },
  },
})
