import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { apiService } from '../apiService';
import { X, Mail, Lock, User, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteName: string;
}

export default function AuthModal({ isOpen, onClose, siteName }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        // Sign In using Local API Service
        await apiService.signIn(email.trim(), password);
        setSuccess('تم تسجيل الدخول بنجاح!');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // Sign Up using Local API Service
        if (!username.trim()) {
          throw new Error('يرجى إدخال اسم المستخدم');
        }
        if (password.length < 6) {
          throw new Error('كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.');
        }
        await apiService.signUpWithPassword(email.trim(), username.trim(), password);
        setSuccess('تم إنشاء الحساب بنجاح!');
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.';
      if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-gradient-to-br from-gray-900 to-[#0F1218] rounded-3xl overflow-hidden shadow-xl border border-orange-500 flex flex-col text-right relative"
      >
        {/* Header decoration */}
        <div className="absolute top-4 left-4">
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors"
            id="close-auth-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-black text-white">
              {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </h3>
            <p className="text-sm text-gray-400 mt-2">
              {isLogin ? `مرحباً بك مجدداً في ${siteName}` : `انضم إلى ${siteName} اليوم وابدأ رحلة التعلم والاحتراف`}
            </p>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span>{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم المستخدم</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full py-2.5 pr-10 pl-4 text-sm bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 focus:bg-[#0F1218] transition-all text-right text-white"
                    placeholder="اكتب اسمك الكامل"
                    id="auth-username-input"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-2.5 pr-10 pl-4 text-sm bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 focus:bg-[#0F1218] transition-all text-right text-white"
                  placeholder="example@mail.com"
                  id="auth-email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">كلمة المرور</label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 pr-10 pl-4 text-sm bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 focus:bg-[#0F1218] transition-all text-right text-white"
                  placeholder="••••••••"
                  id="auth-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              id="auth-submit-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'
              )}
            </button>
          </form>

          {/* Google Sign In Button */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-800"></div>
            <span className="flex-shrink mx-4 text-xs text-gray-500 font-sans">أو</span>
            <div className="flex-grow border-t border-gray-800"></div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError('');
              setLoading(true);
              try {
                // Determine configuration state for clear responses
                const isConfigured = !localStorage.getItem('appwrite_emulator_settings');
                await apiService.signInWithGoogle();
                setSuccess('تم تسجيل الدخول بجوجل بنجاح!');
                setTimeout(() => onClose(), 1500);
              } catch (err: any) {
                setError('فشل تسجيل الدخول بجوجل: ' + (err.message || ''));
              } finally {
                setLoading(false);
              }
            }}
            className="w-full py-2.5 bg-[#0F1218] hover:bg-gray-800/80 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer border border-gray-800"
            id="google-signin-btn"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.706 0 3.26.612 4.47 1.625l2.437-2.437C17.312 1.696 14.933 1 12.24 1c-5.523 0-10 4.477-10 10s4.477 10 10 10c5.786 0 9.61-4.068 9.61-9.782 0-.66-.06-1.295-.17-1.933H12.24z"/>
            </svg>
            <span>الدخول بنقرة واحدة باستخدام Google</span>
          </button>

          <div className="mt-6 text-center border-t border-gray-800 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }}
              className="text-xs text-orange-400 hover:text-orange-350 font-bold transition-colors"
              id="auth-toggle-btn"
            >
              {isLogin ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
