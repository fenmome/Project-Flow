import React, { useState } from 'react';
import { X, Sparkles, Loader2, AlertCircle, GraduationCap, BookOpen } from 'lucide-react';
import { generateThesisPlan } from '../services/geminiService';
import { Project, TaskStatus } from '../types';

interface AIPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Project) => void;
}

export const AIPlannerModal: React.FC<AIPlannerModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Master\'s');
  const [type, setType] = useState('Experimental');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const plan = await generateThesisPlan(topic, level, type);
      const now = Date.now();
      
      const newProject: Project = {
        id: now.toString(),
        title: plan.title,
        description: plan.description,
        createdAt: now,
        dailyWorkMinutes: 180, // Default 3 hours for thesis
        versions: [
          {
            id: `v-${now}`,
            title: 'Initial AI Plan',
            startTime: now, // Initialize Start Time
            tasks: plan.tasks.map((t, tIdx) => ({
              id: `task-${now}-${tIdx}`,
              title: t.title,
              status: TaskStatus.TODO,
              startTime: now, // Initialize Start Time
              subtasks: t.subtasks.map((s, sIdx) => ({
                id: `sub-${now}-${tIdx}-${sIdx}`,
                title: s.title,
                estimatedMinutes: s.estimatedMinutes,
                completedMinutes: 0,
                status: TaskStatus.TODO,
                createdAt: now,
                startTime: now, // Initialize Start Time
                lastUpdated: now
              }))
            }))
          }
        ]
      };

      onCreate(newProject);
      onClose();
      setTopic('');
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-2 text-indigo-900">
            <Sparkles size={20} className="text-purple-600" />
            <h2 className="text-xl font-bold">AI Thesis Planner</h2>
          </div>
          <button onClick={onClose} disabled={isLoading} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
           <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Degree Level</label>
                <div className="relative">
                   <select 
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full appearance-none pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm bg-white"
                   >
                      <option>Bachelor's</option>
                      <option>Master's</option>
                      <option>PhD</option>
                   </select>
                   <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                </div>
             </div>
             <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Research Type</label>
                <div className="relative">
                   <select 
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full appearance-none pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm bg-white"
                   >
                      <option>Experimental</option>
                      <option>Theoretical/Math</option>
                      <option>System/Software</option>
                      <option>Literature Review</option>
                      <option>Qualitative</option>
                   </select>
                   <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                </div>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Research Topic</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Impact of Generative AI on Software Engineering Productivity..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none h-32"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-500">
            <p><strong>Note:</strong> Gemini will structure your {level} thesis into phases appropriate for {type} research.</p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};