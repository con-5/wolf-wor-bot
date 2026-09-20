import { Command } from "wolf.js";
import { api } from "../bot.js";
import { sendRandomKhwaterToGroup } from "../khwater/index.js";

const COMMAND_TRIGGER = "command_default";

const Default = async (api, command) => {
  // urgent=true: أمر يدوي، المستخدم ينتظر الرد الآن — يتخطى طابور
  // الإرسال التلقائي المجدول (لكن يبقى محميًا من 429 عبر Redis)
  let k = await sendRandomKhwaterToGroup(command.targetGroupId, true);
};

export default new Command(COMMAND_TRIGGER, {
  both: (command) => Default(api, command),
});
