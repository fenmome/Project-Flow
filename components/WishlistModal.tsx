
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Gift, Plus, Calendar, ChevronDown, ChevronRight, MessageSquare, Clock, Trash2, CheckCircle2, Circle, Tag, Filter, Infinity as InfinityIcon, AlertCircle, Download, Table, Settings, Save, History, GitCompare, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, RotateCcw, AlertTriangle } from 'lucide-react';
import { WishlistItem, WishlistAnnotation, WishlistDeadlineType, GridConfig, GridSnapshot } from '../types';

// Helper to get translated deadline labels
const getDeadlineLabels = (t: any) => ({
    longTerm: t('modals.wishlist.longTerm'),
    noDeadline: t('modals.common.noDeadline'),
    endOfYear: (year: number) => `${t('time.year')} ${year}`,
    daysLeft: (days: number) => `${days} ${t('time.daysLeft')}`,
    overdue: t('time.overdue')
});

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WishlistItem[];
  onAddItem: (text: string) => void;
  onUpdateItem: (id: string, updates: Partial<WishlistItem>) => void;
  onDeleteItem: (id: string) => void;
}

// Helpers for Dates
const toInputDate = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const getDaysRemaining = (endTimestamp?: number) => {
    if (!endTimestamp) return null;
    const now = new Date();
    now.setHours(0,0,0,0);
    const end = new Date(endTimestamp);
    end.setHours(0,0,0,0);
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const getDeadlineLabel = (item: WishlistItem) => {
    if (item.deadlineType === 'long-term') return 'Long Term';
    if (!item.endTime) return 'No Deadline';
    const d = new Date(item.endTime);
    
    if (item.deadlineType === 'year') return `End of ${d.getFullYear()}`;
    if (item.deadlineType === 'month') return `End of ${d.toLocaleString('default', { month: 'short', year: 'numeric' })}`;
    return d.toLocaleDateString();
};

// --- Sub-component: Grid Tracker Modal ---
interface GridTrackerModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: WishlistItem;
    onSave: (gridFeature: WishlistItem['gridFeature']) => void;
}

// --- Data Migration Helpers ---
const swapDataKeys = (data: Record<string, string>, idx1: number, idx2: number, axis: 'row' | 'col', rowCount: number, colCount: number) => {
    const newData = { ...data };
    if (axis === 'row') {
        for (let c = 0; c < colCount; c++) {
            const k1 = `${idx1}-${c}`;
            const k2 = `${idx2}-${c}`;
            const v1 = newData[k1];
            const v2 = newData[k2];
            
            if (v1 !== undefined) newData[k2] = v1; else delete newData[k2];
            if (v2 !== undefined) newData[k1] = v2; else delete newData[k1];
        }
    } else {
        // axis col
        for (let r = 0; r < rowCount; r++) {
            const k1 = `${r}-${idx1}`;
            const k2 = `${r}-${idx2}`;
            const v1 = newData[k1];
            const v2 = newData[k2];
            
            if (v1 !== undefined) newData[k2] = v1; else delete newData[k2];
            if (v2 !== undefined) newData[k1] = v2; else delete newData[k1];
        }
    }
    return newData;
};

const deleteDataIndex = (data: Record<string, string>, index: number, axis: 'row' | 'col', rowCount: number, colCount: number) => {
    const newData = { ...data };
    if (axis === 'row') {
        // Delete row data
        for (let c = 0; c < colCount; c++) delete newData[`${index}-${c}`];
        // Shift up
        for (let r = index + 1; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
                const oldK = `${r}-${c}`;
                const newK = `${r - 1}-${c}`;
                if (newData[oldK] !== undefined) {
                    newData[newK] = newData[oldK];
                    delete newData[oldK];
                }
            }
        }
    } else {
        // axis col
        // Delete col data
        for (let r = 0; r < rowCount; r++) delete newData[`${r}-${index}`];
        // Shift left
        for (let c = index + 1; c < colCount; c++) {
            for (let r = 0; r < rowCount; r++) {
                const oldK = `${r}-${c}`;
                const newK = `${r}-${c - 1}`;
                if (newData[oldK] !== undefined) {
                    newData[newK] = newData[oldK];
                    delete newData[oldK];
                }
            }
        }
    }
    return newData;
};

