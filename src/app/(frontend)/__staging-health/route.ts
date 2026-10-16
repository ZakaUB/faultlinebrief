import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

function category(error: unknown) {
  const message = error instanceof Error ? (error.message || '') : String(error)
  if (/database|connection|connect|postgres|socket|fetch failed|ECONN|ENOTFOUND|timeout|tls|ssl|pg-cloudflare/i.test(message)) return 'database-connectivity'
  if (/crypto|subtle|webcrypto|node:|not supported|unsupported|process|module|require|import/i.test(message)) return 'worker-runtime-compatibility'
  if (/migration|relation|column|schema|permission|table/i.test(message)) return 'database-schema-or-permission'
  if (/payload|config|secret|lexical|adapter|plugin/i.test(message)) return 'payload-initialization'
  return 'uncategorized'
}

/** Only in isolated staging branch, protected by staging Basic Auth middleware. */
export async function GET() {
  if (!process.env.STAGING_ACCESS_PASSWORD || !process.env.DATABASE_URL?.includes('ep-red-dream-b42nh8xe')) {
    return NextResponse.json({ step: 'safety-check', ok: false }, { status: 503 })
  }
  let step = 'initialize-payload'
  try {
    const payload = await getPayload({ config })
    step = 'read-articles'
    const result = await payload.find({ collection: 'articles', limit: 1, depth: 0, overrideAccess: false, where: { status: { equals: 'published' } } })
    return NextResponse.json({ ok: true, step: 'complete', count: result.docs.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, step, kind: category(error), errorName: error instanceof Error ? error.name : 'Unknown' }, {status: 500, headers: { 'Cache-Control': 'no-store' }})
  }
}
