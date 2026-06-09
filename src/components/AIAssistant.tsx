"use client";

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, MessageSquare, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function AIReportRenderer({ data }: { data: any }) {
  const handleDownload = () => {
    const blob = new Blob([data.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title || 'report'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="w-full my-4 bg-white p-4 rounded-lg border shadow-sm">
      <div className="flex items-center gap-2 mb-2 border-b pb-2 text-blue-800">
        <FileText className="w-4 h-4" />
        <h4 className="text-sm font-semibold">{data.title || 'เอกสารรายงาน'}</h4>
      </div>
      <p className="text-xs text-gray-600 line-clamp-3 mb-3">{data.content?.substring(0, 150)}...</p>
      <Button onClick={handleDownload} variant="outline" size="sm" className="w-full text-xs flex items-center justify-center gap-2 hover:bg-blue-50 hover:text-blue-700">
        <Download className="w-4 h-4" /> ดาวน์โหลดเป็นไฟล์ .md
      </Button>
    </div>
  );
}

function AIChartRenderer({ data }: { data: any }) {
  if (data.type === 'pie') {
    return (
      <div className="w-full h-48 my-4 bg-white p-2 rounded-lg border shadow-sm">
        <h4 className="text-xs font-semibold text-center mb-2">{data.title}</h4>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} label>
              {data.data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  if (data.type === 'donut') {
    return (
      <div className="w-full h-48 my-4 bg-white p-2 rounded-lg border shadow-sm">
        <h4 className="text-xs font-semibold text-center mb-2">{data.title}</h4>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={55} label>
              {data.data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (data.type === 'line') {
    return (
      <div className="w-full h-48 my-4 bg-white p-2 rounded-lg border shadow-sm">
        <h4 className="text-xs font-semibold text-center mb-2">{data.title}</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
            <XAxis dataKey="name" fontSize={10} tickFormatter={(val) => val.length > 5 ? val.substring(0,5)+'...' : val} />
            <YAxis fontSize={10} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
  return (
    <div className="w-full h-48 my-4 bg-white p-2 rounded-lg border shadow-sm">
      <h4 className="text-xs font-semibold text-center mb-2">{data.title}</h4>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.data}>
          <XAxis dataKey="name" fontSize={10} tickFormatter={(val) => val.length > 5 ? val.substring(0,5)+'...' : val} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiLoading]);

  const renderMessage = (text: string) => {
    const parts = text.split(/(```(?:chart|report)[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```chart') && part.endsWith('```')) {
        try {
          const jsonStr = part.replace(/```chart\n?/, '').replace(/```$/, '');
          const chartData = JSON.parse(jsonStr);
          return <AIChartRenderer key={index} data={chartData} />;
        } catch (e) {
          return <div key={index} className="text-red-500 text-xs p-2 bg-red-50 rounded">Failed to render chart (Invalid JSON format)</div>;
        }
      }
      if (part.startsWith('```report') && part.endsWith('```')) {
        try {
          const rawContent = part.replace(/^```report\n?/, '').replace(/```$/, '').trim();
          
          // If the AI still sends JSON, try parsing it as fallback
          if (rawContent.startsWith('{') && rawContent.endsWith('}')) {
             try {
               const parsed = JSON.parse(rawContent);
               return <AIReportRenderer key={index} data={parsed} />;
             } catch(e) {} 
          }
          
          // Treat as raw markdown report (Robust)
          const lines = rawContent.split('\n');
          let title = "เอกสารรายงาน";
          let content = rawContent;
          
          if (lines.length > 0 && lines[0].startsWith('#')) {
             title = lines[0].replace(/^#+\s*/, '').trim();
             content = lines.slice(1).join('\n').trim();
          }

          return <AIReportRenderer key={index} data={{ title, content }} />;
        } catch (e) {
          return <div key={index} className="text-red-500 text-xs p-2 bg-red-50 rounded">Failed to render report</div>;
        }
      }
      // Render normal text with bold support
      return <span key={index} className="whitespace-pre-wrap leading-relaxed break-words block">{
         part.split(/(\*\*.*?\*\*)/g).map((p, idx) => 
           p.startsWith('**') && p.endsWith('**') 
             ? <strong key={idx} className="font-semibold text-blue-900">{p.slice(2, -2)}</strong> 
             : <span key={idx}>{p}</span>
         )
      }</span>;
    });
  };

  const handleSend = async (overridePrompt?: string) => {
    const q = (typeof overridePrompt === 'string' ? overridePrompt : chatInput).trim();
    if (!q) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: q }]);
    setIsAiLoading(true);

    try {
      // Fetch full database context just-in-time
      const [
        allAssetsRes,
        licensesRes,
        maintenanceRes,
        stockRes,
        repairsRes
      ] = await Promise.all([
        supabase.from('assets').select('*, departments(name), categories(name)'),
        supabase.from('licenses').select('*'),
        supabase.from('maintenance_schedules').select('*, assets(name)'),
        supabase.from('stock_items').select('*'),
        supabase.from('repair_tickets').select('*, assets(name)')
      ]);

      const allAssets = allAssetsRes.data || [];
      const licenses = licensesRes.data || [];
      const maintenance = maintenanceRes.data || [];
      const stock = stockRes.data || [];
      const repairs = repairsRes.data || [];

      // Calculate some basic stats to feed AI
      const total = allAssets.length;
      const active = allAssets.filter(a => a.status === 'ใช้งาน').length;
      const repair = allAssets.filter(a => a.status === 'ส่งซ่อม').length;
      const spare = allAssets.filter(a => a.status === 'สำรอง').length;

      const assetsFullStr = allAssets.map(a => 
        `- [${a.asset_code||'-'}] ${a.name||'-'} (แผนก: ${a.departments?.name||'-'}, หมวด: ${a.categories?.name||'-'}) ` +
        `| สถานะ: ${a.status||'-'} | สถานที่: ${a.location||'-'} | ผู้ถือครอง: ${a.assigned_user||'-'} | IP: ${a.ip_address||'-'} ` +
        `| สเปค: ${[a.model, a.cpu, a.ram, a.storage].filter(Boolean).join(', ')||'-'} | ราคา: ฿${a.price||0}`
      ).join('\n');

      const licensesStr = licenses.map(l => 
        `- ${l.name} (Key: ${l.license_key||'-'}) | วันหมดอายุ: ${l.expiry_date||'-'} | สถานะ: ${l.status||'-'}`
      ).join('\n');

      const maintenanceStr = maintenance.map(m => 
        `- ${m.title} สำหรับ ${m.assets?.name||'อุปกรณ์'} | กำหนดการ: ${m.next_due_at||'-'} | สถานะ: ${m.status||'-'} | หมายเหตุ: ${m.description||'-'}`
      ).join('\n');

      const stockStr = stock.map(s => 
        `- ${s.name} | คงเหลือ: ${s.quantity} ${s.unit} (ขั้นต่ำ: ${s.min_stock||0})`
      ).join('\n');

      const recentIssues = repairs.length > 0 ? repairs.map(t => `- ${t.assets?.name || 'อุปกรณ์'}: ${t.description || t.title} (สถานะ: ${t.status})`).join('\n') : 'ไม่มี';

      // คำนวณประวัติการซ่อมบำรุงรายอุปกรณ์ (Predictive Analysis Data)
      const repairCountByAsset: Record<string, { count: number, name: string, issues: string[] }> = {};
      repairs.forEach(r => {
        const assetName = r.assets?.name || 'Unknown';
        if (!repairCountByAsset[assetName]) {
          repairCountByAsset[assetName] = { count: 0, name: assetName, issues: [] };
        }
        repairCountByAsset[assetName].count += 1;
        repairCountByAsset[assetName].issues.push(r.title);
      });

      const highRiskAssets = Object.values(repairCountByAsset)
        .filter(a => a.count >= 2)
        .map(a => `- ${a.name}: ซ่อมไปแล้ว ${a.count} ครั้ง (ปัญหาที่พบ: ${a.issues.join(', ')})`)
        .join('\n');

      const systemPrompt = `คุณคือ AI Inventory Assistant ผู้ช่วยส่วนตัวสำหรับระบบจัดการทรัพย์สินไอที (IT Asset Management) ขององค์กร
หน้าที่ของคุณคือตอบคำถามด้วยข้อมูลจากฐานข้อมูลทั้งหมดอย่างแม่นยำ เป็นมิตร และกระชับ

--- สถิติภาพรวม ---
- ทรัพย์สินทั้งหมด: ${total} รายการ (ใช้งานอยู่ ${active}, ส่งซ่อม ${repair}, สำรอง ${spare})
- รายการซ่อมล่าสุด:\n${recentIssues}

--- ข้อมูลในฐานข้อมูลทั้งหมด (สำหรับใช้ค้นหาและตอบคำถามเชิงลึก) ---
1. รายการทรัพย์สิน (Assets) พร้อมรายละเอียด สเปค ผู้ถือครอง สถานที่ และราคา:
${assetsFullStr || 'ไม่มีข้อมูล'}

2. ลิขสิทธิ์ซอฟต์แวร์ (Licenses):
${licensesStr || 'ไม่มีข้อมูล'}

3. รอบซ่อมบำรุง (Maintenance):
${maintenanceStr || 'ไม่มีข้อมูล'}

4. รายการสต๊อกอะไหล่ (Stock Items):
${stockStr || 'ไม่มีข้อมูล'}

--- การวิเคราะห์เชิงคาดการณ์ (Predictive Analysis) ---
ถ้าผู้ใช้ขอให้ "วิเคราะห์แนวโน้ม", "ประเมินความเสี่ยง", หรือถามว่า "เครื่องไหนเสี่ยงจะเสีย" ให้คุณพิจารณาจากข้อมูลเหล่านี้:
1. ประวัติการแจ้งซ่อมซ้ำซาก:
${highRiskAssets || 'ไม่มีอุปกรณ์ที่มีความเสี่ยงจากการซ่อมซ้ำซาก (ซ่อมน้อยกว่า 2 ครั้ง)'}
2. รอบซ่อมบำรุงที่ใกล้ถึงกำหนด (อ้างอิงจากข้อมูล Maintenance)
ให้คุณประเมินและสรุป "รายงานความเสี่ยง (Risk Assessment)" เป็น % สำหรับเครื่องที่มีความเสี่ยงสูง และอธิบายเหตุผลประกอบให้เป็นมืออาชีพ

--- การวาดกราฟ (Data Visualization) ---
ถ้าผู้ใช้ขอให้ "วาดกราฟ" หรือ "สร้างกราฟ" ให้คุณวิเคราะห์ข้อมูลและตอบกลับด้วย JSON block ในรูปแบบนี้ (ห้ามมีข้อความอื่นปนใน block นี้):
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
2. หากผู้ใช้ถามถึงอุปกรณ์ รายชื่อพนักงานที่ถือครอง สเปค ไอพีแอดเดรส (IP) ราคา หรือสต๊อกอะไหล่ ให้ค้นหาจากข้อมูลด้านบนแล้วตอบให้ตรงประเด็นที่สุด
3. หากคำถามอยู่นอกเหนือจากข้อมูลที่มี ให้ตอบสุภาพว่า "ตรวจสอบจากฐานข้อมูลแล้ว ไม่พบข้อมูลดังกล่าวครับ"`;

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        { role: 'user', content: q }
      ];

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: apiMessages
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error?.message || 'API Error');
      
      const reply = data.choices?.[0]?.message?.content || 'ไม่สามารถตอบคำถามได้';
      setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'ai', text: `🚨 **เกิดข้อผิดพลาดจากระบบ AI**\n${e.message}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl transition-all duration-300 z-50 flex items-center justify-center
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100 hover:scale-110 hover:shadow-2xl'}
          bg-blue-600 hover:bg-blue-700 text-white
        `}
      >
        <Bot size={28} className="animate-pulse" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-blue-100/50 flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between text-white shadow-md z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-inner">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white/90">AI Assistant</h3>
                <p className="text-xs text-blue-100/80 font-medium tracking-wide">ถามตอบข้อมูลทรัพย์สิน</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scrollbar-thin">
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 pt-4">
                <div className="space-y-3 flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center shadow-inner">
                    <MessageSquare className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-700">สวัสดีครับ 👋</p>
                    <p className="text-xs text-slate-500 mt-1">มีอะไรให้ผมช่วยดูแลไหมครับ?</p>
                  </div>
                </div>
                
                <div className="w-full max-w-[280px] grid grid-cols-1 gap-2.5">
                  {[
                    { label: "📊 วาดกราฟสรุปสถานะอุปกรณ์", prompt: "ช่วยวาดกราฟวงกลมแสดงสัดส่วนสถานะอุปกรณ์ทั้งหมดในระบบให้ดูหน่อย" },
                    { label: "🔮 ประเมินความเสี่ยงเครื่องเสีย", prompt: "วิเคราะห์ประวัติการแจ้งซ่อม และประเมินความเสี่ยงว่าเครื่องไหนมีโอกาสเสียซ้ำบ้าง" },
                    { label: "📑 ออกรายงานปัญหา IT ประจำสัปดาห์", prompt: "สร้างรายงานสรุปประวัติการแจ้งซ่อม และปัญหาที่พบในระบบทั้งหมดให้หน่อย" },
                    { label: "🛠️ เปิดใบแจ้งซ่อมใหม่", prompt: "ช่วยเปิดแจ้งซ่อมให้ที" }
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(btn.prompt)}
                      className="text-[13px] text-left bg-white border border-blue-100 hover:border-blue-400 hover:bg-blue-50/50 text-slate-600 hover:text-blue-700 px-4 py-3 rounded-xl transition-all duration-200 shadow-sm hover:shadow"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                
                <div className={`p-3 rounded-2xl max-w-[85%] text-sm shadow-sm break-words overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white border text-gray-700 rounded-tl-none'
                }`}>
                  {msg.role === 'ai' ? renderMessage(msg.text) : msg.text}
                </div>
              </div>
            ))}

            {isAiLoading && (
              <div className="flex gap-3 max-w-[85%] self-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3 rounded-2xl bg-white border shadow-sm rounded-tl-none text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> กำลังประมวลผล...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="พิมพ์คำถามของคุณที่นี่..."
              className="flex-1 bg-gray-50"
              disabled={isAiLoading}
            />
            <Button 
              onClick={() => handleSend()} 
              size="icon" 
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              disabled={isAiLoading || !chatInput.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
