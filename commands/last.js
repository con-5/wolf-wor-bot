import { Command } from "wolf.js";
import { api } from "../bot.js";
import { getLast } from "../khwater/index.js";

const COMMAND_TRIGGER = "command_last";

const Last = async (api, command) => {
  let last = await getLast(command.targetGroupId);
  if (!last) {
    return await api
      .messaging
      .sendMessage(
        command,
        api
          .phrase
          .getByLanguageAndName(command.language, "message_last_error")
      );
  }

  let phrase = api
    .phrase
    .getByLanguageAndName(command.language, "message_last");
  let text = api
    .utility
    .string
    .replace(phrase, { list: last.join("\n") });
  await api.messaging.sendMessage(command, text);
};

export default new Command(COMMAND_TRIGGER, {
  both: (command) => Last(api, command),
});
