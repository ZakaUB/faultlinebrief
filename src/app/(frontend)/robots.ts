import type { MetadataRoute } from 'next'
export default function robots(): MetadataRoute.Robots {
 const site='https://faultlinebrief.com'
 return {rules:[{userAgent:'*',allow:'/',disallow:['/admin/','/api/']}],sitemap:`${site}/sitemap.xml`}
}
