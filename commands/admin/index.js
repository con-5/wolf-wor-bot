import Add from "./add.js";
import Delete from "./delete.js";
import Help from "./help.js";
import Show from "./show.js";
import Join from "./join.js";
import Update from "./update.js";
import Default from "./default.js";
import Refresh from "./refresh.js";
import Count from "./count.js";
import ContactAdd from "./contactAdd.js";

const Commands = [Add, Delete, Show, Join, Help, Refresh, Update, Count, ContactAdd];

Default.children = Commands;

export default Default;
