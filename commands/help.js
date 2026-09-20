import { Command } from "wolf.js";
import { api } from "../bot.js";

const COMMAND_TRIGGER = "command_help";
const COMMAND_RESPONSE = "message_help";

const Help = async (api, command) => {
  await api
    .messaging
    .sendMessage(
      command,
      api
        .phrase
        .getByLanguageAndName(command.language, COMMAND_RESPONSE)
        .join("\n")
    );
};

export default new Command(COMMAND_TRIGGER, {
  both: (command) => Help(api, command),
});
