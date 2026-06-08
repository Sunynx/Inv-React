import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// Use OpenRouter via the OpenAI SDK provider
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const maxDuration = 30;
export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openrouter('openrouter/free'),
    system: `คุณคือผู้ช่วย AI อัจฉริยะสำหรับระบบ RPM IT Inventory 
หน้าที่ของคุณคือช่วยตอบคำถาม วิเคราะห์ข้อมูล และสรุปข้อมูลให้กับผู้ใช้งาน (พนักงาน IT หรือผู้ดูแลระบบ)
คุณสามารถดึงข้อมูลจากฐานข้อมูล (Database) เพื่อมาตอบคำถามได้อย่างแม่นยำ

ตอบด้วยความเป็นมืออาชีพ เข้าใจง่าย และใช้ภาษาไทยเป็นหลัก
ถ้าไม่มีข้อมูลให้ตอบว่าไม่พบข้อมูล ห้ามเดาข้อมูลขึ้นมาเอง

ฐานข้อมูลมี 3 ส่วนหลักๆ คือ:
1. Assets (สินทรัพย์/อุปกรณ์ IT)
2. Repair Tickets (ประวัติการแจ้งซ่อม)
3. Stock Items (สต๊อกอะไหล่/วัสดุสิ้นเปลือง)`,
    messages,
    tools: {
      getAssetsSummary: tool({
        description: 'ดึงข้อมูลสรุปจำนวนสินทรัพย์ (Assets) แบ่งตามหมวดหมู่และสถานะ หรือค้นหาอุปกรณ์',
        parameters: z.object({
          searchQuery: z.string().optional().describe('คำค้นหาชื่ออุปกรณ์หรือรหัส (ถ้ามี)'),
          status: z.string().optional().describe('สถานะที่ต้องการกรอง เช่น "ใช้งาน", "สำรอง", "ส่งซ่อม"'),
        }),
        execute: async ({ searchQuery, status }) => {
          let query = supabase.from('assets').select(`*, categories(name)`);
          
          if (status) {
            query = query.eq('status', status);
          }
          if (searchQuery) {
            query = query.or(`name.ilike.%${searchQuery}%,asset_code.ilike.%${searchQuery}%`);
          }
          
          const { data, error } = await query.limit(20);
          if (error) return { error: error.message };
          
          // Return summary if no specific search
          if (!searchQuery && !status && data) {
             const active = data.filter(a => a.status === 'ใช้งาน').length;
             return { total: data.length, active, sample_data: data.slice(0, 5) };
          }
          
          return { results: data };
        },
      }),
      
      getRepairTickets: tool({
        description: 'ดึงข้อมูลประวัติการแจ้งซ่อม (Repair Tickets) เพื่อดูปัญหา หรือสถานะการซ่อม',
        parameters: z.object({
          status: z.string().optional().describe('สถานะการซ่อม เช่น "แจ้งซ่อม", "กำลังดำเนินการ", "ซ่อมสำเร็จ"'),
          priority: z.string().optional().describe('ความสำคัญ เช่น "High", "Medium", "Low"'),
        }),
        execute: async ({ status, priority }) => {
          let query = supabase.from('repair_tickets').select(`*, assets(name, asset_code)`);
          
          if (status) {
            query = query.eq('status', status);
          }
          if (priority) {
            query = query.eq('priority', priority);
          }
          
          const { data, error } = await query.order('created_at', { ascending: false }).limit(10);
          if (error) return { error: error.message };
          return { tickets: data };
        },
      }),

      getStockLevels: tool({
        description: 'ดึงข้อมูลระดับสต๊อกอะไหล่ (Stock Items) ว่ามีอะไรใกล้หมด หรือมีจำนวนเท่าไหร่',
        parameters: z.object({
          onlyLowStock: z.boolean().optional().describe('ถ้าเป็น true จะดึงเฉพาะอะไหล่ที่ใกล้หมด (ต่ำกว่า min_stock)'),
          searchQuery: z.string().optional().describe('คำค้นหาชื่ออะไหล่'),
        }),
        execute: async ({ onlyLowStock, searchQuery }) => {
          let query = supabase.from('stock_items').select('*');
          
          if (searchQuery) {
             query = query.ilike('name', `%${searchQuery}%`);
          }
          
          const { data, error } = await query;
          if (error) return { error: error.message };
          
          if (onlyLowStock && data) {
             return { low_stock_items: data.filter(item => item.quantity <= (item.min_stock || 0)) };
          }
          
          return { items: data?.slice(0, 15) };
        },
      }),
    },
    maxSteps: 3, // Allow the model to call tools up to 3 times before returning text
    maxTokens: 2000, // Limit max tokens to avoid OpenRouter credit check errors
  });

  return result.toDataStreamResponse();
}
