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
      priority: z.enum(['Low', 'Medium', 'High']).describe('ความสำคัญ'),
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

    // Provider 1: Try OpenRouter
    try {
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is missing");
      }
      
      const openrouter = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      });

      const result = await generateText({
        model: openrouter('google/gemini-2.5-flash'),
        messages,
        maxTokens: 3000,
        temperature: 0.3,
        tools: aiTools,
        maxSteps: 3, // Allow loop for tool execution
      });
      resultText = result.text;
    } catch (openRouterError) {
      console.warn("OpenRouter failed, falling back to Google Generative AI:", openRouterError);
      
      // Provider 2: Fallback to Google Generative AI
      try {
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
          throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
        }

        const fallbackResult = await generateText({
          model: google('gemini-2.5-flash'),
          messages,
          maxTokens: 3000,
          temperature: 0.3,
          tools: aiTools,
          maxSteps: 3,
        });
        resultText = fallbackResult.text;
      } catch (googleError) {
        console.warn("Google API failed, falling back to Groq:", googleError);

        // Provider 3: Fallback to Groq
        if (!process.env.GROQ_API_KEY) {
          throw new Error("GROQ_API_KEY is missing and all previous providers failed.");
        }

        const groq = createOpenAI({
          baseURL: 'https://api.groq.com/openai/v1',
          apiKey: process.env.GROQ_API_KEY,
        });

        const groqResult = await generateText({
          model: groq('llama-3.3-70b-versatile'),
          messages,
          maxTokens: 3000,
          temperature: 0.3,
          tools: aiTools,
          maxSteps: 3,
        });
        resultText = groqResult.text;
      }
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
