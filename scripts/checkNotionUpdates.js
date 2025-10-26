const { Client } = require('@notionhq/client');
const fetch = require('node-fetch'); // ต้องติดตั้งแพ็กเกจ node-fetch หรือ axios

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_KEY,
});

// Environment Variables for Redis
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = 'notion:last_checked_time'; // กำหนด Key ที่ใช้เก็บข้อมูลใน Redis

const databaseId = process.env.DATABASE_ID;

// ** ฟังก์ชันสำหรับ GitHub Actions Output **
function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
    console.log(`Setting GitHub Output: ${name}=${value}`);
  } else {
    console.warn(`GITHUB_OUTPUT not available. Output ${name}=${value} will not be set.`);
  }
}

// -------------------------------------------------------------------
// ** ฟังก์ชันสำหรับการจัดการ Redis **
// -------------------------------------------------------------------

async function getRedisValue() {
  const url = `${REDIS_URL}/get/${REDIS_KEY}`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
      },
    });

    const data = await response.json();
    if (data.result === null) {
      console.log('Redis key not found. First run.');
      return null;
    }
    // Upstash ส่งคืน JSON ในรูปแบบ { result: "value" }
    return data.result;
  } catch (error) {
    console.error('Error fetching data from Upstash Redis:', error.message);
    throw new Error('Failed to connect to Redis.');
  }
}

async function setRedisValue(timestamp) {
  // ใช้ REST API command SET
  const url = `${REDIS_URL}/set/${REDIS_KEY}/"${timestamp}"`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
      },
    });

    const data = await response.json();
    if (data.result !== 'OK') {
        throw new Error(`Redis SET command failed: ${JSON.stringify(data)}`);
    }
    console.log('Updated last checked time in Redis:', timestamp);
  } catch (error) {
    console.error('Error setting data to Upstash Redis:', error.message);
    throw new Error('Failed to set value to Redis.');
  }
}

// -------------------------------------------------------------------
// ** ฟังก์ชัน Notion เดิม (ไม่มีการเปลี่ยนแปลง) **
// -------------------------------------------------------------------

async function getDatabaseLastEdited() {
  try {
    const response = await notion.databases.retrieve({
      database_id: databaseId,
    });
    return response.last_edited_time;
  } catch (error) {
    console.error('Error fetching database info:', error);
    throw error;
  }
}

// -------------------------------------------------------------------
// ** ฟังก์ชัน Main **
// -------------------------------------------------------------------

async function main() {
  try {
    // 1. ดึงเวลาอัปเดตล่าสุดจาก Notion
    const lastEdited = await getDatabaseLastEdited();
    // 2. ดึงเวลาที่ตรวจสอบล่าสุดจาก Redis
    const lastChecked = await getRedisValue();

    console.log('Database last edited:', lastEdited);
    console.log('Last checked (from Redis):', lastChecked);

    let needsDeploy = false;

    if (!lastChecked) {
      console.log('First time checking (or Redis data cleared) - triggering rebuild...');
      needsDeploy = true;
    } else {
      const lastEditedDate = new Date(lastEdited);
      const lastCheckedDate = new Date(lastChecked);

      if (lastEditedDate > lastCheckedDate) {
        console.log('Updates detected! Triggering rebuild...');
        needsDeploy = true;
      } else {
        console.log('No updates detected.');
      }
    }

    if (needsDeploy) {
      // 1. ตั้งค่า Output ให้กับ GitHub Actions เพื่อสั่งให้ Step ถัดไปทำงาน
      setOutput('should_deploy', 'true');

      // 2. อัปเดตเวลาล่าสุดลงใน Redis (สำคัญ: ต้องทำก่อน Exit)
      await setRedisValue(new Date().toISOString());

      // 3. ออกจาก Process ด้วยรหัส 0 (สำเร็จ)
      process.exit(0);
    } else {
      // ไม่มีการอัปเดต - ไม่ต้องตั้งค่า Output เป็น true
      setOutput('should_deploy', 'false');
      process.exit(0);
    }
  } catch (error) {
    console.error('Fatal error during update check:', error);
    // ในกรณีที่เกิดข้อผิดพลาด ให้สั่ง Deploy เพื่อความปลอดภัย และ Exit ด้วยรหัส 1
    setOutput('should_deploy', 'true');
    process.exit(1);
  }
}

main();
