import { Module, ActionContext } from "vuex"
import uuidv4 from "uuid/v4"
import jwtDecode from "jwt-decode"

import { IRef } from "@/utils"
import * as Api from "@/api"
import * as Utils from "@/utils"
import { router } from "@/modules"

export class CurrentAuth {
    createdTime: number
    token: string
    refreshToken: string
    idToken: string
    decodedToken: any
    decodedRefreshToken: any
    decodedIdToken: any

    constructor(token: string, refreshToken: string, idToken: string, createdTime?: number) {
        this.createdTime = (createdTime !== undefined) ? createdTime : Utils.sse()
        this.token = token
        this.refreshToken = refreshToken
        this.idToken = idToken
        this.decodedToken = jwtDecode(this.token)
        this.decodedRefreshToken = jwtDecode(this.refreshToken)
        this.decodedIdToken = jwtDecode(this.idToken)
    }

    get username() {
        return this.decodedIdToken.preferred_username
    }

    get refreshValidFor(): number {
        return this.decodedRefreshToken.exp - this.decodedRefreshToken.iat
    }

    get validFor(): number {
        return this.decodedToken.exp - this.decodedToken.iat
    }

    get session(): string {
        return this.decodedToken.session_state
    }
}

export interface IAuthState {
    current: CurrentAuth | null
    lastError: string | null
    renewalTimeoutId: NodeJS.Timeout | null
    checkTimeoutId: NodeJS.Timeout | null
    pending: Promise<CurrentAuth> | null
}

interface IOIDCState {
    path: string
    nonce: string
}

interface IAuthPersistedState {
    token: string
    refreshToken: string
    idToken: string
    createdTime: number
}

const checkTimeout = 5000

const authKey = "auth"
const authNonceKey = "authNonce"

const createKeycloakIframe = () => {
    const ifr = document.createElement("iframe")
    ifr.setAttribute("src", `${Api.authUrl}/login-status-iframe.html`)
    ifr.setAttribute("title", "keycloak-session-iframe")
    ifr.style.display = "none"
    return ifr
}

// We create it immediately so it loads faster.
const iframe = createKeycloakIframe()
document.body.appendChild(iframe)
const iframeLoaded = Utils.waitForElement(iframe)

const redirectUri = () => {
    const returnPath = router.resolve({ name: "auth_response" }).href
    return `${window.location.protocol}//${window.location.host}${returnPath}`
}

const persistCurrentAuth = (auth: CurrentAuth) => {
    const dump: IAuthPersistedState = {
        token: auth.token,
        refreshToken: auth.refreshToken,
        idToken: auth.idToken,
        createdTime: auth.createdTime,
    }
    localStorage.setItem(authKey, JSON.stringify(dump))
}

const dropCurrentAuth = () => {
    localStorage.removeItem(authKey)
}

const loadCurrentAuth = () => {
    const dumpStr = localStorage.getItem(authKey)

    if (dumpStr !== null) {
        const dump = JSON.parse(dumpStr)
        const auth = new CurrentAuth(dump.token, dump.refreshToken, dump.idToken, dump.createdTime)
        const timestamp = Utils.sse()
        if (auth.createdTime + auth.refreshValidFor > timestamp) {
            return auth
        } else {
            return null
        }
    } else {
        return null
    }
}

const getToken = (context: ActionContext<IAuthState, {}>, params: Record<string, string>) => {
    const { state, commit, dispatch } = context
    const pending: IRef<Promise<CurrentAuth>> = {}
    pending.ref = (async () => {
        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/x-www-form-urlencoded",
            }

            if (Api.authClientSecret === undefined) {
                params.client_id = Api.authClientId
            } else {
                const basicAuth = `${Api.authClientId}:${Api.authClientSecret}`
                headers.Authorization = `Basic ${btoa(basicAuth)}`
            }
            const paramsString = new URLSearchParams(params).toString()

            const ret = await Utils.fetchJson(`${Api.authUrl}/token`, {
                method: "POST",
                headers,
                body: paramsString,
            })
            if (state.pending !== pending.ref) {
                throw Error("Pending operation cancelled")
            }
            const auth = new CurrentAuth(ret.access_token, ret.refresh_token, ret.id_token)
            updateAuth(context, auth)
            startTimeouts(context)
            return auth
        } catch (e) {
            if (state.pending === pending.ref) {
                dispatch("removeAuth", undefined, { root: true })
                commit("setError", e.message)
            }
            throw e
        }
    })()
    commit("setPending", pending.ref)
    return pending.ref
}

