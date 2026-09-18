/**
 * redisSendGate.js
 * -----------------
 * حل مبني على Redis لمشكلة 400 / 403 / 429 اللي تجيك من WOLF عند الإرسال.
 *
 * ليش Redis؟
 *  - عندك 4 حسابات مفلّقة. لو الحد محسوب بمتغير JS عادي (in-memory) فهو
 *    منفصل لكل عملية، وما يمنع تجاوز الحد الفعلي عند WOLF. Redis يخلي
 *    الحد محسوب بمصدر واحد مشترك.
 *  - سبب رئيسي محتمل لـ 429 عندك بالذات: `khwater/index.js` يسوي
 *    `setInterval` منفصل لكل قناة فيها auto مفعّل. لو عندك عشرات
 *    القنوات بنفس المدة (duration)، كلها تحاول ترسل بنفس اللحظة
 *    تقريبًا → burst ضخم من الطلبات بثانية وحدة. الحل هنا (مع
 *    sendQueue.js) يسوي "طابور" فعلي يرسل رسالة وحدة بالثانية
 *    (قابل للتعديل) مهما كان عدد القنوات اللي حاولت ترسل بنفس اللحظة.
 */

export class RedisSendGate {
  constructor(redis, opts = {}) {
    this.redis = redis;
    this.limit = opts.perAccountPerSecond ?? 1;
    this.silenceTtl = opts.silenceTtlSeconds ?? 300;
    this.prefix = opts.keyPrefix ?? 'khwater:gate';
  }

  _bucketKey(accountKey) {
    const second = Math.floor(Date.now() / 1000);
    return `${this.prefix}:rl:${accountKey}:${second}`;
  }

  _silenceKey(targetId) {
    return `${this.prefix}:silenced:${targetId}`;
  }

  _errorLogKey(accountKey) {
    return `${this.prefix}:errors:${accountKey}`;
  }

  /** يحاول يحجز تذكرة إرسال لهذا الحساب لهالثانية. true = مسموح ترسل الآن. */
  async tryAcquire(accountKey) {
    const key = this._bucketKey(accountKey);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 2);
    }
    return count <= this.limit;
  }

  async markSilenced(targetId) {
    await this.redis.set(this._silenceKey(targetId), '1', 'EX', this.silenceTtl);
  }

  async isSilenced(targetId) {
    if (targetId === undefined || targetId === null) return false;
    const val = await this.redis.get(this._silenceKey(targetId));
    return val === '1';
  }

  async clearSilenced(targetId) {
    await this.redis.del(this._silenceKey(targetId));
  }

  /** سجل خطأ إرسال (400/403/429) بشكل منظم، يحتفظ بآخر 500 خطأ لكل حساب */
  async logSendError(accountKey, { code, targetId, payloadPreview, message }) {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      code,
      targetId,
      message,
      payloadPreview: (payloadPreview || '').slice(0, 200),
    });
    const key = this._errorLogKey(accountKey);
    await this.redis.lpush(key, entry);
    await this.redis.ltrim(key, 0, 499);
  }

  async getRecentErrors(accountKey, count = 50) {
    const raw = await this.redis.lrange(this._errorLogKey(accountKey), 0, count - 1);
    return raw.map((r) => JSON.parse(r));
  }
}

