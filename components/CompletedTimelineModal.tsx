
import React, { useState, useMemo, useEffect } from 'react';
import { X, CheckCircle2, Search, Clock, ChevronDown, ChevronRight, Layers, FolderOpen, Timer } from 'lucide-react';
import { Project, TaskStatus } from '../types';

interface CompletedTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
}

interface CompletedItem {
  id: string;
  title: string;
  completedAt: number;
  projectName: string;
  versionTitle: string;
  taskTitle: string;
  timeSpent: number;
}

export const CompletedTimelineModal: React.FC<CompletedTimelineModalProps> = ({ isOpen, onClose, projects }) => {
  const [targetDate, setTargetDate] = useState('');
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  // 1. Extract and Flatten Data
  const timelineData = useMemo(() => {
    const items: CompletedItem[] = [];

    projects.forEach(p => {
      // Check active tasks
      p.versions.forEach(v => {
        v.tasks.forEach(t => {
          t.subtasks.forEach(s => {
            if (s.status === TaskStatus.DONE && s.completedAt) {
              items.push({
                id: s.id,
                title: s.title,
                completedAt: s.completedAt,
                projectName: p.title,
                versionTitle: v.title,
                taskTitle: t.title,
                timeSpent: s.completedMinutes || 0
              });
            }
          });
        });
      });
      
      // Check Todo List (ProjectTodos) - skipping for now as they lack detailed metadata like timeSpent/completedAt in consistent way
    });

    // Sort descending (newest first)
    return items.sort((a, b) => b.completedAt - a.completedAt);
  }, [projects]);

  // 2. Group by Date
  const groupedData = useMemo(() => {
    const groups: Record<string, CompletedItem[]> = {};
    timelineData.forEach(item => {
      const dateKey = new Date(item.completedAt).toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [timelineData]);

  // Sort dates descending
  const sortedDates = Object.keys(groupedData).sort((a, b) => b.localeCompare(a));

  // 3. Scroll Handler
  const handleJumpToDate = () => {
    if (!targetDate) return;
    
    // Try to find exact match
    let element = document.getElementById(`timeline-date-${targetDate}`);
    
    // If exact match not found, find the closest date in the list that is BEFORE or ON the target date
    if (!element) {
       const found = sortedDates.find(d => d <= targetDate);
       if (found) {
           element = document.getElementById(`timeline-date-${found}`);
       }
    }

    if (element) {
      // Ensure the target date is expanded if we jump to it
      const dateKey = element.id.replace('timeline-date-', '');
      setCollapsedDates(prev => {
          const next = new Set(prev);
          next.delete(dateKey);
          return next;
      });
      setTimeout(() => element?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } else {
        alert("No completed tasks found around this date.");
    }
  };

  useEffect(() => {
      if(isOpen && sortedDates.length > 0) {
          // Reset picker to latest date available
          setTargetDate(sortedDates[0]);
      }
  }, [isOpen, sortedDates]);

  const toggleDateCollapse = (dateKey: string) => {
      setCollapsedDates(prev => {
          const next = new Set(prev);
          if (next.has(dateKey)) next.delete(dateKey);
          else next.add(dateKey);
          return next;
      });
  };

  const formatTimeSpent = (minutes: number) => {
      if (minutes < 1) return '< 1m';
      if (minutes < 60) return `${Math.floor(minutes)}m`;
      return `${(minutes / 60).toFixed(1)}h`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                <CheckCircle2 size={24} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">Completion Timeline</h2>
                <p className="text-xs text-slate-500">A history of everything you've accomplished.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <input 
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="text-xs border-none outline-none text-slate-600 bg-transparent px-2"
            />
            <button 
                onClick={handleJumpToDate}
                className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors"
                title="Jump to date"
            >
                <Search size={16} />
            </button>
          </div>

          <button onClick={onClose} className="ml-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar relative">
            {timelineData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                    <CheckCircle2 size={48} className="mb-4 stroke-1"/>
                    <p>No completed tasks yet. Keep going!</p>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto relative border-l-2 border-slate-100 space-y-6 pl-6 pb-10 ml-4">
                    {sortedDates.map(dateKey => {
                        const isCollapsed = collapsedDates.has(dateKey);
                        const items = groupedData[dateKey];
                        
                        return (
                            <div key={dateKey} id={`timeline-date-${dateKey}`} className="relative">
                                {/* Date Node */}
                                <div 
                                    onClick={() => toggleDateCollapse(dateKey)}
                                    className="absolute -left-[35px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-emerald-500 z-10 cursor-pointer hover:scale-110 transition-transform shadow-sm"
                                >
                                    <div className={`w-2 h-2 rounded-full bg-emerald-500 transition-opacity ${isCollapsed ? 'opacity-50' : 'opacity-100'}`}></div>
                                </div>
                                
                                {/* Date Header */}
                                <div 
                                    className="flex items-center gap-2 mb-3 cursor-pointer group select-none"
                                    onClick={() => toggleDateCollapse(dateKey)}
                                >
                                    <span className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors">
                                        {isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
                                        {new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        <span className="text-slate-400 font-normal ml-1">({items.length})</span>
                                    </span>
                                    {isCollapsed && (
                                        <div className="h-px flex-1 bg-slate-100"></div>
                                    )}
                                </div>

                                {/* Items List */}
                                {!isCollapsed && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        {items.map(item => (
                                            <div key={item.id} className="group flex items-center gap-3 bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-sm rounded-lg p-2 transition-all">
                                                {/* Time */}
                                                <div className="flex items-center gap-1 text-xs font-mono text-slate-400 min-w-[60px]">
                                                    <Clock size={12} className="opacity-70"/>
                                                    {new Date(item.completedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </div>

                                                {/* Vertical Separator */}
                                                <div className="w-px h-4 bg-slate-100"></div>

                                                {/* Task Title & Breadcrumbs */}
                                                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-bold text-slate-700 truncate max-w-full">
                                                        {item.title}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 max-w-full truncate">
                                                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-1">
                                                            <Layers size={10}/> {item.projectName}
                                                        </span>
                                                        <span className="text-slate-300">/</span>
                                                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-1">
                                                            <FolderOpen size={10}/> {item.taskTitle}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Duration Badge */}
                                                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold border border-emerald-100 shrink-0">
                                                    <Timer size={12}/>
                                                    {formatTimeSpent(item.timeSpent)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
