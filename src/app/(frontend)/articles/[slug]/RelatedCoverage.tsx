import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'

export default async function RelatedCoverage({ currentSlug, currentCategory }: { currentSlug: string; currentCategory?: string | number }) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'articles' as any,
    where: { and: [{ status: { equals: 'published' } }, { slug: { not_equals: currentSlug } }] },
    sort: '-publishedAt',
    limit: 12,
    depth: 0,
  })
  const articles = (result.docs as any[]).filter(item => item.slug && item.headline)
  articles.sort((a, b) => {
    const ac = typeof a.category === 'object' ? a.category?.id : a.category
    const bc = typeof b.category === 'object' ? b.category?.id : b.category
    return Number(bc != null && bc === currentCategory) - Number(ac != null && ac === currentCategory)
  })
  const related = articles.slice(0, 3)
  if (!related.length) return null
  return (
    <section className="related-coverage" aria-labelledby="related-coverage-heading">
      <h2 id="related-coverage-heading">Related Coverage</h2>
      <ul>
        {related.map(item => (
          <li key={item.slug}>
            <Link href={`/articles/${encodeURIComponent(item.slug)}`}>{item.headline}</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
