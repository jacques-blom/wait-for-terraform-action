import axios, { AxiosError, AxiosRequestConfig, Method } from "axios"
import { stdout } from "process"

const TF_API_BASE = "https://app.terraform.io"

const getLatestRun = async ({
    organization,
    workspace,
    token,
}: {
    organization: string
    workspace: string
    token: string
}) => {
    const workspaceData = await tfAPICall<any>(
        token,
        `/api/v2/organizations/${organization}/workspaces/${workspace}`
    )

    const latestRun = workspaceData?.relationships?.["latest-run"]
    if (!latestRun) {
        console.warn(`No runs associated with workspace '${workspace}'`)
        return
    }

    const latestRunData = await tfAPICall<any>(token, latestRun.links.related)
    return latestRunData
}

export const wait = async ({
    organization,
    workspaces,
    token,
    waitForApply = false,
}: {
    organization: string
    workspaces: string
    token: string
    waitForApply?: boolean
}) => {
    const workspacesArray = workspaces
        .split(",")
        .map((workspace) => workspace.trim())

    await runUntilTrue(async () => {
        const statuses: {
            workspace: string
            status: string
            done: boolean
            userAction?: boolean
        }[] = []

        for (const workspace of workspacesArray) {
            const latestRun = await getLatestRun({
                organization,
                token,
                workspace,
            })

            const status = latestRun.attributes.status

            const url = `https://app.terraform.io/app/${organization}/workspaces/${workspace}/runs/${latestRun.id}`

            if (!latestRun) continue

            if (status === "errored") {
                throw new Error(
                    `Latest Terraform run failed for '${workspace}'\n View at: ${url}`
                )
            }

            if (status === "planning" || status === "plan_queued") {
                statuses.push({
                    workspace,
                    status,
                    done: false,
                })
                continue
            }

            if (waitForApply && latestRun["plan-only"] !== true) {
                if (status === "planned") {
                    if (latestRun["auto-apply"] !== true) {
                        statuses.push({
                            workspace,
                            status: `${status} (⚠️ waiting for you to run apply at ${url})`,
                            done: false,
                            userAction: true,
                        })

                        continue
                    }

                    statuses.push({
                        workspace,
                        status,
                        done: false,
                    })

                    continue
                }

                if (status === "applying" || status === "apply_queued") {
                    statuses.push({
                        workspace,
                        status,
                        done: false,
                    })

                    continue
                }
            }

            statuses.push({
                workspace,
                status,
                done: true,
            })
        }

        statuses.sort((a, b) => {
            return a.done === b.done ? 0 : a.done ? -1 : 1
        })

        const busyCount = statuses.filter((s) => !s.done).length

        if (busyCount > 0) {
            console.log("")
            console.log("Waiting for the following workspaces:")
            for (const status of statuses) {
                console.log(`• ${status.workspace}: ${status.status}`)
            }
        } else {
            return true
        }
    })

    console.log("All Terraform workspaces are ready!")
}

const runUntilTrue = async (run: () => Promise<unknown>, delay = 1000) => {
    const result = await run()

    if (!result) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        await runUntilTrue(run, delay)
    }
}

async function tfAPICall<T = unknown>(
    token: string,
    path: string,
    config?: AxiosRequestConfig
): Promise<T> {
    const { data } = await axios(TF_API_BASE + path, {
        ...config,
        headers: {
            ...config?.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/vnd.api+json",
        },
    }).catch(catchAxiosError)

    return data.data
}

const catchAxiosError = (error: AxiosError) => {
    if (error.response?.status === 401) {
        throw new Error(
            "401 - Unauthorized. Please make sure the token is correct."
        )
    } else if (error.response?.status === 404) {
        throw new Error(
            "Could not find your workspace. Please make sure the organization, workspace names are correct."
        )
    } else {
        throw error
    }
}
