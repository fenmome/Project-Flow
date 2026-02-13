import React, { useState, useEffect } from 'react';
import { X, History, Save, RotateCcw, Trash2, Edit2, Check, Download, AlertTriangle } from 'lucide-react';
import { Project, Folder, DailyTask, MoodEntry, BackupData } from '../types';

interface BackupHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: {
    projects: Project[];
    folders: Folder[];
    dailyTasks: DailyTask[];
    moods: MoodEntry[];
  };
  onRestore: (data: BackupData['data']) => void;
}

export const BackupHistoryModal: React.FC<BackupHistoryModalProps> = ({ isOpen, onClose, currentState, onRestore }) => {
  const [backups, setBackups] = useState<BackupData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadBackups();
    }
  }, [isOpen]);

  const loadBackups = () => {
    try {
      const stored = localStorage.getItem('thesisflow_backups');
      if (stored) {
        setBackups(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load backups", e);
    }
  };

  const saveBackupsToStorage = (newBackups: BackupData[]) => {
    localStorage.setItem('thesisflow_backups', JSON.stringify(newBackups));
    setBackups(newBackups);
  };

  const handleCreateBackup = () => {
    const now = new Date();
    const newBackup: BackupData = {
      id: `bk-${Date.now()}`,
      name: `Backup ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      timestamp: Date.now(),
      data: currentState
    };
    const updated = [newBackup, ...backups];
    saveBackupsToStorage(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this backup?")) {
      const updated = backups.filter(b => b.id !== id);
      saveBackupsToStorage(updated);
    }
  };

  const handleRestore = (backup: BackupData) => {
    if (confirm(`Restore "${backup.name}"? Current data will be replaced.`)) {
      onRestore(backup.data);
      onClose();
    }
  };

  const startEditing = (backup: BackupData) => {
    setEditingId(backup.id);
    setEditName(backup.name);
  };

  const saveName = () => {
    if (editingId && editName.trim()) {
      const updated = backups.map(b => b.id === editingId ? { ...b, name: editName.trim() } : b);
      saveBackupsToStorage(updated);
    }
    setEditingId(null);
    setEditName('');
  };

  const exportBackup = (backup: BackupData) => {
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ThesisFlow-${backup.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <History className="text-orange-500" /> Version History & Backups
            </h2>
            <p className="text-xs text-slate-500 mt-1">Create snapshots of your progress or restore previous versions.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div className="flex justify-between items-center mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm text-orange-500"><Save size={20}/></div>
                    <div>
                        <h4 className="font-bold text-orange-900 text-sm">Save Current State</h4>
                        <p className="text-xs text-orange-700/70">Create a restore point before making big changes.</p>
                    </div>
                </div>
                <button 
                    onClick={handleCreateBackup}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                    <PlusIcon /> New Version
                </button>
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Saved Versions ({backups.length})</h3>
                
                {backups.length === 0 && (
                    <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                        <History size={32} className="mx-auto mb-2 opacity-30"/>
                        <p>No backups saved yet.</p>
                    </div>
                )}

                {backups.map(backup => (
                    <div key={backup.id} className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all bg-white">
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                                {editingId === backup.id ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <input 
                                            autoFocus
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && saveName()}
                                            className="flex-1 text-sm font-bold text-slate-800 border-b-2 border-indigo-500 outline-none bg-transparent"
                                        />
                                        <button onClick={saveName} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={16}/></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-slate-800 truncate">{backup.name}</h4>
                                        <button onClick={() => startEditing(backup)} className="text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                            <Edit2 size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {new Date(backup.timestamp).toLocaleString()}
                                </span>
                                <span>{backup.data.projects.length} Projects</span>
                                <span>{backup.data.dailyTasks.length} Daily Tasks</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => exportBackup(backup)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Download JSON"
                            >
                                <Download size={18} />
                            </button>
                            <button 
                                onClick={() => handleRestore(backup)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                title="Restore this version"
                            >
                                <RotateCcw size={14} /> Restore
                            </button>
                            <button 
                                onClick={() => handleDelete(backup.id)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Backup"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);