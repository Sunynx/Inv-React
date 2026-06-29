import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

export const maxDuration = 60;
export const runtime = 'edge';

const aiTools = {
  createRepairTicket: tool({
    description: 'เปิดใบแจ้งซ่อมใหม่สำหรับอุปกรณ์ (Create a new repair ticket)',
    parameters: z.object({
      asset_code: z.string().describe('รหัสอุปกรณ์ (Asset Code) เช่น PC-001'),
      title: z.string().describe('หัวข้อปัญหา หรือสรุปอาการสั้นๆ'),
      description: z.string().describe('รายละเอียดอาการเสีย'),
      priority: z.string().describe('ความสำคัญ (Low, Medium, High)'),
    }),
    execute: async ({ asset_code, title, description, priority }) => {
      const { data: assetData, error: assetError } = await supabase
        .from('assets')
        .select('id')
        .eq('asset_code', asset_code)
        .single();
      
      if (assetError || !assetData) {
        return { success: false, error: `ไม่พบอุปกรณ์รหัส ${asset_code} ในระบบ` };
      }

      const { data, error } = await supabase.from('repair_tickets').insert({
        asset_id: assetData.id,
        title,
        description,
        priority,
        status: 'แจ้งซ่อม'
      }).select();
      
      if (error) return { success: false, error: error.message };
      return { success: true, message: `สร้างใบแจ้งซ่อมสำเร็จ! สำหรับเครื่อง ${asset_code}`, ticket: data[0] };
    }
  }),
  updateStockQuantity: tool({
    description: 'ปรับลดหรือเพิ่มจำนวนสต๊อกอะไหล่ (Update stock quantity)',
    parameters: z.object({
      stock_name: z.string().describe('ชื่ออะไหล่ หรือวัสดุสิ้นเปลือง'),
      quantity_change: z.number().describe('จำนวนที่เปลี่ยนแปลง เช่น -2 (เพื่อลด) หรือ 5 (เพื่อเพิ่ม)'),
    }),
    execute: async ({ stock_name, quantity_change }) => {
      const { data: stockData, error: stockError } = await supabase
        .from('stock_items')
        .select('*')
        .ilike('name', `%${stock_name}%`)
        .limit(1);
      
      if (stockError || !stockData || stockData.length === 0) {
        return { success: false, error: `ไม่พบอะไหล่ชื่อ ${stock_name} ในระบบ` };
      }

      const item = stockData[0];
      const newQuantity = item.quantity + quantity_change;
      
      if (newQuantity < 0) {
        return { success: false, error: `จำนวนสต๊อกไม่พอ (ปัจจุบันมี ${item.quantity})` };
      }

      const { data, error } = await supabase
        .from('stock_items')
        .update({ quantity: newQuantity })
        .eq('id', item.id)
        .select();

      if (error) return { success: false, error: error.message };
      return { success: true, message: `อัปเดตจำนวน ${item.name} สำเร็จ (คงเหลือ: ${newQuantity})`, stock: data[0] };
    }
  }),
  getInventoryStats: tool({
    description: 'ดึงข้อมูลสถิติภาพรวมของทรัพย์สิน (Total assets, active, repair, spare)',
    parameters: z.object({}),
    execute: async () => {
      const { data, error } = await supabase.from('assets').select('status');
      if (error) return { success: false, error: error.message };
      const total = data.length;
      const active = data.filter(a => a.status === 'ใช้งาน').length;
      const repair = data.filter(a => a.status === 'ส่งซ่อม').length;
      const spare = data.filter(a => a.status === 'สำรอง').length;
      return { success: true, stats: { total, active, repair, spare } };
    }
  }),
  searchAssets: tool({
    description: 'ค้นหาข้อมูลทรัพย์สินจากคีย์เวิร์ด (เช่น ชื่อ, รหัส) หรือดึงรายการทรัพย์สิน',
    parameters: z.object({
      keyword: z.string().describe('คำค้นหา').optional()
    }),
    execute: async ({ keyword }) => {
      let query = supabase.from('assets').select('*, departments(name), categories(name)');
      if (keyword) {
        query = query.or(`name.ilike.%${keyword}%,asset_code.ilike.%${keyword}%`);
      }
      query = query.limit(50);
      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, assets: data.map(a => ({
        code: a.asset_code, name: a.name, status: a.status, 
        department: a.departments?.name, category: a.categories?.name, 
        user: a.assigned_user, location: a.location, price: a.price
      })) };
    }
  }),
  getLowStockItems: tool({
    description: 'ดึงรายการอะไหล่และวัสดุสิ้นเปลืองที่เหลือน้อยกว่าหรือเท่ากับจุดสั่งซื้อ (Low Stock)',
    parameters: z.object({}),
    execute: async () => {
      const { data, error } = await supabase.from('stock_items').select('name, quantity, min_stock, unit');
      if (error) return { success: false, error: error.message };
      const lowStock = data.filter(s => s.quantity <= (s.min_stock || 0));
      return { success: true, items: lowStock };
    }
  }),
  getExpiringLicenses: tool({
    description: 'ดึงรายการลิขสิทธิ์ซอฟต์แวร์ (Licenses) ที่ใกล้หมดอายุ',
    parameters: z.object({}),
    execute: async () => {
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const { data, error } = await supabase.from('licenses')
        .select('software_name, license_key, expiration_date')
        .not('expiration_date', 'is', null)
        .lt('expiration_date', thirtyDays.toISOString());
      if (error) return { success: false, error: error.message };
      return { success: true, licenses: data };
    }
  }),
  getUpcomingMaintenance: tool({
    description: 'ดึงรอบการซ่อมบำรุงที่กำลังจะมาถึง',
    parameters: z.object({}),
    execute: async () => {
      const { data, error } = await supabase.from('maintenance_schedules')
        .select('maintenance_type, scheduled_date, status, assets(name)')
        .neq('status', 'เสร็จสิ้น')
        .order('scheduled_date', { ascending: true })
        .limit(10);
      if (error) return { success: false, error: error.message };
      return { success: true, maintenance: data.map(m => ({
        type: m.maintenance_type, asset: m.assets?.name, date: m.scheduled_date, status: m.status
      })) };
    }
  }),
  getRecentRepairs: tool({
    description: 'ดึงประวัติการแจ้งซ่อมล่าสุด หรือค้นหาตามสถานะ',
    parameters: z.object({
      status: z.string().describe('สถานะ เช่น รอคิว, กำลังดำเนินการ, รออะไหล่, เสร็จสิ้น').optional()
    }),
    execute: async ({ status }) => {
      let query = supabase.from('repair_tickets').select('title, description, status, priority, assets(name), created_at');
      if (status) query = query.eq('status', status);
      query = query.order('created_at', { ascending: false }).limit(10);
      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, tickets: data.map(t => ({
        title: t.title, asset: t.assets?.name, status: t.status, priority: t.priority, date: t.created_at
      })) };
    }
  })
};

