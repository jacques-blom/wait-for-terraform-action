import { wait } from "./wait"

wait({
    organization: process.env.ORGANIZATION!,
    workspaces: process.env.WORKSPACES!,
    token: process.env.TOKEN!,
    waitForApply: Boolean(process.env.WAIT_FOR_APPLY ?? "false"),
}).catch(console.error)
