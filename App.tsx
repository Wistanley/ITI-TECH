import React, { useState, useEffect, useMemo } from 'react';
// SWITCH TO REAL BACKEND
import { backend } from './services/supabaseBackend'; 
import { Task, User, ActivityLog, Status, Sector, Project } from './types';
import { Badge } from './components/ui/Badge';
import { ActivityLogWidget } from './components/ActivityLogWidget';
import { TaskModal } from './components/TaskModal';
import { SettingsView } from './components/SettingsView';
import { WeeklyPlanningView } from './components/WeeklyPlanningView';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Search, 
  Plus, 
  ListTodo,
  LogOut,
  User as UserIcon,
  Filter,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  FolderOpen,
  Copy,
  Users,
  Download,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Login Screen Component ---
const LoginScreen: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await backend.authenticate(email, password);
      if (result.user) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Erro ao autenticar');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#02040a] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 to-cyan-500/5 z-0" />
      
      <div className="bg-navy-800/80 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl w-full max-w-md z-10 relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 mb-4 shadow-lg shadow-blue-500/20">
            <LayoutDashboard className="text-white" size={24} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ITI TECH</h1>
          <p className="text-slate-400 mt-2">Acesse sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">E-mail</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-navy-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                placeholder="seu@email.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-navy-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-center gap-2"
              >
                 <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                 {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Entrar
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // UI State
  const [currentView, setCurrentView] = useState<'dashboard' | 'planning' | 'settings'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [duplicatingTask, setDuplicatingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterScope, setFilterScope] = useState<'ALL' | 'MINE'>('ALL');

  // Load Data Effect
  useEffect(() => {
    // Only subscribe if logged in
    if (!currentUser) return;

    const refreshData = () => {
      setUsers(backend.getUsers());
      setTasks(backend.getTasks());
      setLogs(backend.getLogs());
      setSectors(backend.getSectors());
      setProjects(backend.getProjects());
    };

    // Initial fetch (Calls async init inside backend, then notifies)
    backend.initializeData().then(() => {
      refreshData();
    });

    // Realtime subscription
    const unsubscribe = backend.subscribe(() => {
      refreshData();
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    backend.logout();
    setCurrentUser(null);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setDuplicatingTask(null);
    setIsModalOpen(true);
  };

  const handleDuplicate = (task: Task) => {
    setEditingTask(null);
    setDuplicatingTask(task);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta atividade?')) {
      backend.deleteTask(id);
    }
  };

  // Helper to resolve Project Name
  const getProjectName = (projectId: string) => {
     return projects.find(p => p.id === projectId)?.name || 'Projeto Desconhecido';
  };

  // Computed Stats
  const stats = useMemo(() => {
    const myTasks = tasks.filter(t => t.collaboratorId === currentUser?.id);
    const myHours = backend.calculateTotalHours(currentUser?.id);
    
    const completed = tasks.filter(t => t.status === Status.COMPLETED).length;
    const pending = tasks.length - completed;
    
    return { myHours, completed, pending, total: tasks.length };
  }, [tasks, currentUser]);

  // Filtering
  const filteredTasks = tasks.filter(t => {
    const projectName = getProjectName(t.projectId).toLowerCase();
    const matchesSearch = projectName.includes(search.toLowerCase()) || 
                          t.plannedActivity.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchesScope = filterScope === 'ALL' || t.collaboratorId === currentUser?.id;

    return matchesSearch && matchesStatus && matchesScope;
  });

  // Export to CSV Logic
  const handleExportCSV = () => {
    if (filteredTasks.length === 0) {
      alert('Não há dados para exportar com os filtros atuais.');
      return;
    }

    // 1. Define Headers
    const headers = [
      'Projeto',
      'Setor',
      'Colaborador',
      'Atividade Planejada',
      'Atividade Entregue',
      'Status',
      'Prioridade',
      'Data Entrega',
      'Horas',
      'Observações'
    ];

    // 2. Map Rows
    const rows = filteredTasks.map(t => {
      const projectName = getProjectName(t.projectId);
      const collaboratorName = users.find(u => u.id === t.collaboratorId)?.name || 'N/A';
      
      // Helper to escape CSV fields
      const escape = (str: string | undefined | null) => {
        const s = str ? String(str) : '';
        return `"${s.replace(/"/g, '""')}"`;
      };

      return [
        escape(projectName),
        escape(t.sector),
        escape(collaboratorName),
        escape(t.plannedActivity),
        escape(t.deliveredActivity),
        escape(t.status),
        escape(t.priority),
        escape(t.dueDate),
        escape(t.hoursDedicated),
        escape(t.notes)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `iti_tech_relatorio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-[#02040a] text-slate-200 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-navy-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <LayoutDashboard className="text-white" size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">ITI TECH</span>
        </div>

        <div className="px-4 py-2">
           <div className="bg-navy-800/50 rounded-xl p-4 border border-slate-800">
             <p className="text-xs text-slate-400 font-medium uppercase mb-2">Suas Horas (Semana)</p>
             <div className="flex items-baseline gap-1">
               <span className="text-3xl font-bold text-white tracking-tighter">{stats.myHours}</span>
               <span className="text-xs text-slate-500">h</span>
             </div>
             <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
               <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" style={{ width: '65%' }}></div>
             </div>
           </div>
        </div>

        <nav className="flex-1 px-4 mt-6 space-y-1">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border font-medium transition-all ${currentView === 'dashboard' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <ListTodo size={18} />
            <span>Dashboard</span>
          </button>
           <button 
            onClick={() => setCurrentView('planning')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border font-medium transition-all ${currentView === 'planning' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <CalendarDays size={18} />
            <span>Planejamento</span>
          </button>
           <button 
            onClick={() => setCurrentView('settings')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border font-medium transition-all ${currentView === 'settings' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <FolderOpen size={18} />
            <span>Cadastros</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <img src={currentUser.avatar} className="w-9 h-9 rounded-full border border-slate-600" alt="me" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-500 truncate">{currentUser.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors w-full">
            <LogOut size={14} />
            Sair do sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-navy-900/80 backdrop-blur-md flex items-center justify-between px-6 z-20">
          <h1 className="text-lg font-semibold text-white">
            {currentView === 'dashboard' && 'Visão Geral da Semana'}
            {currentView === 'planning' && 'Agenda Semanal'}
            {currentView === 'settings' && 'Gerenciamento'}
          </h1>
          <div className="flex items-center gap-3">
             {currentView === 'dashboard' && (
               <>
                 <div className="hidden md:flex items-center gap-6 mr-2 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                       <span>{stats.completed} Entregues</span>
                    </div>
                 </div>
                 
                 <button
                   onClick={handleExportCSV}
                   className="hidden sm:flex items-center gap-2 bg-navy-800 border border-slate-700 hover:bg-navy-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-all"
                   title="Exportar dados filtrados para CSV"
                 >
                   <Download size={16} />
                   <span>Exportar</span>
                 </button>

                <button 
                  onClick={() => { setEditingTask(null); setDuplicatingTask(null); setIsModalOpen(true); }}
                  className="bg-primary hover:bg-sky-400 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Nova Atividade</span>
                  <span className="sm:hidden">Nova</span>
                </button>
               </>
             )}
          </div>
        </header>

        {/* Dynamic Body */}
        {currentView === 'dashboard' ? (
           <div className="flex-1 p-6 overflow-hidden flex gap-6">
          
          {/* Left Column: Task Table */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
            
            {/* --- ANALYTICS DASHBOARD --- */}
            <DashboardAnalytics tasks={filteredTasks} projects={projects} users={users} />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-start sm:items-center">
              <div className="relative w-full sm:w-72 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={16} />
                <input 
                  type="text"
                  placeholder="Buscar por projeto ou atividade..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-navy-800 border border-slate-700 text-sm rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                />
              </div>
              
              <div className="flex gap-4 items-center">
                 {/* Scope Toggle */}
                 <div className="bg-navy-800 p-1 rounded-lg border border-slate-700 flex items-center">
                    <button
                      onClick={() => setFilterScope('ALL')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${
                        filterScope === 'ALL' 
                          ? 'bg-slate-700 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <Users size={14} />
                      Todas
                    </button>
                    <button
                      onClick={() => setFilterScope('MINE')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${
                        filterScope === 'MINE' 
                          ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <UserIcon size={14} />
                      Minhas
                    </button>
                 </div>

                 <div className="h-6 w-px bg-slate-800"></div>

                 <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <select 
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-navy-800 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-primary focus:border-primary block pl-9 pr-8 py-2 appearance-none outline-none cursor-pointer hover:bg-navy-700 transition-colors"
                    >
                      <option value="ALL">Todos os Status</option>
                      {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                 </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-navy-800/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 uppercase bg-navy-900/80 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 font-medium">Projeto / Colaborador</th>
                      <th className="px-6 py-4 font-medium">Atividade Planejada</th>
                      <th className="px-6 py-4 font-medium">Prioridade</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Entrega</th>
                      <th className="px-6 py-4 font-medium text-right">Horas</th>
                      <th className="px-6 py-4 font-medium text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <AnimatePresence>
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          Nenhuma atividade encontrada com os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map((task) => {
                        const user = users.find(u => u.id === task.collaboratorId);
                        const isOwner = currentUser.id === task.collaboratorId || currentUser.role === 'admin';
                        const projectName = getProjectName(task.projectId);
                        
                        return (
                          <motion.tr 
                            key={task.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="bg-navy-900/20 hover:bg-white/[0.02] group transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-8 h-8 relative">
                                  <img className="w-8 h-8 rounded-full border border-slate-700" src={user?.avatar} alt="" />
                                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-navy-900 ${user?.id === currentUser.id ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                                </div>
                                <div>
                                  <div className="font-medium text-white">{projectName}</div>
                                  <div className="text-xs text-slate-500">{user?.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <div className="text-slate-300 truncate font-medium">{task.plannedActivity}</div>
                              {task.deliveredActivity && (
                                <div className="text-xs text-emerald-500/80 truncate mt-0.5 flex items-center gap-1">
                                   <CheckCircle2 size={10} /> {task.deliveredActivity}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <Badge type="priority" value={task.priority} />
                            </td>
                            <td className="px-6 py-4">
                              <Badge type="status" value={task.status} />
                            </td>
                            <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                               {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-300">
                              {task.hoursDedicated}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {isOwner && (
                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleEdit(task)} className="p-1.5 hover:bg-blue-500/20 rounded text-blue-400 transition-colors" title="Editar">
                                    <EditIcon size={16} />
                                  </button>
                                  <button onClick={() => handleDuplicate(task)} className="p-1.5 hover:bg-emerald-500/20 rounded text-emerald-400 transition-colors" title="Duplicar">
                                    <Copy size={16} />
                                  </button>
                                  <button onClick={() => handleDelete(task.id)} className="p-1.5 hover:bg-red-500/20 rounded text-red-400 transition-colors" title="Excluir">
                                    <TrashIcon size={16} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-slate-800 bg-navy-900/50 text-xs text-slate-500 flex justify-between items-center">
                 <span>Mostrando {filteredTasks.length} registros</span>
                 <span>Última atualização: {new Date().toLocaleTimeString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Activity Log Widget */}
          <div className="w-80 hidden xl:block">
            <ActivityLogWidget logs={logs} />
          </div>

        </div>
        ) : currentView === 'planning' ? (
           <WeeklyPlanningView tasks={tasks} projects={projects} currentUser={currentUser} />
        ) : (
          <SettingsView sectors={sectors} projects={projects} users={users} />
        )}
      </main>

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        taskToEdit={editingTask}
        initialData={duplicatingTask}
      />
    </div>
  );
}

// Simple Icon Wrappers to avoid "lucide-react" import errors if icons missing in set
const EditIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);

const TrashIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
);