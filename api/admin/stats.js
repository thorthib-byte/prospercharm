// api/admin/stats.js
// สถิติคนเข้าเว็บวันนี้ สำหรับ admin panel (จำนวนครั้งที่เข้า, unique visitor, unique ที่ login แล้ว)
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'prospercharm2026';

// คำนวณจุดเริ่มต้นของ "วันนี้" ตามเวลาไทย (UTC+7) แล้วแปลงกลับเป็น UTC ISO string
function bangkokTodayStartISO() {
  const now = new Date();
  const bkkNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = bkkNow.getUTCFullYear(), m = bkkNow.getUTCMonth(), d = bkkNow.getUTCDate();
  const startBkk = new Date(Date.UTC(y, m, d, 0, 0, 0) - 7 * 60 * 60 * 1000);
  return startBkk.toISOString();
}

export default async function handler(req) {
  const url = new URL(req.url);
  const pass = url.searchParams.get('pass') || req.headers.get('x-admin-pass');
  if (pass !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const startISO = bangkokTodayStartISO();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/page_visits?select=visitor_id,line_user_id,display_name,visited_at&visited_at=gte.${encodeURIComponent(startISO)}&order=visited_at.desc&limit=2000`,
      {
        headers: {
          'apikey': SUPABASE_SECRET,
          'Authorization': `Bearer ${SUPABASE_SECRET}`,
        },
      }
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: 'query failed', detail: rows }), { status: 500 });
    }

    const uniqueVisitors = new Set(rows.map(r => r.visitor_id)).size;
    const uniqueLoggedIn = new Set(rows.filter(r => r.line_user_id).map(r => r.line_user_id)).size;

    return new Response(JSON.stringify({
      totalVisitsToday: rows.length,
      uniqueVisitorsToday: uniqueVisitors,
      uniqueLoggedInToday: uniqueLoggedIn,
      recentVisits: rows.slice(0, 30),
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('admin stats error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}
