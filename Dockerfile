# Stage 1: بناء المشروع (Builder Stage)
FROM node:20-alpine AS builder

WORKDIR /app

# نسخ ملفات الحزم لتثبيت الاعتمادات
COPY package*.json tsconfig.json vite.config.ts index.html ./

# تثبيت كافة الاعتمادات بما فيها الخاصة بالتطوير
RUN npm ci

# نسخ ملفات الكود المصدري للمشروع
COPY src ./src
COPY server ./server
COPY electron ./electron
COPY assets ./assets
COPY public ./public

# بناء الفرونت إند والباك إند
RUN npm run build

# Stage 2: التشغيل الفعلي (Runner Stage)
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# نسخ ملفات الحزم للإنتاج وتثبيت اعتمادات الإنتاج فقط
COPY package*.json ./
RUN npm ci --omit=dev

# نسخ المخرجات المبنية من مرحلة البناء
COPY --from=builder /app/dist ./dist

# نسخ البيانات الافتراضية والوسائط الافتراضية
COPY data ./data
COPY storage ./storage

# المنفذ الافتراضي لتشغيل الحاوية
EXPOSE 3000

# تشغيل السيرفر
CMD ["node", "dist/server.cjs"]