const defaultSystemPrompt = `คุณคือ AI Inventory Assistant ผู้ช่วยส่วนตัวสำหรับระบบจัดการทรัพย์สินไอที (IT Asset Management) ขององค์กร
หน้าที่ของคุณคือตอบคำถามด้วยข้อมูลจากฐานข้อมูลอย่างแม่นยำ เป็นมิตร และกระชับ
คุณมีความสามารถในการดึงข้อมูลจากฐานข้อมูลได้โดยตรงผ่านเครื่องมือ (Tools) ที่มีให้ กรุณาใช้ Tools เหล่านี้เพื่อค้นหาข้อมูลก่อนตอบเสมอ!
- หากถูกถามภาพรวม ให้ใช้ getInventoryStats
- หากถูกถามถึงอุปกรณ์เจาะจง ให้ใช้ searchAssets
- หากถูกถามถึงอะไหล่ ให้ใช้ getLowStockItems
- หากถูกถามถึงซอฟต์แวร์ ให้ใช้ getExpiringLicenses
- หากถูกถามถึงซ่อมบำรุง ให้ใช้ getUpcomingMaintenance
- หากถูกถามถึงประวัติการซ่อม ให้ใช้ getRecentRepairs

--- การวาดกราฟ (Data Visualization) ---
ถ้าผู้ใช้ขอให้ "วาดกราฟ" หรือ "สร้างกราฟ" ให้คุณวิเคราะห์ข้อมูลที่หามาได้ และตอบกลับด้วย JSON block ในรูปแบบนี้ (ห้ามมีข้อความอื่นปนใน block นี้):
\`\`\`chart
{
  "type": "bar",
  "title": "ชื่อกราฟ",
  "data": [
    {"name": "หมวดA", "value": 10},
    {"name": "หมวดB", "value": 20}
  ]
}
\`\`\`
รองรับ type: "bar", "pie", "donut", "line"
คุณสามารถอธิบายเพิ่มเติมใต้กราฟได้ปกติ แต่โค้ดกราฟต้องอยู่ใน block \`\`\`chart เท่านั้น

--- การออกรายงานอัตโนมัติ (Automated Reports) ---
ถ้าผู้ใช้ขอให้ "ออกรายงาน", "สร้างรายงาน", หรือ "สรุปเป็นรายงาน" ให้คุณสร้างเนื้อหารายงานที่ครอบคลุม และตอบกลับด้วย Markdown block ในรูปแบบนี้ (ห้ามมีข้อความอื่นปนใน block นี้):
\`\`\`report
# ชื่อรายงาน เช่น รายงานปัญหา IT ประจำสัปดาห์
เนื้อหารายงานแบบละเอียด (รองรับ Markdown เต็มรูปแบบ, ขึ้นบรรทัดใหม่ได้, ใช้ตารางได้)
\`\`\`
คุณสามารถอธิบายสั้นๆ ก่อนส่งรายงานได้ แต่ตัวรายงานต้องอยู่ใน block \`\`\`report เท่านั้น

คำแนะนำในการตอบ:
1. ตอบเป็นภาษาไทย ใช้ Bullet point หรือ Emoji เพื่อให้อ่านง่าย
2. หากตอบเกี่ยวกับข้อมูลอุปกรณ์ ให้ระบุชื่อและรหัสให้ชัดเจน
3. หากคำถามอยู่นอกเหนือจากระบบ IT Inventory แจ้งว่าคุณเป็นผู้ช่วยเฉพาะทางด้าน IT Inventory`;

