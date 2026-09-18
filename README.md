# wor Bot

## install Docker

```bash
sudo apt-get install \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
```

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

```bash
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

```bash
sudo apt-get install docker-compose
```

## change config

```bash
cp .env.example .env
nano .env
```

## start docker compose

```bash
docker-compose up -d
```

## start the bot

```bash
node index.js
```

## تحويل المشروع كامل لـ ES Modules

**ملاحظة:** السيرفر عندك يشغّل Node.js v17.0.0 — نسخة قديمة انتهى
دعمها رسميًا من مدة. ES Modules تشتغل فيها بدون مشاكل، لكن يفضّل
لاحقًا الترقية لأحدث نسخة LTS (20 أو 22) لتفادي مشاكل أمان/توافق
غير متعلقة بهذا المشروع تحديدًا.

wolf.js 2.7.10 مكتبة ESM بحتة (`Error [ERR_REQUIRE_ESM]` لو حاولت
`require()` عليها بأي نسخة Node). لذلك تم تحويل **كل** ملفات المشروع من
`require`/`module.exports` إلى `import`/`export`:

- `package.json` صار فيه `"type": "module"`.
- كل استيراد نسبي صار له امتداد `.js` صريح (`./bot.js`، `../khwater/index.js`...)
  لأن ESM ما يقبل حل المسارات الضمني اللي كان يشتغل مع `require`.
- **مهم:** ملفات الأوامر (`commands/*.js`, `commands/admin/*.js`) كانت
  تعرّف الدالة بدون `const`/`let` (مثلاً `Start = async (...) => {}`).
  هذا كان يشتغل بالصدفة بـ CommonJS (متغير عام ضمني)، لكن ESM يشتغل
  دائمًا بـ strict mode ويرفضه بخطأ `ReferenceError`. تمت إضافة `const`
  لكل الدوال الخمسة عشر المتأثرة.
- لا تشغّل الملف بـ `node bot.js` مباشرة توقع تغييرات إضافية — نقطة
  الدخول الوحيدة الصحيحة هي `node index.js` (زي ما هي دائمًا).

## ترقية wolf.js من 1.5.0 إلى 2.7.10

npm ما عاد يوفر نسخة 1.5.0 القديمة، فتم تحديث كل الكود يتوافق مع 2.7.10
(آخر نسخة متوفرة). التغييرات الجوهرية:

- `WOLFBot` → `WOLF` (نفس الشي، اسم مختلف فقط).
- `api.messaging()`, `api.phrase()`, `api.utility()`, `api.group()`,
  `api.subscriber()`, `api.contact()`, `api.commandHandler()` صارت
  **خصائص (properties)** لا دوال — بدون قوسين: `api.messaging`،
  `api.phrase`... إلخ. تم تحديث كل استدعاء بكل الملفات (`commands/`,
  `khwater/`, `jobs/`, `wordle/`, `index.js`).
- `api.updateProfile().setStatus(status).save()` → `api.update({ status })`.
- `api.options.developerId` ماعادت موجودة بالمكتبة نفسها، فتمت إضافتها
  يدويًا بـ`bot.js` (`api.options = { developerId: api.config.app.developerId }`)
  عشان كل ملفات `commands/admin/*.js` تستمر تشتغل بدون أي تعديل عليها.
- تعريف الأوامر (`new Command(trigger, { both, group, private })`)
  و`api.login(email, password, apiKey, onlineState)` **ما تغيّروا إطلاقًا**
  — النسخة الجديدة متوافقة معهم بالضبط.
- `package.json` تحدّث لـ `"wolf.js": "^2.7.10"`، وتم حذف
  `package-lock.json` القديم (كان مثبّت على 1.5.0) — أول `npm install`
  بيولّد وحد جديد يطابق النسخة الصحيحة.

## حماية الإرسال عبر Redis (400 / 403 / 429)

تمت إضافة `lib/redisSendGate.js` و`lib/sendQueue.js` و`lib/safeSend.js`،
ويتم تفعيلها تلقائيًا من `bot.js` — ما تحتاج تعدل أي شي في `commands/`
أو `khwater/` أو `jobs/`.

**السبب الأرجح لمشكلة 429 بالذات في هذا المشروع**: `khwater/index.js`
يسوي `setInterval` مستقل لكل قناة فعّلت `auto`. لو عندك عشرات القنوات
بنفس المدة، تحاول ترسل كلها بنفس اللحظة تقريبًا. الطابور الجديد
(`SendQueue`) يجمعها ويرسلها وحدة وحدة بمعدل `SEND_RATE_PER_SECOND`
(افتراضي رسالة/ثانية) بدل ما ترسل كلها دفعة وحدة.

**تفعيل Redis:**

```bash
docker-compose up -d   # يشغّل mongo + redis معًا الآن
cp .env.example .env   # فيه REDIS_URL و SEND_RATE_PER_SECOND و SILENCE_TTL_SECONDS جاهزة
npm install
node index.js
```

**مهم إذا الحسابات الأربعة على سيرفرات منفصلة**: لازم كلها تشير لنفس
`REDIS_URL` (سيرفر Redis واحد مشترك) عشان الحد يُحسب صح بينهم مجتمعين،
مو منفصل لكل حساب. لو كل حساب على نفس السيرفر (نفس الآلة)، الإعداد
الافتراضي `redis://127.0.0.1:6379` يكفي ويشتغلون على نفس Redis تلقائيًا.

**لمراجعة أخطاء 400/429 المسجلة:**

```js
const { RedisSendGate } = require("./lib/redisSendGate");
const redis = new (require("ioredis"))(process.env.REDIS_URL);
const gate = new RedisSendGate(redis);
console.log(await gate.getRecentErrors(process.env.EMAIL, 50));
```

# wolf-wor-bot
