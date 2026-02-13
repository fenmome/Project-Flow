
import React, { useState } from 'react';
import { X, LayoutTemplate, PenTool, BookOpen, CalendarClock, Clock, Trash2, Box } from 'lucide-react';
import { Project, TaskStatus, Task, ProjectTemplate } from '../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Project) => void;
  templates?: ProjectTemplate[];
  onDeleteTemplate?: (id: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate, templates = [], onDeleteTemplate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [dailyHours, setDailyHours] = useState('2'); // Default 2 hours
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl-academic');

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!title.trim()) return;

    const now = Date.now();
    let initialTasks: Task[] = [];
    
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates.find(t => t.id === 'tpl-blank') || templates[0];

    if (selectedTemplate) {
        initialTasks = selectedTemplate.structure.map((t, idx) => ({
            id: `task-${now}-${idx}`,
            title: t.title,
            status: TaskStatus.TODO,
            startTime: now,
            subtasks: t.subtasks?.map((s, sIdx) => ({
                id: `sub-${now}-${idx}-${sIdx}`,
                title: s.title,
                status: TaskStatus.TODO,
                estimatedMinutes: s.estimatedMinutes || 60,
                completedMinutes: 0,
                createdAt: now,
                startTime: now,
                lastUpdated: now,
                sessions: []
            })) || []
        }));
    } else {
        // Fallback
        initialTasks = [{
            id: `task-${now}-0`,
            title: "General Tasks",
            status: TaskStatus.TODO,
            startTime: now,
            subtasks: []
        }];
    }

    const newProject: Project = {
      id: now.toString(),
      title,
      description,
      createdAt: now,
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      dailyWorkMinutes: parseFloat(dailyHours) * 60 || 120,
      versions: [
        {
          id: `v-${now}`,
          title: 'Version 1.0',
          startTime: now, // Initialize Start Time
          tasks: initialTasks,
          isCollapsed: false
        }
      ]
    };

    onCreate(newProject);
    onClose();
    setTitle('');
    setDescription('');
    setDeadline('');
    setDailyHours('2');
    setSelectedTemplateId('tpl-academic');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">Create New Project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deadline (Optional)</label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full pl-9 px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-sm"
                    />
                    <CalendarClock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Daily Work (Hours)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={dailyHours}
                      onChange={(e) => setDailyHours(e.target.value)}
                      className="w-full pl-9 px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-sm"
                      placeholder="2"
                    />
                    <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Choose Template</label>
            <div className="grid grid-cols-2 gap-4">
              {templates.map(tpl => {
                  const isSelected = selectedTemplateId === tpl.id;
                  let Icon = Box;
                  if (tpl.id === 'tpl-academic') Icon = BookOpen;
                  if (tpl.id === 'tpl-blank') Icon = LayoutTemplate;

                  return (
                    <button
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`group relative p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected 
                            ? 'border-indigo-600 bg-indigo-50/50' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <div className={`mb-3 w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <Icon size={16} />
                        </div>
                        <h3 className={`font-bold truncate pr-6 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{tpl.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tpl.description}</p>
                        
                        {!tpl.isBuiltin && onDeleteTemplate && (
                            <div 
                                onClick={(e) => { e.stopPropagation(); onDeleteTemplate(tpl.id); }}
                                className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                title="Delete Template"
                            >
                                <Trash2 size={14} />
                            </div>
                        )}
                    </button>
                  );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};
