import Link from 'next/link'

export default function SiteNav() {
  return (
    <nav className="nav" aria-label="Main navigation">
      <Link href="/">Home</Link>
      <Link href="/latest-news">Latest News</Link>
      <Link href="/categories/geopolitics">Geopolitics</Link>
      <Link href="/categories/conflict">Conflict</Link>
      <Link href="/categories/security">Security</Link>
      <Link href="/about">About</Link>
    </nav>
  )
}
