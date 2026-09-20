import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(
  `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PWD}@127.0.0.1/${process.env.MONGO_DB_NAME}`
);

const Group = mongoose.model("Group", new mongoose.Schema({}, { strict: false }));

const total = await Group.countDocuments({});
const autoOn = await Group.countDocuments({ auto: true });
const byDuration = await Group.aggregate([
  { $match: { auto: true } },
  { $group: { _id: "$duration", count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]);

console.log("إجمالي القنوات المسجلة:", total);
console.log("القنوات المفعّل فيها auto:", autoOn);
console.log("توزيعها حسب المدة (دقايق):");
byDuration.forEach((d) => console.log(`  ${d._id} دقيقة → ${d.count} قناة`));

await mongoose.disconnect();
process.exit(0);