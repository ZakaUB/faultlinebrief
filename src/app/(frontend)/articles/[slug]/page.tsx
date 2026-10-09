import React from 'react'
import Brand from '@/app/(frontend)/Brand'
import HeaderGlobe from '@/app/(frontend)/HeaderGlobe'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Metadata } from 'next'
const siteUrl = 'https://faultlinebrief.com'
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
 const payload=await getPayload({config})
 const result=await payload.find({collection:'articles' as any,where:{and:[{slug:{equals:slug}},{status:{equals:'published'}}]},limit:1,depth:1})
 const article=result.docs[0] as any
 if(!article) return {title:'Article not found | Faultline Brief',robots:{index:false}}
 const title=article.seo?.title||article.headline
 const description=article.seo?.description||article.deck
 const url=`${siteUrl}/articles/${encodeURIComponent(slug)}`
 const image=imageUrl(article.featuredImage)
 return {title,description,alternates:{canonical:url},openGraph:{title,description,url,type:'article',siteName:'Faultline Brief',publishedTime:article.publishedAt||undefined,modifiedTime:article.updatedAt||undefined,images:image?[{url:image,alt:article.headline}]:undefined},twitter:{card:image?'summary_large_image':'summary',title,description,images:image?[image]:undefined}}
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
function renderNodes(nodes: LexicalNode[] = []): React.ReactNode {
 return nodes.map((node, i) => {
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
   if (node.type === 'paragraph') return <p key={i}>{content}</p>
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
 const payload=await getPayload({config})
 const result=await payload.find({collection:'articles' as any,where:{and:[{slug:{equals:slug}},{status:{equals:'published'}}]},limit:1,depth:2})
 const article=result.docs[0] as any
 if(!article) notFound()
 const media=article.featuredImage && typeof article.featuredImage==='object'?article.featuredImage:null
 const image=imageUrl(media)
 const articleUrl=`${siteUrl}/articles/${encodeURIComponent(slug)}`
 const structuredData={
  '@context':'https://schema.org',
  '@type':'NewsArticle',
  headline:article.headline,
  description:article.seo?.description||article.deck,
  mainEntityOfPage:{'@type':'WebPage','@id':articleUrl},
  url:articleUrl,
  ...(image?{image:[image]}:{}),
  ...(article.publishedAt?{datePublished:article.publishedAt}:{}),
  ...(article.updatedAt?{dateModified:article.updatedAt}:{}),
  author:{'@type':'Organization',name:'Faultline Brief',url:siteUrl},
  publisher:{'@type':'Organization',name:'Faultline Brief',url:siteUrl},
 }
 const structuredDataJson=JSON.stringify(structuredData).replace(/</g,'\\u003c')
 return <div className="site"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:structuredDataJson}} /><div className="utility"><span>FAULTLINE BRIEF / INTELLIGENCE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div><header className="masthead"><div className="masthead-identity"><Brand /><p>Understand what happened. Know why it matters.</p></div><HeaderGlobe /></header><nav className="nav" aria-label="Main navigation"><Link href="/">Latest</Link><Link href="/categories/geopolitics">Geopolitics</Link><Link href="/categories/conflict">Conflict</Link><Link href="/categories/security">Security</Link><Link href="/about">About</Link></nav><div className="article-ad-layout"><aside className="article-rail article-rail-left" aria-label="Left advertising placement"><div className="ad-slot article-side-ad"><span>ADVERTISEMENT</span><small>VERTICAL BANNER</small><small>160 × 600</small></div></aside><main className="article-page"><span className="eyebrow">FAULTLINE BRIEF / ANALYSIS</span><h1>{article.headline}</h1><p className="deck">{article.deck}</p>{article.publishedAt && <p className="eyebrow">{new Date(article.publishedAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Karachi'})}</p>}{media?.url && <img className="hero-image" src={media.url} alt={media.alt||article.headline}/>}<div className="article-body">{renderNodes(article.body?.root?.children||[])}</div>{article.sources?.length>0 && <section><h2>Sources</h2><ul>{article.sources.map((s:any,i:number)=><li key={i}>{s.url?<a href={s.url} rel="noopener noreferrer nofollow" target="_blank">{s.name}</a>:s.name}</li>)}</ul></section>}<p><Link className="read-link" href="/">← BACK TO LATEST</Link></p></main><aside className="article-rail article-rail-right" aria-label="Right advertising placement"><div className="ad-slot article-side-ad"><span>ADVERTISEMENT</span><small>VERTICAL BANNER</small><small>160 × 600</small></div></aside></div><footer><strong>FAULTLINE BRIEF<span>.</span></strong><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Standards</Link></div></footer></div>
}
