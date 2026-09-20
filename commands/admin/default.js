import { Command } from "wolf.js";
import { api } from "../../bot.js";

const COMMAND_TRIGGER = "command_admin";
const COMMAND_RESPONSE = "message_admin";

const AdminDefault = async (api, command) => {
  const isDeveloper = command.sourceSubscriberId === api.options.developerId;
  if (!isDeveloper) {
    return;
  }
  await api
    .messaging
    .sendMessage(
      command,
      api.phrase.getByLanguageAndName(command.language, COMMAND_RESPONSE)
    );
};

export default new Command(COMMAND_TRIGGER, {
  both: (command) => AdminDefault(api, command),
});
