import Vue from "vue"
import VueRouter from "vue-router"
import VueI18n, { LocaleMessageObject, Path, Locale } from "vue-i18n"
import BootstrapVue from "bootstrap-vue"

import Login from "@/components/Login.vue"
import Navigator from "@/components/Navigator.vue"
import RootUserView from "@/components/RootUserView.vue"
import App from "@/App.vue"

import * as Store from "@/state/store"
// XXX: should be kept in sync with RootState type in in store.ts!
import "@/state/auth"
import "@/state/main_menu"
import "@/state/settings"
import "@/state/user_view"

import { CurrentAuth } from "@/state/auth"

import "bootstrap/dist/css/bootstrap.css"
import "bootstrap-vue/dist/bootstrap-vue.css"
import "@/styles/style.sass"

Vue.use(VueRouter)
Vue.use(VueI18n)
Vue.use(BootstrapVue)

const routes = [
    { path: "/", name: "navigator", component: Navigator },
    { path: "/views/:name", name: "view", component: RootUserView },
    { path: "/views/:name/new", name: "view_create", component: RootUserView },
    { path: "/login", name: "login", component: Login, meta: { isLogin: true } },
    { path: "*", redirect: { name: "navigator" } },
]

const router = new VueRouter({
    mode: "history",
    routes,
})

const i18n = new VueI18n({
    locale: navigator.language,
    fallbackLocale: "en-US",
})

if (localStorage.getItem("authToken") !== null) {
    Store.store.commit("auth/setAuth", new CurrentAuth(localStorage.getItem("authToken") as string))
    Store.store.dispatch("auth/renewAuth")
}
Store.store.subscribe((mutation, state) => {
    if (mutation.type === "auth/removeAuth") {
        localStorage.removeItem("authToken")
    } else if (mutation.type === "auth/setAuth") {
        localStorage.setItem("authToken", (Store.store.state.auth.current as CurrentAuth).token)
    }
})

if (Store.store.state.auth.current === null) {
    router.push({
        name: "login",
        query: { redirect: router.currentRoute.fullPath },
    })
}
Store.store.subscribe((mutation, state) => {
    if (mutation.type === "auth/removeAuth") {
        router.push({
            name: "login",
            query: { redirect: router.currentRoute.fullPath },
        })
    }
})
router.beforeResolve((to, from, next) => {
    const isLogin = to.matched.some(record => record.meta.isLogin)
    if (!isLogin && Store.store.state.auth.current === null) {
        next({
            name: "login",
            query: { redirect: to.fullPath },
        })
    } else if (isLogin && Store.store.state.auth.current !== null) {
        let nextUrl
        const redirect = to.query.redirect
        if (redirect !== undefined) {
            nextUrl = Array.isArray(redirect) ? redirect[0] : redirect
        } else {
            nextUrl = "/"
        }
        next(nextUrl)
    } else {
        next()
    }
})

const app = new Vue({
    router, i18n, store: Store.store,
    render: f => f(App),
}).$mount("#app")