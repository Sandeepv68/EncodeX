import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import CustomLayout from './CustomLayout.vue'
import OsIcon from './components/OsIcon.vue'
import LatestDownloads from './components/LatestDownloads.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ app }) {
    app.component('OsIcon', OsIcon)
    app.component('LatestDownloads', LatestDownloads)
    app.component(
      'Mermaid',
      defineAsyncComponent(() => import('vitepress-plugin-mermaid/Mermaid.vue')),
    )
  },
}
