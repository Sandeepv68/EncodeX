import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import CustomLayout from './CustomLayout.vue'
import OsIcon from './components/OsIcon.vue'
import LatestDownloads from './components/LatestDownloads.vue'
import OpenSourceCard from './components/OpenSourceCard.vue'
import McpDemo from './components/McpDemo.vue'
import McpConfig from './components/McpConfig.vue'
import RelatedConversions from './components/RelatedConversions.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ app }) {
    app.component('OsIcon', OsIcon)
    app.component('LatestDownloads', LatestDownloads)
    app.component('OpenSourceCard', OpenSourceCard)
    app.component('McpDemo', McpDemo)
    app.component('McpConfig', McpConfig)
    app.component('RelatedConversions', RelatedConversions)
    app.component(
      'Mermaid',
      defineAsyncComponent(() => import('vitepress-plugin-mermaid/Mermaid.vue')),
    )
  },
}
