import { useState, useEffect } from 'react';
import { apiService } from '../apiService';
import { Lecture, LMSConfig } from '../types';
import { 
  Folder, Play, FileText, AlertCircle, CheckCircle2, RefreshCcw, Edit2, Check, X, HardDrive, Info, ShieldCheck, Trash2
} from 'lucide-react';

interface LocalFilesManagerProps {
  lectures: Lecture[];
  config: LMSConfig;
  onRefresh: () => void;
  triggerSuccess: (msg: string) => void;
  triggerError: (msg: string) => void;
}

interface LocalFileRecord {
  id: string;
  fileName: string;
  fullPath: string;
  fileType: 'video' | 'pdf' | 'image' | 'attachment';
  size: number;
  createdAt: string;
  updatedAt: string;
  lectureId: string;
  exists?: boolean; // filled dynamically from check
  simulated?: boolean;
}

export default function LocalFilesManager({ lectures, config, onRefresh, triggerSuccess, triggerError }: LocalFilesManagerProps) {
  const [files, setFiles] = useState<LocalFileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPathValue, setEditingPathValue] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAndVerifyFiles = async () => {
    setLoading(true);
    try {
      const res = await apiService.verifyAllLocalFiles();
      setFiles(res.results || []);
      triggerSuccess('تم تحديث حالة كافة الملفات التعليمية بنجاح!');
    } catch (err: any) {
      console.error(err);
      triggerError('خطأ أثناء فحص الملفات: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndVerifyFiles();
  }, [lectures]);

  const handleClearAll = async () => {
    if (!window.confirm('هل أنت متأكد من مسح كافة سجلات الملفات المحلية؟ لن يتم حذف الملفات من جهازك، فقط سيتم مسح السجل من لوحة التحكم.')) return;
    setLoading(true);
    try {
      const res = await apiService.clearLocalFilesRecords();
      if (res.success) {
        setFiles([]);
        triggerSuccess('تم مسح سجل الملفات بنجاح');
        onRefresh();
      }
    } catch (err: any) {
      triggerError('خطأ أثناء مسح السجل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (file: LocalFileRecord) => {
    setEditingId(file.id);
    setEditingPathValue(file.fullPath);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingPathValue('');
  };

  const handleSavePath = async (id: string) => {
    if (!editingPathValue.trim()) return;
    setUpdatingId(id);
    try {
      const res = await apiService.updateLocalFilePath(id, editingPathValue.trim());
      if (res.success) {
        triggerSuccess('تم تعديل مسار الملف وإعادة ربطه بالمحاضرة بنجاح!');
        setEditingId(null);
        // Refresh local list
        const resList = await apiService.verifyAllLocalFiles();
        setFiles(resList.results || []);
        onRefresh();
      } else {
        triggerError('فشل تحديث المسار. تأكد من صحة مسار الملف.');
      }
    } catch (err: any) {
      console.error(err);
      triggerError('حدث خطأ أثناء تعديل المسار: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return 'غير معروف';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161B22]/50 p-6 border border-gray-850 rounded-2xl">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-orange-400" />
            إدارة الملفات والمحاضرات على الهارد ديسك المحلي
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            تعرض هذه اللوحة كافة الملفات والمقاطع المخزنة محلياً على جهاز الكمبيوتر الخاص بك، مع فحص مستمر لتواجدها لضمان تجربة بث خالية من الأعطال للطلاب.
          </p>
          <div className="mt-2 flex items-center gap-1.5 py-1 px-2.5 bg-orange-500/5 border border-orange-500/10 rounded-lg w-fit">
            <ShieldCheck className="w-3 h-3 text-orange-400" />
            <span className="text-[10px] text-gray-300 font-bold">المجال الأمني النشط (Root): </span>
            <span className="text-[10px] text-orange-400 font-mono" dir="ltr">{config.mediaRootFolder || './storage'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <button
            onClick={fetchAndVerifyFiles}
            disabled={loading}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-black text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>إعادة فحص المسارات</span>
          </button>
          
          <button
            onClick={handleClearAll}
            disabled={loading || files.length === 0}
            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 transition-all cursor-pointer flex items-center gap-2"
            title="مسح كافة سجلات الملفات من هذه القائمة"
          >
            <Trash2 className="w-4 h-4" />
            <span>مسح السجل</span>
          </button>
        </div>
      </div>

      <div className="bg-[#161B22] border border-gray-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-xs">
            <thead className="bg-[#0F1218] text-gray-300 border-b border-gray-800 font-bold">
              <tr>
                <th className="p-3 text-right">اسم الملف ونوعه</th>
                <th className="p-3 text-right">المحاضرة المرتبطة</th>
                <th className="p-3 text-right">المسار الكامل على الجهاز</th>
                <th className="p-3 text-right">حجم الملف</th>
                <th className="p-3 text-center">الحالة على الهارد ديسك</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-850 text-gray-300">
              {files.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 italic">
                    لا توجد ملفات محلية مسجلة حالياً. قم بإضافة محاضرات واختيار مساراتها المحلية من التبويب الخاص بإدارة المحاضرات.
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const linkedLec = lectures.find(l => l.id === file.lectureId);
                  const isEditing = editingId === file.id;
                  const isUpdating = updatingId === file.id;

                  return (
                    <tr key={file.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg border ${
                            file.fileType === 'video' 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                              : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          }`}>
                            {file.fileType === 'video' ? <Play className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                          </span>
                          <div>
                            <span className="font-bold text-white block truncate max-w-[180px]" title={file.fileName}>
                              {file.fileName}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {file.fileType === 'video' ? 'فيديو محاضرة' : 'مرفقات / شيت PDF'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-gray-300 font-medium">
                          {linkedLec ? linkedLec.title : <span className="text-red-400">محاضرة محذوفة</span>}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">{file.lectureId}</div>
                      </td>
                      <td className="p-3 font-mono">
                        {isEditing ? (
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              type="text"
                              value={editingPathValue}
                              onChange={(e) => setEditingPathValue(e.target.value)}
                              className="w-full py-1.5 px-3 bg-[#0F1218] border border-orange-500 text-left text-xs font-mono rounded-lg focus:outline-hidden text-white"
                              dir="ltr"
                            />
                          </div>
                        ) : (
                          <span 
                            className="text-left block text-[11px] truncate max-w-xs text-gray-400 font-mono hover:text-white cursor-help" 
                            dir="ltr"
                            title={file.fullPath}
                          >
                            {file.fullPath}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-gray-400">
                        {formatBytes(file.size)}
                      </td>
                      <td className="p-3 text-center">
                        {file.simulated ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-bold" title="يعمل بمحاكاة السيرفر السحابي، وعند تشغيلك للمشروع محلياً سيعمل من جهازك مباشرة">
                            <Info className="w-3 h-3 text-orange-400" />
                            <span>معاينة سحابية نشطة</span>
                          </span>
                        ) : file.exists ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>متوفر وحقيقي</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            <span>مفقود / نُقل</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSavePath(file.id)}
                                disabled={isUpdating}
                                className="p-1.5 bg-emerald-500 text-black rounded-lg hover:bg-emerald-600 disabled:bg-emerald-500/50 transition-colors cursor-pointer"
                                title="حفظ التعديل"
                              >
                                {isUpdating ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                                title="إلغاء"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(file)}
                              className="p-1.5 bg-[#0F1218] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                              title="تعديل مسار الملف"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>تحديث المسار</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#161B22]/30 p-4 border border-gray-850 rounded-2xl flex items-start gap-2.5">
        <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <strong className="text-white">نصيحة أمنية للأداء العالي:</strong> لتوفير سعة التخزين وحماية الخصوصية بشكل كامل، تعمل هذه المنصة ذاتياً على نظام تشغيل جهازك. بدلاً من رفع ملفات الفيديو الثقيلة أو الكتب الدراسية الكبيرة إلى الخادم السحابي أو تكرارها داخل المشروع، يحتفظ النظام بـ <strong>المسار الكامل للملف فقط على القرص الصلب الخاص بك</strong> ويقوم ببثه بسرعة فائقة للطلاب مباشرةً. يمكنك تعديل المسار يدوياً في أي وقت إذا قمت بإعادة تنظيم ملفاتك.
        </p>
      </div>
    </div>
  );
}
