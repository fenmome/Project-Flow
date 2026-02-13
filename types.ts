
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export interface WorkSession {
  id: string;
  date: number; // Timestamp
  duration: number; // Minutes
  timeOfDay: string; // 'Morning', 'Afternoon', etc.
  goal?: string; // Intended goal for the session
  output: string; // Tangible artifact produced (e.g. "Drafted 300 words")
  problems?: string; // Current problems/blockers
  nextSteps?: string; // Next actionable steps
  tags: string[]; // "Creation", "Optimization", etc.
  focusScore: number; // 1-5
  satisfactionScore?: number; // 1-5 (New: Emotional/Outcome rating)
  predictedDuration?: number; // Minutes (New: What user thought it would take)
  varianceReasons?: string[]; // (New: Why it deviated, e.g. "Perfectionism")
  notes?: string;
  createdAt: number;
}

export interface Subtask {
  id: string;
  title: string;
  estimatedMinutes: number;
  completedMinutes: number;
  status: TaskStatus;
  notes?: string;
  progress?: number; // 0-100
  startTime?: number; // Timestamp for when the task is scheduled to start/started
  deadline?: number; // Deadline for this specific subtask
  lastUpdated?: number;
  createdAt: number; // Timestamp when task was added
  workLog?: Record<string, number>; // Key: "YYYY-MM-DD", Value: minutes worked
  sessions?: WorkSession[]; // Detailed history of work
  completedAt?: number; // Timestamp when marked done
}

export interface Task {
  id: string;
  title: string; // Acts as a Category/Phase (e.g., "Literature Review")
  notes?: string; // Remarks for the category
  status?: TaskStatus; // Category status
  startTime?: number; // Timestamp start
  deadline?: number; // Deadline for this specific category
  completedAt?: number; // Timestamp when category was marked done
  subtasks: Subtask[];
}

export interface Version {
  id: string;
  title: string; // e.g., "Draft 1", "Final Revision"
  notes?: string;
  startTime?: number; // Timestamp start
  deadline?: number;
  isCollapsed?: boolean; // UI state
  tasks: Task[]; // Tasks now live inside Versions
}

export interface Folder {
  id: string;
  name: string;
  isDefault?: boolean; // e.g., Thesis vs Tech
}

export interface ProjectTodo {
  id: string;
  text: string;
  done: boolean;
  linkedRef?: {
      versionId: string;
      taskId: string;
      subtaskId: string;
  };
}

export interface DailyTask {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD
  timeOfDay?: string; // Morning, Noon, etc.
  completed: boolean;
  abandoned?: boolean;
  abandonNote?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  versions: Version[]; // New Hierarchy Layer
  tasks?: Task[]; // Deprecated, kept for migration
  todoList?: ProjectTodo[]; // Quick access todo list
  createdAt: number;
  deadline?: number;
  dailyWorkMinutes?: number; // How many minutes user plans to work per day
  folderId?: string; // ID of the folder this project belongs to
  isArchived?: boolean; // Whether the project is archived
}

export interface MoodEntry {
  id: string;
  timestamp: number;
  mood: string; // 'Happy', 'Anxious', etc.
  note?: string;
}

export interface WishlistAnnotation {
  id: string;
  content: string;
  timestamp: number;
}

// --- Grid Feature Types ---
export interface GridConfig {
    rows: string[];
    cols: string[];
}

export interface GridSnapshot {
    id: string;
    timestamp: number;
    data: Record<string, string>; // Key: "rowIdx-colIdx"
    config?: GridConfig; // Store structure at time of snapshot
}

export interface WishlistGridFeature {
    isEnabled: boolean;
    config: GridConfig;
    currentData: Record<string, string>;
    history: GridSnapshot[];
    lastUpdated?: number;
}

export type WishlistDeadlineType = 'date' | 'month' | 'year' | 'long-term';

export interface WishlistItem {
  id: string;
  text: string;
  createdAt: number;
  startTime?: number;
  endTime?: number;
  deadlineType?: WishlistDeadlineType; // New: To track granularity
  tags: string[]; // New: Categorization
  status: 'todo' | 'done';
  annotations: WishlistAnnotation[];
  gridFeature?: WishlistGridFeature; // New: Tracking Grid
}

export interface TemplateStructure {
  title: string; // Task Category title
  subtasks: { title: string; estimatedMinutes: number }[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  structure: TemplateStructure[];
  isBuiltin?: boolean;
}

export interface BackupData {
  id: string;
  name: string;
  timestamp: number;
  data: {
    projects: Project[];
    folders: Folder[];
    dailyTasks: DailyTask[];
    moods: MoodEntry[];
    wishlist?: WishlistItem[];
  };
}
