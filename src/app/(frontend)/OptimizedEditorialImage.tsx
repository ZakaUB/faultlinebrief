'use client'
import { useState } from 'react'
import type { CSSProperties, ImgHTMLAttributes } from 'react'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string
  priority?: boolean
}

function variant(source: string, width: number): string {
  // Cloudflare's image delivery transforms the source without modifying original media.
  // Absolute source URLs allow both the legacy media route and the D1 CMS media host.
  const origin = typeof window === 'undefined' ? 'https://faultlinebrief.com' : window.location.origin
  const absolute = new URL(source, origin).href
  if (!/^https:\/\//.test(absolute)) return source
  return '/cdn-cgi/image/width=' + width + ',quality=72,format=auto,fit=scale-down/' + absolute
}

export default function OptimizedEditorialImage({ src, priority, loading, fetchPriority, style, onError, ...props }: Props) {
  const [fallback, setFallback] = useState(false)
  const optimized = !fallback && /^https?:\/\/|^\//.test(src)
  const displaySrc = optimized ? variant(src, priority ? 960 : 480) : src
  return <img
    {...props}
    src={displaySrc}
    srcSet={optimized ? [480, 720, 960].map(width => variant(src, width) + ' ' + width + 'w').join(', ') : undefined}
    loading={loading ?? (priority ? 'eager' : 'lazy')}
    fetchPriority={fetchPriority ?? (priority ? 'high' : 'auto')}
    decoding="async"
    style={style as CSSProperties}
    onError={event => { if (optimized) setFallback(true); onError?.(event) }}
  />
}
