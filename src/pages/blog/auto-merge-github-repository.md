---
layout: "@/templates/BasePost.astro"
title: ทำ Auto merge บน github repository
description: ถ้าเรามีโปรเจ็กต์อยู่เยอะแยะเต็มมือไปหมด แล้วเราต้องคอยไปดูทีละ repository
  มีอะไรอัพเดท แล้วคอยกด merge ทีละอัน มันต้องใช้เวลามหาศาลเลยทีเดียว
pubDate: 2021-12-22T00:00:00+07:00
imgSrc: "/assets/images/blog/photo-1630514969818-94aefc42ec47-2022-09-09.jpeg"
imgAlt: ''

---
เนื่องจากครั้งที่แล้วผมโดน Vercel limit deploy ไปเพราะ dependabot ทำการอัพเดท dependencies แล้วรันทดสอบรัวๆ พอมันเกิดการเปิด Pull Request เต็มไปหมด แล้วเราก็ต้องมาไล่ merge เข้า branch หลักของเราทีละอันๆ ทำให้เราเสียเวลาไม่น้อยเลย

ถ้าสมมุติว่าเรามีโปรเจ็กต์อยู่เยอะแยะเต็มมือไปหมด แล้วเราต้องคอยไปดูทีละ repository มีอะไรอัพเดท แล้วคอยกด merge ทีละอัน มันต้องใช้เวลามหาศาลเลยทีเดียว

![](/assets/images/blog/image-27-2022-09-09.png)  
ผมจึงตัดสินใจหาข้อมูลว่า ไหนๆก็มีบอทอยู่ในมือช่วยตรวจสอบอัพเดทพวกนี้แล้ว ควรต้องมีบอทหรือเครื่องมืออะไรที่มันช่วยเรา merge พวกนี้บ้างสิ แล้วผมก็ไปพบเจอเข้ากับ github workflow ตัวหนึ่ง

ชื่อว่า **Dependabot Auto Merge** ซึ่งทางผู้พัฒนาได้บอกไว้ว่า tools ตัวนี้จะทำการรอให้ CI/CD ทำงานเสร็จทั้งหมด และต้องผ่าน Checking ทั้งหมดก่อนจึงจะ merge ให้

ซึ่งหลังจากที่ลองใช้งานดูก็พบว่าเป็นเช่นนั้นจริงๆ แต่เหตุผลจริงๆ คือ ตัว dependabot นั้นมีการรับคำสั่ง โดยเราจะเป็นผู้ป้อนคำสั่งนั้นเข้าไป อย่างเช่น สั่งให้บอท merge ด้วยพิมพ์การคอมเมนต์ใน PR นั้นๆว่า **`@dependabot** merge` จากนั้นบอทก็จะ reaction กับคำสั่งของเราและรอให้ CI/CD ทำงานให้เสร็จทั้งหมด โดยที่ผลการทดสอบต้องผ่านทั้งหมดเช่นกัน เพื่อป้องกันไม่ให้ product ของเราพัง

![](/assets/images/blog/image-28-2022-09-09.png)  
สิ่งที่ workflow ตัวนี้ทำจริงๆนั่นคือ การขอ access เข้าไปใน repository ของเรา และทำการตรวจสอบเมื่อมี pull request ถูกสร้างใหม่ และอ้างอิงว่าเป็นไปตามกฎเกณฑ์ที่เราได้ตั้งค่าไว้หรือไม่

อย่างเช่นในกรณีการใช้งานของผม ผมตั้งให้ auto merge เฉพาะส่วนที่เป็นการอัพเดทเวอร์ชั่นย่อยเท่านั้น ถ้าเกิดมีการอัพเดทเวอร์ชั่นหลัก (เช่น xxxx^11.0.0 เป็น xxxx^12.0.0) auto merge ก็จะไม่ทำงาน แต่ถ้าเป็นอัพเดทย่อย (xxxx^11.0.0 เป็น xxxx^11.0.1) ซึ่งเข้าเงื่อนไขที่ตั้งไว้ ก็จะมีคอมเมนต์เป็นชื่อของเรา โผล่ขึ้นมาสั่งคำสั่ง merge ไว้ทันที และเมื่อ dependabot ทดสอบผ่านแล้วทุกขั้นตอน auto merge ก็จะทำการ merge เข้า branch หลักให้ทันที

### วิธีตั้งค่า

