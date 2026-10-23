import Link from 'next/link'

type RelatedArticle = {
  slug: string
  headline: string
  categories?: Array<string | number | { id?: string | number }>
}

export default async function RelatedCoverage({ currentSlug, currentCategories }: { currentSlug: string; currentCategories?: Array<string | number> }) {
  if (process.env.FAULTLINE_D1_READS !== 'true') return null
  const endpoint = process.env.FAULTLINE_D1_API_URL
  if (!endpoint) return null
  let articles: RelatedArticle[] = []
  try {
    const response = await fetch(endpoint.replace(/\/$/, '') + '/v1/articles?limit=100', { next: { revalidate: 60 } })
    if (!response.ok) return null
    const data = await response.json() as { items?: RelatedArticle[] }
    articles = (data.items || []).filter(item => item.slug && item.headline && item.slug !== currentSlug)
  } catch {
    return null
  }
  const ids = new Set((currentCategories || []).map(String))
  const matchCount = (item: RelatedArticle) => (item.categories || []).filter(category => ids.has(String(typeof category === 'object' ? category?.id : category))).length
  articles.sort((a, b) => matchCount(b) - matchCount(a))
  const related = articles.slice(0, 3)
  if (!related.length) return null
  return (
    <section className="related-coverage" aria-labelledby="related-coverage-heading">
      <h2 id="related-coverage-heading">Related Coverage</h2>
      <ul>{related.map(item => <li key={item.slug}><Link href={`/articles/${encodeURIComponent(item.slug)}`}>{item.headline}</Link></li>)}</ul>
    </section>
  )
}
