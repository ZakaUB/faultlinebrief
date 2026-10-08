import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Brand from '@/app/(frontend)/Brand'
import { previews, storyPhotos } from '../../page'

export const metadata = { title: 'Recovered Archive by Category | Faultline Brief', robots: { index: false, follow: false } }

export default async function ArchivePreviewCategory({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params
 const names:Record<string,string>={geopolitics:'Geopolitics',conflict:'Conflict',security:'Security'}
 const name=names[slug]
 if(!name) notFound()
 const stories=previews.map((story,i)=>({...story,photo:storyPhotos[i]})).filter(story=>story.category===name)
 return <div className="site">
  <div className="utility"><span>FAULTLINE BRIEF / EDITORIAL WORKSPACE</span><span>ARCHIVE RECOVERY · NOT FOR PUBLICATION</span></div>
  <header className="masthead"><Brand/><p>Understand what happened. Know why it matters.</p></header>
  <nav className="nav" aria-label="Archive preview navigation"><Link href="/archive-preview">All archive previews</Link><Link href="/archive-preview/category/geopolitics">Geopolitics</Link><Link href="/archive-preview/category/conflict">Conflict</Link><Link href="/archive-preview/category/security">Security</Link></nav>
  <main className="coverage">
   <div className="section-heading"><span>{name.toUpperCase()} / RECOVERED ARCHIVE</span><span>{stories.length} UNPUBLISHED PREVIEW STORIES</span></div>
   <section className="about" style={{marginTop:24}}>
    <span className="eyebrow">EDITORIAL DESIGN PREVIEW · NOT INDEXED</span>
    <h1>{name} archive</h1>
    <p>Recovered historical story leads grouped by topic. These are not published articles; recorded dates are from source materials and Facebook publication dates remain unverified.</p>
   </section>
   <div className="story-grid">{stories.map((story,i)=><article className="story-card" key={story.headline}>
    <div style={{width:'100%',aspectRatio:'16 / 9',overflow:'hidden',background:'#081725',border:'1px solid #294358',marginBottom:20}}>
     <Image src={story.photo.src} alt={story.photo.caption} width={640} height={360} quality={65} loading="lazy" sizes="(max-width: 700px) 100vw, 33vw" style={{display:'block',width:'100%',height:'100%',objectFit:'cover',margin:0}}/>
    </div><p className="photo-credit">{story.photo.caption} · <a href={story.photo.source} target="_blank" rel="noopener noreferrer">Source / license</a></p>
    <span className="eyebrow">{story.category.toUpperCase()} / ARCHIVE PREVIEW</span>
    <h2>{story.headline}</h2>
    <p>{story.deck}</p>
    <p style={{fontSize:12}}>{story.context}</p>
    <span className="eyebrow">SOURCE MATERIAL: {story.date.toUpperCase()}</span>
   </article>)}</div>
  </main>
  <footer><strong>FAULTLINE BRIEF<span>.</span></strong><span>EDITORIAL PREVIEW — UNPUBLISHED</span><Link href="/archive-preview">All archive previews</Link></footer>
 </div>
}
