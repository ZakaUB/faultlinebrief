import SiteNav from '@/app/(frontend)/SiteNav'
import Brand from '@/app/(frontend)/Brand'
import HeaderGlobe from '@/app/(frontend)/HeaderGlobe'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getEditorialStories, belongsTo } from '@/app/(frontend)/newsroom'
import { previews, storyPhotos } from '@/app/(frontend)/archive-preview/page'

export const dynamic = 'force-dynamic'

const sections: Record<string, { name: string; description: string }> = {
  geopolitics: { name: 'Geopolitics', description: 'The decisions, rivalries and diplomatic pressures shaping global affairs.' },
  conflict: { name: 'Conflict', description: 'Wars, escalation risks and the human and regional consequences of armed conflict.' },
  security: { name: 'Security', description: 'Defense, emerging threats and the changing architecture of international security.' },
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const section = sections[slug]
  if (!section) return { title: 'Category not found | Faultline Brief', robots: { index: false } }
  const title = `${section.name} News & Analysis | Faultline Brief`
  const description = `Latest ${section.name.toLowerCase()} reporting and analysis from Faultline Brief. ${section.description}`
  const url = `https://faultlinebrief.com/categories/${slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'Faultline Brief' },
    twitter: { card: 'summary', title, description },
  }
}

const publishedBriefings = [
  {
    slug: 'trump-iran-strikes-midterms',
    headline: 'Trump Weighs New Iran Strikes Before U.S. Midterms',
    deck: 'Washington weighs possible military action against Iran and the risks of further escalation.',
    categories: ['geopolitics', 'security'],
  },
  {
    slug: 'syria-saudi-houthi-escalation',
    headline: 'Syria Weighs Military Support for Saudi Arabia as Houthi Attacks Widen Yemen War',
    deck: 'Reported discussions of Syrian support for Saudi Arabia raise questions about Yemen’s widening conflict.',
    categories: ['conflict', 'geopolitics', 'security'],
  },
]

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const section = sections[slug]
  if (!section) notFound()

  type CmsArticle = { id: number | string; headline: string; slug: string; deck?: string }
  let articles: CmsArticle[] = []
  try {
    if (process.env.FAULTLINE_D1_READS === 'true') {
      articles = (await getEditorialStories(50000)).filter(story => belongsTo(story, slug)) as CmsArticle[]
    } else {
    const payload = await getPayload({ config })
    const categoryResult = await payload.find({
      collection: 'categories' as any,
      where: { slug: { equals: slug } },
      limit: 1,
    })
    const category = categoryResult.docs[0]
    if (category) {
      const result = await payload.find({
        collection: 'articles' as any,
        where: {
          and: [
            { status: { equals: 'published' } },
            { categories: { in: [category.id] } },
          ],
        },
        sort: '-publishedAt',
        limit: 100,
        depth: 1,
      })
      articles = result.docs as unknown as CmsArticle[]
    }
    }
  } catch (error) {
    console.error('[Faultline Brief] Category CMS query failed; serving existing briefings:', error)
  }

  const existingBriefings = publishedBriefings.filter(story => story.categories.includes(slug))
  const historicalPreviews = previews
    .map((story, index) => ({ ...story, photo: storyPhotos[index] }))
    .filter(story => story.category.toLowerCase() === slug)

  return <div className="site">
    <div className="utility"><span>INDEPENDENT GEOPOLITICAL INTELLIGENCE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div>
    <header className="masthead">
      <div className="masthead-identity"><Brand /><p>Understand what happened. Know why it matters.</p></div>
      <HeaderGlobe />
    </header>
    <SiteNav />
    <main className="coverage category-page">
      <div className="section-heading"><span>{section.name.toUpperCase()}</span><span>FAULTLINE BRIEF / COVERAGE</span></div>
      <div className="empty-state"><h1>{section.name}</h1><p>{section.description}</p></div>
      <div className="story-grid">
        {articles.filter(story => !existingBriefings.some(briefing => briefing.slug === story.slug)).map(story => <article className="story-card" key={story.id}>
          <span className="eyebrow">{section.name.toUpperCase()} / PUBLISHED</span>
          <h2><Link href={`/articles/${story.slug}`}>{story.headline}</Link></h2>
          <p>{story.deck}</p>
          <Link className="read-link" href={`/articles/${story.slug}`}>READ MORE →</Link>
        </article>)}
      </div>
      <div className="section-heading" style={{ marginTop: 32 }}><span>EARLIER BRIEFINGS</span><span>EDITORIAL ARCHIVE</span></div>
      <div className="story-grid">
        {existingBriefings.map(story => <article className="story-card" key={story.slug}>
          <span className="eyebrow">{section.name.toUpperCase()} / ANALYSIS</span>
          <h2><Link href={`/briefings/${story.slug}`}>{story.headline}</Link></h2>
          <p>{story.deck}</p>
          <Link className="read-link" href={`/briefings/${story.slug}`}>READ FULL ANALYSIS →</Link>
        </article>)}
      </div>
      {historicalPreviews.length > 0 && <>
        <div className="section-heading" style={{ marginTop: 32 }}>
          <span>HISTORICAL ARCHIVE PREVIEWS</span><span>NOT PUBLISHED ARTICLES</span>
        </div>
        <div className="story-grid">
          {historicalPreviews.map(story => <article className="story-card" key={story.headline}>
            <Image src={story.photo.src} alt={story.photo.caption} width={640} height={360} quality={65} sizes="(max-width: 760px) 100vw, 45vw" style={{ width: '100%', height: 'auto', aspectRatio: '16 / 9', objectFit: 'cover' }} />
            <span className="eyebrow">{story.category.toUpperCase()} / ARCHIVE PREVIEW</span>
            <h2>{story.headline}</h2>
            <p>{story.deck}</p>
            <span className="eyebrow">HISTORICAL MATERIAL · NOT A PUBLISHED ARTICLE</span>
          </article>)}
        </div>
      </>}
    </main>
    <footer><strong>FAULTLINE BRIEF<span>.</span></strong><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Editorial Standards</Link></div></footer>
  </div>
}
