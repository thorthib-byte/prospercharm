// api/stripe/webhook.js
// รับ event จาก Stripe ตอนชำระเงินสำเร็จ แล้วเติม credits ให้ user ใน Supabase
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET);

// Vercel ต้องปิด bodyParser เพื่ออ่าน raw body สำหรับตรวจสอบ signature ของ Stripe
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { line_user_id, plan_type, credits } = session.metadata || {};

    if (!line_user_id) {
      console.error('Webhook missing line_user_id in metadata');
      return res.status(200).json({ received: true }); // ตอบ 200 กัน Stripe retry ซ้ำ
    }

    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('id, coins')
        .eq('line_user_id', line_user_id)
        .single();

      if (userRow) {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);

        const creditsToAdd = parseInt(credits, 10) || 0;

        // ดึง credits ปัจจุบันจาก users table (สมมติมีคอลัมน์ credits, plan, plan_expiry)
        const { data: currentRow } = await supabase
          .from('users')
          .select('credits, plan')
          .eq('id', userRow.id)
          .single();

        const newCredits = (currentRow?.credits || 0) + creditsToAdd;

        await supabase
          .from('users')
          .update({
            credits: newCredits,
            plan: plan_type,
            plan_expiry: plan_type === 'single' ? null : expiry.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userRow.id);

        console.log(`✅ Credits added for ${line_user_id}: +${creditsToAdd} (total: ${newCredits})`);
      } else {
        console.error('Webhook: user not found for line_user_id', line_user_id);
      }
    } catch (err) {
      console.error('Webhook DB update error:', err);
      // ยังตอบ 200 เพื่อไม่ให้ Stripe retry รัวๆ — แนะนำให้ดู log ใน Vercel ถ้าเกิดเคสนี้
    }
  }

  return res.status(200).json({ received: true });
}
