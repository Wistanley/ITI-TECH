
import { supabase } from '../lib/supabaseClient';
import { Task, User, ActivityLog, Status, Priority, Sector, Project, SystemSettings, BoardTask, BoardStatus, Subtask, ChatMessage, ChatState } from '../types';
import { GoogleGenAI } from "@google/genai";

class SupabaseService {
  private tasks: Task[] = [];
  private sectors: Sector[] = [];
  private projects: Project[] = [];
  private users: User[] = [];
  private logs: ActivityLog[] = [];
  
  // Chat Data
  private chatMessages: ChatMessage[] = [];
  private chatState: ChatState = { isLocked: false, lockedByUserId: null, updatedAt: new Date().toISOString() };

  // New Cache for Board Tasks
  private boardTasks: BoardTask[] = [];

  private listeners: Array<() => void> = [];
  
  // Global System Settings
  public settings: SystemSettings = { logoUrl: null, faviconUrl: null };

  public currentUser: User | null = null;
  private initialized = false;

  // Gemini Client
  private ai: GoogleGenAI | null = null;

  constructor() {
    // Initialize Gemini
    // NOTE: In a real prod environment, keep the API key safe. 
    // Since this is a request to integrate based on provided env rules:
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn("Gemini API Key missing. Chat features will be disabled.");
    }
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
    this.boardTasks = [];
    this.logs = [];
    this.sectors = [];
    this.projects = [];
    this.users = [];
    this.chatMessages = [];
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

