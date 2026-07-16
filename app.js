/**
 * ملف نقطة انطلاق التطبيق لاستضافات الويب المشتركة (cPanel Node.js Application Selector)
 * يقوم هذا الملف بتهيئة بيئة العمل للإنتاج (Production) وتشغيل السيرفر المترجم بنجاح.
 */

// إجبار التطبيق على العمل في وضع الإنتاج
process.env.NODE_ENV = 'production';

// التحقق من وجود السيرفر المترجم قبل التشغيل
try {
  require('./dist/server.cjs');
} catch (error) {
  console.error("خطأ: لم يتم العثور على الملف المترجم 'dist/server.cjs'.");
  console.error("يرجى التأكد من تشغيل أمر بناء المشروع (npm run build) قبل تشغيل السيرفر.");
  console.error(error);
  process.exit(1);
}
