import Default from "./default.js";
import Help from "./help.js";
import Start from "./start.js";
import Stop from "./stop.js";
import Admin from "./admin/index.js";
import Last from "./last.js";

const Commands = [Start, Stop, Last, Help, Admin];

Default.children = Commands;

export default Default;
