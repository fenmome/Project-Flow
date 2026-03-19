
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Clock, CheckCircle2, ChevronLeft, ListTodo, Timer as TimerIcon, FolderPlus, Trash2, ChevronDown, ChevronUp, FileText, CalendarClock, Download, Upload, AlertTriangle, Sparkles, TrendingUp, GraduationCap, X, BarChart3, Pencil, Circle, Save, RotateCcw, ArrowUp, ArrowDown, GripVertical, Calendar, ArrowRight, ClipboardList, Archive, ArchiveRestore, Layers, FolderOpen, Edit2, Smile, CheckSquare, Link, Database, RefreshCw, Gift } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { Project, Task, Subtask, TaskStatus, Version, WorkSession, Folder as FolderType, MoodEntry, ProjectTodo, DailyTask, WishlistItem } from './types';
import { NewProjectModal } from './components/NewProjectModal';
import { AIPlannerModal } from './components/AIPlannerModal';
import { TimeChart } from './components/TimeChart';
import { Timeline } from './components/Timeline';
import { TaskHeatmap } from './components/TaskHeatmap';
import { WorkSessionModal } from './components/WorkSessionModal';
import { MoodTrackerModal } from './components/MoodTrackerModal';
import { WorkLogCalendarModal } from './components/WorkLogCalendarModal';
import { DailyTimelinePanel } from './components/DailyTimelinePanel';
import { WishlistModal } from './components/WishlistModal';
import { CompletedTimelineModal } from './components/CompletedTimelineModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';

// Tauri Imports
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';

interface NewSubtaskInput {
  versionId: string;
  taskId: string;
  title: string;
}

// Helper for Drag and Drop types
type DragType = 'VERSION' | 'TASK' | 'SUBTASK' | 'PROJECT_TODO';
interface DragSource {
  type: DragType;
  index: number;
  parentId?: string; // For Task (VersionId) or Subtask (TaskId)
  grandParentId?: string; // For Subtask (VersionId)
}

