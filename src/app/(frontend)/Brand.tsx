
import Link from 'next/link'

export default function Brand() {
  return (
    <Link
      href="/"
      className="brand brand-with-logo"
      aria-label="Faultline Brief — Home"
    >
      <img
        className="brand-logo"
        src="/api/media/file/logo.jpg"
        alt=""
        width={72}
        height={72}
      />
      <span className="brand-wordmark">
        FAULTLINE<span>BRIEF</span>
        <b className="brand-dot">.</b>
      </span>
    </Link>
  )
}
