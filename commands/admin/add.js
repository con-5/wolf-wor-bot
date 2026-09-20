import { Command } from "wolf.js";
import { addKhwater } from "../../khwater/index.js";
import { api } from "../../bot.js";

const COMMAND_TRIGGER = "command_admin_add";
const ADD_SUCCESS = "message_add_success";
const ADD_FAIL = "command_add_fail";
const ADD_ERROR = "error_text_between_15_and_255";

const AdminAdd = async (api, command) => {
  const isDeveloper = command.sourceSubscriberId === api.options.developerId;
  const isAdminGroup = command.targetGroupId === 81784118;
  if (!isDeveloper && !isAdminGroup) {
    return;
  }
  let text = command.argument;
  if (!(text.length >= 10 && text.length <= 255)) {
    return await sendMessage(api, command, ADD_ERROR);
  }
  let khwater = await addKhwater(text);
  if (khwater) {
    return await sendMessage(api, command, ADD_SUCCESS);
  }
  return await sendMessage(api, command, ADD_FAIL);
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
  both: (command) => AdminAdd(api, command),
});
