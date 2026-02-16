import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, Cell, Legend, LineChart, Line, PieChart, Pie
} from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { toPng, toJpeg, toSvg } from 'html-to-image';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  BarChart3, 
  Table as TableIcon, 
  BrainCircuit, 
  Download, 
  Globe,
  Upload,
  Info,
  Settings2,
  Camera,
  Filter as FilterIcon,
  Plus,
  X,
  Search,
  ChevronDown,
  PieChart as PieIcon,
  TrendingUp,
  BoxSelect,
  Palette,
  FileDown,
  Image as ImageIcon,
  FileCode,
  Layers,
  Check
} from 'lucide-react';

import { DataPoint, StatisticalSummary, CorrelationMatrix, Language } from './types';
import { TRANSLATIONS } from './constants';
import { calculateStats, calculateCorrelation, parseNumber } from './services/analysisService';
import { getAIInsight } from './services/geminiService';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#10b981'];

interface Filter {
  id: string;
  column: string;
  type: 'text' | 'number' | 'category';
  value: any; 
}

type VizMode = 'distribution' | 'relationship' | 'trends';
type ExportFormat = 'png' | 'jpeg' | 'svg';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm p-4 border border-slate-100 shadow-2xl rounded-2xl animate-in fade-in zoom-in duration-200 min-w-[160px]">
        {label && (
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-2 truncate max-w-[200px]">
            {label}
          </p>
        )}
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between space-x-6">
              <span className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.color || entry.fill || '#4f46e5' }}
                ></div>
                <span className="text-[11px] font-bold text-slate-600 truncate max-w-[100px]">
                  {entry.name}
                </span>
              </span>
              <span className="text-[11px] font-black text-indigo-600">
                {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const App: React.FC = () => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [lang, setLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<'stats' | 'viz' | 'data'>('stats');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const [vizMode, setVizMode] = useState<VizMode>('distribution');
  const [activeFilters, setActiveFilters] = useState<Filter[]>([]);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [lastExportFormat, setLastExportFormat] = useState<ExportFormat | null>(null);
  const [scatterX, setScatterX] = useState<string>('');
  const [scatterY, setScatterY] = useState<string>('');
  const [scatterColor, setScatterColor] = useState<string>('');
  
  const chartRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[lang];

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const numericColumns = useMemo(() => {
    if (!data.length) return [];
    return columns.filter(col => {
      const sample = data.slice(0, 10).map(r => r[col]);
      return sample.some(v => parseNumber(v) !== null);
    });
  }, [data, columns]);

  const categoricalColumns = useMemo(() => {
    if (!data.length) return [];
    return columns.filter(col => {
      const uniqueValues = new Set(data.slice(0, 100).map(r => String(r[col] ?? 'null')));
      return uniqueValues.size > 1 && uniqueValues.size <= 15;
    });
  }, [data, columns]);

  const filteredData = useMemo(() => {
    if (activeFilters.length === 0) return data;
    return data.filter(row => {
      return activeFilters.every(filter => {
        const val = row[filter.column];
        if (filter.type === 'text') {
          return String(val ?? '').toLowerCase().includes(String(filter.value).toLowerCase());
        }
        if (filter.type === 'number') {
          const n = parseNumber(val);
          if (n === null) return false;
          const { min, max } = filter.value;
          return n >= (min ?? -Infinity) && n <= (max ?? Infinity);
        }
        if (filter.type === 'category') {
          return (filter.value as Set<string>).has(String(val ?? 'null'));
        }
        return true;
      });
    });
  }, [data, activeFilters]);

  const stats = useMemo(() => calculateStats(filteredData, numericColumns), [filteredData, numericColumns]);
  const correlations = useMemo(() => calculateCorrelation(filteredData, numericColumns), [filteredData, numericColumns]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'csv' || extension === 'txt') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          const parsedData = results.data as DataPoint[];
          const fields = results.meta.fields || [];
          setData(parsedData);
          setColumns(fields);
          setAiInsight(null);
          setActiveFilters([]); 
          const numCols = fields.filter(col => {
            const sample = parsedData.slice(0, 10).map(r => r[col]);
            return sample.some(v => parseNumber(v) !== null);
          });
          if (numCols.length >= 2) {
            setScatterX(numCols[0]);
            setScatterY(numCols[1]);
          }
        }
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const parsedData = XLSX.utils.sheet_to_json(ws) as DataPoint[];
        setData(parsedData);
        if (parsedData.length > 0) {
          const fields = Object.keys(parsedData[0]);
          setColumns(fields);
          setActiveFilters([]);
          const numCols = fields.filter(col => {
            const sample = parsedData.slice(0, 10).map(r => r[col]);
            return sample.some(v => parseNumber(v) !== null);
          });
          if (numCols.length >= 2) {
            setScatterX(numCols[0]);
            setScatterY(numCols[1]);
          }
        }
        setAiInsight(null);
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleAIInsight = async () => {
    if (stats.length === 0) return;
    setLoadingAI(true);
    const insight = await getAIInsight(stats, lang);
    setAiInsight(insight);
    setLoadingAI(false);
  };

  const downloadCSV = () => {
    const csv = Papa.unparse(filteredData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "exported_data.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DataInsight Export");
    XLSX.writeFile(wb, "exported_data.xlsx");
  };

  const handleExportChart = useCallback((format: ExportFormat) => {
    if (chartRef.current === null) return;
    
    setLastExportFormat(format);
    
    // Minimal delay to show the highlight state before closing the menu
    setTimeout(() => {
      setIsExportMenuOpen(false);
    }, 150);
    
    const options = { 
      backgroundColor: '#ffffff', 
      cacheBust: true,
      style: {
        borderRadius: '0px',
        boxShadow: 'none',
        border: 'none'
      }
    };

    let promise;
    switch (format) {
      case 'jpeg':
        promise = toJpeg(chartRef.current, { ...options, quality: 0.95 });
        break;
      case 'svg':
        promise = toSvg(chartRef.current, options);
        break;
      case 'png':
      default:
        promise = toPng(chartRef.current, options);
        break;
    }

    promise
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `datainsight-${vizMode}-${Date.now()}.${format}`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Export failed:', err);
      });
  }, [chartRef, vizMode]);

  const colorMap = useMemo(() => {
    if (!scatterColor || !filteredData.length) return null;
    const uniqueValues = Array.from(new Set(filteredData.map(d => String(d[scatterColor] ?? 'null'))));
    const map: Record<string, string> = {};
    uniqueValues.forEach((val, i) => {
      map[val] = COLORS[i % COLORS.length];
    });
    return map;
  }, [filteredData, scatterColor]);

  const groupedScatterData = useMemo(() => {
    if (!scatterColor) return { "Data Points": filteredData.slice(0, 800) };
    const groups: Record<string, DataPoint[]> = {};
    filteredData.slice(0, 800).forEach(d => {
      const val = String(d[scatterColor] ?? 'null');
      if (!groups[val]) groups[val] = [];
      groups[val].push(d);
    });
    return groups;
  }, [filteredData, scatterColor]);

  const addFilter = (col: string) => {
    const isNumeric = numericColumns.includes(col);
    const uniqueValues = Array.from(new Set(data.map(d => String(d[col] ?? 'null'))));
    let type: Filter['type'] = 'text';
    let defaultValue: any = '';
    if (isNumeric) {
      type = 'number';
      const nums = data.map(d => parseNumber(d[col])).filter((n): n is number => n !== null);
      defaultValue = { min: Math.min(...nums), max: Math.max(...nums) };
    } else if (uniqueValues.length <= 15) {
      type = 'category';
      defaultValue = new Set(uniqueValues);
    }
    const newFilter: Filter = {
      id: Math.random().toString(36).substr(2, 9),
      column: col,
      type,
      value: defaultValue
    };
    setActiveFilters([...activeFilters, newFilter]);
    setIsFilterPanelOpen(false);
  };

  const updateFilterValue = (id: string, value: any) => {
    setActiveFilters(activeFilters.map(f => f.id === id ? { ...f, value } : f));
  };

  const removeFilter = (id: string) => {
    setActiveFilters(activeFilters.filter(f => f.id !== id));
  };

  const getPieData = (col: string) => {
    const counts: Record<string, number> = {};
    filteredData.forEach(row => {
      const val = String(row[col] ?? 'null');
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f5f9]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-none tracking-tight">{t.title}</h1>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setLang(lang === 'en' ? 'cn' : 'en')}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Globe size={16} />
              <span>{lang === 'en' ? '中文' : 'English'}</span>
            </button>
            {data.length > 0 && (
              <div className="flex items-center space-x-2">
                <button 
                  onClick={downloadExcel}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200/50"
                >
                  <FileDown size={16} />
                  <span className="hidden sm:inline">{t.exportExcel}</span>
                </button>
                <button 
                  onClick={downloadCSV}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">{t.exportCsv}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {data.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-white shadow-xl shadow-slate-200 rounded-3xl flex items-center justify-center text-indigo-600">
              <Upload size={48} />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-slate-900">{t.uploadArea}</h2>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">{t.uploadHint}</p>
            </div>
            <label className="cursor-pointer bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center space-x-2">
              <FileSpreadsheet size={20} />
              <span>Choose Your Dataset</span>
              <input type="file" className="hidden" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex space-x-1 bg-slate-200/60 p-1 rounded-xl">
                <button 
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <BarChart3 size={18} />
                  <span>{t.statsTitle}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('viz')}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'viz' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <FileSpreadsheet size={18} />
                  <span>{t.vizTitle}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('data')}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <TableIcon size={18} />
                  <span>{t.dataTitle}</span>
                </button>
              </div>
              <div className="hidden md:flex items-center space-x-4">
                {activeFilters.length > 0 && (
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center space-x-1">
                    <FilterIcon size={12} />
                    <span>{filteredData.length} records filtered</span>
                  </span>
                )}
                <div className="flex items-center space-x-2 text-slate-400">
                  <Info size={14} />
                  <span className="text-xs font-semibold uppercase tracking-widest">{data.length} total records</span>
                </div>
              </div>
            </div>

            {activeTab === 'stats' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {stats.map((s, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group">
                        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center justify-between">
                          <span className="truncate">{s.columnName}</span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full uppercase tracking-tighter">Metric N={s.count}</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                          <div className="bg-indigo-50/50 p-3 rounded-2xl transition-colors group-hover:bg-indigo-50">
                            <p className="text-[10px] uppercase tracking-wider text-indigo-600/60 font-black mb-1">{t.mean}</p>
                            <p className="text-2xl font-black text-indigo-600 leading-none">{s.mean?.toFixed(2) ?? 'N/A'}</p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black mb-1">{t.median}</p>
                            <p className="text-2xl font-black text-slate-700 leading-none">{s.median?.toFixed(2) ?? 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black mb-1">{t.stdDev}</p>
                            <p className="text-sm font-black text-slate-600">{s.stdDev?.toFixed(2) ?? 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black mb-1">{t.variance}</p>
                            <p className="text-sm font-black text-slate-600">{s.variance?.toFixed(2) ?? 'N/A'}</p>
                          </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Minimum</span>
                            <span className="text-xs font-bold text-slate-700">{s.min}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Maximum</span>
                            <span className="text-xs font-bold text-slate-700">{s.max}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center space-x-2">
                      <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
                      <span>{t.correlation}</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-separate border-spacing-1">
                        <thead>
                          <tr>
                            <th className="p-2"></th>
                            {numericColumns.map(col => (
                              <th key={col} className="p-3 text-center font-black text-slate-500 uppercase tracking-tighter truncate max-w-[100px]">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {numericColumns.map(rowCol => (
                            <tr key={rowCol}>
                              <td className="p-3 font-black text-slate-800 border-r-2 border-slate-100 uppercase tracking-tighter truncate max-w-[120px]">{rowCol}</td>
                              {numericColumns.map(col => {
                                const val = correlations[rowCol][col];
                                const colorIntensity = Math.abs(val);
                                const bgColor = val > 0 
                                  ? `rgba(79, 70, 229, ${colorIntensity * 0.4})` 
                                  : `rgba(239, 68, 68, ${colorIntensity * 0.4})`;
                                return (
                                  <td 
                                    key={col} 
                                    style={{ backgroundColor: bgColor }}
                                    className="p-4 text-center rounded-lg font-black text-slate-900 shadow-inner"
                                  >
                                    {val.toFixed(2)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-300 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:bg-indigo-500/30"></div>
                    <div className="relative z-10">
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                          <BrainCircuit size={32} className="text-indigo-400" />
                        </div>
                        <h3 className="text-2xl font-black">AI Insights</h3>
                      </div>
                      <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium">
                        Analyze deep data structures and uncover strategic trends with autonomous AI processing.
                      </p>
                      <button 
                        onClick={handleAIInsight}
                        disabled={loadingAI}
                        className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black hover:bg-slate-100 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-white/5"
                      >
                        {loadingAI ? (
                          <>
                            <div className="w-5 h-5 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                            <span className="uppercase tracking-widest">{t.aiAnalyzing}</span>
                          </>
                        ) : (
                          <>
                            <BrainCircuit size={20} />
                            <span className="uppercase tracking-widest">{t.aiInsight}</span>
                          </>
                        )}
                      </button>
                      {aiInsight && (
                        <div className="mt-8 bg-slate-800/80 p-6 rounded-2xl text-sm leading-relaxed border border-slate-700/50 whitespace-pre-wrap font-medium text-slate-300 animate-in fade-in zoom-in duration-300">
                          {aiInsight}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <h4 className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">
                      <Settings2 size={16} className="text-slate-300" />
                      <span>Dataset Telemetry</span>
                    </h4>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm font-bold">Total Rows</span>
                        <div className="px-3 py-1 bg-slate-50 rounded-lg font-black text-slate-900">{data.length}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm font-bold">Fields Detected</span>
                        <div className="px-3 py-1 bg-slate-50 rounded-lg font-black text-slate-900">{columns.length}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm font-bold">Analyzable</span>
                        <div className="px-3 py-1 bg-indigo-50 rounded-lg font-black text-indigo-600">{numericColumns.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'viz' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                    <button 
                      onClick={() => setVizMode('distribution')}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${vizMode === 'distribution' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <PieIcon size={16} />
                      <span className="hidden sm:inline">Distribution</span>
                    </button>
                    <button 
                      onClick={() => setVizMode('relationship')}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${vizMode === 'relationship' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <BoxSelect size={16} />
                      <span className="hidden sm:inline">Relationships</span>
                    </button>
                    <button 
                      onClick={() => setVizMode('trends')}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${vizMode === 'trends' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <TrendingUp size={16} />
                      <span className="hidden sm:inline">Trends</span>
                    </button>
                  </div>
                  
                  <div className="relative" ref={exportMenuRef}>
                    <button 
                      onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-white text-slate-700 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all border border-slate-200 uppercase tracking-widest shadow-sm active:scale-95 group"
                    >
                      <Camera size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                      <span>Export Chart</span>
                      <ChevronDown size={14} className={`transition-transform duration-300 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isExportMenuOpen && (
                      <div className="absolute right-0 mt-3 w-52 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                        <div className="p-3.5 bg-slate-50/70 border-b border-slate-50 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Format</span>
                          {lastExportFormat && (
                            <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">Last Used: {lastExportFormat}</span>
                          )}
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          <button 
                            onClick={() => handleExportChart('png')}
                            className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold rounded-xl transition-all group ${lastExportFormat === 'png' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                          >
                            <div className="flex items-center space-x-3">
                              <ImageIcon size={16} className={`${lastExportFormat === 'png' ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                              <span>PNG Image</span>
                            </div>
                            {lastExportFormat === 'png' && <Check size={14} className="animate-in zoom-in duration-300" />}
                          </button>
                          <button 
                            onClick={() => handleExportChart('jpeg')}
                            className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold rounded-xl transition-all group ${lastExportFormat === 'jpeg' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                          >
                            <div className="flex items-center space-x-3">
                              <ImageIcon size={16} className={`${lastExportFormat === 'jpeg' ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                              <span>JPEG Image</span>
                            </div>
                            {lastExportFormat === 'jpeg' && <Check size={14} className="animate-in zoom-in duration-300" />}
                          </button>
                          <button 
                            onClick={() => handleExportChart('svg')}
                            className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold rounded-xl transition-all group ${lastExportFormat === 'svg' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                          >
                            <div className="flex items-center space-x-3">
                              <FileCode size={16} className={`${lastExportFormat === 'svg' ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                              <span>SVG Vector</span>
                            </div>
                            {lastExportFormat === 'svg' && <Check size={14} className="animate-in zoom-in duration-300" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div ref={chartRef} className="p-2 -m-2">
                  {vizMode === 'distribution' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {numericColumns.slice(0, 6).map((col, i) => (
                        <div key={`bar-${col}`} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-72">
                          <h3 className="font-black text-slate-800 text-xs mb-4 uppercase tracking-widest flex items-center justify-between">
                            {col} <span className="text-[8px] opacity-40">Frequency Bar</span>
                          </h3>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredData.slice(0, 20)}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey={columns[0] || 'index'} hide />
                              <YAxis axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ))}
                      {categoricalColumns.slice(0, 3).map((col, i) => (
                        <div key={`pie-${col}`} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-72">
                          <h3 className="font-black text-slate-800 text-xs mb-4 uppercase tracking-widest">{col} Distribution</h3>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={getPieData(col)}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {getPieData(col).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ))}
                    </div>
                  )}

                  {vizMode === 'relationship' && (
                    <div className="space-y-6">
                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <BoxSelect size={20} />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Correlation Explorer</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Multidimensional Mapping</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 max-2xl">
                          <div className="flex flex-col space-y-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 ml-1">X Axis (Numeric)</span>
                            <select 
                              value={scatterX} 
                              onChange={(e) => setScatterX(e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                              {numericColumns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col space-y-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 ml-1">Y Axis (Numeric)</span>
                            <select 
                              value={scatterY} 
                              onChange={(e) => setScatterY(e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                              {numericColumns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col space-y-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 ml-1 flex items-center gap-1">
                              <Palette size={8} /> Color Segment
                            </span>
                            <select 
                              value={scatterColor} 
                              onChange={(e) => setScatterColor(e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                              <option value="">No Color Segment</option>
                              {columns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl h-[550px] relative">
                        <div className="absolute top-8 left-8 z-10">
                          <span className="text-[9px] font-black uppercase bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-sm tracking-widest">
                            {scatterX} vs {scatterY}
                          </span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 40, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis 
                              type="number" 
                              dataKey={scatterX} 
                              name={scatterX} 
                              axisLine={false} 
                              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                            />
                            <YAxis 
                              type="number" 
                              dataKey={scatterY} 
                              name={scatterY} 
                              axisLine={false} 
                              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                            />
                            <Tooltip 
                              cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }}
                              content={<CustomTooltip />}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right" 
                              iconType="circle"
                              wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} 
                            />
                            {Object.entries(groupedScatterData).map(([groupName, groupData], idx) => (
                              <Scatter 
                                key={groupName} 
                                name={groupName} 
                                data={groupData} 
                                fill={colorMap ? colorMap[groupName] : (scatterColor ? COLORS[idx % COLORS.length] : '#6366f1')} 
                                fillOpacity={0.7} 
                              />
                            ))}
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {vizMode === 'trends' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-6">
                        {numericColumns.slice(0, 3).map((col, i) => (
                          <div key={`line-${col}`} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-80">
                            <h3 className="font-black text-slate-800 text-xs mb-6 uppercase tracking-widest">{col} Sequential Trend</h3>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={filteredData.slice(0, 100)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey={columns[0] || 'index'} hide />
                                <YAxis axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line 
                                  type="monotone" 
                                  dataKey={col} 
                                  stroke={COLORS[i % COLORS.length]} 
                                  strokeWidth={3} 
                                  dot={false}
                                  animationDuration={1500}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-slate-900 rounded-xl text-white">
                        <FilterIcon size={18} />
                      </div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">Filter Laboratory</h3>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                        <Plus size={16} />
                        <span>Add Filter</span>
                      </button>
                      {isFilterPanelOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[60] overflow-hidden">
                          <div className="p-3 border-b border-slate-50 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Column to Filter</div>
                          <div className="max-h-64 overflow-y-auto">
                            {columns.map(col => (
                              <button 
                                key={col} 
                                onClick={() => addFilter(col)}
                                className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-between group"
                              >
                                <span>{col}</span>
                                <ChevronDown size={14} className="opacity-0 group-hover:opacity-100 -rotate-90" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-6 flex flex-wrap gap-4 bg-white min-h-[80px]">
                    {activeFilters.length === 0 ? (
                      <div className="flex items-center space-x-2 text-slate-400 italic text-sm font-medium">
                        <Info size={16} />
                        <span>No active filters. Data is in raw stream mode.</span>
                      </div>
                    ) : (
                      activeFilters.map(filter => (
                        <div key={filter.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3 min-w-[200px] shadow-sm animate-in zoom-in duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{filter.column}</span>
                            <button onClick={() => removeFilter(filter.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                          {filter.type === 'text' && (
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input 
                                type="text" 
                                placeholder="Search values..." 
                                value={filter.value}
                                onChange={(e) => updateFilterValue(filter.id, e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              />
                            </div>
                          )}
                          {filter.type === 'number' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Min</label>
                                <input 
                                  type="number" 
                                  value={filter.value.min}
                                  onChange={(e) => updateFilterValue(filter.id, { ...filter.value, min: parseFloat(e.target.value) })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Max</label>
                                <input 
                                  type="number" 
                                  value={filter.value.max}
                                  onChange={(e) => updateFilterValue(filter.id, { ...filter.value, max: parseFloat(e.target.value) })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          )}
                          {filter.type === 'category' && (
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                              {Array.from(new Set(data.map(d => String(d[filter.column] ?? 'null')))).slice(0, 15).map(val => {
                                const isChecked = (filter.value as Set<string>).has(val);
                                return (
                                  <button 
                                    key={val}
                                    onClick={() => {
                                      const next = new Set(filter.value);
                                      if (next.has(val)) next.delete(val);
                                      else next.add(val);
                                      updateFilterValue(filter.id, next);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${isChecked ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                                  >
                                    {val}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center space-x-2">
                      <TableIcon size={20} className="text-slate-400" />
                      <span>Data Registry</span>
                    </h3>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      {filteredData.length} of {data.length} records active
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          {columns.map(col => (
                            <th key={col} className="px-6 py-4 font-black text-slate-500 uppercase tracking-tighter border-b border-slate-100">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredData.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                            {columns.map(col => (
                              <td key={col} className="px-6 py-4 text-slate-700 font-medium whitespace-nowrap group-hover:text-slate-900">{String(row[col] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredData.length > 100 && (
                    <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Displaying 100 of {filteredData.length} records.
                      </span>
                    </div>
                  )}
                  {filteredData.length === 0 && (
                    <div className="p-20 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <Search size={32} />
                      </div>
                      <p className="font-black text-slate-900 uppercase tracking-widest">No results found</p>
                      <p className="text-slate-400 text-sm font-medium mt-1">Adjust your filter parameters to broaden the search.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="w-12 h-1.5 bg-indigo-600 rounded-full mx-auto mb-8"></div>
          <p className="text-slate-900 text-lg font-black uppercase tracking-tight mb-2">
            DataInsight Engine v2.6
          </p>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">
            {t.footerCredits}
          </p>
          <div className="flex justify-center space-x-8 text-slate-400">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Compute</span>
              <div className="w-1 h-1 rounded-full bg-slate-200"></div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Visual</span>
              <div className="w-1 h-1 rounded-full bg-slate-200"></div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Insight</span>
              <div className="w-1 h-1 rounded-full bg-slate-200"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
