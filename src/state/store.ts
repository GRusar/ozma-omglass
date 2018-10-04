import Vue from 'vue'
import Vuex from 'vuex'

import * as Utils from "../utils"
import AuthState from "./auth"
import MainMenuState from "./main_menu"
import UserViewState from "./user_view"

interface RootState {
    auth: AuthState
    mainMenu: MainMenuState
    userView: UserViewState
}

Vue.use(Vuex)

export const store = new Vuex.Store<RootState>({
    strict: !Utils.isProduction,
})

const recurseRemoveAuth = (rootState: any, message: string): void => {
    for (const key in rootState.modules) {
        const state = rootState.modules[key]
        state.commit('removeAuth', message)
        recurseRemoveAuth(state, message)
    }
}

export const callSecretApi = async (apiFunc: ((_1: string, ..._2: any[]) => Promise<any>), ...args: any[]): Promise<any> => {
    if (store.state.auth.current === null) {
        throw new Error("No authentication token to renew")
    }

    try {
        return await apiFunc(store.state.auth.current.token, ...args)
    } catch (e) {
        if (e instanceof Utils.FetchError) {
            if (e.response.status == 401) {
                recurseRemoveAuth(store.state, e.message)
            }
        }
        throw e
    }
}
