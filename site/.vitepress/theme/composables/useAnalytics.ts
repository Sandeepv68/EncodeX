declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}

export function trackDownload(platform: string, fileName: string, version: string) {
  trackEvent('download_click', {
    platform,
    file_name: fileName,
    version,
    page_location: window.location.href,
  })
}

export function trackFeatureClick(featureTitle: string) {
  trackEvent('feature_card_click', {
    feature_title: featureTitle,
    page_location: window.location.href,
  })
}

export function trackBlogClick(postTitle: string) {
  trackEvent('blog_post_click', {
    post_title: postTitle,
    page_location: window.location.href,
  })
}

export function trackExternalLink(url: string, linkText: string) {
  trackEvent('external_link_click', {
    outbound_url: url,
    link_text: linkText,
    page_location: window.location.href,
  })
}

export function trackLocaleSwitch(newLocale: string) {
  trackEvent('locale_switch', {
    new_locale: newLocale,
    page_location: window.location.href,
  })
}

export function trackDocNavClick(docTitle: string) {
  trackEvent('docs_nav_click', {
    doc_title: docTitle,
    page_location: window.location.href,
  })
}
