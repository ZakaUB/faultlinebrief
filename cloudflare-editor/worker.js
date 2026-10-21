import { stagingDb } from './d1-staging-adapter.js'
import { adminHtml } from './admin-page.js'
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
    const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'Content-Type': 'application/json', ...extra } })
    if (!env.EDITOR_BOOTSTRAP_PASSWORD || env.EDITOR_BOOTSTRAP_PASSWORD.length < 24 || !env.EDITOR_SESSION_SECRET || env.EDITOR_SESSION_SECRET.length < 32 || !env.R2) return json({ ok: false, error: 'staging-configuration' }, 503)
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
    if (env.D1 && (url.pathname === '/articles' || url.pathname === '/categories' || url.pathname === '/editor/media-library' || url.pathname.startsWith('/editor/articles/'))) {
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
      return json({ok:false,error:'d1-write-not-enabled'},405)
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
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      const alt = (request.headers.get('X-Image-Alt') || '').trim()
      if (!alt || alt.length > 240) return json({ ok: false, error: 'image-alt-required' }, 400)
      const key = 'editor-media/staging/' + id
      await env.R2.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { staging: 'true' } })
      const { Client } = await import('pg')
      const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
      try {
        await client.connect()
        const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
        const filename = 'cf-staging-' + id + '.' + ext
        const result = await client.query('INSERT INTO public.media (alt,filename,mime_type,filesize,url,_objectkey) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [alt,filename,type,bytes.length,'/editor/images/'+id,key])
        return json({ ok: true, id, mediaId: result.rows[0].id, bytes: bytes.length, contentType: type }, 201)
      } catch {
        await env.R2.delete(key).catch(() => {})
        return json({ ok: false, error: 'staging-media-registration-failed' }, 503)
      } finally { await client.end().catch(() => {}) }
    }
    if (imagePath && request.method === 'GET') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      const object = await env.R2.get('editor-media/staging/' + imagePath[1])
      if (!object) return json({ ok: false, error: 'image-not-found' }, 404)
      return new Response(object.body, { status: 200, headers: { ...headers, 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Content-Length': String(object.size) } })
    }
    // Public read-only delivery for media attached to published staging test articles.
    // No listing, upload, admin access, or non-staging media exposure.
    const publishedImagePath = /^\/public\/staging-media\/([a-f0-9]{32})$/.exec(url.pathname)
    if (publishedImagePath && request.method === 'GET') {
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok:false, error:'staging-database-required' },503)
      const { Client } = await import('pg')
      const client = new Client({ connectionString:env.DATABASE_URL, connectionTimeoutMillis:8000 })
      try {
        await client.connect()
        const key = 'editor-media/staging/' + publishedImagePath[1]
        const allowed = await client.query("SELECT 1 FROM public.media m JOIN public.articles a ON a.featured_image_id=m.id WHERE m._objectkey=$1 AND a.status='published' AND a.slug LIKE 'cf-staging-test-%' LIMIT 1",[key])
        if (!allowed.rowCount) return json({ok:false,error:'image-not-found'},404)
        const object = await env.R2.get(key)
        if (!object) return json({ok:false,error:'image-not-found'},404)
        return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}})
      } catch { return json({ok:false,error:'staging-media-unavailable'},503) }
      finally { await client.end().catch(()=>{}) }
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
            const content = normalize((n.children || []).map(c => c.text || '').join(''))
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
      const lexical = { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: paragraphTexts.map(t => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'text', text: t, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }] })) } }
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
          const originalText = originalNodes.map(flatten).join('\n\n').replace(/\r\n/g, '\n').trim()
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
).test(url.pathname))) {
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
      return json({ok:false,error:'d1-write-not-enabled'},405)
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
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      const alt = (request.headers.get('X-Image-Alt') || '').trim()
      if (!alt || alt.length > 240) return json({ ok: false, error: 'image-alt-required' }, 400)
      const key = 'editor-media/staging/' + id
      await env.R2.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { staging: 'true' } })
      const { Client } = await import('pg')
      const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
      try {
        await client.connect()
        const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
        const filename = 'cf-staging-' + id + '.' + ext
        const result = await client.query('INSERT INTO public.media (alt,filename,mime_type,filesize,url,_objectkey) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [alt,filename,type,bytes.length,'/editor/images/'+id,key])
        return json({ ok: true, id, mediaId: result.rows[0].id, bytes: bytes.length, contentType: type }, 201)
      } catch {
        await env.R2.delete(key).catch(() => {})
        return json({ ok: false, error: 'staging-media-registration-failed' }, 503)
      } finally { await client.end().catch(() => {}) }
    }
    if (imagePath && request.method === 'GET') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      const object = await env.R2.get('editor-media/staging/' + imagePath[1])
      if (!object) return json({ ok: false, error: 'image-not-found' }, 404)
      return new Response(object.body, { status: 200, headers: { ...headers, 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Content-Length': String(object.size) } })
    }
    // Public read-only delivery for media attached to published staging test articles.
    // No listing, upload, admin access, or non-staging media exposure.
    const publishedImagePath = /^\/public\/staging-media\/([a-f0-9]{32})$/.exec(url.pathname)
    if (publishedImagePath && request.method === 'GET') {
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok:false, error:'staging-database-required' },503)
      const { Client } = await import('pg')
      const client = new Client({ connectionString:env.DATABASE_URL, connectionTimeoutMillis:8000 })
      try {
        await client.connect()
        const key = 'editor-media/staging/' + publishedImagePath[1]
        const allowed = await client.query("SELECT 1 FROM public.media m JOIN public.articles a ON a.featured_image_id=m.id WHERE m._objectkey=$1 AND a.status='published' AND a.slug LIKE 'cf-staging-test-%' LIMIT 1",[key])
        if (!allowed.rowCount) return json({ok:false,error:'image-not-found'},404)
        const object = await env.R2.get(key)
        if (!object) return json({ok:false,error:'image-not-found'},404)
        return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}})
      } catch { return json({ok:false,error:'staging-media-unavailable'},503) }
      finally { await client.end().catch(()=>{}) }
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
            const content = normalize((n.children || []).map(c => c.text || '').join(''))
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
      const lexical = { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: paragraphTexts.map(t => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'text', text: t, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }] })) } }
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
          const originalText = originalNodes.map(flatten).join('\n\n').replace(/\r\n/g, '\n').trim()
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
).test(url.pathname) && request.method === 'PATCH')) {
      if (!await authenticated()) return json({ok:false,error:'unauthorized'},401)
      return json({ok:false,error:'d1-write-not-enabled'},405)
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
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      const alt = (request.headers.get('X-Image-Alt') || '').trim()
      if (!alt || alt.length > 240) return json({ ok: false, error: 'image-alt-required' }, 400)
      const key = 'editor-media/staging/' + id
      await env.R2.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { staging: 'true' } })
      const { Client } = await import('pg')
      const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
      try {
        await client.connect()
        const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
        const filename = 'cf-staging-' + id + '.' + ext
        const result = await client.query('INSERT INTO public.media (alt,filename,mime_type,filesize,url,_objectkey) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [alt,filename,type,bytes.length,'/editor/images/'+id,key])
        return json({ ok: true, id, mediaId: result.rows[0].id, bytes: bytes.length, contentType: type }, 201)
      } catch {
        await env.R2.delete(key).catch(() => {})
        return json({ ok: false, error: 'staging-media-registration-failed' }, 503)
      } finally { await client.end().catch(() => {}) }
    }
    if (imagePath && request.method === 'GET') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      const object = await env.R2.get('editor-media/staging/' + imagePath[1])
      if (!object) return json({ ok: false, error: 'image-not-found' }, 404)
      return new Response(object.body, { status: 200, headers: { ...headers, 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Content-Length': String(object.size) } })
    }
    // Public read-only delivery for media attached to published staging test articles.
    // No listing, upload, admin access, or non-staging media exposure.
    const publishedImagePath = /^\/public\/staging-media\/([a-f0-9]{32})$/.exec(url.pathname)
    if (publishedImagePath && request.method === 'GET') {
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok:false, error:'staging-database-required' },503)
      const { Client } = await import('pg')
      const client = new Client({ connectionString:env.DATABASE_URL, connectionTimeoutMillis:8000 })
      try {
        await client.connect()
        const key = 'editor-media/staging/' + publishedImagePath[1]
        const allowed = await client.query("SELECT 1 FROM public.media m JOIN public.articles a ON a.featured_image_id=m.id WHERE m._objectkey=$1 AND a.status='published' AND a.slug LIKE 'cf-staging-test-%' LIMIT 1",[key])
        if (!allowed.rowCount) return json({ok:false,error:'image-not-found'},404)
        const object = await env.R2.get(key)
        if (!object) return json({ok:false,error:'image-not-found'},404)
        return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}})
      } catch { return json({ok:false,error:'staging-media-unavailable'},503) }
      finally { await client.end().catch(()=>{}) }
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
            const content = normalize((n.children || []).map(c => c.text || '').join(''))
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
      const lexical = { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: paragraphTexts.map(t => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'text', text: t, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }] })) } }
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
          const originalText = originalNodes.map(flatten).join('\n\n').replace(/\r\n/g, '\n').trim()
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
