import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle2, Circle, Plus, Calendar, Trash2, Target, ChevronDown, ChevronRight, AlertOctagon, Ban, Download, CalendarClock, Flag, Eye, EyeOff } from 'lucide-react';
import { DailyTask, Project, TaskStatus } from '../types';

interface DailyTimelinePanelProps {
  tasks: DailyTask[];
  projects: Project[];
  onAddTask: (text: string, date: string, timeOfDay?: string) => void;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onAbandonTask?: (taskId: string, note: string) => void;
}

const getLocalYMD = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TIME_OF_DAY_OPTIONS = [
    { label: '上午 (Morning)', value: 'Morning' },
    { label: '中午 (Noon)', value: 'Noon' },
    { label: '下午 (Afternoon)', value: 'Afternoon' },
    { label: '傍晚 (Evening)', value: 'Evening' },
    { label: '晚上 (Night)', value: 'Night' },
    { label: '凌晨 (Late Night)', value: 'Late Night' },
];

const getTimeOrder = (timeOfDay?: string) => {
    const idx = TIME_OF_DAY_OPTIONS.findIndex(opt => opt.value === timeOfDay);
    return idx === -1 ? 0 : idx; // Default to Morning priority if unknown
};

interface MergedItem {
    id: string;
    type: 'log' | 'deadline';
    text: string;
    date: string;
    timeOfDay?: string; // For logs
    source?: string; // For deadlines (Project/Version/Task)
    original?: DailyTask; // For logs
    completed?: boolean; // For logs
    abandoned?: boolean;
    abandonNote?: string;
    createdAt: number;
    breadcrumbs?: string[]; // New: Hierarchy for deadlines
}

