import type { APIRoute } from 'astro';
import { handleProxyUrl } from '@/utils/imageProxyCommon';

export const GET: APIRoute = async ({ params }) => {
  const enc = params.encoded;
  if (!enc) return new Response('encoded required', { status: 400 });
  try {
    // base64url decode
    const padded = enc.replace(/-/g, '+').replace(/_/g, '/');
    const b = Buffer.from(padded, 'base64').toString('utf-8');
    const decoded = decodeURIComponent(b);
    return await handleProxyUrl(decoded);
  } catch (e: any) {
    return new Response('invalid encoded url', { status: 400 });
  }
};