const GridTrackerModal: React.FC<GridTrackerModalProps> = ({ isOpen, onClose, item, onSave }) => {
    const [configMode, setConfigMode] = useState(false);
    
    // Config State
    const [rows, setRows] = useState<string[]>([]);
    const [cols, setCols] = useState<string[]>([]);
    const [newRowInput, setNewRowInput] = useState('');
    const [newColInput, setNewColInput] = useState('');

    // Data State
    const [currentData, setCurrentData] = useState<Record<string, string>>({});
    
    // History & Compare State
    const [selectedHistoryId, setSelectedHistoryId] = useState<string>('current');
    const [compareMode, setCompareMode] = useState(false);

    useEffect(() => {
        // Sync state when item changes (this handles updates from deletion/reorder/parent changes)
        if (isOpen && item.gridFeature) {
            setRows(item.gridFeature.config.rows || []);
            setCols(item.gridFeature.config.cols || []);
            setCurrentData(item.gridFeature.currentData || {});
            
            // If no structure, force config mode
            if ((!item.gridFeature.config.rows || item.gridFeature.config.rows.length === 0) &&
                (!item.gridFeature.config.cols || item.gridFeature.config.cols.length === 0)) {
                setConfigMode(true);
            }
        } else if (isOpen) {
            // New feature initialization
            setRows([]);
            setCols([]);
            setCurrentData({});
            setConfigMode(true);
        }
    }, [isOpen, item]);

    if (!isOpen) return null;

    const handleSave = () => {
        const timestamp = Date.now();
        const newSnapshot: GridSnapshot = {
            id: `snap-${timestamp}`,
            timestamp,
            data: { ...currentData },
            config: { rows, cols }
        };

        const existingHistory = item.gridFeature?.history || [];
        
        const newFeature = {
            isEnabled: true,
            config: { rows, cols },
            currentData: currentData,
            history: [newSnapshot, ...existingHistory],
            lastUpdated: Date.now()
        };

        onSave(newFeature);
        onClose();
    };

    const handleDeleteHistory = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedHistoryId === 'current') return;
        
        if (window.confirm("Are you sure you want to delete this history record? This cannot be undone.")) {
            const newHistory = item.gridFeature?.history.filter(h => h.id !== selectedHistoryId) || [];
            
            const newFeature = {
                ...item.gridFeature!,
                history: newHistory,
                lastUpdated: Date.now()
            };
            
            // Update parent logic
            onSave(newFeature);
            setSelectedHistoryId('current');
        }
    };

    // --- Configuration Handlers ---

    const commitStructureChange = () => {
        // Save current structure configuration to parent without creating history snapshot
        onSave({
            isEnabled: true,
            config: { rows, cols },
            currentData: currentData,
            history: item.gridFeature?.history || [],
            lastUpdated: Date.now()
        });
    };

    // Renaming Helpers
    const handleRenameRow = (index: number, val: string) => {
        const newRows = [...rows];
        newRows[index] = val;
        setRows(newRows);
    };

    const handleRenameCol = (index: number, val: string) => {
        const newCols = [...cols];
        newCols[index] = val;
        setCols(newCols);
    };

    const handleMoveRow = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === rows.length - 1) return;
        
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        
        // 1. Swap Labels
        const newRows = [...rows];
        [newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]];
        setRows(newRows);

        // 2. Migrate Data
        const migrate = (d: Record<string, string>) => swapDataKeys(d, index, newIndex, 'row', rows.length, cols.length);
        const newCurrentData = migrate(currentData);
        setCurrentData(newCurrentData);

        // 3. Migrate History
        const newHistory = (item.gridFeature?.history || []).map(h => ({
            ...h,
            data: migrate(h.data)
        }));

        onSave({
            isEnabled: true,
            config: { rows: newRows, cols },
            currentData: newCurrentData,
            history: newHistory,
            lastUpdated: Date.now()
        });
    };

    const handleMoveCol = (index: number, direction: 'left' | 'right') => {
        if (direction === 'left' && index === 0) return;
        if (direction === 'right' && index === cols.length - 1) return;

        const newIndex = direction === 'left' ? index - 1 : index + 1;

        // 1. Swap Labels
        const newCols = [...cols];
        [newCols[index], newCols[newIndex]] = [newCols[newIndex], newCols[index]];
        setCols(newCols);

        // 2. Migrate Data
        const migrate = (d: Record<string, string>) => swapDataKeys(d, index, newIndex, 'col', rows.length, cols.length);
        const newCurrentData = migrate(currentData);
        setCurrentData(newCurrentData);

        // 3. Migrate History
        const newHistory = (item.gridFeature?.history || []).map(h => ({
            ...h,
            data: migrate(h.data)
        }));

        onSave({
            isEnabled: true,
            config: { rows, cols: newCols },
            currentData: newCurrentData,
            history: newHistory,
            lastUpdated: Date.now()
        });
    };

    const handleDeleteRow = (index: number) => {
        if (!window.confirm("Delete this row and all its data?")) return;

        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        
        const migrate = (d: Record<string, string>) => deleteDataIndex(d, index, 'row', rows.length, cols.length);
        const newCurrentData = migrate(currentData);
        setCurrentData(newCurrentData);

        const newHistory = (item.gridFeature?.history || []).map(h => ({
            ...h,
            data: migrate(h.data)
        }));

        onSave({
            isEnabled: true,
            config: { rows: newRows, cols },
            currentData: newCurrentData,
            history: newHistory,
            lastUpdated: Date.now()
        });
    };

    const handleDeleteCol = (index: number) => {
        if (!window.confirm("Delete this column and all its data?")) return;

        const newCols = cols.filter((_, i) => i !== index);
        setCols(newCols);

        const migrate = (d: Record<string, string>) => deleteDataIndex(d, index, 'col', rows.length, cols.length);
        const newCurrentData = migrate(currentData);
        setCurrentData(newCurrentData);

        const newHistory = (item.gridFeature?.history || []).map(h => ({
            ...h,
            data: migrate(h.data)
        }));

        onSave({
            isEnabled: true,
            config: { rows, cols: newCols },
            currentData: newCurrentData,
            history: newHistory,
            lastUpdated: Date.now()
        });
    };

    // --- Data Handlers ---

    const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
        if (selectedHistoryId !== 'current') return; // Read only in history mode
        setCurrentData(prev => ({
            ...prev,
            [`${rIdx}-${cIdx}`]: val
        }));
    };

    const renderCell = (rIdx: number, cIdx: number) => {
        const key = `${rIdx}-${cIdx}`;
        const currentVal = currentData[key] || '';

        // 1. Current Editing Mode
        if (selectedHistoryId === 'current') {
            return (
                <input 
                    className="w-full h-full bg-transparent outline-none text-sm text-slate-700 text-center"
                    value={currentVal}
                    onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                />
            );
        }

        // 2. History Viewing Mode
        const historySnapshot = item.gridFeature?.history.find(h => h.id === selectedHistoryId);
        const historyVal = historySnapshot?.data[key] || '';

        if (compareMode) {
            // Compare History vs Current
            if (historyVal !== currentVal) {
                return (
                    <div className="flex flex-col items-center justify-center leading-tight text-xs h-full w-full bg-yellow-50/50">
                        <span className="text-red-400 line-through decoration-red-300 opacity-70 mb-0.5 block max-w-full truncate px-1">{historyVal || '(empty)'}</span>
                        <div className="flex items-center gap-0.5 text-green-600 font-bold">
                            <ArrowRight size={8}/> {currentVal || '(empty)'}
                        </div>
                    </div>
                );
            }
        }

        return <span className="text-slate-500 text-sm">{historyVal}</span>;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Table size={20}/></div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{item.text} - Tracker</h3>
                            <p className="text-xs text-slate-500">Track progress, data, or metrics over time.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!configMode && (
                            <>
                                <select 
                                    value={selectedHistoryId}
                                    onChange={(e) => setSelectedHistoryId(e.target.value)}
                                    className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
                                >
                                    <option value="current">Current State (Editing)</option>
                                    {item.gridFeature?.history.map(h => (
                                        <option key={h.id} value={h.id}>
                                            {new Date(h.timestamp).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                                
                                {selectedHistoryId !== 'current' && (
                                    <>
                                        <button 
                                            type="button"
                                            onClick={() => setCompareMode(!compareMode)}
                                            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs font-medium ${compareMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                            title="Compare with Current"
                                        >
                                            <GitCompare size={14}/> Compare
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteHistory(e)}
                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                                            title="Delete this record"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                        <div className="w-px h-6 bg-slate-300 mx-2"></div>
                        <button 
                            type="button"
                            onClick={() => setConfigMode(!configMode)}
                            className={`p-2 rounded-lg transition-colors ${configMode ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}`}
                            title="Configure Columns/Rows"
                        >
                            <Settings size={20}/>
                        </button>
                        <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    {configMode ? (
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                            <div className="max-w-2xl mx-auto space-y-8">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={16}/> Table Structure</h4>
                                    
                                    {/* Columns Config */}
                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Columns (Horizontal)</label>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {cols.map((c, i) => (
                                                <div key={i} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-1 py-1 rounded-md text-sm font-medium border border-indigo-100 shadow-sm">
                                                    <button type="button" onClick={() => handleMoveCol(i, 'left')} disabled={i===0} className="p-1 hover:text-indigo-900 disabled:opacity-30"><ArrowLeft size={10}/></button>
                                                    <button type="button" onClick={() => handleMoveCol(i, 'right')} disabled={i===cols.length-1} className="p-1 hover:text-indigo-900 disabled:opacity-30"><ArrowRight size={10}/></button>
                                                    
                                                    {/* Editable Name */}
                                                    <input 
                                                        value={c}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => handleRenameCol(i, e.target.value)}
                                                        onBlur={commitStructureChange}
                                                        onKeyDown={(e) => e.key === 'Enter' && commitStructureChange()}
                                                        className="mx-1 bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 outline-none text-center min-w-[40px] max-w-[120px] px-1 text-indigo-800 font-bold"
                                                    />

                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteCol(i); }} 
                                                        className="hover:text-red-600 hover:bg-red-50 ml-1 border-l border-indigo-200 pl-1 p-1 rounded-r transition-colors"
                                                    >
                                                        <X size={14}/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                                placeholder="New Column Name (e.g. Word Count, Weight)"
                                                value={newColInput}
                                                onChange={e => setNewColInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (setCols([...cols, newColInput]), setNewColInput(''))}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => { if(newColInput) { setCols([...cols, newColInput]); setNewColInput(''); }}}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Rows Config */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Rows (Vertical)</label>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {rows.map((r, i) => (
                                                <div key={i} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1 py-1 rounded-md text-sm font-medium border border-emerald-100 shadow-sm">
                                                    <button type="button" onClick={() => handleMoveRow(i, 'up')} disabled={i===0} className="p-1 hover:text-emerald-900 disabled:opacity-30"><ArrowUp size={10}/></button>
                                                    <button type="button" onClick={() => handleMoveRow(i, 'down')} disabled={i===rows.length-1} className="p-1 hover:text-emerald-900 disabled:opacity-30"><ArrowDown size={10}/></button>
                                                    
                                                    {/* Editable Name */}
                                                    <input 
                                                        value={r}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => handleRenameRow(i, e.target.value)}
                                                        onBlur={commitStructureChange}
                                                        onKeyDown={(e) => e.key === 'Enter' && commitStructureChange()}
                                                        className="mx-1 bg-transparent border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 outline-none text-center min-w-[40px] max-w-[120px] px-1 text-emerald-800 font-bold"
                                                    />

                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteRow(i); }} 
                                                        className="hover:text-red-600 hover:bg-red-50 ml-1 border-l border-emerald-200 pl-1 p-1 rounded-r transition-colors"
                                                    >
                                                        <X size={14}/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                                                placeholder="New Row Name (e.g. Chapter 1, Week 1)"
                                                value={newRowInput}
                                                onChange={e => setNewRowInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (setRows([...rows, newRowInput]), setNewRowInput(''))}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => { if(newRowInput) { setRows([...rows, newRowInput]); setNewRowInput(''); }}}
                                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <button type="button" onClick={() => setConfigMode(false)} className="text-indigo-600 text-sm font-medium hover:underline">Done Configuring</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // THE GRID
                        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                            {rows.length === 0 || cols.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <Table size={48} className="mb-4 opacity-20"/>
                                    <p>Table structure is empty.</p>
                                    <button onClick={() => setConfigMode(true)} className="mt-2 text-indigo-600 font-medium hover:underline">Configure Rows & Columns</button>
                                </div>
                            ) : (
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-3 border-b-2 border-slate-200 bg-white sticky top-0 z-10 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[120px]">
                                                Parameter
                                            </th>
                                            {cols.map((c, i) => (
                                                <th key={i} className="p-3 border-b-2 border-slate-200 bg-white sticky top-0 z-10 text-center text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px]">
                                                    {c}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r, rIdx) => (
                                            <tr key={rIdx} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-3 border-b border-slate-100 text-sm font-medium text-slate-700 bg-slate-50/30">
                                                    {r}
                                                </td>
                                                {cols.map((c, cIdx) => (
                                                    <td key={cIdx} className="p-0 border-b border-slate-100 border-l border-slate-100 relative h-12">
                                                        {renderCell(rIdx, cIdx)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div className="text-xs text-slate-400">
                        {item.gridFeature?.history.length || 0} history records saved.
                    </div>
                    {selectedHistoryId === 'current' && (
                        <button 
                            type="button"
                            onClick={handleSave}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-medium flex items-center gap-2 transition-all"
                        >
                            <Save size={16}/> Save & Record History
                        </button>
                    )}
                    {selectedHistoryId !== 'current' && (
                        <div className="flex items-center gap-3">
                             <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                                <History size={14}/> Viewing History (Read Only)
                                <button onClick={() => setSelectedHistoryId('current')} className="underline ml-2 font-bold hover:text-amber-800">Return to Editing</button>
                            </div>
                            <button 
                                type="button"
                                onClick={(e) => handleDeleteHistory(e)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg text-xs font-medium transition-colors shadow-sm"
                                title="Delete this specific history snapshot"
                            >
                                <Trash2 size={14}/> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const WishlistModal: React.FC<WishlistModalProps> = ({ isOpen, onClose, items, onAddItem, onUpdateItem, onDeleteItem }) => {
  const [newItemText, setNewItemText] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [annotationInputs, setAnnotationInputs] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  
  // Grid Modal State - Using ID instead of Object to prevent stale state issues
  const [activeGridItemId, setActiveGridItemId] = useState<string | null>(null);
  
  // Computed active item
  const activeGridItem = useMemo(() => 
      items.find(i => i.id === activeGridItemId) || null
  , [items, activeGridItemId]);

  // Filtering State
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all'); // all, upcoming, long-term

  // Derived unique tags for filter
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      items.forEach(i => i.tags?.forEach(t => tags.add(t)));
      return Array.from(tags);
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
      return items.filter(item => {
          if (filterTag !== 'all' && !item.tags?.includes(filterTag)) return false;
          
          if (filterTime === 'long-term' && item.deadlineType !== 'long-term') return false;
          if (filterTime === 'upcoming') {
              if (item.deadlineType === 'long-term' || !item.endTime) return false;
              // Check if future
              if (item.endTime < Date.now()) return false; 
          }
          if (filterTime === 'overdue') {
              if (item.deadlineType === 'long-term' || !item.endTime) return false;
              if (item.endTime >= Date.now()) return false;
          }
          
          return true;
      }).sort((a, b) => {
          // Sort logic: Done items at bottom. 
          if (a.status === 'done' && b.status !== 'done') return 1;
          if (a.status !== 'done' && b.status === 'done') return -1;
          // Then by deadline (nearest first), long-term last
          const timeA = a.deadlineType === 'long-term' ? 9999999999999 : (a.endTime || 9999999999998);
          const timeB = b.deadlineType === 'long-term' ? 9999999999999 : (b.endTime || 9999999999998);
          return timeA - timeB;
      });
  }, [items, filterTag, filterTime]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!newItemText.trim()) return;
    onAddItem(newItemText.trim());
    setNewItemText('');
  };

  const handleExport = () => {
      const data = {
          wishlist: items,
          exportDate: Date.now()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wishlist-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddAnnotation = (itemId: string) => {
    const content = annotationInputs[itemId]?.trim();
    if (!content) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newAnnotation: WishlistAnnotation = {
      id: `wa-${Date.now()}`,
      content,
      timestamp: Date.now()
    };

    onUpdateItem(itemId, { annotations: [newAnnotation, ...item.annotations] });
    setAnnotationInputs(prev => ({ ...prev, [itemId]: '' }));
  };

  const handleDeleteAnnotation = (itemId: string, annotationId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    onUpdateItem(itemId, { annotations: item.annotations.filter(a => a.id !== annotationId) });
  };

  // Tag Management
  const handleAddTag = (itemId: string) => {
      const val = tagInput[itemId]?.trim();
      if (!val) return;
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      const currentTags = item.tags || [];
      if (!currentTags.includes(val)) {
          onUpdateItem(itemId, { tags: [...currentTags, val] });
      }
      setTagInput(prev => ({ ...prev, [itemId]: '' }));
  };

  const handleRemoveTag = (itemId: string, tag: string) => {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      onUpdateItem(itemId, { tags: (item.tags || []).filter(t => t !== tag) });
  };

  // Deadline Management
  const handleDeadlineTypeChange = (itemId: string, type: WishlistDeadlineType) => {
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      let newEndTime = item.endTime;
      const now = new Date();

      if (type === 'long-term') {
          newEndTime = undefined;
      } else if (type === 'year') {
          // Default to end of current year
          newEndTime = new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime();
      } else if (type === 'month') {
          // Default to end of current month
          newEndTime = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
      } else if (type === 'date') {
          if (!newEndTime) newEndTime = Date.now();
      }

      onUpdateItem(itemId, { deadlineType: type, endTime: newEndTime });
  };

  const updateDetailedDate = (itemId: string, val: string, type: WishlistDeadlineType) => {
      if (!val) return;
      const d = new Date(val); // This parses YYYY-MM-DD or YYYY-MM based on input
      
      let finalDate = new Date();

      if (type === 'month') {
          // Input is YYYY-MM. Set to last day of that month.
          const [y, m] = val.split('-').map(Number);
          finalDate = new Date(y, m, 0, 23, 59, 59); // m is 1-based from split, but Date constructor uses 0-based month. But passing day 0 of next month works.
      } else if (type === 'date') {
          const [y, m, day] = val.split('-').map(Number);
          finalDate = new Date(y, m - 1, day, 23, 59, 59);
      } else if (type === 'year') {
          // Custom year input handling if we used a raw number input, 
          // but assuming we parse a date string or handled separately.
          // Let's assume standard date input logic for simplicity in this helper
      }
      
      onUpdateItem(itemId, { endTime: finalDate.getTime() });
  };

  return (
    <>
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Gift className="text-pink-500" /> Wishlist & Ideas
            </h2>
            <p className="text-xs text-slate-500 mt-1">Manage personal goals, reading lists, and long-term plans.</p>
          </div>
          <div className="flex items-center gap-1">
            <button 
                onClick={handleExport} 
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                title="Export Wishlist"
            >
                <Download size={20} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center gap-3 overflow-x-auto">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Filter size={14} /> Filter:
            </div>
            <select 
                value={filterTime} 
                onChange={(e) => setFilterTime(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 outline-none focus:border-pink-300"
            >
                <option value="all">All Times</option>
                <option value="upcoming">Upcoming</option>
                <option value="long-term">Long Term</option>
                <option value="overdue">Overdue</option>
            </select>
            
            <select 
                value={filterTag} 
                onChange={(e) => setFilterTag(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 outline-none focus:border-pink-300 max-w-[150px]"
            >
                <option value="all">All Tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4 custom-scrollbar">
            {/* Add New Item */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex gap-2 items-center">
                <input 
                    type="text" 
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Add a new item to your wishlist..." 
                    className="flex-1 text-sm outline-none px-2 py-1"
                    autoFocus
                />
                <button 
                    onClick={handleAdd}
                    disabled={!newItemText.trim()}
                    className="p-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    <Plus size={16} />
                </button>
            </div>

            {filteredItems.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                    <Gift size={48} className="mx-auto mb-2 opacity-20"/>
                    <p className="text-sm">No items found matching filters.</p>
                </div>
            )}

            {filteredItems.map(item => {
                const isExpanded = expandedItems.has(item.id);
                const hasAnnotations = item.annotations.length > 0;
                const daysRemaining = getDaysRemaining(item.endTime);
                
                return (
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group">
                        <div className="p-4">
                            {/* Main Row */}
                            <div className="flex items-start gap-3">
                                <button 
                                    onClick={() => onUpdateItem(item.id, { status: item.status === 'done' ? 'todo' : 'done' })}
                                    className={`mt-0.5 ${item.status === 'done' ? 'text-green-500' : 'text-slate-300 hover:text-pink-500'} transition-colors`}
                                >
                                    {item.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`font-medium text-slate-800 ${item.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                                            {item.text}
                                        </h3>
                                        {/* Countdown Badge */}
                                        {item.status !== 'done' && item.deadlineType !== 'long-term' && daysRemaining !== null && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${
                                                daysRemaining < 0 ? 'bg-red-50 text-red-600 border-red-100' :
                                                daysRemaining < 7 ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                daysRemaining < 30 ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                                'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}>
                                                {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining} days left`}
                                            </span>
                                        )}
                                        {item.deadlineType === 'long-term' && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100 flex items-center gap-1">
                                                <InfinityIcon size={10} /> Long Term
                                            </span>
                                        )}
                                        
                                        {/* Open Grid Tracker Button */}
                                        <button 
                                            onClick={() => setActiveGridItemId(item.id)}
                                            className={`ml-1 p-1 rounded-md transition-all flex items-center gap-1 text-[10px] border ${item.gridFeature?.isEnabled ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-slate-300 hover:text-indigo-500 hover:bg-slate-50 border-transparent hover:border-slate-200'}`}
                                            title="Open Tracker Table"
                                        >
                                            <Table size={14} /> 
                                            {item.gridFeature?.isEnabled ? 'Tracker' : ''}
                                        </button>
                                    </div>
                                    
                                    {/* Tags Row */}
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {(item.tags || []).map(tag => (
                                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded flex items-center gap-1">
                                                <Tag size={8} /> {tag}
                                                <button onClick={() => handleRemoveTag(item.id, tag)} className="hover:text-red-500 ml-0.5"><X size={8}/></button>
                                            </span>
                                        ))}
                                        {/* Add Tag Inline */}
                                        <div className="flex items-center gap-1">
                                            <input 
                                                className="text-[10px] bg-transparent border-b border-slate-200 focus:border-pink-300 outline-none w-16 px-1"
                                                placeholder="+ Tag"
                                                value={tagInput[item.id] || ''}
                                                onChange={(e) => setTagInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddTag(item.id)}
                                            />
                                        </div>
                                    </div>

                                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                        <span>Deadline: {getDeadlineLabel(item)}</span>
                                    </div>
                                </div>

                                <button onClick={() => onDeleteItem(item.id)} className="text-slate-300 hover:text-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Controls Row (Date Type Selector) */}
                            <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap gap-3 items-center">
                                <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
                                    <select 
                                        className="text-[10px] bg-transparent outline-none font-medium text-slate-600 pl-1"
                                        value={item.deadlineType || 'date'}
                                        onChange={(e) => handleDeadlineTypeChange(item.id, e.target.value as WishlistDeadlineType)}
                                    >
                                        <option value="date">Specific Day</option>
                                        <option value="month">End of Month</option>
                                        <option value="year">End of Year</option>
                                        <option value="long-term">Long Term</option>
                                    </select>
                                    
                                    {/* Conditional Inputs based on Type */}
                                    {(!item.deadlineType || item.deadlineType === 'date') && (
                                        <input 
                                            type="date" 
                                            className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-pink-300"
                                            value={toInputDate(item.endTime)}
                                            onChange={(e) => updateDetailedDate(item.id, e.target.value, 'date')}
                                        />
                                    )}
                                    {item.deadlineType === 'month' && (
                                        <input 
                                            type="month" 
                                            className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-pink-300"
                                            value={item.endTime ? new Date(item.endTime).toISOString().slice(0, 7) : ''}
                                            onChange={(e) => updateDetailedDate(item.id, e.target.value, 'month')}
                                        />
                                    )}
                                    {item.deadlineType === 'year' && (
                                        <div className="flex items-center px-2 text-[10px] text-slate-500">
                                            {item.endTime ? new Date(item.endTime).getFullYear() : new Date().getFullYear()} (Dec 31)
                                            {/* Simple year increment could be added here if strictly needed, but implied by selecting year */}
                                            <button 
                                                onClick={() => {
                                                    const current = item.endTime ? new Date(item.endTime).getFullYear() : new Date().getFullYear();
                                                    const nextYear = new Date(current + 1, 11, 31, 23, 59, 59).getTime();
                                                    onUpdateItem(item.id, { endTime: nextYear });
                                                }}
                                                className="ml-2 bg-white border border-slate-200 px-1 rounded hover:bg-slate-100"
                                            >
                                                +1
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Annotations Section (Foldable) */}
                        <div className="border-t border-slate-100">
                            <button 
                                onClick={() => toggleExpand(item.id)}
                                className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-bold text-slate-500 uppercase tracking-wider"
                            >
                                <span className="flex items-center gap-2">
                                    <MessageSquare size={14} className={hasAnnotations ? 'text-pink-500' : 'text-slate-400'} />
                                    Annotations {hasAnnotations && `(${item.annotations.length})`}
                                </span>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            
                            {isExpanded && (
                                <div className="p-4 bg-slate-50/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                    {/* Input */}
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Add an annotation..."
                                            value={annotationInputs[item.id] || ''}
                                            onChange={(e) => setAnnotationInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddAnnotation(item.id)}
                                            className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-200 bg-white"
                                        />
                                        <button 
                                            onClick={() => handleAddAnnotation(item.id)}
                                            className="px-3 py-2 bg-white border border-slate-200 hover:border-pink-300 hover:text-pink-600 text-slate-400 rounded-lg transition-colors"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>

                                    {/* List */}
                                    <div className="space-y-2">
                                        {item.annotations.length === 0 && (
                                            <p className="text-[10px] text-slate-400 italic text-center py-2">No annotations yet.</p>
                                        )}
                                        {item.annotations.map(anno => (
                                            <div key={anno.id} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 group/anno relative">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                                        <Clock size={10} /> {new Date(anno.timestamp).toLocaleString()}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleDeleteAnnotation(item.id, anno.id)}
                                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover/anno:opacity-100 transition-opacity"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                                <p className="leading-relaxed pl-1">{anno.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
    
    {activeGridItem && (
        <GridTrackerModal 
            isOpen={!!activeGridItem} 
            onClose={() => setActiveGridItemId(null)} 
            item={activeGridItem}
            onSave={(newFeature) => {
                onUpdateItem(activeGridItem.id, { gridFeature: newFeature });
            }}
        />
    )}
    </>
  );
};