export const DailyTimelinePanel: React.FC<DailyTimelinePanelProps> = ({ tasks, projects, onAddTask, onToggleTask, onUpdateTask, onDeleteTask, onAbandonTask }) => {
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [newTaskText, setNewTaskText] = useState('');
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState('Morning');
  
  // Feature Toggles
  const [showDeadlines, setShowDeadlines] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([getLocalYMD(new Date())]));

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Abandonment Modal State
  const [abandoningTaskId, setAbandoningTaskId] = useState<string | null>(null);
  const [abandonNote, setAbandonNote] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const todayStr = useMemo(() => getLocalYMD(new Date()), []);
  const anchorDateStr = useMemo(() => getLocalYMD(anchorDate), [anchorDate]);

  // Expand anchor date automatically when it changes
  useEffect(() => {
      setExpandedDates(prev => {
          const next = new Set(prev);
          next.add(anchorDateStr);
          return next;
      });
  }, [anchorDateStr]);

  // Generate a range of dates around the anchor
  const daysToRender = useMemo(() => {
    const days = [];
    const startOffset = 7;
    const endOffset = -30;

    for (let i = startOffset; i >= endOffset; i--) {
        const d = new Date(anchorDate);
        d.setDate(d.getDate() + i);
        days.push({
            date: d,
            dateStr: getLocalYMD(d),
            isToday: getLocalYMD(d) === todayStr
        });
    }
    return days;
  }, [anchorDate, todayStr]);

  // Scroll to "Today" or Anchor on mount/change if it's in view
  useEffect(() => {
      const anchorStr = getLocalYMD(anchorDate);
      const el = document.getElementById(`day-${anchorStr}`);
      if (el && scrollRef.current) {
          const top = el.offsetTop - scrollRef.current.offsetTop;
          scrollRef.current.scrollTop = top - 100; // Offset for header
      }
  }, [anchorDate]);

  // Extract Deadlines
  const deadlineMap = useMemo(() => {
      if (!showDeadlines) return {};
      const map: Record<string, MergedItem[]> = {};
      
      const pushItem = (date: number, id: string, breadcrumbs: string[]) => {
          const dateStr = getLocalYMD(new Date(date));
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push({
              id,
              type: 'deadline',
              text: breadcrumbs[breadcrumbs.length - 1],
              date: dateStr,
              completed: false,
              createdAt: 0, // Always top or separate logic
              breadcrumbs
          });
      };

      projects.forEach(p => {
          // Skip archived projects
          if (p.isArchived) return;

          if (p.deadline) pushItem(p.deadline, `p-${p.id}`, [p.title]);
          
          p.versions.forEach(v => {
              // Calculate version completion: if it has tasks and all are done, treat as done.
              const isVersionDone = v.tasks.length > 0 && v.tasks.every(t => t.status === TaskStatus.DONE);
              
              if (v.deadline && !isVersionDone) {
                  pushItem(v.deadline, `v-${v.id}`, [p.title, v.title]);
              }

              v.tasks.forEach(t => {
                  // Skip completed tasks
                  if (t.status === TaskStatus.DONE) return;

                  if (t.deadline) pushItem(t.deadline, `t-${t.id}`, [p.title, v.title, t.title]);
                  
                  t.subtasks.forEach(s => {
                      // Skip completed subtasks
                      if (s.status === TaskStatus.DONE) return;

                      if (s.deadline) pushItem(s.deadline, `s-${s.id}`, [p.title, v.title, t.title, s.title]);
                  });
              });
          });
      });
      return map;
  }, [projects, showDeadlines]);

  const handleAdd = () => {
    if (!newTaskText.trim()) return;
    // Add to the currently viewed anchor date
    const targetDateStr = getLocalYMD(anchorDate);
    onAddTask(newTaskText, targetDateStr, selectedTimeOfDay);
    setNewTaskText('');
    // Ensure expanded
    setExpandedDates(prev => new Set(prev).add(targetDateStr));
  };

  const confirmAbandon = (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (abandoningTaskId && onAbandonTask) {
          onAbandonTask(abandoningTaskId, abandonNote);
          setAbandoningTaskId(null);
          setAbandonNote('');
      }
  };

  const handleExport = () => {
      if (tasks.length === 0) return;
      const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleStatusClick = (task: DailyTask) => {
      if (task.abandoned) {
          onToggleTask(task.id);
      } else if (task.completed) {
          setAbandoningTaskId(task.id);
          setAbandonNote(''); 
      } else {
          onToggleTask(task.id);
      }
  };

  const startEditing = (task: DailyTask) => {
      setEditingId(task.id);
      setEditingText(task.text);
  };

  const saveEdit = () => {
      if (editingId) {
        if (editingText.trim()) {
            onUpdateTask(editingId, editingText.trim());
        }
        setEditingId(null);
        setEditingText('');
      }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          const [y, m, d] = e.target.value.split('-').map(Number);
          setAnchorDate(new Date(y, m - 1, d));
      }
  };

  const toggleDayExpanded = (dateStr: string) => {
      setExpandedDates(prev => {
          const next = new Set(prev);
          if (next.has(dateStr)) next.delete(dateStr);
          else next.add(dateStr);
          return next;
      });
  };

  return (
    <div className="flex flex-col border-t border-slate-200 mt-6 pt-4 h-[500px] flex-shrink-0 bg-white/50 rounded-xl border-x-0 md:border-x md:border-b shadow-sm relative">
      
      {/* Abandon Modal Overlay */}
      {abandoningTaskId && ReactDOM.createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" 
            onClick={(e) => {
                e.stopPropagation();
                setAbandoningTaskId(null);
            }}
          >
              <div 
                className="bg-white p-6 rounded-2xl shadow-2xl border border-red-100 w-full max-w-xs animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                  <h4 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2"><AlertOctagon size={20}/> Abandon Task?</h4>
                  <p className="text-sm text-slate-500 mb-3">Why are you giving up on this task?</p>
                  <textarea 
                      autoFocus
                      value={abandonNote}
                      onChange={e => setAbandonNote(e.target.value)}
                      placeholder="Reason (e.g. Changed strategy)..."
                      className="w-full text-sm p-3 border border-slate-200 rounded-xl mb-4 h-24 resize-none outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 bg-red-50/30"
                  />
                  <div className="flex justify-end gap-2">
                      <button 
                        type="button"
                        onClick={() => setAbandoningTaskId(null)} 
                        className="text-sm text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg font-medium transition-colors"
                      >
                        Keep Trying
                      </button>
                      <button 
                        type="button"
                        onClick={confirmAbandon} 
                        className="text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 font-bold shadow-lg shadow-red-200 transition-colors cursor-pointer"
                      >
                        Confirm Abandon
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3 shrink-0">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Calendar size={14} className="text-indigo-500"/> Daily Log
        </h3>
        <div className="flex items-center gap-1">
            <button 
                onClick={() => setShowDeadlines(!showDeadlines)}
                title={showDeadlines ? "Hide Deadlines" : "Show Deadlines"}
                className={`p-1.5 rounded transition-colors flex items-center gap-1 text-[10px] font-medium border ${showDeadlines ? 'bg-amber-50 text-amber-600 border-amber-200' : 'text-slate-400 hover:text-indigo-600 border-transparent hover:bg-indigo-50'}`}
            >
                {showDeadlines ? <Eye size={14}/> : <EyeOff size={14} />} {showDeadlines ? 'DDLs On' : 'DDLs Off'}
            </button>
            <div className="w-px h-3 bg-slate-200 mx-1"></div>
            <button 
                onClick={handleExport}
                title="Export Logs (JSON)"
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            >
                <Download size={14} />
            </button>
            <button 
                onClick={() => setAnchorDate(new Date())} 
                title="Back to Today"
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            >
                <Target size={14} />
            </button>
            <div className="relative">
                <button 
                    onClick={() => dateInputRef.current?.showPicker()} 
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors flex items-center gap-1 text-xs font-medium"
                >
                    {anchorDate.getDate()} <ChevronDown size={12} />
                </button>
                <input 
                    ref={dateInputRef}
                    type="date" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={handleDateChange}
                />
            </div>
        </div>
      </div>

      {/* Timeline Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 custom-scrollbar relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200"></div>
        
        <div className="space-y-4 pb-4">
            {daysToRender.map(day => {
                const dateStr = day.dateStr;
                const isExpanded = expandedDates.has(dateStr);
                const isSelected = dateStr === anchorDateStr;

                // Merge Items
                const logItems: MergedItem[] = tasks.filter(t => t.date === dateStr).map(t => ({
                    id: t.id,
                    type: 'log',
                    text: t.text,
                    date: t.date,
                    timeOfDay: t.timeOfDay,
                    original: t,
                    completed: t.completed,
                    abandoned: t.abandoned,
                    abandonNote: t.abandonNote,
                    createdAt: t.createdAt
                }));

                const ddlItems: MergedItem[] = deadlineMap[dateStr] || [];
                
                // Sorting
                // Logs sorted by time of day, Deadlines put at top.
                const sortedLogs = [...logItems].sort((a, b) => {
                    const orderA = getTimeOrder(a.timeOfDay);
                    const orderB = getTimeOrder(b.timeOfDay);
                    if (orderA !== orderB) return orderA - orderB;
                    return a.createdAt - b.createdAt;
                });

                const allItems = [...ddlItems, ...sortedLogs];
                const hasTasks = allItems.length > 0;
                
                return (
                    <div 
                        key={dateStr} 
                        id={`day-${dateStr}`} 
                        className={`relative pl-10 pr-2 py-2 rounded-xl transition-all duration-300 border ${isSelected ? 'bg-indigo-50/40 border-indigo-100 shadow-sm' : 'border-transparent'} ${day.isToday && !isSelected ? 'opacity-100' : hasTasks || isSelected ? 'opacity-100' : 'opacity-60'}`}
                    >
                        {/* Timeline Node */}
                        <div className={`absolute left-[19px] top-3.5 w-2.5 h-2.5 rounded-full border-2 z-10 bg-white transition-all ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-100 scale-110' : day.isToday ? 'border-indigo-400 ring-2 ring-indigo-50' : hasTasks ? 'border-slate-400' : 'border-slate-200'}`}></div>
                        
                        {/* Date Header + Collapse Toggle */}
                        <div className="flex items-center gap-2 mb-2 cursor-pointer group/header" onClick={() => toggleDayExpanded(dateStr)}>
                            <div className={`transition-transform duration-200 text-slate-400 group-hover/header:text-indigo-500 ${isExpanded ? 'rotate-90' : ''}`}>
                                <ChevronRight size={14} />
                            </div>
                            <span className={`text-xs font-bold transition-colors ${isSelected ? 'text-indigo-700 text-sm' : day.isToday ? 'text-indigo-600' : 'text-slate-600'}`}>
                                {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <span className={`text-[10px] uppercase ${isSelected ? 'text-indigo-500 font-bold' : 'text-slate-400'}`}>
                                {day.isToday ? 'Today' : day.date.toLocaleDateString(undefined, { weekday: 'short' })}
                            </span>
                            {!isExpanded && hasTasks && (
                                <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 rounded-full">{allItems.length}</span>
                            )}
                        </div>

                        {/* Items List (Collapsible) */}
                        {isExpanded && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                {allItems.map(item => {
                                    if (item.type === 'deadline') {
                                        return (
                                            <div key={item.id} className="flex flex-col gap-1 text-xs bg-yellow-50/80 border border-yellow-100 p-1.5 rounded-lg text-amber-900/80">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="p-1 bg-yellow-100 rounded text-amber-600 shrink-0">
                                                        <Flag size={10} fill="currentColor" />
                                                    </div>
                                                    <span className="text-[9px] font-bold text-amber-600 bg-white border border-amber-100 px-1 rounded leading-tight shrink-0">DDL</span>
                                                    
                                                    {/* Render Breadcrumbs */}
                                                    <div className="flex flex-wrap items-center gap-1 text-[10px] leading-tight min-w-0">
                                                         {item.breadcrumbs?.map((crumb, idx) => (
                                                             <React.Fragment key={idx}>
                                                                 {idx > 0 && <span className="text-amber-300">/</span>}
                                                                 <span className={idx === (item.breadcrumbs?.length || 0) - 1 ? "font-bold text-amber-800" : "text-amber-700/60 truncate max-w-[80px]"}>
                                                                     {crumb}
                                                                 </span>
                                                             </React.Fragment>
                                                         ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Render Log Item
                                    const task = item.original!;
                                    return (
                                        <div key={task.id} className={`group flex flex-col gap-1 text-sm bg-white border p-2 rounded-lg shadow-sm transition-all ${task.abandoned ? 'border-red-100 bg-red-50/10' : 'border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
                                            <div className="flex items-start gap-2">
                                                <button 
                                                    onClick={() => handleStatusClick(task)}
                                                    className={`mt-0.5 shrink-0 transition-colors ${task.completed ? 'text-green-500' : task.abandoned ? 'text-red-400' : 'text-slate-300 hover:text-indigo-500'}`}
                                                    title={task.abandoned ? "Reset to Todo" : task.completed ? "Mark Abandoned" : "Mark Complete"}
                                                >
                                                    {task.abandoned ? <Ban size={14} /> : task.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                                                </button>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                        {task.timeOfDay && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-medium">
                                                                {task.timeOfDay}
                                                            </span>
                                                        )}
                                                        
                                                        {editingId === task.id ? (
                                                            <input 
                                                                autoFocus
                                                                value={editingText}
                                                                onChange={(e) => setEditingText(e.target.value)}
                                                                onBlur={() => saveEdit()}
                                                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                                                className="flex-1 text-xs px-1 py-0.5 border border-indigo-300 rounded outline-none"
                                                            />
                                                        ) : (
                                                            <span 
                                                                onClick={() => startEditing(task)}
                                                                className={`text-xs break-words leading-tight cursor-pointer hover:bg-slate-50 rounded px-1 -ml-1 transition-colors ${task.completed ? 'text-slate-400 line-through' : task.abandoned ? 'text-red-400 line-through decoration-red-300' : 'text-slate-700'}`}
                                                            >
                                                                {task.text}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => onDeleteTask(task.id)} 
                                                        className="text-slate-300 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors opacity-50 group-hover:opacity-100"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Abandon Note */}
                                            {task.abandoned && (
                                                <div className="ml-6 text-[10px] text-red-600 bg-red-50 p-1.5 rounded border border-red-100 flex gap-1 items-start">
                                                    <span className="font-bold shrink-0">Reason:</span> 
                                                    <span className="italic">{task.abandonNote || "No reason provided"}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {allItems.length === 0 && (
                                    <div className="text-[10px] text-slate-400 italic pl-1">No tasks yet</div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
            
            <div className="text-center pt-4">
                <button onClick={() => {
                    const newAnchor = new Date(anchorDate);
                    newAnchor.setDate(newAnchor.getDate() - 30);
                    setAnchorDate(newAnchor);
                }} className="text-[10px] text-slate-400 hover:text-indigo-600 bg-slate-50 px-3 py-1 rounded-full">
                    Load Previous
                </button>
            </div>
        </div>
      </div>

      {/* Input Area (Pinned Bottom) */}
      <div className="p-3 border-t border-slate-100 bg-white rounded-b-xl shrink-0 flex flex-col gap-2">
        {/* Date Context Display */}
        <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                Adding to: {anchorDate.toLocaleDateString()}
            </span>
        </div>

        <div className="flex gap-2">
            <select 
                value={selectedTimeOfDay}
                onChange={(e) => setSelectedTimeOfDay(e.target.value)}
                className="text-xs px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white outline-none w-24 shrink-0"
            >
                {TIME_OF_DAY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label.split(' ')[0]}</option>
                ))}
            </select>
            <div className="relative flex-1">
                <input 
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Task description..."
                    className="w-full text-xs pl-3 pr-8 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50 focus:bg-white transition-colors"
                />
                <button 
                    onClick={handleAdd}
                    disabled={!newTaskText.trim()}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-50 hover:bg-slate-100 rounded transition-colors"
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};