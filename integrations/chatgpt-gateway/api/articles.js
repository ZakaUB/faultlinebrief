import { timingSafeEqual } from 'node:crypto'

const json = (res, status, data) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}
const equal = (a, b) => {
  const x = Buffer.from(a || '')
  const y = Buffer.from(b || '')
  return x.length === y.length && timingSafeEqual(x, y)
}
const required = ['GATEWAY_API_KEY', 'PAYLOAD_API_KEY', 'VERCEL_AUTOMATION_BYPASS_SECRET', 'PAYLOAD_PREVIEW_URL']

export default async function handler(req, res) {
  if (required.some((key) => !process.env[key])) return json(res, 503, { error: 'Gateway not configured' })
  const provided = req.headers.authorization || ''
  const expected = 'Bearer ' + process.env.GATEWAY_API_KEY
  if (!equal(provided, expected)) return json(res, 401, { error: 'Unauthorized' })
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' })
  const base = process.env.PAYLOAD_PREVIEW_URL
  let url
  try {
    url = new URL('/api/articles', base)
    if (url.protocol !== 'https:') throw Error('HTTPS required')
  } catch {
    return json(res, 503, { error: 'Invalid upstream configuration' })
  }

  let body
  if (req.method === 'GET') {
    url.searchParams.set('where[status][equals]', 'draft')
    url.searchParams.set('limit', '10')
    url.searchParams.set('depth', '0')
  } else {
    body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { return json(res, 400, { error: 'Invalid JSON' }) }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(res, 400, { error: 'JSON object required' })
    const allowed = ['headline', 'slug', 'deck', 'body', 'featuredImage', 'categories', 'sources', 'seo']
    if (Object.keys(body).some((key) => !allowed.includes(key))) return json(res, 400, { error: 'Unexpected article field' })
    if (!['headline', 'slug', 'deck'].every((key) => typeof body[key] === 'string' && body[key].trim())) return json(res, 400, { error: 'Missing article text' })
    if (!body.body || typeof body.body !== 'object' || !body.featuredImage) return json(res, 400, { error: 'Body and featuredImage required' })
    body = { ...body, status: 'draft', publishedAt: null }
  }
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': 'users ' + process.env.PAYLOAD_API_KEY,
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(req.method === 'POST' ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
      redirect: 'manual',
    })
    if (upstream.status >= 300 && upstream.status < 400) return json(res, 502, { error: 'Unexpected upstream redirect' })
    const response = await upstream.json().catch(() => ({ error: 'Unexpected upstream response' }))
    if (!upstream.ok) return json(res, upstream.status, { error: 'Payload request failed', details: response?.errors || response?.error || 'Request rejected' })
    if (req.method === 'GET') return json(res, 200, { docs: (response.docs || []).map(({ id, headline, slug, status }) => ({ id, headline, slug, status })) })
    return json(res, 201, { id: response.doc?.id, headline: response.doc?.headline, slug: response.doc?.slug, status: response.doc?.status })
  } catch {
    return json(res, 502, { error: 'Preview API unavailable' })
  }
}
