/** Lightweight animated intelligence globe; existing masthead branding remains unchanged. */
export default function HeaderGlobe() {
  return (
    <div className="header-globe" aria-hidden="true">
      <svg viewBox="0 0 320 240" role="presentation" focusable="false">
        <defs>
          <radialGradient id="fb-halo"><stop offset="0" stopColor="#52d9f5" stopOpacity=".23"/><stop offset=".65" stopColor="#38a9dc" stopOpacity=".10"/><stop offset="1" stopColor="#38a9dc" stopOpacity="0"/></radialGradient>
          <radialGradient id="fb-earth" cx="32%" cy="25%" r="82%"><stop offset="0" stopColor="#205a7c"/><stop offset=".48" stopColor="#103e60"/><stop offset=".83" stopColor="#092b48"/><stop offset="1" stopColor="#061a30"/></radialGradient>
          <linearGradient id="fb-rim" x1="0" x2="1"><stop offset="0" stopColor="#2da8d2" stopOpacity=".18"/><stop offset=".5" stopColor="#8df2ff" stopOpacity=".95"/><stop offset="1" stopColor="#2da8d2" stopOpacity=".15"/></linearGradient>
          <clipPath id="fb-sphere"><circle cx="160" cy="120" r="86"/></clipPath>
        </defs>
        <circle cx="160" cy="120" r="118" fill="url(#fb-halo)" className="fb-globe-halo"/>
        <g className="fb-orbit fb-orbit-one"><ellipse cx="160" cy="120" rx="116" ry="43" transform="rotate(-27 160 120)" fill="none" stroke="#70d9ef" strokeOpacity=".30" strokeWidth="1" strokeDasharray="3 7"/><circle cx="57" cy="164" r="2.5" fill="#fb6977"/></g>
        <g className="fb-orbit fb-orbit-two"><ellipse cx="160" cy="120" rx="111" ry="54" transform="rotate(36 160 120)" fill="none" stroke="#66cbe7" strokeOpacity=".20" strokeWidth="1"/><circle cx="245" cy="168" r="2.2" fill="#78e7fa"/></g>
        <circle cx="160" cy="120" r="86" fill="url(#fb-earth)"/>
        <g clipPath="url(#fb-sphere)">
          <g className="fb-world-spin">
            <g fill="none" stroke="#64d4ef" strokeWidth=".8" opacity=".44">
              <path d="M0 120H480 M0 94H480 M0 146H480 M0 69H480 M0 171H480"/>
              <path d="M0 40Q40 120 0 200 M40 40Q80 120 40 200 M80 40Q120 120 80 200 M120 40Q160 120 120 200 M160 40Q200 120 160 200 M200 40Q240 120 200 200 M240 40Q280 120 240 200 M280 40Q320 120 280 200 M320 40Q360 120 320 200 M360 40Q400 120 360 200 M400 40Q440 120 400 200 M440 40Q480 120 440 200"/>
            </g>
            <g fill="#50c7e7" opacity=".35">
              <path d="M28 63l18-16 28 2 11 12-8 19-16 7-8 24-20-11-9-21zM58 118l18 5 14 22-9 34-13 18-13-25-11-27zM117 56l20-15 35 8 11 19-17 11-13 19-17-6-15-18zM154 111l23 2 16 20-11 29-19 14-15-28zM212 63l18-16 28 2 11 12-8 19-16 7-8 24-20-11-9-21zM242 118l18 5 14 22-9 34-13 18-13-25-11-27zM301 56l20-15 35 8 11 19-17 11-13 19-17-6-15-18zM338 111l23 2 16 20-11 29-19 14-15-28z"/>
            </g>
            <g fill="none" stroke="#a0eeff" strokeWidth=".8" opacity=".55"><path d="M30 93L89 115 139 74 188 132 245 93 273 115 323 74 372 132" strokeDasharray="3 6"/></g>
          </g>
          <ellipse cx="160" cy="120" rx="32" ry="86" fill="none" stroke="#8be9fa" strokeOpacity=".22"/>
          <ellipse cx="160" cy="120" rx="65" ry="86" fill="none" stroke="#8be9fa" strokeOpacity=".16"/>
          <path d="M74 120H246 M84 80Q160 104 236 80 M84 160Q160 136 236 160" fill="none" stroke="#8be9fa" strokeOpacity=".28"/>
          <ellipse cx="128" cy="78" rx="88" ry="103" fill="#80eaff" opacity=".035"/>
        </g>
        <circle cx="160" cy="120" r="86" fill="none" stroke="url(#fb-rim)" strokeWidth="1.8"/>
        <circle cx="160" cy="120" r="91" fill="none" stroke="#6fe4fb" strokeOpacity=".13" strokeDasharray="2 7"/>
        <g className="fb-hotspot"><circle cx="188" cy="99" r="8" fill="#ff6577" opacity=".13"/><circle cx="188" cy="99" r="3.1" fill="#ff6577"/></g>
        <g className="fb-hotspot fb-hotspot-delay"><circle cx="128" cy="150" r="7" fill="#ff6577" opacity=".13"/><circle cx="128" cy="150" r="2.7" fill="#ff6577"/></g>
        <path d="M188 99Q164 111 128 150" fill="none" stroke="#ff6577" strokeOpacity=".53" strokeWidth="1" strokeDasharray="3 5"/>
      </svg>
    </div>
  )
}
