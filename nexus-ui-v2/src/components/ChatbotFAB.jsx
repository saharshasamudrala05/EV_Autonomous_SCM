import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Send, X, Bot, Sparkles, AlertCircle, Zap } from 'lucide-react';
import useSimulationStore from '../store/useSimulationStore';

const ChatbotFAB = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'TITAN V4 Intelligence Online. Awaiting SCM directive.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);
  const setSimulatedForecast = useSimulationStore((state) => state.setSimulatedForecast);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/v1/agentic/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      setMessages(prev => [...prev, { role: 'bot', text: data.reply }]);

      // If the botanical response contains simulation data, broadcast it
      if (data.simulation_data) {
        setSimulatedForecast(data.simulation_data);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Error: Signal interrupted. Re-establishing link...', variant: 'error' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-10 right-10 z-[100] font-display">
      {/* --- FLOATING ACTION BUTTON --- */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-full bg-slate-950 border-2 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)] flex items-center justify-center relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-sky-400/10 group-hover:bg-sky-400/20 transition-colors" />
        <div className="absolute inset-0 radar-sweep opacity-30" />
        <Radio className={`w-8 h-8 text-sky-400 ${isOpen ? 'rotate-90' : ''} transition-transform duration-500`} />
        
        {/* Connection Pulse */}
        <div className="absolute bottom-3 right-3 w-3 h-3 bg-emerald-400 rounded-full border border-slate-950 animate-pulse" />
      </motion.button>

      {/* --- CHAT CONSOLE --- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, y: -20, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
            className="absolute bottom-20 right-0 w-[400px] h-[550px] glass-holo border-sky-400/30 flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
          >
             <div className="scanline-overlay" />
             
             {/* Header */}
             <div className="p-4 border-b border-sky-400/20 bg-sky-950/20 flex justify-between items-center relative z-10">
               <div className="flex items-center gap-3">
                 <div className="p-2 rounded bg-sky-900/40 border border-sky-400/30">
                   <Bot className="w-4 h-4 text-sky-400" />
                 </div>
                 <div>
                   <h3 className="text-sm font-bold text-white tracking-widest uppercase flex items-center gap-2">
                     Titan V4 Agent
                     <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                   </h3>
                   <span className="text-[10px] font-mono text-sky-400/70">NEURAL ARCHITECTURE ACTIVE</span>
                 </div>
               </div>
               <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                 <X className="w-5 h-5" />
               </button>
             </div>

             {/* Messages */}
             <div 
               ref={scrollRef}
               className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll relative z-10 bg-black/10"
             >
               {messages.map((m, i) => (
                 <motion.div
                   initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   key={i}
                   className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                 >
                   <div className={`max-w-[85%] p-3 rounded-lg border font-mono text-xs leading-relaxed ${
                     m.role === 'user' 
                      ? 'bg-sky-500/10 border-sky-400/30 text-sky-100' 
                      : m.variant === 'error'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300'
                   }`}>
                     {m.role === 'bot' && (
                       <div className="flex items-center gap-2 mb-1 text-[8px] text-sky-400/50 tracking-[0.2em]">
                         <Zap className="w-2 h-2" /> TITAN_LOG_INCOMING
                       </div>
                     )}
                     {m.text}
                   </div>
                 </motion.div>
               ))}
               {isLoading && (
                 <div className="flex justify-start">
                   <div className="p-3 bg-slate-900/40 border border-slate-700 rounded-lg flex gap-2">
                     <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                     <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                     <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" />
                   </div>
                 </div>
               )}
             </div>

             {/* Input */}
             <div className="p-4 bg-sky-950/20 border-t border-sky-400/20 relative z-10">
               <div className="relative">
                 <input
                   type="text"
                   autoFocus
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                   placeholder="Enter SCM query or simulation directive..."
                   className="w-full bg-slate-950/80 border border-sky-400/30 rounded-lg py-3 pl-4 pr-12 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-400/60 shadow-[inset_0_0_10px_rgba(56,189,248,0.1)]"
                 />
                 <button 
                   onClick={handleSend}
                   disabled={isLoading}
                   className="absolute right-3 top-2.5 p-1.5 text-sky-400 hover:text-white transition-colors"
                 >
                   <Send className="w-4 h-4" />
                 </button>
               </div>
               <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                 {['Simulate Stockout', 'Optimize Fleet', 'Risk Audit'].map(hint => (
                   <button 
                     key={hint}
                     onClick={() => setInput(hint)}
                     className="whitespace-nowrap px-3 py-1 bg-sky-400/5 border border-sky-400/20 rounded-full text-[9px] font-mono text-sky-400/60 hover:bg-sky-400/10 hover:text-sky-400 transition-all uppercase tracking-tighter"
                   >
                     {hint}
                   </button>
                 ))}
               </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default ChatbotFAB;
