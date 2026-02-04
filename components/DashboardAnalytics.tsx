import React, { useMemo } from 'react';
import { Task, Project, Status, User } from '../types';
import { PieChart, BarChart3, TrendingUp, CheckCircle2, Users, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  tasks: Task[];
  projects: Project[];
  users: User[];
}

export const DashboardAnalytics: React.FC<Props> = ({ tasks, projects, users }) => {
  
  // --- Logic: Hours per Project ---
  const projectStats = useMemo(() => {
    const map = new Map<string, number>(); // ProjectId -> Minutes

    tasks.forEach(t => {
      if (!t.hoursDedicated) return;
      const [h, m] = t.hoursDedicated.split(':').map(Number);
      const minutes = (h * 60) + m;
      if (minutes > 0) {
        const current = map.get(t.projectId) || 0;
        map.set(t.projectId, current + minutes);
      }
    });

    // Convert to Array, Sort and Top 5
    const sorted = Array.from(map.entries())
      .map(([pid, mins]) => ({
        name: projects.find(p => p.id === pid)?.name || 'Desconhecido',
        minutes: mins,
        formatted: `${Math.floor(mins / 60)}h ${(mins % 60).toString().padStart(2, '0')}`
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);

    const maxMinutes = sorted[0]?.minutes || 1; // Avoid division by zero

    return { data: sorted, max: maxMinutes };
  }, [tasks, projects]);

  // --- Logic: Status Distribution (Donut) ---
  const statusStats = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return { percent: 0, completed: 0, pending: 0 };

    const completed = tasks.filter(t => t.status === Status.COMPLETED).length;
    const pending = total - completed;
    const percent = Math.round((completed / total) * 100);

    return { percent, completed, pending, total };
  }, [tasks]);

  // --- Logic: Hours per Collaborator (Fixed 44h scale) ---
  const collaboratorStats = useMemo(() => {
    const map = new Map<string, number>(); // UserId -> Minutes

    // Sum hours
    tasks.forEach(t => {
      if (!t.hoursDedicated) return;
      const [h, m] = t.hoursDedicated.split(':').map(Number);
      const minutes = (h * 60) + m;
      if (minutes > 0) {
        const current = map.get(t.collaboratorId) || 0;
        map.set(t.collaboratorId, current + minutes);
      }
    });

    const MAX_HOURS = 44;
    const MAX_MINUTES = MAX_HOURS * 60;

    const stats = users.map(user => {
      const minutes = map.get(user.id) || 0;
      // Cap percentage at 100% for visual purposes, but allow hours to show correctly
      const percentage = Math.min((minutes / MAX_MINUTES) * 100, 100);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const formatted = `${hours}h ${mins.toString().padStart(2, '0')}`;
      
      // Determine color based on load
      let colorClass = 'from-blue-600 to-cyan-400';
      if (hours > 44) colorClass = 'from-rose-600 to-rose-400'; // Overtime
      else if (hours > 40) colorClass = 'from-amber-500 to-orange-400'; // High load
      
      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        minutes,
        percentage,
        formatted,
        colorClass
      };
    }).sort((a, b) => b.minutes - a.minutes); // Show busiest first

    return { data: stats, maxLimit: MAX_HOURS };
  }, [tasks, users]);

  // SVG Helper for Donut
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (statusStats.percent / 100) * circumference;

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-6 mb-8">
      {/* Row 1: Projects & Status */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* --- Card 1: Hours by Project (Bar Chart) --- */}
        <div className="lg:col-span-2 bg-navy-800/50 border border-slate-700/50 rounded-xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="text-primary" size={20} />
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Horas por Projeto</h3>
          </div>
          
          <div className="space-y-3">
            {projectStats.data.length > 0 ? (
              projectStats.data.map((item, index) => (
                <div key={index} className="group">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium truncate max-w-[200px]">{item.name}</span>
                    <span className="text-slate-400 font-mono">{item.formatted}</span>
                  </div>
                  <div className="w-full bg-navy-900 rounded-full h-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.minutes / projectStats.max) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full group-hover:brightness-110 transition-all"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="h-32 flex items-center justify-center text-slate-500 text-sm">
                Sem horas registradas no período.
              </div>
            )}
          </div>
        </div>

        {/* --- Card 2: Completion Rate (Donut Chart) --- */}
        <div className="bg-navy-800/50 border border-slate-700/50 rounded-xl p-5 shadow-lg backdrop-blur-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-300"></div>
          
          <div className="flex items-center gap-2 mb-2 w-full">
             <PieChart className="text-emerald-400" size={20} />
             <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Taxa de Entrega</h3>
          </div>

          <div className="relative w-40 h-40 mt-2">
            {/* SVG Donut */}
            <svg className="w-full h-full transform -rotate-90">
              {/* Background Circle */}
              <circle
                cx="50%"
                cy="50%"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-navy-900"
              />
              {/* Progress Circle */}
              <motion.circle
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                cx="50%"
                cy="50%"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                strokeLinecap="round"
                className="text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]"
              />
            </svg>
            
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <span className="text-3xl font-bold tracking-tighter">{statusStats.percent}%</span>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Concluído</span>
            </div>
          </div>

          <div className="w-full mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="bg-navy-900/50 rounded p-2 border border-slate-800">
                 <span className="block text-lg font-bold text-emerald-400">{statusStats.completed}</span>
                 <span className="text-[10px] text-slate-500 uppercase">Entregues</span>
              </div>
              <div className="bg-navy-900/50 rounded p-2 border border-slate-800">
                 <span className="block text-lg font-bold text-blue-400">{statusStats.pending}</span>
                 <span className="text-[10px] text-slate-500 uppercase">Pendentes</span>
              </div>
          </div>
        </div>
      </motion.div>

      {/* Row 2: Collaborator Hours (New 0-44h Chart) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-navy-800/50 border border-slate-700/50 rounded-xl p-5 shadow-lg backdrop-blur-sm"
      >
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-2">
              <Users className="text-primary" size={20} />
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Carga Horária Semanal (Máx: 44h)</h3>
           </div>
           <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Normal</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Atenção</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div>Hora Extra</div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          {collaboratorStats.data.map((user) => (
             <div key={user.id} className="flex items-center gap-3 group p-2 rounded-lg hover:bg-white/5 transition-colors">
                <img src={user.avatar} className="w-10 h-10 rounded-full border border-slate-700" alt={user.name} />
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-end mb-1">
                      <span className="text-sm font-medium text-slate-200 truncate">{user.name}</span>
                      <span className={`text-xs font-mono font-bold ${user.minutes > (44*60) ? 'text-rose-400' : 'text-slate-400'}`}>
                        {user.formatted}
                      </span>
                   </div>
                   
                   <div className="relative w-full h-2.5 bg-navy-900 rounded-full overflow-hidden border border-slate-800">
                      {/* Grid Lines for visual context (0, 22, 44) */}
                      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-800/50 z-10"></div>
                      
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${user.percentage}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className={`h-full rounded-full bg-gradient-to-r ${user.colorClass}`}
                      />
                   </div>
                </div>
             </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};