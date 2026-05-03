export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { cards, question, topic } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `คุณคือนักพยากรณ์ไพ่ทาโร่ผู้เชี่ยวชาญ ให้คำทำนายเป็นภาษาไทย สไตล์อบอุ่น ลึกซึ้ง และให้กำลังใจ

คำถาม: "${question}" (หมวด${topic})

ไพ่ที่จับได้ 3 ใบ:
1. ${cards[0].name} — ${cards[0].meaning} (ตำแหน่ง: อดีต)
2. ${cards[1].name} — ${cards[1].meaning} (ตำแหน่ง: ปัจจุบัน)
3. ${cards[2].name} — ${cards[2].meaning} (ตำแหน่ง: อนาคต)

กรุณาร้อยเรียงคำทำนายจากไพ่ทั้ง 3 ใบให้เชื่อมโยงกันอย่างลงตัว ตอบคำถามข้างต้น ความยาวประมาณ 3-4 ประโยค อบอุ่น ลึกซึ้ง ไม่ต้องบอกชื่อไพ่ซ้ำ แค่ถ่ายทอดพลังงานของไพ่เป็นคำทำนาย จากนั้นขึ้นบรรทัดใหม่แล้วให้คำแนะนำสั้นๆ 1-2 ประโยค นำด้วย "✦ คำแนะนำ:"`
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    const parts = text.split('✦ คำแนะนำ:');

    res.status(200).json({
      prediction: parts[0].trim(),
      advice: parts[1] ? parts[1].trim() : ''
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
