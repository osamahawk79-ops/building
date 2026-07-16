/**
 * ملف إعدادات إدارة العمليات PM2 (ecosystem.config.cjs)
 * يضمن تشغيل التطبيق بأمان واستمرارية على خوادم الـ VPS.
 */
module.exports = {
  apps: [
    {
      name: 'lms-platform',
      script: './dist/server.cjs',
      instances: 1, // تم ضبطها على 1 لمنع أي تعارض في الكتابة على قاعدة البيانات المحلية db.json
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
