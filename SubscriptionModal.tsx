import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { apiService } from '../apiService';
import { UserProfile, LMSConfig } from '../types';
import { X, Send, CreditCard, HelpCircle, Check, PhoneCall, ArrowLeft } from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  config: LMSConfig;
}

export default function SubscriptionModal({ isOpen, onClose, user, config }: SubscriptionModalProps) {
  const [selectedTier, setSelectedTier] = useState<'none' | 'bronze' | 'gold'>('none');
  const [amount, setAmount] = useState('');
  const [txNumber, setTxNumber] = useState('');
  const [walletProvider, setWalletProvider] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSelectTier = (tier: 'bronze' | 'gold') => {
    setSelectedTier(tier);
    setAmount(tier === 'bronze' ? '49' : '99');
    setError('');
  };

  const handleSubmitPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedTier === 'none') {
      setError('يرجى اختيار باقة الاشتراك أولاً');
      return;
    }
    if (!txNumber.trim()) {
      setError('يرجى إدخال رقم المعاملة / التحويل');
      return;
    }
    if (!walletProvider.trim()) {
      setError('يرجى تحديد المحفظة التي تم التحويل إليها');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiService.updateUserProfile(user.uid, {
        subscriptionStatus: 'pending',
        pendingSubscriptionType: selectedTier,
        paymentTxInfo: {
          amount: amount,
          txNumber: txNumber.trim(),
          walletProvider: walletProvider,
          date: date,
          screenshotUrl: screenshotUrl.trim() || ''
        }
      });
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء إرسال طلب الاشتراك. يرجى المحاولة لاحقاً.');
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
        className="w-full max-w-2xl bg-[#161B22] rounded-3xl overflow-hidden shadow-xl border border-gray-800 flex flex-col md:flex-row text-right"
      >
        {success ? (
          <div className="p-8 w-full text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">تم إرسال طلب الاشتراك بنجاح!</h3>
            <p className="text-sm text-gray-400 mt-2 max-w-md leading-relaxed">
              طلبك الآن قيد المراجعة والتحقق من قبل مدير المنصة. سيتم تفعيل حسابك وإشعارك فور تأكيد التحويل. شكراً لثقتك بنا!
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-sm font-bold transition-all cursor-pointer"
              id="sub-success-close-btn"
            >
              إغلاق النافذة
            </button>
          </div>
        ) : (
          <>
            {/* Right Side: Plans Selection / Information */}
            <div className="w-full md:w-1/2 bg-[#0F1218] p-6 border-l border-gray-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-white">اشترك الآن في المنصة</h3>
                  <button 
                    onClick={onClose}
                    className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 md:hidden"
                    id="sub-close-mobile-btn"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  اختر الباقة المناسبة لك وقم بالتحويل اليدوي عبر المحافظ الإلكترونية المعتمدة أو إنستا باي، ثم املأ استمارة التحويل على اليسار.
                </p>

                {/* Plans lists */}
                <div className="space-y-3 mb-6">
                  <div 
                    onClick={() => handleSelectTier('bronze')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedTier === 'bronze' 
                        ? 'bg-orange-500/10 border-orange-500 shadow-xs' 
                        : 'bg-[#161B22] border-gray-800 hover:border-gray-750'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-orange-400 bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20">الاشتراك البرونزي</span>
                      <span className="text-sm font-bold text-white">49 ج.م <span className="text-[10px] text-gray-500 font-normal">/شهرياً</span></span>
                    </div>
                    <p className="text-[11px] text-gray-300 mt-2 leading-relaxed">
                      الوصول للمحاضرات المخصصة للباقة البرونزية، وتحميل ملفات الشرح، ومشغل ميديا فائق الجودة.
                    </p>
                  </div>

                  <div 
                    onClick={() => handleSelectTier('gold')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedTier === 'gold' 
                        ? 'bg-amber-500/10 border-amber-500 shadow-xs' 
                        : 'bg-[#161B22] border-gray-800 hover:border-gray-750'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">الاشتراك الذهبي</span>
                      <span className="text-sm font-bold text-white">99 ج.م <span className="text-[10px] text-gray-500 font-normal">/شهرياً</span></span>
                    </div>
                    <p className="text-[11px] text-gray-300 mt-2 leading-relaxed">
                      الوصول الكامل والشامل لكافة محتويات ومحاضرات الموقع بلا استثناء وتحميل الملفات البرمجية والهندسية.
                    </p>
                  </div>
                </div>

                {/* Payment Numbers */}
                <div className="bg-[#161B22] rounded-2xl p-4 border border-gray-800">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-orange-400" />
                    بيانات وأرقام التحويل المعتمدة:
                  </h4>
                  <div className="space-y-2 text-xs">
                    {config.paymentDetails.walletNumbers.length > 0 ? (
                      config.paymentDetails.walletNumbers.map((wallet, index) => (
                        <div key={index} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                          <span className="text-gray-400">{wallet.provider} ({wallet.name})</span>
                          <span className="font-mono font-bold text-orange-400 select-all">{wallet.number}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 py-2 text-center text-[11px]">
                        لم يتم تعيين أرقام الدفع من لوحة التحكم بعد.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-800 text-[10px] text-gray-500 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>يرجى الاحتفاظ برقم العملية أو لقطة الشاشة للتحقق.</span>
              </div>
            </div>

            {/* Left Side: Receipt Submission Form */}
            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">تفاصيل عملية التحويل</h3>
                <button 
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 hidden md:block"
                  id="sub-close-desktop-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                  {error}
                </div>
              )}

              {selectedTier === 'none' ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                  <ArrowLeft className="w-8 h-8 text-gray-600 animate-pulse mb-3" />
                  <p className="text-sm font-bold text-gray-500">يرجى تحديد باقة الاشتراك من القائمة اليمنى للمتابعة</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitPayment} className="space-y-4 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">المحفظة / الرقم المحوّل إليه</label>
                    <select
                      value={walletProvider}
                      onChange={(e) => setWalletProvider(e.target.value)}
                      required
                      className="w-full py-2.5 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right text-white"
                      id="sub-wallet-select"
                    >
                      <option value="">-- اختر الرقم الذي قمت بالتحويل إليه --</option>
                      {config.paymentDetails.walletNumbers.map((wallet, idx) => (
                        <option key={idx} value={`${wallet.provider} (${wallet.number})`}>
                          {wallet.provider} - {wallet.number} ({wallet.name})
                        </option>
                      ))}
                      <option value="محفظة أخرى">رقم آخر / تحويل يدوي مغاير</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">المبلغ المحوّل (ج.م)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right font-mono text-white"
                      placeholder="مثال: 49"
                      id="sub-amount-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">رقم المعاملة (التحويل / مرجع العملية)</label>
                    <input
                      type="text"
                      value={txNumber}
                      onChange={(e) => setTxNumber(e.target.value)}
                      required
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right font-mono text-white"
                      placeholder="اكتب المعرّف أو رقم العملية المرسل بالرسالة"
                      id="sub-tx-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">تاريخ التحويل</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right font-mono text-white"
                      id="sub-date-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">رابط لقطة شاشة التحويل (اختياري)</label>
                    <input
                      type="url"
                      value={screenshotUrl}
                      onChange={(e) => setScreenshotUrl(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-[#0F1218] border border-gray-800 rounded-xl focus:outline-hidden focus:border-orange-500 text-right font-mono text-white"
                      placeholder="https://imgbb.com/your-receipt-link"
                      id="sub-screenshot-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-black rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
                    id="sub-submit-btn"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        إرسال الإيصال للتأكيد
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
