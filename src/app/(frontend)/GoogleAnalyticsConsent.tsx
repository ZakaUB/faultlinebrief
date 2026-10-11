'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const measurementId = 'G-X3L30BKE4S'
const consentKey = 'faultlinebrief-analytics-consent'
type Consent = 'accepted' | 'declined' | null

export default function GoogleAnalyticsConsent() {
  const pathname = usePathname()
  const [consent, setConsent] = useState<Consent>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(consentKey)
      if (stored === 'accepted' || stored === 'declined') setConsent(stored)
    } catch { /* Browsers can disable storage. */ }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || consent !== 'accepted') return
    const w = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
    if (!w.gtag) {
      w.dataLayer = w.dataLayer || []
      w.gtag = (...args: unknown[]) => { w.dataLayer?.push(args) }
      w.gtag('js', new Date())
      w.gtag('config', measurementId, { send_page_view: false })
      const script = document.createElement('script')
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
      document.head.appendChild(script)
    }
    w.gtag('event', 'page_view', { page_path: pathname + window.location.search, page_location: window.location.href, page_title: document.title })
  }, [ready, consent, pathname])

  const choose = (choice: Exclude<Consent, null>) => {
    try { window.localStorage.setItem(consentKey, choice) } catch { /* Keep the current choice for this visit. */ }
    setConsent(choice)
  }

  if (!ready || consent !== null) return null
  return (
    <div role="dialog" aria-label="Analytics privacy choices" style={{ position: 'fixed', bottom: 16, left: 16, right: 16, maxWidth: 540, zIndex: 9999, background: '#10243a', color: '#fff', border: '1px solid #6d8295', borderRadius: 12, padding: 18, boxShadow: '0 8px 32px rgba(0,0,0,.3)', fontFamily: 'Arial, sans-serif' }}>
      <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5 }}>Faultline Brief uses optional Google Analytics cookies to understand readership and improve reporting. You can accept or decline. Read our <a href="/privacy" style={{ color: '#9ee8ff', textDecoration: 'underline' }}>Privacy Policy</a>.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => choose('accepted')} style={{ padding: '9px 16px', cursor: 'pointer', borderRadius: 6, background: '#9ee8ff', color: '#10243a', border: 0, fontWeight: 700 }}>Accept analytics</button>
        <button type="button" onClick={() => choose('declined')} style={{ padding: '9px 16px', cursor: 'pointer', borderRadius: 6, background: 'transparent', color: '#fff', border: '1px solid #b9c5d1' }}>Decline</button>
      </div>
    </div>
  )
}
