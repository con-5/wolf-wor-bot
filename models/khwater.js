import mongoose from "mongoose";
const Schema = mongoose.Schema;

const KhwaterSchema = new Schema({
  kid: { type: Number, unique: true },
  text: { type: String },
});

KhwaterSchema.pre("save", async function (next) {
  if (this.isNew) {
    let total = await khwater.find().sort({ kid: -1 }).limit(1);
    this.kid = total.length === 0 ? 1 : Number(total[0].kid) + 1;
    next();
  }
});

const khwater = mongoose.model("khwater", KhwaterSchema);

export default khwater;
