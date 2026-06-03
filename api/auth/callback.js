export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const REDIRECT_URI = 'https://prospercharmth.com/auth/callback';

export default async function handler(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return Response.redirect('https://prospercharmth.com/?login=failed', 302);
  }

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token');

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.userId) throw new Error('No profile');

    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SECRET,
        'Authorization': `Bearer ${SUPABASE_SECRET}`,
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        id: profile.userId,
        line_user_id: profile.userId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl || null,
        updated_at: new Date().toISOString(),
      }),
    });
    const userData = await dbRes.json();
    const user = Array.isArray(userData) ? userData[0] : userData;

    const sessionData = {
      userId: user.line_user_id,
      displayName: user.display_name,
      pictureUrl: user.picture_url,
      coins: user.coins || 0,
      coinsMonth: user.coins_month,
      streak: user.streak || 0,
      lastCheckin: user.last_checkin,
      checkinHistory: user.checkin_history || {},
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    const token = btoa(JSON.stringify(sessionData));

    return Response.redirect(
      `https://prospercharmth.com/?token=${encodeURIComponent(token)}`,
      302
    );
  } catch (err) {
    console.error('Auth error:', err);
    return Response.redirect('https://prospercharmth.com/?login=failed', 302);
  }
}
