import React from 'react';
import { ActivityLog } from '../types';
import { backend } from '../services/mockBackend';
import { Clock, Edit, Trash2, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  logs: ActivityLog[];
}

export const ActivityLogWidget: React.FC<Props> = ({ logs }) => {
  const users = backend.getUsers();

  const getIcon = (action: string) => {
    switch(action) {
      case 'CREATE': return <PlusCircle size={14} className="text-emerald-400" />;
      case 'DELETE': return <Trash2 size={14} className="text-rose-400" />;
      default: return <Edit size={14} className="text-cyan-400" />;
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-navy-800/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4 h-full flex flex-col">
      <h3 className="text-slate-100 font-semibold mb-4 flex items-center gap-2">
        <Clock size={18} className="text-primary" />
        Atividades Recentes
      </h3>
      <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
        <AnimatePresence initial={false}>
          {logs.map((log) => {
            const user = users.find(u => u.id === log.userId);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-3 text-sm group"
              >
                <div className="mt-1 min-w-[32px]">
                   <img src={user?.avatar || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full border border-slate-700" alt="avatar" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200 text-xs">{user?.name || 'Sistema'}</span>
                    <span className="text-[10px] text-slate-500">{formatTime(log.timestamp)}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5 leading-snug">{log.description}</p>
                  <div className="mt-1 flex items-center gap-1 opacity-60">
                     {getIcon(log.action)}
                     <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{log.action}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {logs.length === 0 && (
          <p className="text-center text-slate-600 text-sm py-4">Nenhuma atividade recente.</p>
        )}
      </div>
    </div>
  );
};