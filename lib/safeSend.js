/**
 * safeSend.js
 * -----------
 * يلصق الحماية مباشرة على `api.messaging.sendMessage` و
 * `api.messaging.sendGroupMessage` — هذولا الاثنين هم كل نقاط
 * الإرسال المستخدمة بالمشروع (commands/*, khwater/index.js,
 * jobs/active.js). بعد التركيب، أي كود قديم يستدعيهم يشتغل زي ما هو
 * بدون أي تعديل، ويمر تلقائيًا من خلال:
 *
 *  1) طابور مشترك (SendQueue) يمنع burst الإرسال المتزامن (سبب شائع لـ 429،
 *     خصوصًا عندك بسبب setInterval منفصل لكل قناة في khwater/index.js).
 *  2) تحقق "مكتوم؟" (Redis) قبل أي محاولة إرسال لقناة أخذت 403 قبل شوي.
 *  3) تسجيل أي 400/429 بتفاصيل كافية للمراجعة لاحقًا.
 *
 * أولوية:
 *  - sendMessage (ردود الأوامر التفاعلية) → 'high' دائمًا.
 *  - sendGroupMessage (الإرسال العادي/التلقائي بالخلفية) → 'normal'.
 *  - sendGroupMessageUrgent (ميثود إضافي نضيفه هنا، مو من wolf.js
 *    نفسها) → 'high'. استخدمه لأي إرسال لقناة تبي رد فوري عليه رغم
 *    إنه تقنيًا "sendGroupMessage" — مثال: أمر "!خواطر" اليدوي يستخدم
 *    نفس دالة الإرسال التلقائي المجدول، لكن المستخدم ينتظر الرد الآن
 *    وما يصح ينحط خلف عشرات رسائل الإرسال التلقائي المجدولة.
 *    لسا يمر عبر Redis (نفس الحماية من 429)، بس يتقدم بالطابور.
 *
 * الاستخدام (في bot.js، بعد إنشاء `api` وقبل `api.login(...)`):
 *   import { installRedisGuard } from './lib/safeSend.js';
 *   installRedisGuard(api, gate, { accountKey: process.env.EMAIL });
 */

import { SendQueue } from './sendQueue.js';

// أفضل تخمين لمعرّف الهدف من الوسائط، حسب نوع الإرسال، عشان نطبق
// فحص "مكتوم؟" وتسجيل الخطأ بشكل صحيح لكل حالة
function extractTargetId(kind, args) {
  if (kind === 'group') {
    return args[0]; // sendGroupMessage(gid, content)
  }
  if (kind === 'message') {
    const command = args[0];
    // command object من wolf.js يحمل هوية القناة/المحادثة المستهدفة
    return command?.targetGroupId ?? command?.sourceSubscriberId ?? command?.id ?? undefined;
  }
  return undefined;
}

export function installRedisGuard(api, gate, opts = {}) {
  const accountKey = opts.accountKey || 'default';
  const messaging = api.messaging;
  const queue = new SendQueue(gate, accountKey, opts.queueOptions);

  // يبني نسخة محمية من دالة إرسال أصلية، بأولوية محددة
  const guard = (original, kind, priority) => (...args) =>
    queue.enqueue(async () => {
      const targetId = extractTargetId(kind, args);

      if (await gate.isSilenced(targetId)) {
        return { ok: false, reason: 'silenced' };
      }

      try {
        return await original(...args);
      } catch (err) {
        const code = err?.code ?? err?.statusCode ?? err?.status;
        const message = err?.message || String(err);

        if (code === 403) {
          await gate.markSilenced(targetId);
        }
        if (code === 400 || code === 429) {
          await gate.logSendError(accountKey, {
            code,
            targetId,
            payloadPreview: JSON.stringify(args[1] ?? '').slice(0, 200),
            message,
          });
        }
        // نرمي نفس الخطأ الأصلي عشان الكود القديم (اللي يتوقع try/catch
        // حوله أصلاً بأغلب commands/*) يستمر يشتغل بنفس السلوك المتوقع
        throw err;
      }
    }, priority);

  if (typeof messaging.sendMessage === 'function') {
    const originalSendMessage = messaging.sendMessage.bind(messaging);
    messaging.sendMessage = guard(originalSendMessage, 'message', 'high');
  }

  if (typeof messaging.sendGroupMessage === 'function') {
    const originalSendGroupMessage = messaging.sendGroupMessage.bind(messaging);
    messaging.sendGroupMessage = guard(originalSendGroupMessage, 'group', 'normal');
    // ميثود إضافي (مو من wolf.js) لأي إرسال-قناة يستاهل أولوية فورية
    messaging.sendGroupMessageUrgent = guard(originalSendGroupMessage, 'group', 'high');
  }

  return messaging;
}
