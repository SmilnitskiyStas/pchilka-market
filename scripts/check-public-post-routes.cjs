// Run against a local production build: next start --hostname 127.0.0.1 --port 3197.
// These read-only requests exercise slugs that were absent during next build.
const assert = require('node:assert/strict');

async function main() {
  const baseUrl = new URL(process.argv[2] || 'http://127.0.0.1:3197');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(baseUrl.hostname)) throw new Error('Use a local production server for this regression check.');
  const newSlug = `post-created-after-build-${Date.now()}`;
  const paths = ['/news/vse-bude-dobre', `/news/${newSlug}`, `/blog/${newSlug}`, `/about/charity/${newSlug}`];
  for (const pathname of paths) {
    const response = await fetch(new URL(pathname, baseUrl), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const html = await response.text();
    assert.equal(response.status, 200, `${pathname} must render without a static-to-dynamic error`);
    assert.ok(html.includes('<html'), `${pathname} must return an HTML page`);
    console.log(`PASS ${pathname}: HTTP 200`);
  }
}
main().catch(error => { console.error(error.message); process.exit(1); });
