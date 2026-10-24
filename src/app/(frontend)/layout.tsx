import React from 'react'
import Script from 'next/script'
import { Barlow_Condensed, Rajdhani, Inter } from 'next/font/google'
import './styles.css'
import GoogleAnalyticsConsent from './GoogleAnalyticsConsent'

const masthead = Rajdhani({ subsets: ['latin'], weight: ['700'], display: 'swap', variable: '--font-masthead' })
const headline = Barlow_Condensed({ subsets: ['latin'], weight: ['700','800'], display: 'swap', variable: '--font-headline' })
const body = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-body' })

export const metadata = {
  title: 'Faultline Brief | Geopolitics, Conflict & Security',
  description: 'Independent geopolitical reporting and analysis on conflict, security and the forces shaping our world.',
  metadataBase: new URL('https://faultlinebrief.com'),
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const } },
}

const publisherJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  '@id': 'https://faultlinebrief.com/#organization',
  name: 'Faultline Brief',
  url: 'https://faultlinebrief.com',
  description: 'Independent geopolitical reporting and analysis on conflict, security and the forces shaping our world.',
  publishingPrinciples: 'https://faultlinebrief.com/editorial-standards',
  contactPoint: { '@type': 'ContactPoint', contactType: 'editorial inquiries', email: 'editorial@faultlinebrief.com' },
}).replace(/</g, '\\u003c')

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${masthead.variable} ${headline.variable} ${body.variable}`}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: publisherJsonLd }} />{children}<GoogleAnalyticsConsent /><Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="lazyOnload" type="module" data-cf-beacon='{"token":"daaccaf854aa4fdfad93987ae530ee6b"}' /></body></html>
}