const App: React.FC = () => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<string>('all'); // 'all', 'archived', or folderId
  
  // Daily Tasks State
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);

  // Wishlist State
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  // Mood Tracker State
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);

  // Calendar & Timeline Modal States
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isCompletedTimelineOpen, setIsCompletedTimelineOpen] = useState(false);

  // Auto Save State
  const [autoSavePath, setAutoSavePath] = useState<string | null>(localStorage.getItem('thesisflow_autosave_path'));
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Web FS State (for browser fallback)
  const [webDirHandle, setWebDirHandle] = useState<any>(null);
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isNewFolderInputOpen, setIsNewFolderInputOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Folder Editing State
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [tempFolderName, setTempFolderName] = useState('');

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Subtask Detail Modal State
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    versionId: string;
    taskId: string;
    subtaskId: string;
  } | null>(null);

  // Work Session Modal State
  const [sessionModal, setSessionModal] = useState<{
    isOpen: boolean;
    versionId: string;
    taskId: string;
    subtaskId: string;
    initialDuration?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Subtask Input State
  const [newSubtaskInput, setNewSubtaskInput] = useState<NewSubtaskInput | null>(null);
  
  // New Project Todo Input State
  const [newProjectTodoText, setNewProjectTodoText] = useState('');

  // State for expanded notes sections (Subtasks)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // State for expanded notes sections (Categories/Tasks)
  const [expandedTaskNotes, setExpandedTaskNotes] = useState<Set<string>>(new Set());
  
  // State for expanded notes (Version)
  const [expandedVersionNotes, setExpandedVersionNotes] = useState<Set<string>>(new Set());

  // State for editing Titles (Task, Version, Subtask)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState("");

  // State for editing task Start/Deadline
  const [editingDateId, setEditingDateId] = useState<{ id: string, type: 'start' | 'end' } | null>(null);

  // State for editing Project Details
  const [isEditingProjectDesc, setIsEditingProjectDesc] = useState(false);
  const [isEditingProjectDDL, setIsEditingProjectDDL] = useState(false);
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  
  // State for creating new items (Replacing prompts)
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [newVersionTitle, setNewVersionTitle] = useState("");
  const [creatingTaskInVersionId, setCreatingTaskInVersionId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // State for Drag and Drop
  const dragItem = useRef<DragSource | null>(null);
  const [dragSourceState, setDragSourceState] = useState<DragSource | null>(null);

  // State for global time
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Detect Tauri Environment safely
  useEffect(() => {
    try {
      // @ts-ignore
      const isTauri = typeof window !== 'undefined' && (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);
      setIsTauriEnv(isTauri);
    } catch (e) {
      console.warn("Tauri detection failed, defaulting to web.", e);
      setIsTauriEnv(false);
    }
  }, []);

  // Load from local storage with MIGRATION LOGIC
  useEffect(() => {
    // Load Projects
    const savedProjects = localStorage.getItem('thesisflow_projects');
    if (savedProjects) {
      try {
        const loaded: Project[] = JSON.parse(savedProjects);
        // Migration: Check if versions exist, if not, create default version from tasks
        const migrated = loaded.map((p: any) => {
          let project = { ...p };
          if (!project.versions || project.versions.length === 0) {
            project = {
              ...project,
              versions: [
                 {
                   id: `v-default-${p.id}`,
                   title: 'Version 1.0',
                   isCollapsed: false,
                   startTime: p.createdAt, // Migrate start time
                   tasks: p.tasks || []
                 }
              ],
              tasks: undefined // Clean up old field
            };
          }
          // Ensure sessions array exists for all subtasks
          project.versions.forEach((v: any) => {
             v.tasks.forEach((t: any) => {
                t.subtasks.forEach((s: any) => {
                   if (!s.sessions) s.sessions = [];
                });
             });
          });
          // Ensure archive/folder props
          if (project.isArchived === undefined) project.isArchived = false;
          // Ensure todoList exists
          if (!project.todoList) project.todoList = [];
          return project as Project;
        });
        setProjects(migrated);
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }

    // Load Folders
    const savedFolders = localStorage.getItem('thesisflow_folders');
    if (savedFolders) {
        try {
            setFolders(JSON.parse(savedFolders));
        } catch(e) { console.error(e); }
    } else {
        // Default folders
        const defaults = [
            { id: 'f-thesis', name: 'Thesis Projects', isDefault: true },
            { id: 'f-tech', name: 'Tech Projects', isDefault: true }
        ];
        setFolders(defaults);
        localStorage.setItem('thesisflow_folders', JSON.stringify(defaults));
    }

    // Load Moods
    const savedMoods = localStorage.getItem('thesisflow_moods');
    if (savedMoods) {
        try {
            setMoods(JSON.parse(savedMoods));
        } catch(e) { console.error(e); }
    }

    // Load Daily Tasks
    const savedDailyTasks = localStorage.getItem('thesisflow_daily_tasks');
    if (savedDailyTasks) {
        try {
            setDailyTasks(JSON.parse(savedDailyTasks));
        } catch(e) { console.error(e); }
    }

    // Load Wishlist
    const savedWishlist = localStorage.getItem('thesisflow_wishlist');
    if (savedWishlist) {
        try {
            const parsed = JSON.parse(savedWishlist);
            const migrated = parsed.map((item: any) => ({
                ...item,
                tags: item.tags || []
            }));
            setWishlist(migrated);
        } catch(e) { console.error(e); }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('thesisflow_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('thesisflow_folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('thesisflow_moods', JSON.stringify(moods));
  }, [moods]);

  useEffect(() => {
    localStorage.setItem('thesisflow_daily_tasks', JSON.stringify(dailyTasks));
  }, [dailyTasks]);

  useEffect(() => {
    localStorage.setItem('thesisflow_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // AUTO SAVE LOGIC (Supports both Desktop and Web)
  useEffect(() => {
    if (!autoSavePath && !webDirHandle) return;

    const saveData = async () => {
        setIsAutoSaving(true);
        try {
            const data = {
                projects,
                folders,
                dailyTasks,
                moods,
                wishlist,
                version: "1.0",
                exportDate: Date.now()
            };
            const jsonString = JSON.stringify(data, null, 2);

            let success = false;

            if (isTauriEnv && autoSavePath) {
                // Desktop Mode: Use Tauri FS
                try {
                    const sep = navigator.userAgent.indexOf("Win") !== -1 ? "\\" : "/";
                    const path = `${autoSavePath}${sep}thesisflow_autosave.json`;
                    await writeTextFile(path, jsonString);
                    success = true;
                } catch (err) {
                    console.warn("Tauri write failed, falling back...", err);
                }
            } 
            
            if (!success && webDirHandle) {
                // Web Mode: Use File System Access API
                // @ts-ignore
                const fileHandle = await webDirHandle.getFileHandle('thesisflow_autosave.json', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(jsonString);
                await writable.close();
            }
            
            setLastSaved(new Date());
        } catch (e) {
            console.error("Auto save error:", e);
        } finally {
            setIsAutoSaving(false);
        }
    };

    // Debounce save (2 seconds)
    const timer = setTimeout(saveData, 2000);
    return () => clearTimeout(timer);
  }, [projects, folders, dailyTasks, moods, wishlist, autoSavePath, webDirHandle, isTauriEnv]);

  const handleSetAutoSave = async () => {
      let tauriSuccess = false;
      
      if (isTauriEnv) {
          // Desktop: Attempt Tauri Dialog
          try {
              const selected = await open({
                  directory: true,
                  multiple: false,
                  title: "Select Auto-Save Folder"
              });
              if (selected && typeof selected === 'string') {
                  setAutoSavePath(selected);
                  localStorage.setItem('thesisflow_autosave_path', selected);
                  tauriSuccess = true;
              }
          } catch (e) {
              console.warn("Tauri dialog encountered an error, falling back to web picker.", e);
              // Fallback to web picker below
          }
      } 
      
      if (!tauriSuccess) {
          // Web: Use Browser FS API
          try {
              if ('showDirectoryPicker' in window) {
                  // @ts-ignore
                  const handle = await window.showDirectoryPicker();
                  if (handle) {
                      setWebDirHandle(handle);
                      // Note: Handles cannot be stored in localStorage comfortably
                  }
              } else {
                  alert("Your browser does not support local folder access. Please use Chrome, Edge, or the Desktop App.");
              }
          } catch (e) {
              console.log("Web picker cancelled or failed", e);
          }
      }
  };

  // Global Clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- DAILY TASK HELPERS ---
  const handleAddDailyTask = (text: string, date: string, timeOfDay?: string) => {
      const newTask: DailyTask = {
          id: `dt-${Date.now()}`,
          text,
          date,
          timeOfDay,
          completed: false,
          createdAt: Date.now(),
      };
      setDailyTasks(prev => [...prev, newTask]);
  };

  const handleToggleDailyTask = (taskId: string) => {
      setDailyTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t;
          
          if (t.abandoned) {
              // Reset from Abandoned to Todo
              return { ...t, completed: false, abandoned: false, abandonNote: undefined };
          }
          
          // Toggle Completed
          return { ...t, completed: !t.completed, abandoned: false };
      }));
  };

  const handleUpdateDailyTask = (taskId: string, text: string) => {
      setDailyTasks(prev => prev.map(t => t.id === taskId ? { ...t, text } : t));
  };

  const handleAbandonDailyTask = (taskId: string, note: string) => {
      setDailyTasks(prev => prev.map(t => t.id === taskId ? { ...t, abandoned: true, abandonNote: note, completed: false } : t));
  };

  const handleDeleteDailyTask = (taskId: string) => {
      setDailyTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // --- WISHLIST HELPERS ---
  const handleAddWishlistItem = (text: string) => {
      const newItem: WishlistItem = {
          id: `wl-${Date.now()}`,
          text,
          createdAt: Date.now(),
          status: 'todo',
          tags: [],
          annotations: []
      };
      setWishlist(prev => [newItem, ...prev]);
  };

  const handleUpdateWishlistItem = (id: string, updates: Partial<WishlistItem>) => {
      setWishlist(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleDeleteWishlistItem = (id: string) => {
      requestConfirm("Delete Item", "Are you sure you want to remove this item from your wishlist?", () => {
          setWishlist(prev => prev.filter(item => item.id !== id));
      });
  };

  // --- PROJECT TODO LIST HELPERS ---
  const handleAddProjectTodo = () => {
      if (!activeProjectId || !newProjectTodoText.trim()) return;
      const newTodo: ProjectTodo = {
          id: `pt-${Date.now()}`,
          text: newProjectTodoText.trim(),
          done: false
      };
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return { ...p, todoList: [newTodo, ...(p.todoList || [])] };
      }));
      setNewProjectTodoText('');
  };

  const handleAddSubtaskToTodo = (versionId: string, taskId: string, subtask: Subtask) => {
      if (!activeProjectId) return;
      
      const project = projects.find(p => p.id === activeProjectId);
      if (!project) return;

      // Check for duplicates
      if (project.todoList?.some(t => t.linkedRef?.subtaskId === subtask.id)) {
          return; // Already linked
      }

      const newTodo: ProjectTodo = {
          id: `pt-link-${subtask.id}`,
          text: subtask.title,
          done: subtask.status === TaskStatus.DONE,
          linkedRef: {
              versionId,
              taskId,
              subtaskId: subtask.id
          }
      };

      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return { ...p, todoList: [newTodo, ...(p.todoList || [])] };
      }));
  };

  const toggleProjectTodo = (todo: ProjectTodo) => {
      if (!activeProjectId) return;

      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          
          let updatedTodoList = (p.todoList || []).map(t => t.id === todo.id ? { ...t, done: !t.done } : t);
          let updatedVersions = p.versions;

          // If linked, sync the actual subtask status
          if (todo.linkedRef) {
              const { versionId, taskId, subtaskId } = todo.linkedRef;
              const newStatus = !todo.done ? TaskStatus.DONE : TaskStatus.TODO; // Toggle status
              
              updatedVersions = p.versions.map(v => {
                  if (v.id !== versionId) return v;
                  return {
                      ...v,
                      tasks: v.tasks.map(t => {
                          if (t.id !== taskId) return t;
                          return {
                              ...t,
                              subtasks: t.subtasks.map(s => {
                                  if (s.id !== subtaskId) return s;
                                  let newSubtask = { 
                                      ...s, 
                                      status: newStatus, 
                                      lastUpdated: Date.now() 
                                  };
                                  if (newStatus === TaskStatus.DONE) {
                                      newSubtask.progress = 100;
                                      newSubtask.completedAt = Date.now();
                                  } else {
                                      newSubtask.progress = s.completedMinutes > 0 ? 50 : 0;
                                      newSubtask.completedAt = undefined;
                                  }
                                  return newSubtask;
                              })
                          };
                      })
                  };
              });
          }

          return {
              ...p,
              todoList: updatedTodoList,
              versions: updatedVersions
          };
      }));
  };

  const deleteProjectTodo = (todoId: string) => {
      if (!activeProjectId) return;
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return {
              ...p,
              todoList: (p.todoList || []).filter(t => t.id !== todoId)
          };
      }));
  };

  const moveProjectTodo = (projectId: string, fromIndex: number, toIndex: number) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              todoList: reorderItem(p.todoList || [], fromIndex, toIndex)
          };
      }));
  };

  // --- FOLDER & PROJECT MGMT HELPERS ---

  const handleCreateFolder = () => {
      if (!newFolderName.trim()) return;
      const newFolder: FolderType = {
          id: `f-${Date.now()}`,
          name: newFolderName,
      };
      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setIsNewFolderInputOpen(false);
  };

  const handleRenameFolder = () => {
      if (!tempFolderName.trim() || !editingFolderId) {
          setEditingFolderId(null);
          return;
      }
      setFolders(prev => prev.map(f => f.id === editingFolderId ? { ...f, name: tempFolderName } : f));
      setEditingFolderId(null);
      setTempFolderName('');
  };

  const startEditingFolder = (e: React.MouseEvent, folder: FolderType) => {
      e.stopPropagation();
      setEditingFolderId(folder.id);
      setTempFolderName(folder.name);
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderId: string) => {
      e.stopPropagation();
      requestConfirm("Delete Folder", "This will not delete the projects inside. They will be moved to 'All Projects'.", () => {
          // Remove folderId from projects
          setProjects(prev => prev.map(p => p.folderId === folderId ? { ...p, folderId: undefined } : p));
          setFolders(prev => prev.filter(f => f.id !== folderId));
          if (currentView === folderId) setCurrentView('all');
      });
  };

  const moveProject = (projectId: string, folderId: string | undefined) => {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, folderId } : p));
  };

  const toggleArchiveProject = (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          const isArchived = !p.isArchived;
          return { ...p, isArchived };
      }));
  };

  // --- HELPERS FOR SESSION & TAGS ---

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Collect all unique tags for suggestion
  const allProjectTags = useMemo(() => {
    const tags = new Set<string>();
    activeProject?.versions.forEach(v => {
      v.tasks.forEach(t => {
        t.subtasks.forEach(s => {
          s.sessions?.forEach(session => {
            session.tags?.forEach(tag => tags.add(tag));
          });
        });
      });
    });
    return Array.from(tags);
  }, [activeProject]);

  const getSubtaskForModal = () => {
    if (!activeProject) return null;
    const targets = detailModal || sessionModal;
    if (!targets) return null;

    const version = activeProject.versions.find(v => v.id === targets.versionId);
    const task = version?.tasks.find(t => t.id === targets.taskId);
    const subtask = task?.subtasks.find(s => s.id === targets.subtaskId);
    return subtask ? { subtask, taskTitle: task?.title } : null;
  };
  const modalData = getSubtaskForModal();

  const handleSaveSession = (session: WorkSession) => {
    if (!activeProject || !sessionModal) return;
    const { versionId, taskId, subtaskId } = sessionModal;
    
    setProjects(prev => prev.map(p => {
        if (p.id !== activeProject.id) return p;
        return {
            ...p,
            versions: p.versions.map(v => {
                if (v.id !== versionId) return v;
                return {
                    ...v,
                    tasks: v.tasks.map(t => {
                        if (t.id !== taskId) return t;
                        return {
                            ...t,
                            subtasks: t.subtasks.map(s => {
                                if (s.id !== subtaskId) return s;
                                
                                const currentSessions = s.sessions || [];
                                const newSessions = [...currentSessions, session];
                                
                                // Update stats
                                const newCompleted = s.completedMinutes + session.duration;
                                
                                // Update workLog
                                const sessionDateKey = new Date(session.date).toISOString().split('T')[0];
                                const currentWorkLog = s.workLog || {};
                                
                                // Prepare new work log
                                let newWorkLog = { ...currentWorkLog };
                                
                                // Add structured session duration
                                newWorkLog[sessionDateKey] = (newWorkLog[sessionDateKey] || 0) + session.duration;

                                return {
                                    ...s,
                                    completedMinutes: newCompleted,
                                    workLog: newWorkLog,
                                    sessions: newSessions,
                                    lastUpdated: Date.now()
                                };
                            })
                        };
                    })
                };
            })
        };
    }));
  };

  const handleUpdateSession = (sessionId: string, updates: Partial<WorkSession>) => {
    if (!activeProject || !sessionModal) return;
    const { versionId, taskId, subtaskId } = sessionModal;

    setProjects(prev => prev.map(p => {
        if (p.id !== activeProject.id) return p;
        return {
            ...p,
            versions: p.versions.map(v => {
                if (v.id !== versionId) return v;
                return {
                    ...v,
                    tasks: v.tasks.map(t => {
                        if (t.id !== taskId) return t;
                        return {
                            ...t,
                            subtasks: t.subtasks.map(s => {
                                if (s.id !== subtaskId) return s;
                                
                                const currentSessions = s.sessions || [];
                                const targetSession = currentSessions.find(sess => sess.id === sessionId);
                                if (!targetSession) return s;

                                // Calculate diff for stats adjustment
                                let durationDiff = 0;
                                let dateChanged = false;
                                let oldDateKey = '';
                                
                                if (updates.duration !== undefined) {
                                    durationDiff = updates.duration - targetSession.duration;
                                }
                                if (updates.date && updates.date !== targetSession.date) {
                                    dateChanged = true;
                                    oldDateKey = new Date(targetSession.date).toISOString().split('T')[0];
                                }

                                const newSessions = currentSessions.map(sess => 
                                    sess.id === sessionId ? { ...sess, ...updates } : sess
                                );

                                // Update completedMinutes
                                let newCompleted = s.completedMinutes + durationDiff;
                                if (newCompleted < 0) newCompleted = 0;

                                // Update WorkLog
                                let newWorkLog = { ...s.workLog };
                                
                                if (dateChanged) {
                                    // Remove old duration from old date
                                    newWorkLog[oldDateKey] = Math.max(0, (newWorkLog[oldDateKey] || 0) - targetSession.duration);
                                    // Add new duration to new date
                                    const newDateKey = new Date(updates.date!).toISOString().split('T')[0];
                                    newWorkLog[newDateKey] = (newWorkLog[newDateKey] || 0) + (updates.duration || targetSession.duration);
                                } else {
                                    // Same date, just adjust duration
                                    const dateKey = new Date(targetSession.date).toISOString().split('T')[0];
                                    newWorkLog[dateKey] = Math.max(0, (newWorkLog[dateKey] || 0) + durationDiff);
                                }

                                return {
                                    ...s,
                                    completedMinutes: newCompleted,
                                    workLog: newWorkLog,
                                    sessions: newSessions,
                                    lastUpdated: Date.now()
                                };
                            })
                        };
                    })
                };
            })
        };
    }));
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!activeProject || !sessionModal) return;
    const { versionId, taskId, subtaskId } = sessionModal;

    setProjects(prev => prev.map(p => {
        if (p.id !== activeProject.id) return p;
        return {
            ...p,
            versions: p.versions.map(v => {
                if (v.id !== versionId) return v;
                return {
                    ...v,
                    tasks: v.tasks.map(t => {
                        if (t.id !== taskId) return t;
                        return {
                            ...t,
                            subtasks: t.subtasks.map(s => {
                                if (s.id !== subtaskId) return s;
                                
                                const sessionToDelete = s.sessions?.find(sess => sess.id === sessionId);
                                if (!sessionToDelete) return s;

                                const newSessions = s.sessions?.filter(sess => sess.id !== sessionId) || [];
                                const newCompleted = Math.max(0, s.completedMinutes - sessionToDelete.duration);
                                
                                // Update WorkLog
                                const dateKey = new Date(sessionToDelete.date).toISOString().split('T')[0];
                                const newWorkLog = { ...s.workLog };
                                newWorkLog[dateKey] = Math.max(0, (newWorkLog[dateKey] || 0) - sessionToDelete.duration);

                                return {
                                    ...s,
                                    completedMinutes: newCompleted,
                                    workLog: newWorkLog,
                                    sessions: newSessions,
                                    lastUpdated: Date.now()
                                };
                            })
                        };
                    })
                };
            })
        };
    }));
  };

  const requestConfirm = (title: string, message: string, action: () => void) => {
    setConfirmDialog({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
            action();
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
    });
  };

  const handleCreateProject = (project: Project) => {
    // If inside a folder view, assign to that folder
    if (currentView !== 'all' && currentView !== 'archived') {
        project.folderId = currentView;
    }
    setProjects(prev => [project, ...prev]);
    setActiveProjectId(project.id);
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent opening the project
    requestConfirm(
      "Delete Project", 
      "Are you sure you want to delete this project? This action cannot be undone.",
      () => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProjectId === projectId) {
          setActiveProjectId(null);
        }
      }
    );
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, ...updates };
    }));
  };

  // --- REORDERING HELPERS ---

  const reorderItem = <T,>(list: T[], startIndex: number, endIndex: number): T[] => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  const moveVersion = (projectId: string, fromIndex: number, toIndex: number) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      if (toIndex < 0 || toIndex >= p.versions.length) return p;
      return {
        ...p,
        versions: reorderItem(p.versions, fromIndex, toIndex)
      };
    }));
  };

  const moveTaskCategory = (projectId: string, versionId: string, fromIndex: number, toIndex: number) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
          if (v.id !== versionId) return v;
          if (toIndex < 0 || toIndex >= v.tasks.length) return v;
          return {
             ...v,
             tasks: reorderItem(v.tasks, fromIndex, toIndex)
          };
        })
      };
    }));
  };

  const moveSubtask = (projectId: string, versionId: string, taskId: string, fromIndex: number, toIndex: number) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
          if (v.id !== versionId) return v;
          return {
             ...v,
             tasks: v.tasks.map(t => {
                if (t.id !== taskId) return t;
                if (toIndex < 0 || toIndex >= t.subtasks.length) return t;
                return {
                    ...t,
                    subtasks: reorderItem(t.subtasks, fromIndex, toIndex)
                };
             })
          };
        })
      };
    }));
  };

  // --- DRAG AND DROP HANDLERS ---

  const handleDragStart = (e: React.DragEvent, source: DragSource) => {
    e.stopPropagation();
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLTextAreaElement) {
        e.preventDefault();
        return;
    }
    dragItem.current = source;
    setDragSourceState(source);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(source));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number, targetType: DragType, targetParentId?: string, targetGrandParentId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    const source = dragItem.current;
    if (!source || !activeProjectId) return;

    if (source.type !== targetType) return;
    
    // Safety check: Prevent index out of bounds
    if (source.index === targetIndex) return;

    if (source.type === 'VERSION') {
        moveVersion(activeProjectId, source.index, targetIndex);
    } 
    else if (source.type === 'TASK') {
        if (source.parentId === targetParentId && targetParentId) {
            moveTaskCategory(activeProjectId, targetParentId, source.index, targetIndex);
        }
    } 
    else if (source.type === 'SUBTASK') {
        if (source.parentId === targetParentId && source.grandParentId === targetGrandParentId && targetGrandParentId && targetParentId) {
            moveSubtask(activeProjectId, targetGrandParentId, targetParentId, source.index, targetIndex);
        }
    }
    else if (source.type === 'PROJECT_TODO') {
        moveProjectTodo(activeProjectId, source.index, targetIndex);
    }

    dragItem.current = null;
    setDragSourceState(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragItem.current = null;
    setDragSourceState(null);
  };

  // --- VERSION CRUD ---

  const handleCreateVersion = (projectId: string) => {
      if(!newVersionTitle.trim()) return;

      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              versions: [...p.versions, {
                  id: `v-${Date.now()}`,
                  title: newVersionTitle,
                  tasks: [],
                  startTime: Date.now(),
                  isCollapsed: false,
                  deadline: undefined
              }]
          };
      }));
      setNewVersionTitle("");
      setIsCreatingVersion(false);
  };

  const deleteVersion = (e: React.MouseEvent, projectId: string, versionId: string) => {
    e.stopPropagation();
    requestConfirm("Delete Version", "Delete this version and all its tasks?", () => {
        setProjects(prev => prev.map(p => {
            if(p.id !== projectId) return p;
            return { ...p, versions: p.versions.filter(v => v.id !== versionId) };
        }));
    });
  };

  const toggleVersionCollapse = (projectId: string, versionId: string) => {
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              versions: p.versions.map(v => v.id === versionId ? { ...v, isCollapsed: !v.isCollapsed } : v)
          };
      }));
  };

  const updateVersion = (projectId: string, versionId: string, updates: Partial<Version>) => {
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              versions: p.versions.map(v => {
                  if (v.id !== versionId) return v;
                  
                  const nextV = { ...v, ...updates };

                  // Auto-log deadline changes
                  if (updates.deadline !== undefined && updates.deadline !== v.deadline) {
                      const oldD = v.deadline ? new Date(v.deadline).toLocaleDateString() : "Unset";
                      const newD = updates.deadline ? new Date(updates.deadline).toLocaleDateString() : "Unset";
                      const logLine = `[System] Deadline changed: ${oldD} -> ${newD}`;
                      
                      if (nextV.notes) {
                          nextV.notes = nextV.notes + '\n' + logLine;
                      } else {
                          nextV.notes = logLine;
                      }
                  }
                  
                  return nextV;
              })
          };
      }));
  };

  // --- TASK CRUD ---

  const handleCreateTask = (projectId: string, versionId: string) => {
    if (!newTaskTitle.trim()) return;
    
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
            if (v.id !== versionId) return v;
            return {
                ...v,
                tasks: [...v.tasks, {
                    id: `task-${Date.now()}`,
                    title: newTaskTitle,
                    status: TaskStatus.TODO,
                    startTime: Date.now(),
                    subtasks: []
                }]
            };
        })
      };
    }));
    setNewTaskTitle("");
    setCreatingTaskInVersionId(null);
  };

  const updateTask = (projectId: string, versionId: string, taskId: string, updates: Partial<Task>) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return {
            ...p,
            versions: p.versions.map(v => {
                if (v.id !== versionId) return v;
                return {
                    ...v,
                    tasks: v.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
                };
            })
        };
    }));
  };

  const toggleTaskStatus = (projectId: string, versionId: string, task: Task) => {
      const isDone = task.status === TaskStatus.DONE;
      const newStatus = isDone ? TaskStatus.TODO : TaskStatus.DONE;
      
      updateTask(projectId, versionId, task.id, {
          status: newStatus,
          completedAt: newStatus === TaskStatus.DONE ? Date.now() : undefined
      });
  };

  const handleDeleteTask = (e: React.MouseEvent, projectId: string, versionId: string, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    requestConfirm("Delete Category", "Delete this entire category?", () => {
        setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            return {
                ...p,
                versions: p.versions.map(v => {
                    if (v.id !== versionId) return v;
                    return { ...v, tasks: v.tasks.filter(t => t.id !== taskId) };
                })
            };
        }));
    });
  };

  // --- SUBTASK CRUD ---

  const handleCreateSubtask = (projectId: string, versionId: string, taskId: string, title: string) => {
    if (!title.trim()) return;
    
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        versions: p.versions.map(v => {
            if (v.id !== versionId) return v;
            return {
                ...v,
                tasks: v.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return {
                        ...t,
                        subtasks: [...t.subtasks, {
                            id: `sub-${Date.now()}`,
                            title,
                            status: TaskStatus.TODO,
                            estimatedMinutes: 60,
                            completedMinutes: 0,
                            createdAt: Date.now(),
                            startTime: Date.now(),
                            lastUpdated: Date.now(),
                            sessions: []
                        }]
                    };
                })
            };
        })
      };
    }));
    setNewSubtaskInput(null);
  };

  const updateSubtask = (projectId: string, versionId: string, taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
    const todayKey = new Date().toISOString().split('T')[0];
    
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      
      let updatedVersions = p.versions.map(v => {
            if (v.id !== versionId) return v;
            return {
                ...v,
                tasks: v.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return {
                        ...t,
                        subtasks: t.subtasks.map(s => {
                            if (s.id !== subtaskId) return s;
                            let newSubtask = { ...s, ...updates, lastUpdated: Date.now() };
                            
                            if (updates.status === TaskStatus.DONE && s.status !== TaskStatus.DONE) {
                                newSubtask.progress = 100;
                                newSubtask.completedAt = Date.now();
                            } else if (updates.status === TaskStatus.TODO && s.status === TaskStatus.DONE) {
                                newSubtask.completedAt = undefined;
                            }
                            
                            if (updates.completedMinutes !== undefined && updates.completedMinutes !== s.completedMinutes) {
                               const diff = updates.completedMinutes - s.completedMinutes;
                               const currentLog = s.workLog || {};
                               const todayVal = currentLog[todayKey] || 0;
                               newSubtask.workLog = { ...currentLog, [todayKey]: Math.max(0, todayVal + diff) };
                            }
                            return newSubtask;
                        })
                    };
                })
            };
        });

      // Also update linked todo status if status changed
      let updatedTodoList = p.todoList;
      if (updates.status) {
          updatedTodoList = (p.todoList || []).map(t => {
              if (t.linkedRef?.subtaskId === subtaskId) {
                  return { ...t, done: updates.status === TaskStatus.DONE };
              }
              return t;
          });
      }

      return {
        ...p,
        versions: updatedVersions,
        todoList: updatedTodoList
      };
    }));
  };

  const deleteSubtask = (e: React.MouseEvent, projectId: string, versionId: string, taskId: string, subtaskId: string) => {
    e.stopPropagation();
    requestConfirm("Delete Task", "Delete this task?", () => {
        setProjects(prev => prev.map(p => {
            if(p.id !== projectId) return p;
            
            // Also remove from todo list if linked
            const updatedTodoList = (p.todoList || []).filter(t => t.linkedRef?.subtaskId !== subtaskId);

            return {
                ...p,
                todoList: updatedTodoList,
                versions: p.versions.map(v => {
                    if (v.id !== versionId) return v;
                    return {
                        ...v,
                        tasks: v.tasks.map(t => {
                            if (t.id !== taskId) return t;
                            return { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) };
                        })
                    };
                })
            };
        }));
    });
  };

  // --- GENERAL UI HELPERS ---

  const startEditing = (id: string, currentTitle: string) => {
    setEditingId(id);
    setTempTitle(currentTitle);
  };

  const saveTitle = (action: (title: string) => void) => {
    if (tempTitle.trim()) action(tempTitle);
    setEditingId(null);
  };
  
  const toggleSetNotes = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
      const newSet = new Set(set);
      if(newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setter(newSet);
  };

  const getRemainingTime = (deadline: number | undefined) => {
    if (!deadline) return null;
    const diff = deadline - currentTime;
    if (diff <= 0) return { expired: true, text: "Overdue" };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return { expired: false, text: `${days}d ${hours}h` };
    return { expired: false, text: `${hours}h remaining` };
  };

  const toLocalISOString = (timestamp: number) => {
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };
  const toLocalDateString = (timestamp: number) => {
      const date = new Date(timestamp);
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };
  
  // New Helper for ensuring input date strings (YYYY-MM-DD) are saved as Local Midnight timestamps
  const handleDateChange = (dateStr: string): number => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
  };

  // Calculate days between two timestamps
  const getDaysDiff = (start: number | undefined, end: number | undefined) => {
      if (!start || !end) return null;
      // Normalize to midnight to count calendar days roughly
      const s = new Date(start); s.setHours(0,0,0,0);
      const e = new Date(end); e.setHours(0,0,0,0);
      const diff = e.getTime() - s.getTime();
      const days = Math.round(diff / (1000 * 60 * 60 * 24));
      return days >= 0 ? days : 0; 
  };

  const projectForecast = useMemo(() => {
    if (!activeProject) return null;
    let totalRemainingMinutes = 0;
    activeProject.versions.forEach(v => {
        v.tasks.forEach(t => {
            if (t.status === TaskStatus.DONE) return;
            t.subtasks.forEach(s => {
                if (s.status !== TaskStatus.DONE) {
                    totalRemainingMinutes += Math.max(0, s.estimatedMinutes - s.completedMinutes);
                }
            });
        });
    });
    if (totalRemainingMinutes === 0) return { date: new Date(), remainingHours: 0 };
    const dailyMinutes = activeProject.dailyWorkMinutes || 120;
    const daysRequired = Math.ceil(totalRemainingMinutes / dailyMinutes);
    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + daysRequired);
    return { date: finishDate, remainingHours: Math.round(totalRemainingMinutes / 60) };
  }, [activeProject]);

  const filteredProjects = useMemo(() => {
    if (currentView === 'archived') {
      return projects.filter(p => p.isArchived);
    }
    if (currentView === 'all') {
      return projects.filter(p => !p.isArchived);
    }
    return projects.filter(p => !p.isArchived && p.folderId === currentView);
  }, [projects, currentView]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
             try {
                const parsed = JSON.parse(ev.target?.result as string);
                
                // Check if it is a full backup (has version and projects array)
                if (parsed.version && Array.isArray(parsed.projects)) {
                    if (parsed.projects) setProjects(parsed.projects);
                    if (parsed.folders) setFolders(parsed.folders);
                    if (parsed.dailyTasks) setDailyTasks(parsed.dailyTasks);
                    if (parsed.moods) setMoods(parsed.moods);
                    if (parsed.wishlist) setWishlist(parsed.wishlist);
                    alert("Full backup restored successfully.");
                } else {
                    // Legacy import (just projects)
                    const imported = Array.isArray(parsed) ? parsed : [parsed];
                    const migrated = imported.map((p: any) => {
                        let project = { ...p };
                        if (!project.versions || project.versions.length === 0) {
                            project = { ...project, versions: [{ id: `v-imp-${p.id}`, title: 'Version 1.0', tasks: p.tasks || [] }], tasks: undefined };
                        }
                        if (project.isArchived === undefined) project.isArchived = false;
                        return project;
                    });
                    setProjects(prev => [...migrated, ...prev]);
                    alert("Projects imported successfully.");
                }
             } catch(err) { alert("Invalid JSON"); }
          };
          reader.readAsText(file);
      }} />

      {/* Modals */}
      {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex items-start gap-4">
                      <div className="bg-red-50 p-2 rounded-full text-red-500 shrink-0"><AlertTriangle size={24} /></div>
                      <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-900 mb-1">{confirmDialog.title}</h3>
                          <p className="text-sm text-slate-500 mb-4 leading-relaxed">{confirmDialog.message}</p>
                          <div className="flex justify-end gap-3">
                              <button onClick={() => setConfirmDialog(prev => ({...prev, isOpen: false}))} className="px-4 py-2 rounded-lg text-slate-600 font-medium hover:bg-slate-100 transition-colors">Cancel</button>
                              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 shadow-sm transition-colors">Confirm</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <MoodTrackerModal
        isOpen={isMoodModalOpen}
        onClose={() => setIsMoodModalOpen(false)}
        moods={moods}
        onAddMood={(mood) => setMoods(prev => [mood, ...prev])}
        onDeleteMood={(id) => setMoods(prev => prev.filter(m => m.id !== id))}
      />
      
      <WishlistModal 
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        items={wishlist}
        onAddItem={handleAddWishlistItem}
        onUpdateItem={handleUpdateWishlistItem}
        onDeleteItem={handleDeleteWishlistItem}
      />

      {/* Work Calendar Modal */}
      <WorkLogCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        projects={projects}
        folders={folders}
      />

      {/* Completed Timeline Modal */}
      <CompletedTimelineModal
        isOpen={isCompletedTimelineOpen}
        onClose={() => setIsCompletedTimelineOpen(false)}
        projects={projects}
      />

      {detailModal && modalData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                   <div>
                      <div className="text-xs text-slate-500 font-bold uppercase">{modalData.taskTitle}</div>
                      <h3 className="text-lg font-bold text-slate-800 leading-tight">{modalData.subtask.title}</h3>
                   </div>
                   <button onClick={() => setDetailModal(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-white border border-slate-200 rounded-lg transition-colors"><X size={18} /></button>
                </div>
                <div className="p-6">
                    <TaskHeatmap 
                      workLog={modalData.subtask.workLog || {}} 
                      totalMinutes={modalData.subtask.completedMinutes}
                      subtask={modalData.subtask}
                    />
                </div>
            </div>
        </div>
      )}

      {sessionModal && modalData && (
        <WorkSessionModal
          isOpen={true}
          onClose={() => setSessionModal(null)}
          subtask={modalData.subtask}
          allProjectTags={allProjectTags}
          onSaveSession={handleSaveSession}
          onUpdateSession={handleUpdateSession}
          onDeleteSession={handleDeleteSession}
          initialDuration={sessionModal.initialDuration}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveProjectId(null)}>
            <div className="bg-indigo-600 p-1.5 rounded-lg"><GraduationCap className="text-white w-5 h-5" /></div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">ProjectFlow</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {!activeProject && (
              <>
                 <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50"><Upload size={16} /> <span className="hidden sm:inline">{t('header.import')}</span></button>
                 <button 
                    onClick={handleSetAutoSave}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50 border ${isAutoSaving ? 'border-amber-200 bg-amber-50 text-amber-600' : (autoSavePath || webDirHandle) ? 'border-green-200 bg-green-50 text-green-600' : 'border-transparent text-slate-500 hover:text-indigo-600'}`}
                    title={autoSavePath ? `Auto-save active: ${autoSavePath}` : webDirHandle ? "Web Auto-save Active" : "Set Auto-Save Location"}
                 >
                    {isAutoSaving ? <RefreshCw size={16} className="animate-spin"/> : <Database size={16} />} 
                    <span className="hidden sm:inline">{isAutoSaving ? t('header.saving') : (autoSavePath || webDirHandle) ? t('header.autoSaveOn') : t('header.autoSave')}</span>
                 </button>
                 <button onClick={() => {
                     const fullBackup = {
                        projects,
                        folders,
                        dailyTasks,
                        moods,
                        wishlist,
                        exportDate: Date.now(),
                        version: "1.0"
                     };
                     const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
                     const link = document.createElement('a');
                     link.href = URL.createObjectURL(blob);
                     link.download = `ThesisFlow-FullBackup-${new Date().toISOString().split('T')[0]}.json`;
                     document.body.appendChild(link); link.click(); document.body.removeChild(link);
                 }} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50"><Download size={16} /> <span className="hidden sm:inline">{t('header.backup')}</span></button>
              </>
            )}
            <button onClick={() => setIsWishlistOpen(true)} className="flex items-center gap-2 bg-pink-50 hover:bg-pink-100 text-pink-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-pink-200 whitespace-nowrap"><Gift size={16} /> <span className="hidden sm:inline">{t('header.wishlist')}</span></button>
            <button onClick={() => setIsCalendarModalOpen(true)} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-indigo-200 whitespace-nowrap"><Calendar size={16} /> <span className="hidden sm:inline">{t('header.calendar')}</span></button>
            <button onClick={() => setIsCompletedTimelineOpen(true)} className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-emerald-200 whitespace-nowrap"><CheckCircle2 size={16} /> <span className="hidden sm:inline">{t('header.doneTimeline')}</span></button>
            <button onClick={() => setIsMoodModalOpen(true)} className="flex items-center gap-2 bg-pink-50 hover:bg-pink-100 text-pink-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-pink-200 whitespace-nowrap"><Smile size={16} /> <span className="hidden sm:inline">{t('header.mood')}</span></button>
            <button onClick={() => setIsAIModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-200 whitespace-nowrap"><Sparkles size={16} /> <span className="hidden sm:inline">{t('header.aiPlanner')}</span></button>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-slate-200 whitespace-nowrap"><Plus size={16} /> <span className="hidden sm:inline">{t('header.newProject')}</span></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!activeProject ? (
          /* Dashboard View */
          <div className="flex gap-8">
              {/* Sidebar Navigation */}
            <div className="w-64 shrink-0 hidden md:flex flex-col space-y-6 h-[calc(100vh-100px)] sticky top-24">
                <div className="flex-1 overflow-y-auto">
                    <div className="space-y-1">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">{t('sidebar.projects')}</h3>
                        <button 
                            onClick={() => setCurrentView('all')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${currentView === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Layers size={16} /> {t('sidebar.allProjects')}
                        </button>
                    </div>
                    
                    <div className="space-y-1 mt-6">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Folders</h3>
                            <button onClick={() => setIsNewFolderInputOpen(true)} className="text-slate-400 hover:text-indigo-600"><Plus size={14}/></button>
                        </div>
                        {isNewFolderInputOpen && (
                            <div className="px-3 mb-2 flex items-center gap-1">
                                <input 
                                    autoFocus
                                    className="w-full text-sm border rounded px-2 py-1 outline-none focus:border-indigo-500"
                                    placeholder="Name..."
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                    onBlur={() => { if(!newFolderName) setIsNewFolderInputOpen(false); }}
                                />
                            </div>
                        )}
                        {folders.map(folder => (
                            <div key={folder.id} className="group relative flex items-center">
                                {editingFolderId === folder.id ? (
                                    <input 
                                        autoFocus
                                        className="w-full text-sm border border-indigo-500 rounded px-2 py-1.5 outline-none bg-white shadow-sm"
                                        value={tempFolderName}
                                        onChange={e => setTempFolderName(e.target.value)}
                                        onBlur={handleRenameFolder}
                                        onKeyDown={e => e.key === 'Enter' && handleRenameFolder()}
                                        onClick={e => e.stopPropagation()}
                                    />
                                ) : (
                                    <button 
                                        onClick={() => setCurrentView(folder.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${currentView === folder.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <FolderOpen size={16} className={currentView === folder.id ? "fill-indigo-200" : ""} /> {folder.name}
                                    </button>
                                )}
                                
                                {/* Unified actions for all folders (Default or Custom) */}
                                {editingFolderId !== folder.id && (
                                    <div className="absolute right-2 flex opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded">
                                        <button onClick={(e) => startEditingFolder(e, folder)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={12}/></button>
                                        <button onClick={(e) => handleDeleteFolder(e, folder.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1 border-t border-slate-100 pt-4 mt-4">
                        <button 
                            onClick={() => setCurrentView('archived')}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${currentView === 'archived' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Archive size={16} /> {t('sidebar.archived')}
                        </button>
                    </div>
                </div>

                <DailyTimelinePanel 
                    tasks={dailyTasks}
                    projects={projects}
                    onAddTask={handleAddDailyTask}
                    onToggleTask={handleToggleDailyTask}
                    onUpdateTask={handleUpdateDailyTask}
                    onDeleteTask={handleDeleteDailyTask}
                    onAbandonTask={handleAbandonDailyTask}
                />
            </div>

            {/* Main Grid */}
            <div className="flex-1 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">
                        {currentView === 'all' ? t('sidebar.allProjects') :
                         currentView === 'archived' ? t('sidebar.archived') :
                         folders.find(f => f.id === currentView)?.name || 'Projects'}
                    </h2>
                    <span className="text-sm text-slate-500">{filteredProjects.length} projects</span>
                </div>
                {filteredProjects.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        {currentView === 'archived' ? <Archive size={32} /> : <FolderPlus size={32} />}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">
                        {currentView === 'archived' ? 'No archived projects' : 'No projects found'}
                    </h3>
                    <p className="text-slate-500 max-w-sm mx-auto">
                        {currentView === 'archived' 
                            ? 'Projects you archive will appear here.' 
                            : 'Create a new project or select a different folder.'}
                    </p>
                </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredProjects.map(project => {
                        // Flatten stats for card
                        let doneCount = 0, inProgressCount = 0, todoCount = 0;
                        let totalAdjustedMinutes = 0, totalSpentMinutes = 0;
                        project.versions.forEach(v => v.tasks.forEach(t => t.subtasks.forEach(s => {
                            totalSpentMinutes += s.completedMinutes;
                            if (s.status === TaskStatus.DONE) { doneCount++; totalAdjustedMinutes += s.completedMinutes; }
                            else { if (s.status === TaskStatus.IN_PROGRESS || s.completedMinutes > 0) inProgressCount++; else todoCount++; totalAdjustedMinutes += s.estimatedMinutes; }
                        })));
                        const totalCount = doneCount + inProgressCount + todoCount;
                        const remainingTime = getRemainingTime(project.deadline);
                        const donePercent = totalCount ? (doneCount / totalCount) * 100 : 0;
                        const activePercent = totalCount ? (inProgressCount / totalCount) * 100 : 0;

                        return (
                            <div key={project.id} onClick={() => setActiveProjectId(project.id)} className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer relative overflow-visible flex flex-col h-full">
                                {/* Actions Menu */}
                                <div className="absolute top-4 right-4 flex items-center gap-1 z-20">
                                     <div className="opacity-0 group-hover:opacity-100 transition-opacity flex bg-white border border-slate-200 rounded-lg shadow-sm p-1" onClick={e => e.stopPropagation()}>
                                         <select 
                                            className="text-xs bg-transparent outline-none text-slate-600 max-w-[80px]"
                                            value={project.folderId || ''}
                                            onChange={(e) => moveProject(project.id, e.target.value || undefined)}
                                         >
                                             <option value="">Move...</option>
                                             {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                         </select>
                                         <div className="w-px h-3 bg-slate-200 mx-1"></div>
                                         <button 
                                            onClick={(e) => toggleArchiveProject(e, project.id)} 
                                            title={project.isArchived ? "Restore" : "Archive"}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-500"
                                         >
                                             {project.isArchived ? <ArchiveRestore size={14}/> : <Archive size={14}/>}
                                         </button>
                                         <button onClick={(e) => handleDeleteProject(e, project.id)} className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                                     </div>
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-bold text-slate-800 truncate">{project.title}</h3>
                                        {project.folderId && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 truncate max-w-[100px]">
                                                {folders.find(f => f.id === project.folderId)?.name}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2 h-8">{project.description || "No description provided."}</p>
                                </div>
                                <div className="mt-auto space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className={`col-span-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${remainingTime?.expired ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                            <CalendarClock size={14} className="shrink-0" /><div className="flex flex-col leading-none"><span className="font-bold">{project.deadline ? new Date(project.deadline).toLocaleDateString() : "No Deadline"}</span>{project.deadline && <span className="text-[10px] opacity-80">{remainingTime?.text}</span>}</div>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                            <Clock size={16} className="text-slate-400 shrink-0" /><div className="flex items-baseline gap-1.5"><span className="text-sm font-bold text-slate-700">{(totalSpentMinutes/60).toFixed(1)}h</span><span className="text-xs text-slate-400">/</span><span className="text-xs text-slate-500 font-medium">{(totalAdjustedMinutes/60).toFixed(1)}h total</span></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                                            {donePercent > 0 && <div className="h-full bg-green-500 transition-all duration-500 border-r border-white/20" style={{ width: `${donePercent}%` }}></div>}
                                            {activePercent > 0 && <div className="h-full bg-blue-500 transition-all duration-500 border-r border-white/20" style={{ width: `${activePercent}%` }}></div>}
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-medium text-slate-500 px-0.5">
                                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div><span>{doneCount} Done</span></div>
                                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div><span>{inProgressCount} Active</span></div>
                                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div><span>{todoCount} Todo</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                )}
            </div>
          </div>
        ) : (
          /* Project Detail View */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Nav & Header Area */}
            <div className="flex items-center justify-between">
              <button onClick={() => setActiveProjectId(null)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium"><ChevronLeft size={16} /> {t('projectDetail.backToDashboard')}</button>
            </div>

            <div className="flex justify-between items-start">
              {/* Header Info (Left) */}
              <div className="w-full">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
                  {isEditingProjectTitle ? (
                      <input autoFocus type="text" className="text-3xl font-bold text-slate-900 bg-transparent border-b-2 border-indigo-500 outline-none pb-1 min-w-[300px]" value={activeProject.title} onChange={(e) => updateProject(activeProject.id, { title: e.target.value })} onBlur={() => setIsEditingProjectTitle(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingProjectTitle(false)} />
                  ) : (
                      <h1 onClick={() => setIsEditingProjectTitle(true)} className="text-3xl font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-3 group">{activeProject.title} <Pencil size={20} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" /></h1>
                  )}
                  {/* Deadline & Forecast */}
                  <div className="flex items-center gap-3">
                    <div className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm cursor-pointer transition-all ${getRemainingTime(activeProject.deadline)?.expired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300'}`} onClick={() => setIsEditingProjectDDL(true)}>
                        <CalendarClock size={16} className="shrink-0" />
                        {isEditingProjectDDL ? (
                            <input type="datetime-local" autoFocus className="bg-transparent outline-none text-xs border-b border-indigo-400 pb-0.5" value={activeProject.deadline ? toLocalISOString(activeProject.deadline) : ""} onBlur={() => setIsEditingProjectDDL(false)} onChange={(e) => updateProject(activeProject.id, { deadline: new Date(e.target.value).getTime() })} />
                        ) : (<div className="flex items-center gap-2">
                            {/* Start Date */}
                            <span className="tabular-nums font-mono text-xs text-slate-500">{new Date(activeProject.createdAt).toLocaleDateString()}</span>
                            {/* Duration Arrow */}
                            <div className="flex items-center px-1">
                                <span className="text-[9px] text-slate-400 mr-0.5">{getDaysDiff(activeProject.createdAt, activeProject.deadline)}d</span>
                                <ArrowRight size={10} className="text-slate-300"/>
                            </div>
                            {/* Deadline */}
                            <div className="flex flex-col leading-none">
                                <span className="tabular-nums font-mono font-bold text-xs">{activeProject.deadline ? new Date(activeProject.deadline).toLocaleDateString() : "Set Deadline"}</span>
                                {activeProject.deadline && <span className="text-[10px] opacity-70">DDL</span>}
                            </div>
                        </div>)}
                    </div>
                    <div className="group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm bg-slate-50 text-slate-700 border-slate-200">
                        <Clock size={16} className="shrink-0 text-slate-400 group-hover:text-indigo-500" /><div className="flex flex-col leading-none"><div className="flex items-center gap-1"><input type="number" min="0.5" step="0.5" className="w-10 bg-transparent font-mono font-bold text-xs outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 text-right p-0" value={(activeProject.dailyWorkMinutes || 120) / 60} onChange={(e) => updateProject(activeProject.id, { dailyWorkMinutes: parseFloat(e.target.value) * 60 })} /><span className="text-xs font-bold">h/day</span></div><span className="text-[10px] opacity-70">Work Plan</span></div>
                    </div>
                    {projectForecast && projectForecast.remainingHours > 0 && (<div className="group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border shadow-sm bg-indigo-50 text-indigo-700 border-indigo-200"><TrendingUp size={16} className="shrink-0" /><div className="flex flex-col leading-none"><span className="tabular-nums font-mono font-bold text-xs">{projectForecast.date.toLocaleDateString()}</span><span className="text-[10px] opacity-70">Est. Finish</span></div></div>)}
                  </div>
                </div>
                
                {/* Description & Project Todo List */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    {/* Description Column */}
                    <div className="lg:col-span-2">
                        {!isEditingProjectDesc ? (
                            <div className="group relative flex items-start gap-2 h-full"><div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100 hover:border-indigo-200 transition-all w-full relative h-full min-h-[120px]">{activeProject.description ? (<p className="whitespace-pre-wrap">{activeProject.description}</p>) : (<p className="text-slate-400 italic">No project description. Click edit to add notes.</p>)}<button onClick={() => setIsEditingProjectDesc(true)} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all opacity-0 group-hover:opacity-100"><Pencil size={14} /></button></div></div>
                        ) : (
                            <div className="relative h-full"><textarea value={activeProject.description || ""} onChange={(e) => updateProject(activeProject.id, { description: e.target.value })} className="w-full h-full text-sm p-3 pb-10 rounded-xl border border-indigo-200 focus:border-indigo-500 outline-none min-h-[120px] bg-white" placeholder="Add remarks..." autoFocus /><div className="absolute bottom-3 right-3 flex gap-2"><button onClick={() => setIsEditingProjectDesc(false)} className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Save</button></div></div>
                        )}
                    </div>

                    {/* Todo List Column */}
                    <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-full min-h-[160px]">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <ListTodo size={14} /> Project Todo List
                        </h3>
                        
                        <div className="flex-1 overflow-y-auto max-h-[200px] custom-scrollbar space-y-2 mb-3">
                            {(activeProject.todoList || []).length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-4">No quick tasks yet.</p>
                            )}
                            {(activeProject.todoList || []).map((todo, idx) => {
                                const isDragged = dragSourceState?.type === 'PROJECT_TODO' && dragSourceState.index === idx;
                                return (
                                    <div 
                                        key={todo.id} 
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, { type: 'PROJECT_TODO', index: idx })}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, idx, 'PROJECT_TODO')}
                                        onDragEnd={handleDragEnd}
                                        className={`group flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all ${isDragged ? 'opacity-30 border-dashed border-indigo-400' : ''}`}
                                    >
                                        <div className="mt-0.5 cursor-grab text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <GripVertical size={12} />
                                        </div>
                                        <button 
                                            onClick={() => toggleProjectTodo(todo)}
                                            className={`mt-0.5 ${todo.done ? 'text-green-500' : 'text-slate-300 hover:text-indigo-500'}`}
                                        >
                                            {todo.done ? <CheckSquare size={16} /> : <div className="w-4 h-4 border-2 border-current rounded-sm" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                {todo.linkedRef && <Link size={10} className="text-indigo-400 shrink-0" />}
                                                <span className={`text-xs break-words ${todo.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                    {todo.text}
                                                </span>
                                            </div>
                                            {todo.linkedRef && (
                                                <p className="text-[9px] text-slate-400 mt-0.5 truncate">Linked Task</p>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => deleteProjectTodo(todo.id)}
                                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="relative mt-auto">
                            <input 
                                type="text" 
                                className="w-full pl-3 pr-8 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Add todo..."
                                value={newProjectTodoText}
                                onChange={(e) => setNewProjectTodoText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddProjectTodo()}
                            />
                            <button 
                                onClick={handleAddProjectTodo}
                                disabled={!newProjectTodoText.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 disabled:opacity-50"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              {/* Left Column: Versions & Tasks */}
              <div className="xl:col-span-7 space-y-8">
                 {/* VERSION RENDER LOOP */}
                 {activeProject.versions.map((version, vIdx) => {
                    const isNotesExpanded = expandedVersionNotes.has(version.id);
                    const vTime = getRemainingTime(version.deadline);
                    const isVersionDragged = dragSourceState?.type === 'VERSION' && dragSourceState.index === vIdx;
                    
                    // Aggregate stats for Version Pie Chart
                    const vTotalSpent = version.tasks.reduce((acc, t) => acc + t.subtasks.reduce((sa, s) => sa + s.completedMinutes, 0), 0);
                    const vRemaining = version.tasks.reduce((acc, t) => acc + t.subtasks.reduce((sa, s) => (s.status === TaskStatus.DONE ? sa : sa + Math.max(0, s.estimatedMinutes - s.completedMinutes)), 0), 0);
                    const vPieData = [{ name: 'Spent', value: vTotalSpent }, { name: 'Remaining', value: vRemaining }];
                    const isVersionEmpty = vTotalSpent === 0 && vRemaining === 0;

                    return (
                        <div 
                            key={version.id} 
                            className={`border border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden mb-6 transition-opacity duration-200 ${isVersionDragged ? 'opacity-30 border-dashed border-indigo-400' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, { type: 'VERSION', index: vIdx })}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, vIdx, 'VERSION')}
                            onDragEnd={handleDragEnd}
                        >
                            {/* Version Header code */}
                            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center group/ver">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing">
                                        <GripVertical size={16} />
                                    </div>
                                    <button onClick={() => toggleVersionCollapse(activeProject.id, version.id)} className="text-slate-500 hover:text-indigo-600">
                                        {version.isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                                    </button>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {editingId === version.id ? (
                                                <input autoFocus className="font-bold text-lg text-slate-800 bg-white border border-indigo-300 rounded px-1" value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => saveTitle(val => updateVersion(activeProject.id, version.id, { title: val }))} onKeyDown={e => e.key === 'Enter' && saveTitle(val => updateVersion(activeProject.id, version.id, { title: val }))} />
                                            ) : (
                                                <h2 className="font-bold text-lg text-slate-800 cursor-pointer hover:text-indigo-600" onClick={() => startEditing(version.id, version.title)}>{version.title}</h2>
                                            )}
                                            {/* Version Progress Pie */}
                                            <div className="w-7 h-7 ml-2 relative group/pie cursor-help">
                                                <PieChart width={28} height={28}>
                                                    <Pie data={isVersionEmpty ? [{value:1}] : vPieData} dataKey="value" innerRadius={7} outerRadius={14} stroke="none">
                                                        <Cell fill={isVersionEmpty ? "#e2e8f0" : "#6366f1"} />
                                                        <Cell fill="#cbd5e1" />
                                                    </Pie>
                                                </PieChart>
                                                {!isVersionEmpty && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/pie:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20 shadow-lg pointer-events-none">
                                                        Total: {Math.round((vTotalSpent + vRemaining)/60)}h | Spent: {Math.round(vTotalSpent/60)}h
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                            {/* Version Start Time */}
                                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 hover:text-indigo-600 cursor-pointer group/vstart" onClick={() => setEditingDateId({ id: version.id, type: 'start' })}>
                                                <Calendar size={12} />
                                                {editingDateId?.id === version.id && editingDateId?.type === 'start' ? (
                                                    <input type="date" autoFocus className="bg-white border rounded px-1" value={version.startTime ? toLocalDateString(version.startTime) : toLocalDateString(Date.now())} onBlur={() => setEditingDateId(null)} onChange={(e) => updateVersion(activeProject.id, version.id, { startTime: handleDateChange(e.target.value) })} onClick={e => e.stopPropagation()} />
                                                ) : (
                                                    <span>{version.startTime ? new Date(version.startTime).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : "Set Start"}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center px-1">
                                                <span className="text-[9px] text-slate-300 mr-0.5">{getDaysDiff(version.startTime, version.deadline)}d</span>
                                                <ArrowRight size={10} className="text-slate-200"/>
                                            </div>
                                            <div className={`flex items-center gap-1.5 text-[10px] font-medium cursor-pointer transition-colors ${vTime?.expired ? 'text-red-600' : 'text-slate-500 hover:text-indigo-600'}`} onClick={() => setEditingDateId({ id: version.id, type: 'end' })}>
                                                <CalendarClock size={12} />
                                                {editingDateId?.id === version.id && editingDateId?.type === 'end' ? (
                                                    <input type="date" autoFocus className="bg-white border rounded px-1" value={version.deadline ? toLocalDateString(version.deadline) : ""} onBlur={() => setEditingDateId(null)} onChange={(e) => updateVersion(activeProject.id, version.id, { deadline: handleDateChange(e.target.value) })} onClick={e => e.stopPropagation()} />
                                                ) : (
                                                    <span>{version.deadline ? `${new Date(version.deadline).toLocaleDateString()} ${vTime?.expired ? `(${t('common.overdue')})` : ''}` : t('common.setEnd')}</span>
                                                )}
                                            </div>
                                            <button onClick={() => toggleSetNotes(expandedVersionNotes, version.id, setExpandedVersionNotes)} className={`text-[10px] flex items-center gap-1 ${version.notes ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}><FileText size={12} /> {t('common.notes')}</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover/ver:opacity-100 transition-opacity flex gap-2">
                                     <div className="flex items-center mr-2 bg-white rounded-md p-0.5 shadow-sm border border-slate-200">
                                        <button onClick={() => moveVersion(activeProject.id, vIdx, vIdx - 1)} disabled={vIdx === 0} className="p-1 text-slate-400 hover:text-indigo-600 rounded-sm disabled:opacity-30"><ArrowUp size={12} /></button>
                                        <button onClick={() => moveVersion(activeProject.id, vIdx, vIdx + 1)} disabled={vIdx === activeProject.versions.length - 1} className="p-1 text-slate-400 hover:text-indigo-600 rounded-sm disabled:opacity-30"><ArrowDown size={12} /></button>
                                    </div>
                                    <button onClick={(e) => deleteVersion(e, activeProject.id, version.id)} className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            
                            {/* Version Notes */}
                            {(isNotesExpanded || (version.notes && !isNotesExpanded)) && (
                                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                                    {isNotesExpanded ? (
                                        <div className="relative"><textarea value={version.notes || ''} onChange={(e) => updateVersion(activeProject.id, version.id, { notes: e.target.value })} className="w-full text-sm p-2 rounded border border-indigo-200 outline-none min-h-[60px]" placeholder={t('common.versionRemarks')} autoFocus /><div className="absolute bottom-2 right-2"><button onClick={() => toggleSetNotes(expandedVersionNotes, version.id, setExpandedVersionNotes)} className="bg-indigo-600 text-white text-[10px] px-2 py-1 rounded">{t('common.done')}</button></div></div>
                                    ) : (
                                        <div className="flex gap-2 items-start cursor-pointer" onClick={() => toggleSetNotes(expandedVersionNotes, version.id, setExpandedVersionNotes)}><FileText size={12} className="shrink-0 mt-0.5 text-indigo-400" /><p className="text-xs text-slate-600 whitespace-pre-wrap">{version.notes}</p></div>
                                    )}
                                </div>
                            )}

                            {/* TASKS LIST (Inside Version) */}
                            {!version.isCollapsed && (
                                <div className="p-4 bg-slate-50 space-y-4">
                                    {(() => {
                                        return version.tasks.map((task, tIdx) => {
                                            const isCategoryDone = task.status === TaskStatus.DONE;
                                            const isTaskDragged = dragSourceState?.type === 'TASK' && dragSourceState.index === tIdx && dragSourceState.parentId === version.id;

                                            // Task Calculations
                                            const taskTotalSpent = task.subtasks.reduce((acc, s) => acc + s.completedMinutes, 0);
                                            const taskRemaining = task.subtasks.reduce((acc, s) => s.status === TaskStatus.DONE ? acc : acc + Math.max(0, s.estimatedMinutes - s.completedMinutes), 0);
                                            const pieData = [{ name: 'Spent', value: taskTotalSpent }, { name: 'Remaining', value: taskRemaining }];
                                            const isTaskEmpty = taskTotalSpent === 0 && taskRemaining === 0;

                                            // Subtask Split Logic: Active vs Done
                                            const activeSubtasks = task.subtasks.map((s, idx) => ({ ...s, originalIndex: idx })).filter(s => s.status !== TaskStatus.DONE);
                                            const completedSubtasks = task.subtasks.map((s, idx) => ({ ...s, originalIndex: idx })).filter(s => s.status === TaskStatus.DONE).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

                                            if (isCategoryDone) {
                                                return (
                                                    <div key={task.id} className="bg-white rounded-lg border border-slate-200 p-3 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-green-100 p-1 rounded-full text-green-600"><CheckCircle2 size={16} /></div>
                                                            <div><h3 className="font-bold text-slate-500 line-through text-sm">{task.title}</h3></div>
                                                        </div>
                                                        <button onClick={() => toggleTaskStatus(activeProject.id, version.id, task)} className="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded flex gap-1"><RotateCcw size={12} /> {t('common.reopen')}</button>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div 
                                                    key={task.id} 
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, { type: 'TASK', index: tIdx, parentId: version.id })}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, tIdx, 'TASK', version.id)}
                                                    onDragEnd={handleDragEnd}
                                                    className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden transition-opacity ${isTaskDragged ? 'opacity-30 border-dashed border-indigo-400' : ''}`}
                                                >
                                                    {/* Task Header Code */}
                                                    <div className="bg-white px-4 py-3 border-b border-slate-100 flex justify-between items-center group/task">
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <div className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing">
                                                                <GripVertical size={16} />
                                                            </div>
                                                            <button onClick={() => toggleTaskStatus(activeProject.id, version.id, task)} className="text-slate-300 hover:text-green-500"><Circle size={18} /></button>
                                                            <FolderPlus size={16} className="text-indigo-500 shrink-0" />
                                                            {editingId === task.id ? (
                                                                <input autoFocus className="font-bold text-slate-800 border border-indigo-300 rounded px-1 outline-none" value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => saveTitle(val => updateTask(activeProject.id, version.id, task.id, { title: val }))} onKeyDown={e => e.key === 'Enter' && saveTitle(val => updateTask(activeProject.id, version.id, task.id, { title: val }))} />
                                                            ) : (
                                                                <h3 className="font-bold text-slate-800 cursor-pointer hover:text-indigo-600" onClick={() => startEditing(task.id, task.title)}>{task.title}</h3>
                                                            )}
                                                            <div className="flex items-center gap-2 ml-2">
                                                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer" onClick={() => setEditingDateId({ id: task.id, type: 'start' })}>
                                                                    <Calendar size={10} />
                                                                    {editingDateId?.id === task.id && editingDateId?.type === 'start' ? (
                                                                        <input type="date" autoFocus className="w-20" value={task.startTime ? toLocalDateString(task.startTime) : toLocalDateString(Date.now())} onBlur={() => setEditingDateId(null)} onChange={(e) => updateTask(activeProject.id, version.id, task.id, { startTime: handleDateChange(e.target.value) })} onClick={e => e.stopPropagation()} />
                                                                    ) : (<span>{task.startTime ? new Date(task.startTime).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : t('common.start')}</span>)}
                                                                </div>
                                                                <div className="flex items-center px-0.5">
                                                                    <span className="text-[8px] text-slate-300 mr-0.5">{getDaysDiff(task.startTime, task.deadline)}d</span>
                                                                    <ArrowRight size={8} className="text-slate-200"/>
                                                                </div>
                                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] cursor-pointer group/tddl ${getRemainingTime(task.deadline)?.expired ? 'bg-red-50 text-red-600 border-red-200' : 'border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600'}`} onClick={() => setEditingDateId({ id: task.id, type: 'end' })}>
                                                                    <CalendarClock size={10} />
                                                                    {editingDateId?.id === task.id && editingDateId?.type === 'end' ? (
                                                                        <input type="date" autoFocus className="w-20" value={task.deadline ? toLocalDateString(task.deadline) : ""} onBlur={() => setEditingDateId(null)} onChange={(e) => updateTask(activeProject.id, version.id, task.id, { deadline: handleDateChange(e.target.value) })} onClick={e => e.stopPropagation()} />
                                                                    ) : (<span>{task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : t('common.end')}</span>)}
                                                                </div>
                                                            </div>
                                                            <div className="w-6 h-6 ml-2"><PieChart width={24} height={24}><Pie data={isTaskEmpty ? [{value:1}] : pieData} dataKey="value" innerRadius={6} outerRadius={12} stroke="none"><Cell fill={isTaskEmpty ? "#e2e8f0" : "#6366f1"} /><Cell fill="#cbd5e1" /></Pie></PieChart></div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                                             <div className="flex items-center mr-2 bg-slate-100 rounded-md p-0.5">
                                                                <button onClick={() => moveTaskCategory(activeProject.id, version.id, tIdx, tIdx - 1)} disabled={tIdx === 0} className="p-1 text-slate-400 hover:text-indigo-600 rounded-sm disabled:opacity-30"><ArrowUp size={12} /></button>
                                                                <button onClick={() => moveTaskCategory(activeProject.id, version.id, tIdx, tIdx + 1)} disabled={tIdx === version.tasks.length - 1} className="p-1 text-slate-400 hover:text-indigo-600 rounded-sm disabled:opacity-30"><ArrowDown size={12} /></button>
                                                            </div>
                                                            <button onClick={() => toggleSetNotes(expandedTaskNotes, task.id, setExpandedTaskNotes)} className={`p-1.5 rounded ${task.notes || expandedTaskNotes.has(task.id) ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-500'}`}><FileText size={14} /></button>
                                                            <button onClick={(e) => handleDeleteTask(e, activeProject.id, version.id, task.id)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                                        </div>
                                                    </div>

                                                    {(expandedTaskNotes.has(task.id) || (task.notes && !expandedTaskNotes.has(task.id))) && (
                                                        <div className="px-6 py-2 border-b border-slate-100 bg-slate-50/50">
                                                            {expandedTaskNotes.has(task.id) ? (
                                                                <div className="relative"><textarea value={task.notes || ''} onChange={(e) => updateTask(activeProject.id, version.id, task.id, { notes: e.target.value })} className="w-full text-xs p-2 rounded border border-indigo-200 min-h-[60px]" placeholder={t('common.categoryRemarks')} autoFocus /><button onClick={() => toggleSetNotes(expandedTaskNotes, task.id, setExpandedTaskNotes)} className="absolute bottom-2 right-2 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded">{t('common.done')}</button></div>
                                                            ) : (
                                                                <div className="flex gap-2 items-start cursor-pointer" onClick={() => toggleSetNotes(expandedTaskNotes, task.id, setExpandedTaskNotes)}><FileText size={12} className="shrink-0 mt-0.5 text-yellow-500" /><p className="text-xs text-slate-600 whitespace-pre-wrap">{task.notes}</p></div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="divide-y divide-slate-100">
                                                        {/* ACTIVE SUBTASKS */}
                                                        {activeSubtasks.map((subtask) => {
                                                            const sIdx = subtask.originalIndex;
                                                            const isNotesExp = expandedNotes.has(subtask.id);
                                                            const isSubtaskDragged = dragSourceState?.type === 'SUBTASK' && dragSourceState.index === sIdx && dragSourceState.parentId === task.id;

                                                            return (
                                                                <div 
                                                                    key={subtask.id} 
                                                                    draggable
                                                                    onDragStart={(e) => handleDragStart(e, { type: 'SUBTASK', index: sIdx, parentId: task.id, grandParentId: version.id })}
                                                                    onDragOver={handleDragOver}
                                                                    onDrop={(e) => handleDrop(e, sIdx, 'SUBTASK', task.id, version.id)}
                                                                    onDragEnd={handleDragEnd}
                                                                    className={`p-3 px-4 hover:bg-slate-50 transition-colors group/sub ${isSubtaskDragged ? 'opacity-30 bg-slate-50' : ''}`}
                                                                >
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-3 flex-1">
                                                                            <div className="cursor-grab text-slate-200 hover:text-slate-400 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                                                                <GripVertical size={12} />
                                                                            </div>
                                                                            <button onClick={() => updateSubtask(activeProject.id, version.id, task.id, subtask.id, { status: TaskStatus.DONE })} className="text-slate-300 hover:text-indigo-500"><Circle size={18} /></button>
                                                                            <div className="flex-1">
                                                                                {editingId === subtask.id ? (
                                                                                    <input autoFocus className="text-sm border border-indigo-300 rounded px-1 w-full" value={tempTitle} onChange={e=>setTempTitle(e.target.value)} onBlur={() => saveTitle(val => updateSubtask(activeProject.id, version.id, task.id, subtask.id, {title: val}))} onKeyDown={e=>e.key==='Enter' && saveTitle(val => updateSubtask(activeProject.id, version.id, task.id, subtask.id, {title: val}))} />
                                                                                ) : (
                                                                                    <span className="text-sm font-medium cursor-text hover:text-indigo-600 text-slate-700" onClick={() => startEditing(subtask.id, subtask.title)}>{subtask.title}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity mr-2">
                                                                                <button onClick={() => moveSubtask(activeProject.id, version.id, task.id, sIdx, sIdx - 1)} disabled={sIdx === 0} className="p-0.5 text-slate-300 hover:text-indigo-600 rounded disabled:opacity-10"><ArrowUp size={12}/></button>
                                                                                <button onClick={() => moveSubtask(activeProject.id, version.id, task.id, sIdx, sIdx + 1)} disabled={sIdx === task.subtasks.length - 1} className="p-0.5 text-slate-300 hover:text-indigo-600 rounded disabled:opacity-10"><ArrowDown size={12}/></button>
                                                                            </div>
                                                                            {/* Removed Timer Button Here */}
                                                                            <button onClick={() => setSessionModal({ versionId: version.id, taskId: task.id, subtaskId: subtask.id, isOpen: true })} className="p-1 text-slate-300 hover:text-indigo-500 rounded"><ClipboardList size={14} /></button>
                                                                            <button onClick={() => handleAddSubtaskToTodo(version.id, task.id, subtask)} className="p-1 text-slate-300 hover:text-indigo-500 rounded" title={t('common.pinToTodoList')}><ListTodo size={14} /></button>
                                                                            <button onClick={() => toggleSetNotes(expandedNotes, subtask.id, setExpandedNotes)} className={`p-1 rounded ${subtask.notes || isNotesExp ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-500'}`}><FileText size={14} /></button>
                                                                            <button onClick={() => setDetailModal({ versionId: version.id, taskId: task.id, subtaskId: subtask.id, isOpen: true })} className="text-slate-300 hover:text-indigo-500 p-1"><BarChart3 size={14} /></button>
                                                                            <button onClick={(e) => deleteSubtask(e, activeProject.id, version.id, task.id, subtask.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-8 mt-1 text-[10px] text-slate-500">
                                                                        <div className="flex items-center gap-1">
                                                                            <Clock size={10} />
                                                                            <span>Plan:</span>
                                                                            <input 
                                                                                type="number" 
                                                                                className="w-8 border-b border-slate-300 text-center bg-transparent" 
                                                                                value={subtask.estimatedMinutes || ''} 
                                                                                onChange={(e) => updateSubtask(activeProject.id, version.id, task.id, subtask.id, { estimatedMinutes: e.target.value === '' ? 0 : parseInt(e.target.value) })} 
                                                                            />
                                                                            <span>m</span>
                                                                        </div>
                                                                        <div className={`flex items-center gap-1 ${subtask.completedMinutes > subtask.estimatedMinutes ? 'text-amber-600' : ''}`}>
                                                                            <TimerIcon size={10} />
                                                                            <span>Spent:</span>
                                                                            <input 
                                                                                type="number" 
                                                                                min="0" 
                                                                                className="w-10 border-b border-slate-300 text-center bg-transparent" 
                                                                                value={Math.floor(subtask.completedMinutes) || ''} 
                                                                                onChange={(e) => updateSubtask(activeProject.id, version.id, task.id, subtask.id, { completedMinutes: e.target.value === '' ? 0 : parseFloat(e.target.value) })} 
                                                                            />
                                                                            <span>m</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 ml-auto group/date">
                                                                            <div className="hover:text-indigo-600 cursor-pointer" onClick={() => setEditingDateId({ id: subtask.id, type: 'start' })}>
                                                                                {editingDateId?.id === subtask.id && editingDateId.type === 'start' ? (
                                                                                    <input type="date" autoFocus className="bg-white border rounded px-1" value={subtask.startTime ? toLocalDateString(subtask.startTime) : toLocalDateString(subtask.createdAt)} onBlur={() => setEditingDateId(null)} onChange={(e) => updateSubtask(activeProject.id, version.id, task.id, subtask.id, { startTime: handleDateChange(e.target.value) })} />
                                                                                ) : (
                                                                                    <span>{new Date(subtask.startTime || subtask.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            <div className="flex items-center px-0.5">
                                                                                <span className="text-[8px] text-slate-300 mr-0.5">{getDaysDiff(subtask.startTime || subtask.createdAt, subtask.deadline || Date.now())}d</span>
                                                                                <ArrowRight size={8} className="text-slate-200"/>
                                                                            </div>

                                                                            <div 
                                                                                className={`hover:text-indigo-600 cursor-pointer ${getRemainingTime(subtask.deadline)?.expired ? 'text-red-500 font-bold' : 'text-slate-400'}`}
                                                                                onClick={() => setEditingDateId({ id: subtask.id, type: 'end' })}
                                                                            >
                                                                                {editingDateId?.id === subtask.id && editingDateId.type === 'end' ? (
                                                                                    <input 
                                                                                        type="date" 
                                                                                        autoFocus 
                                                                                        className="bg-white border rounded px-1" 
                                                                                        value={subtask.deadline ? toLocalDateString(subtask.deadline) : ""} 
                                                                                        onBlur={() => setEditingDateId(null)} 
                                                                                        onChange={(e) => updateSubtask(activeProject.id, version.id, task.id, subtask.id, { deadline: handleDateChange(e.target.value) })} 
                                                                                    />
                                                                                ) : (
                                                                                    <span>{subtask.deadline ? new Date(subtask.deadline).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : t('common.setDDL')}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {isNotesExp && (<div className="pl-8 mt-2 relative"><textarea value={subtask.notes || ''} onChange={e => updateSubtask(activeProject.id, version.id, task.id, subtask.id, { notes: e.target.value })} className="w-full text-xs p-2 border rounded min-h-[60px]" placeholder={t('common.taskMemo')} autoFocus /><button onClick={() => toggleSetNotes(expandedNotes, subtask.id, setExpandedNotes)} className="absolute bottom-2 right-2 bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded">{t('common.save')}</button></div>)}
                                                                    {!isNotesExp && subtask.notes && (<div className="pl-8 mt-1 cursor-pointer group" onClick={() => toggleSetNotes(expandedNotes, subtask.id, setExpandedNotes)}><div className="bg-slate-50 p-1.5 rounded border border-slate-100 text-[10px] text-slate-600 group-hover:border-indigo-200">{subtask.notes}</div></div>)}
                                                                </div>
                                                            );
                                                        })}

                                                        {/* COMPLETED SUBTASKS */}
                                                        {completedSubtasks.length > 0 && (
                                                            <div className="bg-slate-50 border-t border-slate-100">
                                                                <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100/50 flex items-center gap-2">
                                                                    <CheckCircle2 size={10} /> {t('common.completed')} ({completedSubtasks.length})
                                                                </div>
                                                                {completedSubtasks.map((subtask) => {
                                                                    // For completed tasks, we use their original index if needed, but disable drag
                                                                    return (
                                                                        <div 
                                                                            key={subtask.id} 
                                                                            className="p-2 px-4 bg-slate-50 hover:bg-slate-100 flex justify-between items-center group opacity-80 hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <button onClick={() => updateSubtask(activeProject.id, version.id, task.id, subtask.id, { status: TaskStatus.TODO })} className="text-green-500 hover:text-green-600"><CheckCircle2 size={16} /></button>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs line-through text-slate-500 font-medium">{subtask.title}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="text-[10px] text-slate-400">
                                                                                    Done {new Date(subtask.completedAt || Date.now()).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                                                                </span>
                                                                                <button onClick={() => setDetailModal({ versionId: version.id, taskId: task.id, subtaskId: subtask.id, isOpen: true })} className="text-slate-300 hover:text-indigo-500 p-1"><BarChart3 size={14} /></button>
                                                                                <button onClick={(e) => deleteSubtask(null as any, activeProject.id, version.id, task.id, subtask.id)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Add Subtask */}
                                                        <div className="p-3 bg-slate-50/50 border-t border-slate-100 pl-8">
                                                            {newSubtaskInput?.taskId === task.id ? (
                                                                <div className="flex items-center gap-2"><input autoFocus className="flex-1 px-2 py-1 rounded border text-sm" placeholder="Task name..." value={newSubtaskInput.title} onChange={e => setNewSubtaskInput({ ...newSubtaskInput, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleCreateSubtask(activeProject.id, version.id, task.id, newSubtaskInput.title)} /><button onClick={() => handleCreateSubtask(activeProject.id, version.id, task.id, newSubtaskInput.title)} className="bg-indigo-600 text-white px-2 py-1 rounded text-xs">Add</button></div>
                                                            ) : (
                                                                <button onClick={() => setNewSubtaskInput({ versionId: version.id, taskId: task.id, title: '' })} className="flex items-center gap-2 text-xs text-slate-400 hover:text-indigo-600"><Plus size={14} /> Add Task item</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                    
                                    {/* Task Creation Input Replacement */}
                                    {creatingTaskInVersionId === version.id ? (
                                        <div className="bg-white rounded-lg border border-indigo-200 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                                            <h4 className="text-xs font-bold text-indigo-600 mb-2 uppercase">New Category</h4>
                                            <div className="flex gap-2">
                                                <input 
                                                    autoFocus
                                                    type="text" 
                                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    placeholder="Category Name (e.g. Analysis)"
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTask(activeProject.id, version.id)}
                                                />
                                                <button onClick={() => handleCreateTask(activeProject.id, version.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Add</button>
                                                <button onClick={() => { setCreatingTaskInVersionId(null); setNewTaskTitle(""); }} className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setCreatingTaskInVersionId(version.id)} className="w-full py-3 border border-dashed border-slate-300 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white flex justify-center gap-2 text-sm"><FolderPlus size={16} /> New Category in {version.title}</button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                 })}
                 
                 {/* Version Creation Input Replacement */}
                 {isCreatingVersion ? (
                     <div className="bg-white rounded-xl border border-indigo-200 p-6 shadow-md animate-in fade-in slide-in-from-bottom-4">
                         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><FolderPlus className="text-indigo-500"/> Create New Version</h3>
                         <div className="space-y-4">
                             <div>
                                 <label className="block text-sm font-medium text-slate-700 mb-1">Version Name</label>
                                 <input 
                                     autoFocus
                                     type="text"
                                     className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                                     placeholder="e.g. Draft 2, Final Revision"
                                     value={newVersionTitle}
                                     onChange={(e) => setNewVersionTitle(e.target.value)}
                                     onKeyDown={(e) => e.key === 'Enter' && handleCreateVersion(activeProject.id)}
                                 />
                             </div>
                             <div className="flex justify-end gap-3">
                                 <button onClick={() => { setIsCreatingVersion(false); setNewVersionTitle(""); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                 <button onClick={() => handleCreateVersion(activeProject.id)} className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">Create Version</button>
                             </div>
                         </div>
                     </div>
                 ) : (
                     <button onClick={() => setIsCreatingVersion(true)} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-slate-50 flex items-center justify-center gap-2 font-medium transition-all group"><div className="bg-slate-100 p-2 rounded-full group-hover:bg-indigo-100 transition-colors"><Plus size={24} className="group-hover:text-indigo-600"/></div> Create New Version / Draft</button>
                 )}
              </div>

              {/* Right Column: Analytics */}
              <div className="xl:col-span-5 space-y-6">
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h2 className="text-xl font-bold text-slate-800 mb-4">Analytics & Progress</h2><TimeChart project={activeProject} /></div>
                 <Timeline project={activeProject} />
              </div>
            </div>
          </div>
        )}
      </main>

      <NewProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreate={handleCreateProject} />
      
      <AIPlannerModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
};

export default App;
