import React, { useMemo } from 'react';
import { Subtask, TaskStatus } from '../types';

interface TaskHeatmapProps {
  workLog: Record<string, number>;
  totalMinutes: number;
  subtask?: Subtask; // Pass full subtask to access start/end times
}

const getLocalYMD = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const TaskHeatmap: React.FC<TaskHeatmapProps> = ({ workLog, totalMinutes, subtask }) => {
  
  // Calculate date range
  const { days, rangeStart, rangeEnd } = useMemo(() => {
    // Determine End Date: If done, use completedAt. If not, use Today.
    let endD = new Date();
    if (subtask?.status === TaskStatus.DONE && subtask.completedAt) {
        endD = new Date(subtask.completedAt);
    }
    // Normalize to end of day
    endD.setHours(23, 59, 59, 999);

    // Determine Start Date: Use startTime, fallback to createdAt, fallback to 30 days ago
    let startD = new Date();
    if (subtask?.startTime) {
        startD = new Date(subtask.startTime);
    } else if (subtask?.createdAt) {
        startD = new Date(subtask.createdAt);
    } else {
        startD.setDate(endD.getDate() - 30);
    }
    startD.setHours(0, 0, 0, 0);

    // Safety: ensure start <= end
    if (startD > endD) startD = new Date(endD);

    const result = [];
    const loopDate = new Date(startD);

    // Generate dates from Start to End
    // Cap at 365 days to prevent UI explosion if bad data
    let safetyCounter = 0;
    while (loopDate <= endD && safetyCounter < 365) {
        // Use local date string to match keys in workLog
        const dateKey = getLocalYMD(loopDate);
        const minutes = workLog[dateKey] || 0;
        // Store timestamp for sorting/keying
        result.push({ date: new Date(loopDate), dateKey, minutes });
        
        loopDate.setDate(loopDate.getDate() + 1);
        safetyCounter++;
    }

    return { days: result, rangeStart: startD, rangeEnd: endD };
  }, [workLog, subtask]);

  // Determine color intensity
  const getColor = (minutes: number) => {
    if (minutes === 0) return 'bg-slate-100 border-slate-200';
    if (minutes < 15) return 'bg-indigo-200 border-indigo-300'; // Short burst
    if (minutes < 60) return 'bg-indigo-400 border-indigo-500'; // Solid hour
    if (minutes < 120) return 'bg-indigo-600 border-indigo-700'; // Deep work
    return 'bg-indigo-800 border-indigo-900'; // Intense session
  };

  const getIntensityLabel = (minutes: number) => {
    if (minutes === 0) return 'No activity';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${(minutes / 60).toFixed(1)}h`;
  };

  const LEGEND_ITEMS = [
      { label: '0m', color: 'bg-slate-100 border-slate-200' },
      { label: '< 15m', color: 'bg-indigo-200 border-indigo-300' },
      { label: '< 1h', color: 'bg-indigo-400 border-indigo-500' },
      { label: '< 2h', color: 'bg-indigo-600 border-indigo-700' },
      { label: '2h+', color: 'bg-indigo-800 border-indigo-900' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex flex-col items-center justify-center">
            <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Duration</span>
            <span className="text-sm font-bold text-indigo-900 mt-1">
                {rangeStart.toLocaleDateString()} <span className="text-indigo-400">→</span> {rangeEnd.toLocaleDateString()}
            </span>
         </div>
         <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Effort</span>
            <span className="text-xl font-bold text-slate-700">
                {totalMinutes < 60 ? `${Math.floor(totalMinutes)}m` : `${(totalMinutes/60).toFixed(1)}h`}
            </span>
         </div>
      </div>

      {/* Heatmap Grid */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity Timeline</h4>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-4">
            {days.map((day) => (
                <div 
                    key={day.dateKey} 
                    className={`w-3 h-3 rounded-sm border ${getColor(day.minutes)} transition-all hover:scale-125 hover:z-10 relative group cursor-default`}
                >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center whitespace-nowrap z-20">
                        <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg">
                            <span className="font-bold block">{day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            <span>{getIntensityLabel(day.minutes)}</span>
                        </div>
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-900"></div>
                    </div>
                </div>
            ))}
        </div>
        
        {/* Detailed Legend */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex gap-3">
                {LEGEND_ITEMS.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-sm border ${item.color}`}></div>
                        <span className="text-[10px] text-slate-400 font-medium">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};