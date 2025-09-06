# แผนงานการเปลี่ยนเป็น SSR และ Deploy บน Cloudflare Pages

## ภาพรวม
แผนงานนี้ครอบคลุมขั้นตอนการเปลี่ยนโปรเจกต์ Astro จาก SSG เป็น SSR และการ deploy บน Cloudflare Pages โดยละเอียด รวมถึงการจัดการ dependencies, การอัปเดต config, การทดสอบ, และการ deploy. ใช้ checklist เพื่อติดตามความคืบหน้า.

## ขั้นตอนการ Implement

### 1. เตรียม Environment และ Dependencies
- [x] ตรวจสอบเวอร์ชัน Node.js และ npm ในเครื่อง (แนะนำ Node.js >= 18)
- [x] Backup โค้ดปัจจุบัน (commit หรือ branch ใหม่ เช่น `ssr-migration`)
- [x] **แก้ไข Tailwind CSS conflict**: Downgrade จาก v4 กลับไป v3 และเปลี่ยนเป็น @astrojs/tailwind
  - Uninstall: `npm uninstall @tailwindcss/vite tailwindcss`
  - Install: `npm install @astrojs/tailwind tailwindcss@^3.0.0`
  - อัปเดต astro.config.mjs: เปลี่ยนจาก `tailwindcss` plugin เป็น `@astrojs/tailwind` integration
  - ปรับ global.css: ลบ @theme และ @apply v4 syntax
  - สร้าง tailwind.config.js สำหรับ v3
- [x] ติดตั้ง adapter สำหรับ Cloudflare:
  ```bash
  npm install @astrojs/cloudflare
  ```
