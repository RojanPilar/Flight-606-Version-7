import { createApp } from 'vue'
import { createPinia } from 'pinia' // 1. Added Pinia core import
import App from './App.vue'
import router from './router/index.js'

// 2. Import Third-Party Framework Styles first
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@tabler/icons-webfont/dist/tabler-icons.css'

// 3. Import Your Custom Design Tokens & Styles last (so they override defaults)
import './style.css'

// 4. Import Bootstrap's Javascript triggers
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// 5. Apply user theme before UI mounts to avoid layout/color flashing
const saved = localStorage.getItem('f606-theme') || 'dark'
document.documentElement.setAttribute('data-theme', saved)

// 6. Build and bootstrap the application state
const app = createApp(App)
const pinia = createPinia()

app.use(pinia) // Critical: Registers Pinia so LoginPage.vue can safely access global state
app.use(router)
app.mount('#app')