import HeaderGlobe from '@/app/(frontend)/HeaderGlobe'
import Brand from '@/app/(frontend)/Brand'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

type Story = {
  id: number
  headline: string
  slug: string
  deck: string
  homepageLead?: boolean | null
  publishedAt?: string | null
  featuredImage?: { url?: string | null; alt?: string | null } | number | null
  categories?: Array<{ name?: string; slug?: string } | number> | null
}

export default async function HomePage() {
  // The editorial fallback must remain available if Payload/Neon is temporarily
  // unavailable or the CMS schema has not been migrated yet.
  let stories: Story[] = []
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'articles' as any,
      where: { status: { equals: 'published' } },
      sort: '-publishedAt',
      depth: 2,
      limit: 9,
    })
    stories = result.docs as unknown as Story[]
  } catch (error) {
    console.error('[Faultline Brief] Homepage CMS query failed; serving editorial fallback:', error)
  }
  stories.sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))
  const lead = stories[0]
  const more = stories.filter(story => story.id !== lead?.id).slice(0, 8)

  const imageFor = (story: Story) =>
    typeof story.featuredImage === 'object' && story.featuredImage
      ? story.featuredImage.url
      : null

  return (
    <div className="site">
      <div className="utility"><span>INDEPENDENT GEOPOLITICAL INTELLIGENCE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div>
      <header className="masthead">
        <div className="masthead-identity"><Brand /><p>Understand what happened. Know why it matters.</p></div>
        <HeaderGlobe />
      </header>
      <nav className="nav" aria-label="Main navigation">
        <Link href="/">Latest</Link><Link href="/categories/geopolitics">Geopolitics</Link><Link href="/categories/conflict">Conflict</Link><Link href="/categories/security">Security</Link><Link href="/about">About</Link>
      </nav>
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
            {imageFor(lead) ? <img className="lead-image" src={imageFor(lead)!} alt={typeof lead.featuredImage === 'object' ? lead.featuredImage?.alt || lead.headline : lead.headline} /> : <div className="image-placeholder">FAULTLINE / BRIEF</div>}
          </section>
        ) : (
          <section className="lead-story"><div className="lead-copy"><span className="eyebrow">LATEST REPORTING</span><h1>Independent geopolitical reporting and analysis</h1><p>Published stories will appear here as they become available.</p></div></section>
        )}
        <section id="coverage" className="coverage">
          <div className="section-heading"><span>LATEST REPORTING &amp; ANALYSIS</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div>
          {more.length > 0 ? (
            <div className="homepage-story-grid">
              {more.map(story => <article className="story-card" key={story.id}>
                {imageFor(story) && <Link href={`/articles/${story.slug}`}><img src={imageFor(story)!} alt={typeof story.featuredImage === 'object' ? story.featuredImage?.alt || story.headline : story.headline}/></Link>}
                <span className="eyebrow">FAULTLINE BRIEF / REPORTING</span>
                <h2><Link href={`/articles/${story.slug}`}>{story.headline}</Link></h2>
                <p>{story.deck}</p>
                <Link className="read-link" href={`/articles/${story.slug}`}>READ MORE →</Link>
              </article>)}
            </div>
          ) : (
            <p className="no-stories">New reporting will appear here as it is published.</p>
          )}
        </section>
        <section className="homepage-discover" aria-labelledby="explore-coverage-title">
          <div className="section-heading"><span id="explore-coverage-title">EXPLORE THE FAULTLINES</span><span>THREE CORE COVERAGE AREAS</span></div>
          <div className="homepage-topic-grid">
            <article className="homepage-topic"><span className="eyebrow">01 / GLOBAL POWER</span><h2><Link href="/categories/geopolitics">Geopolitics →</Link></h2><p>Diplomacy, international rivalries and the decisions reshaping the world order.</p></article>
            <article className="homepage-topic"><span className="eyebrow">02 / FLASHPOINTS</span><h2><Link href="/categories/conflict">Conflict →</Link></h2><p>Wars, ceasefires and the regional consequences of escalating violence.</p></article>
            <article className="homepage-topic"><span className="eyebrow">03 / STRATEGIC RISKS</span><h2><Link href="/categories/security">Security →</Link></h2><p>Defense, deterrence, maritime chokepoints and emerging security threats.</p></article>
          </div>
        </section>
        <section className="homepage-context" aria-labelledby="context-title">
          <span className="eyebrow">BEYOND THE HEADLINES</span>
          <h2 id="context-title">What happened. Why it matters. What comes next.</h2>
          <p>Faultline Brief connects breaking developments to the forces behind them, with clear reporting, context and evidence-led analysis.</p>
          <div className="homepage-context-links"><Link href="/about">ABOUT FAULTLINE BRIEF →</Link><Link href="/editorial-standards">OUR EDITORIAL STANDARDS →</Link></div>
        </section>
        <section id="about" className="about"><span className="eyebrow">OUR PURPOSE</span><h2>Beyond the headlines.<br/>Into the forces shaping them.</h2><p>Faultline Brief follows the geopolitical tensions, security challenges and conflicts shaping our world—with a commitment to clarity, context and evidence.</p></section>
      </main>
      <footer><strong>FAULTLINE BRIEF<span>.</span></strong><span>GEOPOLITICS / CONFLICT / SECURITY</span><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Editorial Standards</Link></div><span>© {new Date().getFullYear()} Faultline Brief</span></footer>
    </div>
  )
}
