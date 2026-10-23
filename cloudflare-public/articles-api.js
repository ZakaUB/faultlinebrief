// Public read-only D1 article API for the Cloudflare migration.
// Deploy only with a dedicated production D1 binding after the final production import.
// Do not expose the mixed staging database: it contains editorial test records.
const parse = (value, fallback) => { try { return JSON.parse(value) } catch { return fallback } }
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30', 'x-content-type-options': 'nosniff' },
})
export default {
  async fetch(request, env) {
    if (!env.PRODUCTION_D1 || env.PUBLIC_ARTICLES_ENABLED !== 'true') return response({ error: 'not-configured' }, 503)
    const url = new URL(request.url)
    if (request.method !== 'GET') return response({ error: 'method-not-allowed' }, 405)
    if (url.pathname === '/health') return response({ ok: true })
    if (url.pathname === '/v1/articles') {
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 40))
      const offset = Math.max(0, Math.min(1000000, Math.floor(Number(url.searchParams.get('offset')) || 0)))
      const { results } = await env.PRODUCTION_D1.prepare(
        "SELECT slug,title,published_at,updated_at,metadata_json,image_json FROM migration_articles WHERE status='published' ORDER BY published_at DESC, slug ASC LIMIT ? OFFSET ?"
      ).bind(limit, offset).all()
      const categories=await env.PRODUCTION_D1.prepare('SELECT id,slug,name FROM migration_categories').all()
      const byId=new Map(categories.results.map(category=>[String(category.id),category]))
      const expand=relations=>(Array.isArray(relations)?relations:[]).map(item=>{
        const id=typeof item==='object'&&item!==null?(item.categories_id??item.id):item
        return byId.get(String(id))||item
      })
      return response({ offset, limit, hasMore: results.length === limit, items: results.map(row => {
        const meta = parse(row.metadata_json, {})
        return { slug: row.slug, headline: row.title, publishedAt: row.published_at, updatedAt: row.updated_at,
          deck: meta.deck ?? null, editorialPlacement: meta.editorial_placement ?? null,
          categories: expand(meta.category_relationships),
          featuredImage: parse(row.image_json, null) }
      }) })
    }
    const match = url.pathname.match(/^\/v1\/articles\/([a-z0-9][a-z0-9-]{0,199})$/)
    if (!match) return response({ error: 'not-found' }, 404)
    const row = await env.PRODUCTION_D1.prepare(
      "SELECT slug,title,published_at,updated_at,content_json,metadata_json,source_json,image_json FROM migration_articles WHERE slug=? AND status='published'"
    ).bind(match[1]).first()
    if (!row) return response({ error: 'not-found' }, 404)
    const meta = parse(row.metadata_json, {})
    return response({ slug: row.slug, headline: row.title, publishedAt: row.published_at,
      updatedAt: row.updated_at, body: parse(row.content_json, {}), sources: parse(row.source_json, []),
      featuredImage: parse(row.image_json, null), deck: meta.deck ?? null,
      editorialPlacement: meta.editorial_placement ?? null, seoTitle: meta.seo_title ?? meta.source_article?.seo_title ?? null,
      seoDescription: meta.seo_description ?? meta.source_article?.seo_description ?? null, categoryRelationships: meta.category_relationships ?? [] })
  },
}
