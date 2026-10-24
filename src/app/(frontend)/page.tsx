import HeaderGlobe from '@/app/(frontend)/HeaderGlobe'
import Brand from '@/app/(frontend)/Brand'
import SiteNav from '@/app/(frontend)/SiteNav'
import Link from 'next/link'
import OptimizedEditorialImage from '@/app/(frontend)/OptimizedEditorialImage'
import { belongsTo, getEditorialStories, getLatestNewsStories, imageFor, storyDate } from '@/app/(frontend)/newsroom'
import type { Story } from '@/app/(frontend)/newsroom'

export const dynamic = 'force-dynamic'

const coverageSections = [
  { slug: 'conflict', name: 'Conflicts', eyebrow: '01 / FLASHPOINTS', description: 'Wars, ceasefires and regional escalation.' },
  { slug: 'geopolitics', name: 'Geopolitics', eyebrow: '02 / GLOBAL POWER', description: 'Diplomacy, international competition and shifting alliances.' },
  { slug: 'security', name: 'Security', eyebrow: '03 / STRATEGIC RISKS', description: 'Deterrence, defense and emerging threats.' },
] as const

export default async function HomePage() {
  let analysis: Story[] = []
  let updates: Story[] = []
  try {
    [analysis, updates] = await Promise.all([getEditorialStories(100), getLatestNewsStories(5)])
  } catch (error) {
    console.error('[Faultline Brief] Homepage CMS query failed:', error)
  }
  // Preserve today's lead until the editor explicitly marks a Lead Story.
  const lead = analysis.find(story => story.editorialPlacement === 'lead') ?? analysis[0]
  const more = analysis.filter(story => story.editorialPlacement === 'featured' && story.id !== lead?.id).slice(0, 6)

  return (
    <div className="site">
      <div className="utility"><span>INDEPENDENT GEOPOLITICAL INTELLIGENCE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div>
      <header className="masthead">
        <div className="masthead-identity"><Brand /><p>Understand what happened. Know why it matters.</p></div>
        <HeaderGlobe />
      </header>
      <SiteNav />
      <main>
        <section className="section-heading"><span>THE FRONTLINE</span><span>INDEPENDENT ANALYSIS & REPORTING</span></section>
        {lead ? (
          <section className="lead-story">
            <div className="lead-copy">
              <span className="eyebrow">LEAD STORY</span>
              <h1><Link href={`/articles/${lead.slug}`}>{lead.headline}</Link></h1>
              <p>{lead.deck}</p>
              <Link className="read-link" href={`/articles/${lead.slug}`}>READ THE STORY →</Link>
            </div>
            {imageFor(lead) ? <OptimizedEditorialImage className="lead-image" src={imageFor(lead)!} alt={typeof lead.featuredImage === 'object' ? lead.featuredImage?.alt || lead.headline : lead.headline} width={900} height={530} sizes="(max-width: 700px) 92vw, (max-width: 1100px) 46vw, 600px" priority fetchPriority="high" loading="eager" /> : <div className="image-placeholder">FAULTLINE / BRIEF</div>}
          </section>
        ) : (
          <section className="lead-story"><div className="lead-copy"><span className="eyebrow">LATEST REPORTING</span><h1>Independent geopolitical reporting and analysis</h1><p>Published stories will appear here as they become available.</p></div></section>
        )}
        <section id="coverage" className="coverage">
          <div className="section-heading"><span>FEATURED REPORTING &amp; ANALYSIS</span><span>SIX FEATURED STORIES · ONE LEAD</span></div>
          <div className="homepage-newsroom-layout">
            <div className="homepage-newsroom-primary">
          {more.length > 0 ? (
            <div className="homepage-story-grid">
              {more.map(story => <article className="story-card story-card-overlay" key={story.id}>
                <Link className="story-card-overlay-link" href={`/articles/${story.slug}`}>
                  {imageFor(story) ? <OptimizedEditorialImage src={imageFor(story)!} alt={typeof story.featuredImage === 'object' ? story.featuredImage?.alt || story.headline : story.headline} width={480} height={600} sizes="(max-width: 700px) 92vw, (max-width: 900px) 46vw, (max-width: 1100px) 22vw, 24vw" /> : <span className="story-card-image-fallback" aria-hidden="true" />}
                  <span className="story-card-overlay-shade" aria-hidden="true" />
                  <h2>{story.headline}</h2>
                </Link>
              </article>)}
            </div>
          ) : (
            <p className="no-stories">New reporting will appear here as it is published.</p>
          )}
              <div className="homepage-all-analysis"><Link className="read-link" href="/analysis">BROWSE ALL REPORTING &amp; ANALYSIS →</Link></div>
            </div>
          <aside className="newsroom-sidebar" aria-label="Newsroom sidebar">
            <section className="sidebar-panel sidebar-latest-updates" aria-labelledby="homepage-latest-updates">
              <h2 id="homepage-latest-updates">LATEST UPDATES</h2>
              {updates.length ? (
                <ol className="sidebar-update-list">
                  {updates.slice(0, 5).map(story => <li key={story.id}>
                    {story.publishedAt && <time dateTime={story.publishedAt}>{storyDate(story.publishedAt)}</time>}
                    <Link href={'/articles/' + encodeURIComponent(story.slug)}>{story.headline}</Link>
                  </li>)}
                </ol>
              ) : <p className="sidebar-intro">Verified short news updates will appear here once published.</p>}
              <Link className="sidebar-more-link" href="/latest-news">ALL LATEST NEWS →</Link>
            </section>
            <section className="sidebar-panel"><h2>EXPLORE COVERAGE</h2>
              <Link href="/categories/geopolitics">Geopolitics →</Link>
              <Link href="/categories/conflict">Conflict →</Link>
              <Link href="/categories/security">Security →</Link>
            </section>
          </aside>
          </div>
        </section>
        <section className="homepage-discover" aria-labelledby="explore-coverage-title">
          <div className="section-heading"><span id="explore-coverage-title">EXPLORE THE FAULTLINES</span><span>FIVE LATEST ARTICLES PER CATEGORY</span></div>
          <div className="homepage-topic-grid">
            {coverageSections.map(section => {
              const recent = analysis.filter(story => belongsTo(story, section.slug)).slice(0, 5)
              return <article className="homepage-topic" key={section.slug}>
                <span className="eyebrow">{section.eyebrow}</span>
                <h2><Link href={'/categories/' + section.slug}>{section.name} →</Link></h2>
                <p>{section.description}</p>
                {recent.length ? <ul className="homepage-category-list">
                  {recent.map(story => <li key={story.id}><Link href={'/articles/' + encodeURIComponent(story.slug)}>{story.headline}</Link></li>)}
                </ul> : <p className="homepage-category-empty">Articles will appear here when assigned to this category.</p>}
                <Link className="homepage-category-more" href={'/categories/' + section.slug}>VIEW ALL {section.name.toUpperCase()} →</Link>
              </article>
            })}
          </div>
        </section>
        <section className="homepage-context" aria-labelledby="context-title">
          <span className="eyebrow">BEYOND THE HEADLINES</span>
          <h2 id="context-title">What happened. Why it matters. What comes next.</h2>
          <p>Faultline Brief connects breaking developments to the forces behind them, with clear reporting, context and evidence-led analysis.</p>
          <div className="homepage-context-links"><Link href="/latest-news">LATEST NEWS →</Link><Link href="/analysis">ALL ANALYSIS →</Link><Link href="/editorial-standards">OUR EDITORIAL STANDARDS →</Link></div>
          <p className="preferred-source-invite">Enjoy Faultline Brief? <a href="https://www.google.com/preferences/source?q=faultlinebrief.com" target="_blank" rel="noopener noreferrer">Add Faultline Brief as a Preferred Source on Google →</a></p>
        </section>
        <section id="about" className="about"><span className="eyebrow">OUR PURPOSE</span><h2>Beyond the headlines.<br/>Into the forces shaping them.</h2><p>Faultline Brief follows the geopolitical tensions, security challenges and conflicts shaping our world—with a commitment to clarity, context and evidence.</p></section>
      </main>
      <footer><strong>FAULTLINE BRIEF<span>.</span></strong><span>GEOPOLITICS / CONFLICT / SECURITY</span><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Editorial Standards</Link></div><span>© {new Date().getFullYear()} Faultline Brief</span></footer>
    </div>
  )
}
