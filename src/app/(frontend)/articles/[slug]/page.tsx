import { unstable_cache } from 'next/cache'
import SiteNav from '@/app/(frontend)/SiteNav'
import React from 'react'
import RelatedCoverage from './RelatedCoverage'
import Brand from '@/app/(frontend)/Brand'
import HeaderGlobe from '@/app/(frontend)/HeaderGlobe'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Metadata } from 'next'
const siteUrl = 'https://faultlinebrief.com'

// Cache the published article document, not the page response, for 60 seconds.
// Metadata and the article page reuse the same result at depth 2.
const getPublishedArticle = unstable_cache(async (slug: string) => {
 if (process.env.FAULTLINE_D1_READS === 'true') {
  const endpoint = process.env.FAULTLINE_D1_API_URL
  if (!endpoint) throw new Error('FAULTLINE_D1_API_URL must be set for D1 reads')
  const response = await fetch(endpoint.replace(/\/$/, '') + '/v1/articles/' + encodeURIComponent(slug), { next: { revalidate: 10 } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('D1 article detail request failed: ' + response.status)
  const item = await response.json() as Record<string, unknown>
  return {
   ...item, id: item.slug, status: 'published',
   seo: { title: item.seoTitle, description: item.seoDescription },
   content: item.body,
   categories: item.categoryRelationships,
  }
 }
 const payload = await getPayload({config})
 const result = await payload.find({collection:'articles' as any,where:{and:[{slug:{equals:slug}},{status:{equals:'published'}}]},limit:1,depth:2})
 return result.docs[0] || null
}, ['faultlinebrief-published-article-v1'], { revalidate: 10, tags: ['faultlinebrief-articles'] })

function imageUrl(media: unknown): string | undefined {
 if (!media || typeof media !== 'object') return undefined
 const item = media as { url?: unknown; filename?: unknown }
 const raw = typeof item.url === 'string' && item.url.trim()
  ? item.url.trim()
  : typeof item.filename === 'string' && item.filename.trim()
   ? `/api/media/file/${encodeURIComponent(item.filename.trim())}`
   : undefined
 if (!raw) return undefined
 try {
  const url = new URL(raw, siteUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
  // Relative media paths should always resolve to the public website.
  return url.href
 } catch { return undefined }
}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params
 const article=await getPublishedArticle(slug) as any
 if(!article) return {title:'Article not found | Faultline Brief',robots:{index:false}}
 const title=article.seo?.title||article.headline
 const description=article.seo?.description||article.deck
 const url=`${siteUrl}/articles/${encodeURIComponent(slug)}`
 const image=imageUrl(article.featuredImage)
 const media=article.featuredImage && typeof article.featuredImage==='object'?article.featuredImage:null
 const imageAlt=typeof media?.alt==='string' && media.alt.trim()?media.alt.trim():article.headline
 const imageWidth=Number(media?.width)
 const imageHeight=Number(media?.height)
 const socialImage=image?{url:image,alt:imageAlt,...(imageWidth>0&&imageHeight>0?{width:imageWidth,height:imageHeight}:{})}:undefined
 return {title,description,alternates:{canonical:url},openGraph:{title,description,url,type:'article',siteName:'Faultline Brief',publishedTime:article.publishedAt||undefined,modifiedTime:article.updatedAt||undefined,images:socialImage?[socialImage]:undefined},twitter:{card:image?'summary_large_image':'summary',title,description,images:image?[image]:undefined}}
}

export const dynamic = 'force-dynamic'
// Render the Payload Lexical document with its supported heading, list, link and text marks.
type LexicalNode = {
 type?: string
 text?: string
 children?: LexicalNode[]
 tag?: string
 format?: number | string
 listType?: string
 url?: string
 fields?: { url?: string; newTab?: boolean; linkType?: string; doc?: unknown }
}
// Backward-compatible presentation for older CMS articles saved as plain paragraphs.
// No database writes: only promote clearly identifiable standalone title-case lines.
function legacySubheading(node: LexicalNode, next?: LexicalNode): boolean {
 if (node.type !== 'paragraph' || next?.type !== 'paragraph') return false
 const children = node.children || []
 if (children.length !== 1 || children[0].type !== 'text') return false
 const line = (children[0].text || '').trim()
 if (line.length < 18 || line.length > 90 || /[.!?:;,]$/.test(line) || /[\n\r]/.test(line)) return false
 const words = line.split(/\s+/)
 if (words.length < 3 || words.length > 12) return false
 const minor = new Set(['a','an','the','and','or','but','for','nor','to','of','in','on','at','by','with','from','as','vs'])
 return words.every((word, index) => minor.has(word.toLowerCase()) && index > 0 || /^[A-Z][a-zA-Z’'-]*$/.test(word) || /^[A-Z]{2,}$/.test(word) || /^\d{2,4}$/.test(word))
}
function renderNodes(nodes: LexicalNode[] = []): React.ReactNode {
 return nodes.map((node, i) => {
   if (legacySubheading(node, nodes[i + 1])) return <h2 key={i}>{renderNodes(node.children || [])}</h2>
   if (node.type === 'linebreak') return <br key={i} />
   if (node.type === 'text') {
     let content: React.ReactNode = node.text || ''
     const format = typeof node.format === 'number' ? node.format : 0
     if (format & 1) content = <strong>{content}</strong>
     if (format & 2) content = <em>{content}</em>
     if (format & 4) content = <s>{content}</s>
     if (format & 8) content = <u>{content}</u>
     if (format & 16) content = <code>{content}</code>
     if (format & 32) content = <sub>{content}</sub>
     if (format & 64) content = <sup>{content}</sup>
     return <React.Fragment key={i}>{content}</React.Fragment>
   }
   const content = renderNodes(node.children || [])
   if (node.type === 'paragraph') {
     // Imported legacy records may contain multiple paragraphs and headings
     // inside one text node, rather than separate Lexical blocks.
     if (node.children?.length === 1 && node.children[0].type === 'text' && typeof node.children[0].text === 'string') {
       const raw = node.children[0].text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n')
       const blocks = raw.split(/\n\s*\n/).map(v => v.trim()).filter(Boolean)
       if (blocks.length > 1) return <React.Fragment key={i}>{blocks.map((block, j) => {
         const marked = block.match(/^#{2,4}\s+(.+)$/)
         if (marked) return <h2 key={j}>{marked[1]}</h2>
         const candidate: LexicalNode = {type:'paragraph',children:[{type:'text',text:block}]}
         if (legacySubheading(candidate, {type:'paragraph'})) return <h2 key={j}>{block}</h2>
         return <p key={j}>{block}</p>
       })}</React.Fragment>
     }
     return <p key={i}>{content}</p>
   }
   if (node.type === 'heading') {
     switch (node.tag) {
       case 'h1': return <h2 key={i}>{content}</h2> // Article title is the only page h1.
       case 'h3': return <h3 key={i}>{content}</h3>
       case 'h4': return <h4 key={i}>{content}</h4>
       case 'h5': return <h5 key={i}>{content}</h5>
       case 'h6': return <h6 key={i}>{content}</h6>
       default: return <h2 key={i}>{content}</h2>
     }
   }
   if (node.type === 'list') return node.listType === 'number' ? <ol key={i}>{content}</ol> : <ul key={i}>{content}</ul>
   if (node.type === 'listitem') return <li key={i}>{content}</li>
   if (node.type === 'quote') return <blockquote key={i}>{content}</blockquote>
   if (node.type === 'link' || node.type === 'autolink') {
     const url = node.fields?.url || node.url
     // Avoid emitting unsafe protocols from editor-provided links.
     const external = url?.startsWith('https://') || url?.startsWith('http://')
     const allowed = external || url?.startsWith('mailto:') || (url?.startsWith('/') && !url.startsWith('//'))
     if (!url || !allowed) return <span key={i}>{content}</span>
     return <a key={i} href={url} target={external && node.fields?.newTab ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{content}</a>
   }
   return <React.Fragment key={i}>{content}</React.Fragment>
 })
}
export default async function ArticlePage({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params
 const article=await getPublishedArticle(slug) as any
 if(!article) notFound()
 const media=article.featuredImage && typeof article.featuredImage==='object'?article.featuredImage:null
 const image=imageUrl(media)
 const isNewsUpdate = article.editorialPlacement === 'news' || (!article.editorialPlacement && Array.isArray(article.categories) && article.categories.some((category: any) => typeof category === 'object' && category?.slug === 'latest-news'))
 const articleUrl=`${siteUrl}/articles/${encodeURIComponent(slug)}`
 const modifiedAt = article.updatedAt && (!article.publishedAt || Date.parse(article.updatedAt) >= Date.parse(article.publishedAt)) ? article.updatedAt : article.publishedAt
 const structuredData={
  '@context':'https://schema.org',
  '@type':'NewsArticle',
  headline:article.headline,
  description:article.seo?.description||article.deck,
  mainEntityOfPage:{'@type':'WebPage','@id':articleUrl},
  url:articleUrl,
  ...(image?{image:[image]}:{}),
  ...(article.publishedAt?{datePublished:article.publishedAt}:{}),
  ...(modifiedAt?{dateModified:modifiedAt}:{}),
  author:{'@type':'Organization',name:'Faultline Brief Editorial Desk',url:`${siteUrl}/editorial-team`},
  publisher:{'@type':'NewsMediaOrganization','@id':`${siteUrl}/#organization`,name:'Faultline Brief',url:siteUrl},
 }
 const structuredDataJson=JSON.stringify(structuredData).replace(/</g,'\\u003c')
 return <div className="site"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:structuredDataJson}} /><div className="utility"><span>FAULTLINE BRIEF / INTELLIGENCE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div><header className="masthead"><div className="masthead-identity"><Brand /><p>Understand what happened. Know why it matters.</p></div><HeaderGlobe /></header><SiteNav /><div className="article-content-layout"><main className="article-page"><span className="eyebrow">{isNewsUpdate ? "FAULTLINE BRIEF / NEWS UPDATE" : "FAULTLINE BRIEF / ANALYSIS"}</span><h1>{article.headline}</h1><p className="deck">{article.deck}</p><p className="article-byline"><span>By <Link href="/editorial-team">Faultline Brief Editorial Desk</Link></span>{article.publishedAt && <> · <time dateTime={article.publishedAt}>Published {new Date(article.publishedAt).toLocaleString('en-US',{year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Karachi',timeZoneName:'short'})}</time></>}</p>{image && <img className="hero-image" src={image} alt={media.alt||article.headline} width={1200} height={675} loading="eager" fetchPriority="high" decoding="async" style={{width:"100%",height:"auto"}}/>}<div className="article-body">{renderNodes(article.body?.root?.children||[])}</div>{article.sources?.length>0 && <section><h2>Sources</h2><ul>{article.sources.map((s:any,i:number)=><li key={i}>{s.url?<a href={s.url} rel="noopener noreferrer nofollow" target="_blank">{s.name}</a>:s.name}</li>)}</ul></section>}<RelatedCoverage currentSlug={slug} currentCategories={(Array.isArray(article.categories) ? article.categories : []).map((c: any) => typeof c === 'object' ? c?.id : c)} /><p className="preferred-source-invite">Follow our reporting: <a href="https://www.google.com/preferences/source?q=faultlinebrief.com" target="_blank" rel="noopener noreferrer">Add Faultline Brief as a Preferred Source on Google →</a></p><p><Link className="read-link" href="/">← BACK TO LATEST</Link></p></main></div><footer><strong>FAULTLINE BRIEF<span>.</span></strong><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Standards</Link></div></footer></div>
}
