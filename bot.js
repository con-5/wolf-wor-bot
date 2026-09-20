import mongoose from "mongoose";
import { WOLF } from "wolf.js";
import Redis from "ioredis";
import dotenv from "dotenv";
import { RedisSendGate } from "./lib/redisSendGate.js";
import { installRedisGuard } from "./lib/safeSend.js";
import { startAllAuto } from "./khwater/index.js";

dotenv.config();

// شبكة أمان: أي خطأ غير متوقع يفلت من أي مكان بالكود (Promise رفضت
// بدون catch، أو استثناء متزامن غير متوقع) كان يختفي بصمت ويخلي
// البوت يعلق بدون ما يرسل أو يستقبل، بدون أي أثر بالـ logs. الآن
// نسجله بوضوح بدل ما نخليه صامت — يساعدنا نلقط أي خلل مشابه لاحقًا.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const api = new WOLF();

// wolf.js 2.7.10 ما فيها api.options — نضيفها هنا يدويًا عشان كل ملفات
// commands/admin/*.js تستمر تشتغل بدون أي تعديل (تستخدم api.options.developerId)
api.options = { developerId: api.config.app.developerId };

// --- Redis send guard: يمنع burst الإرسال و429/403 قبل ما تصير، ويسجل تفاصيل 400 ---
// REDIS_URL لازم يكون نفسه بالضبط على الحسابات الأربعة عشان الحد يُحسب
// بشكل مشترك بينهم، مو منفصل لكل واحد.
const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
const gate = new RedisSendGate(redis, {
  perAccountPerSecond: Number(process.env.SEND_RATE_PER_SECOND || 1),
  silenceTtlSeconds: Number(process.env.SILENCE_TTL_SECONDS || 300),
  keyPrefix: "khwater:gate",
});
installRedisGuard(api, gate, { accountKey: process.env.EMAIL });

mongoose.connect(
  `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PWD}@127.0.0.1/${process.env.MONGO_DB_NAME}`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

mongoose.Promise = global.Promise;
const db = mongoose.connection;

export { api, gate };

db.on("error", console.error.bind(console, "connection error:"));

db.once("open", () => {
  console.log("[*] Database is a live!");
});

api.on("ready", async () => {
  console.log(`[*] - ${api.config.keyword} start.`);
  await startAllAuto(api);
});

api.login(process.env.EMAIL, process.env.PASSWORD, process.env.API_KEY, 1);
