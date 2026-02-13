import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Project, TaskStatus } from '../types';
import { Filter } from 'lucide-react';

interface TimeChartProps {
  project: Project;
}

const COLORS = ['#94a3b8', '#3b82f6', '#10b981', '#f59e0b'];

export const TimeChart: React.FC<TimeChartProps> = ({ project }) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>('all');

  const data = useMemo(() => {
    // Filter versions based on selection
    const versionsToAnalyze = selectedVersionId === 'all' 
        ? project.versions 
        : project.versions.filter(v => v.id === selectedVersionId);

    // Calculate raw data preserving version info for labels
    const rawTasks = versionsToAnalyze.flatMap(v => {
        return v.tasks.map(t => {
            const tEst = t.subtasks.reduce((acc, s) => acc + s.estimatedMinutes, 0);
            const tSpent = t.subtasks.reduce((acc, s) => acc + s.completedMinutes, 0);
            const tRemaining = t.subtasks.reduce((acc, s) => {
                if (s.status === TaskStatus.DONE) return acc;
                return acc + Math.max(0, s.estimatedMinutes - s.completedMinutes);
            }, 0);

            return {
                versionTitle: v.title,
                taskTitle: t.title,
                tEst,
                tSpent,
                tRemaining
            };
        });
    }).filter(t => t.tEst > 0 || t.tSpent > 0);

    // Calculate Totals
    const totalEstimated = rawTasks.reduce((acc, t) => acc + t.tEst, 0);
    const totalSpent = rawTasks.reduce((acc, t) => acc + t.tSpent, 0);
    const totalRemainingWork = rawTasks.reduce((acc, t) => acc + t.tRemaining, 0);
    
    // Prepare Bar Chart Data
    const taskData = rawTasks.map(t => {
      let displayName = t.taskTitle;
      // If showing all versions, prefix with version title to distinguish duplicates/context
      if (selectedVersionId === 'all' && project.versions.length > 1) {
          displayName = `${t.versionTitle}: ${t.taskTitle}`;
      }

      return {
        name: displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName,
        fullName: displayName,
        OriginalPlan: parseFloat((t.tEst / 60).toFixed(2)),
        ActualSpent: parseFloat((t.tSpent / 60).toFixed(2)),
      };
    });

    const projectedTotal = totalSpent + totalRemainingWork;

    // Group 3: Pie Chart Data - Distribution of projected effort
    // We want to see: Spent vs Remaining
    const statusData = [
        { name: 'Time Spent', value: totalSpent },
        { name: 'Remaining Work', value: totalRemainingWork }
    ].filter(d => d.value > 0);

    return { totalEstimated, totalSpent, totalRemainingWork, projectedTotal, taskData, statusData };
  }, [project, selectedVersionId]);

  const totalHoursSpent = (data.totalSpent / 60).toFixed(1);
  const totalHoursRemaining = (data.totalRemainingWork / 60).toFixed(1);
  const totalHoursProjected = (data.projectedTotal / 60).toFixed(1);
  const totalHoursOriginal = (data.totalEstimated / 60).toFixed(1);

  // Variance: Positive means over budget, Negative means under budget (efficient)
  const variance = data.projectedTotal - data.totalEstimated;
  const varianceHours = (Math.abs(variance) / 60).toFixed(1);
  const isOverBudget = variance > 0;

  return (
    <div className="space-y-6">
      {/* Version Filter */}
      <div className="flex justify-end items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Filter size={12} /> Filter Stats:
          </label>
          <div className="relative">
            <select
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-indigo-300 transition-colors cursor-pointer"
            >
                <option value="all">All Versions (Total)</option>
                {project.versions.map(v => (
                    <option key={v.id} value={v.id}>{v.title}</option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
            </div>
          </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Actual Invested */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Actual Time Spent</p>
          <p className="text-2xl font-bold text-blue-600">{totalHoursSpent} <span className="text-sm font-normal text-slate-400">hours</span></p>
        </div>

        {/* Card 2: Remaining Work */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Remaining Effort</p>
          <p className="text-2xl font-bold text-amber-500">{totalHoursRemaining} <span className="text-sm font-normal text-slate-400">hours</span></p>
        </div>

        {/* Card 3: Projection vs Plan */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Projected Total Duration</p>
          <div className="flex items-end gap-2">
             <p className={`text-2xl font-bold ${isOverBudget ? 'text-red-500' : 'text-green-600'}`}>
                {totalHoursProjected} <span className="text-sm font-normal text-slate-400">hrs</span>
             </p>
             <span className="text-xs text-slate-400 mb-1.5 pb-0.5 border-l pl-2 border-slate-300">
                Plan: {totalHoursOriginal}h
             </span>
          </div>
          {data.totalEstimated > 0 && Math.abs(variance) > 5 && (
              <p className={`text-xs mt-1 ${isOverBudget ? 'text-red-500' : 'text-green-600'}`}>
                  {isOverBudget ? `Over budget by ${varianceHours}h` : `Under budget by ${varianceHours}h`}
              </p>
          )}
        </div>
      </div>

      {/* Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bar Chart: Planned vs Actual per Task */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Category: Plan vs Actual</h3>
            </div>
            <div className="h-64 w-full">
                {data.taskData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.taskData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  // Find the full name if available
                                  const item = data.taskData.find(t => t.name === label);
                                  const title = item ? item.fullName : label;
                                  return (
                                    <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs">
                                      <p className="font-bold mb-2 text-slate-700">{title}</p>
                                      {payload.map((entry: any) => (
                                        <p key={entry.name} style={{ color: entry.fill }}>
                                          {entry.name}: {entry.value}h
                                        </p>
                                      ))}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                              cursor={{ fill: '#f1f5f9' }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar dataKey="OriginalPlan" name="Planned (h)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="ActualSpent" name="Spent (h)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    {selectedVersionId === 'all' ? "Add tasks to see data" : "No tasks in this version"}
                  </div>
                )}
            </div>
        </div>

        {/* Pie Chart: Spent vs Remaining */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="text-lg font-semibold mb-4 text-slate-800">Completion Status</h3>
             <div className="h-64 w-full flex justify-center items-center">
                {data.statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data.statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                <Cell fill="#3b82f6" /> {/* Spent */}
                                <Cell fill="#f59e0b" /> {/* Remaining */}
                            </Pie>
                            <Tooltip formatter={(value: number) => `${(value / 60).toFixed(1)} hrs`} />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="text-slate-400 text-sm">No data to display</div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
};