const updateAuth = ({ state, commit, dispatch }: ActionContext<IAuthState, {}>, auth: CurrentAuth) => {
    const oldAuth = state.current
    commit("setAuth", auth)
    persistCurrentAuth(auth)
    if (oldAuth === null) {
        dispatch("setAuth", undefined, { root: true })
    }
}

// May be a performance hog -- perhaps disable later.
const startCheckTimeout = ({ state, commit }: ActionContext<IAuthState, {}>) => {
    if (state.checkTimeoutId !== null) {
        clearTimeout(state.checkTimeoutId)
    }

    const checkTimeoutId = setTimeout(async () => {
        commit("setCheckTimeout", null)
        await iframeLoaded
        if (state.pending === null && state.current !== null && iframe.contentWindow !== null) {
            const msg = `${Api.authClientId} ${state.current.session}`
            iframe.contentWindow.postMessage(msg, Api.authOrigin)
        }
    }, checkTimeout)
    commit("setCheckTimeout", checkTimeoutId)
}

const startTimeouts = (context: ActionContext<IAuthState, {}>) => {
    const { state, commit, dispatch } = context
    if (state.current === null) {
        throw new Error("Cannot start timeouts with no tokens")
    }

    const constantFactor = 0.6
    const validFor = state.current.validFor
    // Random timeouts for different tabs not to overload the server.
    const timeout = (validFor * constantFactor + Math.random() * validFor * (1 - 1.1 * constantFactor)) * 1000

    if (state.renewalTimeoutId !== null) {
        clearTimeout(state.renewalTimeoutId)
    }
    const renewalTimeoutId = setTimeout(() => {
        if (state.pending === null) {
            dispatch("renewAuth")
        } else {
            commit("setRenewalTimeout", null)
        }
    }, timeout)
    commit("setRenewalTimeout", renewalTimeoutId)

    startCheckTimeout(context)
}