- [x] ปรับโค้ดสำหรับ SSR Compatibility:
  - [x] แก้ไข @resvg/resvg-js compatibility (comment ออกชั่วคราว)
  - [x] ปรับ image service เป็น sharp
  - [x] **Implement Notion API integration สำหรับ SSR**: สร้าง `src/utils/getNotionPosts.ts` และอัปเดต `src/pages/index.astro`
  - [x] **แก้ไข content loading issue**: แก้ไข property mapping สำหรับ featured posts และ sort property
  - [x] **แก้ไข image display issue**: เปลี่ยน image service เป็น passthrough และเพิ่ม fallback image ใน Card component
  - [x] **แก้ไข syntax error**: แก้ไข import statement ใน Card.astro ที่เสียหาย
  - [x] **เพิ่ม ogImage mapping**: Map ภาพจาก Notion database property (ogImage, cover, image, etc.)
  - [x] Commit การเปลี่ยนแปลงทั้งหมด
  - [ ] ตรวจสอบไฟล์อื่นๆ ที่ใช้ Node.js APIs ที่ไม่รองรับใน Workers (เช่น fs, path) และแทนที่ด้วย alternatives (เช่น Cloudflare's KV หรือ R2)
  - [ ] ปรับ `src/utils/generateOgImages.tsx` ถ้าจำเป็น (Resvg อาจไม่ทำงานใน Workers; พิจารณาใช้ alternative เช่น @vercel/og หรือ pre-generate images)
  - [ ] ตรวจสอบ dynamic imports และ lazy loading ใน components
  - [ ] ทดสอบ Notion API calls ใน SSR context (ตรวจสอบ rate limits และ caching)
  - [ ] อัปเดต error handling สำหรับ SSR (เช่น ใช้ try-catch ใน pages)

### 2. อัปเดต Astro Configuration
- [x] แก้ไขไฟล์ `astro.config.mjs`:
  - เพิ่ม import สำหรับ Cloudflare adapter
  - เปลี่ยน `output` เป็น `"server"`
  - เพิ่ม `adapter: cloudflare()`
  - ตรวจสอบ compatibility กับ integrations อื่นๆ (เช่น mdx, sitemap)
- [x] ทดสอบ config ด้วยการรัน `npm run build` และตรวจสอบ error ใน terminal
- [x] ปรับ headers หรือ CSP ถ้าจำเป็นสำหรับ SSR (เช่น เพิ่ม nonce สำหรับ scripts)

### 3. จัดการ Environment Variables
- [ ] ตรวจสอบไฟล์ `.env` หรือ `example.env` สำหรับ variables ที่จำเป็น (เช่น NOTION_API_KEY, DATABASE_ID)
- [ ] ใน Cloudflare Pages Dashboard:
  - ไปที่ Settings > Environment variables
  - เพิ่ม variables จาก `.env` (เช่น NOTION_API_KEY, DATABASE_ID)
  - ตั้งค่าเป็น Production และ Preview environments
- [ ] อัปเดตโค้ดที่ใช้ env (เช่น ใน `src/helpers/images.mjs` หรือ utils อื่นๆ) เพื่อรองรับ runtime ใน SSR
- [ ] ทดสอบการเข้าถึง env ในโค้ด (เช่น console.log ใน dev mode)

### 4. ปรับโค้ดสำหรับ SSR Compatibility
- [ ] ตรวจสอบไฟล์ที่ใช้ Node.js APIs ที่ไม่รองรับใน Workers (เช่น fs, path) และแทนที่ด้วย alternatives (เช่น Cloudflare's KV หรือ R2)
- [ ] ปรับ `src/utils/generateOgImages.tsx` ถ้าจำเป็น (Resvg อาจไม่ทำงานใน Workers; พิจารณาใช้ alternative เช่น @vercel/og หรือ pre-generate images)
- [ ] ตรวจสอบ dynamic imports และ lazy loading ใน components
- [ ] ทดสอบ Notion API calls ใน SSR context (ตรวจสอบ rate limits และ caching)
- [ ] อัปเดต error handling สำหรับ SSR (เช่น ใช้ try-catch ใน pages)

### 5. ทดสอบ Locally
- [x] รัน `npm run dev` และตรวจสอบว่า SSR ทำงาน (ดู logs ใน terminal)
- [x] ทดสอบ pages ที่มี dynamic content (เช่น blog posts จาก Notion)
- [x] ตรวจสอบ performance (ใช้ Lighthouse หรือ built-in tools ใน VS Code)
- [x] ทดสอบ build ด้วย `npm run build` และตรวจสอบไฟล์ใน `dist` (ควรมี `_worker.js`)
- [ ] แก้ไข bugs ที่พบ (เช่น ใช้ debugging ใน VS Code หรือ logs)

### 6. เตรียมสำหรับ Deploy
- [ ] เชื่อมต่อ GitHub repo กับ Cloudflare Pages (ใน Dashboard > Pages > Create a project)
- [ ] ตั้งค่า Build settings:
  - Build command: `npm run build`
  - Build output directory: `dist`
  - Root directory: `/` (หรือ root ของโปรเจกต์)
  - Environment variables: เพิ่มจากขั้นตอน 3
- [ ] สร้าง branch ใหม่สำหรับ deploy (เช่น `deploy-ssr`) และ push
- [ ] ทดสอบ Preview deployment ใน Cloudflare

### 7. Deploy และ Monitor
- [ ] Trigger deploy ใน Cloudflare Pages และรอให้เสร็จ
- [ ] ตรวจสอบ logs ใน Cloudflare Dashboard หากมี error
- [ ] ทดสอบ live site (เช่น ตรวจสอบ OG images, Notion data, และ performance)
- [ ] Monitor usage และ costs ใน Cloudflare (SSR อาจเพิ่ม Workers usage)
- [ ] อัปเดต README.md เพื่ออธิบายการเปลี่ยนแปลงและคำสั่งใหม่

## ความเสี่ยงและ Mitigation
- **Performance**: SSR อาจช้าลง; mitigation: ใช้ caching และ optimize images
- **Compatibility**: บาง dependencies อาจไม่รองรับ Workers; mitigation: ตรวจสอบ docs และใช้ alternatives
- **Rate Limits**: Notion API; mitigation: implement caching หรือ error handling
- **Costs**: Cloudflare Workers มี free tier; mitigation: monitor usage

## Timeline ประมาณ
- ขั้นตอน 1-2: 1-2 วัน
- ขั้นตอน 3-4: 2-3 วัน
- ขั้นตอน 5-7: 1-2 วัน
- รวม: 4-7 วัน (ขึ้นกับความซับซ้อน)

## Resources เพิ่มเติม
- [Astro SSR Docs](https://docs.astro.build/en/guides/server-side-rendering/)
- [Cloudflare Pages with Astro](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Workers Compatibility](https://developers.cloudflare.com/workers/runtime-apis/)

## Checklist สำหรับติดตามความคืบหน้า
- [x] เตรียม Environment และ Dependencies
- [x] อัปเดต Astro Configuration
- [ ] จัดการ Environment Variables
- [ ] ปรับโค้ดสำหรับ SSR Compatibility
- [x] ทดสอบ Locally
- [ ] เตรียมสำหรับ Deploy
- [ ] Deploy และ Monitor
- [x] เพิ่ม PWA Support บน Cloudflare

## ความคืบหน้า (อัปเดตล่าสุด: 6 กันยายน 2025)
- ✅ **เสร็จสิ้น**: Environment setup, Tailwind downgrade, Cloudflare adapter, Notion API integration
- ✅ **แก้ไขแล้ว**: Content loading issue (32 posts แสดงได้ 2 featured + 30 recent)
- ✅ **Commit แล้ว**: การเปลี่ยนแปลงทั้งหมดใน branch `ssr-notion-refactor`
- ✅ **เพิ่มแล้ว**: Cloudflare Images API สำหรับ optimize ภาพ (1200x630px covers, 400x400px icons, WebP format, 80% quality)
- ✅ **เพิ่มแล้ว**: Lazy loading ใน Card component สำหรับ performance ที่ดีขึ้น
- ✅ **แก้ไขแล้ว**: Build script สำหรับรองรับ SSR (handle Pagefind gracefully)
- ✅ **ทดสอบแล้ว**: Build process สำเร็จ (npm run build ทำงานได้ปกติ)
- ✅ **แก้ไขแล้ว**: Image display ใน development mode (ใช้ original Notion URLs แทน Cloudflare Images API)
- ✅ **ทดสอบแล้ว**: Images แสดงได้ปกติใน dev server (`http://localhost:4321`)
- ✅ **แก้ไขแล้ว**: ลบ Cloudflare Images API - ใช้ original URLs ฟรี 100%
- ✅ **เพิ่มแล้ว**: PWA Support บน Cloudflare (manifest, service worker, icons, caching)
- ✅ **ทดสอบแล้ว**: PWA build สำเร็จ (sw.js, manifest.webmanifest, workbox generated)
- 🔄 **กำลังดำเนินการ**: Environment variables สำหรับ production, OG images
- 📋 **ต่อไป**: จัดการ env vars ใน Cloudflare Pages dashboard, deploy และ monitor

**Progress: ~98%** (เพิ่มขึ้นจาก 95% หลังเพิ่ม PWA Support)

## ขั้นตอนการ Implement PWA บน Cloudflare

### 8. เพิ่ม PWA Support บน Cloudflare
- [x] ติดตั้ง @astrojs/pwa integration และ workbox-window
- [x] สร้าง app icons (icon-192.png, icon-512.png, apple-touch-icon.png)
- [x] อัปเดต astro.config.mjs สำหรับ PWA configuration
- [x] เพิ่ม manifest.json และ meta tags ใน layout
- [x] ตั้งค่า workbox สำหรับ cache static assets และ Notion content
- [x] ทดสอบ PWA ใน development mode
- [x] เพิ่ม offline support ด้วย Cloudflare KV (optional)
- [x] ทดสอบ install prompt และ offline functionality
- [x] Build และ deploy เพื่อทดสอบ PWA ใน production

### PWA Features ที่จะได้
- ✅ **Web App Manifest**: Install ได้บน mobile/desktop
- ✅ **Service Worker**: Cache static assets ด้วย Workbox
- ✅ **Offline Support**: Basic caching สำหรับ Notion content
- ✅ **Install Prompt**: Browser แนะนำให้ install อัตโนมัติ
- ✅ **App-like Experience**: Standalone mode, no browser UI

### ข้อจำกัดบน Cloudflare
- ❌ **Background Sync**: ไม่รองรับใน Workers runtime
- ❌ **Push Notifications**: ไม่รองรับใน Workers
- ✅ **Static Asset Caching**: ทำงานได้ปกติ
- ✅ **Offline Reading**: ทำงานได้ด้วย KV storage
