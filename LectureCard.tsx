import { MouseEvent, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lecture, UserProfile } from '../types';
import { Lock, Play, Download, Eye, Sparkles, AlertCircle, Loader2, X, Heart, RefreshCcw } from 'lucide-react';
import { apiService } from '../apiService';

interface LectureCardProps {
  key?: string | number;
  lecture: Lecture;
  user: UserProfile | null;
  isActive: boolean;
  onSelect: () => void;
  onOpenSubscribe: () => void;
  onOpenAuth: () => void;
  categoryName: string;
  onRefreshUser?: () => void;
}

// Extract YouTube ID from video url to get dynamic high-quality thumbnail
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function LectureCard({
  lecture,
  user,
  isActive,
  onSelect,
  onOpenSubscribe,
  onOpenAuth,
  categoryName,
  onRefreshUser
}: LectureCardProps) {
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [relinkingPath, setRelinkingPath] = useState(lecture.fileUrl || '');
  const [relinkingLoading, setRelinkingLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const unsub = apiService.onAuthStateChanged((u) => {
      setIsAdmin(u?.role === 'admin');
    });
    return unsub;
  }, []);

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem('fav_lectures') || '[]');
    setIsFavorite(favs.includes(lecture.id));

    const handleFavUpdate = () => {
      const f = JSON.parse(localStorage.getItem('fav_lectures') || '[]');
      setIsFavorite(f.includes(lecture.id));
    };

    window.addEventListener('favorites_updated', handleFavUpdate);
    return () => {
      window.removeEventListener('favorites_updated', handleFavUpdate);
    };
  }, [lecture.id]);

  const toggleFavorite = (e: MouseEvent) => {
    e.stopPropagation();
    const favs = JSON.parse(localStorage.getItem('fav_lectures') || '[]');
    let updated = [];
    if (favs.includes(lecture.id)) {
      updated = favs.filter((id: string) => id !== lecture.id);
      setIsFavorite(false);
    } else {
      updated = [...favs, lecture.id];
      setIsFavorite(true);
    }
    localStorage.setItem('fav_lectures', JSON.stringify(updated));
    window.dispatchEvent(new Event('favorites_updated'));
  };

  const handleSmartRelink = async (e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setRelinkingLoading(true);
    try {
      const res = await apiService.smartRelink(lecture.id);
      if (res.success) {
        setQuotaError(null);
        if (onRefreshUser) onRefreshUser();
        // Custom event to refresh all data if needed
        window.dispatchEvent(new Event('media_relinked'));
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setRelinkingLoading(false);
    }
  };

  // Determine if lecture is locked for the current user
  let isLocked = false;
  let lockReason: 'auth' | 'subscription' | 'blocked' | 'expired' = 'auth';

  const tierMap = {
    free: 0,
    bronze: 1,
    gold: 2
  };

  const isSubscriptionExpired = !!(
    user && 
    user.subscriptionStatus === 'active' && 
    user.subscriptionExpiresAt && 
    new Date(user.subscriptionExpiresAt).getTime() < Date.now()
  );

  const userTier = user && user.subscriptionStatus === 'active' && !isSubscriptionExpired ? user.subscription : 'none';
  const userTierValue = tierMap[userTier as 'none' | 'bronze' | 'gold'] || 0;
  const requiredTierValue = tierMap[lecture.tierRequired] || 0;

  if (requiredTierValue > 0) {
    if (!user) {
      isLocked = true;
      lockReason = 'auth';
    } else if (user.subscriptionStatus === 'blocked') {
      isLocked = true;
      lockReason = 'blocked';
    } else if (isSubscriptionExpired) {
      isLocked = true;
      lockReason = 'expired';
    } else if (userTierValue < requiredTierValue) {
      isLocked = true;
      lockReason = 'subscription';
    }
  }

  const handleDownload = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!lecture.fileUrl) return;
    
    setDownloading(true);
    setQuotaError(null);

    try {
      // 1. Verify if the local file exists on the host disk (Requirement 8)
      const checkResult = await apiService.checkLocalFile(lecture.fileUrl);
      if (!checkResult.exists) {
        setQuotaError('file_not_found');
        setDownloading(false);
        return;
      }

      // 2. Track download and deduct user quota on server
      await apiService.trackDownload(lecture.id);
      
      // 3. Request a secure download token (Requirement 6 / Secure downloads)
      const token = await apiService.getDownloadToken(lecture.id);
      
      // 4. Open through local-media view stream with token-based access (Requirement 6)
      const viewUrl = `/api/local-media/view?lectureId=${lecture.id}&token=${token}`;
      window.open(viewUrl, '_blank');
      
      // Refresh user profile to show updated counter if UI needs it
      if (onRefreshUser) onRefreshUser();
    } catch (err: any) {
      if (err.error === 'quota_exceeded') {
        setQuotaError(err.message || 'نفدت الحصة المتاحة لك من التحميلات.');
      } else {
        setQuotaError('فشل التحميل، يرجى المحاولة لاحقاً');
      }
    } finally {
      setDownloading(false);
    }
  };

  const getLectureThumbnail = () => {
    if (lecture.thumbnailUrl) {
      return lecture.thumbnailUrl;
    }
    const ytId = getYouTubeId(lecture.videoUrl || '');
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
    switch (lecture.categoryId) {
      case 'car-maintenance':
        return "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80";
      case 'graphics-effects':
        return "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80";
      case 'electronics':
        return "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80";
      case 'arduino-programming':
        return "https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=600&q=80";
      default:
        return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80";
    }
  };

  const cardThumbnail = getLectureThumbnail();

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      onClick={() => {
        if (isLocked) {
          if (lockReason === 'auth') onOpenAuth();
          else if (lockReason === 'subscription' || lockReason === 'expired') onOpenSubscribe();
        } else {
          onSelect();
        }
      }}
      className={`relative rounded-3xl overflow-hidden border transition-all text-right flex flex-col h-full cursor-pointer ${
        isActive 
          ? 'bg-[#161B22] border-orange-500 shadow-lg shadow-orange-500/10 ring-1 ring-orange-500' 
          : 'bg-[#161B22] border-gray-800 hover:border-gray-750 shadow-sm'
      }`}
    >
      {/* Quota Error Popup */}
      <AnimatePresence>
        {quotaError && quotaError !== 'file_not_found' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-x-2 bottom-2 z-50 p-3 bg-red-600 text-white rounded-2xl shadow-2xl flex flex-col gap-2 border border-red-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold leading-relaxed">{quotaError}</p>
              <button onClick={() => setQuotaError(null)} className="mr-auto p-1 hover:bg-black/20 rounded-full transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setQuotaError(null); onOpenSubscribe(); }}
              className="w-full py-1.5 bg-white text-red-600 rounded-xl text-[10px] font-black hover:bg-gray-100 transition-colors"
            >
              ترقية الحساب الآن
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local File Missing Relinking Modal (Requirement 8) */}
      <AnimatePresence>
        {quotaError === 'file_not_found' && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs text-right cursor-default"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0A0C10] border border-red-500/30 p-6 rounded-3xl space-y-4 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); setQuotaError(null); }}
                className="absolute top-4 left-4 p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h4 className="font-bold text-sm">الملف المرفق غير موجود حالياً على الهارد ديسك</h4>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                الملف المرفق بهذه المحاضرة لم يعد متاحاً بالمسار المسجّل على القرص الصلب الخاص بك:
                <span className="block mt-2 p-2.5 bg-black/60 rounded-xl font-mono text-[11px] text-red-400 text-left overflow-x-auto select-all" dir="ltr">
                  {lecture.fileUrl}
                </span>
                ربما تم نقله أو حذفه أو تم تغيير حرف القرص (Drive Letter).
              </p>

              {isAdmin ? (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!relinkingPath.trim()) return;
                    setRelinkingLoading(true);
                    try {
                      const res = await apiService.updateLocalFilePath('', relinkingPath.trim(), lecture.id, 'pdf');
                      if (res.success) {
                        setQuotaError(null);
                        alert('تم إعادة ربط مسار الملف بنجاح!');
                        window.location.reload();
                      } else {
                        alert('فشل تحديث المسار، يرجى التحقق منه.');
                      }
                    } catch (err: any) {
                      alert('حدث خطأ: ' + err.message);
                    } finally {
                      setRelinkingLoading(false);
                    }
                  }} 
                  className="space-y-3 bg-black/40 p-4 border border-gray-800 rounded-2xl"
                >
                  <div>
                    <label className="block text-[10px] font-bold text-gray-300 mb-1">
                      إعادة ربط الملف بمسار جديد على الجهاز:
                    </label>
                    <input
                      type="text"
                      required
                      value={relinkingPath}
                      onChange={(e) => setRelinkingPath(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-left font-mono text-white"
                      placeholder="مثال: C:\LMS-Media\new-guide.pdf"
                      dir="ltr"
                    />
                  </div>
                      {isAdmin && (
                        <button 
                          onClick={handleSmartRelink}
                          disabled={relinkingLoading}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-black rounded-xl transition-all flex items-center justify-center gap-2 mb-2"
                        >
                          {relinkingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                          محاولة البحث الذكي التلقائي
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={relinkingLoading}
                        className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-black text-xs font-black rounded-xl transition-colors cursor-pointer border-0"
                      >
                    {relinkingLoading ? 'جاري التحديث...' : 'حفظ وإعادة ربط الملف وتحديث المسار 💾'}
                  </button>
                </form>
              ) : (
                <p className="text-[10px] text-gray-500 italic">
                  يرجى التواصل مع المدرب أو مدير النظام لإعادة ربط ملف الشرح وتحديث مساره.
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. Media Section: Thumbnail & Play Overlay */}
      <div className="aspect-video w-full bg-gray-950 relative overflow-hidden group">
        {cardThumbnail ? (
          <img 
            src={cardThumbnail} 
            alt={lecture.title} 
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 to-gray-800 flex flex-col items-center justify-center p-4">
            <Play className="w-10 h-10 text-orange-500/80 mb-2 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[9px] text-gray-500 uppercase font-black tracking-wider">مشاهدة الدرس</span>
          </div>
        )}

        {/* Play Icon Hover Overlay */}
        {!isLocked && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
            <div className="p-3 bg-orange-500 text-black rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-5 h-5 fill-black" />
            </div>
          </div>
        )}

        {/* Category & Tier Badges absolutely positioned inside media */}
        <div className="absolute top-3 right-3 left-3 flex justify-between items-center z-20">
          <span className="text-[9px] bg-black/75 text-gray-200 px-2 py-0.5 rounded-full font-bold backdrop-blur-xs border border-gray-800">
            {categoryName}
          </span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase shadow-xs ${
            lecture.tierRequired === 'free' 
              ? 'bg-emerald-500 text-black' 
              : lecture.tierRequired === 'bronze'
                ? 'bg-amber-500 text-black'
                : 'bg-orange-500 text-black'
          }`}>
            {lecture.tierRequired === 'free' ? 'مجاني للجميع' : lecture.tierRequired === 'bronze' ? 'باقة برونزية' : 'باقة ذهبية'}
          </span>
        </div>

        {/* Favorite Heart Button */}
        <button
          onClick={toggleFavorite}
          className={`absolute bottom-3 right-3 z-20 p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
            isFavorite 
              ? 'bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30' 
              : 'bg-black/60 border-white/10 text-gray-400 hover:text-white hover:bg-black/80'
          }`}
          title={isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500' : ''}`} />
        </button>

        {/* Locked Filter & Overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center p-3 text-center">
            <div className="p-2 bg-gradient-to-tr from-orange-500 to-amber-600 text-black rounded-full mb-2 shadow-md">
              <Lock className="w-4 h-4" />
            </div>
            
            {lockReason === 'auth' ? (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-gray-200">هذه المحاضرة تتطلب تسجيل دخول</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); onOpenAuth(); }}
                  className="text-[10px] text-orange-400 hover:text-orange-300 font-bold underline cursor-pointer"
                  id={`lec-auth-${lecture.id}`}
                >
                  سجل الدخول الآن للمشاهدة
                </button>
              </div>
            ) : lockReason === 'blocked' ? (
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold text-red-400">الحساب محظور حالياً</p>
                <p className="text-[9px] text-gray-500">يرجى مراجعة إدارة المنصة</p>
              </div>
            ) : lockReason === 'expired' ? (
              <div className="space-y-1 px-2">
                <p className="text-[11px] font-bold text-orange-500">عذراً، صلاحية اشتراكك منتهية</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); onOpenSubscribe(); }}
                  className="text-[10px] text-black bg-orange-500 hover:bg-orange-600 font-bold px-2.5 py-1 rounded-lg border border-orange-400 flex items-center gap-1 mx-auto"
                  id={`lec-renew-${lecture.id}`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  تجديد باقة الاشتراك
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-gray-200">هذا الدرس مخصص لمشتركي الباقة</p>
                <p className="text-[9px] text-gray-400 mb-1">الباقة المطلوبة: {lecture.tierRequired === 'gold' ? 'الذهبية' : 'البرونزية'}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); onOpenSubscribe(); }}
                  className="text-[10px] text-black bg-orange-500 hover:bg-orange-600 font-black px-3 py-1 rounded-lg border border-orange-400 flex items-center gap-1 mx-auto"
                  id={`lec-upgrade-${lecture.id}`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  اشترك الآن في الباقة
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Content Section */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h4 className={`font-black text-xs md:text-sm leading-snug line-clamp-2 ${isActive ? 'text-orange-400' : 'text-white'}`}>
            {lecture.title}
          </h4>
          <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
            {lecture.description || 'لا يوجد وصف مضاف لهذه المحاضرة حالياً.'}
          </p>
        </div>

        {/* 3. Bottom Actions */}
        <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between text-[10px] font-sans">
          <span className="text-gray-500 flex items-center gap-1">
            <Eye className="w-3 h-3 text-gray-400" />
            {lecture.videoProvider === 'bunny' ? 'سيرفر Bunny' : lecture.videoProvider === 'vimeo' ? 'سيرفر Vimeo' : 'يوتيوب'}
          </span>

          {!isLocked && lecture.fileUrl ? (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className={`px-2.5 py-1 text-[10px] text-orange-400 hover:text-orange-300 font-black bg-orange-500/10 hover:bg-orange-500/20 rounded-lg flex items-center gap-1 cursor-pointer transition-colors border-0 disabled:opacity-50`}
              title={lecture.fileName}
              id={`lecture-dl-btn-${lecture.id}`}
            >
              {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              <span>{downloading ? 'جاري التحقق...' : 'تحميل المرفقات'}</span>
            </button>
          ) : (
            <span className="text-gray-500">عرض التفاصيل ←</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
