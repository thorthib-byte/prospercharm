// api/track-visit.js
// บันทึก "การเข้าเว็บ" ทุกครั้งที่มีคนเปิดหน้าเว็บ ใช้สำหรับสถิติใน admin panel
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  try {
    const body = await req.json();
    const { visitorId, lineUserId, displayName } = body || {};
    if (!visitorId) {
      return new Response(JSON.stringify({ error: 'Missing visitorId' }), { status: 400 });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/page_visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SECRET,
        'Authorization': `Bearer ${SUPABASE_SECRET}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        visitor_id: visitorId,
        line_user_id: lineUserId || null,
        display_name: displayName || null,
      }),
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // การเก็บสถิติพลาด ไม่ควรไปกระทบ user เลย ตอบ 200 เสมอ
    console.error('track-visit error:', err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
