import { Command } from "wolf.js";
import { api } from "../../bot.js";
import { admins } from "../../data/admin.js";

const COMMAND_TRIGGER = "command_admin_update";
const COMMAND_RESPONSE = "admin_update_message";

const UpdateStatus = async (api, command) => {
  const isDeveloper = command.sourceSubscriberId === api.options.developerId;
  const isAdmin = admins.includes(command.sourceSubscriberId);
  const ok = isDeveloper || isAdmin;
  if (!ok) {
    return;
  }
  const status = command.argument;
  await api.update({ status });
  let phrase = api.phrase.getByCommandAndName(command, COMMAND_RESPONSE);
  let content = api.utility.string.replace(phrase, { status });
  return await api.messaging.sendMessage(command, content);
};

export default new Command(COMMAND_TRIGGER, {
  group: (command) => UpdateStatus(api, command),
});
