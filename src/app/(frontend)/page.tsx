import HeaderGlobe from '@/app/(frontend)/HeaderGlobe'
import Brand from '@/app/(frontend)/Brand'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import Image from 'next/image'
import { previews, storyPhotos } from './archive-preview/page'

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
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'articles' as any,
    where: { status: { equals: 'published' } },
    sort: '-publishedAt',
    depth: 2,
    limit: 20,
  })
  const stories = result.docs as unknown as Story[]
  const featured = await payload.find({
    collection: 'articles' as any,
    where: { and: [{ status: { equals: 'published' } }, { homepageLead: { equals: true } }] },
    sort: '-updatedAt',
    depth: 2,
    limit: 1,
  })
  const lead = (featured.docs as unknown as Story[])[0] ?? stories[0]
  const more = stories.filter(story => story.id !== lead?.id)

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
          <section className="lead-story"><div className="lead-copy"><span className="eyebrow">LEAD STORY / GEOPOLITICS</span><h1><Link href="/briefings/trump-iran-strikes-midterms">Trump Weighs New Iran Strikes Before U.S. Midterms</Link></h1><p>The Pentagon is preparing possible strikes against Iran ahead of the November elections. No final decision has been made, as Washington weighs the military, economic and diplomatic risks.</p><Link className="read-link" href="/briefings/trump-iran-strikes-midterms">READ FULL ANALYSIS →</Link></div><div className="lead-image" style={{position:"relative",overflow:"hidden",aspectRatio:"16 / 9",height:"auto"}}><Image src="https://commons.wikimedia.org/wiki/Special:FilePath/January%202025%20Official%20Presidential%20Portrait%20of%20Donald%20J.%20Trump.jpg?width=960" alt="Official presidential portrait of Donald Trump, January 2025; archival image, not a photograph of the reported Iran strike planning" fill priority sizes="(max-width: 800px) 100vw, 48vw" style={{objectFit:"cover",objectPosition:"center 24%"}} /></div></section>
        )}
        <section id="coverage" className="coverage">
          <div className="section-heading"><span>LATEST ANALYSIS &amp; ARCHIVE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div>
          <div className="newsroom-layout">
            <div className="newsroom-primary">
              <div className="story-grid">
                {!lead && <article className="story-card" style={{padding:24}}>
                  <div style={{position:"relative",aspectRatio:"16 / 9",marginBottom:16,overflow:"hidden",borderRadius:12}}><Image src="https://commons.wikimedia.org/wiki/Special:FilePath/President%20Donald%20Trump%20with%20Saudi%20Crown%20Prince%20Mohammed%20Bin%20Salman%20and%20President%20of%20Syria%20Ahmed%20al-Sharaa%20%282025%29.jpg?width=1280" alt="Ahmad al-Sharaa meeting Mohammed bin Salman, with Donald Trump present, May 2025; archival diplomatic photo" fill sizes="(max-width: 760px) 100vw, 45vw" style={{objectFit:"cover",objectPosition:"center 32%"}} /></div>
                  <span className="eyebrow">CONFLICT / ANALYSIS</span>
                  <h2><Link href="/briefings/syria-saudi-houthi-escalation">Syria Weighs Military Support for Saudi Arabia as Houthi Attacks Widen Yemen War</Link></h2>
                  <p>Reported discussions over possible Syrian support for Saudi Arabia raise questions about the regional risks of Yemen's conflict.</p>
                  <Link className="read-link" href="/briefings/syria-saudi-houthi-escalation">READ ANALYSIS →</Link>
                </article>}
                {more.map(story => <article className="story-card" key={story.id}>
                  {imageFor(story) && <Link href={`/articles/${story.slug}`}><img src={imageFor(story)!} alt={story.headline}/></Link>}
                  <span className="eyebrow">PUBLISHED / FAULTLINE BRIEF</span>
                  <h2><Link href={`/articles/${story.slug}`}>{story.headline}</Link></h2>
                  <p>{story.deck}</p><Link className="read-link" href={`/articles/${story.slug}`}>READ MORE →</Link>
                </article>)}
                {previews.map((story,i)=><article className="story-card" key={story.headline}>
                  <Link href={`/archive-preview/category/${story.category.toLowerCase()}`}><Image src={storyPhotos[i].src} alt={storyPhotos[i].caption} width={640} height={360} quality={65} sizes="(max-width: 760px) 100vw, (max-width: 1000px) 48vw, 32vw" style={{width:"100%",height:"auto",aspectRatio:"16 / 9",objectFit:"cover"}} /></Link>
                  <span className="eyebrow">{story.category.toUpperCase()} / ARCHIVE PREVIEW</span>
                  <h2><Link href={`/archive-preview/category/${story.category.toLowerCase()}`}>{story.headline}</Link></h2>
                  <p>{story.deck}</p>
                  <span className="eyebrow">HISTORICAL MATERIAL · NOT A PUBLISHED ARTICLE</span>
                </article>)}
              </div>
            </div>
            <aside className="newsroom-sidebar" aria-label="Newsroom sidebar">
              <section className="sidebar-panel"><h2>EDITOR'S PICKS</h2>
                <p><Link href="/briefings/trump-iran-strikes-midterms">Trump Weighs New Iran Strikes Before U.S. Midterms →</Link></p>
                <p><Link href="/briefings/syria-saudi-houthi-escalation">Syria and Saudi Arabia: Regional Escalation →</Link></p>
                <p><Link href="/archive-preview/category/conflict">Yemen and the Bab el-Mandeb →</Link></p>
              </section>
              <div className="ad-slot ad-sidebar"><span>ADVERTISEMENT</span><small>SIDEBAR · 300 × 250</small></div>
              <section className="sidebar-panel"><h2>EXPLORE COVERAGE</h2><Link href="/archive-preview/category/geopolitics">Geopolitics →</Link><Link href="/archive-preview/category/conflict">Conflict →</Link><Link href="/archive-preview/category/security">Security →</Link></section>
            </aside>
          </div>
        </section>
        <section id="about" className="about"><span className="eyebrow">OUR PURPOSE</span><h2>Beyond the headlines.<br/>Into the forces shaping them.</h2><p>Faultline Brief follows the geopolitical tensions, security challenges and conflicts shaping our world—with a commitment to clarity, context and evidence.</p></section>
      </main>
      <footer><strong>FAULTLINE BRIEF<span>.</span></strong><span>GEOPOLITICS / CONFLICT / SECURITY</span><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Editorial Standards</Link></div><span>© {new Date().getFullYear()} Faultline Brief</span></footer>
    </div>
  )
}
