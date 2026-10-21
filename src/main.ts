import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/LobbyView.vue') },
    { path: '/table', component: () => import('./views/TableView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
createApp(App).use(createPinia()).use(router).mount('#app')
