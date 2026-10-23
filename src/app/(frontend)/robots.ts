import type { MetadataRoute } from 'next'

const siteUrl = 'https://faultlinebrief.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: ['/admin/', '/api/', '/archive-preview/'],
        // Public R2-backed media must remain crawlable for Google Images and News.
        // More-specific allow overrides the broad /api/ disallow.
        allow: ['/', '/api/media/file/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
