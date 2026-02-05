
export enum Status {
  PENDING = 'Pendente',
  IN_PROGRESS = 'Em Andamento',
  COMPLETED = 'Concluído',
  BLOCKED = 'Bloqueado',
}

export enum Priority {
  LOW = 'Baixa',
  MEDIUM = 'Média',
  HIGH = 'Alta',
  CRITICAL = 'Crítica',
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'user';
  sector: string;
}

export interface Sector {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  sectorId: string;
}

export interface Task {
  id: string;
  projectId: string; // References Project ID now
  collaboratorId: string;
  sector: string; // Read-only in UI, derived from Project -> Sector
  plannedActivity: string;
  deliveredActivity: string;
  priority: Priority;
  status: Status;
  dueDate: string;
  hoursDedicated: string; // Format HH:mm
  notes: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  description: string;
  timestamp: string;
}

export interface DashboardStats {
  totalHours: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
}

export interface SystemSettings {
  logoUrl: string | null;
  faviconUrl: string | null;
}
