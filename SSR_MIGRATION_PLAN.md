# แผนงานการเปลี่ยนเป็น SSR และ Deploy บน Cloudflare Pages

## ภาพรวม
แผนงานนี้ครอบคลุมขั้นตอนการเปลี่ยนโปรเจกต์ Astro จาก SSG เป็น SSR และการ deploy บน Cloudflare Pages โดยละเอียด รวมถึงการจัดการ dependencies, การอัปเดต config, การทดสอบ, และการ deploy. ใช้ checklist เพื่อติดตามความคืบหน้า.

## ขั้นตอนการ Implement

### 1. เตรียม Environment และ Dependencies
- [ ] ตรวจสอบเวอร์ชัน Node.js และ npm ในเครื่อง (แนะนำ Node.js >= 18)
- [ ] Backup โค้ดปัจจุบัน (commit หรือ branch ใหม่ เช่น `ssr-migration`)
- [ ] ติดตั้ง adapter สำหรับ Cloudflare:
  ```bash
  npm install @astrojs/cloudflare
  ```
- [ ] ตรวจสอบและอัปเดต dependencies อื่นๆ ที่อาจไม่เข้ากันกับ Cloudflare Workers (เช่น @resvg/resvg-js อาจต้องใช้ alternative หรือปรับโค้ด)
- [ ] อัปเดต package.json ถ้าจำเป็น (เช่น เพิ่ม scripts สำหรับ build SSR)

### 2. อัปเดต Astro Configuration
- [ ] แก้ไขไฟล์ `astro.config.mjs`:
  - เพิ่ม import สำหรับ Cloudflare adapter
  - เปลี่ยน `output` เป็น `"server"`
  - เพิ่ม `adapter: cloudflare()`
  - ตรวจสอบ compatibility กับ integrations อื่นๆ (เช่น mdx, sitemap)
- [ ] ทดสอบ config ด้วยการรัน `npm run build` และตรวจสอบ error ใน terminal
- [ ] ปรับ headers หรือ CSP ถ้าจำเป็นสำหรับ SSR (เช่น เพิ่ม nonce สำหรับ scripts)

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
- [ ] รัน `npm run dev` และตรวจสอบว่า SSR ทำงาน (ดู logs ใน terminal)
- [ ] ทดสอบ pages ที่มี dynamic content (เช่น blog posts จาก Notion)
- [ ] ตรวจสอบ performance (ใช้ Lighthouse หรือ built-in tools ใน VS Code)
- [ ] ทดสอบ build ด้วย `npm run build` และตรวจสอบไฟล์ใน `dist` (ควรมี `_worker.js`)
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
- [ ] เตรียม Environment และ Dependencies
- [ ] อัปเดต Astro Configuration
- [ ] จัดการ Environment Variables
- [ ] ปรับโค้ดสำหรับ SSR Compatibility
- [ ] ทดสอบ Locally
- [ ] เตรียมสำหรับ Deploy
- [ ] Deploy และ Monitor
