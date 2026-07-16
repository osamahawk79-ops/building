import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../apiService';
import { 
  Folder, File, ChevronRight, HardDrive, Search, X, Check, 
  Home, RefreshCcw, ArrowUpAz, ArrowDownAz, Calendar, 
  Database, FileVideo, FileText, Image as ImageIcon, Archive, Clock,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LocalFileItem {
  name: string;
  isDirectory: boolean;
  fullPath: string;
  size?: number;
  mtime?: string;
  extension?: string;
}

interface LocalFileBrowserProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  title: string;
  allowedExtensions?: string[];
}

const LocalFileBrowser: React.FC<LocalFileBrowserProps> = ({ onSelect, onClose, title, allowedExtensions }) => {
  const [drives, setDrives] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<LocalFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchDrives();
  }, []);

  const fetchDrives = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.getSystemDrives();
      if (res.error) {
        setError(res.error);
        setDrives(['THIS_PC', 'C:']);
      } else if (res.drives && res.drives.length > 0) {
        setDrives(['THIS_PC', ...res.drives]);
        // Default to This PC
        if (!currentPath) navigateTo('THIS_PC');
      } else {
        setDrives(['THIS_PC', 'C:']);
        if (!currentPath) navigateTo('THIS_PC');
      }
    } catch (err) {
      setError('فشل الاتصال بالسيرفر المحلي. تأكد من تشغيل البرنامج كمسؤول.');
      setDrives(['C:']);
    } finally {
      setLoading(false);
    }
  };

  const [manualPath, setManualPath] = useState('');
  const [showManualPath, setShowManualPath] = useState(false);

  const handleManualNavigate = () => {
    if (manualPath) {
      navigateTo(manualPath);
      setShowManualPath(false);
    }
  };

  const navigateTo = async (path: string) => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
        setError('لا يمكن الوصول إلى ملفات الجهاز في وضع المعاينة السحابية. يرجى تشغيل التطبيق محلياً (localhost) وتأكد من تشغيل السيرفر المحلي.');
        return;
    }
    setLoading(true);
    setError('');
    setSearchTerm(''); // Clear search when navigating
    try {
      const res = await apiService.listSystemDir(path);
      // Even if res has error, apiService might return it if it parsed JSON correctly
      if (res && res.error) {
        setError(res.error);
      } else if (res && res.items) {
        setCurrentPath(path);
        setItems(res.items);
      } else {
        setError('تعذر الحصول على استجابة من السيرفر');
      }
    } catch (err: any) {
      console.error("[NAVIGATE] Error:", err);
      // If it's a parse error or network error
      setError('فشل قراءة المجلد. تأكد من أن السيرفر المحلي يعمل بشكل صحيح وأن المتصفح لديه صلاحية الوصول إليه.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: LocalFileItem) => {
    if (item.isDirectory) {
      navigateTo(item.fullPath);
    } else {
      const ext = item.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions || allowedExtensions.length === 0 || (ext && allowedExtensions.includes(ext))) {
        onSelect(item.fullPath);
      }
    }
  };

  const refresh = () => {
    if (currentPath) navigateTo(currentPath);
    else fetchDrives();
  };

  const goBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    if (parts.length <= 1) {
      setCurrentPath('');
      setItems([]);
      return;
    }
    parts.pop();
    const parent = currentPath.includes('\\') ? parts.join('\\') : '/' + parts.join('/');
    navigateTo(parent);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (item: LocalFileItem) => {
    if (item.isDirectory) return <Folder className="w-5 h-5 text-blue-400 fill-blue-400/10" />;
    
    const ext = item.extension?.toLowerCase();
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext || '')) return <FileVideo className="w-5 h-5 text-orange-400" />;
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText className="w-5 h-5 text-red-400" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (['zip', 'rar', '7z', 'tar'].includes(ext || '')) return <Archive className="w-5 h-5 text-yellow-400" />;
    
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];
    
    // Filter
    if (searchTerm) {
      result = result.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    // Sort
    result.sort((a, b) => {
      // Directories always first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      let comparison = 0;
      if (sortBy === 'name') comparison = a.name.localeCompare(b.name);
      else if (sortBy === 'size') comparison = (a.size || 0) - (b.size || 0);
      else if (sortBy === 'date') comparison = new Date(a.mtime || 0).getTime() - new Date(b.mtime || 0).getTime();
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [items, searchTerm, sortBy, sortOrder]);

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    const crumbs = [];
    let accumulatedPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const isWindows = currentPath.includes('\\') || currentPath.includes(':');
      if (i === 0 && isWindows && parts[i].endsWith(':')) {
        accumulatedPath = parts[i] + '\\';
      } else {
        accumulatedPath = pathJoin(accumulatedPath, parts[i]);
      }
      crumbs.push({ name: parts[i], path: accumulatedPath });
    }
    return crumbs;
  }, [currentPath]);

  function pathJoin(p1: string, p2: string) {
    if (currentPath.includes('\\')) return p1.endsWith('\\') ? p1 + p2 : p1 + '\\' + p2;
    return p1.endsWith('/') ? p1 + p2 : p1 + '/' + p2;
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-2 md:p-8"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-5xl bg-[#0D1117] border border-gray-800/50 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-[90vh] md:h-[80vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800 bg-[#161B22]/50 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-orange-500/10 rounded-2xl border border-orange-500/20">
              <Search className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">{title}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">السيرفر المحلي متصل</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all hover:rotate-90">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-gray-800 bg-[#0A0C10] flex flex-col md:flex-row gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigateTo(drives[0] || 'C:')}
              className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors border border-transparent hover:border-gray-800"
              title="المجلد الرئيسي"
            >
              <Home className="w-4 h-4" />
            </button>
            <button 
              onClick={refresh}
              className={`p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors border border-transparent hover:border-gray-800 ${loading ? 'animate-spin' : ''}`}
              title="تحديث"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <div className="h-6 w-px bg-gray-800 mx-1"></div>
            
            <div className="flex-1 flex items-center gap-1 bg-[#0D1117] border border-gray-800 px-3 py-1.5 rounded-xl overflow-x-auto no-scrollbar max-w-[300px] md:max-w-md">
              <button onClick={() => navigateTo(drives[0])} className="text-gray-500 hover:text-white shrink-0">
                <HardDrive className="w-3.5 h-3.5" />
              </button>
              <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <button 
                    onClick={() => navigateTo(crumb.path)}
                    className={`text-[10px] font-bold whitespace-nowrap transition-colors ${idx === breadcrumbs.length - 1 ? 'text-orange-400' : 'text-gray-400 hover:text-white'}`}
                  >
                    {crumb.name}
                  </button>
                  {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-gray-700 shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في المجلد الحالي..."
                className="w-full bg-[#0D1117] border border-gray-800 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white focus:outline-hidden focus:border-orange-500 transition-all placeholder:text-gray-600"
              />
            </div>
            <div className="flex items-center gap-1 bg-[#0D1117] border border-gray-800 p-1 rounded-xl">
              <button 
                onClick={() => setSortBy('name')}
                className={`p-1.5 rounded-lg text-[10px] font-bold transition-all ${sortBy === 'name' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-white'}`}
              >
                الاسم
              </button>
              <button 
                onClick={() => setSortBy('date')}
                className={`p-1.5 rounded-lg text-[10px] font-bold transition-all ${sortBy === 'date' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-white'}`}
              >
                التاريخ
              </button>
              <button 
                onClick={() => {
                  if (sortBy === 'size') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  else { setSortBy('size'); setSortOrder('desc'); }
                }}
                className={`p-1.5 rounded-lg text-[10px] font-bold transition-all ${sortBy === 'size' ? 'bg-orange-500 text-black' : 'text-gray-500 hover:text-white'}`}
              >
                الحجم
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Drives Sidebar */}
          <div className="w-16 md:w-24 border-l border-gray-800/50 bg-[#0A0C10] p-2 space-y-3 overflow-y-auto no-scrollbar">
            <div className="text-[8px] font-black text-gray-600 px-1 mb-2 uppercase tracking-[0.2em] text-center">DRIVES</div>
            {drives.map(drive => (
              <button
                key={drive}
                onClick={() => navigateTo(drive)}
                className={`w-full p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all group ${
                  currentPath.startsWith(drive) ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' : 'hover:bg-white/5 text-gray-500 border border-transparent'
                }`}
              >
                <Database className={`w-5 h-5 ${currentPath.startsWith(drive) ? 'text-orange-500' : 'text-gray-600 group-hover:text-gray-300'}`} />
                <span className="text-[9px] font-black uppercase">{drive}</span>
              </button>
            ))}

            <button
              onClick={() => {
                setManualPath(currentPath);
                setShowManualPath(true);
              }}
              className="w-full p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-white/5 text-gray-500 border border-transparent transition-all group"
              title="إدخال مسار يدوي"
            >
              <div className="p-1 border border-dashed border-gray-700 rounded-lg group-hover:border-orange-500 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </div>
              <span className="text-[8px] font-bold">يدوي</span>
            </button>
          </div>

          {/* Manual Path Modal */}
          <AnimatePresence>
            {showManualPath && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowManualPath(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative w-full max-w-md bg-[#0D1117] border border-gray-800 rounded-2xl p-6 shadow-2xl"
                >
                  <h4 className="text-white font-bold mb-4">إدخال مسار يدوي</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-black block mb-2">المسار الكامل</label>
                      <input 
                        type="text"
                        value={manualPath}
                        onChange={(e) => setManualPath(e.target.value)}
                        placeholder="مثال: D:\Videos\MyCourse"
                        className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-hidden focus:border-orange-500 transition-all"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleManualNavigate}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-black font-black py-3 rounded-xl transition-all"
                      >
                        انتقال
                      </button>
                      <button 
                        onClick={() => setShowManualPath(false)}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Files List */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0D1117]">
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-orange-500/10 rounded-full"></div>
                    <div className="absolute inset-0 w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-black text-white tracking-widest uppercase">جاري القراءة</span>
                    <span className="text-[10px] text-gray-500 mt-1">يرجى الانتظار، السيرفر يبحث في جهازك...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                  <div className="p-4 bg-red-500/5 rounded-full border border-red-500/10">
                    <ShieldCheck className="w-10 h-10 text-red-500/40" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white mb-2">تعذر الوصول للمسار المختار</h4>
                    <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">{error}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigateTo(drives[0] || 'C:')} 
                      className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold rounded-xl transition-all"
                    >
                      الذهاب للرئيسية
                    </button>
                    <button 
                      onClick={refresh} 
                      className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-black text-[10px] font-bold rounded-xl transition-all"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                </div>
              ) : filteredAndSortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-40">
                  <Folder className="w-12 h-12 mb-3" />
                  <span className="text-xs font-black">لا توجد ملفات تطابق بحثك</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredAndSortedItems.map((item, idx) => {
                    const isFile = !item.isDirectory;
                    const ext = item.name.split('.').pop()?.toLowerCase();
                    const isAllowed = !isFile || !allowedExtensions || allowedExtensions.length === 0 || allowedExtensions.includes(ext || '');

                    return (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.01 }}
                        disabled={isFile && !isAllowed}
                        onClick={() => handleItemClick(item)}
                        className={`p-3 rounded-2xl border text-right group relative overflow-hidden transition-all flex flex-col gap-3 ${
                          isFile && isAllowed ? 'bg-orange-500/5 border-orange-500/10 hover:bg-orange-500/10 hover:border-orange-500/30' :
                          item.isDirectory ? 'bg-gray-800/10 border-gray-800/40 hover:bg-gray-800/30 hover:border-gray-700' :
                          'bg-transparent border-transparent opacity-10 grayscale cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className={`p-2.5 rounded-xl transition-colors ${item.isDirectory ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20' : 'bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20'}`}>
                            {getFileIcon(item)}
                          </div>
                          {isFile && isAllowed && (
                            <div className="bg-orange-500/20 text-orange-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-black text-gray-200 truncate group-hover:text-white leading-tight" title={item.name}>
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter shrink-0">
                              {item.isDirectory ? 'مجلد' : (ext || 'ملف')}
                            </span>
                            {item.size && !item.isDirectory && (
                              <>
                                <span className="h-0.5 w-0.5 rounded-full bg-gray-700"></span>
                                <span className="text-[9px] text-gray-500 font-mono">{formatSize(item.size)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {item.mtime && (
                          <div className="flex items-center gap-1 text-[8px] text-gray-600 mt-auto pt-2 border-t border-gray-800/30">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{new Date(item.mtime).toLocaleDateString('ar-EG')}</span>
                          </div>
                        )}
                        
                        {/* Selected Indicator for items already in root */}
                        <div className="absolute bottom-0 right-0 w-12 h-12 bg-orange-500/5 translate-x-6 translate-y-6 rotate-45 pointer-events-none group-hover:bg-orange-500/10 transition-colors"></div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#161B22]/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
               <Info className="w-4 h-4 text-orange-400" />
             </div>
             <div>
               <p className="text-[10px] text-gray-400 font-bold leading-none mb-1">صلاحيات الوصول التلقائية</p>
               <p className="text-[9px] text-gray-500 leading-tight">سيقوم النظام بفتح المجلدات المختارة تلقائياً في خلفية السيرفر لضمان سرعة التحميل.</p>
             </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-black rounded-2xl transition-all border border-gray-700/50"
            >
              إغاء الأمر
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Helper for Info icon which was missing in original imports
const Info = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);

export default LocalFileBrowser;
