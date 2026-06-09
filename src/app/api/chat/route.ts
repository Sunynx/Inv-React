import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

export const maxDuration = 30;
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
      // Find asset UUID from asset_code
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
      // Find the stock item by name
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
  })
};

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    let resultText = '';

    // Extract system message
    const systemMessage = messages.find((m: any) => m.role === 'system')?.content;
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
    if (process.env.GROQ_API_KEY) {
      const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY });
      providers.push({ name: 'Groq', model: groq('llama-3.3-70b-versatile') });
    }
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      providers.push({ name: 'Google', model: google('gemini-2.5-flash') });
    }

    if (providers.length === 0) {
      throw new Error("No API keys configured. Please add OPENROUTER_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.");
    }

    let providerErrors: string[] = [];

    for (const provider of providers) {
      try {
        console.log(`Trying provider: ${provider.name}`);
        const result = await generateText({
          model: provider.model,
          system: systemMessage,
          messages: safeMessages,
          maxTokens: 3000,
          temperature: 0.3,
          tools: aiTools,
          maxSteps: 3,
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
