import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'

export default async function Brand() {
 let logoUrl: string | null = null
 try {
  const payload = await getPayload({ config })
  const media = await payload.findByID({ collection: 'media', id: 5 })
  logoUrl = typeof media.url === 'string' ? media.url : null
 } catch {
  // Keep the masthead usable if the media service is temporarily unavailable.
 }
 return <Link href="/" className="brand brand-with-logo" aria-label="Faultline Brief — Home">
  {logoUrl && <img className="brand-logo" src={logoUrl} alt="" width="72" height="72" />}
  <span className="brand-wordmark">FAULTLINE<span>BRIEF</span><b className="brand-dot">.</b></span>
 </Link>
}
