/**
 * Read-only smoke tests for a completely isolated Cloudflare preview.
 * Usage in GitHub Actions (not on the user's local computer):
 *   CLOUDFLARE_STAGING_URL=https://<staging>.workers.dev node scripts/cloudflare-staging-smoke.mjs
 * Never point this script at the production domain.
 */
const base = process.env.CLOUDFLARE_STAGING_URL;
if (!base) {
  console.error('CLOUDFLARE_STAGING_URL is required');
  process.exit(1);
}
const origin = new URL(base);
if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.workers.dev') || origin.hostname === 'faultlinebrief.com') {
  console.error('Refusing a non-Cloudflare staging URL');
  process.exit(1);
}
const checks = [
  ['Homepage', '/', /Faultline Brief/i, 'text/html'],
  ['Robots', '/robots.txt', /User-agent/i, 'text/plain'],
  ['Main sitemap', '/sitemap.xml', /<urlset/i, 'xml'],
  ['News sitemap', '/news-sitemap.xml', /<urlset/i, 'xml'],
  ['About', '/about', /About Faultline Brief/i, 'text/html'],
  ['Latest news', '/latest-news', /Latest News/i, 'text/html'],
  ['Article', '/articles/who-are-the-houthis-history-sanaa-2014-saudi-arabia-conflict', /Faultline Brief|Houthis/i, 'text/html'],
  ['CMS sign-in', '/admin/login', /login|payload|sign in/i, 'text/html'],
];
let failed = 0;
for (const [label, path, needle, type] of checks) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try { response = await fetch(new URL(path, origin), { redirect: 'follow', signal: controller.signal }); }
    finally { clearTimeout(timeout); }
    const body = await response.text();
    const ok = response.ok && needle.test(body) && response.headers.get('content-type')?.includes(type);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label} ${path} status=${response.status} type=${response.headers.get('content-type')}`);
    if (!ok) failed++;
  } catch (error) {
    console.log(`FAIL ${label} ${path} ${String(error)}`);
    failed++;
  }
}
console.log(`Smoke tests: ${checks.length - failed}/${checks.length} passed`);
if (failed) process.exitCode = 1;