export async function POST(req: Request) {
  try {
    const { messages, system_prompt_override } = await req.json();
    let resultText = '';

    const rawChatMessages = messages.filter((m: any) => m.role !== 'system');

    // Flatten multi-turn history into a single user message to prevent strict schema errors
    let flattenedContent = "";
    for (let i = 0; i < rawChatMessages.length - 1; i++) {
       const m = rawChatMessages[i];
       flattenedContent += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
    }
    const lastMessage = rawChatMessages[rawChatMessages.length - 1];
    if (flattenedContent) {
       flattenedContent = `[ประวัติการสนทนาก่อนหน้า]\n${flattenedContent}\n[คำถามล่าสุด]\nUser: ${lastMessage.content}`;
    } else {
       flattenedContent = lastMessage.content;
    }

    const safeMessages = [ { role: 'user' as const, content: flattenedContent } ];

    const providers = [];
    if (process.env.OPENROUTER_API_KEY) {
      const openrouter = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
      providers.push({ name: 'OpenRouter', model: openrouter('google/gemini-2.5-flash') });
    }
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      providers.push({ name: 'Google', model: google('gemini-2.5-flash') });
    }
    if (process.env.GROQ_API_KEY) {
      const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY });
      providers.push({ name: 'Groq', model: groq('llama-3.3-70b-versatile') });
    }

    if (providers.length === 0) {
      throw new Error("No API keys configured. Please add OPENROUTER_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.");
    }

    let providerErrors: string[] = [];
    const finalSystemPrompt = system_prompt_override || defaultSystemPrompt;

    for (const provider of providers) {
      try {
        console.log(`Trying provider: ${provider.name}`);
        const result = await generateText({
          model: provider.model,
          system: finalSystemPrompt,
          messages: safeMessages,
          maxTokens: 3000,
          temperature: 0.3,
          tools: aiTools,
          maxSteps: 5,
        });
        
        resultText = result.text;
        break; // Success! Break the loop
      } catch (err: any) {
        console.warn(`${provider.name} failed:`, err.message);
        providerErrors.push(`[${provider.name}] ${err.message}`);
      }
    }

    if (!resultText) {
      throw new Error(`ระบบ AI ทั้งหมดขัดข้อง:\n${providerErrors.join('\n')}`);
    }

    return new Response(JSON.stringify({
      choices: [
        { message: { content: resultText } }
      ]
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: { message: error.message || 'Unknown server error' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
