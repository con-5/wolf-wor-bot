import khwater from "../models/khwater.js";
import Group from "../models/group.js";

const Groups = new Map();
let api = null;

const addKhwater = async (text) => {
  let newKhwater = await khwater.create({ text });
  return newKhwater;
};

const showKhwater = async (id) => {
  let results = await khwater.findOne({ kid: id }).exec();
  return results;
};

const deleteKhwater = async (id) => {
  let results = await khwater.findOneAndDelete({ kid: id }).exec();
  return results;
};

const randomKhwater = async () => {
  let results = await khwater.aggregate([{ $sample: { size: 1 } }]).exec();
  //console.log(results);
  return results[0];
};

const sendRandomKhwaterToGroup = async (gid, urgent = false) => {
  try {
    let k = await randomKhwater();
    if (!k) {
      // ما فيه خواطر بالجدول أصلاً — لا ترسل شي فاضي (سبب محتمل لـ 400)
      console.warn(`[khwater] no khwater available to send to group ${gid}`);
      return;
    }
    await updateLast(gid, k.kid);
    // urgent=true (أمر يدوي من مستخدم ينتظر الرد الآن) يتخطى طابور
    // الإرسال التلقائي المجدول، لكن يبقى محميًا بنفس حد Redis من 429.
    // urgent=false (النداء التلقائي من setInterval) يمر بالطابور العادي.
    return urgent
      ? await api.messaging.sendGroupMessageUrgent(gid, k.text)
      : await api.messaging.sendGroupMessage(gid, k.text);
  } catch (err) {
    // مهم: بدون هذا try/catch، أي خطأ هنا (حتى بعد إضافة Redis guard)
    // يطلع كـ unhandled rejection من داخل setInterval ويقدر يوقف العملية كاملة
    console.error(`[khwater] failed to send to group ${gid}:`, err?.message || err);
  }
};
const startAllAuto = async (bot) => {
  api = bot;
  let groups = await Group.find({ auto: true }).exec();
  if (groups.length <= 0) {
    return;
  }
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    await startGroupAuto(g.gid, g.duration);
  }
};
const startGroupAuto = async (gid, duration) => {
  const isAuto = await isGroupHaveAuto(gid);
  if (Groups.has(gid)) {
    let g = Groups.get(gid);
    clearInterval(g.autoID);
  }
  let autoID = setInterval(sendRandomKhwaterToGroup, duration * 60 * 1000, gid);
  Groups.set(gid, { duration, autoID });
  await Group.findOneAndUpdate(
    { gid },
    { auto: true, duration },
    { upsert: true }
  ).exec();
  return true;
};
const stopAuto = async (gid) => {
  const isAuto = await isGroupHaveAuto(gid);
  if (!isAuto) return false;
  let g = Groups.get(gid);
  clearInterval(g.autoID);
  await Group.findOneAndUpdate(
    { gid },
    { auto: false },
    { upsert: true }
  ).exec();
  return true;
};

const updateLast = async (gid, kid) => {
  let group = await Group.findOne({ gid }).exec();
  group = addLastToArray(group?.lastK ?? [], kid);
  await Group.findOneAndUpdate(
    { gid },
    { lastK: group },
    { upsert: true }
  ).exec();
};

const getLast = async (gid) => {
  let group = await Group.findOne({ gid }).exec();
  if (!group) {
    return false;
  }
  return group.lastK;
};

const addLastToArray = (arr = [], lastID) => {
  if (arr.length < 10) {
    arr.push(lastID);
    return arr;
  }
  arr.shift();
  arr.push(lastID);
  return arr;
};

const isGroupHaveAuto = async (gid) => {
  const group = await Group.findOne({ gid });
  if (!group) return false;
  return group.auto;
};

export {
  addKhwater,
  showKhwater,
  deleteKhwater,
  sendRandomKhwaterToGroup,
  startAllAuto,
  startGroupAuto,
  stopAuto,
  getLast,
};
