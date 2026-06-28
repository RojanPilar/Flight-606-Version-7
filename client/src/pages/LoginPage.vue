<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { loginUser } from '../api.js' 
import { useGlobalStore } from '../stores/global.js'

const router = useRouter()
const route = useRoute()
const globalStore = useGlobalStore()

const email    = ref('')
const password = ref('')
const showPass = ref(false)
const emailErr = ref(false)
const loginErr = ref(false)

async function doLogin() {
  emailErr.value = false
  loginErr.value = false

  if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    emailErr.value = true
    return
  }

  try {
    const res = await loginUser({ 
      email: email.value, 
      password: password.value 
    })

    // FIXED: Added res.access to match your backend payload key seen in image_d1d37f.png
    const token = res.access || res.token || res.result?.token

    if (token) {
      await globalStore.getUserDetails(token)
      router.push(route.query.redirect || { name: 'Home' })
    } else {
      loginErr.value = true
    }
  } catch (error) {
    console.error('Authentication error:', error)
    loginErr.value = true
  }
}
</script>

<template>
  <div class="page active">
    <div class="auth-bg">
      <div class="container py-5">
        <div class="row align-items-center min-vh-100 py-5">
          <div class="col-lg-6 d-none d-lg-flex flex-column justify-content-center pe-5">
            <p class="auth-eyebrow">Flight 606 · Luxury Redefined</p>
            <h1 class="auth-headline">Paradise <em>Awaits</em><br>Your Arrival</h1>
            <p class="auth-sub">Your Exclusive Gateway to <span class="gold">First-class</span> Journey</p>
            <blockquote class="auth-quote">
              <p>"Flight606 is the only Airline where the journey becomes your destination"</p>
              <footer>— Manny Paksiu</footer>
            </blockquote>
          </div>
          <div class="col-lg-6">
            <div class="auth-card">
              <p class="a-tag">Welcome back</p>
              <h2 class="a-title">Login to your <span class="gold">account</span></h2>
              <div v-if="loginErr" class="alert-msg alert-error">Sorry, we don't recognize that email or password.</div>
              <div class="mb-3">
                <label class="f-label">E-Mail</label>
                <input type="email" class="f-input" :class="{ err: emailErr }" v-model="email" placeholder="example@email.com">
                <p v-if="emailErr" class="err-msg">Sorry, we don't recognize this email.</p>
              </div>
              <div class="mb-3">
                <label class="f-label">Password</label>
                <div class="input-wrap">
                  <input :type="showPass ? 'text' : 'password'" class="f-input" v-model="password" placeholder="••••••••••">
                  <span class="input-eye" @click="showPass = !showPass"><i class="bi bi-eye"></i></span>
                </div>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-4">
                <label class="r-lbl"><input type="checkbox"> <span>Remember me</span></label>
                <a href="#" class="gold-link">Forgot password?</a>
              </div>
              <button class="btn-gold-full" @click="doLogin">Login Now</button>
              <button class="oauth-btn"><img src="https://www.google.com/favicon.ico" width="14" alt="G"> Continue with Google</button>
              <button class="oauth-btn"><i class="bi bi-apple"></i> Continue with Apple</button>
              <p class="switch-link">Don't have an account? <RouterLink :to="{ name: 'Signup' }" class="gold-link">Sign Up</RouterLink></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>