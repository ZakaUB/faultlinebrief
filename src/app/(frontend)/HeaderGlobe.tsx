/** Decorative, lightweight globe for the existing Faultline Brief masthead. */
export default function HeaderGlobe() {
  return <div className="header-globe" aria-hidden="true">
    <svg viewBox="0 0 220 150" role="presentation" focusable="false">
      <defs><radialGradient id="fb-globe-shade"><stop offset="0" stopColor="#287da0" stopOpacity=".30"/><stop offset="1" stopColor="#0e2d49" stopOpacity=".06"/></radialGradient><clipPath id="fb-globe-clip"><circle cx="110" cy="75" r="63"/></clipPath></defs>
      <circle cx="110" cy="75" r="68" fill="url(#fb-globe-shade)" stroke="#68d8f2" strokeOpacity=".4"/>
      <g clipPath="url(#fb-globe-clip)" fill="none" stroke="#68d8f2" strokeWidth=".8" opacity=".53">
        <circle cx="110" cy="75" r="63"/><ellipse cx="110" cy="75" rx="22" ry="63"/><ellipse cx="110" cy="75" rx="45" ry="63"/>
        <path d="M47 75h126M55 44Q110 60 165 44M55 106Q110 90 165 106M72 24Q110 39 148 24M72 126Q110 111 148 126"/>
      </g>
      <g clipPath="url(#fb-globe-clip)" fill="#68d8f2" opacity=".23">
        <path d="M54 37l22-13 19 7 7 13-14 11-6 17-13 3-14-16-13-3zM85 83l20 8 8 22-14 24-11-11-10-28zM120 28l23-12 25 15 10 24-16 9-15-10-9 16-17-11-8-17zM144 84l23 9 13 19-16 13-19-14z"/>
      </g>
      <g fill="#ff5964"><circle cx="89" cy="59" r="2.6"/><circle cx="146" cy="70" r="2.6"/><circle cx="111" cy="103" r="2.6"/></g>
    </svg>
  </div>
}
