import { supabase } from '@/lib/supabase';

// Helper function to execute local tools
async function executeTool(name: string, args: any) {
  if (name === 'getAssetsSummary') {
    const { searchQuery, status } = args;
    let query = supabase.from('assets').select(`*, categories(name)`);
    if (status) query = query.eq('status', status);
    if (searchQuery) query = query.or(`name.ilike.%${searchQuery}%,asset_code.ilike.%${searchQuery}%`);
    const { data, error } = await query.limit(20);
    if (error) return { error: error.message };
    if (!searchQuery && !status && data) {
      const active = data.filter(a => a.status === 'ใช้งาน').length;
      return { total: data.length, active, sample_data: data.slice(0, 5) };
    }
    return { results: data };
  } else if (name === 'getRepairTickets') {
    const { status, priority } = args;
    let query = supabase.from('repair_tickets').select(`*, assets(name, asset_code)`);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(10);
    if (error) return { error: error.message };
    return { tickets: data };
  } else if (name === 'getStockLevels') {
    const { onlyLowStock, searchQuery } = args;
    let query = supabase.from('stock_items').select('*');
    if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
    const { data, error } = await query;
    if (error) return { error: error.message };
    if (onlyLowStock && data) return { low_stock_items: data.filter(item => item.quantity <= (item.min_stock || 0)) };
    return { items: data?.slice(0, 15) };
  }
  return { error: `Tool ${name} not found` };
}

export const maxDuration = 30;
export const runtime = 'edge';

const systemPrompt = `คุณคือผู้ช่วย AI อัจฉริยะสำหรับระบบ RPM IT Inventory 
หน้าที่ของคุณคือช่วยตอบคำถาม วิเคราะห์ข้อมูล และสรุปข้อมูลให้กับผู้ใช้งาน (พนักงาน IT หรือผู้ดูแลระบบ)
คุณสามารถดึงข้อมูลจากฐานข้อมูล (Database) เพื่อมาตอบคำถามได้อย่างแม่นยำ

ตอบด้วยความเป็นมืออาชีพ เข้าใจง่าย และใช้ภาษาไทยเป็นหลัก
ถ้าไม่มีข้อมูลให้ตอบว่าไม่พบข้อมูล ห้ามเดาข้อมูลขึ้นมาเอง

ฐานข้อมูลมี 3 ส่วนหลักๆ คือ:
1. Assets (สินทรัพย์/อุปกรณ์ IT)
2. Repair Tickets (ประวัติการแจ้งซ่อม)
3. Stock Items (สต๊อกอะไหล่/วัสดุสิ้นเปลือง)`;

const tools = [
  {
    type: "function",
    function: {
      name: "getAssetsSummary",
      description: "ดึงข้อมูลสรุปจำนวนสินทรัพย์ (Assets) แบ่งตามหมวดหมู่และสถานะ หรือค้นหาอุปกรณ์",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string", description: "คำค้นหาชื่ออุปกรณ์หรือรหัส (ถ้ามี)" },
          status: { type: "string", description: "สถานะที่ต้องการกรอง เช่น 'ใช้งาน', 'สำรอง', 'ส่งซ่อม'" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getRepairTickets",
      description: "ดึงข้อมูลประวัติการแจ้งซ่อม (Repair Tickets) เพื่อดูปัญหา หรือสถานะการซ่อม",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "สถานะการซ่อม เช่น 'แจ้งซ่อม', 'กำลังดำเนินการ', 'ซ่อมสำเร็จ'" },
          priority: { type: "string", description: "ความสำคัญ เช่น 'High', 'Medium', 'Low'" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getStockLevels",
      description: "ดึงข้อมูลระดับสต๊อกอะไหล่ (Stock Items) ว่ามีอะไรใกล้หมด หรือมีจำนวนเท่าไหร่",
      parameters: {
        type: "object",
        properties: {
          onlyLowStock: { type: "boolean", description: "ถ้าเป็น true จะดึงเฉพาะอะไหล่ที่ใกล้หมด (ต่ำกว่า min_stock)" },
          searchQuery: { type: "string", description: "คำค้นหาชื่ออะไหล่" }
        }
      }
    }
  }
];

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured in Cloudflare Environment Variables.");
    }

    const apiMessages = [{ role: "system", content: systemPrompt }, ...messages.map((m: any) => ({
      role: m.role,
      content: m.content
    }))];

    let currentMessages = [...apiMessages];
    let maxToolCalls = 3; 
    let finalResponse = null;
    let usedTools: string[] = [];

    while (maxToolCalls > 0) {
      maxToolCalls--;
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://rpm-inv.pages.dev",
          "X-Title": "RPM IT Inventory"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: currentMessages,
          tools: tools,
          tool_choice: "auto"
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter API error: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const message = data.choices[0].message;

      currentMessages.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments || "{}");
          const toolResult = await executeTool(toolCall.function.name, args);
          usedTools.push(toolCall.function.name);
          
          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(toolResult)
          });
        }
        continue;
      }

      finalResponse = message;
      break;
    }

    return Response.json({ 
      message: finalResponse,
      usedTools
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
