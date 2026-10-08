import React from 'react'
import './styles.css'

export const metadata = {
  title: 'Faultline Brief | Geopolitics, Conflict & Security',
  description: 'Independent geopolitical reporting and analysis on conflict, security and the forces shaping our world.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
