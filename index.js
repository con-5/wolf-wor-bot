import { api } from "./bot.js";
import commands from "./commands/index.js";
api.commandHandler.register([commands]);
