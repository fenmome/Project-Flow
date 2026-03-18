import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Clock, Tag, Star, Save, Trash2, Edit2, History, Plus, PackageCheck, Sun, Moon, Sunset, Sunrise, ClipboardList, Frown, Meh, Smile, Laugh, Angry, BrainCircuit, AlertOctagon, HeartCrack, ZapOff, Hourglass as HourglassIcon, AlertTriangle, Footprints, Target } from 'lucide-react';
import { Subtask, WorkSession } from '../types';

interface WorkSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtask: Subtask;
  allProjectTags: string[]; // Passed from App to suggest tags
  onSaveSession: (session: WorkSession) => void;
  onUpdateSession: (sessionId: string, updates: Partial<WorkSession>) => void;
  onDeleteSession: (sessionId: string) => void;
  initialDuration?: number;
}

const TIME_PERIODS = [
  { id: 'Early Morning', label: '清晨', icon: Sunrise, range: [4, 8] },
  { id: 'Morning', label: '上午', icon: Sun, range: [8, 12] },
  { id: 'Noon', label: '中午', icon: Sun, range: [12, 14] },
  { id: 'Afternoon', label: '下午', icon: Sun, range: [14, 18] },
  { id: 'Evening', label: '傍晚', icon: Sunset, range: [18, 20] },
  { id: 'Night', label: '晚上', icon: Moon, range: [20, 24] },
  { id: 'Late Night', label: '凌晨', icon: Moon, range: [0, 4] },
];

const VARIANCE_REASONS = [
  { id: 'Underestimated', label: '低估难度', icon: BrainCircuit, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'Technical Blocker', label: '技术卡点', icon: AlertOctagon, color: 'text-red-600 bg-red-50 border-red-200' },
  { id: 'Perfectionism', label: '完美主义', icon: ZapOff, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'Emotional Friction', label: '情绪内耗', icon: HeartCrack, color: 'text-pink-600 bg-pink-50 border-pink-200' },
  { id: 'Interruptions', label: '外部打断', icon: HourglassIcon, color: 'text-blue-600 bg-blue-50 border-blue-200' },
];

const SATISFACTION_LEVELS = [
    { score: 1, icon: Angry, label: 'Very Bad' },
    { score: 2, icon: Frown, label: 'Bad' },
    { score: 3, icon: Meh, label: 'Okay' },
    { score: 4, icon: Smile, label: 'Good' },
    { score: 5, icon: Laugh, label: 'Great' },
];

