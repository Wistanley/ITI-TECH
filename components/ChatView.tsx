
import React, { useState, useEffect, useRef } from 'react';
import { backend } from '../services/supabaseBackend';
import { ChatMessage, ChatState, User } from '../types';
import { Send, Bot, Lock, Loader2, Sparkles, User as UserIcon, KeyRound, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  messages: ChatMessage[];
  chatState: ChatState;
  currentUser: User;
  users: User[];
}

export const ChatView: React.FC<Props> = ({ messages, chatState, currentUser, users }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const isAiConfigured = backend.isGeminiConfigured();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatState.isLocked]); // Scroll on new message or lock state change (typing indicator)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatState.isLocked) return;

    const msg = input;
    setInput(''); // Clear immediately
    
    try {
        await backend.sendChatMessage(msg);
    } catch (err: any) {
        alert(err.message);
    }
  };

  // Determine who is currently locking the chat
  const lockedByUser = chatState.lockedByUserId 
    ? users.find(u => u.id === chatState.lockedByUserId) 
    : null;

  const isLockedByMe = chatState.lockedByUserId === currentUser.id;

  if (!isAiConfigured) {
    return (
      <div className="flex flex-col h-full bg-[#02040a] relative overflow-hidden rounded-xl border border-slate-800 items-center justify-center p-8">
         <div className="bg-navy-800/50 border border-slate-700 p-8 rounded-2xl max-w-lg text-center shadow-2xl">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
               <KeyRound className="text-white" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ação Necessária na Vercel</h2>
            <p className="text-slate-400 mb-6">
              Para que o sistema consiga ler sua chave de API, você precisa renomear a variável nas configurações do projeto.
            </p>
            
            <div className="bg-navy-900 border border-slate-800 rounded-lg p-4 text-left mb-6 font-mono text-sm relative group space-y-4">
               <div>
                 <p className="text-slate-500 mb-1 text-xs uppercase font-bold">1. Acesse na Vercel</p>
                 <p className="text-slate-300">Settings &gt; Environment Variables</p>
               </div>
               
               <div>
                  <p className="text-slate-500 mb-1 text-xs uppercase font-bold">2. Renomeie a variável</p>
                  <div className="flex items-center gap-2">
                     <span className="text-rose-400 line-through">API_KEY</span>
                     <span className="text-slate-500">→</span>
                     <span className="text-emerald-400 font-bold">VITE_API_KEY</span>
                  </div>
               </div>

               <div>
                 <p className="text-slate-500 mb-1 text-xs uppercase font-bold">3. Redploy</p>
                 <p className="text-slate-300">Faça um novo deploy para aplicar a mudança.</p>
               </div>
            </div>

            <a 
              href="https://vercel.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-all hover:scale-105"
            >
              Ir para Vercel Dashboard
              <ExternalLink size={16} />
            </a>
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#02040a] relative overflow-hidden rounded-xl border border-slate-800">
      
      {/* Header */}
      <header className="bg-navy-900/90 backdrop-blur-md p-4 border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="text-white" size={20} />
           </div>
           <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 Chat Colaborativo
                 <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">Gemini 2.5</span>
              </h2>
              <p className="text-xs text-slate-400">Inteligência Coletiva da Equipe ITI TECH</p>
           </div>
        </div>
        
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
           {chatState.isLocked ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-navy-800 rounded-full border border-slate-700 animate-pulse">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span className="text-xs text-slate-300">
                     {isLockedByMe ? "Gemini está processando..." : `${lockedByUser?.name || 'Alguém'} está com a palavra...`}
                  </span>
              </div>
           ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/20 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs text-emerald-400">Disponível</span>
              </div>
           )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gradient-to-b from-[#02040a] to-[#0a0e17]">
         <AnimatePresence initial={false}>
            {messages.map((msg, index) => {
               const isUser = msg.role === 'user';
               const isMe = msg.userId === currentUser.id;
               
               return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                     <div className={`flex max-w-[80%] md:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className="flex-shrink-0 mt-1">
                           {isUser ? (
                              <img 
                                src={msg.user?.avatar} 
                                className="w-8 h-8 rounded-full border border-slate-700 object-cover bg-navy-900"
                                title={msg.user?.name}
                              />
                           ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center border border-indigo-400/30 shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                                 <Bot size={18} className="text-white" />
                              </div>
                           )}
                        </div>

                        {/* Bubble */}
                        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                           <div className="flex items-center gap-2 mb-1 px-1">
                              <span className="text-[10px] font-bold text-slate-400">
                                 {isUser ? (isMe ? 'Você' : msg.user?.name) : 'Gemini AI'}
                              </span>
                              <span className="text-[10px] text-slate-600">
                                 {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                           </div>
                           
                           <div className={`px-4 py-3 rounded-2xl shadow-md text-sm leading-relaxed whitespace-pre-wrap ${
                              isUser 
                                ? 'bg-navy-800 text-slate-200 border border-slate-700 rounded-tr-none'
                                : 'bg-indigo-950/40 text-indigo-100 border border-indigo-500/20 rounded-tl-none'
                           }`}>
                              {msg.content}
                           </div>
                        </div>
                     </div>
                  </motion.div>
               );
            })}
         </AnimatePresence>

         {/* Typing Indicator Bubble */}
         {chatState.isLocked && (
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               className="flex justify-start w-full"
            >
               <div className="flex gap-3 max-w-[70%]">
                   <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center border border-indigo-400/30 opacity-70">
                        <Bot size={18} className="text-white" />
                   </div>
                   <div className="bg-indigo-950/20 border border-indigo-500/10 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                   </div>
               </div>
            </motion.div>
         )}
         
         <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-navy-900 border-t border-slate-800 z-20">
         <form onSubmit={handleSend} className="relative">
            <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               disabled={chatState.isLocked}
               placeholder={chatState.isLocked ? `Aguarde a resposta do Gemini para ${lockedByUser?.name || 'o usuário'}...` : "Digite sua pergunta para o Gemini..."}
               className={`w-full bg-navy-800 text-white rounded-xl pl-4 pr-12 py-3.5 shadow-inner transition-all outline-none ${
                  chatState.isLocked 
                     ? 'border border-slate-700 opacity-50 cursor-not-allowed placeholder-slate-500' 
                     : 'border border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-400'
               }`}
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
               {chatState.isLocked ? (
                  <Lock size={18} className="text-slate-500 mr-2" />
               ) : (
                  <button 
                     type="submit" 
                     disabled={!input.trim()}
                     className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 text-white p-2 rounded-lg transition-all"
                  >
                     <Send size={18} />
                  </button>
               )}
            </div>
         </form>
         <p className="text-[10px] text-center text-slate-600 mt-2">
            O chat segue uma fila única. Quando alguém envia, o canal é bloqueado até a IA responder.
         </p>
      </div>

    </div>
  );
};
