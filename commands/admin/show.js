import { Command, Validator } from "wolf.js";
import { showKhwater } from "../../khwater/index.js";
import { api } from "../../bot.js";

const COMMAND_TRIGGER = "command_admin_show";
const SHOW_FAIL = "message_show_fail";
const SHOW_ERROR = "error_kid_must_be_number";

const AdminShow = async (api, command) => {
  const isDeveloper = command.sourceSubscriberId === api.options.developerId;
  const isAdminGroup = command.targetGroupId === 81784118;
  if (!isDeveloper && !isAdminGroup) {
    return;
  }
  if (!Validator.isValidNumber(command.argument)) {
    return await sendMessage(api, command, SHOW_ERROR);
  }
  let id = api.utility.number.toEnglishNumbers(command.argument);
  let khwater = await showKhwater(id);
  if (khwater) {
    return await api.messaging.sendMessage(command, khwater.text);
  }
  return await sendMessage(api, command, SHOW_FAIL);
};

const sendMessage = async (api, command, phrase) => {
  await api
    .messaging
    .sendMessage(
      command,
      api.phrase.getByLanguageAndName(command.language, phrase)
    );
};

export default new Command(COMMAND_TRIGGER, {
  both: (command) => AdminShow(api, command),
});
