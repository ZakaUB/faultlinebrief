// Separate draft-only API. Disabled until EDITOR_DRAFT_API_TOKEN is configured.
// The token is never exposed to browser HTML or GitHub Actions.
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))
const constantEqual = (a,b) => {let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a[i]||0)^(b[i]||0);return d===0}
const leaf = text => ({type:'text',text,detail:0,format:0,mode:'normal',style:'',version:1})
const bodyFromText = text => ({root:{type:'root',format:'',indent:0,version:1,direction:'ltr',children:String(text).split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).map(block=>{const match=block.match(/^(#{2,4})\s+(.+)$/);return {type:match?'heading':'paragraph',...(match?{tag:'h'+match[1].length}:{}),format:'',indent:0,version:1,direction:'ltr',children:[leaf(match?match[2]:block)]}})}})
const parse=(v,f)=>{try{return JSON.parse(v)}catch{return f}}
export async function draftIntegration(request,env) {
  if (!env.D1 || env.EDITOR_PRODUCTION_MODE!=='live') return json({error:'production-d1-unavailable'},503)
  if (!env.EDITOR_DRAFT_API_TOKEN || env.EDITOR_DRAFT_API_TOKEN.length<40) return json({error:'draft-integration-not-configured'},503)
  const authorization=request.headers.get('Authorization')||''
  if (!authorization.startsWith('Bearer ') || !constantEqual(await digest(authorization.slice(7)),await digest(env.EDITOR_DRAFT_API_TOKEN))) return json({error:'unauthorized'},401)
  const url=new URL(request.url)
  const path=url.pathname
  if (request.method==='GET' && path==='/integration/v1/drafts') {
    const rows=await env.D1.prepare("SELECT id,slug,title,status,updated_at FROM migration_articles WHERE status='draft' ORDER BY updated_at DESC LIMIT 100").all()
    return json({items:rows.results})
  }
  if (request.method==='GET' && /^\/integration\/v1\/drafts\/[^/]+$/.test(path)) {
    const id=decodeURIComponent(path.split('/').pop())
    const row=await env.D1.prepare("SELECT * FROM migration_articles WHERE id=? AND status='draft'").bind(id).first()
    return row?json({article:{...row,content:parse(row.content_json,{}),metadata:parse(row.metadata_json,{}),sources:parse(row.source_json,[])}}):json({error:'draft-not-found'},404)
  }
  if (!((request.method==='POST'&&path==='/integration/v1/drafts')||(request.method==='PATCH'&&/^\/integration\/v1\/drafts\/[^/]+$/.test(path)))) return json({error:'method-not-allowed'},405)
  let input;try{input=await request.json()}catch{return json({error:'invalid-json'},400)}
  if (!input || typeof input!=='object' || input.status && input.status!=='draft' || input.action) return json({error:'draft-only'},400)
  const isPatch=request.method==='PATCH'
  const id=isPatch?decodeURIComponent(path.split('/').pop()):'cf-'+crypto.randomUUID()
  const old=isPatch?await env.D1.prepare("SELECT * FROM migration_articles WHERE id=? AND status='draft'").bind(id).first():null
  if (isPatch&&!old) return json({error:'draft-not-found-or-published'},404)
  const slug=String(input.slug??old?.slug??'').trim()
  const title=String(input.headline??old?.title??'').trim()
  if(!/^[a-z0-9][a-z0-9-]{1,159}$/.test(slug)||title.length<8||title.length>220) return json({error:'invalid-slug-or-headline'},400)
  const oldMeta=parse(old?.metadata_json,{})
  const metadata={...oldMeta,deck:String(input.deck??oldMeta.deck??''),editorial_placement:'news',source_article:{...oldMeta.source_article,headline:title,deck:String(input.deck??oldMeta.deck??''),seo_title:String(input.seo_title??oldMeta.source_article?.seo_title??''),seo_description:String(input.seo_description??oldMeta.source_article?.seo_description??'')}}
  if (input.category_slug) {
    const category=await env.D1.prepare('SELECT id,slug,name FROM migration_categories WHERE slug=?').bind(String(input.category_slug)).first()
    if(!category) return json({error:'category-not-found'},400)
    metadata.category_relationships=[{id:category.id,categories_id:category.id,slug:category.slug,name:category.name}]
  }
  const content=typeof input.article_text==='string'?bodyFromText(input.article_text):parse(old?.content_json,{root:{type:'root',children:[]}})
  const sources=Array.isArray(input.sources)?input.sources:parse(old?.source_json,[])
  const now=new Date().toISOString()
  try {
    if(isPatch) {
      const result=await env.D1.prepare("UPDATE migration_articles SET title=?,updated_at=?,content_json=?,metadata_json=?,source_json=? WHERE id=? AND status='draft'").bind(title,now,JSON.stringify(content),JSON.stringify(metadata),JSON.stringify(sources),id).run()
      if(result.meta?.changes!==1) return json({error:'draft-not-updated'},409)
    } else {
      await env.D1.prepare('INSERT INTO migration_articles (id,slug,title,status,published_at,updated_at,content_json,metadata_json,source_json,image_json) VALUES (?,?,?,\'draft\',NULL,?,?,?,?,?)').bind(id,slug,title,now,JSON.stringify(content),JSON.stringify(metadata),JSON.stringify(sources),JSON.stringify({})).run()
    }
    return json({ok:true,id,slug,status:'draft'},isPatch?200:201)
  } catch {return json({error:'draft-write-failed-or-slug-conflict'},409)}
}
