import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

/**
 * Isolated Cloudflare migration experiment only. Never merge into production.
 * Staging Basic Auth middleware protects this endpoint. It returns no credentials.
 */
export async function POST() {
  if (!process.env.STAGING_ACCESS_PASSWORD || process.env.STAGING_ACCESS_PASSWORD.length < 24 ||
      !process.env.DATABASE_URL?.includes('ep-red-dream-b42nh8xe')) {
    return NextResponse.json({ ok: false, step: 'staging-safety-check' }, { status: 503 })
  }
  const email = 'cloudflare-staging-probe-' + crypto.randomUUID() + '@example.invalid'
  const password = crypto.randomUUID() + '-' + crypto.randomUUID()
  let id: number | string | undefined
  let step = 'initialize'
  let cleanup = 'not-created'
  try {
    const payload = await getPayload({ config })
    step = 'create-disposable-admin'
    const user = await payload.create({
      collection: 'users',
      data: { email, password },
      overrideAccess: true,
    })
    id = user.id
    step = 'authenticate-disposable-admin'
    const result = await payload.login({ collection: 'users', data: { email, password } })
    if (result.user?.id !== id || !result.token) {
      throw new Error('Staging authentication assertion failed')
    }
    step = 'authenticated'
    return NextResponse.json({ ok: true, step, temporaryUserCreated: true, loginVerified: true }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const e = error as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } }
    const msg = [e?.message, e?.cause?.message].filter(x => typeof x === 'string').join(' ')
    const knownCodes = new Set(['23505', '23503', '23502', '42P01', '42703', '42501', 'ECONNRESET', 'ETIMEDOUT'])
    const rawCode = typeof e?.code === 'string' ? e.code : typeof e?.cause?.code === 'string' ? e.cause.code : ''
    const category = /crypto|scrypt|hash|digest|bcrypt/i.test(msg) ? 'password-crypto' : /transaction|rollback|commit/i.test(msg) ? 'transaction' : /cannot read properties|undefined|null/i.test(msg) ? 'runtime-object' : /foreign key|constraint|duplicate|unique/i.test(msg) ? 'constraint' : /relation .* does not exist|column .* does not exist|schema/i.test(msg) ? 'schema' : /permission|denied/i.test(msg) ? 'permission' : /timeout|connect|network|socket/i.test(msg) ? 'connectivity' : /validation|invalid|required/i.test(msg) ? 'validation' : 'unclassified'
    return NextResponse.json({ ok: false, step: step + ':' + category + ':' + (knownCodes.has(rawCode) ? rawCode : 'unknown') + ':' + (error instanceof Error ? error.name : 'unknown'), errorCategory: category, errorCode: knownCodes.has(rawCode) ? rawCode : 'unknown', errorName: error instanceof Error ? error.name : 'unknown' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  } finally {
    if (id !== undefined) {
      try {
        const payload = await getPayload({ config })
        await payload.delete({ collection: 'users', id, overrideAccess: true })
        cleanup = 'deleted'
      } catch {
        cleanup = 'failed'
      }
    }
    // Cleanup errors are deliberately not echoed; the unique example.invalid identity
    // can be found and removed on the staging branch only if necessary.
    if (cleanup === 'failed') console.error('staging-auth-test: disposable user cleanup failed')
  }
}
