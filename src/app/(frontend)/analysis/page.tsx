import Brand from '@/app/(frontend)/Brand'
import HeaderGlobe from '@/app/(frontend)/HeaderGlobe'
import SiteNav from '@/app/(frontend)/SiteNav'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Story } from '@/app/(frontend)/newsroom'
import { getPublishedStories, isLatestNews, storyDate } from '@/app/(frontend)/newsroom'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'All Reporting & Analysis | Faultline Brief',
  description: 'Browse Faultline Brief’s published geopolitical reporting and analysis across international affairs, conflict and security.',
  alternates: { canonical: 'https://faultlinebrief.com/analysis' },
  openGraph: { title: 'All Reporting & Analysis | Faultline Brief', description: 'Browse the Faultline Brief archive of in-depth geopolitical reporting.', url: 'https://faultlinebrief.com/analysis', type: 'website', siteName: 'Faultline Brief' },
}

export default async function AnalysisArchivePage() {
  let stories: Story[] = []
  let failed = false
  try {
    stories = (await getPublishedStories(500)).filter(story => !isLatestNews(story))
  } catch (error) {
    failed = true
    console.error('[Faultline Brief] Analysis archive query failed:', error)
  }
  return <div className="site">
    <div className="utility"><span>FAULTLINE BRIEF / ANALYSIS ARCHIVE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div>
    <header className="masthead"><div className="masthead-identity"><Brand /><p>Understand what happened. Know why it matters.</p></div><HeaderGlobe /></header>
    <SiteNav />
    <main className="news-archive-page">
      <div className="section-heading"><span>ALL REPORTING &amp; ANALYSIS</span><span>THE FAULTLINE BRIEF ARCHIVE</span></div>
      <div className="news-page-intro"><span className="eyebrow">FAULTLINE BRIEF / LONG-FORM REPORTING</span><h1>Reporting &amp; Analysis</h1><p>Browse in-depth articles beyond the six featured on the homepage. For short developments, visit <Link href="/latest-news">Latest News</Link>.</p></div>
      <section className="news-update-feed" aria-label="Reporting and analysis archive">
        {stories.length ? stories.map(story => <article className="news-update-entry" key={story.id}>
          <div className="news-entry-meta"><span className="eyebrow">REPORTING &amp; ANALYSIS</span>{story.publishedAt && <time dateTime={story.publishedAt}>{storyDate(story.publishedAt)}</time>}</div>
          <h2><Link href={'/articles/' + encodeURIComponent(story.slug)}>{story.headline}</Link></h2>
          {story.deck && <p>{story.deck}</p>}
          <Link className="news-entry-read" href={'/articles/' + encodeURIComponent(story.slug)}>READ THE STORY →</Link>
        </article>) : <div className="news-empty-state"><h2>{failed ? 'Archive temporarily unavailable' : 'Reporting coming soon'}</h2><p>{failed ? 'Please try again later.' : 'Published reporting will appear here.'}</p></div>}
      </section>
    </main>
    <footer><strong>FAULTLINE BRIEF<span>.</span></strong><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Editorial Standards</Link></div></footer>
  </div>
}
