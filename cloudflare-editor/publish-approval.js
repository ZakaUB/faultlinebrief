// Explicit editorial approval flow. Requires migration cms_publish_approvals.sql.
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const eq=async(a,b)=>{const x=await hash(a),y=await hash(b);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0};
export async function approvalEndpoint(request,env,authenticated){
 const url=new URL(request.url);
 if(env.EDITOR_PRODUCTION_MODE!=="live"||!env.D1)return respond({error:"not-enabled"},503);
 if(request.method!=="POST")return respond({error:"method-not-allowed"},405);
 if(Number(request.headers.get("content-length")||0)>4096)return respond({error:"too-large"},413);
 let body;try{body=await request.json()}catch{return respond({error:"invalid-json"},400)}
 const id=body?.id,slug=body?.expectedSlug;
 if(typeof id!=="string"||!/^[a-zA-Z0-9_-]{1,120}$/.test(id)||typeof slug!=="string"||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>160)return respond({error:"invalid-article"},400);
 if(url.pathname==="/editor/approve-publish"){
  // Browser approval requires a valid editor session and same-origin request.
  if(request.headers.get("origin")!==url.origin||!await authenticated())return respond({error:"unauthorized"},401);
  const article=await env.D1.prepare("SELECT id,slug,status,image_json FROM migration_articles WHERE id=? AND slug=?").bind(id,slug).first();
  if(!article||article.status!=="draft")return respond({error:"draft-not-found"},404);
  let image;try{image=JSON.parse(article.image_json||"{}")}catch{image={}}
  if(!image?.url&&!image?.id)return respond({error:"featured-image-required"},409);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,"0")).join("");
  const tokenHash=await hash(token),expires=new Date(Date.now()+5*60*1000).toISOString();
  try{await env.D1.prepare("INSERT INTO cms_publish_approvals (token_hash,article_id,slug,expires_at) VALUES (?,?,?,?)").bind(tokenHash,id,slug,expires).run()}
  catch{return respond({error:"approval-storage-not-configured"},503)}
  return respond({ok:true,approvalToken:token,id,expectedSlug:slug,expiresAt:expires});
 }
 if(url.pathname==="/integration/v1/approved-publish"){
  if(!env.CMS_PUBLISH_API_TOKEN||env.CMS_PUBLISH_API_TOKEN.length<40)return respond({error:"publishing-not-configured"},503);
  const bearer=request.headers.get("authorization")||"";
  if(!bearer.startsWith("Bearer ")||!await eq(bearer.slice(7),env.CMS_PUBLISH_API_TOKEN))return respond({error:"unauthorized"},401);
  if(typeof body.approvalToken!=="string"||!/^[a-f0-9]{64}$/.test(body.approvalToken))return respond({error:"invalid-approval"},400);
  const tokenHash=await hash(body.approvalToken);
  try{
   const approved=await env.D1.prepare("SELECT token_hash FROM cms_publish_approvals WHERE token_hash=? AND article_id=? AND slug=? AND expires_at>?").bind(tokenHash,id,slug,new Date().toISOString()).first();
   if(!approved)return respond({error:"approval-expired-or-used"},409);
   const article=await env.D1.prepare("SELECT image_json FROM migration_articles WHERE id=? AND slug=? AND status='draft'").bind(id,slug).first();
   if(!article)return respond({error:"draft-not-found"},404);
   let image;try{image=JSON.parse(article.image_json||"{}")}catch{image={}}
   if(!image?.url&&!image?.id)return respond({error:"featured-image-required"},409);
   const now=new Date().toISOString();
   // Single conditional UPDATE is atomic and idempotent under concurrent requests.
   // The approval record is consumed after a successful publication; status='draft' prevents reuse.
   const published=await env.D1.prepare("UPDATE migration_articles SET status='published',published_at=COALESCE(published_at,?),updated_at=? WHERE id=? AND slug=? AND status='draft' AND EXISTS (SELECT 1 FROM cms_publish_approvals WHERE token_hash=? AND article_id=? AND slug=? AND expires_at>?) RETURNING id,slug,status").bind(now,now,id,slug,tokenHash,id,slug,now).first();
   if(!published)return respond({error:"approval-expired-or-draft-changed"},409);
   await env.D1.prepare("DELETE FROM cms_publish_approvals WHERE token_hash=?").bind(tokenHash).run().catch(()=>{});
   return respond({ok:true,article:published,url:"https://faultlinebrief.com/articles/"+slug});

  }catch{return respond({error:"publish-transaction-failed"},503)}
 }
 return respond({error:"not-found"},404);
}
