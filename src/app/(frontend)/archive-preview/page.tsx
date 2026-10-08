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

export const illustrations = ["yemen-saudi","ukraine-strikes","climate-risk","dhubab-port","drone-warfare","oil-bypass","riyadh-airport","baghdad-facility","mandeb-war","gaza-anniversary"]

export default function ArchivePreview() {
 return <div className="site">
  <div className="utility"><span>FAULTLINE BRIEF / EDITORIAL WORKSPACE</span><span>ARCHIVE RECOVERY · NOT FOR PUBLICATION</span></div>
  <header className="masthead"><Brand/><p>Understand what happened. Know why it matters.</p></header>
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
     <img src="/archive-preview/gaza-anniversary.svg" alt="Conceptual editorial illustration for the Gaza anniversary story, not a documentary photograph" width="1200" height="675" />
     <figcaption>Editorial illustration · Not a photograph of an actual event</figcaption>
    </figure>
   </section>
   <div className="story-grid">{previews.map((story,i)=><article className="story-card" key={i}>
    <div style={{width:"100%",aspectRatio:"16 / 9",overflow:"hidden",background:"#081725",border:"1px solid #294358",marginBottom:20}}><img src={`/archive-preview/${illustrations[i]}.svg`} alt={`Editorial illustration for ${story.headline}; not a documentary photograph`} loading="lazy" style={{display:"block",width:"100%",height:"100%",maxWidth:"100%",aspectRatio:"16 / 9",objectFit:"contain",objectPosition:"center",margin:0}} /></div>
    <Link className="eyebrow" href={`/archive-preview/category/${story.category.toLowerCase()}`}>{story.category.toUpperCase()} / ARCHIVE PREVIEW →</Link>
    <h2>{story.headline}</h2>
    <p>{story.deck}</p>
    <p style={{fontSize:12}}>{story.context}</p>
    <span className="eyebrow">SOURCE MATERIAL: {story.date.toUpperCase()}</span>
   </article>)}</div>
  </main>
  <footer><strong>FAULTLINE BRIEF<span>.</span></strong><span>EDITORIAL PREVIEW — UNPUBLISHED</span><Link href="/">Back to homepage</Link></footer>
 </div>
}
