export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
    const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...headers, 'Content-Type': 'application/json', ...extra } })
    if (!env.EDITOR_BOOTSTRAP_PASSWORD || env.EDITOR_BOOTSTRAP_PASSWORD.length < 24 || !env.EDITOR_SESSION_SECRET || env.EDITOR_SESSION_SECRET.length < 32 || !env.R2) return json({ ok: false, error: 'staging-configuration' }, 503)
    const encoder = new TextEncoder()
    const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
    const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
    const equal = (a, b) => { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0); return diff === 0 }
    const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)fb_editor=([a-f0-9]{64})(?:;|$)/)?.[1]
    const sessionKey = async token => 'editor-auth/sessions/' + hex(await digest(env.EDITOR_SESSION_SECRET + ':' + token))
    const authenticated = async () => {
      if (!cookie) return false
      const object = await env.R2.get(await sessionKey(cookie))
      if (!object) return false
      const expires = Number(await object.text())
      return Number.isFinite(expires) && expires > Date.now()
    }
    if (url.pathname === '/articles' && request.method === 'GET' || url.pathname === '/categories' && request.method === 'GET') {
      if (!await authenticated()) return json({ ok: false, error: 'unauthorized' }, 401)
      if (!env.DATABASE_URL || !new URL(env.DATABASE_URL).hostname.startsWith('ep-red-dream-b42nh8xe')) return json({ ok: false, error: 'staging-database-required' }, 503)
      try {
        const { Client } = await import('pg')
        const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 8000 })
        try {
          await client.connect()
          await client.query('BEGIN READ ONLY')
          const result = url.pathname === '/articles'
            ? await client.query('SELECT id, headline, slug, deck, status, published_at, updated_at FROM public.articles ORDER BY updated_at DESC LIMIT 25')
            : await client.query('SELECT id, name, slug, description FROM public.categories ORDER BY name LIMIT 100')
          await client.query('ROLLBACK')
          return json({ ok: true, items: result.rows, count: result.rowCount })
        } finally { await client.end().catch(() => {}) }
      } catch { return json({ ok: false, error: 'staging-database-unavailable' }, 503) }
    }
    if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, service: 'cloudflare-native-editor-auth', staging: true })
    if (url.pathname === '/login' && request.method === 'POST') {
      if (Number(request.headers.get('Content-Length') || 0) > 2048) return json({ ok: false }, 413)
      let body
      try { body = await request.json() } catch { return json({ ok: false }, 400) }
      if (typeof body?.password !== 'string' || body.password.length > 1024) return json({ ok: false }, 400)
      const valid = equal(await digest(body.password), await digest(env.EDITOR_BOOTSTRAP_PASSWORD))
      if (!valid) return json({ ok: false, error: 'invalid-credentials' }, 401)
      const token = hex(crypto.getRandomValues(new Uint8Array(32)))
      const expires = Date.now() + 8 * 60 * 60 * 1000
      await env.R2.put(await sessionKey(token), String(expires), { httpMetadata: { contentType: 'text/plain' } })
      return json({ ok: true, authenticated: true }, 200, { 'Set-Cookie': 'fb_editor=' + token + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800' })
    }
    if (url.pathname === '/me' && request.method === 'GET') {
      const ok = await authenticated()
      return json({ ok, authenticated: ok }, ok ? 200 : 401)
    }
    if (url.pathname === '/logout' && request.method === 'POST') {
      if (cookie) await env.R2.delete(await sessionKey(cookie))
      return json({ ok: true }, 200, { 'Set-Cookie': 'fb_editor=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' })
    }
    return json({ ok: false, error: 'not-found' }, 404)
  }
}
