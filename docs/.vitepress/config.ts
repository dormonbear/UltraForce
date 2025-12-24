import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'UltraForce',
  description: 'Modern Salesforce metadata search and management tool',
  lang: 'zh-CN',

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }]
  ],

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Features', link: '/features/' },
      { text: 'Commands', link: '/commands/' }
    ],

    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Release Notes', link: '/guide/release-notes' }
          ]
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Settings', link: '/guide/settings' },
            { text: 'Custom Commands', link: '/guide/custom-commands' }
          ]
        },
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/features/' },
            { text: 'Metadata Search', link: '/features/metadata-search' },
            { text: 'Field Search', link: '/features/field-search' },
            { text: 'Record Navigation', link: '/features/record-navigation' },
            { text: 'Setup Navigation', link: '/features/setup-navigation' }
          ]
        },
        {
          text: 'Commands',
          items: [
            { text: 'Overview', link: '/commands/' },
            { text: 'Built-in Commands', link: '/commands/builtin' },
            { text: 'Custom Commands', link: '/commands/custom' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/dormonbear/UltraForce-for-Salesforce' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-present UltraForce Team'
    },

    search: {
      provider: 'local'
    }
  }
})
