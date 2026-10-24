import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const BASE = 'https://faultlinebrief.com'
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
type Entry = { slug?: string | null; headline?: string | null; deck?: string | null; publishedAt?: string | null; updatedAt?: string | null }

export async function GET(): Promise<Response> {
  let items: Entry[]
  if (process.env.FAULTLINE_D1_READS === 'true') {
    const endpoint = process.env.FAULTLINE_D1_API_URL
    if (!endpoint) throw new Error('FAULTLINE_D1_API_URL must be set')
    const response = await fetch(endpoint.replace(/\/$/, '') + '/v1/articles?limit=100', { cache: 'no-store' })
    if (!response.ok) throw new Error('RSS article query failed: ' + response.status)
    const data = await response.json() as { items?: Entry[] }
    if (!Array.isArray(data.items)) throw new Error('Invalid RSS article response')
    items = data.items
  } else {
    const payload = await getPayload({ config })
    const result = await payload.find({ collection: 'articles' as any, where: { status: { equals: 'published' } }, sort: '-publishedAt', limit: 100, depth: 0 })
    items = result.docs as Entry[]
  }
  const entries = items.filter(item => item.slug && item.headline && item.publishedAt && !Number.isNaN(Date.parse(item.publishedAt)))
    .slice(0, 50).map(item => {
      const link = BASE + '/articles/' + encodeURIComponent(item.slug!)
      const description = item.deck ? '<description>' + escapeXml(item.deck) + '</description>' : ''
      return '<item><title>' + escapeXml(item.headline!) + '</title><link>' + escapeXml(link) + '</link><guid isPermaLink="true">' + escapeXml(link) + '</guid><pubDate>' + new Date(item.publishedAt!).toUTCString() + '</pubDate>' + description + '</item>'
    }).join('')
  const xml = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Faultline Brief — Latest Reporting</title><link>' + BASE + '</link><description>Independent geopolitics, conflict and security reporting</description><language>en</language><lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>' + entries + '</channel></rss>'
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } })
}
