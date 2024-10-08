import Vue from 'vue'

Vue.config.devtools = process.env['NODE_ENV'] !== 'production'
Vue.config.performance = process.env['NODE_ENV'] !== 'production'

import Vuex from 'vuex'
import mitt from 'mitt'
import TextareaAutosize from 'vue-textarea-autosize'

import * as Modules from '@/modules'
import { setHeadTitle, setHeadMeta } from '@/elements'

import UserView from '@/components/UserView.vue'
import OzmaLink from '@/components/OzmaLink'
import ButtonsPanel from '@/components/panels/ButtonsPanel.vue'
import ButtonGroup from '@/components/buttons/ButtonGroup.vue'
import FormControl from '@/components/FormControl.vue'
import { VueIsMobile } from '@/components'
import App from '@/App.vue'

import authModule from '@/state/auth'
import settingsModule from '@/state/settings'
import entitiesModule from '@/state/entities'
import entriesModule from '@/state/entries'
import stagingChangesModule from '@/state/staging_changes'
import queryModule from '@/state/query'
import errorsModule from '@/state/errors'
import reloadModule from '@/state/reload'
import windowsModule from '@/state/windows'
import translationsModule from '@/state/translations'

import '@/styles/style.scss'
import { IEmbeddedPageRef } from '@/api'

export interface IShowHelpModalArgs {
  // `null` when we don't store "page is read" state.
  key: string | null
  skipIfShown?: boolean
  ref: IEmbeddedPageRef
}

type Events = {
  ['show-readonly-demo-modal']?: string
  ['show-invite-user-modal']?: string
  ['show-help-modal']: IShowHelpModalArgs
  ['close-all-toasts']?: string
}

export const eventBus = mitt<Events>()

export const store = new Vuex.Store({
  // Big performance hog on dev!
  // strict: process.env["NODE_ENV"] !== "production",
  modules: {
    auth: authModule,
    settings: settingsModule,
    entities: entitiesModule,
    entries: entriesModule,
    staging: stagingChangesModule,
    query: queryModule,
    errors: errorsModule,
    reload: reloadModule,
    windows: windowsModule,
    translations: translationsModule,
  },
})

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
Vue.use(TextareaAutosize)
Vue.use(VueIsMobile)

Vue.component('UserView', UserView)
Vue.component('ButtonsPanel', ButtonsPanel)
Vue.component('ButtonGroup', ButtonGroup)
Vue.component('FormControl', FormControl)
Vue.component('OzmaLink', OzmaLink)

Vue.directive('visible', (el, bind) => {
  el.style.visibility = bind.value ? 'visible' : 'hidden'
})

Modules.router.beforeResolve((to, from, next) => {
  // Reset page title and meta tags
  const titleDefault = 'ozma.io — a low-code platform for CRM and ERP solutions'
  const descriptionDefault =
    'ozma.io — an enterprise-level CRM and ERP platform, less expensive than Salesforce and Microsoft, fully customizable by any developer in a few hours.'
  setHeadTitle('ozma.io — a low-code platform for CRM and ERP solutions')
  setHeadMeta('name', 'description', descriptionDefault)
  setHeadMeta('property', 'og:title', titleDefault)
  setHeadMeta('property', 'og:description', descriptionDefault)
  setHeadMeta('property', 'twitter:title', titleDefault)
  setHeadMeta('property', 'twitter:description', descriptionDefault)
  next()
})

export const app = new Vue({
  router: Modules.router,
  i18n: Modules.i18n,
  store,
  render: (f) => f(App),
}).$mount('#app')
