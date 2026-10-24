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
  let articles: Array<{ slug?: string | null; headline?: string | null; publishedAt?: string | null }>
  if (process.env.FAULTLINE_D1_READS === 'true') {
    const endpoint = process.env.FAULTLINE_D1_API_URL
    if (!endpoint) throw new Error('FAULTLINE_D1_API_URL must be set for D1 reads')
    articles = []
    for (let offset = 0; offset < 10000; offset += 100) {
      const response = await fetch(endpoint.replace(/\/$/, '') + '/v1/articles?limit=100&offset=' + offset, { cache: 'no-store' })
      if (!response.ok) throw new Error('D1 news sitemap request failed: ' + response.status)
      const data = await response.json() as { items: typeof articles }
      if (!Array.isArray(data.items)) throw new Error('Invalid D1 news sitemap response')
      articles.push(...data.items)
      // Public API sorts newest first; stop once the last item is older than 48 hours.
      if (data.items.length < 100 || (data.items[data.items.length - 1]?.publishedAt && new Date(data.items[data.items.length - 1].publishedAt!) < cutoff)) break
      if (offset >= 9900) throw new Error('News sitemap scan limit reached')
    }
  } else {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'articles' as any,
      where: { and: [
        { status: { equals: 'published' } },
        { publishedAt: { greater_than_equal: cutoff.toISOString() } },
        { publishedAt: { less_than_equal: now.toISOString() } },
      ] },
      sort: '-publishedAt', limit: MAX_ARTICLES, page: 1, depth: 0,
    })
    if (result.hasNextPage) throw new Error('More than 1,000 recent news articles; split the News sitemap into multiple files.')
    articles = result.docs as typeof articles
  }

  const recentCount = articles.filter(article => article.publishedAt && new Date(article.publishedAt) >= cutoff && new Date(article.publishedAt) <= now).length
  if (recentCount > MAX_ARTICLES) throw new Error('News sitemap exceeds 1,000 articles; split into multiple files')
  const items = articles
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
