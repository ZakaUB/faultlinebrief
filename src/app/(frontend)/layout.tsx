import React from 'react'
import Script from 'next/script'
import { Barlow_Condensed, Rajdhani, Inter } from 'next/font/google'
import './styles.css'
import GoogleAnalyticsConsent from './GoogleAnalyticsConsent'

const masthead = Rajdhani({ subsets: ['latin'], weight: ['600','700'], display: 'swap', variable: '--font-masthead' })
const headline = Barlow_Condensed({ subsets: ['latin'], weight: ['500','600','700','800'], display: 'swap', variable: '--font-headline' })
const body = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-body' })

export const metadata = {
  title: 'Faultline Brief | Geopolitics, Conflict & Security',
  description: 'Independent geopolitical reporting and analysis on conflict, security and the forces shaping our world.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${masthead.variable} ${headline.variable} ${body.variable}`}>{children}<GoogleAnalyticsConsent /><Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="afterInteractive" type="module" data-cf-beacon='{"token":"daaccaf854aa4fdfad93987ae530ee6b"}' /></body></html>
}
