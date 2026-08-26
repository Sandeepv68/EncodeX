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

    if (typeof window !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/deferred.css'
      link.media = 'print'
      link.onload = () => { link.media = 'all' }
      document.head.appendChild(link)
    }
  },
}
