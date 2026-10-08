import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
export const dynamic='force-dynamic'
const base='https://faultlinebrief.com'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
 const fixed=['','/about','/contact','/privacy','/editorial-standards','/categories/geopolitics','/categories/conflict','/categories/security','/briefings/trump-iran-strikes-midterms','/briefings/syria-saudi-houthi-escalation'].map(path=>({url:base+path,changeFrequency:'weekly' as const,priority:path===''?1:0.5}))
 try {
  const payload=await getPayload({config})
  const result=await payload.find({collection:'articles' as any,where:{status:{equals:'published'}},limit:1000,sort:'-publishedAt'})
  return [...fixed,...result.docs.map((a:any)=>({url:`${base}/articles/${encodeURIComponent(a.slug)}`,lastModified:a.updatedAt?new Date(a.updatedAt):undefined,changeFrequency:'weekly' as const,priority:0.8}))]
 } catch {return fixed}
}