  async uploadAvatar(userId: string, file: File): Promise<string> {
    // 1. Sanitize and Create Path
    const fileExt = file.name.split('.').pop() || 'jpg';
    // Remove special chars to avoid storage issues
    const fileName = `avatars/${userId}_${Date.now()}.${fileExt}`;

    // 2. Upload to 'images' bucket
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true // Allow overwriting to prevent errors on retries
      });

    if (uploadError) {
      console.error("Upload Error Details:", uploadError);
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }

    // 3. Get Public URL
    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  // --- System Assets Management (Logo/Favicon) ---
  async uploadSystemAsset(file: File, type: 'logo' | 'favicon'): Promise<string> {
    let fileName = '';
    if (type === 'logo') {
        fileName = 'system/app_logo.png'; 
    } else {
        fileName = 'system/app_favicon.png';
    }

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, file, {
        cacheControl: '0', // No cache for system assets to ensure update
        upsert: true
      });

    if (uploadError) {
       throw new Error(`Erro no upload do ${type}: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    if (type === 'logo') this.settings.logoUrl = publicUrl;
    if (type === 'favicon') this.settings.faviconUrl = publicUrl;

    this.notify();
    
    return publicUrl;
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
      this.fetchBoardTasks(), 
      this.fetchChatMessages(), // NEW
      this.fetchChatState(), // NEW
      this.fetchLogs(),
      this.fetchSystemSettings()
    ]);

    this.initialized = true;
    this.notify();

    // 2. Setup Realtime Subscription
    supabase.channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => this.fetchTasks().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_tasks' }, () => this.fetchBoardTasks().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => this.fetchLogs().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => this.fetchProjects().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sectors' }, () => this.fetchSectors().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => this.fetchUsers().then(() => this.notify()))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => this.fetchChatMessages().then(() => this.notify())) // NEW
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_state' }, () => this.fetchChatState().then(() => this.notify())) // NEW
      .subscribe();
  }

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    if (this.initialized) callback();
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // --- Fetchers ---
  private async fetchTasks() {
    const { data } = await supabase.from('tasks').select('*').order('updated_at', { ascending: false });
    if (data) this.tasks = data.map(this.mapDbToTask);
  }

  private async fetchBoardTasks() {
    const { data } = await supabase.from('board_tasks').select('*').order('updated_at', { ascending: false });
    if (data) this.boardTasks = data.map(this.mapDbToBoardTask);
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

  // Chat Fetchers
  private async fetchChatMessages() {
      // Fetch latest 50 messages
      const { data } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(50);
      if (data) {
          this.chatMessages = data.map(msg => ({
              id: msg.id,
              userId: msg.user_id,
              role: msg.role,
              content: msg.content,
              createdAt: msg.created_at,
              user: this.users.find(u => u.id === msg.user_id) // Hydrate user
          }));
      }
  }

  private async fetchChatState() {
      const { data } = await supabase.from('chat_state').select('*').eq('id', 1).single();
      if (data) {
          this.chatState = {
              isLocked: data.is_locked,
              lockedByUserId: data.locked_by_user_id,
              updatedAt: data.updated_at
          };
      }
  }

  private async fetchSystemSettings() {
      const { data: logoData } = supabase.storage.from('images').getPublicUrl('system/app_logo.png');
      const { data: faviconData } = supabase.storage.from('images').getPublicUrl('system/app_favicon.png');
      
      this.settings.logoUrl = `${logoData.publicUrl}?t=${new Date().getTime()}`;
      this.settings.faviconUrl = `${faviconData.publicUrl}?t=${new Date().getTime()}`;
  }


  // --- Getters ---
  getTasks() { return this.tasks; }
  getBoardTasks() { return this.boardTasks; }
  getSectors() { return this.sectors; }
  getProjects() { return this.projects; }
  getUsers() { return this.users; }
  getLogs() { return this.logs; }
  getSettings() { return this.settings; }
  getChatMessages() { return this.chatMessages; }
  getChatState() { return this.chatState; }

  // --- Chat Actions ---
  
  async sendChatMessage(content: string) {
      if (!this.currentUser) return;
      if (!this.ai) {
        throw new Error("Chat indisponível: API Key não configurada.");
      }
      
      // 1. Try to acquire Lock (Optimistic UI handled by component, but DB enforces truth)
      // Check current lock
      if (this.chatState.isLocked) throw new Error("O chat está bloqueado por outro usuário.");

      try {
          // Lock the chat in DB
          await supabase.from('chat_state').update({
              is_locked: true,
              locked_by_user_id: this.currentUser.id,
              updated_at: new Date().toISOString()
          }).eq('id', 1);
          
          // Insert User Message
          await supabase.from('chat_messages').insert({
              user_id: this.currentUser.id,
              role: 'user',
              content: content
          });

          // PREPARE CONTEXT FOR GEMINI
          // Fetch updated history or use local + current message
          // We need to format the history so Gemini knows WHO said WHAT.
          // Gemini doesn't strictly support multi-user roles in the API schema yet (only user/model),
          // so we simulate it by prepending names in the 'user' content.
          const historyLimit = 10;
          const contextMessages = this.chatMessages.slice(-historyLimit);
          
          let historyPrompt = "Histórico da conversa:\n";
          contextMessages.forEach(msg => {
              const name = msg.user ? msg.user.name : "Gemini AI";
              historyPrompt += `${name}: ${msg.content}\n`;
          });
          
          // Current Prompt with User Identity
          const currentPrompt = `O usuário ${this.currentUser.name} disse: ${content}`;

          // CALL GEMINI
          const response = await this.ai.models.generateContent({
              model: 'gemini-2.5-flash-latest', // Fast model for chat
              contents: [
                {
                    role: 'user',
                    parts: [{ text: historyPrompt + "\n" + currentPrompt }]
                }
              ],
              config: {
                 systemInstruction: "Você é um assistente de IA colaborativo da equipe ITI TECH. Você está em um chat de grupo. Responda de forma concisa, profissional e útil. Identifique a quem você está respondendo se houver ambiguidade. O contexto da conversa anterior foi fornecido.",
              }
          });

          const aiResponseText = response.text;

          // Insert AI Message
          await supabase.from('chat_messages').insert({
              user_id: null,
              role: 'model',
              content: aiResponseText
          });

      } catch (err: any) {
          console.error("Chat Error:", err);
          // Insert Error Message as AI response just to release lock gracefully visually
          await supabase.from('chat_messages').insert({
              user_id: null,
              role: 'model',
              content: "Desculpe, ocorreu um erro ao processar sua solicitação com a IA."
          });
      } finally {
          // Unlock the chat regardless of success/fail
          await supabase.from('chat_state').update({
              is_locked: false,
              locked_by_user_id: null,
              updated_at: new Date().toISOString()
          }).eq('id', 1);
      }
  }


  // --- Actions ---
  
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
    
    await this.fetchTasks();
    this.notify();
    await this.logAction('CREATE', `Nova atividade: ${task.plannedActivity}`);
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
    
    await this.fetchTasks();
    this.notify();
    await this.logAction('UPDATE', `Atividade atualizada`);
  }

  async toggleTaskCompletion(id: string) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    
    const newStatus = task.status === Status.COMPLETED ? Status.PENDING : Status.COMPLETED;
    const newDelivered = newStatus === Status.COMPLETED && !task.deliveredActivity 
       ? task.plannedActivity 
       : task.deliveredActivity;

    await this.updateTask(id, { status: newStatus, deliveredActivity: newDelivered });
  }

  async deleteTask(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir tarefa: ${error.message}`);
    
    await this.fetchTasks();
    this.notify();
    await this.logAction('DELETE', 'Atividade removida');
  }

  // --- NEW ACTIONS FOR BOARD TASKS ---
  async createBoardTask(task: Omit<BoardTask, 'id' | 'updatedAt'>) {
    const dbTask = {
       title: task.title,
       description: task.description,
       start_date: task.startDate,
       end_date: task.endDate,
       member_ids: task.memberIds, // JSONB or Array in Supabase
       subtasks: task.subtasks,    // JSONB in Supabase
       status: task.status,
       updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('board_tasks').insert(dbTask);
    if (error) throw new Error(`Erro ao criar tarefa do quadro: ${error.message}`);
    
    await this.fetchBoardTasks();
    this.notify();
    await this.logAction('CREATE', `Novo quadro: ${task.title}`);
  }

  async updateBoardTask(id: string, updates: Partial<BoardTask>) {
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.startDate) dbUpdates.start_date = updates.startDate;
    if (updates.endDate) dbUpdates.end_date = updates.endDate;
    if (updates.memberIds) dbUpdates.member_ids = updates.memberIds;
    if (updates.subtasks) dbUpdates.subtasks = updates.subtasks;
    if (updates.status) dbUpdates.status = updates.status;

    const { error } = await supabase.from('board_tasks').update(dbUpdates).eq('id', id);
    if (error) throw new Error(`Erro ao atualizar quadro: ${error.message}`);

    await this.fetchBoardTasks();
    this.notify();
  }

  async deleteBoardTask(id: string) {
     const { error } = await supabase.from('board_tasks').delete().eq('id', id);
     if (error) throw new Error(`Erro ao excluir tarefa do quadro: ${error.message}`);
     
     await this.fetchBoardTasks();
     this.notify();
     await this.logAction('DELETE', 'Tarefa do quadro removida');
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
    await this.fetchLogs();
    this.notify();
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
  
  // NEW Mapper
  private mapDbToBoardTask(db: any): BoardTask {
      return {
          id: db.id,
          title: db.title,
          description: db.description,
          startDate: db.start_date,
          endDate: db.end_date,
          memberIds: db.member_ids || [], // Ensure array
          status: db.status as BoardStatus,
          subtasks: db.subtasks || [],    // Ensure array
          updatedAt: db.updated_at
      }
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
