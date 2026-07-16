import { motion } from 'motion/react';
import { Award, BookOpen, Clock, HeartHandshake } from 'lucide-react';

export default function StudentBenefits() {
  const benefits = [
    {
      icon: <Award className="w-6 h-6 text-orange-400" />,
      title: 'شروحات تطبيقية وعملية',
      description: 'نركز على التعليم التطبيقي المباشر. ستشاهد شرحاً تفصيلياً للأعطال، والدوائر، والمؤثرات البصرية خطوة بخطوة بالصوت والصورة لضمان تشرّب المهارة.'
    },
    {
      icon: <BookOpen className="w-6 h-6 text-orange-400" />,
      title: 'ملفات ومذكرات مرافقة',
      description: 'نقدم كتيبات صيانة PDF احترافية، مخططات هندسية، وملفات مشاريع مفتوحة المصدر مجاناً مع الدروس لتسهيل عملية التطبيق والمراجعة في أي وقت.'
    },
    {
      icon: <Clock className="w-6 h-6 text-orange-400" />,
      title: 'وصول مرن ومرتب',
      description: 'جميع الأقسام والدروس مرتبة هندسياً لتمكينك من تصفح المحتوى والتعلم بالسرعة التي تناسبك دون تعقيد، مع توافق كامل على الهواتف والكمبيوتر.'
    },
    {
      icon: <HeartHandshake className="w-6 h-6 text-orange-400" />,
      title: 'باقات اشتراك يدوية مريحة',
      description: 'تفعيل الاشتراكات يتم يدوياً وبشفافية تامة عبر المحافظ الإلكترونية وإنستا باي دون اشتراكات آلية أو خصومات مفاجئة، مما يمنحك الأمان المالي المطلق.'
    }
  ];

  return (
    <div className="bg-[#161B22] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-xs text-right font-sans">
      <div className="mb-6 space-y-1">
        <h3 className="text-lg md:text-xl font-black text-white">لماذا منصتنا التعليمية هي خيارك الأفضل؟</h3>
        <p className="text-xs text-gray-400">مميزات حصرية مصممة لمساعدتك على التفوق واكتساب المهارات العملية المطلوبة في سوق العمل</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {benefits.map((b, index) => (
          <motion.div
            key={index}
            whileHover={{ y: -4 }}
            className="bg-[#0F1218] rounded-2xl p-5 border border-gray-850 flex flex-col justify-between space-y-3"
          >
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/15 rounded-xl w-fit self-start">
              {b.icon}
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">{b.title}</h4>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {b.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
