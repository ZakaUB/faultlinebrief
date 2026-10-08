import Brand from '@/app/(frontend)/Brand'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params
 const payload=await getPayload({config})
 const categories=await payload.find({collection:'categories' as any,where:{slug:{equals:slug}},limit:1})
 const category=categories.docs[0] as any
 if(!category) notFound()
 const results=await payload.find({collection:'articles' as any,where:{and:[{status:{equals:'published'}},{categories:{in:[category.id]}}]},sort:'-publishedAt',limit:30,depth:1})
 return <div className="site"><div className="utility"><span>INDEPENDENT GEOPOLITICAL INTELLIGENCE</span><span>GEOPOLITICS · CONFLICT · SECURITY</span></div><header className="masthead"><Brand /><p>Understand what happened. Know why it matters.</p></header><nav className="nav" aria-label="Main navigation"><Link href="/">Latest</Link><Link href="/categories/geopolitics">Geopolitics</Link><Link href="/categories/conflict">Conflict</Link><Link href="/categories/security">Security</Link><Link href="/about">About</Link></nav><main className="coverage category-page"><div className="section-heading"><span>{category.name.toUpperCase()}</span><span>FAULTLINE BRIEF / COVERAGE</span></div><div className="empty-state"><h1>{category.name}</h1><p>{category.description||'Independent reporting, context and analysis.'}</p></div>{results.docs.length?<div className="story-grid">{results.docs.map((item:any)=><article className="story-card" key={item.id}><span className="eyebrow">{category.name}</span><h2><Link href={`/articles/${item.slug}`}>{item.headline}</Link></h2><p>{item.deck}</p><Link className="read-link" href={`/articles/${item.slug}`}>READ MORE →</Link></article>)}</div>:<p className="no-stories">No published briefings in this category yet.</p>}</main><footer><strong>FAULTLINE BRIEF<span>.</span></strong><div className="legal-links"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/editorial-standards">Editorial Standards</Link></div></footer></div>
}
