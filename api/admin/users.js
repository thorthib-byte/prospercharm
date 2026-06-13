export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'prospercharm2026';

export default async function handler(req) {
  const url = new URL(req.url);
  const pass = url.searchParams.get('pass') || req.headers.get('x-admin-pass');
  if (pass !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // GET — ดึง users ทั้งหมด
  if (req.method === 'GET') {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=line_user_id,display_name,coins,streak,last_checkin&order=updated_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_SECRET,
          'Authorization': `Bearer ${SUPABASE_SECRET}`,
        },
      }
    );
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // PATCH — update coins
  if (req.method === 'PATCH') {
    const body = await req.json();
    const { lineId, coins } = body;
    if (!lineId || coins === undefined) {
      return new Response(JSON.stringify({ error: 'Missing lineId or coins' }), { status: 400 });
    }
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?line_user_id=eq.${lineId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SECRET,
          'Authorization': `Bearer ${SUPABASE_SECRET}`,
        },
        body: JSON.stringify({ coins, updated_at: new Date().toISOString() }),
      }
    );
    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
}
