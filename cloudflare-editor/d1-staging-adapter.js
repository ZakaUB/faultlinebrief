// Authenticated D1 editor adapter. Deployment config selects the database.
const parse = (value, fallback) => { try { return JSON.parse(value) } catch { return fallback } }
export function stagingDb(env) {
  if (!env.D1) throw new Error('editor-d1-binding-required')
  const articles = async (search = '') => {
    const term = String(search || '').trim().slice(0, 160)
    const query = term ? env.D1.prepare('SELECT id,slug,title,status,published_at,updated_at FROM migration_articles WHERE title LIKE ? OR slug LIKE ? ORDER BY updated_at DESC LIMIT 500').bind('%'+term+'%','%'+term+'%') : env.D1.prepare('SELECT id,slug,title,status,published_at,updated_at FROM migration_articles ORDER BY updated_at DESC LIMIT 500')
    const { results } = await query.all()
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
    return { ...meta.source_article, id:row.id,headline:row.title,slug:row.slug,status:row.status,published_at:row.published_at,deck:meta.deck||meta.source_article?.deck||'',editorialPlacement:meta.editorial_placement||'news',
      body:parse(row.content_json,{}), sources:parse(row.source_json,[]),
      featuredImage:parse(row.image_json,{}), categoryRelationships:meta.category_relationships || [] }
  }
  return {articles,categories,media,article}
}
