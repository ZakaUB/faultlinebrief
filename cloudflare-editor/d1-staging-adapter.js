// Isolated D1 adapter for the custom Cloudflare editor. Never bind this to production.
const parse = (value, fallback) => { try { return JSON.parse(value) } catch { return fallback } }
export function stagingDb(env) {
  if (!env.D1 || env.D1.databaseName && env.D1.databaseName !== 'faultlinebrief-d1-staging') throw new Error('isolated-staging-d1-required')
  const articles = async () => {
    const { results } = await env.D1.prepare('SELECT id,slug,title,status,published_at,updated_at FROM migration_articles ORDER BY updated_at DESC LIMIT 25').all()
    return results.map(a => ({ id:a.id,headline:a.title,slug:a.slug,status:a.status,published_at:a.published_at,updated_at:a.updated_at }))
  }
  const categories = async () => {
    const { results } = await env.D1.prepare('SELECT id,slug,name,raw_json FROM migration_categories ORDER BY name LIMIT 100').all()
    return results.map(c => ({...parse(c.raw_json,{}),id:c.id,name:c.name,slug:c.slug}))
  }
  const media = async () => {
    const { results } = await env.D1.prepare('SELECT id,raw_json FROM migration_media ORDER BY id DESC LIMIT 100').all()
    return results.map(m => ({...parse(m.raw_json,{}),id:m.id}))
  }
  const article = async id => {
    const row = await env.D1.prepare('SELECT * FROM migration_articles WHERE id=?').bind(String(id)).first()
    if (!row) return null
    const meta=parse(row.metadata_json,{})
    return { ...meta.source_article, id:row.id,headline:row.title,slug:row.slug,status:row.status,
      body:parse(row.content_json,{}), sources:parse(row.source_json,[]),
      featuredImage:parse(row.image_json,{}), categoryRelationships:meta.category_relationships || [] }
  }
  return {articles,categories,media,article}
}
