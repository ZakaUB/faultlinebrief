import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

const base = 'https://faultlinebrief.com'
const PAGE_SIZE = 500
const MAX_SITEMAP_URLS = 50_000

const fixedPaths = [
  '',
  '/about',
  '/contact',
  '/privacy',
  '/editorial-standards',
  '/categories/geopolitics',
  '/categories/conflict',
  '/categories/security',
  '/briefings/trump-iran-strikes-midterms',
  '/briefings/syria-saudi-houthi-escalation',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = fixedPaths.map((path) => ({
    url: base + path,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.5,
  }))

  // Never silently return a partial sitemap when the CMS is unavailable.
  // An error response can be retried by crawlers instead of being mistaken for
  // a complete sitemap with no published articles.
  const payload = await getPayload({ config })
  const entries: MetadataRoute.Sitemap = [...fixed]
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      page,
      limit: PAGE_SIZE,
      depth: 0,
      sort: '-publishedAt',
    })

    for (const article of result.docs) {
      if (!article.slug) continue
      const updated = article.updatedAt ? new Date(article.updatedAt) : undefined
      entries.push({
        url: `${base}/articles/${encodeURIComponent(article.slug)}`,
        ...(updated && !Number.isNaN(updated.getTime()) ? { lastModified: updated } : {}),
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }

    hasNextPage = result.hasNextPage
    page += 1

    if (hasNextPage && entries.length + PAGE_SIZE > MAX_SITEMAP_URLS) {
      throw new Error('Faultline Brief sitemap exceeds 50,000 URLs; split into sitemap files before publishing.')
    }
  }

  return entries
}
