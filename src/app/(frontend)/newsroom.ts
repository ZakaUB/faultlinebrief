import { getPayload } from 'payload'
import config from '@/payload.config'

export type Story = {
  id: number | string
  headline: string
  slug: string
  editorialPlacement?: 'lead' | 'featured' | 'news' | null
  deck?: string | null
  publishedAt?: string | null
  featuredImage?: { url?: string | null; alt?: string | null } | number | string | null
  categories?: Array<{ id?: number | string; name?: string; slug?: string } | number | string> | null
}

export function belongsTo(story: Story, slug: string) {
  return (story.categories ?? []).some(category => Boolean(category && typeof category === 'object' && category.slug === slug))
}

export function isLatestNews(story: Story) {
  return story.editorialPlacement === 'news' || (!story.editorialPlacement && belongsTo(story, 'latest-news'))
}

export function imageFor(story: Story): string | null {
  if (!story.featuredImage || typeof story.featuredImage !== 'object') return null
  const url = story.featuredImage.url
  if (!url) return null
  return url.startsWith('https://faultlinebrief.com/api/media/file/')
    ? url.replace('https://faultlinebrief.com', '')
    : url
}

async function queryStoriesByPlacement(placement: 'news' | 'editorial', limit: number): Promise<Story[]> {
  if (process.env.FAULTLINE_D1_READS === 'true') {
    const endpoint = process.env.FAULTLINE_D1_API_URL
    if (!endpoint) throw new Error('FAULTLINE_D1_API_URL must be set for D1 reads')
    const response = await fetch(endpoint.replace(/\/$/, '') + '/v1/articles?limit=100', { cache: 'no-store' })
    if (!response.ok) throw new Error('D1 article list request failed: ' + response.status)
    const data = await response.json() as { items: Array<Partial<Story>> }
    return data.items.filter(item => placement === 'news'
      ? item.editorialPlacement === 'news'
      : item.editorialPlacement !== 'news').slice(0, limit).map(item => ({
        ...item, id: item.slug!, slug: item.slug!, headline: item.headline!,
      })) as Story[]
  }
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'articles' as any,
    where: {
      and: [
        { status: { equals: 'published' } },
        { editorialPlacement: placement === 'news' ? { equals: 'news' } : { not_equals: 'news' } },
      ],
    },
    sort: '-publishedAt',
    depth: placement === 'news' ? 0 : 2,
    limit,
  })
  return result.docs as unknown as Story[]
}


// Read fresh published D1 listings on every request so CMS publication is visible
// on the homepage and Latest News without waiting for a server-side cache.
export function getEditorialStories(limit = 100) {
  return queryStoriesByPlacement('editorial', limit)
}

export function getLatestNewsStories(limit = 5) {
  return queryStoriesByPlacement('news', limit)
}

export function storyDate(date?: string | null) {
  if (!date) return ''
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return value.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi',
  })
}
