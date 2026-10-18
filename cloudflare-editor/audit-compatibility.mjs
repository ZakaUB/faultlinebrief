import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Client } from 'pg';
import * as cheerio from 'cheerio';
const base='https://faultlinebrief.com';
const slug='why-greenland-matters-us-europe-nato-arctic-minerals-security';
const liveUrl=base+'/articles/'+slug;
const editor='https://faultlinebrief-editor-staging.zakria25.workers.dev';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
const failures=[];
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+detail:''));if(!ok)failures.push(name)}
function clean(s){return String(s??'').replace(/\s+/g,' ').trim()}
async function live(){const r=await fetch(liveUrl,{headers:{'User-Agent':'FaultlineBrief-Staging-Compatibility-Audit/1.0'},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);return await r.text()}
async function article(){return (await db.query('SELECT a.*,m.url AS media_url,m.alt AS media_alt,m.filename AS media_filename FROM public.articles a LEFT JOIN public.media m ON m.id=a.featured_image_id WHERE a.id=30')).rows[0]}
await db.connect();
try{
const htmlBefore=await live(),$=cheerio.load(htmlBefore),a=await article(),baseline=sha(JSON.stringify(a));
check('PUBLIC_ARTICLE_STATUS',a.status==='published');
check('SLUG_AND_HEADLINE',a.slug===slug&&clean($('main h1').first().text())===clean(a.headline));
check('DECK',clean($('main .deck').first().text())===clean(a.deck));
const nodes=a.body?.root?.children||[];
const expected=[];
function flatten(node){return (node.children||[]).map(n=>n.type==='linebreak'?'\n':n.type==='text'?n.text||'':flatten(n)).join('')}
for(const n of nodes){if(n.type==='paragraph')expected.push({tag:'p',text:clean(flatten(n))});else if(n.type==='heading')expected.push({tag:n.tag==='h1'?'h2':n.tag||'h2',text:clean(flatten(n))});else if(n.type==='quote')expected.push({tag:'blockquote',text:clean(flatten(n))});else if(n.type==='list')expected.push({tag:n.listType==='number'?'ol':'ul',text:clean(flatten(n))});else expected.push({tag:n.type,text:clean(flatten(n))})}
const rendered=$('main .article-body').children().toArray().map(el=>({tag:el.tagName,text:clean($(el).text())}));
check('ALL_RICH_TEXT_BLOCKS',expected.length===rendered.length&&expected.every((n,i)=>n.tag===rendered[i]?.tag&&n.text===rendered[i]?.text),'expected='+expected.length+' rendered='+rendered.length);
const headings=expected.filter(n=>/^h[1-6]$/.test(n.tag));check('HEADINGS',headings.every((n)=>rendered.some(x=>x.tag===n.tag&&x.text===n.text)),'count='+headings.length);
const marks=[];const links=[];
function walk(n){if(n.type==='text'&&n.format)marks.push({text:n.text,format:n.format});if(n.type==='link'||n.type==='autolink')links.push({url:n.fields?.url||n.url,text:clean(flatten(n))});for(const c of n.children||[])walk(c)}
for(const n of nodes)walk(n);
const body=$('main .article-body');
const bits=[[1,'strong'],[2,'em'],[4,'s'],[8,'u'],[16,'code'],[32,'sub'],[64,'sup']];
const missingMarks=marks.filter(m=>bits.some(([bit,tag])=>(m.format&bit)&&!body.find(tag).toArray().some(el=>$(el).text().includes(m.text))));
check('TEXT_FORMATTING',missingMarks.length===0,'marks='+marks.length+' missing='+missingMarks.length);
const missingLinks=links.filter(l=>!body.find('a').toArray().some(el=>$(el).attr('href')===l.url&&clean($(el).text())===l.text));
check('INLINE_LINKS',missingLinks.length===0,'links='+links.length+' missing='+missingLinks.length);
const img=$('main img.hero-image').first();const liveImg=new URL(img.attr('src')||'',base).href;const storedImg=new URL(a.media_url||'',base).href;
check('FEATURED_IMAGE_SOURCE',liveImg===storedImg);
check('FEATURED_IMAGE_ALT',clean(img.attr('alt'))===clean(a.media_alt));
const ir=await fetch(liveImg,{signal:AbortSignal.timeout(30000)});const ib=Buffer.from(await ir.arrayBuffer());
check('IMAGE_BYTES_AND_TYPE',ir.ok&&ib.length>0&&String(ir.headers.get('content-type')).startsWith('image/'),'bytes='+ib.length+' sha256='+sha(ib).slice(0,16));
const canonical=$('link[rel="canonical"]').attr('href');check('CANONICAL',canonical===liveUrl,canonical||'missing');
const title=clean($('title').first().text());check('SEO_TITLE',title.includes(a.seo_title||a.headline),title);
check('SEO_DESCRIPTION',clean($('meta[name="description"]').attr('content'))===clean(a.seo_description||a.deck));
check('OPEN_GRAPH', $('meta[property="og:url"]').attr('content')===liveUrl&&clean($('meta[property="og:title"]').attr('content'))===clean(a.seo_title||a.headline)&&clean($('meta[property="og:description"]').attr('content'))===clean(a.seo_description||a.deck));
let schema=[];for(const e of $('script[type="application/ld+json"]').toArray()){try{const v=JSON.parse($(e).html());schema.push(...(Array.isArray(v)?v:[v]))}catch{}}
const news=schema.find(v=>v['@type']==='NewsArticle');check('NEWSARTICLE_SCHEMA',!!news&&news.url===liveUrl&&news.headline===a.headline&&news.datePublished===new Date(a.published_at).toISOString());
const cookieLogin=await fetch(editor+'/login',{method:'POST',headers:{'Content-Type':'application/json','Origin':editor},body:JSON.stringify({password:process.env.EDITOR_BOOTSTRAP_PASSWORD})});
check('EDITOR_LOGIN_FOR_TEST',cookieLogin.ok);
const cookie=(cookieLogin.headers.get('set-cookie')||'').split(';')[0];assert(cookie);
const headers={'Content-Type':'application/json','Origin':editor,'Cookie':cookie};
const report=await fetch(editor+'/editor/compatibility-report',{headers:{Cookie:cookie}});const reportJson=await report.json();check('READ_ONLY_COMPATIBILITY_REPORT',report.ok&&reportJson.readonly===true&&reportJson.body_blocks===nodes.length);
const testSlug='cf-staging-test-parity-'+crypto.randomUUID().slice(0,16);
const created=await fetch(editor+'/editor/articles',{method:'POST',headers,body:JSON.stringify({slug:testSlug,headline:'Isolated compatibility test draft',deck:'This is an isolated automated editorial compatibility test draft.'})});
const c=await created.json();check('ISOLATED_DRAFT_CREATE',created.status===201,c.error||'');
if(created.ok){
const id=c.article.id;const before=(await db.query('SELECT * FROM public.articles WHERE id=$1',[id])).rows[0];
const update=await fetch(editor+'/editor/articles/'+id,{method:'PATCH',headers,body:JSON.stringify({action:'edit',headline:'Isolated compatibility test draft updated',deck:'Updated isolated compatibility test draft without modifying unrelated fields.',article_text:'First paragraph of the compatibility test.\\n\\nSecond paragraph of the compatibility test.',seo_title:'Staging compatibility test SEO',seo_description:'Staging test metadata description.'})});
const uj=await update.json();check('STAGING_EDITOR_SAVE',update.ok,uj.error||'');
const after=(await db.query('SELECT * FROM public.articles WHERE id=$1',[id])).rows[0];
const allowed=new Set(['headline','deck','body','seo_title','seo_description','updated_at']);
const changed=Object.keys(before).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
check('UNRELATED_FIELDS_PRESERVED',changed.every(k=>allowed.has(k)),'changed='+changed.join(','));
check('STAGING_RICH_TEXT_SAVE',after.body?.root?.children?.length===2);
check('STAGING_SEO_SAVE',after.seo_title==='Staging compatibility test SEO'&&after.seo_description==='Staging test metadata description.');
}
const current=await article();check('REFERENCE_ARTICLE_UNCHANGED',sha(JSON.stringify(current))===baseline);
const htmlAfter=await live();const beforeDom=cheerio.load(htmlBefore),afterDom=cheerio.load(htmlAfter);const stable=dom=>({title:clean(dom('title').text()),h1:clean(dom('main h1').text()),deck:clean(dom('main .deck').text()),body:clean(dom('main .article-body').html()),canonical:dom('link[rel="canonical"]').attr('href'),description:dom('meta[name="description"]').attr('content'),ogTitle:dom('meta[property="og:title"]').attr('content'),ogDescription:dom('meta[property="og:description"]').attr('content'),ogUrl:dom('meta[property="og:url"]').attr('content'),image:dom('main img.hero-image').attr('src'),alt:dom('main img.hero-image').attr('alt'),jsonLd:dom('script[type="application/ld+json"]').toArray().map(el=>clean(dom(el).html()))});check('PUBLIC_SEO_AND_ARTICLE_UNCHANGED_AFTER_STAGING_EDIT',sha(JSON.stringify(stable(beforeDom)))===sha(JSON.stringify(stable(afterDom))),'stable-before='+sha(JSON.stringify(stable(beforeDom))).slice(0,12)+' stable-after='+sha(JSON.stringify(stable(afterDom))).slice(0,12));
console.log('AUDIT_SUMMARY '+JSON.stringify({failures,blocks:expected.length,headings:headings.length,links:links.length,marks:marks.length,reference_id:30,live_url:liveUrl}));
if(failures.length)process.exitCode=1;
}finally{await db.end()}