export const authModule: Module<IAuthState, {}> = {
    namespaced: true,
    state: {
        current: null,
        pending: null,
        lastError: null,
        renewalTimeoutId: null,
        checkTimeoutId: null,
    },
    mutations: {
        setError: (state, lastError: string) => {
            state.lastError = lastError
            state.pending = null
        },
        clearError: state => {
            state.lastError = null
        },
        setAuth: (state, auth: CurrentAuth) => {
            state.current = auth
            state.lastError = null
            state.pending = null
        },
        setRenewalTimeout: (state, renewalTimeoutId: NodeJS.Timeout | null) => {
            state.renewalTimeoutId = renewalTimeoutId
        },
        setCheckTimeout: (state, checkTimeoutId: NodeJS.Timeout | null) => {
            state.checkTimeoutId = checkTimeoutId
        },
        clearAuth: state => {
            state.current = null
            state.renewalTimeoutId = null
            state.pending = null
        },
        setPending: (state, pending: Promise<CurrentAuth>) => {
            state.pending = pending
        },
    },
    actions: {
        removeAuth: {
            root: true,
            handler: ({ state, commit }) => {
                if (state.renewalTimeoutId !== null) {
                    clearTimeout(state.renewalTimeoutId)
                }
                if (state.checkTimeoutId !== null) {
                    clearTimeout(state.checkTimeoutId)
                }
                if (state.current !== null) {
                    commit("clearAuth")
                    dropCurrentAuth()
                }
            },
        },
        setAuth: {
            root: true,
            handler: () => { return },
        },
        startAuth: context => {
            const { state, commit, dispatch } = context

            let tryExisting = true
            if (router.currentRoute.name === "auth_response") {
                dropCurrentAuth()
                tryExisting = false

                const urlParams = new URLSearchParams(window.location.search)
                const stateString = urlParams.get("state")
                if (stateString !== null) {
                    const savedState: IOIDCState = JSON.parse(atob(stateString))
                    const nonce = localStorage.getItem(authNonceKey)
                    if (nonce === null || savedState.nonce !== nonce) {
                        commit("setError", "Invalid client nonce")
                    } else {
                        router.push(savedState.path)
                        const code = urlParams.get("code")
                        if (code !== null) {
                            const params: Record<string, string> = {
                                grant_type: "authorization_code",
                                code,
                                redirect_uri: redirectUri(),
                            }
                            getToken(context, params)
                        } else {
                            const error = urlParams.get("error")
                            const errorDescription = urlParams.get("errorDescription")
                            commit("setError", `Invalid auth response query parameters, error ${error} ${errorDescription}`)
                        }
                    }
                } else {
                    // We get here is redirected from logout.
                    router.push({ name: "main" })
                }
            } else {
                const oldAuth = loadCurrentAuth()
                if (oldAuth !== null) {
                    updateAuth(context, oldAuth)
                    dispatch("renewAuth")
                }
            }
            localStorage.removeItem(authNonceKey)

            const authStorageHandler = (e: StorageEvent) => {
                if (e.key !== authKey) {
                    return
                }

                if (e.newValue === null) {
                    dispatch("removeAuth", undefined, { root: true })
                } else {
                    const newAuth = loadCurrentAuth()
                    if (newAuth !== null && (state.current === null || newAuth.token !== state.current.token)) {
                        updateAuth(context, newAuth)
                        startTimeouts(context)
                    }
                }
            }
            window.addEventListener("storage", authStorageHandler)

            const iframeHandler = (e: MessageEvent) => {
                if (e.origin !== Api.authOrigin || e.source !== iframe.contentWindow) {
                    return
                }
                const reply = e.data

                if (reply === "unchanged") {
                    if (state.current !== null) {
                        startCheckTimeout(context)
                    }
                } else if (reply === "changed") {
                    dispatch("removeAuth", undefined, { root: true })
                } else if (reply === "error") {
                    dispatch("removeAuth", undefined, { root: true })
                    commit("setError", "Received an error during authorization check")
                }
            }
            window.addEventListener("message", iframeHandler)

            if (state.current === null && state.pending === null) {
                return dispatch("requestLogin", tryExisting)
            } else if (state.pending !== null) {
                return state.pending
            }
        },
        requestLogin: ({ state, commit }, tryExisting: boolean) => {
            const redirectParams = new URLSearchParams({ url: window.location.href })
            const nonce = uuidv4()
            localStorage.setItem(authNonceKey, nonce)
            const savedState: IOIDCState = {
                nonce,
                path: router.currentRoute.fullPath,
            }
            const params = {
                client_id: Api.authClientId,
                redirect_uri: redirectUri(),
                state: btoa(JSON.stringify(savedState)),
                scope: "openid",
                response_mode: "query",
                response_type: "code",
                prompt: tryExisting ? "none" : "login",
            }
            const paramsString = new URLSearchParams(params).toString()

            window.location.href = `${Api.authUrl}/auth?${paramsString}`
            const waitForLoad = new Promise((resolve, reject) => {
                addEventListener("load", () => {
                    reject()
                })
            })
            commit("setPending", waitForLoad)
            return waitForLoad
        },
        callProtectedApi: {
            root: true,
            handler: async ({ state, commit, dispatch }, { func, args }: { func: ((_1: string, ..._2: any[]) => Promise<any>), args?: any[] }): Promise<any> => {
                if (state.current === null) {
                    if (state.pending !== null) {
                        await state.pending
                    }
                    if (state.current === null) {
                        throw new Error("No authentication token")
                    }
                }

                try {
                    const argsArray = args === undefined ? [] : args
                    return await func(state.current.token, ...argsArray)
                } catch (e) {
                    if (e instanceof Utils.FetchError) {
                        if (e.response.status === 401) {
                            dispatch("removeAuth", undefined, { root: true })
                            commit("setError", e.message)
                        }
                    }
                    throw e
                }
            },
        },
        renewAuth: async context => {
            const { commit, state } = context
            if (state.current === null) {
                throw Error("Cannot renew without an existing token")
            }

            if (state.renewalTimeoutId !== null) {
                clearTimeout(state.renewalTimeoutId)
                commit("setRenewalTimeout", null)
            }
            if (state.checkTimeoutId !== null) {
                clearTimeout(state.checkTimeoutId)
                commit("setCheckTimeout", null)
            }

            const params: Record<string, string> = {
                grant_type: "refresh_token",
                refresh_token: state.current.refreshToken,
            }
            return getToken(context, params)
        },
        logout: async ({ state, dispatch, commit }) => {
            if (state.current === null) {
                throw Error("Cannot logout without an existing token")
            }

            const params = {
                redirect_uri: redirectUri(),
            }
            const paramsString = new URLSearchParams(params).toString()
            dropCurrentAuth()
            window.location.href = `${Api.authUrl}/logout?${paramsString}`
            const waitForLoad = new Promise((resolve, reject) => {
                addEventListener("load", () => {
                    reject()
                })
            })
            commit("setPending", waitForLoad)
            return waitForLoad
        },
    },
}

export default authModule
