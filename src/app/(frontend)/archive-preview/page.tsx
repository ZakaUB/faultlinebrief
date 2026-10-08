import Link from 'next/link'
import Brand from '@/app/(frontend)/Brand'

export const metadata = { title: 'Recovered Archive Preview | Faultline Brief', robots: { index: false, follow: false } }

// Editorial previews derived from previously created Faultline Brief graphics.
// These are NOT published articles, and dates are asset dates, not verified Facebook post dates.
export const previews = [
 { date: '8 September 2026', category: 'Conflict', headline: 'UN Condemns Houthi Attacks on Saudi Arabia, Warns of Escalation Risk', deck: 'A previously created Faultline Brief graphic covered reported cross-border attacks, civilian impacts and concerns about wider escalation.', context: 'The graphic focused on the humanitarian situation in Yemen, regional stability and efforts to reduce escalation.' },
 { date: '8 September 2026', category: 'Conflict', headline: 'Ukraine Reports Major Overnight Drone and Missile Attacks', deck: 'A previously created briefing graphic described Ukrainian reports of strikes across multiple regions and damage to civilian infrastructure.', context: 'The briefing highlighted civilian safety, damage assessments and international support as developments to monitor.' },
 { date: '8 September 2026', category: 'Geopolitics', headline: 'UN Warns of Intensifying Climate Impacts as 2026 Sets New Heat Records', deck: 'A previously created graphic discussed extreme weather, climate risks and possible consequences for food and water security.', context: 'The briefing connected environmental disruption with economic vulnerability and global stability.' },
 { date: '11 September 2026', category: 'Conflict', headline: 'Houthis Reach Dhubab Port in Yemen', deck: 'A previously created graphic attributed a report about Dhubab to Reuters and identified Bab el-Mandeb as a strategic maritime chokepoint.', context: 'This is a recovered graphic headline, not an independently verified current assessment.' },
 { date: '13 September 2026', category: 'Security', headline: 'Russia’s New Drones Are Changing the Air War Over Ukraine', deck: 'An earlier Faultline Brief article examined how drone technology affects the economics and tactics of aerial warfare.', context: 'Original article text must be recovered before this can be published as a historical article.' },
 { date: '15 September 2026', category: 'Geopolitics', headline: 'Saudi Arabia’s Oil Bypass Is Now a Global Security Problem', deck: 'A website draft described converging pressures across the Gulf, Saudi Arabia and the Red Sea, and risks to global energy flows.', context: 'The headline and summary survive in the earlier site draft; the complete article has not yet been recovered.' },
 { date: '19 September 2026', category: 'Conflict', headline: 'Houthi Escalation Reaches Riyadh’s Main International Airport', deck: 'An earlier Faultline Brief article explored reported regional escalation and its security implications.', context: 'This entry is a title-level recovery lead awaiting the original full text and publication evidence.' },
 { date: '28 September 2026', category: 'Security', headline: 'Iraq Takes Control of U.S. Facility at Baghdad Airport', deck: 'An earlier article addressed the changing security arrangements around Baghdad airport and coalition withdrawal.', context: 'The full original body and Facebook publication date still need verification.' },
 { date: '7 October 2026', category: 'Conflict', headline: 'The Battle for Bab el-Mandeb Is Widening Yemen’s War', deck: 'An earlier analysis focused on the strategic importance of the Bab el-Mandeb maritime corridor.', context: 'This is a recovery preview only, pending the complete original article.' },
 { date: '7 October 2026', category: 'Conflict', headline: 'Three Years After October 7 — Gaza Still Has No Endgame', deck: 'A previously created commemorative graphic examined the war’s human cost, regional repercussions and unresolved questions about Gaza’s future.', context: 'The preview reflects the graphic’s editorial framing; numerical claims require verification before publication.' },
]

