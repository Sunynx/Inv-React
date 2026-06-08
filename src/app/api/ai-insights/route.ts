import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config in env' }, { status: 500 });
    }
    if (!openrouterKey) {
      return NextResponse.json({ error: 'Missing OpenRouter API Key in env' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch data for context
    const { data: assets } = await supabase.from('assets').select('status, category_id, department_id');
    const { data: tickets } = await supabase.from('repair_tickets').select('status, issue_description');

    if (!assets) {
      return NextResponse.json({ error: 'Failed to fetch asset data' }, { status: 500 });
    }

    const total = assets.length;
    const active = assets.filter(a => a.status === 'ใช้งาน').length;
    const repair = assets.filter(a => a.status === 'ส่งซ่อม').length;
    const spare = assets.filter(a => a.status === 'สำรอง').length;
    
    let recentIssuesText = 'ไม่มีการแจ้งซ่อม';
    if (tickets && tickets.length > 0) {
      recentIssuesText = tickets.slice(0, 10).map(t => t.issue_description).join(', ');
    }

    const prompt = `
You are an IT Asset Management AI Assistant.
Here is the current snapshot of the company's IT inventory:
- Total Assets: ${total} units
- Active (ใช้งาน): ${active} units
- In Repair (ส่งซ่อม): ${repair} units
- Spare (สำรอง): ${spare} units
- Recent repair issues include: ${recentIssuesText}

Please provide a short 2-3 sentence insight or recommendation for the IT Manager based on this data. 
Identify any potential bottlenecks (like too many items in repair) or risks. 
Keep your answer professional, concise, and reply in the Thai language.
`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'IT Inventory System',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Using gemini for speed and good thai support
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const aiData = await response.json();
    
    if (aiData.error) {
       console.error("OpenRouter error:", aiData.error);
       return NextResponse.json({ error: aiData.error.message || 'AI API Error' }, { status: 500 });
    }

    const insight = aiData.choices?.[0]?.message?.content || 'ไม่สามารถสร้างบทวิเคราะห์ได้ในขณะนี้';

    return NextResponse.json({ insight });
  } catch (error: any) {
    console.error('AI Insight Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
