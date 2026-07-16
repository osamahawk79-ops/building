import { useState, useEffect, FormEvent } from 'react';
import { Play, Shield, AlertCircle, Edit2, Check, Loader2, RefreshCcw } from 'lucide-react';
import { apiService } from '../apiService';

interface VideoPlayerProps {
  videoUrl: string;
  videoProvider: 'bunny' | 'vimeo' | 'youtube' | 'raw' | 'local';
  title: string;
  lectureId?: string;
  onRefresh?: () => void;
  thumbnailUrl?: string;
}

export default function VideoPlayer({ videoUrl, videoProvider, title, lectureId, onRefresh, thumbnailUrl }: VideoPlayerProps) {
  const [embedUrl, setEmbedUrl] = useState('');
  const [isPlayingRaw, setIsPlayingRaw] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(videoUrl);
  
  // Local file validation states
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [fileReadable, setFileReadable] = useState<boolean>(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [streamToken, setStreamToken] = useState<string>('');
  const [isSimulated, setIsSimulated] = useState(false);
  const [checkingFile, setCheckingFile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [envInfo, setEnvInfo] = useState<{ isLocal: boolean, isCloud: boolean, envType: string } | null>(null);

  useEffect(() => {
    apiService.getEnvInfo().then(setEnvInfo).catch(console.error);
  }, []);
  
  // Relinking states
  const [showRelinkForm, setShowRelinkForm] = useState(false);
  const [newFilePath, setNewFilePath] = useState(videoUrl);
  const [updatingPath, setUpdatingPath] = useState(false);
  const [isRelinking, setIsRelinking] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [thumbnailSaving, setThumbnailSaving] = useState(false);

  const autoGenerateThumbnail = async (video: HTMLVideoElement) => {
    if (!lectureId || thumbnailSaving) return;
    
    const storageKey = `thumb_generated_${lectureId}`;
    if (localStorage.getItem(storageKey)) {
      return;
    }

    try {
      setThumbnailSaving(true);
      
      const captureFrame = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          
          fetch(`/api/lectures/${lectureId}/thumbnail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('on_premise_user_token') || ''}`
            },
            body: JSON.stringify({ thumbnailDataUrl: dataUrl })
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              console.log("Lecture thumbnail auto-generated and saved:", data.thumbnailUrl);
              localStorage.setItem(storageKey, 'true');
              if (onRefresh) onRefresh();
            }
          })
          .catch(err => {
            console.error("Failed to upload auto-generated thumbnail:", err);
          });
        } catch (canvasErr) {
          console.warn("Could not capture frame from canvas (likely CORS restriction):", canvasErr);
        }
      };

      if (video.currentTime >= 1.5) {
        captureFrame();
      } else {
        const handleSeeked = () => {
          captureFrame();
          video.removeEventListener('seeked', handleSeeked);
        };
        video.addEventListener('seeked', handleSeeked);
        video.currentTime = 2; // Seek to 2 seconds
      }
    } catch (err) {
      console.error("Error in thumbnail extraction:", err);
    } finally {
      setThumbnailSaving(false);
    }
  };

  // Set up current video URL and admin check
  useEffect(() => {
    setCurrentVideoUrl(videoUrl);
    setNewFilePath(videoUrl);
    setFileExists(null); // Reset existence status to re-verify
    setFileReadable(true);
    setAccessError(null);
    setVideoError(null);
    setIsSimulated(false);
    setStreamToken('');
  }, [videoUrl]);

  useEffect(() => {
    // Check if current user is admin
    const sub = apiService.onAuthStateChanged((user) => {
      setIsAdmin(user?.role === 'admin');
    });
    return sub;
  }, []);

  // Fetch secure streaming token for local provider
  useEffect(() => {
    if (videoProvider !== 'local' || !lectureId) {
      setStreamToken('');
      return;
    }

    let isMounted = true;
    const fetchToken = async () => {
      try {
        const token = await apiService.getStreamToken(lectureId);
        if (isMounted) {
          setStreamToken(token);
        }
      } catch (err: any) {
        console.error("Failed to fetch stream token:", err);
        if (isMounted) {
          setAccessError(err.message || "فشل الحصول على تصريح تشغيل الفيديو الآمن");
          setFileExists(false);
        }
      }
    };

    fetchToken();
    return () => {
      isMounted = false;
    };
  }, [lectureId, videoProvider]);

  // Verify local file existence on change
  useEffect(() => {
    if (videoProvider !== 'local' || !currentVideoUrl) {
      setFileExists(true);
      setFileReadable(true);
      setAccessError(null);
      setIsSimulated(false);
      return;
    }

    let isMounted = true;
    const verifyFile = async () => {
      setCheckingFile(true);
      try {
        const res = await apiService.checkLocalFile(currentVideoUrl);
        if (isMounted) {
          setFileExists(res.exists || !!res.simulated);
          setFileReadable(res.readable !== false || !!res.simulated);
          setAccessError(res.error || null);
          setIsSimulated(!!res.simulated);
        }
      } catch (err: any) {
        if (isMounted) {
          setFileExists(false);
          setFileReadable(false);
          setAccessError(err?.message || "فشل الاتصال بسيرفر التحقق");
          setIsSimulated(false);
        }
      } finally {
        if (isMounted) {
          setCheckingFile(false);
        }
      }
    };

    verifyFile();

    return () => {
      isMounted = false;
    };
  }, [currentVideoUrl, videoProvider]);

  useEffect(() => {
    if (!currentVideoUrl) return;

    let derivedUrl = currentVideoUrl;

    if (videoProvider === 'youtube') {
      let videoId = '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = currentVideoUrl.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      } else {
        videoId = currentVideoUrl;
      }
      derivedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&showinfo=0`;
    } else if (videoProvider === 'vimeo') {
      let vimeoId = '';
      const regExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
      const match = currentVideoUrl.match(regExp);
      if (match && match[3]) {
        vimeoId = match[3];
      } else {
        vimeoId = currentVideoUrl;
      }
      derivedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=0&byline=0&portrait=0`;
    } else if (videoProvider === 'bunny') {
      if (currentVideoUrl.includes('mediadelivery.net')) {
        derivedUrl = currentVideoUrl;
      } else {
        const parts = currentVideoUrl.split('_');
        if (parts.length === 2) {
          derivedUrl = `https://iframe.mediadelivery.net/embed/${parts[0]}/${parts[1]}`;
        } else {
          derivedUrl = currentVideoUrl;
        }
      }
    }

    setEmbedUrl(derivedUrl);
  }, [currentVideoUrl, videoProvider]);

  const handleUpdatePathSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFilePath) return;
    setUpdatingPath(true);
    setUpdateError('');
    setUpdateSuccess(false);

    try {
      const res = await apiService.updateLocalFilePath('', newFilePath, lectureId, 'video');
      if (res.success) {
        setUpdateSuccess(true);
        setCurrentVideoUrl(newFilePath);
        setShowRelinkForm(false);
        if (onRefresh) onRefresh();
      } else {
        setUpdateError('فشل تحديث المسار، يرجى التأكد من المسار');
      }
    } catch (err: any) {
      setUpdateError(err.message || 'حدث خطأ أثناء الاتصال بالسيرفر');
    } finally {
      setUpdatingPath(false);
    }
  };

  const handleSmartRelink = async () => {
    if (!lectureId) return;
    setIsRelinking(true);
    try {
      const res = await apiService.smartRelink(lectureId);
      if (res.success) {
        if (res.newPath) {
          setCurrentVideoUrl(res.newPath);
          setFileExists(true);
          setVideoError(null);
        }
        if (onRefresh) onRefresh();
      } else {
        setUpdateError(res.message);
      }
    } catch (err: any) {
      setUpdateError(err.message || 'خطأ في عملية البحث التلقائي');
    } finally {
      setIsRelinking(false);
    }
  };

  // 1. Loading state for verification check
  if (videoProvider === 'local' && checkingFile && fileExists === null) {
    return (
      <div className="relative aspect-video w-full bg-[#0A0C10] rounded-2xl overflow-hidden shadow-lg border border-gray-800 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
        <div className="text-gray-400 text-xs font-medium">جاري التحقق من وجود ملف الفيديو على جهازك المحلي...</div>
      </div>
    );
  }

  // 2. Local file missing or unreadable warning state
  if (videoProvider === 'local' && (fileExists === false || fileReadable === false)) {
    const isPermissionError = fileExists && !fileReadable;
    return (
      <div 
        className="relative aspect-video w-full bg-[#0D0B0F] rounded-2xl overflow-hidden shadow-lg border-2 border-red-500/30 p-6 flex flex-col items-center justify-center text-center bg-cover bg-center"
        style={thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(13, 11, 15, 0.9), rgba(13, 11, 15, 0.95)), url(${thumbnailUrl})` } : {}}
      >
        <div className="p-3.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/25 mb-4 animate-pulse">
          <AlertCircle className="w-8 h-8" />
        </div>
        
        <h4 className="font-bold text-white text-sm md:text-base mb-2">
          {isPermissionError ? 'تعذر الوصول إلى مسار الملف (خطأ في الصلاحيات)' : 'ملف الفيديو غير متوفر حالياً'}
        </h4>
        <div className="text-xs text-gray-400 max-w-lg mb-4 leading-relaxed">
          {isPermissionError 
            ? 'تم العثور على الملف ولكن لا يمكن للنظام قراءته بسبب قيود نظام التشغيل أو صلاحيات قراءة المجلد.' 
            : 'تعذر العثور على الفيديو التعليمي على خادم البث بالمسار المسجل.'}
          
          {window.location.hostname.includes('europe-west2.run.app') && currentVideoUrl && (currentVideoUrl.includes(':') || currentVideoUrl.startsWith('\\')) && (
            <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 font-bold">
               تنبيه: هذا الفيديو مسجل بمسار محلي على جهازك ({currentVideoUrl}). 
               بما أنك تستخدم المعاينة السحابية الآن، لا يمكن تشغيله. 
               سيعمل بشكل صحيح عند تشغيل السيرفر على جهاز الكمبيوتر الخاص بك.
            </div>
          )}

          {isAdmin ? (
            <div className="mt-2 p-2 bg-black/60 rounded-xl font-mono text-xs text-red-400 text-left overflow-x-auto select-all">
              {currentVideoUrl || 'مسار فارغ'}
            </div>
          ) : null}

          {accessError && (
            <span className="block mt-1.5 text-red-300 font-medium">
              السبب البرمجي: {accessError}
            </span>
          )}
          <span className="block mt-2 text-[11px] text-gray-400">
            {isPermissionError 
              ? 'يرجى تشغيل السيرفر بصلاحيات المسؤول (Administrator) أو تعديل إعدادات الحماية للمجلد لتسمح بالقراءة.' 
              : 'يرجى التأكد من تشغيل السيرفر المحلي ومزامنة الملفات بشكل صحيح.'}
          </span>
        </div>

        {isAdmin ? (
          <div className="w-full max-w-md">
            {!showRelinkForm ? (
              <button
                onClick={() => setShowRelinkForm(true)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تحديث مسار الفيديو (إعادة الربط)</span>
              </button>
            ) : (
              <form onSubmit={handleUpdatePathSubmit} className="space-y-3 bg-black/40 p-4 border border-gray-800 rounded-xl">
                <div>
                  <label className="block text-right text-[10px] font-bold text-gray-300 mb-1">
                    أدخل المسار الكامل والدقيق الجديد للفيديو:
                  </label>
                  <input
                    type="text"
                    required
                    value={newFilePath}
                    onChange={(e) => setNewFilePath(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-left font-mono text-white"
                    placeholder="e.g. D:\Lectures\lecture1.mp4"
                  />
                </div>
                {updateError && <p className="text-[10px] text-red-400 text-right">{updateError}</p>}
                
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updatingPath}
                    className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    {updatingPath ? 'جاري التحديث...' : 'حفظ المسار الجديد'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRelinkForm(false)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-750 text-white text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-gray-500 italic">
              يرجى إبلاغ المعلم أو مهندس الصيانة لإعادة ربط ملف الفيديو في لوحة التحكم.
            </p>
            {isAdmin && (
              <button 
                onClick={handleSmartRelink}
                disabled={isRelinking}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2"
              >
                {isRelinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                محاولة البحث الذكي وإعادة الربط التلقائي
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const handleVideoError = (e: any) => {
    // We avoid logging the whole circular React Event/Element object to prevent
    // "Converting circular structure to JSON" in the browser or DevTools preview context.
    const mediaError = e.target?.error;
    console.error("Video element failed to load or play:", {
      type: e?.type,
      code: mediaError?.code,
      message: mediaError?.message
    });
    let errorMsg = "حدث خطأ أثناء محاولة تشغيل أو تحميل ملف الفيديو المختار.";
    if (mediaError) {
      switch (mediaError.code) {
        case 1:
          errorMsg = "تم إيقاف عملية تحميل الفيديو بواسطة المتصفح (MEDIA_ERR_ABORTED).";
          break;
        case 2:
          errorMsg = "حدث خطأ في شبكة الاتصال أثناء تحميل الفيديو (MEDIA_ERR_NETWORK).";
          break;
        case 3:
          errorMsg = "تعذر فك تشفير الفيديو أو تلف تنسيق الملف الحالي (MEDIA_ERR_DECODE).";
          break;
        case 4:
          errorMsg = "تنسيق الفيديو غير مدعوم بمتصفحك أو تعذر الوصول للملف بالمسار المحدد (MEDIA_ERR_SRC_NOT_SUPPORTED).";
          break;
      }
    }
    setVideoError(errorMsg);
  };

  const handleTimeUpdate = (e: any) => {
    const video = e.currentTarget;
    if (lectureId && video.currentTime > 5) {
      localStorage.setItem(`playback_time_${lectureId}`, video.currentTime.toString());
    }
  };

  const handlePlay = (e: any) => {
    const video = e.currentTarget;
    const savedTime = localStorage.getItem(`playback_time_${lectureId}`);
    if (savedTime) {
      const time = parseFloat(savedTime);
      if (time > 5 && Math.abs(video.currentTime - time) > 2) {
        video.currentTime = time;
      }
    }
  };

  // 3. Local file found or raw streaming provider
  if (videoProvider === 'raw' || videoProvider === 'local') {
    if (videoProvider === 'local' && envInfo?.isCloud) {
      return (
        <div className="aspect-video w-full flex flex-col items-center justify-center bg-[#0A0C10] rounded-2xl border border-gray-800 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-orange-500 mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">الملفات المحلية غير متاحة</h3>
          <p className="text-sm text-gray-400">
            أنت تشغل التطبيق في بيئة سحابية ({envInfo.envType}). الوصول إلى ملفات الفيديو الموجودة على جهازك الشخصي يتطلب تشغيل التطبيق محلياً.
          </p>
        </div>
      );
    }

    // Use token-based secure stream URL for local provider, raw URL otherwise
    const streamUrl = videoProvider === 'local' && lectureId && streamToken
      ? `/api/video/stream?id=${encodeURIComponent(lectureId)}&token=${encodeURIComponent(streamToken)}`
      : videoProvider === 'local' && lectureId
        ? `/api/media/stream/${lectureId}` // fallback if token not yet loaded
        : currentVideoUrl;

    return (
      <div className="space-y-3 w-full">
        <div className="relative aspect-video w-full bg-[#0A0C10] rounded-2xl overflow-hidden group border border-gray-800 shadow-lg">
          {videoError ? (
            <div 
              className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0B0F] z-10 p-6 text-center bg-cover bg-center"
              style={thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(13, 11, 15, 0.9), rgba(13, 11, 15, 0.95)), url(${thumbnailUrl})` } : {}}
            >
              <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20 mb-3 animate-pulse">
                <AlertCircle className="w-6 h-6" />
              </div>
              <span className="text-white font-bold text-sm mb-1">تعذر تشغيل الفيديو</span>
              <span className="text-xs text-red-400 max-w-md mb-4 leading-relaxed">{videoError}</span>
              
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => {
                    setVideoError(null);
                    setIsPlayingRaw(false);
                    setFileExists(null);
                  }}
                  className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 border border-gray-700 cursor-pointer"
                >
                  <RefreshCcw className="w-4 h-4" />
                  إعادة المحاولة
                </button>

                {isAdmin && (
                  <button
                    onClick={handleSmartRelink}
                    disabled={isRelinking}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isRelinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    بحث ذكي وإعادة ربط تلقائي
                  </button>
                )}
              </div>

              {isAdmin && updateError && (
                <p className="mt-3 text-[10px] text-red-400 bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-500/20">
                  {updateError}
                </p>
              )}
            </div>
          ) : !isPlayingRaw ? (
            <div 
              className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0C10]/80 z-10 transition-all p-4 bg-cover bg-center"
              style={thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(10, 12, 16, 0.75), rgba(10, 12, 16, 0.85)), url(${thumbnailUrl})` } : {}}
            >
              <button
                onClick={() => setIsPlayingRaw(true)}
                className="w-16 h-16 bg-orange-500 hover:bg-orange-600 text-black rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110 cursor-pointer"
                id="raw-video-play-overlay-btn"
              >
                <Play className="w-8 h-8 fill-black text-black ml-1 translate-x-0.5" />
              </button>
              <span className="text-xs text-white/70 mt-4 font-medium select-none">{title}</span>
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <Shield className="w-3.5 h-3.5" />
                <span>مشغل آمن وخاص للمحاضرة</span>
              </div>
            </div>
          ) : null}

          <video
            src={streamUrl || undefined}
            controls
            crossOrigin="anonymous"
            autoPlay={isPlayingRaw}
            onError={handleVideoError}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onLoadedData={(e) => {
              const video = e.currentTarget;
              setTimeout(() => {
                autoGenerateThumbnail(video);
              }, 1000);
            }}
            className="w-full h-full object-contain"
          />
        </div>

        {isSimulated && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-right text-xs text-orange-400 flex items-start gap-3 leading-relaxed">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-orange-500 animate-pulse" />
            <div>
              <span className="font-bold block text-white mb-1 text-sm">ميزة محاكاة التشغيل السحابي نشطة 🌐</span>
              هذا الملف التعليمي محلي بالكامل وموجود بالمسار <code className="bg-black/60 px-1.5 py-0.5 rounded font-mono text-gray-300 text-[10px] select-all" dir="ltr">{currentVideoUrl}</code> على الهارد ديسك الخاص بك.
              <span className="block mt-1 text-gray-400">
                لأنك تتصفح المنصة حالياً عبر خادم المعاينة السحابية لـ AI Studio (وليس من السيرفر المحلي الخاص بك)، قمنا بتشغيل فيديو افتراضي للتجربة ومحاكاة مشغل الفيديوهات الآمن للتأكد من سلاسة العرض. سيعمل هذا مباشرة على ملفك الحقيقي عند تشغيل المشروع محلياً على جهازك!
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Fallback Embed (YouTube/Vimeo/Bunny)
  if (!embedUrl) {
    return (
      <div className="relative aspect-video w-full bg-[#0A0C10] rounded-2xl overflow-hidden shadow-lg border border-gray-800 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">جاري تحميل مشغل الفيديو...</div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full bg-[#0A0C10] rounded-2xl overflow-hidden shadow-lg border border-gray-800">
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 text-[10px] text-gray-300 bg-gray-900/80 backdrop-blur-xs px-2.5 py-1 rounded-full border border-gray-800 select-none pointer-events-none">
        <Shield className="w-3 h-3 text-orange-400" />
        <span>بث مشفّر محمي من النسخ</span>
      </div>

      <iframe
        src={embedUrl || undefined}
        className="absolute top-0 left-0 w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={title}
      />
    </div>
  );
}
