<script setup>
import { ref, inject, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGlobalStore } from '../stores/global.js'

const theme = inject('theme')
const toggleTheme = inject('toggleTheme')
const isMenuOpen = ref(false)
const store = useGlobalStore()
const router = useRouter()
const route = useRoute() 
const globalStore = useGlobalStore()

// 1. Detect if we are on the checkout route
const isCheckoutPage = computed(() => route.path.startsWith('/checkout'))
const isMyBookingPage = computed(() => route.path.startsWith('/my-bookings'))

// ── Scroll state ───────────────────────────────────
const isScrolled = ref(false)
const profileMenuOpen = ref(false)

// 2. Updated to force scrolling state to 'true' if on checkout
function handleScroll() {
  if (isCheckoutPage.value || isMyBookingPage.value) {
    isScrolled.value = true
  } else {
    isScrolled.value = window.scrollY > 40
  }
}

watch(
  () => route.path,
  () => {
    handleScroll()
  }
)

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll() // Evaluates immediately on load
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

// ── Auth state ─────────────────────────────────────
const isLoggedIn = computed(() => !!globalStore.user.token)

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value
}

function closeProfileMenu() {
  profileMenuOpen.value = false
}

function doLogout() {
  // 1. Clear the physical browser storage
  localStorage.removeItem('token');
  localStorage.removeItem('isAdmin'); 

  // 2. Clear your application state and close UI menus
  globalStore.getUserDetails(null)
  profileMenuOpen.value = false
  
  // 3. Redirect the user
  router.push({ name: 'Home' })
}
</script>


<template>
  <nav
    class="navbar navbar-expand-lg fixed-top"
    id="mainNav"
    :class="{ scrolled: isScrolled }"
  >
    <div class="container-fluid nav-inner">

      <!-- Logo -->
      <RouterLink class="navbar-brand" :to="{ name: 'Home' }" @click="isMenuOpen = false">
        <img src="../assets/logo-flight606.png" alt="Logo" class="nav-logo-img" />
      </RouterLink>

      <!-- Hamburger (Controlled by Vue @click) -->
      <button
        class="navbar-toggler"
        type="button"
        aria-controls="navbarContent"
        :aria-expanded="isMenuOpen"
        aria-label="Toggle navigation"
        @click="isMenuOpen = !isMenuOpen"
      >
        <span class="toggler-icon"></span>
        <span class="toggler-icon"></span>
        <span class="toggler-icon"></span>
      </button>

      <!-- Menu Container (Class handled by Vue) -->
      <div 
        class="collapse navbar-collapse" 
        id="navbarContent"
        :class="{ 'show': isMenuOpen }"
      > 

        <ul v-if="store.isAdmin" class="navbar-nav mx-auto gap-lg-2">
          <li class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ name: 'AdminDashboard' }" @click="isMenuOpen = false">Admin Dashboard</RouterLink>
          </li>          
        </ul>

        <ul v-else class="navbar-nav mx-auto gap-lg-2">
          <li class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ name: 'Home' }" @click="isMenuOpen = false">Home</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ name: 'SearchFlights' }" @click="isMenuOpen = false">Flights</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ path: '/', hash: '#tours' }" @click="isMenuOpen = false">Destinations</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ name: 'FlightStatus' }" @click="isMenuOpen = false">Flight Status</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ name: 'CheckIn' }" @click="isMenuOpen = false">Check-in</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" active-class="active" :to="{ name: 'Contact' }" @click="isMenuOpen = false">Contact</RouterLink>
          </li>
        </ul>

        <div class="nav-actions d-flex align-items-center gap-2">
          <!-- Theme toggle -->
          <button
            class="theme-toggle"
            style="width: 40px; height: 40px;"
            @click="toggleTheme"
            aria-label="Toggle light/dark mode"
            title="Toggle light/dark mode"
          >
            <i class="ti ti-moon icon-dark"></i>
            <i class="ti ti-sun icon-light"></i>
          </button>

          <!-- Logged out -->
          <div v-if="!isLoggedIn" class="d-flex align-items-center gap-2">
            <RouterLink class="btn-ghost text-nowrap" :to="{ name: 'Login' }" @click="isMenuOpen = false">Login</RouterLink>
            <RouterLink class="btn-gold text-nowrap" :to="{ name: 'Signup' }" @click="isMenuOpen = false">Sign Up</RouterLink>
          </div>

          <!-- Logged in -->
          <div v-else class="profile-dropdown" id="profileDropdown">
            <button class="profile-trigger" @click="toggleProfileMenu">
              <i class="bi bi-person-circle"></i>
              <span class="profile-name-label">{{store.user.firstName}}</span>
              <i class="bi bi-chevron-down small"></i>
            </button>
            <div class="profile-menu" :class="{ open: profileMenuOpen }">
              <RouterLink v-if="!store.isAdmin" :to="{ name: 'Profile' }" @click="closeProfileMenu(); isMenuOpen = false">
                <i class="bi bi-person"></i> Personal Details
              </RouterLink>
              <RouterLink v-if="!store.isAdmin" :to="{ name: 'MyBookings' }" @click="closeProfileMenu(); isMenuOpen = false">
                <i class="bi bi-wallet2"></i> My Bookings
              </RouterLink>
              <RouterLink v-if="!store.isAdmin" :to="{ name: 'CheckIn' }" @click="closeProfileMenu(); isMenuOpen = false">
                <i class="bi bi-qr-code-scan"></i> Check-in
              </RouterLink>
              <div class="pm-sep"></div>
              <a href="#" class="logout-link" @click.prevent="doLogout(); isMenuOpen = false">
                <i class="bi bi-box-arrow-right"></i> Log out
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>



<style scoped>
/* Logo image — sized for the navbar bar (component-scoped)
   Use a distinct class to avoid colliding with global `.nav-logo` rules. */
.nav-logo-img {
  height: 36px;
  width: auto;
  object-fit: contain;
  display: block;
}

/* Responsive: mobile / tablet collapse layout */
@media (max-width: 991.98px) {
  .nav-inner { padding: 0 16px; }

  /* Make the collapsed panel full-width and visually separated */
  .navbar-collapse {
    background: var(--bg-60);
    position: absolute;
    top: 70px;
    left: 0;
    right: 0;
    padding: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.18);
    z-index: 1040;
  }

  .navbar-nav {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
    margin: 0;
  }

  .navbar-nav .nav-item { width: 100%; }

  .navbar-nav .nav-link {
    padding: 12px 14px !important;
    width: 100%;
    color: var(--text) !important;
    background: transparent;
    border-radius: 8px;
  }

  .nav-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    width: 100%;
  }

  .nav-actions .btn-ghost,
  .nav-actions .btn-gold,
  .nav-actions .theme-toggle,
  .nav-actions .profile-trigger {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 575.98px) {
  #mainNav { height: 64px; }
  .nav-logo-img { height: 30px; }
  .nav-inner { padding: 0 12px; }
  .toggler-icon { display: block; width: 10%; height: 1.5px; background: #ffffff; margin: 4px 0; }
}

</style>

