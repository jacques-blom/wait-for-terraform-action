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
    return latestRunData?.attributes
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
    const workspacesArray = workspaces.split(",")

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

            if (!latestRun) continue

            if (latestRun.status === "errored") {
                throw new Error(
                    `Latest Terraform run failed for '${workspace}'`
                )
            }

            if (
                latestRun.status === "planning" ||
                latestRun.status === "plan_queued"
            ) {
                statuses.push({
                    workspace,
                    status: latestRun.status,
                    done: false,
                })
                continue
            }

            if (waitForApply && latestRun["plan-only"] !== true) {
                if (latestRun.status === "planned") {
                    if (latestRun["auto-apply"] !== true) {
                        statuses.push({
                            workspace,
                            status: `${latestRun.status} (⚠️ waiting for you to run apply)`,
                            done: false,
                            userAction: true,
                        })

                        continue
                    }

                    statuses.push({
                        workspace,
                        status: latestRun.status,
                        done: false,
                    })

                    continue
                }

                if (
                    latestRun.status === "applying" ||
                    latestRun.status === "apply_queued"
                ) {
                    statuses.push({
                        workspace,
                        status: latestRun.status,
                        done: false,
                    })

                    continue
                }
            }

            statuses.push({
                workspace,
                status: latestRun.status,
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