// Helper to get local YYYY-MM-DD string correctly
const getLocalDateStr = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const WorkSessionModal: React.FC<WorkSessionModalProps> = ({
  isOpen,
  onClose,
  subtask,
  allProjectTags,
  onSaveSession,
  onUpdateSession,
  onDeleteSession,
  initialDuration
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState(getLocalDateStr());
  // Store exact time (HH:mm:ss) to preserve sort order or capture open time
  const [entryTime, setEntryTime] = useState<Date>(new Date());
  
  const [duration, setDuration] = useState(initialDuration || 30);
  const [predictedDuration, setPredictedDuration] = useState<number>(initialDuration || 30); // Default prediction matches actual usually
  const [timeOfDay, setTimeOfDay] = useState('Morning');
  const [goal, setGoal] = useState('');
  const [output, setOutput] = useState('');
  const [problems, setProblems] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [focusScore, setFocusScore] = useState(3);
  const [satisfactionScore, setSatisfactionScore] = useState(3);
  const [varianceReasons, setVarianceReasons] = useState<string[]>([]);
  const [newVarianceInput, setNewVarianceInput] = useState('');
  const [notes, setNotes] = useState('');

  // Default Tags if project is empty
  const DEFAULT_TAGS = ['Creation', 'Optimization', 'Review', 'Admin', 'Research'];
  const suggestTags = useMemo(() => {
    const combined = new Set([...DEFAULT_TAGS, ...allProjectTags]);
    return Array.from(combined).filter(t => !selectedTags.includes(t));
  }, [allProjectTags, selectedTags]);

  const getAutoTimePeriod = () => {
    const hour = new Date().getHours();
    const period = TIME_PERIODS.find(p => {
        if (p.id === 'Late Night' && hour >= 0 && hour < 4) return true;
        return hour >= p.range[0] && hour < p.range[1];
    });
    return period ? period.id : 'Morning';
  };

  useEffect(() => {
    if (isOpen) {
        // Reset form on open
        resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    const now = new Date();
    setEntryTime(now); // Capture current precise time
    setDate(getLocalDateStr(now));
    
    setDuration(initialDuration || 30);
    setPredictedDuration(initialDuration || 30);
    setTimeOfDay(getAutoTimePeriod());
    setGoal('');
    setOutput('');
    setProblems('');
    setNextSteps('');
    setSelectedTags([]);
    setFocusScore(3);
    setSatisfactionScore(3);
    setVarianceReasons([]);
    setNewVarianceInput('');
    setNotes('');
    setEditingSessionId(null);
    setNewTagInput('');
  };

  const handleEditClick = (session: WorkSession) => {
    const d = new Date(session.date);
    setEntryTime(d); // Preserve existing exact time
    setDate(getLocalDateStr(d));
    
    setDuration(session.duration);
    setPredictedDuration(session.predictedDuration || session.duration);
    setTimeOfDay(session.timeOfDay || 'Morning');
    setGoal(session.goal || '');
    setOutput(session.output || '');
    setProblems(session.problems || '');
    setNextSteps(session.nextSteps || '');
    setSelectedTags(session.tags || []);
    setFocusScore(session.focusScore);
    setSatisfactionScore(session.satisfactionScore || 3);
    setVarianceReasons(session.varianceReasons || []);
    setNotes(session.notes || '');
    setEditingSessionId(session.id);
    setActiveTab('log');
  };

  const handleSubmit = () => {
    if (duration <= 0) return;

    // Reconstruct timestamp combining selected date (YYYY-MM-DD) and entryTime (HH:mm:ss)
    const [y, m, d] = date.split('-').map(Number);
    const finalDate = new Date(y, m - 1, d); // Local midnight
    
    // Apply time components from captured time
    finalDate.setHours(entryTime.getHours());
    finalDate.setMinutes(entryTime.getMinutes());
    finalDate.setSeconds(entryTime.getSeconds());
    finalDate.setMilliseconds(entryTime.getMilliseconds());

    // Base data structure for both create and update
    const baseData = {
      date: finalDate.getTime(),
      duration: Number(duration),
      predictedDuration: Number(predictedDuration),
      timeOfDay,
      goal,
      output,
      problems,
      nextSteps,
      tags: selectedTags,
      focusScore,
      satisfactionScore,
      varianceReasons,
      notes,
    };

    if (editingSessionId) {
      // Update: Don't pass ID or createdAt to preserve original values
      onUpdateSession(editingSessionId, baseData);
    } else {
      // Create: Generate new ID and createdAt
      onSaveSession({
        ...baseData,
        id: `session-${Date.now()}`,
        createdAt: Date.now()
      });
    }
    
    setActiveTab('history');
    resetForm();
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setNewTagInput('');
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const addVarianceReason = (reason: string) => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    
    // Check if user typed a predefined label exactly (case-insensitive)
    const predefined = VARIANCE_REASONS.find(r => r.label.toLowerCase() === trimmed.toLowerCase());
    const val = predefined ? predefined.id : trimmed;

    if (!varianceReasons.includes(val)) {
      setVarianceReasons([...varianceReasons, val]);
    }
    setNewVarianceInput('');
  };

  const removeVarianceReason = (val: string) => {
    setVarianceReasons(varianceReasons.filter(r => r !== val));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight">Work Log</h2>
            <p className="text-xs text-slate-500 mt-1 truncate max-w-[300px]">{subtask.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200 transition-colors"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('log')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'log' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {editingSessionId ? <Edit2 size={16}/> : <Plus size={16}/>} {editingSessionId ? 'Edit Entry' : 'Log Work'}
          </button>
          <button 
            onClick={() => { setActiveTab('history'); resetForm(); }}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <History size={16}/> History <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">{subtask.sessions?.length || 0}</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {activeTab === 'log' && (
            <div className="space-y-6">
              
              {/* Row 1: Date & Time Period */}
              <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Date & Time</label>
                        <div className="flex gap-2">
                             <div className="relative flex-1">
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm font-medium text-slate-700" />
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            </div>
                            <select 
                                value={timeOfDay} 
                                onChange={e => setTimeOfDay(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-indigo-500 focus:ring-2 outline-none"
                            >
                                {TIME_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>
                    </div>
                  </div>
                  
                  {/* Row 2: Duration Comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Planned Time (Min)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                min="0" 
                                value={predictedDuration || ''} 
                                onChange={e => setPredictedDuration(e.target.value === '' ? 0 : parseInt(e.target.value))} 
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm font-medium text-slate-700" 
                                placeholder="Expected" 
                            />
                            <HourglassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Actual Time (Min)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                min="0" 
                                value={duration || ''} 
                                onChange={e => setDuration(e.target.value === '' ? 0 : parseInt(e.target.value))} 
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm font-medium text-slate-700" 
                                placeholder="Actual" 
                            />
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                    </div>
                  </div>
              </div>

              {/* Session Goal */}
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <label className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase mb-2">
                    <Target size={16}/> Session Goal (本次目标)
                </label>
                <textarea 
                  value={goal} 
                  onChange={e => setGoal(e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm min-h-[60px] resize-none bg-white placeholder:text-indigo-300/70 text-slate-700" 
                  placeholder="What did you aim to achieve?"
                />
              </div>

              {/* Concrete Output */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                <label className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase mb-2">
                    <PackageCheck size={16}/> Tangible Output (产出物)
                </label>
                <textarea 
                  value={output} 
                  onChange={e => setOutput(e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg border border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm min-h-[60px] resize-none bg-white placeholder:text-emerald-300/70 text-slate-700" 
                  placeholder="What concrete thing did you produce? e.g. Drafted 300 words..."
                />
              </div>

              {/* Current Problems */}
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                <label className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase mb-2">
                    <AlertTriangle size={16}/> Current Problems (当前存在的问题)
                </label>
                <textarea 
                  value={problems} 
                  onChange={e => setProblems(e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg border border-rose-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none text-sm min-h-[60px] resize-none bg-white placeholder:text-rose-300/70 text-slate-700" 
                  placeholder="What blockers or issues did you encounter?"
                />
              </div>

              {/* Next Steps */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <label className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase mb-2">
                    <Footprints size={16}/> Next Steps (下一步行动)
                </label>
                <textarea 
                  value={nextSteps} 
                  onChange={e => setNextSteps(e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm min-h-[60px] resize-none bg-white placeholder:text-blue-300/70 text-slate-700" 
                  placeholder="What do you plan to do next based on this session?"
                />
              </div>

              {/* Review Section (Satisfaction + Variance) */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session Review & Reflection</h3>
                 
                 {/* Satisfaction */}
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Satisfaction (满意度)</label>
                    <div className="flex justify-between gap-2">
                        {SATISFACTION_LEVELS.map((level) => {
                            const Icon = level.icon;
                            const isSelected = satisfactionScore === level.score;
                            return (
                                <button
                                    key={level.score}
                                    onClick={() => setSatisfactionScore(level.score)}
                                    className={`flex-1 py-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500'}`}
                                >
                                    <Icon size={20} />
                                    <span className="text-[9px] opacity-90">{level.score}</span>
                                </button>
                            );
                        })}
                    </div>
                 </div>

                 {/* Focus Score (Simplified) */}
                 <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Focus Level (专注度)</label>
                     <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(score => (
                            <button
                             key={score}
                             onClick={() => setFocusScore(score)}
                             className={`h-8 flex-1 rounded border text-xs font-bold transition-all ${focusScore === score ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                            >
                                {score}
                            </button>
                        ))}
                     </div>
                 </div>

                 {/* Variance Attribution */}
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Deviation / Blockers (偏差归因)</label>
                    
                    {/* Input Area */}
                    <div className="p-3 border border-slate-200 rounded-lg bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-all">
                        <div className="flex flex-wrap gap-2 mb-2">
                            {varianceReasons.map(rId => {
                                const r = VARIANCE_REASONS.find(vr => vr.id === rId);
                                if (r) {
                                    return (
                                        <span key={r.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${r.color}`}>
                                            <r.icon size={12}/> {r.label}
                                            <button onClick={() => removeVarianceReason(r.id)} className="hover:opacity-70"><X size={12}/></button>
                                        </span>
                                    );
                                }
                                return (
                                    <span key={rId} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                                        {rId} <button onClick={() => removeVarianceReason(rId)} className="hover:text-slate-900"><X size={12}/></button>
                                    </span>
                                );
                            })}
                            <input 
                                type="text"
                                value={newVarianceInput}
                                onChange={e => setNewVarianceInput(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); addVarianceReason(newVarianceInput); } }}
                                placeholder={varianceReasons.length === 0 ? "Type reason..." : ""}
                                className="text-sm outline-none bg-transparent min-w-[80px] flex-1"
                            />
                        </div>
                    </div>

                    {/* Suggestions */}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {VARIANCE_REASONS.filter(r => !varianceReasons.includes(r.id)).map(reason => (
                             <button
                                key={reason.id}
                                onClick={() => addVarianceReason(reason.id)}
                                className="px-2 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                            >
                                <reason.icon size={12}/> {reason.label}
                            </button>
                        ))}
                    </div>
                 </div>
              </div>

              {/* Tags & Notes */}
              <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nature of Work</label>
                    <div className="p-3 border border-slate-200 rounded-lg bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-all">
                    <div className="flex flex-wrap gap-2 mb-2">
                        {selectedTags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs font-medium">
                            {tag} <button onClick={() => removeTag(tag)} className="hover:text-indigo-900"><X size={12}/></button>
                        </span>
                        ))}
                        <input 
                        type="text" 
                        value={newTagInput}
                        onChange={e => setNewTagInput(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); addTag(newTagInput); } }}
                        placeholder={selectedTags.length === 0 ? "Type tag..." : ""}
                        className="text-sm outline-none bg-transparent min-w-[80px] flex-1"
                        />
                    </div>
                    </div>
                    {/* Suggestions */}
                    <div className="mt-2 flex flex-wrap gap-2">
                    {suggestTags.slice(0, 5).map(tag => (
                        <button key={tag} onClick={() => addTag(tag)} className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors bg-slate-50">
                        + {tag}
                        </button>
                    ))}
                    </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Other Remarks</label>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm min-h-[60px] resize-none" 
                  placeholder="Details..."
                />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {(!subtask.sessions || subtask.sessions.length === 0) ? (
                <div className="text-center py-10 text-slate-400">
                  <ClipboardList size={40} className="mx-auto mb-2 opacity-50"/>
                  <p className="text-sm">No work logs yet.</p>
                  <button onClick={() => setActiveTab('log')} className="mt-2 text-indigo-600 text-sm font-medium hover:underline">Log your first session</button>
                </div>
              ) : (
                [...(subtask.sessions || [])]
                  // Sort: Newest Date First, then Newest Created First (for same day entries)
                  .sort((a, b) => (b.date - a.date) || ((b.createdAt || 0) - (a.createdAt || 0)))
                  .map(session => {
                    const periodLabel = TIME_PERIODS.find(p => p.id === session.timeOfDay)?.label || session.timeOfDay;
                    const SatIcon = SATISFACTION_LEVELS.find(s => s.score === (session.satisfactionScore || 3))?.icon || Meh;
                    
                    return (
                        <div key={session.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 transition-colors group">
                            <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                    <Calendar size={12}/> {new Date(session.date).toLocaleDateString()}
                                </div>
                                {periodLabel && (
                                    <div className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-1 rounded">
                                        {periodLabel}
                                    </div>
                                )}
                                <div className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                    <Clock size={12}/> {session.duration}m
                                </div>
                                
                                {/* Satisfaction Icon */}
                                <div title={`Satisfaction: ${session.satisfactionScore}/5`} className="text-slate-400 flex items-center gap-1">
                                    <SatIcon size={14} className={session.satisfactionScore && session.satisfactionScore >= 4 ? 'text-green-500' : session.satisfactionScore && session.satisfactionScore <= 2 ? 'text-red-400' : 'text-slate-400'} />
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditClick(session)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 size={14}/></button>
                                <button onClick={() => onDeleteSession(session.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                            </div>
                            </div>

                            {/* Plan vs Actual Diff */}
                            {session.predictedDuration && session.predictedDuration !== session.duration && (
                                <div className="mb-2 text-[10px] text-slate-400 flex gap-2">
                                    <span>Plan: {session.predictedDuration}m</span>
                                    <span>Diff: {session.duration - session.predictedDuration > 0 ? `+${session.duration - session.predictedDuration}` : session.duration - session.predictedDuration}m</span>
                                </div>
                            )}
                            
                            {/* Session Goal Section */}
                            {session.goal && (
                                <div className="mb-2 flex items-start gap-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                                    <Target size={14} className="shrink-0 text-indigo-600 mt-0.5"/>
                                    <span className="text-xs text-indigo-900 font-medium whitespace-pre-wrap">{session.goal}</span>
                                </div>
                            )}

                            {/* Concrete Output Section */}
                            {session.output && (
                                <div className="mb-2 flex items-start gap-2 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                                    <PackageCheck size={14} className="shrink-0 text-emerald-600 mt-0.5"/>
                                    <span className="text-xs text-emerald-900 font-medium whitespace-pre-wrap">{session.output}</span>
                                </div>
                            )}

                            {/* Current Problems Section */}
                            {session.problems && (
                                <div className="mb-2 flex items-start gap-2 bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                                    <AlertTriangle size={14} className="shrink-0 text-rose-600 mt-0.5"/>
                                    <span className="text-xs text-rose-900 font-medium whitespace-pre-wrap">{session.problems}</span>
                                </div>
                            )}

                            {/* Next Steps Section */}
                            {session.nextSteps && (
                                <div className="mb-2 flex items-start gap-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                    <Footprints size={14} className="shrink-0 text-blue-600 mt-0.5"/>
                                    <span className="text-xs text-blue-900 font-medium whitespace-pre-wrap">{session.nextSteps}</span>
                                </div>
                            )}

                            {/* Variance Reasons */}
                            {session.varianceReasons && session.varianceReasons.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {session.varianceReasons.map(vid => {
                                        const r = VARIANCE_REASONS.find(vr => vr.id === vid);
                                        if(!r) {
                                            return (
                                                <span key={vid} className="text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 bg-slate-50 text-slate-500 border-slate-200">
                                                    {vid}
                                                </span>
                                            );
                                        }
                                        return (
                                            <span key={vid} className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${r.color}`}>
                                                <r.icon size={10} /> {r.label}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {session.tags && session.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {session.tags.map(t => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-200">{t}</span>
                                ))}
                            </div>
                            )}
                            
                            {session.notes && (
                            <p className="text-xs text-slate-500 pl-2 border-l-2 border-slate-200 italic">
                                {session.notes}
                            </p>
                            )}
                        </div>
                    );
                })
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        {activeTab === 'log' && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button onClick={() => { resetForm(); setActiveTab('history'); }} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg">Cancel</button>
            <button onClick={handleSubmit} className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2">
              <Save size={16}/> {editingSessionId ? 'Update Entry' : 'Save Log'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};