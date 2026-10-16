import { NextResponse, type NextRequest } from 'next/server'

/**
 * Cloudflare staging only. Fail closed until a staging-only password exists.
 * This branch must never be merged into Vercel production.
 */
export function middleware(request: NextRequest) {
  const headers = { 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Cache-Control': 'private, no-store' }
  if (request.nextUrl.pathname === '/robots.txt') {
    return new NextResponse('User-agent: *\nDisallow: /\n', {
      headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  const password = process.env.STAGING_ACCESS_PASSWORD
  // Absent/short password must never allow access.
  if (!password || password.length < 24) {
    return new NextResponse('Staging access is not configured.', { status: 503, headers })
  }
  const expected = 'Basic ' + btoa('staging:' + password)
  const provided = request.headers.get('authorization') || ''
  if (provided !== expected) {
    return new NextResponse('Staging access required.', {
      status: 401,
      headers: { ...headers, 'WWW-Authenticate': 'Basic realm="Faultline Brief Staging", charset="UTF-8"' },
    })
  }
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = { matcher: '/:path*' }
