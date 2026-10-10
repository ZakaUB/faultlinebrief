import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SITE_URL = 'https://faultlinebrief.com'
const NEWS_NAMESPACE = 'http://www.google.com/schemas/sitemap-news/0.9'
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const MAX_ARTICLES = 1000

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export async function GET(): Promise<Response> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'articles' as any,
    where: {
      and: [
        { status: { equals: 'published' } },
        { publishedAt: { greater_than_equal: cutoff.toISOString() } },
        { publishedAt: { less_than_equal: now.toISOString() } },
      ],
    },
    sort: '-publishedAt',
    limit: MAX_ARTICLES,
    page: 1,
    depth: 0,
  })

  // A truncated News sitemap would silently omit fresh reporting.
  if (result.hasNextPage) {
    throw new Error('More than 1,000 recent news articles; split the News sitemap into multiple files.')
  }

  const items = (result.docs as Array<{ slug?: string | null; headline?: string | null; publishedAt?: string | null }>)
    .filter((article) => article.slug && article.headline && article.publishedAt)
    .map((article) => {
      const publicationDate = new Date(article.publishedAt!)
      if (Number.isNaN(publicationDate.getTime()) || publicationDate < cutoff || publicationDate > now) return ''
      const url = `${SITE_URL}/articles/${encodeURIComponent(article.slug!)}`
      return `  <url>
    <loc>${escapeXml(url)}</loc>
    <news:news>
      <news:publication>
        <news:name>Faultline Brief</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${publicationDate.toISOString()}</news:publication_date>
      <news:title>${escapeXml(article.headline!)}</news:title>
    </news:news>
  </url>`
    })
    .filter(Boolean)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="${SITEMAP_NAMESPACE}" xmlns:news="${NEWS_NAMESPACE}">
${items.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