export const storyPhotos = [
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Bab%20Al-Mandeb%20Strait%2C%20between%20Djibouti%20and%20Yemen.jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Bab_Al-Mandeb_Strait%2C_between_Djibouti_and_Yemen.jpg",
    "caption": "U.S. Navy photograph in the Bab al-Mandeb Strait, 2018; contextual image, not the reported incident"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Destructions%20in%20Kyiv%20after%20Russian%20attack%2C%202026-07-06%20(06).jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Destructions_in_Kyiv_after_Russian_attack%2C_2026-07-06_(06).jpg",
    "caption": "Damaged apartment building in Kyiv, 6 July 2026; contextual image, not the reported September strike"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Bab%20al-Mandab%20Strait.jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Bab_al-Mandab_Strait.jpg",
    "caption": "Satellite view of the Bab al-Mandab Strait, 2018; geographic context for climate and security impacts"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/ISS-47%20Port%20of%20Aden%2C%20Yemen.jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:ISS-47_Port_of_Aden%2C_Yemen.jpg",
    "caption": "International Space Station view of Aden port; contextual photograph, not Dhubab"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Destructions%20in%20Kyiv%20after%20Russian%20attack%2C%202026-06-15%20(01).jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Destructions_in_Kyiv_after_Russian_attack%2C_2026-06-15_(01).jpg",
    "caption": "Kyiv building damaged in a June 2026 drone and missile attack; contextual image"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Container%20Ship%20'Ever%20Given'%20stuck%20in%20the%20Suez%20Canal%2C%20Egypt%20-%20March%2024th%2C%202021%20(51070311183).jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Container_Ship_'Ever_Given'_stuck_in_the_Suez_Canal%2C_Egypt_-_March_24th%2C_2021_(51070311183).jpg",
    "caption": "Container vessel in the Suez Canal, March 2021; historical illustration of maritime trade vulnerability"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Bab%20Al-Mandeb%20Strait%2C%20between%20Djibouti%20and%20Yemen.jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Bab_Al-Mandeb_Strait%2C_between_Djibouti_and_Yemen.jpg",
    "caption": "U.S. Navy security operations in Bab al-Mandeb, 2018; not Riyadh airport or the reported event"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Baghdad%20International%20Airport.jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Baghdad_International_Airport.jpg",
    "caption": "Baghdad International Airport photographed in 2007; contextual image, not the reported handover"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Bab-el-Mandeb%20Seen%20From%20Midchannel%20(cropped).jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Bab-el-Mandeb_Seen_From_Midchannel_(cropped).jpg",
    "caption": "Bab-el-Mandeb Strait photographed in 2003; contextual maritime geography"
  },
  {
    "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Destruction%20in%20Al-Maqousi%20quarter%2C%20Gaza%20Strip.jpg?width=960",
    "source": "https://commons.wikimedia.org/wiki/File:Destruction_in_Al-Maqousi_quarter%2C_Gaza_Strip.jpg",
    "caption": "Destruction in Gaza's Al-Maqousi quarter, photographed in February 2024 by Abedallah Alhaj / UNRWA; archival contextual photograph"
  }
]

