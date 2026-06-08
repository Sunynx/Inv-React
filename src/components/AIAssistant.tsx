'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [localInput, setLocalInput] = useState('');
  const { messages, append, isLoading, error } = useChat();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;
    append({ role: 'user', content: localInput });
    setLocalInput('');
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-all z-50 flex items-center justify-center group"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-100 flex flex-col">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="font-semibold text-sm">RPM AI Assistant</h3>
                <p className="text-[10px] opacity-80">Powered by Gemini</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm mt-10">
                <Bot className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p>สวัสดีครับ! ผมคือผู้ช่วย AI</p>
                <p className="text-xs mt-1">ลองถามเรื่องจำนวนอุปกรณ์, สต๊อกอะไหล่ หรือประวัติการซ่อมได้เลยครับ</p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-blue-100 text-blue-600'}`}>
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-white border shadow-sm rounded-tl-none'}`}>
                    {m.content && <div className="whitespace-pre-wrap">{m.content}</div>}
                    {m.toolInvocations?.map(tool => (
                       <div key={tool.toolCallId} className="text-xs italic text-gray-500">
                         {tool.state === 'result' ? `✅ ค้นหาข้อมูล ${tool.toolName} สำเร็จ` : `🔍 กำลังค้นหาข้อมูลจากระบบ...`}
                       </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            {error && (
              <div className="flex gap-3 max-w-[85%] self-start">
                 <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                   <X className="w-4 h-4" />
                 </div>
                 <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-600 rounded-tl-none">
                   เกิดข้อผิดพลาดในการเชื่อมต่อ (Error: {error.message || 'Unknown'})
                 </div>
              </div>
            )}
            {isLoading && !error && messages[messages.length - 1]?.role === 'user' && (
               <div className="flex gap-3 max-w-[85%] self-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-3 rounded-2xl bg-white border shadow-sm rounded-tl-none text-sm text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> กำลังคิด...
                  </div>
               </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleFormSubmit} className="p-3 bg-white border-t flex gap-2">
            <Input
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder="พิมพ์คำถามของคุณที่นี่..."
              className="flex-1 bg-gray-50"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !localInput.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