_1. ไปที่_ [_https://github.com/settings/tokens_](https://github.com/settings/tokens "https://github.com/settings/tokens") _และ คลิก Generate new token_

![](/assets/images/blog/image-29-2022-09-09.png)  
โดยตั้งค่าในส่วนของ note ตามที่ต้องการให้อ่านแล้วนึกออกว่าใช้ key ทำอะไร

ในส่วนของ scope นั้น เงื่อนไขดังนี้

* ถ้าเป็น private repo ให้เลือกเป็น repo ด้านบน
* ถ้าเป็น Public repo ให้เลือกเป็น public_repo

![](/assets/images/blog/image-30-2022-09-09.png)  
กรณีนี้ผมเลือก repo เผื่อไว้ใช้กับ private repo ในอนาคตด้วย ขี้เกียจสร้างใหม่บ่อยๆ

จากนั้นคลิก generrate ด้านล่างสุด และ copy ชุดโค้ดออกมาไว้ก่อน (ถ้าทำหายต้อง gen ใหม่อย่างเดียว)

_2. ไปที่ repository บน github ที่ต้องการ ไปยัง setting > secret_

![](/assets/images/blog/image-31-2022-09-09.png)  
_3. คลิก New repository secret_

![](/assets/images/blog/image-32-2022-09-09.png)  
ในส่วน Name นั้นใส่ชื่อของ secret ที่เราจำได้ ต้องเป็นอักษรพิมพ์ใหญ่ทั้งหมด

ในส่วนของ Value นั้นให้ใส่ชุดโค้ดที่ได้จากขั้นตอนข้างบน

1. กด Add secret และ กลับไปที่หน้าโค้ดได้เลย
2. ทำการสร้าง directory `.github/**workflows**/` จาก root ของ repo ของเรา (จะสร้างบน github หรือ บน local แล้ว push ขึ้นไปทีหลังก็ได้)
3. ในโฟลเดอร์ workflows ทำการสร้างไฟล์ **auto-merge.yml** (หรือชื่ออะไรก็ได้) ขึ้นมา และทำการใส่โค้ด workflow ลงไป

```yaml
name: auto-merge

on:
  pull_request_target:

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: ahmadnassri/action-dependabot-auto-merge@v2
        with:
          target: minor
          github-token: ${{ secrets.ชื่อ-secret-ที่เราสร้างไว้ }}
```

**หมายเหตุ**: ในกรณีของผมใช้ `target: patch` เนื่องจาก dependencies บางตัว bump ข้ามเวอร์ชั่นแล้ว style เพี้ยน เลยค่อนข้างซีเรียสตรงนี้

1. save และ commit ขึ้น github ได้เลย

ถ้าไม่มีอะไรผิดพลาดหลังจากที่เรา commit ขึ้นไปแล้ว ในส่วนของ action จะปรากฎชื่อ work flow ตาม name ในชุดโค้ดด้านบนขึ้นมา

![](/assets/images/blog/image-33-2022-09-09.png)  
โดยพื้นฐานเงื่อนไขการทำงานของโค้ดด้านบนผมได้กล่าวถึงไปแล้วขั้นต้น รายละเอียดอื่นๆของ workflow ตัวนี้ รวมถึงการโค้ดและการใช้งานโดยละเอียดกว่านี้ สามารถศึกษาเพิ่มเติมได้ที่

* [https://github.com/ahmadnassri/action-dependabot-auto-merge](https://github.com/ahmadnassri/action-dependabot-auto-merge "https://github.com/ahmadnassri/action-dependabot-auto-merge")
* [https://mknepprath.com/writing/the-bots-replaced-me](https://mknepprath.com/writing/the-bots-replaced-me "https://mknepprath.com/writing/the-bots-replaced-me")

### สรุป

หลังจากที่ได้ลองใช้งานมาระยะเวลาสั้นๆ ทำให้เราประหยัดเวลาในส่วนนี้ได้มากอย่างเห็นผล และเอาเวลาไปโฟกัสกับงานในส่วนอื่นของโปรเจ็กต์ มีเวลาไปดูแลโปรเจ็กต์อื่นๆได้มากขึ้น ซึ่งจริงๆ ในส่วนของ target ถ้าเราตั้งเป็น major เราก็จะปล่อยลืมได้เลย แต่ผมเลือกเป็น minor ไว้เพราะยังอยากเข้ามาตรวจสอบผลเองให้แน่ใจจริงๆ เวลามีการอัพเดทข้ามเวอร์ชั่นของ dependencies เท่านั้นเอง