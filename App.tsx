import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from './apiService';
import { UserProfile, Category, Lecture, LMSConfig } from './types';

// Components
import StudentBenefits from './components/StudentBenefits';
import AuthModal from './components/AuthModal';
import SubscriptionModal from './components/SubscriptionModal';
import VideoPlayer from './components/VideoPlayer';
import LectureCard from './components/LectureCard';
import AdminDashboard from './components/AdminDashboard';

// Icons
import { 
  Sparkles, ShieldCheck, LogIn, LogOut, LayoutGrid, Cpu, BookOpen, 
  Settings, Layers, Download, CheckCircle, Clock, AlertCircle, ChevronLeft, ArrowRight, Loader2,
  Car, Palette, Zap, Heart, Search
} from 'lucide-react';

const DEFAULT_CONFIG: LMSConfig = {
  siteName: 'Building Makers',
  logoUrl: '',
  logoWidth: 160,
  logoHeight: 40,
  logoPadding: 0,
  fontFamily: 'Cairo',
  heroMediaUrl: '',
  heroMediaType: 'image',
  heroOpacity: 60,
  heroBlur: 2,
  mainTitle: 'منصة دراسية متطورة 100% باللغة العربية | بوابتك الذكية لاحتراف المهارات التقنية والعملية',
  subTitle: 'تعلم صيانة السيارات، الجرافيك، الإلكترونيات، والبرمجة مع نخبة من المهندسين الخبراء والمهنيين.',
  primaryColor: '#f97316',
  paymentDetails: {
    walletNumbers: [
      { name: 'المهندس أسامة', number: '01002345678', provider: 'فودافون كاش Vodafone Cash' },
      { name: 'حساب المنصة الرئيسي', number: 'lms@instapay', provider: 'إنستا باي InstaPay' }
    ]
  }
};

const getCategoryIcon = (id: string, name: string) => {
  const normalizedId = (id || '').toLowerCase();
  const normalizedName = (name || '').toLowerCase();
  if (normalizedId.includes('car') || normalizedName.includes('سيار') || normalizedName.includes('صيانة')) {
    return Car;
  }
  if (normalizedId.includes('graph') || normalizedName.includes('جرافيك') || normalizedName.includes('تصميم') || normalizedName.includes('أفتر') || normalizedName.includes('فوتوشوب')) {
    return Palette;
  }
  if (normalizedId.includes('electron') || normalizedName.includes('إلكترو') || normalizedName.includes('كهربا') || normalizedId.includes('circuit')) {
    return Zap;
  }
  if (normalizedId.includes('arduino') || normalizedId.includes('prog') || normalizedName.includes('برمج') || normalizedName.includes('أردوينو') || normalizedId.includes('code')) {
    return Cpu;
  }
  return Layers;
};

