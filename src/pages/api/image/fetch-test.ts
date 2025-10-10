import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  try {
    const reqUrl = new URL(request.url);
    const url = reqUrl.searchParams.get('url');
    if (!url) return new Response(JSON.stringify({ error: 'url query param required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    try {
      const res = await fetch(url);
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      const contentType = res.headers.get('content-type') || '';
      let bodyPreview: string | null = null;
      if (contentType.includes('text') || contentType.includes('json')) {
        const txt = await res.text();
        bodyPreview = txt.slice(0, 1024);
      }
      return new Response(JSON.stringify({ ok: res.ok, status: res.status, headers, bodyPreview }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: String(err), stack: err?.stack ?? null }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
