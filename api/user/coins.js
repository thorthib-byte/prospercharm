export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

function parseToken(req) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const session = parseToken(req);
  if (!session || !session.userId || Date.now() > session.exp) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'GET') {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?line_user_id=eq.${session.userId}&select=coins,coins_month,streak,last_checkin,checkin_history`,
      {
        headers: {
          'apikey': SUPABASE_SECRET,
          'Authorization': `Bearer ${SUPABASE_SECRET}`,
        },
      }
    );
    const data = await res.json();
    const user = data[0];
    if (!user) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });

    return new Response(JSON.stringify({
      coins: user.coins || 0,
      coinsMonth: user.coins_month,
      streak: user.streak || 0,
      lastCheckin: user.last_checkin,
      checkinHistory: user.checkin_history || {},
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const { coins, coinsMonth, streak, lastCheckin, checkinHistory } = body;

    await fetch(
      `${SUPABASE_URL}/rest/v1/users?line_user_id=eq.${session.userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SECRET,
          'Authorization': `Bearer ${SUPABASE_SECRET}`,
        },
        body: JSON.stringify({
          coins,
          coins_month: coinsMonth,
          streak,
          last_checkin: lastCheckin,
          checkin_history: checkinHistory,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
}
