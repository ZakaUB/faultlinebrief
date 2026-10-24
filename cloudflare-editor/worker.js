import { stagingDb } from './d1-staging-adapter.js'
import { adminHtml } from './admin-page.js'

// Preserve semantic headings and inline emphasis when a newsroom article is pasted.
// Input is treated as text, never trusted HTML; public rendering escapes it.
const inlineNodes = value => {
  const nodes = []
  const pattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g
  let last = 0, match
  const leaf = (text, format = 0) => ({type:'text',text,detail:0,format,mode:'normal',style:'',version:1})
  while ((match = pattern.exec(value))) {
    if (match.index > last) nodes.push(leaf(value.slice(last,match.index)))
    if (match[1]) nodes.push(leaf(match[1],1))
    else if (match[2]) nodes.push(leaf(match[2],2))
    else if (match[3]) nodes.push({type:'link',version:3,fields:{url:match[4],newTab:true,linkType:'custom'},children:[leaf(match[3])]})
    last = pattern.lastIndex
  }
  if (last < value.length) nodes.push(leaf(value.slice(last)))
  return nodes.length ? nodes : [leaf('')]
}
const articleLexical = value => {
  const text = String(value || '').replace(/\r\n?/g,'\n').replace(/\\n/g,'\n')
  const blocks = text.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean)
  const children = blocks.map(block => {
    const m = block.match(/^(#{2,4})\s+([^\n]+)$/)
    const tag = m ? 'h'+m[1].length : 'p'
    const value = m ? m[2] : block
    return {type:m?'heading':'paragraph',...(m?{tag}:{}),format:'',indent:0,version:1,direction:'ltr',children:inlineNodes(value)}
  })
  return {root:{type:'root',format:'',indent:0,version:1,direction:'ltr',children}}
}
const lexicalPlainText = body => (body?.root?.children || []).map(n => (n.type==='heading' ? '## ' : '')+(n.children||[]).map(c=>c.text??(c.children||[]).map(t=>t.text||'').join('')).join('')).join('\n\n')

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
    const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'Content-Type': 'application/json', ...extra } })
    if (!env.EDITOR_BOOTSTRAP_PASSWORD || env.EDITOR_BOOTSTRAP_PASSWORD.length < 24 || !env.EDITOR_SESSION_SECRET || env.EDITOR_SESSION_SECRET.length < 32 || !env.R2) return json({ ok: false, error: 'staging-configuration' }, 503)
    // Production preflight is strictly read-only until an explicitly reviewed cutover.
    if (env.EDITOR_PRODUCTION_MODE === 'read-only' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return json({ok:false,error:'production-writes-disabled'},405)
    const encoder = new TextEncoder()
    const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
    const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
    const equal = (a, b) => { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0); return diff === 0 }
    const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)fb_editor=([a-f0-9]{64})(?:;|$)/)?.[1]
    const sessionKey = async token => 'editor-auth/sessions/' + hex(await digest(env.EDITOR_SESSION_SECRET + ':' + token))
    const authenticated = async () => {
      if (!cookie) return false
      const object = await env.R2.get(await sessionKey(cookie))
      if (!object) return false
      const expires = Number(await object.text())
      return Number.isFinite(expires) && expires > Date.now()
    }
    if ((url.pathname === '/' || url.pathname === '/admin') && request.method === 'GET') {
      return new Response(adminHtml, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } })
    }
    // D1 staging mode: preserve the existing CMS interface and authentication.
    // Only read endpoints are enabled until D1-safe editorial writes are implemented.
    if (env.D1 && (url.pathname === '/articles' || url.pathname === '/categories' || url.pathname === '/editor/media-library' || url.pathname.startsWith('/editor/articles/') && request.method === 'GET')) {
      if (!await authenticated()) return json({ ok:false,error:'unauthorized' },401)
      if (request.method !== 'GET') return json({ ok:false,error:'d1-write-not-enabled' },405)
      try {
        const db=stagingDb(env)
        if (url.pathname === '/articles') { const items=await db.articles();return json({ok:true,items,count:items.length}) }
        if (url.pathname === '/categories') { const items=await db.categories();return json({ok:true,items,count:items.length}) }
        if (url.pathname === '/editor/media-library') { const items=await db.media();return json({ok:true,items,count:items.length}) }
        const article=await db.article(url.pathname.split('/').pop())
        return article?json({ok:true,article}):json({ok:false,error:'article-not-found'},404)
      } catch { return json({ok:false,error:'staging-d1-read-failed'},503) }
    }
    if (env.D1 && ((url.pathname === '/editor/articles' && request.method === 'POST') || (url.pathname.startsWith('/editor/articles/') && request.method === 'PATCH'))) {
      if (!await authenticated()) return json({ok:false,error:'unauthorized'},401)
      // Strictly limit D1 writes to disposable test articles; imported records remain immutable.
      try {
        const input=await request.json()
        if (!input || typeof input!=='object') return json({ok:false,error:'invalid-json'},400)
        const existingForEdit = request.method === 'PATCH' ? await env.D1.prepare('SELECT slug,content_json,metadata_json,image_json FROM migration_articles WHERE id=?').bind(url.pathname.split('/').pop()).first() : null
        const slug=String(input.slug||existingForEdit?.slug||'')
        if (!(env.EDITOR_PRODUCTION_MODE === 'live' ? /^[a-z0-9][a-z0-9-]{1,159}$/.test(slug) : /^cf-staging-test-[a-z0-9-]{1,80}$/.test(slug))) return json({ok:false,error:'invalid-slug'},405)
        const title=String(input.headline||input.title||'').trim()
        if (!title || title.length>220) return json({ok:false,error:'invalid-headline'},400)
        const status=(input.status==='published'||input.action==='publish'||(request.method==='PATCH'&&input.action==='edit'&&(await env.D1.prepare('SELECT status FROM migration_articles WHERE id=?').bind(url.pathname.split('/').pop()).first())?.status==='published'))?'published':'draft'
        const articleText=typeof input.article_text==='string'?input.article_text.trim():''
        const body=input.body && typeof input.body==='object'?input.body:articleText?articleLexical(articleText):existingForEdit?JSON.parse(existingForEdit.content_json||'{}'):{root:{type:'root',children:[]}}
        const sources=Array.isArray(input.sources)?input.sources:[]
        let featured=input.featuredImage && typeof input.featuredImage==='object'?input.featuredImage:existingForEdit?JSON.parse(existingForEdit.image_json||'{}'):{}
        if (input.featured_image_id) {
          const mediaRow=await env.D1.prepare('SELECT raw_json FROM migration_media WHERE id=?').bind(String(input.featured_image_id)).first()
          if (!mediaRow) return json({ok:false,error:'featured-image-not-found'},400)
          const media=JSON.parse(mediaRow.raw_json)
          const token=String(media.id||'').replace(/^cf-media-/,'')
          featured={id:media.id,alt:media.alt||'',filename:media.filename||'',url:/^[a-f0-9]{32}$/.test(token)?url.origin+'/public/media/'+token:media.url||''}
        }
        const oldMetadata=existingForEdit?JSON.parse(existingForEdit.metadata_json||'{}'):{}
        const metadata={...oldMetadata,deck:String(input.deck||''),editorial_placement:['news','featured','lead'].includes(input.editorial_placement)?input.editorial_placement:(oldMetadata.editorial_placement||'news'),source_article:{...(oldMetadata.source_article||{}),headline:title,deck:String(input.deck||''),seo_title:String(input.seo_title||''),seo_description:String(input.seo_description||'')}}
        if (['geopolitics','conflict','security'].includes(input.category_slug)) {
          const category=await env.D1.prepare('SELECT id,slug,name FROM migration_categories WHERE slug=?').bind(input.category_slug).first()
          if (!category) return json({ok:false,error:'category-not-found'},400)
          metadata.category_relationships=[{id:category.id,categories_id:category.id,slug:category.slug,name:category.name}]
        }
        const now=new Date().toISOString()
        const id=url.pathname.startsWith('/editor/articles/')?url.pathname.split('/').pop():'cf-'+crypto.randomUUID()
        if(request.method==='PATCH') {
          const existing=await env.D1.prepare('SELECT id,slug FROM migration_articles WHERE id=?').bind(id).first()
          if (!existing || existing.slug!==slug || (env.EDITOR_PRODUCTION_MODE !== 'live' && !existing.slug.startsWith('cf-staging-test-'))) return json({ok:false,error:'article-not-found'},404)
          await env.D1.prepare('UPDATE migration_articles SET title=?,status=?,published_at=CASE WHEN ?=\'published\' THEN COALESCE(published_at,?) ELSE NULL END,updated_at=?,content_json=?,metadata_json=?,source_json=?,image_json=? WHERE id=? AND slug=?')
            .bind(title,status,status,now,now,JSON.stringify(body),JSON.stringify(metadata),JSON.stringify(sources),JSON.stringify(featured),id,slug).run()
        } else {
          await env.D1.prepare('INSERT INTO migration_articles (id,slug,title,status,published_at,updated_at,content_json,metadata_json,source_json,image_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
            .bind(id,slug,title,status,status==='published'?now:null,now,JSON.stringify(body),JSON.stringify(metadata),JSON.stringify(sources),JSON.stringify(featured)).run()
        }
        return json({ok:true,article:{id,slug,headline:title,status}},request.method==='POST'?201:200)
      } catch {return json({ok:false,error:'staging-d1-write-failed'},400)}
    }
    // Isolated D1-only public delivery rehearsal; never indexed or routed to production.
    if (env.D1 && request.method === 'GET' && url.pathname.startsWith('/d1-preview/articles/')) {
      if (!await authenticated()) return json({ok:false,error:'unauthorized'},401)
      const slug = decodeURIComponent(url.pathname.slice('/d1-preview/articles/'.length))
      if (!/^[a-z0-9-]{1,160}$/.test(slug)) return json({ok:false,error:'invalid-slug'},400)
      try {
        const a = await env.D1.prepare('SELECT * FROM migration_articles WHERE slug=? AND status=? LIMIT 1').bind(slug,'published').first()
        if (!a) return json({ok:false,error:'not-found'},404)
        const parse = (v,f) => { try { return JSON.parse(v) } catch { return f } }
        const meta=parse(a.metadata_json,{})
        const source=meta.source_article || {}
        const body=parse(a.content_json,{})
        const image=parse(a.image_json,{})
        const sources=parse(a.source_json,[])
        const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
        const title=source.seo_title || source.seo?.title || a.title
        const description=source.seo_description || source.seo?.description || source.deck || ''
        const canonical='https://faultlinebrief.com/articles/'+encodeURIComponent(slug)
        const nodes=(body.root?.children||[])
        const renderText=n=>(n.children||[]).map(c=>{const content=esc(c.text??(c.children||[]).map(t=>t.text||'').join(''));if(c.type==='link'){const href=c.fields?.url||c.url||'';return /^https?:\/\//.test(href)?'<a href="'+esc(href)+'" rel="noopener noreferrer nofollow">'+content+'</a>':content}return (c.format&1?'<strong>':'')+(c.format&2?'<em>':'')+content+(c.format&2?'</em>':'')+(c.format&1?'</strong>':'')}).join('')
        const paragraphs=nodes.map(n=>{
          const tag=n.type==='heading' && ['h2','h3','h4','h5','h6'].includes(n.tag)?n.tag:'p'
          return '<'+tag+'>'+renderText(n)+'</'+tag+'>'
        }).join('')
        const imageRaw=image.url || (image.filename?'/api/media/file/'+encodeURIComponent(image.filename):'')
        const imageUrl=imageRaw?new URL(imageRaw,'https://faultlinebrief.com').href:''
        const imageHtml=imageUrl?'<figure><img src="'+esc(imageUrl)+'" alt="'+esc(image.alt||a.title)+'"></figure>':''
        const sourceHtml=Array.isArray(sources)?sources.map(x=>'<li>'+esc(x.name||'')+'</li>').join(''):''
        const structured=JSON.stringify({'@context':'https://schema.org','@type':'NewsArticle',headline:a.title,datePublished:a.published_at,dateModified:a.updated_at||a.published_at,mainEntityOfPage:canonical,image:imageUrl?[imageUrl]:undefined,description})
        const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+esc(canonical)+'"><meta property="og:type" content="article"><meta property="og:title" content="'+esc(title)+'"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:description" content="'+esc(description)+'">'+(imageUrl?'<meta property="og:image" content="'+esc(imageUrl)+'">':'')+'<script type="application/ld+json">'+structured.replace(/</g,'\\u003c')+'</script></head><body><main><article><h1>'+esc(a.title)+'</h1><p>'+esc(source.deck||'')+'</p>'+imageHtml+paragraphs+(sourceHtml?'<section><h2>Sources</h2><ul>'+sourceHtml+'</ul></section>':'')+'</article></main></body></html>'
        return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow'}})
      } catch { return json({ok:false,error:'d1-preview-unavailable'},503) }
    }
    // Stage 4: private, authenticated image upload and retrieval in isolated staging R2.
    const imagePath = /^\/editor\/images\/([a-f0-9]{32})$/.exec(url.pathname)
    if (url.pathname === '/editor/images' && request.method === 'POST') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      if (request.headers.get('Origin') !== url.origin) return json({ ok: false, error: 'invalid-origin' }, 403)
      const type = request.headers.get('Content-Type')
      const allowed = ['image/png', 'image/jpeg', 'image/webp']
      if (!allowed.includes(type)) return json({ ok: false, error: 'unsupported-image-type' }, 415)
      const size = Number(request.headers.get('Content-Length'))
      if (!Number.isInteger(size) || size < 16 || size > 2 * 1024 * 1024) return json({ ok: false, error: 'invalid-image-size' }, 413)
      const bytes = new Uint8Array(await request.arrayBuffer())
      if (bytes.length !== size) return json({ ok: false, error: 'image-size-mismatch' }, 400)
      const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)
      const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      const webp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP'
      if (!(type === 'image/png' && png || type === 'image/jpeg' && jpeg || type === 'image/webp' && webp)) return json({ ok: false, error: 'image-signature-mismatch' }, 415)
      const id = hex(crypto.getRandomValues(new Uint8Array(16)))
      if (!env.D1) return json({ ok: false, error: 'staging-d1-required' }, 503)
      const alt = (request.headers.get('X-Image-Alt') || '').trim()
      if (!alt || alt.length > 240) return json({ ok: false, error: 'image-alt-required' }, 400)
      const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
      const filename = 'cf-staging-' + id + '.' + ext
      const key = filename
      const mediaId = 'cf-media-' + id
      const mediaUrl = '/editor/images/' + id
      await env.R2.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { staging: 'true' } })
      try {
        const record = { id: mediaId, filename, alt, url: mediaUrl, mimeType: type, filesize: bytes.length, objectKey: key }
        await env.D1.prepare('INSERT INTO migration_media (id,raw_json) VALUES (?,?)')
          .bind(mediaId, JSON.stringify(record)).run()
        return json({ ok: true, id, mediaId, bytes: bytes.length, contentType: type }, 201)
      } catch {
        await env.R2.delete(key).catch(() => {})
        return json({ ok: false, error: 'staging-media-registration-failed' }, 503)
      }
    }
    if (imagePath && request.method === 'GET') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      const media = await env.D1.prepare('SELECT raw_json FROM migration_media WHERE id=?').bind('cf-media-' + imagePath[1]).first()
      if (!media) return json({ ok: false, error: 'image-not-found' }, 404)
      const record = JSON.parse(media.raw_json)
      const object = await env.R2.get(record.objectKey)
      if (!object) return json({ ok: false, error: 'image-not-found' }, 404)
      return new Response(object.body, { status: 200, headers: { ...headers, 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Content-Length': String(object.size) } })
    }
    // Public read-only delivery for media attached to published staging test articles.
    // No listing, upload, admin access, or non-staging media exposure.
    const publishedImagePath = /^\/public\/staging-media\/([a-f0-9]{32})$/.exec(url.pathname)
    if (publishedImagePath && request.method === 'GET') {
      if (!env.D1) return json({ ok:false, error:'staging-d1-required' },503)
      try {
        const mediaId = 'cf-media-' + publishedImagePath[1]
        const media = await env.D1.prepare('SELECT raw_json FROM migration_media WHERE id=?').bind(mediaId).first()
        if (!media) return json({ok:false,error:'image-not-found'},404)
        const { results } = await env.D1.prepare("SELECT image_json FROM migration_articles WHERE status='published' AND slug LIKE 'cf-staging-test-%'").all()
        const referenced = results.some(row => {
          try {
            const image = JSON.parse(row.image_json || '{}')
            return image.id === mediaId || image.mediaId === mediaId || image.url === '/editor/images/' + publishedImagePath[1] || image.url === '/public/staging-media/' + publishedImagePath[1]
          } catch { return false }
        })
        if (!referenced) return json({ok:false,error:'image-not-found'},404)
        const record = JSON.parse(media.raw_json)
        const object = await env.R2.get(record.objectKey)
        if (!object) return json({ok:false,error:'image-not-found'},404)
        return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}})
      } catch { return json({ok:false,error:'staging-media-unavailable'},503) }
    }

    const publicImageMatch = url.pathname.startsWith('/public/media/') ? [null, url.pathname.slice('/public/media/'.length)] : null
    if (publicImageMatch && /^[a-f0-9]{32}$/.test(publicImageMatch[1]) && request.method === 'GET' && env.EDITOR_PRODUCTION_MODE === 'live') {
      const mediaId='cf-media-'+publicImageMatch[1]
      const article=await env.D1.prepare("SELECT id FROM migration_articles WHERE status='published' AND image_json LIKE ? LIMIT 1").bind('%'+mediaId+'%').first()
      if (!article) return json({ok:false,error:'image-not-published'},404)
      const row=await env.D1.prepare('SELECT raw_json FROM migration_media WHERE id=?').bind(mediaId).first()
      if (!row) return json({ok:false,error:'image-not-found'},404)
      const record=JSON.parse(row.raw_json)
      const object=await env.R2.get(record.objectKey)
      if (!object) return json({ok:false,error:'image-not-found'},404)
      return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||record.mimeType||'application/octet-stream','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}})
    }
    // Stage 5: isolated, authenticated staging website preview and sitemap previews.
    // Never expose these routes to crawlers or serve real editorial articles.
    if (request.method === 'GET' && (url.pathname.startsWith('/preview/articles/') || url.pathname === '/preview/sitemap.xml' || url.pathname === '/preview/news-sitemap.xml')) {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      const { Client } = await import('pg')
      const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
      try {
        await client.connect()
        await client.query('BEGIN READ ONLY')
        if (url.pathname.startsWith('/preview/articles/')) {
          const slug = decodeURIComponent(url.pathname.slice('/preview/articles/'.length))
          if (!/^cf-staging-test-[a-z0-9-]{8,70}$/.test(slug)) return json({ ok: false, error: 'staging-preview-only' }, 404)
          const result = await client.query("SELECT headline,slug,deck,body,published_at,updated_at,status FROM public.articles WHERE slug=$1 AND status='published' LIMIT 1", [slug])
          if (!result.rowCount) return json({ ok: false, error: 'article-not-found' }, 404)
          const article = result.rows[0]
          const sourceRows = await client.query('SELECT name,url FROM public.articles_sources WHERE _parent_id=(SELECT id FROM public.articles WHERE slug=$1 LIMIT 1) ORDER BY _order,id',[slug])
          const mediaRows = await client.query('SELECT m.alt,m.url,m.filename FROM public.media m JOIN public.articles a ON a.featured_image_id=m.id WHERE a.slug=$1 LIMIT 1',[slug])
          const normalize = value => String(value ?? '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n')
          const paragraphs = (article.body?.root?.children || []).map(n => {
            const content = normalize((n.children || []).map(c => c.text || (c.children || []).map(t=>t.text||'').join('')).join(''))
            const tag = n.type === 'heading' ? (['h2','h3','h4'].includes(n.tag) ? n.tag : 'h2') : 'p'
            return content.split(/\n\s*\n/).filter(Boolean).map(t => '<'+tag+'>'+escape(t).replace(/\n/g,'<br>')+'</'+tag+'>').join('')
          }).join('')
          const media = mediaRows.rows[0]
          const imagePath = media?.url && /^\/editor\/images\/[a-f0-9]{32}$/.test(media.url) ? media.url : (media?.url && media.url.startsWith(url.origin + '/public/staging-media/') && /^\/public\/staging-media\/[a-f0-9]{32}$/.test(new URL(media.url).pathname) ? media.url : '')
          const featured = imagePath ? '<figure><img src="'+escape(imagePath)+'" alt="'+escape(media.alt||article.headline)+'"><figcaption>'+escape(media.alt||'')+'</figcaption></figure>' : ''
          const sourcesHtml = sourceRows.rows.length ? '<section class="sources"><h2>Sources</h2><ul>'+sourceRows.rows.map(x => '<li>'+(x.url && /^https?:\/\//i.test(x.url) ? '<a href="'+escape(x.url)+'" rel="noopener noreferrer" target="_blank">'+escape(x.name)+'</a>' : escape(x.name))+'</li>').join('')+'</ul></section>' : ''
          const publishedDate = article.published_at ? new Date(article.published_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}) : 'Staging draft'
          const css = '*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#162033;font:17px/1.75 system-ui,-apple-system,sans-serif}a{color:#bd3039}header{background:#fff;border-bottom:1px solid #e5e7eb;padding:20px max(24px,calc((100vw - 1120px)/2));display:flex;justify-content:space-between;align-items:center}.brand{font-weight:850;letter-spacing:-.6px;color:#101b2c}.brand span{color:#c82d36}.stage{font-size:12px;letter-spacing:.08em;color:#64748b;text-transform:uppercase}main{max-width:900px;margin:48px auto;padding:0 24px}article{background:white;border:1px solid #e5e7eb;border-radius:8px;padding:clamp(22px,5vw,56px)}h1{font-size:clamp(32px,4vw,49px);line-height:1.17;letter-spacing:-.03em;margin:8px 0 20px}h2{line-height:1.35;margin-top:32px}.deck{font-size:21px;color:#475569;line-height:1.5}.date{font-size:14px;color:#64748b;border-top:1px solid #e5e7eb;padding-top:18px;margin:22px 0}figure{margin:26px 0}figure img{display:block;width:100%;max-height:520px;object-fit:contain;background:#f1f5f9}figcaption{font-size:13px;color:#64748b;margin-top:7px}.body p{margin:0 0 21px;overflow-wrap:anywhere}.sources{border-top:1px solid #e5e7eb;margin-top:36px;padding-top:14px}.sources li{margin-bottom:6px}.notice{background:#fff3cd;color:#6b4e00;padding:9px 18px;font-size:13px;text-align:center}'
          const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(article.headline)+' | Faultline Brief staging</title><style>'+css+'</style></head><body><div class="notice">Staging preview only — not published on faultlinebrief.com</div><header><div class="brand">◆ FAULTLINE <span>BRIEF</span></div><div class="stage">Editorial preview</div></header><main><article><h1>'+escape(article.headline)+'</h1><p class="deck">'+escape(article.deck)+'</p><div class="date">'+escape(publishedDate)+'</div>'+featured+'<div class="body">'+paragraphs+'</div>'+sourcesHtml+'</article></main></body></html>'
          return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' } })
        }
        const result = await client.query("SELECT slug,headline,published_at,updated_at FROM public.articles WHERE status='published' AND slug LIKE 'cf-staging-test-%' ORDER BY published_at DESC LIMIT 1001")
        const now = Date.now()
        const news = url.pathname === '/preview/news-sitemap.xml'
        const articles = news ? result.rows.filter(a => a.published_at && new Date(a.published_at).getTime() >= now - 48 * 3600000 && new Date(a.published_at).getTime() <= now) : result.rows
        if (articles.length > 1000) return json({ ok: false, error: 'staging-sitemap-limit-exceeded' }, 503)
        const entries = articles.map(a => {
          const loc = escape(url.origin + '/preview/articles/' + encodeURIComponent(a.slug))
          if (!news) return '<url><loc>' + loc + '</loc><lastmod>' + escape(new Date(a.updated_at || a.published_at).toISOString()) + '</lastmod></url>'
          return '<url><loc>' + loc + '</loc><news:news><news:publication><news:name>Faultline Brief</news:name><news:language>en</news:language></news:publication><news:publication_date>' + escape(new Date(a.published_at).toISOString()) + '</news:publication_date><news:title>' + escape(a.headline) + '</news:title></news:news></url>'
        })
        const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' + (news ? ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"' : '') + '>' + entries.join('') + '</urlset>'
        return new Response(xml, { headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' } })
      } catch { return json({ ok: false, error: 'staging-preview-unavailable' }, 503) }
      finally { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}) }
    }
    // Staging-only metadata inspection: never changes slugs, canonical URLs, SEO, or articles.
    if (/^\/editor\/article-details\/\d+$/.test(url.pathname) && request.method === 'GET') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      const { Client } = await import('pg')
      const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
      try {
        await client.connect()
        await client.query('BEGIN READ ONLY')
        const result = await client.query('SELECT id,headline,slug,deck,body,status,published_at,updated_at,created_at,seo_title,seo_description,featured_image_id,homepage_lead,editorial_placement FROM public.articles WHERE id=$1 LIMIT 1', [Number(url.pathname.split('/').pop())])
        if (!result.rowCount) return json({ ok: false, error: 'article-not-found' }, 404)
        const sources = await client.query('SELECT name,url FROM public.articles_sources WHERE _parent_id=$1 ORDER BY _order,id',[result.rows[0].id])
        return json({ ok: true, article: { ...result.rows[0], sources: sources.rows } })
      } catch { return json({ ok: false, error: 'staging-metadata-unavailable' }, 503) }
      finally { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}) }
    }
    // Read-only compatibility report for an existing published article. Never copy, mutate, or publish.
    if (url.pathname === '/editor/compatibility-report' && request.method === 'GET') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      const { Client } = await import('pg')
      const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
      try {
        await client.connect()
        await client.query('BEGIN READ ONLY')
        const result = await client.query(`SELECT a.id,a.slug,a.headline,a.deck,a.status,a.published_at,a.seo_title,a.seo_description,a.featured_image_id,a.editorial_placement,a.homepage_lead,m.filename AS image_filename,m.url AS image_url,m.alt AS image_alt,a.body,(SELECT COALESCE(json_agg(json_build_object('name',c.name,'slug',c.slug)),'[]'::json) FROM public.articles_rels r JOIN public.categories c ON c.id=r.categories_id WHERE r.parent_id=a.id) AS categories FROM public.articles a LEFT JOIN public.media m ON m.id=a.featured_image_id WHERE a.id=30 AND a.status='published' LIMIT 1`)
        if (!result.rowCount) return json({ ok: false, error: 'reference-article-not-found' }, 404)
        const a = result.rows[0]
        const blocks = a.body?.root?.children || []
        const count = blocks.length
        const fields = ['slug','headline','deck','status','published_at','seo_title','seo_description','featured_image_id','image_filename','image_url','image_alt','editorial_placement','categories']
        const checks = Object.fromEntries(fields.map(k => [k,{ present: a[k] != null && a[k] !== '', value: a[k] }]))
        return json({ ok: true, reference: 'staging-neon-article-30', checks, body_blocks: count, lexical_root: a.body?.root?.type || null, readonly: true, public_site_compared: false, note: 'Staging baseline only; live website parity must be checked separately.' })
      } catch { return json({ ok: false, error: 'compatibility-report-unavailable' }, 503) }
      finally { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}) }
    }
    // Staging collections are read-only; never return authentication hashes or API keys.
    if (request.method === 'GET' && (url.pathname === '/editor/users' || url.pathname === '/editor/media-library')) {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      const { Client } = await import('pg')
      const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
      try {
        await client.connect()
        await client.query('BEGIN READ ONLY')
        const result = url.pathname === '/editor/users'
          ? await client.query('SELECT id,email,created_at,updated_at FROM public.users ORDER BY id LIMIT 100')
          : await client.query('SELECT id,alt,url,filename,mime_type,width,height FROM public.media ORDER BY id DESC LIMIT 100')
        return json({ ok: true, items: result.rows, count: result.rowCount })
      } catch { return json({ ok: false, error: 'staging-collection-unavailable' }, 503) }
      finally { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}) }
    }
    if (url.pathname === '/articles' && request.method === 'GET' || url.pathname === '/categories' && request.method === 'GET') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      try {
        const { Client } = await import('pg')
        const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
        try {
          await client.connect()
          await client.query('BEGIN READ ONLY')
          const result = url.pathname === '/articles'
            ? await client.query('SELECT id, headline, slug, deck, status, published_at, updated_at FROM public.articles ORDER BY updated_at DESC LIMIT 25')
            : await client.query('SELECT id, name, slug, description FROM public.categories ORDER BY name LIMIT 100')
          await client.query('ROLLBACK')
          return json({ ok: true, items: result.rows, count: result.rowCount })
        } finally { await client.end().catch(() => {}) }
      } catch { return json({ ok: false, error: 'staging-database-unavailable' }, 503) }
    }
    if (url.pathname === '/editor/articles' && request.method === 'POST' || /^\/editor\/articles\/\d+$/.test(url.pathname) && request.method === 'PATCH') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      if (request.headers.get('Origin') !== url.origin || !request.headers.get('Content-Type')?.startsWith('application/json')) return json({ ok: false, error: 'invalid-origin-or-content-type' }, 403)
      if (Number(request.headers.get('Content-Length') || 0) > 20000) return json({ ok: false, error: 'payload-too-large' }, 413)
      let body
      try { body = await request.json() } catch { return json({ ok: false, error: 'invalid-json' }, 400) }
      const headline = body?.headline
      const deck = body?.deck
      if (typeof headline !== 'string' || headline.length < 8 || headline.length > 200 || typeof deck !== 'string' || deck.length < 8 || deck.length > 500) return json({ ok: false, error: 'invalid-fields' }, 400)
      const seoTitle = body?.seo_title == null ? '' : body.seo_title
      const seoDescription = body?.seo_description == null ? '' : body.seo_description
      const articleText = body?.article_text == null ? '' : body.article_text
      if (typeof seoTitle !== 'string' || seoTitle.length > 180 || typeof seoDescription !== 'string' || seoDescription.length > 320 || typeof articleText !== 'string' || articleText.length > 12000) return json({ ok: false, error: 'invalid-editorial-fields' }, 400)
      const sources = body?.sources
      if (sources !== undefined) {
        if (!Array.isArray(sources) || sources.length > 30) return json({ ok: false, error: 'invalid-article-sources' }, 400)
        for (const source of sources) {
          if (!source || typeof source.name !== 'string' || !source.name.trim() || source.name.length > 180 || typeof (source.url ?? '') !== 'string' || (source.url && (source.url.length > 2000 || !(source.url.startsWith('https://') || source.url.startsWith('http://'))))) return json({ ok: false, error: 'invalid-article-sources' }, 400)
        }
      }
      const imageId = body?.featured_image_id
      if (imageId !== undefined && (!Number.isSafeInteger(imageId) || imageId < 1)) return json({ ok: false, error: 'invalid-featured-image' }, 400)
      const normalizedText = articleText.trim().replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n')
      const paragraphTexts = (normalizedText || 'Isolated Cloudflare staging editorial workflow test. Not a real news report.').split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean)
      const lexical = articleLexical(normalizedText || 'Isolated Cloudflare staging editorial workflow test. Not a real news report.')
      const { Client } = await import('pg')
      const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
      try {
        await client.connect()
        await client.query('BEGIN')
        let result
        if (request.method === 'POST') {
          if (typeof body.slug !== 'string' || !/^cf-staging-test-[a-z0-9-]{8,70}$/.test(body.slug)) return json({ ok: false, error: 'staging-test-slug-required' }, 400)
          const media = await client.query('SELECT id FROM public.media WHERE id=COALESCE($1::integer,(SELECT id FROM public.media ORDER BY id LIMIT 1))',[imageId ?? null])
          if (!media.rowCount) return json({ ok: false, error: 'staging-media-required' }, 409)
          result = await client.query("INSERT INTO public.articles (headline,slug,deck,body,featured_image_id,status,homepage_lead,editorial_placement,seo_title,seo_description) VALUES ($1,$2,$3,$4::jsonb,$5,'draft',false,'news',$6,$7) RETURNING id,slug,headline,deck,status,published_at", [headline,body.slug,deck,JSON.stringify(lexical),media.rows[0].id,seoTitle||null,seoDescription||null])
        } else {
          const id = Number(url.pathname.split('/').pop())
          const existing = await client.query("SELECT id,status,body FROM public.articles WHERE id=$1 AND slug LIKE 'cf-staging-test-%' FOR UPDATE",[id])
          if (!existing.rowCount) return json({ ok: false, error: 'staging-test-article-not-found' }, 404)
          // Never flatten existing Lexical formatting through the plain-text editor.
          // Unchanged text preserves the original JSON; changed rich text is rejected
          // until a structure-aware editor is available.
          const originalNodes = existing.rows[0].body?.root?.children || []
          const flatten = node => node.type === 'linebreak' ? '\n' : typeof node.text === 'string' ? node.text : (node.children || []).map(flatten).join('')
          const originalText = lexicalPlainText(existing.rows[0].body).replace(/\r\n/g, '\n').trim()
          const incomingText = articleText.replace(/\r\n/g, '\n').trim()
          const hasRichText = originalNodes.some(node => node.type !== 'paragraph' || (node.children || []).some(child => child.type !== 'text' || child.format || child.children?.length))
          if (hasRichText && incomingText && incomingText !== originalText) {
            await client.query('ROLLBACK')
            return json({ ok: false, error: 'rich-text-edit-requires-structured-editor' }, 409)
          }
          const preserveExistingBody = hasRichText && incomingText === originalText

          if (body.action !== 'edit' && body.action !== 'publish') return json({ ok: false, error: 'invalid-action' }, 400)
          result = body.action === 'publish'
            ? await client.query("UPDATE public.articles SET headline=$2,deck=$3,body=CASE WHEN $4::text='' THEN body ELSE $4::jsonb END,seo_title=CASE WHEN $5::text='' THEN seo_title ELSE $5 END,seo_description=CASE WHEN $6::text='' THEN seo_description ELSE $6 END,status='published',published_at=COALESCE(published_at,now()),updated_at=now() WHERE id=$1 RETURNING id,slug,headline,deck,status,published_at",[id,headline,deck,articleText.trim()&&!preserveExistingBody?JSON.stringify(lexical):'',seoTitle,seoDescription])
            : await client.query("UPDATE public.articles SET headline=$2,deck=$3,body=CASE WHEN $4::text='' THEN body ELSE $4::jsonb END,seo_title=CASE WHEN $5::text='' THEN seo_title ELSE $5 END,seo_description=CASE WHEN $6::text='' THEN seo_description ELSE $6 END,updated_at=now() WHERE id=$1 RETURNING id,slug,headline,deck,status,published_at",[id,headline,deck,articleText.trim()&&!preserveExistingBody?JSON.stringify(lexical):'',seoTitle,seoDescription])
        }
        if (imageId !== undefined && request.method !== 'POST') {
          const media = await client.query('SELECT id FROM public.media WHERE id=$1',[imageId])
          if (!media.rowCount) { await client.query('ROLLBACK'); return json({ ok: false, error: 'featured-image-not-found' }, 400) }
          await client.query('UPDATE public.articles SET featured_image_id=$2 WHERE id=$1',[result.rows[0].id,imageId])
        }
        if (result.rows[0].status === 'published') {
          const selected = await client.query('SELECT m.id,m._objectkey FROM public.media m JOIN public.articles a ON a.featured_image_id=m.id WHERE a.id=$1', [result.rows[0].id])
          const chosen = selected.rows[0]
          if (chosen && typeof chosen._objectkey === 'string' && /^editor-media\/staging\/[a-f0-9]{32}$/.test(chosen._objectkey)) {
            const publicUrl = url.origin + '/public/staging-media/' + chosen._objectkey.split('/').pop()
            await client.query('UPDATE public.media SET url=$2 WHERE id=$1', [chosen.id,publicUrl])
          }
        }
        if (sources !== undefined) {
          await client.query('DELETE FROM public.articles_sources WHERE _parent_id=$1',[result.rows[0].id])
          for (let i=0;i<sources.length;i++) await client.query('INSERT INTO public.articles_sources (_order,_parent_id,id,name,url) VALUES ($1,$2,$3,$4,$5)',[i+1,result.rows[0].id,crypto.randomUUID(),sources[i].name.trim(),sources[i].url?.trim()||null])
        }
        await client.query('COMMIT')
        return json({ ok: true, article: result.rows[0] }, request.method === 'POST' ? 201 : 200)
      } catch (error) { console.error('STAGING_ARTICLE_WRITE_FAILURE', { code: error?.code, constraint: error?.constraint, message: error?.message }); await client.query('ROLLBACK').catch(() => {}); return json({ ok: false, error: 'staging-write-failed' }, 503) }
      finally { await client.end().catch(() => {}) }
    }
    if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, service: 'cloudflare-native-editor-auth', staging: true })
    if (url.pathname === '/login' && request.method === 'POST') {
      if (Number(request.headers.get('Content-Length') || 0) > 2048) return json({ ok: false }, 413)
      let body
      try { body = await request.json() } catch { return json({ ok: false }, 400) }
      if (typeof body?.password !== 'string' || body.password.length > 1024) return json({ ok: false }, 400)
      const valid = equal(await digest(body.password), await digest(env.EDITOR_BOOTSTRAP_PASSWORD))
      if (!valid) return json({ ok: false, error: 'invalid-credentials' }, 401)
      const token = hex(crypto.getRandomValues(new Uint8Array(32)))
      const expires = Date.now() + 8 * 60 * 60 * 1000
      await env.R2.put(await sessionKey(token), String(expires), { httpMetadata: { contentType: 'text/plain' } })
      return json({ ok: true, authenticated: true }, 200, { 'Set-Cookie': 'fb_editor=' + token + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800' })
    }
    if (url.pathname === '/me' && request.method === 'GET') {
      const ok = await authenticated()
      return json({ ok, authenticated: ok }, ok ? 200 : 401)
    }
    if (url.pathname === '/logout' && request.method === 'POST') {
      if (cookie) await env.R2.delete(await sessionKey(cookie))
      return json({ ok: true }, 200, { 'Set-Cookie': 'fb_editor=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' })
    }
    return json({ ok: false, error: 'not-found' }, 404)
  }
}

