---
layout: "@/templates/BasePost.astro"
title: แจ้งเตือนใน Discord เมื่อมี Commit ใหม่
description: มีคนบอกว่าเราสามารถเราสามารถเอา webhook ที่ได้จาก discord ไปใส่ที่ setting
  ของ Repository ฝั่ง github ได้เลย
pubDate: 2022-04-08T00:00:00+07:00
imgSrc: "/assets/images/blog/photo-1614680376739-414d95ff43df-2022-09-09.jpeg"
imgAlt: ''

---
สวัสดีครับคุณผู้อ่านทุกท่าน หลังจากที่หายหน้าหายตาไปสักพักใหญ่เพราะไม่รู้ว่าจะเขียนอะไรดี หรือบางเรื่องที่อยากเขียนแต่ก็ไม่มีเวลาเขียนสักที เคลียร์แต่งานพอจบงานก็ลืมไปแล้วว่าจะเขียนเรื่องอะไร (ซะอย่างนั้น)

เหตุเกิดจากผมได้ใช้ Dependabot ในการ auto bump version ของ dependencies ที่ใช้งานในโปรเจ็กต์ของบล็อกนี้อยู่ แต่ว่าจะเข้ามานั่งตรวจเองทุกวันๆว่าวันนี้มีอัพเดทไหมก็ขี้เกียจทำ (สารภาพตามตรง) ประกอบด้วยโปรเจ็กต์ที่มากขึ้น ทำให้เราไม่มีเวลาเข้ามาตรวจสอบตรงนี้บ่อยๆ

ในครั้งแรกคิดว่าต้องเขียนบอทขึ้นมาคอยตรวจสอบเวลา หรือ อาจจะเขียน Github workflow ให้คอยส่งแจ้งเตือนผ่าน webhook ของ Discord เวลามี commit ใหม่ ซึ่งวิธีหลังดูจะง่ายกว่า **แต่** มีคนบอกว่าเราสามารถเราสามารถเอา webhook ที่ได้จาก discord ไปใส่ที่ setting ของ Repository ฝั่ง github ได้เลย

### สิ่งที่ต้องทำ

_1. ทำการสร้างช่องข้อความที่จะใช้ส่งแจ้งเตือน และ กดรูปเฟือง_

![](/assets/images/blog/image-22-2022-09-09.png)  
_2. คลิก Intergration (ถ้าเป็นภาษาไทยจะเป็นคำว่า “การรวม”) จากนั้นคลิก Webhooks_

![](/assets/images/blog/image-13-2022-09-09.png)  
_3. คลิก New Webhook กรอกชื่อที่ต้องการให้บอทแสดงในช่องข้อความ (สามารถตั้งว่าต้องการให้บอทส่งข้อความไปที่ text channel ไหนจากส่วนนี้ได้เช่นกัน)_

![](/assets/images/blog/image-21-2022-09-09.png)  
_4. คลิก Copy Webhook URL  
5\. ไปที่ Repository บน Github คลิก Setting_

![](/assets/images/blog/image-15-2022-09-09.png)  
_6. ที่แถบด้านซ้าย คลิก Webhook_

![](/assets/images/blog/image-16-2022-09-09.png)  
_7. นำลิงค์ที่ Copy ไว้มาวางในช่อง URL payload ตามด้วย /github (อันที่จริงผมก็ไม่แน่ใจว่าถ้าไม่ /github สามารถใช้ได้ปกติไหม แต่ด้านต้นทางที่เคยไปอ่านเจอเขาแนะนำมาแบบนี้)  
8\. Content type เลือก application/json  
9\. เลือก Enable SSL veryfication  
10 .เลือก Just push event เพราะเราต้องการให้มันแจ้งเตือน commit ใหม่ๆอย่างเดียว_

![](/assets/images/blog/image-20-2022-09-09.png)  
_11. คลิก Update webhook_

เพียงเท่านี้ก็เสร็จเรียบร้อย เมื่อมี commit ใหม่ๆ บอทก็จะแจ้งเตือนผ่านทาง Discord ในช่องข้อความที่เรากำหนดไว้ สามารถทดสอบ push commit ใหม่เพื่อดูว่า webhook ทำงานปกติไหมได้ทันที

![](/assets/images/blog/image-18-2022-09-09.png)  
หมายเหตุ : เราสามารถมาตรวจสอบใน Webhook Setting ของ Repository ได้ว่ามีการทำงานปกติไหม โดยจะมีส่วน Recent deliveries เพิ่มขึ้นมา ซึ่งจะเก็บ log การทำงานของ webhook ไว้ สามารถตรวจสอบได้ว่าครั้งล่าสุดตอนไหน ส่งอะไรไปบ้าง ส่งสำเร็จหรือไม่

![](/assets/images/blog/image-19-2022-09-09.png)  
จบแล้วครับขั้นตอนการทำแจ้งเตือนผ่าน Discord เมื่อ Github มี Commit ใหม่ ซึ่งสามารถประหยัดเวลาไปได้มาก เพราะเราไม่ต้องนั่งเขียน Workflow ใหม่เอง เพียงนำ webhook url จาก discord ไปผูกที่ github ได้ทันที สุดท้ายนี้หวังว่าข้อมูลนี้จะเป็นประโยชน์กับผู้อ่านบ้างนะครับ

### Reference

* [ardalis.com](https://ardalis.com/integrate-github-and-discord-with-webhooks/ "https://ardalis.com/integrate-github-and-discord-with-webhooks/")