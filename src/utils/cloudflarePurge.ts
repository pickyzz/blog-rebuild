export async function purgeCloudflare(urls: string[], opts?: { zoneId?: string; apiToken?: string; dryRun?: boolean }) {
  if (!Array.isArray(urls) || urls.length === 0) throw new Error('urls required');
  const zone = opts?.zoneId || process.env.CF_ZONE_ID;
  const token = opts?.apiToken || process.env.CF_API_TOKEN;
  const dryRun = opts?.dryRun ?? false;
  const payload = { files: urls };
  if (dryRun) return { ok: true, dryRun: true, payload };
  if (!zone || !token) throw new Error('CF_ZONE_ID and CF_API_TOKEN required');
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  return json;
}
