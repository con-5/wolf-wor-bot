import { Command } from "wolf.js";
import { api } from "../../bot.js";

const COMMAND_TRIGGER = "command_admin_count";
const COMMAND_RESPONSE = "admin_count_message";

const AdminCount = async (api, command) => {
  const isDeveloper = command.sourceSubscriberId === api.options.developerId;
  const isAdminGroup = command.targetGroupId === 81784118;
  if (!isDeveloper && !isAdminGroup) {
    return;
  }
  let count = (await api.group.list()).length;
  let phrase = api.phrase.getByCommandAndName(command, COMMAND_RESPONSE);
  let content = api.utility.string.replace(phrase, { count });
  return await api.messaging.sendMessage(command, content);
};

export default new Command(COMMAND_TRIGGER, {
  group: (command) => AdminCount(api, command),
});