export default function App() {
  // Config & State
  const [config, setConfig] = useState<LMSConfig>(() => {
    const cached = localStorage.getItem('lms_site_config');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem('on_premise_user_profile');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [currentView, setCurrentView] = useState<'home' | 'category' | 'lecture'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fav_lectures') || '[]');
    } catch (e) {
      return [];
    }
  });

  // Keep favoriteIds in sync with localStorage events
  useEffect(() => {
    const handleFavUpdate = () => {
      try {
        setFavoriteIds(JSON.parse(localStorage.getItem('fav_lectures') || '[]'));
      } catch (e) {
        setFavoriteIds([]);
      }
    };
    window.addEventListener('favorites_updated', handleFavUpdate);
    
    // Suppress Vite/HMR WebSocket errors in the preview environment which might show as unhandled rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && (
        (typeof event.reason === 'string' && event.reason.includes('WebSocket')) ||
        (event.reason.message && event.reason.message.includes('WebSocket'))
      )) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('favorites_updated', handleFavUpdate);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Modal Controllers
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSubOpen, setIsSubOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showTechGuide, setShowTechGuide] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'error'>('info');

  const triggerNotification = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotification(msg);
    setNotificationType(type);
    setTimeout(() => {
      setNotification((curr) => curr === msg ? null : curr);
    }, 8000);
  };

  const refreshUserProfile = async () => {
    const token = localStorage.getItem('on_premise_user_token');
    if (!token) return;
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
      }
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  const refreshLectures = async () => {
    try {
      const lecs = await apiService.listLectures();
      setLectures(lecs);
    } catch (err) {
      console.error('Failed to reload lectures list:', err);
    }
  };

  // Dynamic Metadata/SEO Title
  useEffect(() => {
    let title = config.siteName;
    if (activeLecture) {
      title = `${activeLecture.title} | ${config.siteName}`;
    } else if (selectedCatId !== 'all') {
      const cat = categories.find(c => c.id === selectedCatId);
      if (cat) title = `${cat.name} | ${config.siteName}`;
    }
    document.title = title;
  }, [activeLecture, selectedCatId, categories, config.siteName]);

  // Dynamic Theme/Font Application
  useEffect(() => {
    if (config.fontFamily) {
      document.documentElement.style.setProperty('--site-font', config.fontFamily);
    }
  }, [config.fontFamily]);

  // Sync Listeners
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        // Load Config
        const siteConfig = await apiService.getSiteConfig();
        if (isMounted) {
          setConfig(siteConfig);
          localStorage.setItem('lms_site_config', JSON.stringify(siteConfig));
        }

        // Load Categories
        const cats = await apiService.listCategories();
        if (isMounted) setCategories(cats);

        // Load Lectures
        const lecs = await apiService.listLectures();
        if (isMounted) setLectures(lecs);
      } catch (err) {
        console.error('Error loading initial data from Local API:', err);
      }
    };

    loadInitialData();

    // Listen to Auth State Changes
    const unsubAuth = apiService.onAuthStateChanged((profile) => {
      if (isMounted) {
        setUserProfile(profile);
      }
    });

    return () => {
      isMounted = false;
      unsubAuth();
    };
  }, []);

  // Handle Seeding of Database if empty
  const handleSeedDatabase = async () => {
    try {
      // 1. Seed Categories
      const seedCats: Category[] = [
        { id: 'car-maintenance', name: 'صيانة السيارات', description: 'أساسيات صيانة السيارات، تشخيص الأعطال بالكمبيوتر، وتصليح المحركات وأنظمة الأمان الحديثة.' },
        { id: 'graphics-effects', name: 'الجرافيك والأفتر إفكت', description: 'صناعة المؤثرات البصرية، الأنيميشن الاحترافي، ومونتاج الفيديو باستخدام Photoshop و Adobe After Effects.' },
        { id: 'electronics', name: 'الإلكترونيات والدوائر', description: 'فهم العناصر الإلكترونية، قراءة المخططات الهندسية، قياس المكونات، وتصميم الدوائر المطبوعة PCB.' },
        { id: 'arduino-programming', name: 'الأردوينو والبرمجة', description: 'إنترنت الأشياء (IoT)، برمجة الميكروكنترولر، وبناء مشاريع ذكية تفاعلية باستخدام لغة C++ ومتحكمات Arduino.' }
      ];

      for (const cat of seedCats) {
        await apiService.saveCategory(cat);
      }

      // 2. Seed Lectures
      const seedLectures: Lecture[] = [
        {
          id: 'lec-car-1',
          categoryId: 'car-maintenance',
          title: 'كيف تعمل شمعات الاحتراق (بوجيهات السيارة) ومتى يجب تغييرها؟',
          description: 'شرح مفصل ومبسط حول نظرية عمل شمعات الاحتراق بداخل غرف المحرك، الأعراض الشهيرة لتلفها، وطريقة فحصها بمقاييس هندسية دقيقة لتجنب هدر الوقود.',
          videoUrl: 'https://www.youtube.com/watch?v=FjIuCAn6fT0',
          videoProvider: 'youtube',
          fileUrl: 'https://archive.org/download/car-spark-plugs-guide/spark_plugs_workbook.pdf',
          fileName: 'كتيب صيانة شمعات الاحتراق.pdf',
          tierRequired: 'free'
        },
        {
          id: 'lec-car-2',
          categoryId: 'car-maintenance',
          title: 'فحص الحساسات وتشخيص أعطال السيارات بجهاز OBD-II',
          description: 'في هذه المحاضرة المتقدمة، نتعلم سوياً كيفية قراءة الأكواد التحذيرية وحل مشكلة لمبة المحرك (Check Engine) باستخدام أجهزة OBD-II للمحترفين.',
          videoUrl: 'https://www.youtube.com/watch?v=Yf-V_kC-h5s',
          videoProvider: 'youtube',
          fileUrl: 'https://archive.org/download/obd2-fault-codes/OBD2_Diagnostic_Codes.pdf',
          fileName: 'جدول أكواد أعطال السيارات OBD.pdf',
          tierRequired: 'bronze'
        },
        {
          id: 'lec-graphics-1',
          categoryId: 'graphics-effects',
          title: 'أساسيات الأفتر إفكت وصناعة أول مشهد أنيميشن للمبتدئين',
          description: 'فهم واجهة برنامج Adobe After Effects، شرح نافذة الكومبوزيشن والتايملاين، واستخدام الكي-فريمز لإنشاء مؤثرات بصرية مذهلة وحركة ناعمة.',
          videoUrl: 'https://www.youtube.com/watch?v=0h94hT9nK8o',
          videoProvider: 'youtube',
          fileUrl: 'https://archive.org/download/after-effects-shortcuts/ae_shortcuts.pdf',
          fileName: 'اختصارات لوحة مفاتيح الأفتر إفكت.pdf',
          tierRequired: 'free'
        },
        {
          id: 'lec-graphics-2',
          categoryId: 'graphics-effects',
          title: 'تحريك النصوص والشعارات ثلاثية الأبعاد بأسلوب الـ Kinetic Typography',
          description: 'شرح كامل لأدوات النصوص المتقدمة ببرنامج After Effects وتوليد الظلال الواقعية وتحريك الكاميرا لصناعة الإعلانات الاحترافية والشعارات المتحركة.',
          videoUrl: 'https://www.youtube.com/watch?v=LqUa2XqB1V8',
          videoProvider: 'youtube',
          fileUrl: 'https://archive.org/download/kinetic-typography-project/kinetic_typography.zip',
          fileName: 'ملفات المشروع والشعارات الجاهزة.zip',
          tierRequired: 'gold'
        },
        {
          id: 'lec-elec-1',
          categoryId: 'electronics',
          title: 'قانون أوم وتوصيل المقاومات على التوالي والتوازي',
          description: 'الدرس التأسيسي في علم الكهرباء والإلكترونيات، شرح مفاهيم الجهد، التيار، والمقاومة، وكيفية حساب الفولت بداخل الدوائر العملية.',
          videoUrl: 'https://www.youtube.com/watch?v=gS6oE5jU358',
          videoProvider: 'youtube',
          fileUrl: 'https://archive.org/download/electronics-basics-ohm/ohms_law_exercises.pdf',
          fileName: 'تمارين ومسائل محلولة في قانون أوم.pdf',
          tierRequired: 'free'
        },
        {
          id: 'lec-arduino-1',
          categoryId: 'arduino-programming',
          title: 'البداية السريعة مع الأردوينو: كتابة كود بلينك للتحكم بالـ LED',
          description: 'شرح اللوحة التطويرية الأردوينو أونو، تحميل برنامج Arduino IDE، وكتابة كود برمجي بلغة C++ للتحكم في الإضاءة عبر المنافذ الرقمية.',
          videoUrl: 'https://www.youtube.com/watch?v=nL346W7Be9U',
          videoProvider: 'youtube',
          fileUrl: 'https://archive.org/download/arduino-guide-beginners/arduino_starter.pdf',
          fileName: 'دليل تجارب الأردوينو للمبتدئين.pdf',
          tierRequired: 'free'
        }
      ];

      for (const lec of seedLectures) {
        await apiService.saveLecture(lec);
      }

      // Reload
      const cats = await apiService.listCategories();
      setCategories(cats);
      const lecs = await apiService.listLectures();
      setLectures(lecs);

      alert('تم تحميل البيانات التدريبية الرائعة بنجاح! الموقع جاهز للاستخدام الفوري.');
    } catch (err) {
      console.error('Error seeding DB:', err);
      alert('حدث خطأ أثناء تحميل البيانات التدريبية.');
    }
  };

  const handleLogout = async () => {
    await apiService.signOut();
    setUserProfile(null);
  };

  // Access checking computed variables and helpers
  const isSubscriptionExpired = !!(
    userProfile?.subscriptionStatus === 'active' &&
    userProfile?.subscriptionExpiresAt &&
    new Date(userProfile.subscriptionExpiresAt).getTime() < Date.now()
  );

  const userTier = userProfile?.subscriptionStatus === 'active' && !isSubscriptionExpired ? userProfile.subscription : 'none';
  const tierMap = { free: 0, bronze: 1, gold: 2 };
  const userTierValue = tierMap[userTier as 'none' | 'bronze' | 'gold'] || 0;
  const requiredTierValue = activeLecture ? tierMap[activeLecture.tierRequired] || 0 : 0;

  const hasAccessToActive = !activeLecture || requiredTierValue === 0 || (
    userProfile && 
    userProfile.subscriptionStatus === 'active' && 
    !isSubscriptionExpired && 
    userTierValue >= requiredTierValue
  );

  const checkAccessAndExecute = (lecture: Lecture, action: () => void) => {
    // 1. Check logged in
    if (!userProfile) {
      triggerNotification("عذراً، هذا المحتوى مخصص للمشتركين فقط. يرجى تسجيل الدخول والاشتراك لتتمكن من تشغيل الفيديوهات أو تحميل الملفات المرفقة", "error");
      setIsAuthOpen(true);
      return;
    }

    // 2. Check if subscription is expired
    const isLecExpired = !!(
      userProfile.subscriptionStatus === 'active' &&
      userProfile.subscriptionExpiresAt &&
      new Date(userProfile.subscriptionExpiresAt).getTime() < Date.now()
    );

    // 3. Check subscription status
    const currentTier = userProfile.subscriptionStatus === 'active' && !isLecExpired ? userProfile.subscription : 'none';
    const currentTierValue = tierMap[currentTier as 'none' | 'bronze' | 'gold'] || 0;
    const reqTierValue = tierMap[lecture.tierRequired] || 0;

    if (reqTierValue > 0) {
      if (userProfile.subscriptionStatus === 'blocked') {
        triggerNotification("عذراً، حسابك محظور حالياً. يرجى مراجعة الدعم الفني.", "error");
        return;
      }
      if (isLecExpired) {
        triggerNotification("انتهت مدة اشتراكك الحالي، يرجى التجديد لاستعادة الصلاحيات", "error");
        setIsSubOpen(true);
        return;
      }
      if (currentTierValue < reqTierValue) {
        triggerNotification("عذراً، هذا المحتوى مخصص للمشتركين فقط. يرجى تسجيل الدخول والاشتراك لتتمكن من تشغيل الفيديوهات أو تحميل الملفات المرفقة", "error");
        setIsSubOpen(true);
        return;
      }
    }

    // Access granted!
    action();
  };

  // Get current categories and filter lectures
  const displayedLectures = lectures.filter((lec) => {
    if (selectedCatId === 'all') return true;
    return lec.categoryId === selectedCatId;
  });

  return (
    <div className="min-h-screen bg-[#0A0C10] text-gray-200 flex flex-col justify-between selection:bg-orange-500 selection:text-black">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-6 right-6 md:left-auto md:right-6 md:w-96 z-50 p-4 rounded-2xl border bg-slate-900 shadow-2xl flex items-start gap-3 text-right"
            style={{
              borderColor: notificationType === 'error' ? 'rgba(239, 68, 68, 0.4)' : notificationType === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(249, 115, 22, 0.4)',
              backgroundColor: '#161B22'
            }}
          >
            <div className={`p-1.5 rounded-full ${notificationType === 'error' ? 'bg-red-500/10 text-red-400' : notificationType === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
              <AlertCircle className="w-5 h-5 shrink-0" />
            </div>
            <div className="flex-1 space-y-1">
              <h5 className="text-xs font-black text-white font-sans">تنبيه النظام</h5>
              <p className="text-[11px] text-gray-300 leading-relaxed font-medium">{notification}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-gray-500 hover:text-white text-xs font-bold font-sans cursor-pointer"
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner Branding Header */}
      <header className="bg-[#0A0C10]/90 backdrop-blur-md border-b border-gray-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Right Section: Logo & Name */}
          <div className="flex items-center gap-3">
            {config.logoUrl ? (
              <img 
                src={config.logoUrl} 
                alt="Logo" 
                style={{ 
                  width: config.logoWidth ? `${config.logoWidth}px` : 'auto',
                  height: config.logoHeight ? `${config.logoHeight}px` : '40px',
                  padding: config.logoPadding ? `${config.logoPadding}px` : '0px'
                }}
                className="object-contain rounded-lg" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-tr from-orange-500 to-amber-600 text-black rounded-xl flex items-center justify-center font-black text-lg shadow-sm">
                {config.siteName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-black text-lg text-white tracking-tight">{config.siteName}</h1>
              <p className="text-[10px] text-gray-400 font-medium">أكاديمية التعليم الإلكتروني المستمر</p>
            </div>
          </div>

          {/* Left Section: Welcome Info & Session buttons */}
          <div className="flex items-center gap-3">
            {userProfile ? (
              <div className="flex items-center gap-4">
                {/* User Info Bar */}
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <span>مرحباً، {userProfile.username}</span>
                    {userProfile.role === 'admin' && (
                      <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-bold border border-red-500/20">المدير</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    {userProfile.subscriptionStatus === 'active' ? (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 leading-none ${
                        userProfile.subscription === 'gold' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      }`}>
                        <Sparkles className="w-2.5 h-2.5" />
                        باقة {userProfile.subscription === 'gold' ? 'ذهبية' : 'برونزية'} نشطة
                      </span>
                    ) : userProfile.subscriptionStatus === 'pending' ? (
                      <span className="text-[9px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold animate-pulse">
                        التحويل بانتظار التأكيد
                      </span>
                    ) : (
                      <span className="text-[9px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-medium border border-gray-700">
                        عضوية مجانية
                      </span>
                    )}
                  </div>
                </div>

                {/* Subscribed Plan Badge for Mobile */}
                <div className="sm:hidden text-xs bg-gray-800 text-gray-300 p-1.5 rounded-lg font-bold border border-gray-700">
                  {userProfile.subscriptionStatus === 'active' 
                    ? `باقة ${userProfile.subscription === 'gold' ? 'ذهبية' : 'برونزية'}` 
                    : userProfile.subscriptionStatus === 'pending' 
                      ? 'قيد الانتظار' 
                      : 'حساب مجاني'}
                </div>

                {/* Subscription payment trigger button */}
                {userProfile.subscriptionStatus !== 'active' && userProfile.subscriptionStatus !== 'pending' && userProfile.role !== 'admin' && (
                  <button
                    onClick={() => setIsSubOpen(true)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                    id="upgrade-main-btn"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    اشترك الآن
                  </button>
                )}

                {/* Control Panel for Admin */}
                {userProfile.role === 'admin' && (
                  <button
                    onClick={() => setIsAdminOpen(true)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black border border-gray-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                    id="admin-dashboard-trigger-btn"
                  >
                    <Settings className="w-4 h-4 text-orange-400" />
                    لوحة التحكم
                  </button>
                )}

                {/* Log out */}
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/50 transition-colors"
                  title="تسجيل الخروج"
                  id="logout-btn"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                id="login-trigger-btn"
              >
                <LogIn className="w-4 h-4" />
                سجل دخولك / اشترك الآن
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-10">

        {/* Dynamic Hero Section with Background Media */}
        <section className="relative h-[650px] flex items-center justify-center overflow-hidden rounded-3xl border border-gray-800 shadow-2xl mx-auto w-full mb-10">
          {/* Background Media Container */}
          <div 
            className="absolute inset-0 z-0"
            style={{ filter: `blur(${config.heroBlur || 0}px)` }}
          >
            {config.heroMediaUrl ? (
              config.heroMediaType === 'video' ? (
                <video 
                  src={config.heroMediaUrl.startsWith('/storage') ? `/api/videos/stream?path=${encodeURIComponent(config.heroMediaUrl)}` : config.heroMediaUrl} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              ) : (
                <img 
                  src={config.heroMediaUrl} 
                  alt="Hero Background" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )
            ) : (
              /* Fallback default background if none uploaded */
              <div className="w-full h-full bg-gradient-to-br from-[#0F1218] via-[#161B22] to-[#0F1218]" />
            )}
            
            {/* Dynamic Overlay */}
            <div 
              className="absolute inset-0 bg-black" 
              style={{ opacity: (config.heroOpacity !== undefined ? config.heroOpacity : 60) / 100 }} 
            />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-4 py-1.5 rounded-full text-xs font-black mx-auto">
                <Sparkles className="w-4 h-4" />
                <span>منصة دراسية متطورة 100% باللغة العربية</span>
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight drop-shadow-2xl">
                {config.mainTitle}
              </h1>
              <p className="text-sm md:text-lg text-gray-300 max-w-3xl mx-auto font-medium leading-relaxed">
                {config.subTitle}
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-wrap justify-center gap-4"
            >
              {categories.map((c) => {
                const IconComponent = getCategoryIcon(c.id, c.name);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCatId(c.id);
                      setCurrentView('category');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-orange-500/50 px-6 py-3 rounded-2xl flex items-center gap-3 text-white font-bold hover:bg-white/10 transition-all cursor-pointer shadow-lg active:scale-95 text-right"
                  >
                    <IconComponent className="w-5 h-5 text-orange-500" />
                    <span className="text-xs md:text-sm">{c.name}</span>
                  </button>
                );
              })}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="pt-4"
            >
              <button 
                onClick={() => document.getElementById('categories-grid')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-orange-500 hover:bg-orange-600 text-black px-10 py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-orange-500/20 active:scale-95 cursor-pointer flex items-center gap-2 mx-auto"
              >
                استكشف الدورات التدريبية
                <ChevronLeft className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
          
          {/* Decorative Bottom Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0d1117] to-transparent z-5" />
        </section>

        {/* 1. Home View */}
        {currentView === 'home' && (
          <>
            {/* Search Input Bar */}
            <section className="relative max-w-2xl mx-auto mb-10 text-right">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن محاضرة، درس، صيانة، أو برمجيات..."
                  className="w-full py-4 pr-12 pl-4 text-sm bg-[#161B22] border border-gray-800 focus:border-orange-500 rounded-2xl focus:outline-hidden text-right text-white font-medium shadow-lg transition-all"
                  id="main-search-input"
                />
                <Search className="w-5 h-5 text-gray-500 absolute top-4 right-4" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute top-4 left-4 text-xs text-gray-500 hover:text-white cursor-pointer"
                  >
                    إلغاء التصفية
                  </button>
                )}
              </div>
            </section>

            {searchQuery.trim() !== "" ? (
              /* Search Results Section */
              <section className="space-y-6 text-right mb-12">
                <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                  <Search className="w-5 h-5 text-orange-400" />
                  <h3 className="text-base md:text-lg font-black text-white font-sans">نتائج البحث عن: "{searchQuery}"</h3>
                </div>
                
                {lectures.filter(l => 
                  l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
                ).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lectures.filter(l => 
                      l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
                    ).map((lec) => {
                      const parentCat = categories.find(c => c.id === lec.categoryId);
                      return (
                        <LectureCard
                          key={lec.id}
                          lecture={lec}
                          user={userProfile}
                          isActive={activeLecture?.id === lec.id}
                          onRefreshUser={refreshUserProfile}
                          onSelect={() => {
                            checkAccessAndExecute(lec, () => {
                              setActiveLecture(lec);
                              setCurrentView('lecture');
                            });
                          }}
                          onOpenSubscribe={() => setIsSubOpen(true)}
                          onOpenAuth={() => setIsAuthOpen(true)}
                          categoryName={parentCat ? parentCat.name : 'محاضرة'}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 bg-[#161B22] border border-gray-800 rounded-3xl text-center space-y-2">
                    <AlertCircle className="w-10 h-10 text-gray-600 mx-auto animate-bounce" />
                    <p className="text-xs text-gray-500">عذراً، لم نجد أي نتائج تطابق بحثك. جرب كلمات مفتاحية أخرى.</p>
                  </div>
                )}
              </section>
            ) : (
              <>
                {/* Categories Cards Grid Layout */}
                <section className="space-y-6 text-right mb-12">
                  <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                    <BookOpen className="w-5 h-5 text-orange-400" />
                    <h3 className="text-base md:text-lg font-black text-white font-sans">أقسام المنصة التعليمية الرئيسية</h3>
                  </div>
                  
                  {categories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {categories.map((c) => {
                        const count = lectures.filter(l => l.categoryId === c.id).length;
                        return (
                          <motion.div
                            key={c.id}
                            whileHover={{ y: -6, scale: 1.02 }}
                            onClick={() => {
                              setSelectedCatId(c.id);
                              setCurrentView('category');
                            }}
                            className="relative rounded-3xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-all cursor-pointer flex flex-col h-full bg-[#161B22] shadow-sm"
                          >
                            {/* Thumbnail / Image Preview */}
                            <div className="aspect-video w-full bg-gray-950/80 relative overflow-hidden flex items-center justify-center">
                              {c.previewUrl ? (
                                <video 
                                  src={c.previewUrl.startsWith('/storage') ? `/api/videos/stream?path=${encodeURIComponent(c.previewUrl)}` : c.previewUrl} 
                                  autoPlay 
                                  loop 
                                  muted 
                                  playsInline 
                                  className="object-cover w-full h-full transition-transform hover:scale-110 duration-500"
                                />
                              ) : c.imageUrl ? (
                                <img 
                                  src={c.imageUrl} 
                                  alt={c.name}
                                  className="object-cover w-full h-full transition-transform hover:scale-110 duration-500"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 to-amber-600/15 flex flex-col items-center justify-center p-4">
                                  <BookOpen className="w-8 h-8 text-orange-400/80 mb-2" />
                                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">كتالوج تعليمي</span>
                                </div>
                              )}
                              
                              {/* Lectures Count Badge */}
                              <span className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-xs text-[9px] text-orange-400 px-2 py-0.5 rounded-full font-bold font-sans">
                                {count} درس متاح
                              </span>
                            </div>

                            {/* Card Content */}
                            <div className="p-4 flex flex-col justify-between flex-1 space-y-2">
                              <div>
                                <h4 className="font-black text-white text-xs md:text-sm font-sans">{c.name}</h4>
                                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed line-clamp-2">
                                  {c.description || 'تصفح هذا القسم المميز لمعرفة المزيد من الدروس.'}
                                </p>
                              </div>
                              <div className="pt-2 flex justify-between items-center text-[10px] border-t border-gray-800/60 mt-1 font-sans">
                                <span className="text-orange-400 font-bold">عرض الدروس المتاحة ←</span>
                                <span className="text-gray-500 font-bold">تصفح الآن</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">لا يوجد أقسام تعليمية مضافة حالياً.</p>
                  )}
                </section>

                {/* 2. Latest Lectures Section */}
                <section className="space-y-6 text-right mb-12" id="latest-lectures-section">
                  <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                    <Clock className="w-5 h-5 text-orange-400" />
                    <h3 className="text-base md:text-lg font-black text-white font-sans">آخر المحاضرات المضافة حديثاً</h3>
                  </div>
                  
                  {lectures.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {lectures.slice(-3).reverse().map((lec) => {
                        const parentCat = categories.find(c => c.id === lec.categoryId);
                        return (
                          <LectureCard
                            key={`latest-${lec.id}`}
                            lecture={lec}
                            user={userProfile}
                            isActive={activeLecture?.id === lec.id}
                            onRefreshUser={refreshUserProfile}
                            onSelect={() => {
                              checkAccessAndExecute(lec, () => {
                                setActiveLecture(lec);
                                setCurrentView('lecture');
                              });
                            }}
                            onOpenSubscribe={() => setIsSubOpen(true)}
                            onOpenAuth={() => setIsAuthOpen(true)}
                            categoryName={parentCat ? parentCat.name : 'محاضرة'}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">لا يوجد محاضرات مضافة حالياً.</p>
                  )}
                </section>

                {/* 3. My Favorites Section */}
                {lectures.filter(l => favoriteIds.includes(l.id)).length > 0 && (
                  <section className="space-y-6 text-right mb-12" id="favorites-section">
                    <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                      <Heart className="w-5 h-5 text-red-500 fill-red-500 animate-pulse" />
                      <h3 className="text-base md:text-lg font-black text-white font-sans">محاضراتي المفضلة</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {lectures.filter(l => favoriteIds.includes(l.id)).map((lec) => {
                        const parentCat = categories.find(c => c.id === lec.categoryId);
                        return (
                          <LectureCard
                            key={`fav-${lec.id}`}
                            lecture={lec}
                            user={userProfile}
                            isActive={activeLecture?.id === lec.id}
                            onRefreshUser={refreshUserProfile}
                            onSelect={() => {
                              checkAccessAndExecute(lec, () => {
                                setActiveLecture(lec);
                                setCurrentView('lecture');
                              });
                            }}
                            onOpenSubscribe={() => setIsSubOpen(true)}
                            onOpenAuth={() => setIsAuthOpen(true)}
                            categoryName={parentCat ? parentCat.name : 'محاضرة'}
                          />
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* Why choose our platform / Student Benefits */}
            <section className="space-y-4">
              <StudentBenefits />
            </section>
          </>
        )}

        {/* 2. Category Page View */}
        {currentView === 'category' && (
          <div className="space-y-8 text-right">
            {/* Breadcrumb Navigation trail */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400 font-sans">
                <button 
                  onClick={() => setCurrentView('home')} 
                  className="hover:text-orange-400 transition-colors cursor-pointer"
                  id="breadcrumb-home"
                >
                  الرئيسية
                </button>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-white font-bold">{categories.find(c => c.id === selectedCatId)?.name || 'القسم التعليمي'}</span>
              </div>
              <button 
                onClick={() => setCurrentView('home')}
                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#161B22] hover:bg-[#1f2630] px-4 py-2 rounded-xl border border-gray-800 transition-all cursor-pointer"
                id="btn-back-to-home"
              >
                <ArrowRight className="w-4 h-4 text-orange-400 shrink-0" />
                <span>الرجوع للرئيسية</span>
              </button>
            </div>

            {/* Header info block */}
            <div className="relative bg-gradient-to-r from-[#161B22] to-[#1F2630] border border-gray-800 rounded-3xl p-6 md:p-8 overflow-hidden shadow-xs">
              <div className="absolute top-0 left-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl" />
              <h3 className="text-lg md:text-2xl font-black text-white">{categories.find(c => c.id === selectedCatId)?.name}</h3>
              <p className="text-xs md:text-sm text-gray-400 mt-2 leading-relaxed max-w-4xl">
                {categories.find(c => c.id === selectedCatId)?.description || 'تصفح المحاضرات والدروس المتاحة في هذا القسم لتكتسب المهارات المطلوبة.'}
              </p>
            </div>

            {/* Grid of Lectures */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-850 pb-3">
                <h4 className="text-sm md:text-base font-black text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full" />
                  محاضرات هذا القسم مصفوفة شبكياً (Lectures Grid)
                </h4>
                <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full font-bold">
                  {lectures.filter(l => l.categoryId === selectedCatId).length} درس متاح
                </span>
              </div>

              {lectures.filter(l => l.categoryId === selectedCatId).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lectures.filter(l => l.categoryId === selectedCatId).map((lec) => {
                    const parentCat = categories.find(c => c.id === lec.categoryId);
                    return (
                      <LectureCard
                        key={lec.id}
                        lecture={lec}
                        user={userProfile}
                        isActive={activeLecture?.id === lec.id}
                        onRefreshUser={refreshUserProfile}
                        onSelect={() => {
                          checkAccessAndExecute(lec, () => {
                            setActiveLecture(lec);
                            setCurrentView('lecture');
                          });
                        }}
                        onOpenSubscribe={() => setIsSubOpen(true)}
                        onOpenAuth={() => setIsAuthOpen(true)}
                        categoryName={parentCat ? parentCat.name : 'محاضرة'}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="p-16 bg-[#161B22] border border-gray-800 rounded-3xl text-center space-y-2">
                  <BookOpen className="w-10 h-10 text-gray-600 mx-auto" />
                  <p className="text-xs md:text-sm text-gray-500">لا يوجد محاضرات مضافة في هذا القسم حالياً.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Single Lecture View Page */}
        {currentView === 'lecture' && activeLecture && (
          <div className="space-y-8 text-right">
            {/* Breadcrumb Navigation trail */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400 font-sans">
                <button 
                  onClick={() => setCurrentView('home')} 
                  className="hover:text-orange-400 transition-colors cursor-pointer"
                >
                  الرئيسية
                </button>
                <ChevronLeft className="w-3.5 h-3.5" />
                <button 
                  onClick={() => {
                    setSelectedCatId(activeLecture.categoryId);
                    setCurrentView('category');
                  }} 
                  className="hover:text-orange-400 transition-colors cursor-pointer"
                >
                  {categories.find(c => c.id === activeLecture.categoryId)?.name || 'القسم'}
                </button>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-white font-bold">{activeLecture.title}</span>
              </div>
              <button 
                onClick={() => {
                  setSelectedCatId(activeLecture.categoryId);
                  setCurrentView('category');
                }}
                className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#161B22] hover:bg-[#1f2630] px-4 py-2 rounded-xl border border-gray-800 transition-all cursor-pointer"
                id="btn-back-to-lectures"
              >
                <ArrowRight className="w-4 h-4 text-orange-400 shrink-0" />
                <span>الرجوع للمحاضرات</span>
              </button>
            </div>

            {/* Single Lecture Classroom Screen */}
            <div className="space-y-6">
              <div className="bg-[#161B22] border border-gray-800 p-5 rounded-3xl shadow-xs">
                {hasAccessToActive ? (
                  <VideoPlayer 
                    videoUrl={activeLecture.videoUrl} 
                    videoProvider={activeLecture.videoProvider} 
                    title={activeLecture.title} 
                    lectureId={activeLecture.id}
                    onRefresh={refreshLectures}
                    thumbnailUrl={activeLecture.thumbnailUrl || undefined}
                  />
                ) : (
                  <div className="aspect-video bg-[#0A0C10] rounded-2xl border border-gray-800 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl" />
                    <div className="p-4 bg-red-500/10 text-red-500 rounded-full mb-4 border border-red-500/20">
                      <Lock className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-white text-base font-sans">محتوى مغلق ومحمي بموجب شروط الاشتراك</h4>
                    <p className="text-xs text-gray-400 max-w-md mt-2 leading-relaxed font-sans">
                      {isSubscriptionExpired 
                        ? "انتهت مدة اشتراكك الحالي، يرجى التجديد لاستعادة الصلاحيات" 
                        : "عذراً، هذا المحتوى مخصص للمشتركين فقط. يرجى تسجيل الدخول والاشتراك لتتمكن من تشغيل الفيديوهات أو تحميل الملفات المرفقة"}
                    </p>
                    <button
                      onClick={() => {
                        if (!userProfile) {
                          setIsAuthOpen(true);
                        } else {
                          setIsSubOpen(true);
                        }
                      }}
                      className="mt-4 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-black text-xs font-black rounded-xl shadow-xs cursor-pointer transition-colors font-sans"
                      id="unlock-classroom-btn"
                    >
                      {userProfile ? 'تجديد / تفعيل باقة الاشتراك الآن 🚀' : 'تسجيل الدخول والاشتراك'}
                    </button>
                  </div>
                )}

                {/* Info, descriptions, and file downloads directly below the player */}
                <div className="mt-6 space-y-5">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-800 pb-5">
                    <div>
                      <h4 className="font-black text-white text-lg md:text-xl font-sans">{activeLecture.title}</h4>
                      <p className="text-xs text-orange-400 font-bold mt-1 font-sans">
                        باقة الدرس: {activeLecture.tierRequired === 'free' ? 'مجاني للعموم' : activeLecture.tierRequired === 'bronze' ? 'الباقة البرونزية' : 'الباقة الذهبية الشاملة'}
                      </p>
                    </div>

                    {/* Files download section with user subscription verification rules */}
                    {activeLecture.fileUrl && (
                      <button
                        onClick={() => {
                          checkAccessAndExecute(activeLecture, async () => {
                            if (downloading) return;
                            setDownloading(true);
                            try {
                              await apiService.trackDownload(activeLecture.id);
                              
                              let downloadToken = "";
                              try {
                                downloadToken = await apiService.getDownloadToken(activeLecture.id);
                              } catch (err) {
                                console.warn("Failed to get download token:", err);
                              }

                              // Use the secure internal endpoint for local files
                              const isLocal = activeLecture.fileUrl!.includes('\\') || 
                                              activeLecture.fileUrl!.includes('/') || 
                                              activeLecture.videoProvider === 'local';
                                              
                              const targetUrl = isLocal 
                                ? `/api/media/attachment/${activeLecture.id}?token=${encodeURIComponent(downloadToken)}` 
                                : activeLecture.fileUrl!;
                                
                              window.open(targetUrl, '_blank');
                              refreshUserProfile();
                            } catch (err: any) {
                              if (err.error === 'quota_exceeded') {
                                triggerNotification(err.message, 'error');
                                setIsSubOpen(true);
                              } else {
                                triggerNotification('فشل التحميل، يرجى المحاولة لاحقاً', 'error');
                              }
                            } finally {
                              setDownloading(false);
                            }
                          });
                        }}
                        disabled={downloading}
                        className="w-full lg:w-auto px-5 py-3 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer select-none font-sans border-0 disabled:opacity-50"
                        id="lecture-download-main-btn"
                      >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span>{downloading ? 'جاري التحقق...' : `تحميل ${activeLecture.fileName || 'الملف المرفق'} (كتيب الشرح والصيانة)`}</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-[#0F1218] border border-gray-850 p-5 rounded-2xl">
                    <h5 className="font-bold text-white text-sm mb-2">تفاصيل وشرح المحاضرة:</h5>
                    <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-sans whitespace-pre-line">
                      {activeLecture.description || 'لم يتم إضافة وصف لهذه المحاضرة.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer Branding section */}
      <footer className="bg-[#0F1218] text-white mt-16 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-right">
          <div>
            <h4 className="font-black text-white text-sm">{config.siteName}</h4>
            <p className="text-xs text-gray-400 mt-1">{config.subTitle}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>جميع الحقوق محفوظة {new Date().getFullYear()} &copy;</span>
          </div>
        </div>
      </footer>

      {/* Render Modals in Portal form */}
      <AnimatePresence>
        {isAuthOpen && (
          <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} siteName={config.siteName} />
        )}
        
        {isSubOpen && userProfile && (
          <SubscriptionModal 
            isOpen={isSubOpen} 
            onClose={() => setIsSubOpen(false)} 
            user={userProfile}
            config={config}
          />
        )}

        {isAdminOpen && userProfile?.role === 'admin' && (
          <AdminDashboard 
            onClose={() => setIsAdminOpen(false)} 
            config={config}
            onUpdateConfig={(newConf) => setConfig(newConf)}
            onRefreshData={async () => {
              try {
                const cats = await apiService.listCategories();
                setCategories(cats);
                const lecs = await apiService.listLectures();
                setLectures(lecs);
              } catch (err) {
                console.error(err);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
