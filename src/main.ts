import * as core from "@actions/core"
import { wait } from "./wait"

const run = async () => {
    const organization = core.getInput("organization")
    const workspaces = core.getInput("workspaces")
    const token = core.getInput("token")
    const waitForApply = core.getInput("waitForApply") === "true"

    await wait({
        organization,
        workspaces,
        token,
        waitForApply,
    })
}

run().catch((error) => {
    core.setFailed(error.message)
})
