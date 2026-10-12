import { getPayload } from 'payload'
import config from '@/payload.config'

export type Story = {
  id: number | string
  headline: string
  slug: string
  deck?: string | null
  publishedAt?: string | null
  featuredImage?: { url?: string | null; alt?: string | null } | number | string | null
  categories?: Array<{ id?: number | string; name?: string; slug?: string } | number | string> | null
}

export function belongsTo(story: Story, slug: string) {
  return (story.categories ?? []).some(category => Boolean(category && typeof category === 'object' && category.slug === slug))
}

export function isLatestNews(story: Story) {
  return belongsTo(story, 'latest-news')
}

export function imageFor(story: Story): string | null {
  if (!story.featuredImage || typeof story.featuredImage !== 'object') return null
  const url = story.featuredImage.url
  if (!url) return null
  return url.startsWith('https://faultlinebrief.com/api/media/file/')
    ? url.replace('https://faultlinebrief.com', '')
    : url
}

export async function getPublishedStories(limit = 100): Promise<Story[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'articles' as any,
    where: { status: { equals: 'published' } },
    sort: '-publishedAt',
    depth: 2,
    limit,
  })
  return result.docs as unknown as Story[]
}

export function storyDate(date?: string | null) {
  if (!date) return ''
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return value.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi',
  })
}
