// api/stripe/create-session.js
// สร้าง Stripe Checkout Session ตอนผู้ใช้กดเลือกช่องทางจ่ายเงิน
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET);

// แปลง token ที่ฝั่ง client เก็บไว้ (Unicode-safe base64) กลับเป็น session object
function decodeToken(token) {
  try {
    const json = decodeURIComponent(escape(Buffer.from(token, 'base64').toString('binary')));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const session = decodeToken(token);
    if (!session || !session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const lineUserId = session.userId; // token เก็บเป็น "userId" ไม่ใช่ "line_user_id"

    const { planType, price, credits, method } = req.body;
    if (!planType || !price || !credits) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // หา (หรือสร้าง) Stripe customer ผูกกับ line_user_id เพื่อให้ติดตามได้ง่าย
    const { data: userRow } = await supabase
      .from('users')
      .select('id, stripe_customer_id, display_name')
      .eq('line_user_id', lineUserId)
      .single();

    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }

    let customerId = userRow.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: userRow.display_name || undefined,
        metadata: { line_user_id: lineUserId },
      });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', userRow.id);
    }

    // เลือก payment method ตามที่ผู้ใช้กด (พร้อมเพย์ หรือบัตร)
    const paymentMethodTypes = method === 'promptpay' ? ['promptpay'] : ['card'];

    const titles = {
      single: 'จ่ายรายครั้ง — ดูดวงรายวัน',
      basic: 'แพ็กเกจ Basic (5 ครั้ง/เดือน)',
      pro: 'แพ็กเกจ Pro (12 ครั้ง/เดือน)',
      unlimited: 'แพ็กเกจ Unlimited (ไม่จำกัด/เดือน)',
    };

    const origin = `https://${req.headers.host}`;

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: paymentMethodTypes,
      mode: 'payment',
      locale: 'th', // บังคับให้หน้า Stripe Checkout (รวมหน้า PromptPay QR) เป็นภาษาไทยเสมอ ไม่ต้องพึ่ง browser เดา
      line_items: [
        {
          price_data: {
            currency: 'thb',
            product_data: { name: titles[planType] || 'ProsperCharm Credits' },
            unit_amount: Math.round(price * 100), // Stripe ใช้หน่วยสตางค์
          },
          quantity: 1,
        },
      ],
      metadata: {
        line_user_id: lineUserId,
        plan_type: planType,
        credits: String(credits),
      },
      success_url: `${origin}/?stripe_success=1`,
      cancel_url: `${origin}/`,
    });

    return res.status(200).json({ url: checkoutSession.url });
  } catch (err) {
    console.error('Stripe create-session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