export default function ArchivePreview() {
 return <div className="site">
  <div className="utility"><span>FAULTLINE BRIEF / EDITORIAL WORKSPACE</span><span>ARCHIVE RECOVERY · NOT FOR PUBLICATION</span></div>
  <header className="masthead"><Brand/><p>Understand what happened. Know why it matters.</p></header>
  <div className="ad-slot ad-leaderboard" aria-label="Reserved advertising space"><span>ADVERTISEMENT</span><small>HEADER LEADERBOARD · RESPONSIVE</small></div>
  <nav className="nav" aria-label="Main navigation"><Link href="/">Latest</Link><Link href="/archive-preview/category/geopolitics">Geopolitics</Link><Link href="/archive-preview/category/conflict">Conflict</Link><Link href="/archive-preview/category/security">Security</Link></nav>
  <main className="coverage">
   <div className="section-heading"><span>RECOVERED ARCHIVE / DESIGN PREVIEW</span><span>10 HISTORICAL CONTENT LEADS</span></div>
   <section className="archive-lead" aria-label="Lead archive story">
    <div className="archive-lead-copy">
     <Link className="eyebrow" href="/archive-preview/category/conflict">LEAD STORY / CONFLICT / ARCHIVE PREVIEW →</Link>
     <h1>Three Years After October 7 — Gaza Still Has No Endgame</h1>
     <p className="archive-lead-deck">A recovered Faultline Brief anniversary graphic explores the war’s human cost, regional consequences and the unresolved questions about Gaza’s future.</p>
     <p className="archive-lead-note">Source material: 7 October 2026 · Editorial preview only · Facebook publication date unverified</p>
     <p className="archive-lead-note">The historical article body has not yet been recovered; this is not a published news report.</p>
    </div>
    <figure className="archive-lead-figure">
     <img src={storyPhotos[9].src} alt={storyPhotos[9].caption} width="1200" height="675" />
     <figcaption>{storyPhotos[9].caption} · <a href={storyPhotos[9].source} target="_blank" rel="noopener noreferrer">Image source and license</a></figcaption>
    </figure>
   </section>
   <div className="newsroom-layout"><div className="newsroom-primary"><div className="section-heading"><span>LATEST ARCHIVE BRIEFINGS</span><span>RECOVERED STORIES</span></div><div className="story-grid">{previews.map((story,i)=><article className="story-card" key={i}>
    <div style={{width:"100%",aspectRatio:"16 / 9",overflow:"hidden",background:"#081725",border:"1px solid #294358",marginBottom:20}}><img src={storyPhotos[i].src} alt={storyPhotos[i].caption} loading="lazy" style={{display:"block",width:"100%",height:"100%",maxWidth:"100%",aspectRatio:"16 / 9",objectFit:"contain",objectPosition:"center",margin:0}} /></div><p className="photo-credit">{storyPhotos[i].caption} · <a href={storyPhotos[i].source} target="_blank" rel="noopener noreferrer">Source / license</a></p>
    <Link className="eyebrow" href={`/archive-preview/category/${story.category.toLowerCase()}`}>{story.category.toUpperCase()} / ARCHIVE PREVIEW →</Link>
    <h2>{story.headline}</h2>
    <p>{story.deck}</p>
    <p style={{fontSize:12}}>{story.context}</p>
    <span className="eyebrow">SOURCE MATERIAL: {story.date.toUpperCase()}</span>
   </article>)}</div></div><aside className="newsroom-sidebar" aria-label="Story discovery and advertising"><section className="sidebar-panel"><h2>EDITOR\u2019S PICKS</h2><p className="sidebar-intro">Recovered story leads · readership rankings not yet available</p>{[9,5,4,3,7].map((index,rank)=><div className="sidebar-story" key={index}><span>{String(rank+1).padStart(2,"0")}</span><div><Link href={`/archive-preview/category/${previews[index].category.toLowerCase()}`}>{previews[index].headline}</Link><small>{previews[index].category}</small></div></div>)}</section><div className="ad-slot ad-sidebar"><span>ADVERTISEMENT</span><small>SIDEBAR · 300 × 250</small></div><section className="sidebar-panel"><h2>EXPLORE COVERAGE</h2><Link href="/archive-preview/category/geopolitics">Geopolitics →</Link><Link href="/archive-preview/category/conflict">Conflict →</Link><Link href="/archive-preview/category/security">Security →</Link></section><section className="sidebar-panel"><h2>LATEST BRIEFINGS</h2>{previews.slice(-3).reverse().map(story=><p key={story.headline}><Link href={`/archive-preview/category/${story.category.toLowerCase()}`}>{story.headline}</Link></p>)}</section><div className="ad-slot ad-sidebar"><span>ADVERTISEMENT</span><small>ADDITIONAL RESPONSIVE PLACEMENT</small></div></aside></div>
  </main>
  <footer><strong>FAULTLINE BRIEF<span>.</span></strong><span>EDITORIAL PREVIEW — UNPUBLISHED</span><Link href="/">Back to homepage</Link></footer>
 </div>
}
