import DefaultTheme from 'vitepress/theme'
import CustomLayout from './CustomLayout.vue'
import OsIcon from './components/OsIcon.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ app }) {
    app.component('OsIcon', OsIcon)
  },
}
