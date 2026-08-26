declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args)
  }
}

// ── Basic event tracking ─────────────────────────────────────

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
) {
  gtag('event', eventName, params)
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

// ── Conversion tracking ──────────────────────────────────────

export function trackDownloadConversion(platform: string, fileName: string, version: string) {
  gtag('event', 'generate_lead', {
    currency: 'USD',
    value: 0,
    platform,
    file_name: fileName,
    version,
  })
}

// ── Scroll depth tracking ────────────────────────────────────

export function initScrollDepthTracking() {
  if (typeof window === 'undefined') return

  const thresholds = [25, 50, 75, 90, 100]
  const fired = new Set<number>()

  function checkScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
    if (docHeight <= 0) return
    const percent = Math.round((scrollTop / docHeight) * 100)

    for (const t of thresholds) {
      if (percent >= t && !fired.has(t)) {
        fired.add(t)
        trackEvent('scroll_depth', {
          percent_scrolled: t,
          page_path: window.location.pathname,
        })
      }
    }
  }

  let ticking = false
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        checkScroll()
        ticking = false
      })
      ticking = true
    }
  }, { passive: true })

  // Reset on navigation (VitePress SPA)
  window.addEventListener('vitepress:page-change', () => {
    fired.clear()
  })
}

// ── Site search tracking ─────────────────────────────────────

export function trackSiteSearch(query: string, resultsCount?: number) {
  trackEvent('search', {
    search_term: query,
    ...(resultsCount != null ? { results_count: resultsCount } : {}),
  })
}

export function initSearchTracking() {
  if (typeof window === 'undefined') return

  // VitePress local search fires on the input; observe the search dialog
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        const dialog = node.closest?.('.VPSearch') || node.querySelector?.('.VPSearch')
        if (!dialog) continue

        const input = dialog.querySelector('input[type="search"], input:not([type])') as HTMLInputElement | null
        if (!input) continue

        let lastValue = input.value
        input.addEventListener('input', () => {
          const val = input.value.trim()
          if (val && val !== lastValue && val.length >= 3) {
            trackSiteSearch(val)
          }
          lastValue = val
        })
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

// ── 404 error tracking ───────────────────────────────────────

export function track404(url: string, referrer?: string) {
  trackEvent('page_not_found', {
    page_path: url,
    referrer: referrer || document.referrer || '',
  })
}

export function init404Tracking() {
  if (typeof window === 'undefined') return

  // Check if the VitePress 404 page is displayed
  const check404 = () => {
    const vp404 = document.querySelector('.VPNotFound')
    if (vp404) {
      track404(window.location.pathname)
    }
  }

  check404()
  window.addEventListener('vitepress:page-change', check404)
}

// ── Email (mailto) click tracking ────────────────────────────

export function trackMailtoClick(email: string) {
  trackEvent('email_click', {
    email_address: email,
    page_location: window.location.href,
  })
}

export function initMailtoTracking() {
  if (typeof window === 'undefined') return

  document.addEventListener('click', (e) => {
    const anchor = (e.target as HTMLElement).closest('a[href^="mailto:"]')
    if (!anchor) return
    const href = anchor.getAttribute('href') || ''
    const email = href.replace('mailto:', '').split('?')[0]
    if (email) trackMailtoClick(email)
  })
}

// ── Outbound download tracking (GitHub release links) ────────

export function trackOutboundDownload(url: string, fileName: string) {
  trackEvent('outbound_download', {
    download_url: url,
    file_name: fileName,
    page_location: window.location.href,
  })
}

export function initOutboundDownloadTracking() {
  if (typeof window === 'undefined') return

  document.addEventListener('click', (e) => {
    const anchor = (e.target as HTMLElement).closest('a[href]')
    if (!anchor) return
    const href = anchor.getAttribute('href') || ''
    if (href.includes('github.com') && href.includes('/releases/download/')) {
      const fileName = href.split('/').pop() || ''
      trackOutboundDownload(href, fileName)
    }
  })
}

// ── Engagement timing ────────────────────────────────────────

export function initEngagementTiming() {
  if (typeof window === 'undefined') return

  const milestones = [30, 60, 120]
  const fired = new Set<number>()

  const timers = milestones.map((seconds) => {
    return setTimeout(() => {
      if (!fired.has(seconds)) {
        fired.add(seconds)
        trackEvent('engagement_time', {
          seconds,
          page_path: window.location.pathname,
        })
      }
    }, seconds * 1000)
  })

  window.addEventListener('vitepress:page-change', () => {
    timers.forEach(clearTimeout)
    fired.clear()
    // Re-init on next page would require re-calling this function,
    // but for SPA we just clear old timers
  })
}

// ── SHA copy / expand tracking ───────────────────────────────

export function trackShaCopy(version: string) {
  trackEvent('sha_copy', { version })
}

export function trackShaExpand(version: string) {
  trackEvent('sha_expand', { version })
}

// ── Custom dimensions & user properties ──────────────────────

export function initUserProperties() {
  if (typeof window === 'undefined') return

  // Detect locale from URL
  const path = window.location.pathname
  let locale = 'en'
  if (path.startsWith('/es/')) locale = 'es'
  else if (path.startsWith('/fr/')) locale = 'fr'
  else if (path.startsWith('/de/')) locale = 'de'
  else if (path.startsWith('/pt/')) locale = 'pt-BR'
  else if (path.startsWith('/zh/')) locale = 'zh-CN'
  else if (path.startsWith('/hi/')) locale = 'hi'

  gtag('set', 'user_properties', {
    locale,
    platform: navigator.platform,
    device_type: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  })

  gtag('set', {
    custom_map: {
      dimension1: 'locale',
      dimension2: 'platform',
      dimension3: 'device_type',
    },
  })
}

// ── Core Web Vitals ──────────────────────────────────────────

export function initCoreWebVitals() {
  if (typeof window === 'undefined') return

  // LCP
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number; size: number; url?: string }
      if (last) {
        trackEvent('core_web_vital', {
          metric_name: 'LCP',
          metric_value: Math.round(last.startTime),
          metric_delta: last.size || 0,
          page_path: window.location.pathname,
        })
      }
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* not supported */ }

  // CLS
  try {
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as { hadRecentInput?: boolean }).hadRecentInput) {
          clsValue += (entry as { value: number }).value
        }
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })

    // Report CLS on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && clsValue > 0) {
        trackEvent('core_web_vital', {
          metric_name: 'CLS',
          metric_value: Math.round(clsValue * 1000) / 1000,
          page_path: window.location.pathname,
        })
      }
    })
  } catch { /* not supported */ }

  // INP (Interaction to Next Paint)
  try {
    const inpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const worst = entries.reduce((max, entry) => {
        const duration = (entry as { duration: number }).duration
        return duration > max ? duration : max
      }, 0)
      if (worst > 0) {
        trackEvent('core_web_vital', {
          metric_name: 'INP',
          metric_value: Math.round(worst),
          page_path: window.location.pathname,
        })
      }
    })
    inpObserver.observe({ type: 'event', buffered: true })
  } catch { /* not supported */ }
}
