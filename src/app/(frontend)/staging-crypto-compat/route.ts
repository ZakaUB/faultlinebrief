import { NextResponse } from 'next/server'
import { pbkdf2 as nodePbkdf2 } from 'node:crypto'
export const dynamic = 'force-dynamic'
export async function GET() {
  if (!process.env.STAGING_ACCESS_PASSWORD || !process.env.DATABASE_URL?.includes('ep-red-dream-b42nh8xe')) {
    return NextResponse.json({ ok: false, step: 'isolation' }, { status: 503 })
  }
  const password = new TextEncoder().encode('non-secret-compatibility-probe')
  const salt = new TextEncoder().encode('staging-probe-salt-do-not-use-for-passwords')
  let node = 'unverified'
  let webcrypto = 'unverified'
  try {
    await new Promise<void>((resolve, reject) => nodePbkdf2(password, salt, 600000, 32, 'sha256', (err) => err ? reject(err) : resolve()))
    node = 'supported'
  } catch (error) {
    node = error instanceof Error ? error.name : 'error'
  }
  try {
    const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits'])
    await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, key, 256)
    webcrypto = 'supported'
  } catch (error) {
    webcrypto = error instanceof Error ? error.name : 'error'
  }
  return NextResponse.json({ node, webcrypto }, { headers: { 'Cache-Control': 'no-store' } })
}
