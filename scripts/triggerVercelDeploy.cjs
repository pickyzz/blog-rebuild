const fetch = require('node-fetch');

async function triggerDeployHook(deployHookUrl) {
  // ตั้งค่าออปชันสำหรับ POST request
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Actions-Notion-Monitor'
    }
  };

  console.log('Triggering Vercel deploy hook...');
  // ปิดบังส่วนท้ายของ URL เพื่อความปลอดภัยใน Logs
  console.log('Deploy hook URL:', deployHookUrl.replace(/\/[^\/]+$/, '/***'));

  try {
    // ส่ง Request และรอ Response
    const response = await fetch(deployHookUrl, options);
    const data = await response.text();

    console.log('Deploy hook response status:', response.status);
    console.log('Deploy hook response:', data);

    // ตรวจสอบว่า Status Code อยู่ในช่วง 200-299 หรือไม่
    if (response.ok) {
      console.log('Vercel deploy hook triggered successfully! ✅');
      return data;
    } else {
      // หาก Status Code ไม่อยู่ในช่วงที่สำเร็จ ถือว่าล้มเหลว
      throw new Error(`Deploy hook failed with status ${response.status}: ${data}`);
    }
  } catch (error) {
    console.error('Error triggering deploy hook:', error);
    // ส่ง Error ขึ้นไปเพื่อให้ main() จัดการ
    throw error;
  }
}

async function main() {
  try {
    const deployHookUrl = process.env.VERCEL_DEPLOYMENT_HOOK;

    if (!deployHookUrl) {
      throw new Error('VERCEL_DEPLOYMENT_HOOK environment variable is not set');
    }

    await triggerDeployHook(deployHookUrl);
    console.log('Deploy hook execution completed');
    process.exit(0); // สำเร็จ
  } catch (error) {
    console.error('Failed to trigger Vercel deploy:', error.message);
    process.exit(1); // ล้มเหลว
  }
}

// รันฟังก์ชัน main เมื่อไฟล์ถูกเรียกใช้โดยตรง
if (require.main === module) {
  main();
}

module.exports = { triggerDeployHook };
