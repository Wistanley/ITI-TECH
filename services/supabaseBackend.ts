
import { supabase } from '../lib/supabaseClient';
import { Task, User, ActivityLog, Status, Priority, Sector, Project } from '../types';

class SupabaseService {
  private tasks: Task[] = [];
  private sectors: Sector[] = [];
  private projects: Project[] = [];
  private users: User[] = [];
  private logs: ActivityLog[] = [];
  private listeners: Array<() => void> = [];
  
  public currentUser: User | null = null;
  private initialized = false;

  constructor() {
    // Não inicializamos no construtor para evitar efeitos colaterais antes do auth
  }

  // --- Auth Wrapper ---
  async authenticate(email: string, password: string): Promise<{ user: User | null, error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { user: null, error: error.message };
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
      if (profile) {
        this.currentUser = this.mapProfileToUser(profile);
        await this.initializeData(); // Carregar dados iniciais
        return { user: this.currentUser, error: null };
      }
    }
    return { user: null, error: 'Perfil de usuário não encontrado.' };
  }

  async checkSession(): Promise<User | null> {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (profile) {
        this.currentUser = this.mapProfileToUser(profile);
        await this.initializeData();
        return this.currentUser;
      }
    }
    return null;
  }

  async logout() {
    await supabase.auth.signOut();
    this.currentUser = null;
    this.tasks = [];
    this.logs = [];
    this.sectors = [];
    this.projects = [];
    this.users = [];
    this.initialized = false;
    this.notify();
  }

  // --- Profile Management ---
  async updateProfile(id: string, updates: Partial<User>) {
    const dbUpdates: any = { };
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.avatar) dbUpdates.avatar = updates.avatar;
    if (updates.sector) dbUpdates.sector = updates.sector;

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', id);
    
    if (error) throw new Error(error.message);

    // Update Local State
    if (this.currentUser && this.currentUser.id === id) {
        this.currentUser = { ...this.currentUser, ...updates };
    }
    
    await this.fetchUsers(); // Refresh all users list
    this.notify();
  }

  async changePassword(oldPassword: string, newPassword: string) {
     if (!this.currentUser) throw new Error("Usuário não autenticado.");

     // 1. Verify Old Password by trying to Sign In (Re-auth)
     const { error: signInError } = await supabase.auth.signInWithPassword({
        email: this.currentUser.email,
        password: oldPassword
     });

     if (signInError) {
        throw new Error("A senha atual está incorreta.");
     }

     // 2. Update Password
     const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

     if (updateError) {
        throw new Error(updateError.message);
     }
  }

  // --- Initialization & Realtime ---
  async initializeData() {
    if (this.initialized) return;

    // 1. Fetch Initial Data in Parallel
    await Promise.all([
      this.fetchUsers(),
      this.fetchSectors(),
      this.fetchProjects(),
      this.fetchTasks(),
      this.fetchLogs(),
    ]);

    this.initialized = true;
    this.notify();

    // 2. Setup Realtime Subscription
    supabase.channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => this.fetchTasks().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => this.fetchLogs().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => this.fetchProjects().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sectors' }, () => this.fetchSectors().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => this.fetchUsers().then(() => this.notify()))
      .subscribe();
  }

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    // Se já tiver dados, notifica imediatamente
    if (this.initialized) callback();
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // --- Fetchers (Atualizam o Cache Local) ---
  private async fetchTasks() {
    const { data } = await supabase.from('tasks').select('*').order('updated_at', { ascending: false });
    if (data) this.tasks = data.map(this.mapDbToTask);
  }
  
  private async fetchSectors() {
    const { data } = await supabase.from('sectors').select('*');
    if (data) this.sectors = data;
  }

  private async fetchProjects() {
    const { data } = await supabase.from('projects').select('*');
    if (data) this.projects = data.map((p: any) => ({ id: p.id, name: p.name, sectorId: p.sector_id }));
  }

  private async fetchUsers() {
    const { data } = await supabase.from('profiles').select('*');
    if (data) this.users = data.map(this.mapProfileToUser);
  }

  private async fetchLogs() {
    const { data } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(20);
    if (data) this.logs = data.map((l: any) => ({
      id: l.id, userId: l.user_id, action: l.action, description: l.description, timestamp: l.timestamp
    }));
  }

  // --- Getters (Síncronos, leem do cache) ---
  getTasks() { return this.tasks; }
  getSectors() { return this.sectors; }
  getProjects() { return this.projects; }
  getUsers() { return this.users; }
  getLogs() { return this.logs; }

  // --- Actions (Assíncronos no banco) ---
  
  // TASKS
  async createTask(task: Omit<Task, 'id' | 'updatedAt'>) {
    const dbTask = {
      project_id: task.projectId,
      collaborator_id: task.collaboratorId,
      sector: task.sector,
      planned_activity: task.plannedActivity,
      delivered_activity: task.deliveredActivity,
      priority: task.priority,
      status: task.status,
      due_date: task.dueDate,
      hours_dedicated: task.hoursDedicated,
      notes: task.notes,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase.from('tasks').insert(dbTask);
    if (error) throw new Error(`Erro ao criar tarefa: ${error.message}`);
    
    this.logAction('CREATE', `Nova tarefa: ${task.plannedActivity}`);
  }

  async updateTask(id: string, updates: Partial<Task>) {
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.projectId) dbUpdates.project_id = updates.projectId;
    if (updates.collaboratorId) dbUpdates.collaborator_id = updates.collaboratorId;
    if (updates.plannedActivity) dbUpdates.planned_activity = updates.plannedActivity;
    if (updates.deliveredActivity) dbUpdates.delivered_activity = updates.deliveredActivity;
    if (updates.hoursDedicated) dbUpdates.hours_dedicated = updates.hoursDedicated;
    if (updates.dueDate) dbUpdates.due_date = updates.dueDate;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.priority) dbUpdates.priority = updates.priority;
    if (updates.notes) dbUpdates.notes = updates.notes;

    const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', id);
    if (error) throw new Error(`Erro ao atualizar tarefa: ${error.message}`);
    
    this.logAction('UPDATE', `Tarefa atualizada`);
  }

  async toggleTaskCompletion(id: string) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    
    const newStatus = task.status === Status.COMPLETED ? Status.PENDING : Status.COMPLETED;
    // Se completar e não tiver entrega, copia o planejado
    const newDelivered = newStatus === Status.COMPLETED && !task.deliveredActivity 
       ? task.plannedActivity 
       : task.deliveredActivity;

    await this.updateTask(id, { status: newStatus, deliveredActivity: newDelivered });
  }

  async deleteTask(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir tarefa: ${error.message}`);
    this.logAction('DELETE', 'Tarefa removida');
  }

  // SECTORS & PROJECTS
  async createSector(name: string) {
    const { error } = await supabase.from('sectors').insert({ name });
    if (error) throw error;
    await this.fetchSectors();
    this.notify();
  }

  async deleteSector(id: string) {
    const { error } = await supabase.from('sectors').delete().eq('id', id);
    if (error) throw new Error("Não é possível excluir este setor. Verifique se existem projetos vinculados a ele.");
    await this.fetchSectors();
    this.notify();
  }

  async createProject(name: string, sectorId: string) {
    const { error } = await supabase.from('projects').insert({ name, sector_id: sectorId });
    if (error) throw error;
    await this.fetchProjects();
    this.notify();
  }

  async deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error("Não é possível excluir este projeto. Verifique se existem tarefas vinculadas a ele.");
    await this.fetchProjects();
    this.notify();
  }

  // USERS
  async createUser(name: string, email: string, role: 'admin'|'user', sector: string) {
    const { error } = await supabase.from('profiles').insert({
       id: crypto.randomUUID(), 
       email, name, role, sector, avatar: `https://ui-avatars.com/api/?name=${name}`
    });
    if (error) throw error;
    await this.fetchUsers();
    this.notify();
  }

  async deleteUser(id: string) {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw new Error("Não é possível excluir este usuário. Verifique se ele possui tarefas atribuídas.");
    await this.fetchUsers();
    this.notify();
  }

  // --- Helpers ---
  private async logAction(action: string, description: string) {
    if (!this.currentUser) return;
    await supabase.from('activity_logs').insert({
      user_id: this.currentUser.id,
      action,
      description,
      timestamp: new Date().toISOString()
    });
  }

  calculateTotalHours(collaboratorId?: string): string {
    let totalMinutes = 0;
    const targetTasks = collaboratorId 
      ? this.tasks.filter(t => t.collaboratorId === collaboratorId)
      : this.tasks;

    targetTasks.forEach(task => {
      if (!task.hoursDedicated) return;
      const [h, m] = task.hoursDedicated.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        totalMinutes += (h * 60) + m;
      }
    });

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // Mappers
  private mapDbToTask(db: any): Task {
    return {
      id: db.id,
      projectId: db.project_id,
      collaboratorId: db.collaborator_id,
      sector: db.sector,
      plannedActivity: db.planned_activity,
      deliveredActivity: db.delivered_activity,
      priority: db.priority as Priority,
      status: db.status as Status,
      dueDate: db.due_date,
      hoursDedicated: db.hours_dedicated,
      notes: db.notes,
      updatedAt: db.updated_at
    };
  }

  private mapProfileToUser(p: any): User {
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      avatar: p.avatar || '',
      role: p.role as 'admin' | 'user',
      sector: p.sector
    };
  }
}

export const backend = new SupabaseService();
