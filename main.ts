import core from "@actions/core"
import github from "@actions/github"

try {
    const workspaces = core.getInput("workspaces")
    console.log(`workspaces to check: ${workspaces}!`)

    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`)
} catch (error) {
    core.setFailed(error.message)
}
