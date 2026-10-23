import { getCloudflareContext } from '@opennextjs/cloudflare'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MediaEnv = { MEDIA_BUCKET?: R2Bucket }

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  let key: string
  try {
    key = decodeURIComponent(filename)
  } catch {
    return new Response('Invalid filename', { status: 400 })
  }
  if (!key || key === '.' || key === '..' || key.includes('/') || key.includes('\\') || key.includes('\0')) {
    return new Response('Invalid filename', { status: 400 })
  }
  const { env } = getCloudflareContext()
  const bucket = (env as unknown as MediaEnv).MEDIA_BUCKET
  if (!bucket) return new Response('Media storage unavailable', { status: 503 })
  const object = await bucket.get(key)
  if (!object) return new Response('Image not found', { status: 404 })
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'public, max-age=3600')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(object.body, { headers })
}
