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
  publishedAt?: string | null
  featuredImage?: { url?: string | null; alt?: string | null } | number | null
  categories?: Array<{ name?: string; slug?: string } | number> | null
}

export default async function HomePage() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'articles' as any,
    where: { status: { equals: 'published' } },
    sort: '-publishedAt',
    depth: 2,
    limit: 20,
  })
  const stories = result.docs as unknown as Story[]
  const lead = stories[0]
  const more = stories.slice(1)

  const imageFor = (story: Story) =>
    typeof story.featuredImage === 'object' && story.featuredImage
      ? story.featuredImage.url
      : null

  return (
    <div className="site">
      <div className="utility"><span>INDEPENDENT GEOPOLITICAL INTELLIGENCE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div>
      <header className="masthead">
        <Brand />
        <p>Understand what happened. Know why it matters.</p>
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
          <section className="lead-story"><div className="lead-copy"><span className="eyebrow">LEAD STORY / CONFLICT</span><h1><Link href="/briefings/syria-saudi-houthi-escalation">Syria Weighs Military Support for Saudi Arabia as Houthi Attacks Widen Yemen War</Link></h1><p>Reported talks over possible Syrian support for Saudi Arabia raise questions about the wider risks of Yemen's conflict.</p><Link className="read-link" href="/briefings/syria-saudi-houthi-escalation">READ ANALYSIS →</Link></div><div className="image-placeholder">SYRIA / SAUDI ARABIA</div></section>
        )}
        <section id="coverage" className="coverage">
          <div className="section-heading"><span>LATEST BRIEFINGS</span><span>THE DEVELOPING PICTURE</span></div>
          {!lead && <div className="story-grid"><article className="story-card" style={{padding:24}}><span className="eyebrow">GEOPOLITICS / ANALYSIS</span><h2><Link href="/briefings/trump-iran-strikes-midterms">Trump Weighs New Iran Strikes Before U.S. Midterms</Link></h2><p>Pentagon planning, electoral pressures and the risk of escalation around the Strait of Hormuz.</p><Link className="read-link" href="/briefings/trump-iran-strikes-midterms">READ ANALYSIS →</Link></article></div>}
          {more.length ? <div className="story-grid">{more.map(story => <article className="story-card" key={story.id}>
            {imageFor(story) && <Link href={`/articles/${story.slug}`}><img src={imageFor(story)!} alt={story.headline}/></Link>}
            <span className="eyebrow">FAULTLINE BRIEF</span>
            <h2><Link href={`/articles/${story.slug}`}>{story.headline}</Link></h2>
            <p>{story.deck}</p>
            <Link className="read-link" href={`/articles/${story.slug}`}>READ MORE →</Link>
          </article>)}</div> : null}
        </section>
        <section id="about" className="about"><span className="eyebrow">OUR PURPOSE</span><h2>Beyond the headlines.<br/>Into the forces shaping them.</h2><p>Faultline Brief follows the geopolitical tensions, security challenges and conflicts shaping our world—with a commitment to clarity, context and evidence.</p></section>
      </main>
      <footer><strong>FAULTLINE BRIEF<span>.</span></strong><span>GEOPOLITICS / CONFLICT / SECURITY</span><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Editorial Standards</Link></div><span>© {new Date().getFullYear()} Faultline Brief</span></footer>
    </div>
  )
}
