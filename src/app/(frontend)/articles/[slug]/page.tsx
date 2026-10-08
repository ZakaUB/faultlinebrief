import Brand from '@/app/(frontend)/Brand'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { Metadata } from 'next'
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params
 const payload=await getPayload({config})
 const result=await payload.find({collection:'articles' as any,where:{and:[{slug:{equals:slug}},{status:{equals:'published'}}]},limit:1,depth:1})
 const article=result.docs[0] as any
 if(!article) return {title:'Article not found | Faultline Brief',robots:{index:false}}
 const title=article.seo?.title||article.headline
 const description=article.seo?.description||article.deck
 const url=`https://faultlinebrief.com/articles/${encodeURIComponent(slug)}`
 return {title,description,alternates:{canonical:url},openGraph:{title,description,url,type:'article',siteName:'Faultline Brief',publishedTime:article.publishedAt||undefined,modifiedTime:article.updatedAt||undefined},twitter:{card:'summary_large_image',title,description}}
}

export const dynamic = 'force-dynamic'
type Node = { type?: string; text?: string; children?: Node[]; tag?: string; format?: number }
function renderNodes(nodes: Node[] = []): React.ReactNode {
 return nodes.map((node,i) => {
   if(node.type==='text') return <span key={i}>{node.text}</span>
   const content=renderNodes(node.children || [])
   if(node.type==='paragraph') return <p key={i}>{content}</p>
   if(node.type==='heading') return <h2 key={i}>{content}</h2>
   if(node.type==='list') return <ul key={i}>{content}</ul>
   if(node.type==='listitem') return <li key={i}>{content}</li>
   if(node.type==='quote') return <blockquote key={i}>{content}</blockquote>
   return <div key={i}>{content}</div>
 })
}
export default async function ArticlePage({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params
 const payload=await getPayload({config})
 const result=await payload.find({collection:'articles' as any,where:{and:[{slug:{equals:slug}},{status:{equals:'published'}}]},limit:1,depth:2})
 const article=result.docs[0] as any
 if(!article) notFound()
 const media=article.featuredImage && typeof article.featuredImage==='object'?article.featuredImage:null
 return <div className="site"><div className="utility"><span>FAULTLINE BRIEF / INTELLIGENCE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div><header className="masthead"><Brand /><p>Understand what happened. Know why it matters.</p></header><nav className="nav"><Link href="/">LATEST</Link><Link href="/about">ABOUT</Link><Link href="/editorial-standards">EDITORIAL STANDARDS</Link></nav><main className="article-page"><span className="eyebrow">FAULTLINE BRIEF / ANALYSIS</span><h1>{article.headline}</h1><p className="deck">{article.deck}</p>{article.publishedAt && <p className="eyebrow">{new Date(article.publishedAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</p>}{media?.url && <img className="hero-image" src={media.url} alt={media.alt||article.headline}/>}<div className="article-body">{renderNodes(article.body?.root?.children||[])}</div>{article.sources?.length>0 && <section><h2>Sources</h2><ul>{article.sources.map((s:any,i:number)=><li key={i}>{s.url?<a href={s.url} rel="noopener noreferrer nofollow" target="_blank">{s.name}</a>:s.name}</li>)}</ul></section>}<p><Link className="read-link" href="/">← BACK TO LATEST</Link></p></main><footer><strong>FAULTLINE BRIEF<span>.</span></strong><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Standards</Link></div></footer></div>
}
