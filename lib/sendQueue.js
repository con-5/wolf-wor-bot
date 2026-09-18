/**
 * sendQueue.js
 * ------------
 * طابور إرسال داخل نفس العملية. يمنع مشكلة "burst الإرسال" اللي تصير
 * لما عدة setInterval (قناة لكل وحدة) تحاول ترسل بنفس اللحظة تقريبًا:
 * بدل ما كلها تحاول ترسل مباشرة وتاخذ 429، تنحط بالطابور وتترسل
 * وحدة وحدة بمعدل يحدده RedisSendGate (مشترك مع باقي الحسابات لو
 * كانت على نفس Redis).
 *
 * أولوية (priority):
 *  - 'high'   → ردود الأوامر التفاعلية (المستخدم ينتظر الرد الآن).
 *  - 'normal' → الإرسال التلقائي بالخلفية (خواطر، رسائل مغادرة قناة...).
 * أي مهمة 'high' تدخل الطابور تتقدم على كل مهام 'normal' المنتظرة،
 * حتى لو دخلت بعدها زمنيًا — عشان رد المستخدم ما يعلق خلف عشرات
 * رسائل الخواطر التلقائية المجدولة بنفس اللحظة.
 *
 * مهم: ما نرفض أي رسالة بسبب الحد — فقط نأخرها لين يصير فيها مجال.
 * هذا أفضل من "3 محاولات ثم إلغاء" لأنه ما يفقد رسائل بصمت وقت الزحام.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SendQueue {
  /**
   * @param {import('./redisSendGate').RedisSendGate} gate
   * @param {string} accountKey - معرف الحساب (نستخدم الإيميل عادة)
   * @param {object} opts
   * @param {number} opts.pollMs - كل قد إيش نعيد فحص توفر تذكرة إرسال (افتراضي 250ms)
   * @param {number} opts.maxQueueSize - أقصى عدد رسائل منتظرة قبل ما نسقط الأقدم (افتراضي 500)
   */
  constructor(gate, accountKey, opts = {}) {
    this.gate = gate;
    this.accountKey = accountKey;
    this.pollMs = opts.pollMs ?? 250;
    this.maxQueueSize = opts.maxQueueSize ?? 500;
    this.highQueue = [];
    this.normalQueue = [];
    this.processing = false;
  }

  get _totalLength() {
    return this.highQueue.length + this.normalQueue.length;
  }

  /** يضيف مهمة إرسال للطابور، ويرجع Promise يتحل لما فعليًا ترسل (أو ترمي نفس خطأ الإرسال) */
  enqueue(taskFn, priority = 'normal') {
    const targetQueue = priority === 'high' ? this.highQueue : this.normalQueue;
    return new Promise((resolve, reject) => {
      if (this._totalLength >= this.maxQueueSize) {
        // حماية أخيرة: لو الطابور تكدس بشكل غير طبيعي (مشكلة أعمق من rate-limit)
        // نرفض أقدم عنصر من قائمة الخلفية أولًا (نحافظ على الأولوية العالية)
        const overflowSource = this.normalQueue.length ? this.normalQueue : this.highQueue;
        const dropped = overflowSource.shift();
        if (dropped) dropped.reject(new Error('send_queue_overflow'));
      }
      targetQueue.push({ taskFn, resolve, reject });
      this._drain();
    });
  }

  async _drain() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this._totalLength) {
        // ننتظر لين تتوفر تذكرة إرسال (مشتركة عبر Redis). لو Redis نفسه
        // تعطل لحظيًا (انقطاع شبكة، إعادة تشغيل الحاوية...) لا نوقف
        // الطابور نهائيًا — نعتبرها "ما توفرت تذكرة بعد" ونعيد المحاولة.
        // بدون هذا try/catch، أي خطأ هنا كان يفلت من الحلقة ويخلي
        // processing عالقة true للأبد → الطابور يتوقف نهائيًا حتى لو
        // Redis رجع يشتغل بعدها بثانية.
        // eslint-disable-next-line no-await-in-loop
        let acquired = false;
        while (!acquired) {
          try {
            // eslint-disable-next-line no-await-in-loop
            acquired = await this.gate.tryAcquire(this.accountKey);
          } catch (err) {
            console.error('[sendQueue] tryAcquire failed, retrying:', err?.message || err);
            acquired = false;
          }
          if (!acquired) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(this.pollMs);
          }
        }
        // الأولوية العالية (ردود الأوامر) دائمًا تُسحب أول، مهما كان
        // ترتيب دخولها الزمني مقارنة بمهام الخلفية المنتظرة
        const nextQueue = this.highQueue.length ? this.highQueue : this.normalQueue;
        const { taskFn, resolve, reject } = nextQueue.shift();
        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await taskFn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }
    } finally {
      // يضمن إن الطابور يقدر يشتغل مرة ثانية حتى لو صار خطأ غير متوقع
      // بأي مكان أعلى — أهم سطر بكل الملف
      this.processing = false;
    }
  }
}
