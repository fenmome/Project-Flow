import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, FileText, PackageCheck, Layers, Hash, FolderOpen, Target, AlertTriangle, Footprints } from 'lucide-react';
import { Project, WorkSession, Folder } from '../types';

interface WorkLogCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  folders: Folder[];
}

interface EnrichedSession extends WorkSession {
  projectName: string;
  versionTitle: string;
  taskTitle: string;
  subtaskTitle: string;
  folderId?: string;
  folderName?: string;
}

// Helper to get local YYYY-MM-DD string
const getLocalYMD = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Fixed Folder Colors with Static Classes to ensure Tailwind includes them
const FOLDER_THEMES = [
    { 
        id: 'emerald',
        levels: ['bg-emerald-300', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600'],
        bg: 'bg-emerald-500', ring: 'ring-emerald-200', border: 'border-emerald-500'
    },
    { 
        id: 'blue',
        levels: ['bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600'],
        bg: 'bg-blue-500', ring: 'ring-blue-200', border: 'border-blue-500'
    },
    { 
        id: 'violet',
        levels: ['bg-violet-300', 'bg-violet-400', 'bg-violet-500', 'bg-violet-600'],
        bg: 'bg-violet-500', ring: 'ring-violet-200', border: 'border-violet-500'
    },
    { 
        id: 'amber',
        levels: ['bg-amber-300', 'bg-amber-400', 'bg-amber-500', 'bg-amber-600'],
        bg: 'bg-amber-500', ring: 'ring-amber-200', border: 'border-amber-500'
    },
    { 
        id: 'rose',
        levels: ['bg-rose-300', 'bg-rose-400', 'bg-rose-500', 'bg-rose-600'],
        bg: 'bg-rose-500', ring: 'ring-rose-200', border: 'border-rose-500'
    },
    { 
        id: 'cyan',
        levels: ['bg-cyan-300', 'bg-cyan-400', 'bg-cyan-500', 'bg-cyan-600'],
        bg: 'bg-cyan-500', ring: 'ring-cyan-200', border: 'border-cyan-500'
    },
    { 
        id: 'fuchsia',
        levels: ['bg-fuchsia-300', 'bg-fuchsia-400', 'bg-fuchsia-500', 'bg-fuchsia-600'],
        bg: 'bg-fuchsia-500', ring: 'ring-fuchsia-200', border: 'border-fuchsia-500'
    },
];

const DEFAULT_THEME = {
    id: 'slate',
    levels: ['bg-slate-300', 'bg-slate-400', 'bg-slate-500', 'bg-slate-600'],
    bg: 'bg-slate-500', ring: 'ring-slate-200', border: 'border-slate-500'
};

export const WorkLogCalendarModal: React.FC<WorkLogCalendarModalProps> = ({ isOpen, onClose, projects, folders }) => {
  const { t } = useTranslation();
  const [displayDate, setDisplayDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(getLocalYMD(new Date()));

  // Assign colors to folders deterministically
  const folderColorMap = useMemo(() => {
      const map: Record<string, typeof FOLDER_THEMES[0]> = {};
      folders.forEach((f, idx) => {
          map[f.id] = FOLDER_THEMES[idx % FOLDER_THEMES.length];
      });
      // Default for uncategorized
      map['uncategorized'] = DEFAULT_THEME;
      return map;
  }, [folders]);

  // Aggregate stats
  const { dailyStats, sessionMap } = useMemo(() => {
    // Stats structure: { "2023-10-01": { total: 120, byFolder: { "f-1": 60, "f-2": 60 } } }
    const stats: Record<string, { total: number, byFolder: Record<string, number> }> = {};
    const map: Record<string, EnrichedSession[]> = {};

    projects.forEach(project => {
      const pFolderId = project.folderId || 'uncategorized';
      const pFolderName = folders.find(f => f.id === pFolderId)?.name || 'Uncategorized';

      project.versions.forEach(version => {
        version.tasks.forEach(task => {
          task.subtasks.forEach(subtask => {
            if (subtask.sessions) {
              subtask.sessions.forEach(session => {
                const dateKey = getLocalYMD(new Date(session.date));
                
                // Initialize daily entry
                if (!stats[dateKey]) stats[dateKey] = { total: 0, byFolder: {} };
                
                // Update Totals
                stats[dateKey].total += session.duration;
                stats[dateKey].byFolder[pFolderId] = (stats[dateKey].byFolder[pFolderId] || 0) + session.duration;

                // Add to Map
                if (!map[dateKey]) map[dateKey] = [];
                map[dateKey].push({
                  ...session,
                  projectName: project.title,
                  versionTitle: version.title,
                  taskTitle: task.title,
                  subtaskTitle: subtask.title,
                  folderId: pFolderId,
                  folderName: pFolderName
                });
              });
            }
          });
        });
      });
    });

    return { dailyStats: stats, sessionMap: map };
  }, [projects, folders]);

  // Selected Date List (Sorted Newest First)
  const selectedDaySessions = useMemo(() => {
    const list = sessionMap[selectedDateStr] || [];
    return list.sort((a, b) => b.date - a.date);
  }, [sessionMap, selectedDateStr]);

  // Stats for selected day
  const selectedDayStats = useMemo(() => {
      return dailyStats[selectedDateStr] || { total: 0, byFolder: {} };
  }, [dailyStats, selectedDateStr]);

  // Calendar Logic
  const calendarDays = useMemo(() => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [displayDate]);

  const handlePrevMonth = () => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1));
  const handleNextMonth = () => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1));

  // --- Visual Helpers ---

  // Helper to determine segments for the day cell
  const getDaySegments = (dateStr: string) => {
      const stat = dailyStats[dateStr];
      if (!stat || stat.total === 0) return null;

      // Active folders for this day
      const activeFolderIds = Object.keys(stat.byFolder).filter(id => stat.byFolder[id] > 0).sort();
      const count = activeFolderIds.length;

      return activeFolderIds.map(fid => {
          const mins = stat.byFolder[fid];
          // Each folder gets equal width share
          const width = 100 / count;
          
          let level = 0;
          if (mins < 60) level = 0;
          else if (mins < 180) level = 1;
          else if (mins < 300) level = 2;
          else level = 3;

          const theme = folderColorMap[fid] || DEFAULT_THEME;
          
          // Format duration text
          let text = '';
          if (mins < 60) text = `${Math.round(mins)}m`;
          else if (mins % 60 === 0) text = `${mins/60}h`;
          else text = `${(mins/60).toFixed(1)}h`;
          
          return {
              id: fid,
              width: width,
              className: theme.levels[level],
              text
          };
      });
  };

  const getSelectedBorderStyle = () => {
      // Find dominant folder for selected day to color ring
      const stat = dailyStats[selectedDateStr];
      if (!stat || stat.total === 0) return 'ring-slate-400 border-slate-500';

      let maxMins = -1;
      let domFolderId = 'uncategorized';
      Object.entries(stat.byFolder).forEach(([fid, val]) => {
          const mins = val as number;
          if (mins > maxMins) {
              maxMins = mins;
              domFolderId = fid;
          }
      });

      const theme = folderColorMap[domFolderId] || DEFAULT_THEME;
      return `${theme.ring} ${theme.border}`;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[800px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar: Header */}
        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <CalendarIcon className="text-indigo-600" /> {t('modals.calendar.title')}
             </h2>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Left: Calendar */}
            <div className="w-full md:w-7/12 border-r border-slate-200 flex flex-col bg-white">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-white hover:shadow-sm rounded"><ChevronLeft size={16}/></button>
                    <span className="text-sm font-bold w-32 text-center text-slate-700">
                        {displayDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-white hover:shadow-sm rounded"><ChevronRight size={16}/></button>
                </div>
                
                {/* Mini Legend */}
                <div className="flex gap-2 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-200 rounded"></div> 0h</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded"></div> &lt;1h</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-400 rounded"></div> &lt;3h</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-600 rounded"></div> 5h+</div>
                </div>
            </div>

            <div className="p-6 pt-0 flex-1 flex flex-col">
                <div className="grid grid-cols-7 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2 auto-rows-fr flex-1">
                    {calendarDays.map((date, idx) => {
                        if (!date) return <div key={`empty-${idx}`} />;
                        
                        const dateStr = getLocalYMD(date);
                        const isSelected = dateStr === selectedDateStr;
                        const isToday = dateStr === getLocalYMD(new Date());
                        
                        // Get visual segments for the heatmap
                        const segments = getDaySegments(dateStr);

                        return (
                            <button
                                key={dateStr}
                                onClick={() => setSelectedDateStr(dateStr)}
                                className={`
                                    relative rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden border-2
                                    ${!segments ? 'bg-slate-50 border-transparent hover:bg-slate-100' : 'border-transparent'}
                                    ${isSelected ? `ring-2 z-10 scale-105 ${getSelectedBorderStyle()}` : ''}
                                    ${isToday && !isSelected ? 'border-indigo-300' : ''}
                                `}
                            >
                                {/* Heatmap Background Segments */}
                                {segments && (
                                    <div className="absolute inset-0 flex w-full h-full opacity-90 hover:opacity-100 transition-opacity">
                                        {segments.map(seg => (
                                            <div 
                                                key={seg.id} 
                                                className={`${seg.className} h-full transition-all flex items-end justify-center pb-1 border-r border-white/20 last:border-0`} 
                                                style={{ width: `${seg.width}%` }} 
                                            >
                                                <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-0.5 leading-none">
                                                    {seg.text}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Date Number - Moved to top right to avoid overlap with bottom text */}
                                <span className={`absolute top-1.5 left-1.5 z-10 text-sm font-bold ${segments ? 'text-white drop-shadow-md' : 'text-slate-400'}`}>
                                    {date.getDate()}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
            </div>

            {/* Right: Timeline & Breakdown */}
            <div className="w-full md:w-5/12 flex flex-col bg-slate-50">
                <div className="p-6 border-b border-slate-200 bg-white shadow-sm z-10">
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {new Date(selectedDateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    
                    {/* Main Total */}
                    <div className="flex items-baseline gap-3 mb-4">
                        <h3 className="text-4xl font-bold text-slate-800">
                            {selectedDayStats.total > 0 ? (selectedDayStats.total / 60).toFixed(1) : '0'} 
                            <span className="text-lg font-medium text-slate-400 ml-1">{t('modals.calendar.hours')}</span>
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">
                            {selectedDaySessions.length} {t('modals.calendar.sessions')}
                        </span>
                    </div>

                    {/* Folder Breakdown */}
                    {Object.keys(selectedDayStats.byFolder).length > 0 && (
                        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {Object.entries(selectedDayStats.byFolder).map(([folderId, mins]) => {
                                const folder = folders.find(f => f.id === folderId);
                                const theme = folderColorMap[folderId] || DEFAULT_THEME;
                                const minutes = mins as number;
                                const percent = Math.round((minutes / selectedDayStats.total) * 100);
                                
                                // Get the representative color for the bar
                                const barColorClass = theme.levels[2];

                                return (
                                    <div key={folderId} className="flex items-center gap-3 text-sm">
                                        <div className={`w-2.5 h-2.5 rounded-full ${theme.bg}`}></div>
                                        <span className="text-slate-600 flex-1 truncate">{folder?.name || t('sidebar.uncategorized')}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className={`h-full ${barColorClass.split(' ')[0]}`} style={{ width: `${percent}%` }}></div>
                                            </div>
                                            <span className="font-bold text-slate-800 w-10 text-right">{(minutes/60).toFixed(1)}h</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
                    {selectedDaySessions.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                            <Clock size={48} className="mb-2 stroke-1"/>
                            <p className="text-sm font-medium">{t('modals.calendar.noActivity')}</p>
                        </div>
                    ) : (
                        selectedDaySessions.map((session, idx) => {
                            const theme = folderColorMap[session.folderId || 'uncategorized'] || DEFAULT_THEME;
                            return (
                                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                    {/* Top Row: Time & Duration */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                                                <Clock size={14} className="text-indigo-500" />
                                                {new Date(session.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                {session.timeOfDay && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">{session.timeOfDay}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${theme.levels[0]} border-transparent text-slate-700`}>
                                                {session.duration} min
                                            </span>
                                        </div>
                                    </div>

                                    {/* Middle: Breadcrumb Context with Folder Badge */}
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2 flex-wrap">
                                        {/* Folder Badge */}
                                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${theme.levels[0]} ${theme.border} bg-opacity-20 text-slate-600`}>
                                            <FolderOpen size={10}/> {session.folderName}
                                        </span>
                                        <span className="text-slate-300">|</span>
                                        <span className="flex items-center gap-1"><Layers size={10}/> {session.projectName}</span>
                                        <span>/</span>
                                        <span className="text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded">{session.taskTitle}</span>
                                    </div>

                                    {/* Main: Subtask Title */}
                                    <div className="font-bold text-slate-800 text-sm mb-3">
                                        {session.subtaskTitle}
                                    </div>

                                    {/* Detailed Sections: Goal, Output, Problems, Next Steps */}
                                    <div className="space-y-2">
                                        {/* Goal */}
                                        {session.goal && (
                                            <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 flex items-start gap-2">
                                                <Target size={14} className="shrink-0 text-indigo-500 mt-0.5"/>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Goal</span>
                                                    <p className="text-xs text-slate-700 leading-relaxed">{session.goal}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Output */}
                                        {session.output && (
                                            <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100 flex items-start gap-2">
                                                <PackageCheck size={14} className="shrink-0 text-emerald-500 mt-0.5"/>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Output</span>
                                                    <p className="text-xs text-slate-700 leading-relaxed">{session.output}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Problems */}
                                        {session.problems && (
                                            <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 flex items-start gap-2">
                                                <AlertTriangle size={14} className="shrink-0 text-rose-500 mt-0.5"/>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-rose-400 uppercase">Blockers</span>
                                                    <p className="text-xs text-slate-700 leading-relaxed">{session.problems}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Next Steps */}
                                        {session.nextSteps && (
                                            <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 flex items-start gap-2">
                                                <Footprints size={14} className="shrink-0 text-blue-500 mt-0.5"/>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-blue-400 uppercase">Next Steps</span>
                                                    <p className="text-xs text-slate-700 leading-relaxed">{session.nextSteps}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer: Tags & Notes */}
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                                        <div className="flex flex-wrap gap-1">
                                            {session.tags?.map(t => (
                                                <span key={t} className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                                    <Hash size={9}/> {t}
                                                </span>
                                            ))}
                                        </div>
                                        {session.notes && (
                                            <div className="text-slate-400 group-hover:text-slate-600 transition-colors" title={session.notes}>
                                                <FileText size={14} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};