import Brand from '@/app/(frontend)/Brand'
import HeaderGlobe from '@/app/(frontend)/HeaderGlobe'
import SiteNav from '@/app/(frontend)/SiteNav'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Metadata } from 'next'
import type { Story } from '@/app/(frontend)/newsroom'
import { storyDate } from '@/app/(frontend)/newsroom'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const { page: raw } = await searchParams
  const parsed = Number(raw || '1')
  const page = Number.isSafeInteger(parsed) && parsed > 1 ? parsed : 1
  const url = 'https://faultlinebrief.com/latest-news' + (page > 1 ? '?page=' + page : '')
  const title = 'Latest News & Global Developments | Faultline Brief'
  const description = 'Concise, sourced updates on geopolitical developments, conflicts and international security from the Faultline Brief Editorial Desk.'
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'Faultline Brief' },
  }
}

export default async function LatestNewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams
  const value = Number(rawPage || '1')
  const page = Number.isSafeInteger(value) && value > 0 ? value : 1

  let updates: Story[] = []
  let hasNextPage = false
  let hasPrevPage = page > 1
  let totalDocs = 0
  let failed = false
  try {
    const payload = await getPayload({ config })
    const lookup = await payload.find({
      collection: 'categories' as any,
      where: { slug: { equals: 'latest-news' } },
      limit: 1,
      depth: 0,
    })
    const category = lookup.docs[0]
    if (category) {
      const result = await payload.find({
        collection: 'articles' as any,
        where: { and: [{ status: { equals: 'published' } }, { categories: { in: [category.id] } }] },
        sort: '-publishedAt',
        page,
        limit: PAGE_SIZE,
        depth: 0,
      })
      updates = result.docs as unknown as Story[]
      hasNextPage = result.hasNextPage
      hasPrevPage = result.hasPrevPage
      totalDocs = result.totalDocs
    }
  } catch (error) {
    failed = true
    console.error('[Faultline Brief] Latest news query failed:', error)
  }

  return <div className="site">
    <div className="utility"><span>FAULTLINE BRIEF / GLOBAL NEWSROOM</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div>
    <header className="masthead"><div className="masthead-identity"><Brand /><p>Understand what happened. Know why it matters.</p></div><HeaderGlobe /></header>
    <SiteNav />
    <main className="news-archive-page">
      <div className="section-heading"><span>LATEST NEWS</span><span>DEVELOPMENTS AROUND THE WORLD</span></div>
      <div className="news-page-intro"><span className="eyebrow">FAULTLINE BRIEF / NEWS UPDATES</span><h1>Latest News</h1><p>Short, sourced briefings on developments in geopolitics, conflict and global security. For deeper context, explore our <Link href="/analysis">reporting and analysis</Link>.</p></div>
      <div className="news-page-layout">
        <section className="news-update-feed" aria-label="Latest news bulletins">
          {updates.length ? updates.map(story => <article className="news-update-entry" key={story.id}>
            <div className="news-entry-meta">
              <span className="eyebrow">NEWS UPDATE</span>
              {story.publishedAt && <time dateTime={story.publishedAt}>{storyDate(story.publishedAt)}</time>}
            </div>
            <h2><Link href={'/articles/' + encodeURIComponent(story.slug)}>{story.headline}</Link></h2>
            {story.deck && <p>{story.deck}</p>}
            <Link className="news-entry-read" href={'/articles/' + encodeURIComponent(story.slug)}>READ UPDATE →</Link>
          </article>) : <div className="news-empty-state"><h2>{failed ? 'News updates temporarily unavailable' : 'Latest updates are coming soon'}</h2><p>{failed ? 'Please try again later.' : 'Our editorial desk will publish concise, verified developments here.'}</p></div>}
          {(hasPrevPage || hasNextPage) && <nav className="news-pagination" aria-label="Latest news pagination">
            {hasPrevPage && <Link href={page === 2 ? '/latest-news' : '/latest-news?page=' + (page - 1)}>← NEWER UPDATES</Link>}
            <span>PAGE {page}{totalDocs > 0 ? ' · ' + totalDocs + ' UPDATES' : ''}</span>
            {hasNextPage && <Link href={'/latest-news?page=' + (page + 1)}>OLDER UPDATES →</Link>}
          </nav>}
        </section>
        <aside className="news-page-aside" aria-label="Explore Faultline Brief">
          <section className="sidebar-panel"><h2>BEYOND THE HEADLINE</h2><p className="sidebar-intro">Short news updates explain immediate developments. Our analysis examines why they matter and what may come next.</p><Link href="/analysis">EXPLORE ANALYSIS →</Link></section>
          <section className="sidebar-panel"><h2>EXPLORE COVERAGE</h2><Link href="/categories/geopolitics">Geopolitics →</Link><Link href="/categories/conflict">Conflict →</Link><Link href="/categories/security">Security →</Link></section>
        </aside>
      </div>
    </main>
    <footer><strong>FAULTLINE BRIEF<span>.</span></strong><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Editorial Standards</Link></div></footer>
  </div>
}
