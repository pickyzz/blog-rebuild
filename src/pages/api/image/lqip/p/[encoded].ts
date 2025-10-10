import { fetchWithBackoff, acquireSlot, waitForHostCooldown } from '@/utils/imageProxyCommon';
import { isAllowedUrl } from '@/config';
import { generatePlaceholder } from '@/utils/generatePlaceholder';
import { addPurgeUrl } from '@/utils/purgeList';
import { enqueuePurge } from '@/utils/cloudflarePurgeQueue';

export async function GET({ params }: any) {
  const encoded = params.encoded;
  if (!encoded) return new Response('encoded token required', { status: 400 });
  let decoded: string;
  try {
    decoded = decodeURIComponent(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch (e) {
    return new Response('invalid token', { status: 400 });
  }

  if (!isAllowedUrl(decoded)) return new Response('url not allowed', { status: 403 });

  // Try to fetch upstream image bytes (reuse backoff and concurrency controls)
  let release: (() => void) | null = null;
  try {
    release = await acquireSlot();
    await waitForHostCooldown(decoded);
    const upstream = await fetchWithBackoff(decoded, 2);
    if (!upstream || !upstream.ok) {
      return new Response(null, { status: 204 });
    }
    const arr = await upstream.arrayBuffer();
    const buffer = Buffer.from(arr);
    const placeholder = await generatePlaceholder(buffer);
    if (!placeholder) return new Response(null, { status: 204 });

    // Persist purge info: add the proxy URL to dist/purge-urls.json (best-effort)
    try {
      const encToken = encoded;
      const proxyUrl = new URL(`/api/image/p/${encToken}`, process.env.SITE_ORIGIN || 'https://pickyzz.dev').href;
      try { addPurgeUrl(proxyUrl); } catch (e) { /* ignore */ }

      // Enqueue purge (will batch + retry). Also wrote to purge list above.
      try { enqueuePurge(proxyUrl); } catch (e) { try { console.warn('[LQIP] enqueue purge failed', String(e)); } catch(_){} }
    } catch (e) {}

    const headers = new Headers();
    headers.set('Content-Type', 'image/webp');
    // Cache LQIP long at the edge - tiny asset
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=31536000, immutable');
    const bytes = Uint8Array.from(Buffer.from(placeholder.split(',')[1], 'base64'));
    return new Response(bytes, { status: 200, headers });
  } catch (err) {
    console.warn('[LQIP] generation failed for', decoded, String(err));
    return new Response(null, { status: 204 });
  } finally {
    if (release) release();
  }
}
