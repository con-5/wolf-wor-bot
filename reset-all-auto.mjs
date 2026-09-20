import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(
  `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PWD}@127.0.0.1/${process.env.MONGO_DB_NAME}`
);

const Group = mongoose.model("Group", new mongoose.Schema({}, { strict: false }));

const before = await Group.countDocuments({ auto: true });
const result = await Group.updateMany({ auto: true }, { $set: { auto: false } });

console.log(`كانت مفعّلة قبل: ${before} قناة`);
console.log(`تم إيقاف: ${result.modifiedCount} قناة`);
console.log("لازم تعيد تشغيل كل البوتات الخمسة الآن (pm2 restart all) عشان تمسح الجدولة من الذاكرة.");

await mongoose.disconnect();
process.exit(0);