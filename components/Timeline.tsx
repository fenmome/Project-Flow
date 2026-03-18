import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project, TaskStatus, Subtask } from '../types';
import { Calendar as CalendarIcon, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Clock, History, TrendingUp, BarChart2, PackageCheck } from 'lucide-react';

interface TimelineProps {
  project: Project;
}

interface DaySchedule {
  date: Date;
  dateStr: string;
  tasks: {
    taskName: string;
    subtaskName: string;
    minutesAllocated: number;
    isFinished: boolean;
  }[];
  totalMinutes: number;
}

interface ActiveTaskContext {
  taskTitle: string;
  subtask: Subtask;
  remaining: number;
}

export const Timeline: React.FC<TimelineProps> = ({ project }) => {
  const { t } = useTranslation();
  const [displayDate, setDisplayDate] = useState(new Date());
  
  // Helper to get local YYYY-MM-DD
  const getDateKey = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [selectedDateStr, setSelectedDateStr] = useState<string>(getDateKey(new Date()));

  // --- FORECAST LOGIC ---
  const scheduleMap = useMemo(() => {
    const dailyMinutes = project.dailyWorkMinutes || 120;
    const map = new Map<string, DaySchedule>();
    
    // Flatten active tasks from all versions
    const activeTasks: ActiveTaskContext[] = [];
    project.versions.forEach(v => {
        v.tasks.forEach(t => {
            t.subtasks.forEach(s => {
                if (s.status !== TaskStatus.DONE) {
                    const remaining = Math.max(0, s.estimatedMinutes - s.completedMinutes);
                    if (remaining > 0) {
                        activeTasks.push({ taskTitle: `${v.title} > ${t.title}`, subtask: s, remaining });
                    }
                }
            });
        });
    });

    if (activeTasks.length === 0) return map;

    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    let currentDayMinutesUsed = 0;
    let currentDayTasks: DaySchedule['tasks'] = [];

    let taskIndex = 0;
    const MAX_DAYS = 365; // Project up to a year
    let dayCount = 0;

    while (taskIndex < activeTasks.length && dayCount < MAX_DAYS) {
      const currentTask = activeTasks[taskIndex];
      const capacityToday = dailyMinutes - currentDayMinutesUsed;

      if (capacityToday <= 0) {
        // Day is full, save and move next
        const key = getDateKey(currentDate);
        map.set(key, {
          date: new Date(currentDate),
          dateStr: key,
          tasks: currentDayTasks,
          totalMinutes: currentDayMinutesUsed
        });

        currentDate.setDate(currentDate.getDate() + 1);
        currentDayMinutesUsed = 0;
        currentDayTasks = [];
        dayCount++;
        continue;
      }

      const allocatable = Math.min(currentTask.remaining, capacityToday);
      
      currentDayTasks.push({
        taskName: currentTask.taskTitle,
        subtaskName: currentTask.subtask.title,
        minutesAllocated: allocatable,
        isFinished: allocatable >= currentTask.remaining - 0.01 // tolerance
      });

      currentTask.remaining -= allocatable;
      currentDayMinutesUsed += allocatable;

      if (currentTask.remaining <= 0.01) {
        taskIndex++;
      }
    }

    // Push the last partial day
    if (currentDayTasks.length > 0) {
        const key = getDateKey(currentDate);
        map.set(key, {
          date: new Date(currentDate),
          dateStr: key,
          tasks: currentDayTasks,
          totalMinutes: currentDayMinutesUsed
        });
    }

    return map;
  }, [project]);

  // --- HISTORY LOGIC ---
  const historyMap = useMemo(() => {
    const map = new Map<string, { totalMinutes: number, tasks: { taskTitle: string, subtaskTitle: string, minutes: number, output?: string }[] }>();

    project.versions.forEach(version => {
        version.tasks.forEach(task => {
            task.subtasks.forEach(subtask => {
                if (subtask.workLog) {
                Object.entries(subtask.workLog).forEach(([date, val]) => {
                    const minutes = val as number;
                    if (minutes > 0) {
                    const dateStr = date; 
                    if (!map.has(dateStr)) {
                        map.set(dateStr, { totalMinutes: 0, tasks: [] });
                    }
                    const entry = map.get(dateStr)!;
                    entry.totalMinutes += minutes;
                    
                    // Find output from sessions for this day
                    const sessionOutput = subtask.sessions?.find(s => {
                        const sDateKey = new Date(s.date).toISOString().split('T')[0];
                        return sDateKey === dateStr && s.output;
                    })?.output;

                    entry.tasks.push({
                        taskTitle: `${version.title} > ${task.title}`,
                        subtaskTitle: subtask.title,
                        minutes: minutes,
                        output: sessionOutput
                    });
                    }
                });
                }
            });
        });
    });
    return map;
  }, [project]);

  // Calendar Grid
  const calendarDays = useMemo(() => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    const days = [];
    
    // Padding
    for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null);
    }
    
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }
    
    return days;
  }, [displayDate]);

  const handlePrevMonth = () => {
    setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1));
  };

  const todayStr = getDateKey(new Date());
  
  const getWeekdays = () => [
    t('time.sun'), t('time.mon'), t('time.tue'), t('time.wed'), t('time.thu'), t('time.fri'), t('time.sat')
  ];

  // Color Helpers - Fixed 0-8h Scale
  // Buckets:
  // 0 < m < 2h (120m) -> 200
  // 2h <= m < 4h (240m) -> 300
  // 4h <= m < 6h (360m) -> 400
  // 6h <= m < 8h (480m) -> 600
  // m >= 8h -> 800

  const getHistoryColor = (minutes: number) => {
    if (minutes <= 0) return 'bg-transparent';
    if (minutes < 120) return 'bg-emerald-200';
    if (minutes < 240) return 'bg-emerald-300';
    if (minutes < 360) return 'bg-emerald-400';
    if (minutes < 480) return 'bg-emerald-600';
    return 'bg-emerald-800';
  };

  const getForecastColor = (minutes: number) => {
    if (minutes <= 0) return 'bg-transparent';
    if (minutes < 120) return 'bg-indigo-200';
    if (minutes < 240) return 'bg-indigo-300';
    if (minutes < 360) return 'bg-indigo-400';
    if (minutes < 480) return 'bg-indigo-600';
    return 'bg-indigo-800';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon size={18} className="text-indigo-600"/>
                {t('timeline.unifiedTimeline')}
            </h3>
        </div>

        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-50 rounded text-slate-500"><ChevronLeft size={16}/></button>
            <span className="text-xs font-bold w-24 text-center text-slate-700 select-none">
                {displayDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-slate-50 rounded text-slate-500"><ChevronRight size={16}/></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
          {/* Left: Calendar Grid */}
          <div className="w-1/2 p-4 border-r border-slate-100 flex flex-col">
             {/* Weekday Header */}
             <div className="grid grid-cols-7 mb-2">
                 {getWeekdays().map(d => (
                     <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1 uppercase tracking-wider">{d}</div>
                 ))}
             </div>
             {/* Days Grid */}
             <div className="grid grid-cols-7 gap-1 auto-rows-fr flex-1">
                 {calendarDays.map((date, i) => {
                     if (!date) return <div key={`empty-${i}`} className="p-1" />;
                     
                     const dateKey = getDateKey(date);
                     const isSelected = dateKey === selectedDateStr;
                     const isToday = dateKey === todayStr;
                     const isPast = dateKey < todayStr;
                     const isFuture = dateKey > todayStr;
                     
                     // Data Check
                     const schedule = scheduleMap.get(dateKey);
                     const history = historyMap.get(dateKey);
                     
                     const histMinutes = history ? history.totalMinutes : 0;
                     const schedMinutes = schedule ? schedule.totalMinutes : 0;

                     return (
                         <button 
                            key={dateKey}
                            onClick={() => setSelectedDateStr(dateKey)}
                            className={`
                                relative rounded-lg flex items-center justify-center transition-all overflow-hidden border
                                ${isSelected ? 'ring-2 ring-slate-800 border-transparent z-10' : 'border-transparent hover:bg-slate-50'}
                                ${isToday ? 'ring-1 ring-indigo-400' : ''}
                            `}
                         >
                             {/* Background Split / Full */}
                             <div className="absolute inset-0 flex">
                                 {/* History (Green) - Show on Past & Today */}
                                 {(isPast || isToday) && (
                                     <div 
                                        className={`${isToday ? 'w-1/2' : 'w-full'} h-full transition-colors ${getHistoryColor(histMinutes)}`} 
                                     />
                                 )}
                                 {/* Forecast (Indigo) - Show on Future & Today */}
                                 {(isFuture || isToday) && (
                                     <div 
                                        className={`${isToday ? 'w-1/2' : 'w-full'} h-full transition-colors ${getForecastColor(schedMinutes)}`} 
                                     />
                                 )}
                             </div>

                             {/* Date Number */}
                             <span className={`relative text-xs z-10 ${isToday ? 'font-bold text-indigo-700' : 'text-slate-600'}`}>
                                 {date.getDate()}
                             </span>
                             
                             {/* Overdue Dot (Top Right) */}
                             {project.deadline && date.getTime() > project.deadline && schedMinutes > 0 && (
                                <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-red-500 z-10"></div>
                             )}
                         </button>
                     );
                 })}
             </div>
             
             {/* Detailed Legend */}
             <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-3">
                 <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('timeline.legend')}</span>
                    <span className="text-[10px] text-slate-400">{t('timeline.duration')}</span>
                 </div>
                 
                 <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[10px]">
                    <span className="text-slate-500 font-medium self-center">{t('timeline.history')}</span>
                    <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded bg-emerald-200 flex items-center justify-center text-[8px] text-emerald-700 cursor-help" title="< 2 hours"></div>
                        <div className="w-5 h-5 rounded bg-emerald-300 flex items-center justify-center text-[8px] text-emerald-800 cursor-help" title="2 - 4 hours"></div>
                        <div className="w-5 h-5 rounded bg-emerald-400 flex items-center justify-center text-[8px] text-white cursor-help" title="4 - 6 hours"></div>
                        <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center text-[8px] text-white cursor-help" title="6 - 8 hours"></div>
                        <div className="w-5 h-5 rounded bg-emerald-800 flex items-center justify-center text-[8px] text-white cursor-help" title="8+ hours"></div>
                    </div>

                    <span className="text-slate-500 font-medium self-center">{t('timeline.forecast')}</span>
                    <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded bg-indigo-200 flex items-center justify-center text-[8px] text-indigo-700 cursor-help" title="< 2 hours"></div>
                        <div className="w-5 h-5 rounded bg-indigo-300 flex items-center justify-center text-[8px] text-indigo-800 cursor-help" title="2 - 4 hours"></div>
                        <div className="w-5 h-5 rounded bg-indigo-400 flex items-center justify-center text-[8px] text-white cursor-help" title="4 - 6 hours"></div>
                        <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-[8px] text-white cursor-help" title="6 - 8 hours"></div>
                        <div className="w-5 h-5 rounded bg-indigo-800 flex items-center justify-center text-[8px] text-white cursor-help" title="8+ hours"></div>
                    </div>
                 </div>

                 <div className="flex justify-between px-1 text-[9px] text-slate-400">
                    <span className="pl-14">&lt;2h</span>
                    <span>&lt;4h</span>
                    <span>&lt;6h</span>
                    <span>&lt;8h</span>
                    <span>8h+</span>
                 </div>
             </div>
          </div>

          {/* Right: Day Detail */}
          <div className="w-1/2 flex flex-col bg-slate-50/50">
             <div className="p-4 border-b border-slate-100 bg-white">
                 <h4 className="font-bold text-slate-800 flex flex-col">
                     <span className="text-sm">
                        {new Date(selectedDateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                     </span>
                     <span className="text-xs font-semibold text-slate-400 mt-0.5">
                        {t('timeline.dailyOverview')}
                     </span>
                 </h4>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                 {/* Logic to retrieve data */}
                 {(() => {
                    const schedule = scheduleMap.get(selectedDateStr);
                    const history = historyMap.get(selectedDateStr);

                    if (!schedule && !history) return <EmptyState />;

                    return (
                        <>
                            {/* History Section */}
                            {history && (
                                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1">
                                            <History size={14}/> {t('timeline.workLogged')}
                                        </h5>
                                        <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                            {(history.totalMinutes / 60).toFixed(1)}h
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {history.tasks.map((task, idx) => (
                                            <div key={idx} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm hover:border-emerald-300 transition-colors">
                                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 truncate">{task.taskTitle}</div>
                                                <div className="font-medium text-slate-800 text-sm">{task.subtaskTitle}</div>
                                                <div className="flex justify-between items-end mt-2">
                                                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                        <Clock size={10} /> <strong>{Math.floor(task.minutes)}m</strong>
                                                    </div>
                                                </div>
                                                {task.output && (
                                                    <div className="mt-2 text-[10px] text-slate-500 flex items-start gap-1 bg-slate-50 p-1.5 rounded">
                                                        <PackageCheck size={12} className="shrink-0 mt-0.5"/> 
                                                        <span className="line-clamp-2">{task.output}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Divider if both exist */}
                            {history && schedule && (
                                <div className="border-t border-slate-200"></div>
                            )}

                            {/* Forecast Section */}
                            {schedule && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-xs font-bold text-indigo-700 uppercase flex items-center gap-1">
                                            <TrendingUp size={14}/> {t('timeline.plannedTasks')}
                                        </h5>
                                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                            {(schedule.totalMinutes / 60).toFixed(1)}h
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {schedule.tasks.map((task, idx) => (
                                            <div key={idx} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm hover:border-indigo-300 transition-colors relative overflow-hidden">
                                                {task.isFinished && (
                                                    <div className="absolute right-0 top-0 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded-bl font-bold">
                                                        {t('timeline.done')}
                                                    </div>
                                                )}
                                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 truncate">{task.taskName}</div>
                                                <div className="font-medium text-slate-800 text-sm mb-2">{task.subtaskName}</div>
                                                <div className="flex items-center gap-2 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
                                                    <Clock size={10} />
                                                    <span>Allocated: <strong>{Math.floor(task.minutesAllocated)}m</strong></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    );
                 })()}
             </div>
          </div>
      </div>
    </div>
  );
};

const EmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
        <div className="p-3 rounded-full mb-2 bg-slate-100 text-slate-300">
            <CalendarIcon size={24} />
        </div>
        <p className="text-sm font-medium text-slate-500">
            No activity or plans
        </p>
        <p className="text-xs mt-1 text-slate-400 max-w-[150px]">
            Select a date to see details.
        </p>
    </div>
);
