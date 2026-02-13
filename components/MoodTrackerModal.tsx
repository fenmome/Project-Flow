import React, { useState, useEffect } from 'react';
import { X, Smile, Frown, Meh, CloudRain, Zap, Heart, Calendar, Clock, Send, Trash2, Plus, Download } from 'lucide-react';
import { MoodEntry } from '../types';

interface MoodTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  moods: MoodEntry[];
  onAddMood: (mood: MoodEntry) => void;
  onDeleteMood: (id: string) => void;
}

const PRESET_MOODS = [
  { label: 'Happy', icon: Smile, color: 'text-green-600 bg-green-50 border-green-200' },
  { label: 'Sad', icon: CloudRain, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { label: 'Anxious', icon: Zap, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { label: 'Neutral', icon: Meh, color: 'text-slate-600 bg-slate-50 border-slate-200' },
  { label: 'Frustrated', icon: Frown, color: 'text-red-600 bg-red-50 border-red-200' },
  { label: 'Excited', icon: Heart, color: 'text-pink-600 bg-pink-50 border-pink-200' },
];

export const MoodTrackerModal: React.FC<MoodTrackerModalProps> = ({ isOpen, onClose, moods, onAddMood, onDeleteMood }) => {
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [customMood, setCustomMood] = useState<string>('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Initialize time when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      // Adjust to local ISO string
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
      setDate(localIso.split('T')[0]);
      setTime(localIso.split('T')[1].slice(0, 5));
      setSelectedMood('');
      setCustomMood('');
      setNote('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const finalMood = customMood.trim() || selectedMood;
    if (!finalMood) return;

    const timestamp = new Date(`${date}T${time}`).getTime();

    const newEntry: MoodEntry = {
      id: `mood-${Date.now()}`,
      timestamp,
      mood: finalMood,
      note: note.trim()
    };

    onAddMood(newEntry);
    
    // Optional: Reset form or just the note/mood to allow rapid entry
    setNote('');
    setSelectedMood('');
    setCustomMood('');
  };

  const handleExport = () => {
    if (moods.length === 0) return;
    const blob = new Blob([JSON.stringify(moods, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mood-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getMoodConfig = (moodLabel: string) => {
    return PRESET_MOODS.find(m => m.label.toLowerCase() === moodLabel.toLowerCase()) || 
           { label: moodLabel, icon: Smile, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
  };

  // Sort moods by newest first
  const sortedMoods = [...moods].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[600px] overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Timeline (History) */}
        <div className="w-full md:w-5/12 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <HistoryIcon /> Mood History
                </h3>
                {moods.length > 0 && (
                    <button 
                        onClick={handleExport}
                        className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-1.5 rounded transition-colors"
                        title="Export History"
                    >
                        <Download size={16} />
                    </button>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                {sortedMoods.length === 0 ? (
                    <div className="text-center text-slate-400 mt-20">
                        <Smile size={48} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No moods recorded yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6 border-l-2 border-indigo-100 ml-3 pl-6 relative">
                        {sortedMoods.map(entry => {
                            const config = getMoodConfig(entry.mood);
                            const Icon = config.icon;
                            
                            return (
                                <div key={entry.id} className="relative group">
                                    {/* Dot on timeline */}
                                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-2 border-indigo-400 z-10"></div>
                                    
                                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group-hover:border-indigo-200">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${config.color}`}>
                                                    <Icon size={12} /> {entry.mood}
                                                </span>
                                            </div>
                                            <button onClick={() => onDeleteMood(entry.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium mb-2">
                                            {new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                                        </div>
                                        {entry.note && (
                                            <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded-lg italic">
                                                "{entry.note}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* Right Side: Input Form */}
        <div className="w-full md:w-7/12 bg-white flex flex-col h-full relative">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-20">
                <X size={20} />
            </button>

            <div className="p-8 flex flex-col h-full overflow-y-auto">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 mb-1">How are you feeling?</h2>
                    <p className="text-slate-500 text-sm">Track your emotional journey during your thesis.</p>
                </div>

                <div className="space-y-6 flex-1">
                    {/* Date Time Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                            <div className="relative">
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Time</label>
                            <div className="relative">
                                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            </div>
                        </div>
                    </div>

                    {/* Mood Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Select Mood</label>
                        <div className="grid grid-cols-3 gap-3">
                            {PRESET_MOODS.map(preset => {
                                const isSelected = selectedMood === preset.label;
                                const Icon = preset.icon;
                                return (
                                    <button
                                        key={preset.label}
                                        onClick={() => { setSelectedMood(preset.label); setCustomMood(''); }}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${isSelected ? `border-indigo-500 bg-indigo-50 shadow-sm ${preset.color.replace('bg-', 'text-')}` : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-200 hover:bg-slate-50'}`}
                                    >
                                        <Icon size={24} className={isSelected ? '' : 'grayscale opacity-70'} />
                                        <span className="text-xs font-medium">{preset.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* Custom Mood Input */}
                        <div className="relative mt-2">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <Plus size={16} />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Or type a custom mood..." 
                                value={customMood}
                                onChange={e => { setCustomMood(e.target.value); setSelectedMood(''); }}
                                className={`w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm transition-all ${customMood ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400'}`}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Remarks / Thoughts</label>
                        <textarea 
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-sm min-h-[100px] resize-none"
                            placeholder="Why do you feel this way? Any blockers or wins?"
                        />
                    </div>
                </div>

                {/* Footer Submit */}
                <div className="mt-6 pt-6 border-t border-slate-100">
                    <button 
                        onClick={handleSubmit}
                        disabled={!selectedMood && !customMood}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        <Send size={18} /> Record Mood
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const HistoryIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);
