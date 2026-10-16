import { NextResponse, type NextRequest } from 'next/server'

/**
 * This file exists only in the Cloudflare migration branch.
 * Prevent the staging deployment's copied articles from appearing in search results.
 * Production remains on the separate google-news-sitemap branch.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/robots.txt') {
    return new NextResponse('User-agent: *\nDisallow: /\n', {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow, noarchive' },
    })
  }
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return response
}

export const config = { matcher: '/:path*' }
