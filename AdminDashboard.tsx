import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../apiService';
import { UserProfile, Category, Lecture, LMSConfig, WalletDetails } from '../types';
import { 
  Users, FolderHeart, Video, Palette, Plus, Trash2, Edit2, CheckCircle, 
  XCircle, Ban, RefreshCcw, Save, ShieldAlert, CreditCard, ExternalLink, Play, Lock, Sparkles, HelpCircle,
  UploadCloud, FileUp, Paperclip, Image, EyeOff, Maximize, HardDrive,
  Activity, ShieldCheck, Info, Search, FolderOpen, Database, FolderPlus
} from 'lucide-react';
import LocalFilesManager from './LocalFilesManager';
import LocalFileBrowser from './LocalFileBrowser';

interface AdminDashboardProps {
  onClose: () => void;
  config: LMSConfig;
  onUpdateConfig: (newConfig: LMSConfig) => void;
  onRefreshData?: () => void;
}

export default function AdminDashboard({ onClose, config, onUpdateConfig, onRefreshData }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'categories' | 'lectures' | 'branding' | 'licenses' | 'local_files' | 'media_audit' | 'system_status'>('users');
  const [showFileBrowser, setShowFileBrowser] = useState<{ active: boolean, target: 'video' | 'attachment' }>({ active: false, target: 'video' });
  
  // Data States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [auditResults, setAuditResults] = useState<any[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditTimestamp, setAuditTimestamp] = useState<string | null>(null);

  const handleFileSelect = (path: string) => {
    if (showFileBrowser.target === 'video') {
      setLecVideoUrl(path);
      setLecProvider('local' as any);
      verifyLocalPath(path, 'video');
    } else {
      setLecFileUrl(path);
      const parts = path.split(/[/\\]/);
      setLecFileName(parts[parts.length - 1] || '');
      verifyLocalPath(path, 'attachment');
    }
    setShowFileBrowser({ active: false, target: 'video' });
  };
  
  // Loading & Error States
  const [loading, setLoading] = useState({ users: false, categories: false, lectures: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states - Categories
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImageUrl, setCatImageUrl] = useState('');
  const [catImageUploading, setCatImageUploading] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Form states - Lectures
  const [lecTitle, setLecTitle] = useState('');
  const [lecDesc, setLecDesc] = useState('');
  const [lecCatId, setLecCatId] = useState('');
  const [lecVideoUrl, setLecVideoUrl] = useState('');
  const [lecProvider, setLecProvider] = useState<'bunny' | 'vimeo' | 'youtube' | 'raw'>('youtube');
  const [lecFileUrl, setLecFileUrl] = useState('');
  const [lecFileName, setLecFileName] = useState('');
  const [lecTier, setLecTier] = useState<'free' | 'bronze' | 'gold'>('free');
  const [editingLecId, setEditingLecId] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, type: 'video' | 'attachment') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'video') setVideoUploading(true);
    else setAttachmentUploading(true);
    
    setUploadProgress(0);

    try {
      const res = await apiService.uploadSystemFile(file, type, (progress) => {
        setUploadProgress(progress);
      });

      if (res.success && res.path) {
        if (type === 'video') {
          setLecVideoUrl(res.path);
          setLecProvider('local' as any);
        } else {
          setLecFileUrl(res.path);
          setLecFileName(res.originalName || res.filename || '');
        }
        triggerSuccess('تم رفع الملف بنجاح إلى السيرفر المحلى.');
      } else {
        triggerError(res.error || 'فشل رفع الملف');
      }
    } catch (err: any) {
      triggerError('خطأ أثناء الرفع: ' + err.message);
    } finally {
      setVideoUploading(false);
      setAttachmentUploading(false);
      setUploadProgress(0);
      // Reset input
      e.target.value = '';
    }
  };

  const handleNativePick = async (type: 'video' | 'attachment') => {
    try {
      const res = await apiService.openNativePicker(type);
      if (res.success && res.path) {
        if (type === 'video') {
          setLecVideoUrl(res.path);
          setLecProvider('local' as any);
          verifyLocalPath(res.path, 'video');
        } else {
          setLecFileUrl(res.path);
          const parts = res.path.split(/[/\\]/);
          setLecFileName(parts[parts.length - 1] || '');
          verifyLocalPath(res.path, 'attachment');
        }
        triggerSuccess('تم تحديد المسار بنجاح من جهازك.');
      } else if (res.error) {
        triggerError(res.error);
        setShowFileBrowser({ active: true, target: type });
      }
    } catch (err: any) {
      triggerError('خطأ: ' + err.message);
      setShowFileBrowser({ active: true, target: type });
    }
  };

  const [verifyingPath, setVerifyingPath] = useState<{ [key: string]: boolean }>({});
  const [pathStatus, setPathStatus] = useState<{ [key: string]: 'valid' | 'invalid' | null }>({});

  const verifyLocalPath = async (targetPath: string, key: 'video' | 'attachment') => {
    if (!targetPath) return;
    setVerifyingPath(prev => ({ ...prev, [key]: true }));
    try {
      const res = await apiService.verifyPath(targetPath);
      setPathStatus(prev => ({ ...prev, [key]: res.exists ? 'valid' : 'invalid' }));
      if (res.exists) {
        triggerSuccess(`تم التحقق: ${res.name} (${(res.size! / (1024 * 1024)).toFixed(1)} MB)`);
      } else {
        triggerError('المسار غير صحيح أو الملف غير موجود');
      }
    } catch (err) {
      setPathStatus(prev => ({ ...prev, [key]: 'invalid' }));
    } finally {
      setVerifyingPath(prev => ({ ...prev, [key]: false }));
    }
  };

  // Form states - Branding / Settings
  const [siteName, setSiteName] = useState(config.siteName);
  const [mainTitle, setMainTitle] = useState(config.mainTitle);
  const [subTitle, setSubTitle] = useState(config.subTitle);
  const [logoUrl, setLogoUrl] = useState(config.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor);
  const [mediaRootFolder, setMediaRootFolder] = useState(config.mediaRootFolder || '');
  const [mediaFolders, setMediaFolders] = useState<string[]>(config.mediaFolders || [config.mediaRootFolder || '']);
  const [newMediaFolder, setNewMediaFolder] = useState('');
  const [logoWidth, setLogoWidth] = useState(config.logoWidth || 160);
  const [logoHeight, setLogoHeight] = useState(config.logoHeight || 40);
  const [logoPadding, setLogoPadding] = useState(config.logoPadding || 0);
  const [fontFamily, setFontFamily] = useState(config.fontFamily || 'Cairo');
  const [logoUploading, setLogoUploading] = useState(false);
  
  // Hero media states
  const [heroMediaUrl, setHeroMediaUrl] = useState(config.heroMediaUrl || '');
  const [heroMediaType, setHeroMediaType] = useState(config.heroMediaType || 'image');
  const [heroOpacity, setHeroOpacity] = useState(config.heroOpacity || 60);
  const [heroBlur, setHeroBlur] = useState(config.heroBlur || 2);
  const [heroUploading, setHeroUploading] = useState(false);

  const [wallets, setWallets] = useState<WalletDetails[]>(config.paymentDetails.walletNumbers);
  
  // Category preview states
  const [catPreviewUrl, setCatPreviewUrl] = useState('');
  const [catPreviewUploading, setCatPreviewUploading] = useState(false);
  
  // New wallet form input
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletNumber, setNewWalletNumber] = useState('');
  const [newWalletProvider, setNewWalletProvider] = useState('');

  // Refresh data helper
  const refreshAllData = async () => {
    try {
      const cList = await apiService.listCategories();
      setCategories(cList);
      
      const lList = await apiService.listLectures();
      setLectures(lList);
      
      const uList = await apiService.listUsers();
      setUsers(uList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

      if (activeTab === 'media_audit') {
        runAudit();
      }

      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ أثناء تحميل البيانات: ' + (err.message || ''));
    }
  };

  // Subscribe/Fetch from Appwrite
  useEffect(() => {
    refreshAllData();
  }, []);

  // Flash Messages Utility
  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };
  const triggerError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 4000);
  };

  // --- ACTIONS: USER MANAGEMENT ---
  const handleUserSubscription = async (userId: string, tier: 'none' | 'bronze' | 'gold', status: 'none' | 'active' | 'blocked') => {
    try {
      const now = new Date();
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);

      await apiService.updateUserProfile(userId, {
        subscription: tier,
        subscriptionStatus: status,
        // Reset pending tier and transaction details if activating
        ...(status === 'active' ? {
          pendingSubscriptionType: 'none',
          paymentTxInfo: null,
          subscriptionActivatedAt: now.toISOString(),
          subscriptionExpiresAt: expires.toISOString()
        } : status === 'none' ? {
          pendingSubscriptionType: 'none',
          paymentTxInfo: null,
          subscriptionActivatedAt: '',
          subscriptionExpiresAt: ''
        } : {})
      });
      triggerSuccess('تم تحديث اشتراك المستخدم بنجاح مع تحديد مدة 30 يوماً!');
      refreshAllData();
    } catch (err: any) {
      console.error(err);
      triggerError('خطأ أثناء تعديل صلاحيات المستخدم: ' + err.message);
    }
  };

  const handleUserBan = async (userId: string, isBlocked: boolean) => {
    try {
      await apiService.updateUserProfile(userId, {
        subscriptionStatus: isBlocked ? 'blocked' : 'none'
      });
      triggerSuccess(isBlocked ? 'تم حظر المستخدم بنجاح' : 'تم فك حظر المستخدم');
      refreshAllData();
    } catch (err: any) {
      console.error(err);
      triggerError('خطأ أثناء تغيير حالة حظر المستخدم.');
    }
  };

  const handleUpdateUserQuota = async (userId: string, maxDl: number) => {
    try {
      await apiService.updateUserQuota(userId, { maxDownloads: maxDl });
      triggerSuccess('تم تحديث حد التحميل بنجاح');
      refreshAllData();
    } catch (err: any) {
      triggerError('فشل التحديث: ' + (err.message || ''));
    }
  };

  const handleResetCounter = async (userId: string) => {
    try {
      await apiService.updateUserQuota(userId, { resetCounter: true });
      triggerSuccess('تم تصفير عداد التحميلات');
      refreshAllData();
    } catch (err: any) {
      triggerError('فشل التصفير: ' + (err.message || ''));
    }
  };

  // --- ACTIONS: CATEGORIES MANAGEMENT ---
  const handleSaveCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      const id = editingCatId || catName.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now();
      await apiService.saveCategory({
        id,
        name: catName.trim(),
        description: catDesc.trim(),
        imageUrl: catImageUrl.trim() || undefined,
        previewUrl: catPreviewUrl.trim() || undefined,
        createdAt: new Date().toISOString()
      });

      triggerSuccess(editingCatId ? 'تم تعديل القسم بنجاح' : 'تم إضافة القسم بنجاح');
      setCatName('');
      setCatDesc('');
      setCatImageUrl('');
      setCatPreviewUrl('');
      setEditingCatId(null);
      refreshAllData();
    } catch (err: any) {
      console.error(err);
      triggerError('فشل حفظ القسم.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    // Check if category has lectures
    const hasLectures = lectures.some(lec => lec.categoryId === id);
    if (hasLectures) {
      triggerError('لا يمكن حذف هذا القسم لأنه يحتوي على محاضرات مرتبطة به. يرجى نقل المحاضرات أو حذفها أولاً.');
      return;
    }

    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    try {
      await apiService.deleteCategory(id);
      triggerSuccess('تم حذف القسم بنجاح.');
      refreshAllData();
    } catch (err: any) {
      console.error(err);
      triggerError('فشل حذف القسم.');
    }
  };

  // --- ACTIONS: LECTURES MANAGEMENT ---
  const handleSaveLecture = async (e: FormEvent) => {
    e.preventDefault();
    if (!lecTitle.trim() || !lecCatId || !lecVideoUrl.trim()) {
      triggerError('يرجى ملء الحقول الإجبارية (العنوان، القسم، ورابط الفيديو)');
      return;
    }

    try {
      const id = editingLecId || 'lecture-' + Date.now();
      
      // Basic lecture data
      const lectureData: Lecture = {
        id,
        categoryId: lecCatId,
        title: lecTitle.trim(),
        description: lecDesc.trim(),
        videoUrl: lecVideoUrl.trim(),
        videoProvider: lecProvider,
        fileUrl: lecFileUrl.trim(),
        fileName: lecFileUrl.trim() ? (lecFileName.trim() || 'ملف مرفق للدرس') : '',
        tierRequired: lecTier,
        createdAt: new Date().toISOString()
      };

      // Step 1: Save basic data
      await apiService.saveLecture(lectureData);

      // Step 2: If it's a local file, link it to get metadata (Size, Extension, etc.)
      if (lecProvider === 'local') {
        await apiService.linkLocalMedia(id, lecVideoUrl.trim(), 'video');
      }
      
      if (lecFileUrl.trim() && (lecFileUrl.trim().includes('\\') || lecFileUrl.trim().includes('/'))) {
        await apiService.linkLocalMedia(id, lecFileUrl.trim(), 'attachment');
      }

      triggerSuccess(editingLecId ? 'تم تحديث المحاضرة بنجاح' : 'تم إضافة المحاضرة بنجاح');
      
      // Reset Form
      setLecTitle('');
      setLecDesc('');
      setLecCatId('');
      setLecVideoUrl('');
      setLecProvider('youtube');
      setLecFileUrl('');
      setLecFileName('');
      setLecTier('free');
      setEditingLecId(null);
      refreshAllData();
    } catch (err: any) {
      console.error(err);
      triggerError('فشل حفظ المحاضرة.');
    }
  };

  const handleDeleteLecture = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المحاضرة؟')) return;
    try {
      await apiService.deleteLecture(id);
      triggerSuccess('تم حذف المحاضرة.');
      refreshAllData();
    } catch (err: any) {
      console.error(err);
      triggerError('فشل الحذف.');
    }
  };

  // --- ACTIONS: BRANDING & WALLETS ---
  const handleAddWallet = (e: FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim() || !newWalletNumber.trim() || !newWalletProvider.trim()) {
      triggerError('يرجى ملء كافة تفاصيل المحفظة المالية');
      return;
    }

    const updatedWallets = [...wallets, {
      name: newWalletName.trim(),
      number: newWalletNumber.trim(),
      provider: newWalletProvider.trim()
    }];
    setWallets(updatedWallets);
    
    // Reset inputs
    setNewWalletName('');
    setNewWalletNumber('');
    setNewWalletProvider('');
    triggerSuccess('تم إضافة الرقم إلى قائمة الدفع المؤقتة');
  };

  const handleRemoveWallet = (index: number) => {
    const updated = wallets.filter((_, idx) => idx !== index);
    setWallets(updated);
    triggerSuccess('تم حذف الرقم');
  };

  const handleAddMediaFolder = (e: FormEvent) => {
    e.preventDefault();
    if (!newMediaFolder.trim()) return;
    if (mediaFolders.includes(newMediaFolder.trim())) {
      triggerError('هذا المجلد موجود بالفعل في القائمة');
      return;
    }
    setMediaFolders([...mediaFolders, newMediaFolder.trim()]);
    setNewMediaFolder('');
    triggerSuccess('تم إضافة المجلد للقائمة');
  };

  const handleRemoveMediaFolder = (folder: string) => {
    setMediaFolders(mediaFolders.filter(f => f !== folder));
    triggerSuccess('تم إزالة المجلد');
  };

  useEffect(() => {
    // Auto-detect media root folder if not set and a local path is provided
    const isLocalPath = (p: string) => p && (p.includes('\\') || /^[A-Z]:/i.test(p));
    
    if (lecProvider === 'local' && isLocalPath(lecVideoUrl)) {
      const lastSlash = Math.max(lecVideoUrl.lastIndexOf('\\'), lecVideoUrl.lastIndexOf('/'));
      if (lastSlash !== -1) {
        const detectedRoot = lecVideoUrl.substring(0, lastSlash);
        if (detectedRoot && !mediaRootFolder) {
          setMediaRootFolder(detectedRoot);
        }
      }
    }
    
    if (isLocalPath(lecFileUrl)) {
      const lastSlash = Math.max(lecFileUrl.lastIndexOf('\\'), lecFileUrl.lastIndexOf('/'));
      if (lastSlash !== -1) {
        const detectedRoot = lecFileUrl.substring(0, lastSlash);
        if (detectedRoot && !mediaRootFolder) {
          setMediaRootFolder(detectedRoot);
        }
      }
    }
  }, [lecVideoUrl, lecFileUrl, lecProvider, mediaRootFolder]);

  const handleSaveBranding = async (e: FormEvent) => {
    e.preventDefault();
    if (!siteName.trim()) {
      triggerError('اسم الموقع حقل إجباري');
      return;
    }

    try {
      const updatedConfig: LMSConfig = {
        siteName: siteName.trim(),
        mainTitle: mainTitle.trim(),
        subTitle: subTitle.trim(),
        logoUrl: logoUrl.trim(),
        logoWidth,
        logoHeight,
        logoPadding,
        fontFamily: fontFamily as any,
        heroMediaUrl,
        heroMediaType: heroMediaType as any,
        heroOpacity,
        heroBlur,
        primaryColor: primaryColor,
        mediaRootFolder: mediaRootFolder.trim(),
        mediaFolders: mediaFolders,
        paymentDetails: {
          walletNumbers: wallets
        }
      };

      await apiService.saveSiteConfig(updatedConfig);
      onUpdateConfig(updatedConfig);
      triggerSuccess('تم حفظ إعدادات الهوية والمحفظة بنجاح!');
    } catch (err: any) {
      console.error(err);
      triggerError('خطأ أثناء تحديث الإعدادات في قاعدة البيانات.');
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const result = await apiService.uploadFile(file, { type: 'branding' as any });
      setLogoUrl(result.url);
      triggerSuccess('تم رفع اللوجو بنجاح');
    } catch (err: any) {
      triggerError('فشل رفع اللوجو: ' + err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const results = await apiService.mediaAudit();
      setAuditResults(results);
    } catch (err) {
      triggerError('فشل تشغيل فحص الوسائط');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSmartRelink = async (id: string) => {
    try {
      const res = await apiService.smartRelink(id);
      if (res.success) {
        triggerSuccess(res.message);
        runAudit(); // Refresh audit
        refreshAllData(); // Refresh lectures
      } else {
        triggerError(res.message);
      }
    } catch (err) {
      triggerError('حدث خطأ أثناء محاولة إعادة الربط');
    }
  };

  const renderMediaAudit = () => (
    <div className="space-y-6">
      <div className="bg-[#161B22] p-6 rounded-2xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-400" />
            فحص سلامة ملفات الفيديو والمرفقات
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            يقوم النظام بالتأكد من وجود جميع ملفات المحاضرات المسجلة على المسار الصحيح في السيرفر المحلي.
            {window.location.hostname.includes('europe-west2.run.app') && (
              <span className="block text-amber-500 font-bold mt-1">
                ⚠️ تنبيه: أنت الآن في بيئة المعاينة السحابية. المسارات المحلية (مثل D:\) ستظهر "مفقودة" لأن السيرفر لا يملك صلاحية الوصول لجهازك الشخصي. ستعمل هذه المسارات بشكل طبيعي عند تشغيل البرنامج على جهازك محلياً.
              </span>
            )}
          </p>
        </div>
        <button 
          onClick={runAudit}
          disabled={isAuditing}
          className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black font-black rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCcw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
          {isAuditing ? 'جاري الفحص...' : 'تشغيل الفحص الآن'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {auditResults.length === 0 && !isAuditing && (
          <div className="col-span-full py-20 text-center text-gray-500 bg-[#161B22]/30 rounded-3xl border border-dashed border-gray-800">
            اضغط على "تشغيل الفحص" للبدء في تتبع حالة الملفات.
          </div>
        )}
        {auditResults.map((result) => (
          <div key={result.id} className="bg-[#161B22] p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-bold text-sm text-gray-100 line-clamp-1">{result.title}</h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                result.status === 'ok' ? 'bg-green-500/10 text-green-500' :
                result.status === 'missing' ? 'bg-red-500/10 text-red-500' :
                result.status === 'locked' ? 'bg-amber-500/10 text-amber-500' :
                'bg-gray-500/10 text-gray-500'
              }`}>
                {result.status === 'ok' ? 'متوفر' : 
                 result.status === 'missing' ? 'مفقود' : 
                 result.status === 'locked' ? 'مغلق/محمي' : 'خارجي'}
              </span>
            </div>
            
            <div className="text-[10px] text-gray-500 mb-2 font-mono break-all bg-black/30 p-2 rounded-lg border border-gray-800/50">
              <div className="text-gray-400 mb-1">المسار المسجل: {result.currentPath || 'لا يوجد'}</div>
              <div className="text-[9px] text-gray-600 italic">المسار المحسوب: {result.resolvedPath}</div>
              {result.autoHealed && (
                <div className="mt-1 text-green-500 font-bold">✓ تم التصحيح تلقائياً إلى: {result.newPath}</div>
              )}
              <div className="flex gap-2 mt-2 pt-2 border-t border-gray-800/50">
                {result.size && (
                  <span className="text-[9px] text-gray-500 bg-black/20 px-1.5 py-0.5 rounded border border-gray-800">
                    {(result.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
                {result.extension && (
                  <span className="text-[9px] text-orange-500/50 bg-orange-500/5 px-1.5 py-0.5 rounded border border-orange-500/10 uppercase font-mono">
                    {result.extension.replace('.', '')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-auto flex gap-2">
              {result.status === 'missing' && !result.autoHealed && (
                <button 
                  onClick={() => handleSmartRelink(result.id)}
                  className="flex-1 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] font-black rounded-lg border border-orange-500/20 flex items-center justify-center gap-1.5 transition-all"
                >
                  <RefreshCcw className="w-3 h-3" />
                  محاولة إعادة الربط الذكي
                </button>
              )}
              {result.status !== 'external' && (
                <button 
                  onClick={() => {
                    setEditingLecId(result.id);
                    const lec = lectures.find(l => l.id === result.id);
                    if (lec) {
                      setLecTitle(lec.title);
                      setLecDesc(lec.description);
                      setLecCatId(lec.categoryId);
                      setLecVideoUrl(lec.videoUrl);
                      setLecProvider(lec.videoProvider as any);
                      setLecFileUrl(lec.fileUrl);
                      setLecFileName(lec.fileName);
                      setLecTier(lec.tierRequired);
                    }
                    setActiveTab('lectures');
                  }}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px] font-black rounded-lg transition-all"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSystemStatus = () => (
    <div className="space-y-6">
      <div className="bg-[#161B22] p-6 rounded-2xl border border-gray-800">
        <h3 className="text-lg font-black flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-orange-400" />
          تقرير حالة النظام (Vite & WebSocket & HMR)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
            <span className="text-[10px] text-gray-500 block mb-1">حالة WebSocket (HMR)</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              <span className="text-sm font-bold text-amber-400">محدود (بيئة معاينة سحابية)</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              تظهر رسائل "failed to connect to websocket" لأن بيئة المعاينة السحابية لا تدعم مسار الـ WebSocket الافتراضي لـ Vite. هذا السلوك متوقع ولا يؤثر على عمل التطبيق.
            </p>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
            <span className="text-[10px] text-gray-500 block mb-1">حالة التحديث التلقائي (HMR)</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-sm font-bold text-red-400">معطل (لضمان الاستقرار)</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              تم تعطيل خاصية HMR برمجياً لتجنب "وميض" الشاشة المتكرر أثناء تعديل الكود بواسطة المهندس الاصطناعي.
            </p>
          </div>
        </div>

        <div className="bg-black/30 p-6 rounded-xl border border-gray-800 space-y-4">
          <h4 className="text-xs font-black text-gray-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            التشخيص التقني والحلول المطبقة
          </h4>
          <ul className="text-[11px] text-gray-400 space-y-3 list-disc pr-5">
            <li>تم إنشاء نظام <strong>معالجة أخطاء صامتة (Silent Handling)</strong> لمنع ظهور رسائل الـ WebSocket في واجهة المستخدم.</li>
            <li>تم تحديث إعدادات <strong>vite.config.ts</strong> لتعطيل HMR كلياً في بيئة المعاينة وتفعيلها محلياً فقط.</li>
            <li>تم تحويل جميع مسارات الفيديو والمرفقات لتكون <strong>مسارات نسبية (Relative Paths)</strong> يتم حلها برمجياً على السيرفر، مما يحل مشكلة اختلاف نظام التشغيل بين Windows و Linux.</li>
            <li>تم تفعيل <strong>Proxy Media Server</strong> لتشغيل الفيديوهات وتنزيل المرفقات بشكل آمن حتى مع وجود قيود على المسارات المحلية.</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="text-[9px] text-gray-600 font-mono">Build Version: 3.5.0-PRO-AUDIT</div>
        </div>
      </div>
    </div>
  );

  const handleCatPreviewUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCatPreviewUploading(true);
    try {
      const result = await apiService.uploadFile(file, { type: 'category_preview' as any });
      setCatPreviewUrl(result.url);
      triggerSuccess('تم رفع الفيديو التعريفي للقسم');
    } catch (err: any) {
      triggerError('فشل رفع الفيديو: ' + err.message);
    } finally {
      setCatPreviewUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs overflow-y-auto p-4 md:p-8 flex justify-center items-start text-right">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl bg-[#0A0C10] rounded-3xl overflow-hidden shadow-2xl border border-gray-800 min-h-[80vh] flex flex-col"
      >
        {/* Top bar header */}
        <div className="bg-[#161B22] text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-orange-400" />
              لوحة التحكم لمدير المنصة (Admin Dashboard)
            </h2>
            <p className="text-xs text-gray-400 mt-1">التحكم الكامل بالمستخدمين، الاشتراكات اليدوية والمحافظ، وإضافة المواد والمحاضرات.</p>
          </div>
          <button 
            onClick={onClose}
            className="self-start md:self-auto px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-750 rounded-xl text-xs font-bold transition-all cursor-pointer"
            id="admin-dashboard-close-btn"
          >
            العودة للمنصة الرئيسية
          </button>
        </div>

        {/* Dashboard Tabs bar */}
        <div className="bg-[#161B22]/50 border-b border-gray-800 px-6 py-2 flex overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'users' ? 'bg-orange-500 text-black shadow-xs' : 'text-gray-400 hover:bg-[#161B22]'
            }`}
            id="admin-tab-users"
          >
            <Users className="w-4 h-4" />
            المستخدمين والاشتراكات
            {users.filter(u => u.subscriptionStatus === 'pending').length > 0 && (
              <span className="bg-amber-500 text-black px-1.5 py-0.5 rounded-full text-[9px] animate-pulse font-bold">
                {users.filter(u => u.subscriptionStatus === 'pending').length} معلق
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'categories' ? 'bg-orange-500 text-black shadow-xs' : 'text-gray-400 hover:bg-[#161B22]'
            }`}
            id="admin-tab-categories"
          >
            <FolderHeart className="w-4 h-4" />
            أقسام الموقع ({categories.length})
          </button>

          <button
            onClick={() => setActiveTab('lectures')}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'lectures' ? 'bg-orange-500 text-black shadow-xs' : 'text-gray-400 hover:bg-[#161B22]'
            }`}
            id="admin-tab-lectures"
          >
            <Video className="w-4 h-4" />
            إدارة المحاضرات ({lectures.length})
          </button>

          <button
            onClick={() => setActiveTab('branding')}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'branding' ? 'bg-orange-500 text-black shadow-xs' : 'text-gray-400 hover:bg-[#161B22]'
            }`}
            id="admin-tab-branding"
          >
            <Palette className="w-4 h-4" />
            الهوية واللوجو والمحافظ
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'licenses' ? 'bg-orange-500 text-black shadow-xs' : 'text-gray-400 hover:bg-[#161B22]'
            }`}
            id="admin-tab-licenses"
          >
            <ShieldAlert className="w-4 h-4" />
            إدارة التراخيص والحصص
          </button>
          <button
            onClick={() => setActiveTab('media_audit')}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'media_audit' ? 'bg-orange-500 text-black shadow-xs' : 'text-gray-400 hover:bg-[#161B22]'
            }`}
            id="admin-tab-media-audit"
          >
            <ShieldAlert className="w-4 h-4" />
            فحص سلامة الوسائط
            {auditResults.filter(r => r.status === 'missing').length > 0 && (
              <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                {auditResults.filter(r => r.status === 'missing').length} مفقود
              </span>
            )}
            {auditResults.filter(r => r.autoHealed).length > 0 && (
              <span className="bg-green-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                {auditResults.filter(r => r.autoHealed).length} تم إصلاحه
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('local_files')}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'local_files' ? 'bg-orange-500 text-black shadow-xs' : 'text-gray-400 hover:bg-[#161B22]'
            }`}
            id="admin-tab-local-files"
          >
            <HardDrive className="w-4 h-4" />
            الملفات المحلية على الهارد ديسك
          </button>
          <button
            onClick={() => setActiveTab('system_status')}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'system_status' ? 'bg-orange-500 text-black shadow-xs' : 'text-gray-400 hover:bg-[#161B22]'
            }`}
            id="admin-tab-system-status"
          >
            <Activity className="w-4 h-4" />
            حالة السيرفر والاتصال
          </button>
        </div>

        {/* Global Notifications inside Panel */}
        <div className="px-6 mt-4">
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
              {success}
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}
        </div>

        {/* Dynamic Tab Body content */}
        <div className="p-6 flex-1 text-gray-200">
          {/* TAB: USERS & SUBSCRIPTIONS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white">لائحة الطلاب وإدارة تراخيص الدخول</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                هنا يمكنك تفحص بيانات تحويلات الطلاب وتفعيل الحسابات يدوياً للبرونزية أو الذهبية فور استلام التحويل في محفظتك.
              </p>

              <div className="overflow-x-auto border border-gray-800 rounded-2xl bg-[#161B22] shadow-xs">
                <table className="w-full border-collapse text-right text-xs">
                  <thead className="bg-[#0F1218] text-gray-300 border-b border-gray-800 font-bold">
                    <tr>
                      <th className="p-3 text-right">الاسم / البريد الإلكتروني</th>
                      <th className="p-3 text-right">الباقة النشطة</th>
                      <th className="p-3 text-right">الحالة</th>
                      <th className="p-3 text-right">المحاضرة المطلوبة / تفاصيل الدفع</th>
                      <th className="p-3 text-center">أفعال تفعيل وتعديل الاشتراك الإداري</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850 text-gray-300">
                    {users.map((u) => {
                      const isPending = u.subscriptionStatus === 'pending';
                      return (
                        <tr key={u.uid} className={isPending ? 'bg-amber-500/5' : ''}>
                          <td className="p-3">
                            <div className="font-bold text-white">{u.username}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{u.email}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold border ${
                              u.subscription === 'gold' 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                : u.subscription === 'bronze'
                                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                  : 'bg-gray-800 text-gray-400 border-gray-700'
                            }`}>
                              {u.subscription === 'gold' ? 'ذهبية' : u.subscription === 'bronze' ? 'برونزية' : 'لا يوجد'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full font-medium border ${
                              u.subscriptionStatus === 'active' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : u.subscriptionStatus === 'pending'
                                  ? 'bg-amber-500/10 text-amber-400 animate-pulse border-amber-500/20'
                                  : u.subscriptionStatus === 'blocked'
                                    ? 'bg-red-500/10 text-red-400 font-bold border-red-500/20'
                                    : 'bg-gray-800 text-gray-500 border-gray-750'
                            }`}>
                              {u.subscriptionStatus === 'active' ? 'نشط' : u.subscriptionStatus === 'pending' ? 'بانتظار التأكيد' : u.subscriptionStatus === 'blocked' ? 'محظور' : 'غير مشترك'}
                            </span>
                            {u.subscriptionStatus === 'active' && u.subscriptionExpiresAt && (
                              <div className="text-[10px] text-gray-400 mt-1 block leading-tight font-sans">
                                ينتهي: {new Date(u.subscriptionExpiresAt).toLocaleDateString('ar-EG')}
                                <br />
                                ({Math.max(0, Math.ceil((new Date(u.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} يوم متبقي)
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {isPending && u.paymentTxInfo ? (
                              <div className="bg-[#0F1218] border border-gray-800 rounded-xl p-2.5 text-[11px] max-w-xs space-y-1">
                                <div className="text-amber-400 font-bold">باقة معلقة: {u.pendingSubscriptionType === 'gold' ? 'ذهبية' : 'برونزية'}</div>
                                <div>رقم العملية: <strong className="font-mono text-white">{u.paymentTxInfo.txNumber}</strong></div>
                                <div>المحفظة: <strong className="text-white">{u.paymentTxInfo.walletProvider}</strong></div>
                                <div>المبلغ: <strong className="font-mono text-white">{u.paymentTxInfo.amount} ج.م</strong></div>
                                {u.paymentTxInfo.screenshotUrl && (
                                  <a 
                                    href={u.paymentTxInfo.screenshotUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-orange-400 hover:underline font-bold flex items-center gap-1 mt-1 text-[10px]"
                                  >
                                    معاينة الإيصال المرفق <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500 text-[10px]">لا توجد تحويلات معلقة</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex flex-wrap gap-1.5 justify-center">
                              {/* Quick Approvals */}
                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleUserSubscription(u.uid, u.pendingSubscriptionType, 'active')}
                                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg font-black flex items-center gap-1 cursor-pointer transition-colors text-xs"
                                    id={`approve-pending-${u.uid}`}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    تأكيد الدفع والسماح للمستخدم (Approve & Activate)
                                  </button>
                                  <button
                                    onClick={() => handleUserSubscription(u.uid, 'none', 'none')}
                                    className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors text-xs"
                                    id={`reject-pending-${u.uid}`}
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    رفض الإيصال
                                  </button>
                                </>
                              )}

                              {/* Manual modifications */}
                              {!isPending && (
                                <>
                                  <button
                                    onClick={() => handleUserSubscription(u.uid, 'bronze', 'active')}
                                    className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg font-medium cursor-pointer"
                                    id={`manual-bronze-${u.uid}`}
                                  >
                                    تعيين برونزي
                                  </button>
                                  <button
                                    onClick={() => handleUserSubscription(u.uid, 'gold', 'active')}
                                    className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg font-medium cursor-pointer"
                                    id={`manual-gold-${u.uid}`}
                                  >
                                    تعيين ذهبي
                                  </button>
                                  <button
                                    onClick={() => handleUserSubscription(u.uid, 'none', 'none')}
                                    className="px-2 py-1 bg-gray-800 hover:bg-gray-750 text-gray-300 border border-gray-700 rounded-lg font-medium cursor-pointer"
                                    id={`manual-none-${u.uid}`}
                                  >
                                    إلغاء الاشتراك
                                  </button>
                                </>
                              )}

                              {/* Ban/Unban */}
                              {u.subscriptionStatus !== 'blocked' ? (
                                <button
                                  onClick={() => handleUserBan(u.uid, true)}
                                  className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-medium flex items-center gap-1 cursor-pointer"
                                  id={`ban-${u.uid}`}
                                >
                                  <Ban className="w-3 h-3" /> حظر
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUserBan(u.uid, false)}
                                  className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg font-medium flex items-center gap-1 cursor-pointer"
                                  id={`unban-${u.uid}`}
                                >
                                  <RefreshCcw className="w-3 h-3 animate-spin" /> إلغاء الحظر
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: LICENSES & QUOTAS */}
          {activeTab === 'licenses' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white">إدارة تراخيص الطلاب وحصص التحميل</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                هنا يمكنك تحديد الحد الأقصى للتحميلات لكل طالب (خاصة المشتركين في الباقة البرونزية)، وتصفير العدادات يدوياً عند الضرورة.
              </p>

              <div className="overflow-x-auto border border-gray-800 rounded-2xl bg-[#161B22] shadow-xs">
                <table className="w-full border-collapse text-right text-xs">
                  <thead className="bg-[#0F1218] text-gray-300 border-b border-gray-800 font-bold">
                    <tr>
                      <th className="p-3 text-right">الطالب</th>
                      <th className="p-3 text-right">الاشتراك</th>
                      <th className="p-3 text-right">الاستهلاك / الحد الأقصى</th>
                      <th className="p-3 text-right">تعديل الحد الأقصى</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850 text-gray-300">
                    {users.map((u) => (
                      <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-white">{u.username}</div>
                          <div className="text-[10px] text-gray-500">{u.email}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold border ${
                            u.subscription === 'gold' 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                              : u.subscription === 'bronze'
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : 'bg-gray-800 text-gray-400 border-gray-700'
                          }`}>
                            {u.subscription === 'gold' ? 'ذهبية' : u.subscription === 'bronze' ? 'برونزية' : 'مجاني'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-orange-400">{u.downloadCounter || 0}</span>
                            <span className="text-gray-600">/</span>
                            <span className="font-mono text-gray-400">{u.maxDownloads === -1 ? '∞' : (u.maxDownloads || 10)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              defaultValue={u.maxDownloads === -1 ? 999 : (u.maxDownloads || 10)}
                              onBlur={(e) => handleUpdateUserQuota(u.uid, parseInt(e.target.value))}
                              className="w-16 py-1 px-2 bg-black border border-gray-800 rounded-lg text-center text-[11px] text-white focus:border-orange-500"
                            />
                            <span className="text-[10px] text-gray-500">ملف</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleResetCounter(u.uid)}
                              className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-black transition-all flex items-center gap-1 text-[10px]"
                              title="تصفير عداد التحميلات"
                            >
                              <RefreshCcw className="w-3 h-3" />
                              تصفير العداد
                            </button>
                            <button
                              onClick={() => handleUserSubscription(u.uid, u.subscription === 'gold' ? 'bronze' : 'gold', 'active')}
                              className={`p-1.5 rounded-lg transition-all text-[10px] ${
                                u.subscription === 'gold' 
                                  ? 'bg-gray-800 text-gray-400' 
                                  : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black'
                              }`}
                            >
                              {u.subscription === 'gold' ? 'تنزيل لبرونزي' : 'ترقية لذهبي'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Category creation / edit form */}
              <div className="md:col-span-1 bg-[#161B22] rounded-2xl p-5 border border-gray-800 h-fit">
                <h4 className="font-bold text-white mb-4">{editingCatId ? 'تعديل قسم قائم' : 'إضافة قسم تعليمي جديد'}</h4>
                <form onSubmit={handleSaveCategory} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">اسم القسم (القسم الرئيسي)</label>
                    <input
                      type="text"
                      required
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                      placeholder="مثال: الإلكترونيات الرقمية"
                      id="cat-name-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">وصف القسم</label>
                    <textarea
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      rows={3}
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                      placeholder="وصف مختصر للمستلزمات والشروحات المطروحة داخل القسم."
                      id="cat-desc-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">صورة القسم التعبيرية (رابط أو رفع ملف)</label>
                    <div className="space-y-2 text-right">
                      <input
                        type="text"
                        value={catImageUrl}
                        onChange={(e) => setCatImageUrl(e.target.value)}
                        className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                        placeholder="https://example.com/image.jpg"
                        id="cat-image-url-input"
                      />
                      
                      <div className="flex items-center gap-2">
                        <label className="flex-1 py-1.5 px-3 bg-gray-800 hover:bg-gray-750 text-white rounded-xl text-[10px] font-bold text-center cursor-pointer transition-colors border border-gray-750">
                          {catImageUploading ? 'جاري رفع الصورة...' : 'رفع صورة تعبيرية من الجهاز 📁'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setCatImageUploading(true);
                              try {
                                const result = await apiService.uploadFile(file, { type: 'thumbnail' });
                                setCatImageUrl(result.url);
                                triggerSuccess('تم رفع صورة القسم بنجاح!');
                              } catch (err: any) {
                                triggerError('فشل رفع الصورة: ' + (err.message || ''));
                              } finally {
                                setCatImageUploading(false);
                              }
                            }}
                            className="hidden"
                            disabled={catImageUploading}
                          />
                        </label>
                        {catImageUrl && (
                          <button
                            type="button"
                            onClick={() => setCatImageUrl('')}
                            className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] border border-red-500/20"
                          >
                            حذف الصورة
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">شعار متحرك للقسم (MP4/GIF)</label>
                    <div className="space-y-2 text-right">
                      <input
                        type="text"
                        value={catPreviewUrl}
                        onChange={(e) => setCatPreviewUrl(e.target.value)}
                        className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-left font-mono text-white"
                        placeholder="رابط مباشر للفيديو أو GIF"
                      />
                      <label className="block w-full py-1.5 px-3 bg-gray-800 hover:bg-gray-750 text-white rounded-xl text-[10px] font-bold text-center cursor-pointer transition-colors border border-gray-750">
                        {catPreviewUploading ? 'جاري رفع الفيديو...' : 'رفع فيديو تعبيري مخصص (MP4/GIF) 🎥'}
                        <input type="file" accept="video/mp4,image/gif" onChange={handleCatPreviewUpload} className="hidden" disabled={catPreviewUploading} />
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black transition-all cursor-pointer"
                      id="cat-save-btn"
                    >
                      {editingCatId ? 'حفظ التعديلات' : 'إضافة القسم'}
                    </button>
                    {editingCatId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(null);
                          setCatName('');
                          setCatDesc('');
                          setCatImageUrl('');
                          setCatPreviewUrl('');
                        }}
                        className="py-2 px-3 bg-gray-800 hover:bg-gray-750 text-gray-250 border border-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                        id="cat-cancel-btn"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Categories list */}
              <div className="md:col-span-2 space-y-4">
                <h4 className="font-bold text-white">الأقسام الحالية ({categories.length})</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categories.map((cat) => (
                    <div key={cat.id} className="p-4 bg-[#161B22] border border-gray-800 rounded-2xl flex items-start justify-between shadow-xs">
                      <div>
                        <h5 className="font-bold text-white text-sm">{cat.name}</h5>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{cat.description || 'لا يوجد وصف'}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingCatId(cat.id);
                            setCatName(cat.name);
                            setCatDesc(cat.description);
                            setCatImageUrl(cat.imageUrl || '');
                            setCatPreviewUrl(cat.previewUrl || '');
                          }}
                          className="p-1.5 bg-[#0F1218] hover:bg-gray-800 text-gray-300 rounded-lg border border-gray-800 cursor-pointer"
                          title="تعديل"
                          id={`cat-edit-${cat.id}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 cursor-pointer"
                          title="حذف"
                          id={`cat-delete-${cat.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: LECTURES */}
          {activeTab === 'lectures' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Lecture Creator form */}
              <div className="md:col-span-1 bg-[#161B22] rounded-2xl p-5 border border-gray-800 h-fit max-h-[85vh] overflow-y-auto">
                <h4 className="font-bold text-white mb-4">{editingLecId ? 'تعديل محاضرة' : 'إضافة محاضرة جديدة'}</h4>
                <form onSubmit={handleSaveLecture} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">القسم التعليمي التابع له</label>
                    <select
                      value={lecCatId}
                      onChange={(e) => setLecCatId(e.target.value)}
                      required
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                      id="lec-cat-select"
                    >
                      <option value="">-- اختر القسم --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">عنوان الدرس / المحاضرة</label>
                    <input
                      type="text"
                      required
                      value={lecTitle}
                      onChange={(e) => setLecTitle(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                      placeholder="مثال: فك وتركيب شمعات الاحتراق (Spark plugs)"
                      id="lec-title-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">تفاصيل ومحتوى المحاضرة</label>
                    <textarea
                      value={lecDesc}
                      onChange={(e) => setLecDesc(e.target.value)}
                      rows={3}
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                      placeholder="نبذة تفصيلية عما سيتعلمه الطالب في هذا الفيديو."
                      id="lec-desc-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">رتبة الاشتراك المطلوبة</label>
                      <select
                        value={lecTier}
                        onChange={(e) => setLecTier(e.target.value as any)}
                        className="w-full py-2 px-3 text-[11px] bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white font-bold"
                        id="lec-tier-select"
                      >
                        <option value="free">مجاني للجميع</option>
                        <option value="bronze">الباقة البرونزية (49 ج.م)</option>
                        <option value="gold">الباقة الذهبية (99 ج.م)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">اسم المرفق للتنزيل</label>
                      <input
                        type="text"
                        value={lecFileName}
                        onChange={(e) => setLecFileName(e.target.value)}
                        className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                        placeholder="e.g. كتيب التركيب"
                        id="lec-file-name-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Media Uploads Section */}
                    <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl space-y-4">
                      {/* Local Video Path Input (Requirement 1, 2, 3) */}
                      <div>
                        <label className="block text-xs font-bold text-gray-300 mb-1">
                          مسار ملف الفيديو الكامل على جهازك 🎥 (مطلوب)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={lecVideoUrl}
                            onChange={(e) => {
                              setLecVideoUrl(e.target.value);
                              setLecProvider('local' as any);
                            }}
                            className={`w-full py-2 pl-20 pr-3 text-xs bg-[#0F1218] border rounded-xl focus:outline-hidden font-mono text-white ${
                              pathStatus.video === 'valid' ? 'border-green-500/50' : 
                              pathStatus.video === 'invalid' ? 'border-red-500/50' : 'border-gray-800 focus:border-orange-500'
                            }`}
                            placeholder="مثال: D:\Lectures\lecture1.mp4"
                            id="lec-video-url-input"
                          />
                          <button
                            type="button"
                            onClick={() => verifyLocalPath(lecVideoUrl, 'video')}
                            disabled={verifyingPath.video || !lecVideoUrl}
                            className="absolute left-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold rounded-lg border border-gray-800 transition-colors disabled:opacity-50"
                          >
                            {verifyingPath.video ? 'جاري التحقق...' : 'تحقق من المسار'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                          اكتب المسار الكامل للملف على الهارد ديسك الخاص بك مباشرة. لن يتم نسخ الملف أو رفعه لتوفير مساحة السيرفر.
                        </p>
                        
                        {/* Advanced File Selection (Integrated with Local Server) */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowFileBrowser({ active: true, target: 'video' })}
                            className="flex items-center gap-1.5 py-1.5 px-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-[10px] font-bold transition-colors border border-orange-500/20"
                          >
                            <Search className="w-3 h-3" />
                            تصفح جميع البارتشنات (Local Server)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleNativePick('video')}
                            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all border bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20"
                          >
                            <FolderOpen className="w-3 h-3" />
                            تحديد مسار الفيديو من جهازي
                          </button>
                        </div>
                      </div>

                      {/* Local File/Attachment Path Input */}
                      <div className="pt-3 border-t border-orange-500/10">
                        <label className="block text-xs font-bold text-gray-300 mb-1">
                          مسار ملف المرفقات الكامل على جهازك 📄 (اختياري)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={lecFileUrl}
                            onChange={(e) => {
                              setLecFileUrl(e.target.value);
                              const parts = e.target.value.split(/[/\\]/);
                              setLecFileName(parts[parts.length - 1] || '');
                            }}
                            className={`w-full py-2 pl-20 pr-3 text-xs bg-[#0F1218] border rounded-xl focus:outline-hidden font-mono text-white ${
                              pathStatus.attachment === 'valid' ? 'border-green-500/50' : 
                              pathStatus.attachment === 'invalid' ? 'border-red-500/50' : 'border-gray-800 focus:border-orange-500'
                            }`}
                            placeholder="مثال: C:\LMS-Media\spark-plugs-guide.pdf"
                            id="lec-file-url-input"
                          />
                          <button
                            type="button"
                            onClick={() => verifyLocalPath(lecFileUrl, 'attachment')}
                            disabled={verifyingPath.attachment || !lecFileUrl}
                            className="absolute left-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold rounded-lg border border-gray-800 transition-colors disabled:opacity-50"
                          >
                            {verifyingPath.attachment ? 'جاري التحقق...' : 'تحقق من المسار'}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                          اكتب مسار كتاب الشرح أو ملف PDF المرفق لتنزيله مباشرة من جهازك.
                        </p>

                        {/* Advanced File Selection (Integrated with Local Server) */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowFileBrowser({ active: true, target: 'attachment' })}
                            className="flex items-center gap-1.5 py-1.5 px-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-[10px] font-bold transition-colors border border-orange-500/20"
                          >
                            <Search className="w-3 h-3" />
                            تصفح واختيار مرفق (Local Server)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleNativePick('attachment')}
                            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all border bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20"
                          >
                            <FolderOpen className="w-3 h-3" />
                            تحديد مسار المرفق من جهازي
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black transition-all cursor-pointer"
                      id="lec-save-btn"
                    >
                      {editingLecId ? 'حفظ التعديلات' : 'إضافة الدرس'}
                    </button>
                    {editingLecId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLecId(null);
                          setLecTitle('');
                          setLecDesc('');
                          setLecCatId('');
                          setLecVideoUrl('');
                          setLecProvider('youtube');
                          setLecFileUrl('');
                          setLecFileName('');
                          setLecTier('free');
                        }}
                        className="py-2 px-3 bg-gray-800 hover:bg-gray-750 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                        id="lec-cancel-btn"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Lectures List view */}
              <div className="md:col-span-2 space-y-4">
                <h4 className="font-bold text-white">المحاضرات المتاحة ({lectures.length})</h4>
                <div className="space-y-3">
                  {lectures.map((lec) => {
                    const parentCat = categories.find(c => c.id === lec.categoryId);
                    return (
                      <div key={lec.id} className="p-4 bg-[#161B22] border border-gray-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-orange-500/10 text-orange-400 rounded-xl mt-0.5 sm:mt-0 border border-orange-500/20">
                            <Video className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md border border-gray-750">
                                {parentCat ? parentCat.name : 'بدون قسم'}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                lec.tierRequired === 'free' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : lec.tierRequired === 'bronze'
                                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {lec.tierRequired === 'free' ? 'مجاني' : lec.tierRequired === 'bronze' ? 'برونزي' : 'ذهبي'}
                              </span>
                            </div>
                            <h5 className="font-bold text-white text-sm mt-1">{lec.title}</h5>
                            <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{lec.description}</p>
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                              {lec.videoSize && (
                                <span className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 flex items-center gap-1">
                                  <Maximize className="w-2.5 h-2.5" />
                                  {(lec.videoSize / (1024 * 1024)).toFixed(1)} MB
                                </span>
                              )}
                              {lec.videoExtension && (
                                <span className="text-[9px] text-orange-500/70 bg-orange-500/5 px-1.5 py-0.5 rounded border border-orange-500/10 uppercase font-mono">
                                  {lec.videoExtension.replace('.', '')}
                                </span>
                              )}
                              {lec.videoProvider === 'local' && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                  lec.fileStatus === 'missing' 
                                    ? 'text-red-400 bg-red-400/5 border-red-400/20' 
                                    : 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20'
                                }`}>
                                  {lec.fileStatus === 'missing' ? <XCircle className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
                                  {lec.fileStatus === 'missing' ? 'مفقود' : 'متصل محلياً'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-1.5 shrink-0 self-end sm:self-auto items-center">
                          {lec.videoProvider === 'local' && lec.fileStatus === 'missing' && (
                             <button
                               onClick={async () => {
                                 try {
                                   const res = await apiService.smartRelink(lec.id);
                                   if (res.success) {
                                     triggerSuccess('تم العثور على الملف وإعادة الربط بنجاح!');
                                     refreshAllData();
                                   } else {
                                     triggerError('تعذر العثور على الملف في المسارات المعرفة.');
                                   }
                                 } catch (e) {
                                   triggerError('خطأ أثناء البحث الذكي.');
                                 }
                               }}
                               className="flex items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all border bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20 cursor-pointer"
                               title="بحث ذكي عن الملف المفقود"
                             >
                               <Search className="w-3 h-3" />
                               إعادة ربط
                             </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingLecId(lec.id);
                              setLecTitle(lec.title);
                              setLecDesc(lec.description);
                              setLecCatId(lec.categoryId);
                              setLecVideoUrl(lec.videoUrl);
                              setLecProvider(lec.videoProvider);
                              setLecFileUrl(lec.fileUrl);
                              setLecFileName(lec.fileName);
                              setLecTier(lec.tierRequired);
                            }}
                            className="p-1.5 bg-[#0F1218] hover:bg-gray-800 text-gray-300 border border-gray-800 rounded-lg cursor-pointer"
                            id={`lec-edit-${lec.id}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLecture(lec.id)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg cursor-pointer"
                            id={`lec-delete-${lec.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: BRANDING & WALLETS */}
          {activeTab === 'branding' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Branding and styling customization */}
              <form onSubmit={handleSaveBranding} className="space-y-6 bg-[#161B22] rounded-2xl p-6 border border-gray-800">
                <h4 className="font-bold text-white flex items-center gap-2 mb-2">
                  <Palette className="w-5 h-5 text-orange-400" />
                  تخصيص الهوية البصرية المتقدمة
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">اسم الموقع</label>
                    <input
                      type="text"
                      required
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      className="w-full py-2.5 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">نوع الخط الرئيسي</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full py-2.5 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                    >
                      <option value="Cairo">Cairo (عربي ممتاز)</option>
                      <option value="Tajawal">Tajawal (عربي عصري)</option>
                      <option value="Inter">Inter (كلاسيكي)</option>
                      <option value="Roboto">Roboto (تقني)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">العنوان الرئيسي</label>
                  <input
                    type="text"
                    value={mainTitle}
                    onChange={(e) => setMainTitle(e.target.value)}
                    className="w-full py-2.5 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                  />
                </div>

                {/* Logo Section */}
                <div className="p-4 bg-[#0F1218] rounded-2xl border border-gray-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-orange-400">إدارة شعار المنصة (Logo)</span>
                    <label className="text-[10px] bg-orange-500 hover:bg-orange-600 text-black px-3 py-1 rounded-lg font-bold cursor-pointer transition-colors flex items-center gap-1">
                      {logoUploading ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                      {logoUploading ? 'جاري الرفع...' : 'رفع لوجو جديد'}
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={logoUploading} />
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-[#161B22] p-4 rounded-xl border border-gray-800 justify-center min-h-[100px]">
                    {logoUrl ? (
                      <img 
                        src={logoUrl} 
                        alt="Preview" 
                        style={{ width: `${logoWidth}px`, height: `${logoHeight}px`, padding: `${logoPadding}px` }}
                        className="object-contain" 
                      />
                    ) : (
                      <span className="text-xs text-gray-500 italic">لا يوجد لوجو مرفع حالياً</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 text-center">العرض (Pixel)</label>
                      <input 
                        type="range" min="40" max="400" value={logoWidth} 
                        onChange={(e) => setLogoWidth(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="text-[9px] text-gray-500 text-center mt-1">{logoWidth}px</div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 text-center">الارتفاع (Pixel)</label>
                      <input 
                        type="range" min="20" max="200" value={logoHeight} 
                        onChange={(e) => setLogoHeight(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="text-[9px] text-gray-500 text-center mt-1">{logoHeight}px</div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 text-center">الهوامش (Padding)</label>
                      <input 
                        type="range" min="0" max="40" value={logoPadding} 
                        onChange={(e) => setLogoPadding(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="text-[9px] text-gray-500 text-center mt-1">{logoPadding}px</div>
                    </div>
                  </div>
                </div>

                {/* Hero Background Customization */}
                <div className="p-4 bg-[#0F1218] rounded-2xl border border-gray-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-orange-400 flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5" />
                      خلفية الواجهة الرئيسية (Hero Media)
                    </span>
                    <label className="text-[10px] bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded-lg font-bold cursor-pointer transition-colors flex items-center gap-1">
                      {heroUploading ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                      {heroUploading ? 'جاري الرفع...' : 'رفع ميديا للخلفية'}
                      <input type="file" className="hidden" accept="image/*,video/mp4" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setHeroUploading(true);
                        try {
                          const result = await apiService.uploadFile(file, { type: 'branding' as any });
                          setHeroMediaUrl(result.url);
                          setHeroMediaType(file.type.startsWith('video') ? 'video' : 'image');
                          triggerSuccess('تم رفع ميديا الخلفية بنجاح');
                        } catch (err: any) {
                          triggerError('فشل رفع الميديا: ' + err.message);
                        } finally {
                          setHeroUploading(false);
                        }
                      }} disabled={heroUploading} />
                    </label>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 text-center flex items-center justify-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        شفافية الطبقة ({heroOpacity}%)
                      </label>
                      <input 
                        type="range" min="0" max="100" value={heroOpacity} 
                        onChange={(e) => setHeroOpacity(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-gray-400 mb-1 text-center flex items-center justify-center gap-1">
                        <Maximize className="w-3 h-3" />
                        درجة التغبيش ({heroBlur}px)
                      </label>
                      <input 
                        type="range" min="0" max="20" value={heroBlur} 
                        onChange={(e) => setHeroBlur(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                  </div>
                  
                  {heroMediaUrl && (
                    <div className="text-[9px] text-gray-500 truncate bg-gray-900/50 p-1 rounded font-mono text-left" dir="ltr">
                      {heroMediaUrl}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                   <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-300 mb-1">اللون الرئيسي</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-9 p-0.5 rounded-lg border border-gray-800 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden font-mono text-left text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 space-y-4">
                  <h5 className="text-[11px] font-bold text-orange-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    خادم الوسائط المحلي (مجلدات الأرشفة والبحث)
                  </h5>
                  
                  <div className="space-y-3">
                    <form onSubmit={handleAddMediaFolder} className="flex gap-2">
                      <input 
                        type="text"
                        value={newMediaFolder}
                        onChange={(e) => setNewMediaFolder(e.target.value)}
                        placeholder="أضف مسار مجلد جديد (مثال: D:\Videos)"
                        className="flex-1 py-2 px-3 text-[11px] bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden text-left font-mono text-white"
                        dir="ltr"
                      />
                      <button 
                        type="submit"
                        className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <FolderPlus className="w-3 h-3" />
                        إضافة مسار
                      </button>
                    </form>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                      {mediaFolders.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-gray-800 rounded-xl text-gray-500 text-[10px]">
                          لا توجد مجلدات مسجلة حالياً. سيتم استخدام مجلد المشروع الافتراضي.
                        </div>
                      ) : (
                        mediaFolders.map((folder, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-[#0F1218] border border-gray-800 rounded-xl group hover:border-orange-500/50 transition-all">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <HardDrive className="w-3.5 h-3.5 text-gray-500" />
                              <span className="text-[11px] font-mono text-orange-400 truncate select-all" dir="ltr">{folder}</span>
                            </div>
                            <button 
                              type="button"
                              onClick={() => handleRemoveMediaFolder(folder)}
                              className="text-gray-500 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2 p-3 bg-gray-900/50 rounded-xl border border-gray-800/50">
                      <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-gray-500 leading-relaxed">
                        أضف المجلدات التي تحتوي على فيديوهاتك ومرفقاتك. سيقوم النظام بـ **البحث الذكي** داخل هذه المسارات إذا تم نقل الملفات من أماكنها الأصلية.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  حفظ كافة إعدادات الهوية البصرية
                </button>
              </form>

              {/* Wallets setup for payment */}
              <div className="space-y-6">
                <div className="bg-[#161B22] rounded-2xl p-6 border border-gray-800 h-full">
                  <h4 className="font-bold text-white flex items-center gap-2 mb-3">
                    <CreditCard className="w-5 h-5 text-orange-400" />
                    إدارة قنوات الدفع (Vodafone / InstaPay)
                  </h4>

                  <form onSubmit={handleAddWallet} className="space-y-3 bg-[#0F1218] p-4 rounded-xl border border-gray-800 text-white">
                    <p className="text-[11px] text-gray-400 font-medium">أضف أرقام تجميع الاشتراكات التي ستظهر للطلاب عند التسجيل:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={newWalletProvider}
                        onChange={(e) => setNewWalletProvider(e.target.value)}
                        placeholder="مزود الخدمة (فودافون كاش، إنستا باي)"
                        className="py-2 px-3 text-xs bg-[#161B22] border border-gray-800 rounded-lg text-right focus:outline-hidden text-white"
                        id="wallet-provider-input"
                      />
                      <input
                        type="text"
                        required
                        value={newWalletName}
                        onChange={(e) => setNewWalletName(e.target.value)}
                        placeholder="الاسم المسجل للمحفظة"
                        className="py-2 px-3 text-xs bg-[#161B22] border border-gray-800 rounded-lg text-right focus:outline-hidden text-white"
                        id="wallet-name-input"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newWalletNumber}
                        onChange={(e) => setNewWalletNumber(e.target.value)}
                        placeholder="رقم المحفظة / عنوان InstaPay"
                        className="flex-1 py-2 px-3 text-xs bg-[#161B22] border border-gray-800 rounded-lg text-left font-mono focus:outline-hidden text-white"
                        id="wallet-number-input"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shrink-0"
                        id="wallet-add-btn"
                      >
                        <Plus className="w-4 h-4" /> إضافة الرقم
                      </button>
                    </div>
                  </form>

                  {/* Wallets list */}
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-gray-300">الأرقام الحالية في لوحة الدفع اليدوية:</p>
                    {wallets.length === 0 ? (
                      <p className="text-xs text-gray-500">لا يوجد أرقام دفع حالية، يرجى إضافة رقم واحد على الأقل ليتمكن الطلاب من التحويل.</p>
                    ) : (
                      wallets.map((w, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[#0F1218] p-3 border border-gray-800 rounded-xl shadow-xs">
                          <div className="text-xs text-gray-300">
                            <span className="font-bold text-white">{w.provider}</span>: <span className="font-mono text-orange-400 font-bold">{w.number}</span> <span className="text-[10px] text-gray-500">({w.name})</span>
                          </div>
                          <button
                            onClick={() => handleRemoveWallet(idx)}
                            className="p-1 text-red-400 hover:bg-red-500/10 rounded-md cursor-pointer transition-colors"
                            id={`wallet-remove-${idx}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'media_audit' && renderMediaAudit()}
          {activeTab === 'system_status' && renderSystemStatus()}

          {activeTab === 'local_files' && (
            <LocalFilesManager 
              lectures={lectures} 
              config={config}
              onRefresh={refreshAllData} 
              triggerSuccess={triggerSuccess} 
              triggerError={triggerError} 
            />
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showFileBrowser.active && (
          <LocalFileBrowser
            title={showFileBrowser.target === 'video' ? 'اختيار ملف فيديو للمحاضرة' : 'اختيار ملف مرفق للمحاضرة'}
            onSelect={handleFileSelect}
            onClose={() => setShowFileBrowser({ active: false, target: 'video' })}
            allowedExtensions={showFileBrowser.target === 'video' ? ['mp4', 'mkv', 'avi', 'mov', 'webm'] : ['pdf', 'zip', 'rar', 'doc', 'docx', 'jpg', 'png']}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
