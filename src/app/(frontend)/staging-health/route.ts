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

// Enumerated signatures only: never return raw exception messages, URLs or stack traces.
function signature(error: unknown) {
  const e = error as {message?:unknown;cause?:unknown;code?:unknown};
  const cause = e?.cause as {message?:unknown;code?:unknown} | undefined;
  const messages = [e?.message,cause?.message].filter((x):x is string=>typeof x==='string').join(' | ');
  const codes = [e?.code,cause?.code].filter((x):x is string=>typeof x==='string');
  const knownCodes = ['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EHOSTUNREACH','ERR_TLS_CERT_ALTNAME_INVALID','SELF_SIGNED_CERT_IN_CHAIN','ENETUNREACH'];
  const matched = codes.find(x=>knownCodes.includes(x));
  if(matched) return matched;
  const rules: Array<[RegExp,string]> = [
    [/Connection terminated unexpectedly/i,'connection-terminated'],
    [/Cannot read properties of undefined/i,'undefined-property'],
    [/No database connection/i,'missing-db-connection'],
    [/fetch failed/i,'fetch-failed'],
    [/Failed to connect|Connection failed|connection error/i,'connection-failed'],
    [/Cannot find module|module not found/i,'missing-module'],
    [/unsupported|not implemented|not supported/i,'unsupported-runtime-api'],
    [/TCP sockets|socket|connect\(/i,'socket-related'],
    [/SSL|TLS|certificate/i,'tls-related'],
    [/getaddrinfo|DNS/i,'dns-related'],
    [/timeout|timed out/i,'timeout'],
    [/permission denied/i,'permission-denied'],
    [/password authentication failed/i,'password-authentication-failed'],
    [/role .* does not exist/i,'postgres-role-missing'],
    [/relation .* does not exist/i,'postgres-schema-missing'],
    [/database|postgres|pg-cloudflare|postgresql/i,'database-other'],
  ];
  for (const [re,code] of rules) if(re.test(messages)) return code;
  return 'unknown';
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
    const result = await payload.find({ collection: 'articles' as any, limit: 1, depth: 0, overrideAccess: false, where: { status: { equals: 'published' } } })
    return NextResponse.json({ ok: true, step: 'complete', count: result.docs.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, step, kind: category(error), signature: signature(error), errorName: error instanceof Error ? error.name : 'Unknown' }, {status: 500, headers: { 'Cache-Control': 'no-store' }})
  }
}
