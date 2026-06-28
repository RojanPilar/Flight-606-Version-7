<script setup>
import { ref, provide, onMounted } from 'vue'
import { useGlobalStore } from './stores/global.js'
import Navbar from './components/Navbar.vue'
import Footer from './components/Footer.vue'

const globalStore = useGlobalStore()

// ── Theme ──────────────────────────────────────────
const theme = ref(localStorage.getItem('f606-theme') || 'dark')

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', theme.value)
  localStorage.setItem('f606-theme', theme.value)
}

provide('theme', theme)
provide('toggleTheme', toggleTheme)

// ── Restore session on load/refresh ───────────────
// globalStore already reads the token from localStorage when it's created,
// but we still want the fuller profile (email / isAdmin) refreshed against
// the backend in case it changed since the token was issued.
onMounted(() => {
  if (globalStore.user.token) {
    globalStore.getUserDetails(globalStore.user.token)
  }
})
</script>

<template>
  <div :data-theme="theme">
    <Navbar />
    <RouterView />
    <Footer />
  </div>
</template>
