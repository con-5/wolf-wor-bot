import { Command } from "wolf.js";
import { api } from "../bot.js";
import { stopAuto } from "../khwater/index.js";

const COMMAND_TRIGGER = "command_stop";

const Stop = async (api, command) => {
  let res = await stopAuto(command.targetGroupId);
  if (!res) {
    return await api
      .messaging
      .sendMessage(
        command,
        api
          .phrase
          .getByLanguageAndName(command.language, "message_stop_error")
      );
  }
  return await api
    .messaging
    .sendMessage(
      command,
      api.phrase.getByLanguageAndName(command.language, "message_stop")
    );
};

export default new Command(COMMAND_TRIGGER, {
  both: (command) => Stop(api, command),
});
