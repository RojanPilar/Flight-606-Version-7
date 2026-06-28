<script setup>
import { ref, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useGlobalStore } from '../../stores/global';

const theme = inject('theme');
const toggleTheme = inject('toggleTheme');

const router = useRouter();
const globalStore = useGlobalStore();

// Drawer state — only matters on mobile; ignored on desktop
const drawerOpen = ref(false);

function closeDrawer() { drawerOpen.value = false; }
function toggleDrawer() { drawerOpen.value = !drawerOpen.value; }

// Close drawer automatically when a route link is tapped
function navigate() { closeDrawer(); }

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    globalStore.user.token = null;
    globalStore.user.email = null;
    globalStore.user.isAdmin = null;
    closeDrawer();
    router.push('/login');
}
</script>

<template>

  <!--
    MOBILE TOPBAR  (hidden on desktop >= 992px)
    Sticky bar with brand + hamburger toggle.
  -->
  <div class="admin-mobile-topbar" aria-label="Admin navigation toggle">
    <span class="topbar-brand">
      <i class="ti ti-plane-tilt"></i> Flight606
    </span>
    <button
      class="hamburger-btn"
      :class="{ open: drawerOpen }"
      @click="toggleDrawer"
      :aria-expanded="String(drawerOpen)"
      aria-controls="admin-drawer"
      aria-label="Toggle navigation"
    >
      <span class="ham-bar"></span>
      <span class="ham-bar"></span>
      <span class="ham-bar"></span>
    </button>
  </div>

  <!-- OVERLAY (mobile only — dims content behind the drawer) -->
  <Transition name="overlay-fade">
    <div
      v-if="drawerOpen"
      class="drawer-overlay"
      @click="closeDrawer"
      aria-hidden="true"
    ></div>
  </Transition>

  <!--
    SIDEBAR / DRAWER
    Desktop: fixed-width column, always visible.
    Mobile:  off-canvas drawer, slides in from the left.
  -->
  <nav
    id="admin-drawer"
    class="admin-sidebar"
    :class="{ 'drawer-open': drawerOpen }"
    role="navigation"
    aria-label="Admin sidebar"
  >

    <!-- Drawer close button (visible on mobile inside the drawer) -->
    <button class="drawer-close-btn" @click="closeDrawer" aria-label="Close navigation">
      <i class="ti ti-x"></i>
    </button>

    <p class="sidebar-section-label">Operations</p>

    <!-- Theme toggle -->
    <div class="nav-actions d-flex align-items-center">
      <button
        class="theme-toggle"
        @click="toggleTheme"
        aria-label="Toggle light/dark mode"
        title="Toggle light/dark mode"
      >
        <i class="ti ti-moon icon-dark"></i>
        <i class="ti ti-sun icon-light"></i>
      </button>
      <p class="sidebar-theme-toggle">Theme Toggle</p>
    </div>

    <div class="profile-nav">
      <RouterLink class="nav-link" :to="{ name: 'AdminFlights' }" @click="navigate">
        <i class="ti ti-plane"></i>
        <span class="nav-label">Flights</span>
      </RouterLink>
      <RouterLink class="nav-link" :to="{ name: 'AdminPassengers' }" @click="navigate">
        <i class="ti ti-users"></i>
        <span class="nav-label">Passengers</span>
      </RouterLink>
      <RouterLink class="nav-link" :to="{ name: 'AdminBookings' }" @click="navigate">
        <i class="ti ti-ticket"></i>
        <span class="nav-label">Bookings</span>
      </RouterLink>
      <RouterLink class="nav-link" :to="{ name: 'AdminSeats' }" @click="navigate">
        <i class="ti ti-armchair"></i>
        <span class="nav-label">Seats</span>
      </RouterLink>
      <RouterLink class="nav-link" :to="{ name: 'AdminPayments' }" @click="navigate">
        <i class="ti ti-credit-card"></i>
        <span class="nav-label">Payments</span>
      </RouterLink>
    </div>

    <div class="pn-sep"></div>

    <p class="sidebar-section-label">Configuration</p>
    <div class="profile-nav">
      <RouterLink class="nav-link" :to="{ name: 'AdminAirlines' }" @click="navigate">
        <i class="ti ti-building-airport"></i>
        <span class="nav-label">Airlines</span>
      </RouterLink>
      <RouterLink class="nav-link" :to="{ name: 'AdminAirports' }" @click="navigate">
        <i class="ti ti-map-pin"></i>
        <span class="nav-label">Airports</span>
      </RouterLink>
      <RouterLink class="nav-link" :to="{ name: 'AdminAircraft' }" @click="navigate">
        <i class="ti ti-drone"></i>
        <span class="nav-label">Aircraft</span>
      </RouterLink>
      <RouterLink class="nav-link" :to="{ name: 'AdminUsers' }" @click="navigate">
        <i class="ti ti-user-cog"></i>
        <span class="nav-label">Users</span>
      </RouterLink>
      <RouterLink class="nav-link" :to="{ name: 'AdminNotifications' }" @click="navigate">
        <i class="ti ti-bell"></i>
        <span class="nav-label">Notifications</span>
      </RouterLink>
    </div>

    <div class="pn-sep"></div>

    <div class="profile-nav">
      <button class="nav-link logout-nav" @click="logout">
        <i class="ti ti-logout"></i>
        <span class="nav-label">Logout</span>
      </button>
    </div>

  </nav>

</template>

<style scoped>
@import './admin-shared.css';

/* ═══════════════════════════════════════════════════
   BASE — shared between desktop & mobile.
   Token-driven so light/dark just works via the
   --sidebar-link / --sidebar-link-hover tokens
   already defined in admin-shared.css.
   ═══════════════════════════════════════════════════ */

.sidebar-section-label {
  font-family: var(--font-sans);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
  margin: 0 0 6px 14px;
  white-space: nowrap;
}

/* ── Theme toggle row ── */
.nav-actions {
  padding: 0 14px 12px;
  gap: 10px;
}

.sidebar-theme-toggle {
  font-family: var(--font-sans);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin: 0;
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--glass-bg-lt);
  border: 1px solid var(--border-dim);
  color: var(--gold);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
  flex-shrink: 0;
}
.theme-toggle:hover { border-color: var(--gold); background: var(--gold-dim); }
.theme-toggle .ti { font-size: 1rem; }

/* Sun/moon swap — DELETE if already defined in a global stylesheet */
.icon-light { display: none; }
[data-theme="light"] .icon-dark  { display: none; }
[data-theme="light"] .icon-light { display: inline; }

/* ── Nav groups ── */
.profile-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.profile-nav .nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-family: var(--font-sans);
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--sidebar-link, var(--muted));
  text-decoration: none;
  border-radius: 4px;
  transition: background 0.18s ease, color 0.18s ease;
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  min-width: 0;
  box-sizing: border-box;
}

.profile-nav .nav-link .ti { font-size: 1rem; flex-shrink: 0; }

.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.profile-nav .nav-link:hover {
  background: var(--gold-dim);
  color: var(--sidebar-link-hover, var(--text));
}

.profile-nav .nav-link.router-link-active {
  background: var(--gold-dim);
  color: var(--gold);
}

.profile-nav .nav-link.logout-nav       { color: var(--error); }
.profile-nav .nav-link.logout-nav:hover { background: rgba(255, 77, 77, 0.08); color: var(--error); }

/* Light theme — single token-based source of truth, no !important */
:deep([data-theme="light"]) .profile-nav .nav-link                    { color: var(--sidebar-link, #374151); }
:deep([data-theme="light"]) .profile-nav .nav-link:hover              { color: var(--sidebar-link-hover, #111827); }
:deep([data-theme="light"]) .profile-nav .nav-link.router-link-active { color: #b45309; }
:deep([data-theme="light"]) .profile-nav .nav-link.logout-nav:hover   { background: rgba(217, 56, 58, 0.08); }

.pn-sep {
  height: 1px;
  background: var(--border);
  margin: 10px 0;
}


/* ═══════════════════════════════════════════════════
   DESKTOP  (>= 992px)
   Rigid fixed-width column — flex-basis AND min-width
   locked to the same value so it can neither grow nor
   shrink. That's what kills the gaps/overlap/clipped
   text: the sidebar is now a totally predictable box,
   and .admin-main (flex: 1) absorbs everything else.
   ═══════════════════════════════════════════════════ */
@media (min-width: 992px) {

  .admin-mobile-topbar { display: none; }
  .drawer-overlay      { display: none; }
  .drawer-close-btn    { display: none; }

  .admin-sidebar {
    flex: 0 0 220px;
    width: 220px;
    min-width: 220px;
    border-right: 1px solid var(--border-dim);
    padding-right: 16px;
    padding-top: 4px;
    box-sizing: border-box;
  }
}


/* ═══════════════════════════════════════════════════
   MOBILE  (< 992px)
   Off-canvas drawer + sticky topbar — unchanged
   from the version you liked.
   ═══════════════════════════════════════════════════ */
@media (max-width: 991px) {

  .admin-mobile-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 900;
    background: var(--bg-60-surface, #0e0e12);
    border-bottom: 1px solid var(--border-dim);
    box-shadow: 0 -2px 0 0 var(--gold) inset, 0 4px 24px rgba(0,0,0,0.45);
    padding: 11px 18px;
    box-sizing: border-box;
    width: 100%;
    margin-bottom: 20px;
  }

  .topbar-brand {
    font-family: var(--font-sans);
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--gold);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .topbar-brand .ti { font-size: 1rem; }

  .hamburger-btn {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 36px;
    height: 36px;
    background: none;
    border: 1px solid var(--border-dim);
    border-radius: 4px;
    cursor: pointer;
    padding: 8px 7px;
    transition: border-color 0.2s ease, background 0.2s ease;
    flex-shrink: 0;
    box-sizing: border-box;
  }
  .hamburger-btn:hover { border-color: var(--gold); background: var(--gold-dim); }

  .ham-bar {
    display: block;
    height: 2px;
    width: 100%;
    background: var(--muted);
    border-radius: 2px;
    transition: transform 0.28s cubic-bezier(.4,0,.2,1), opacity 0.2s ease, background 0.2s ease;
    transform-origin: center;
  }
  .hamburger-btn:hover .ham-bar { background: var(--gold); }

  .hamburger-btn.open .ham-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .hamburger-btn.open .ham-bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
  .hamburger-btn.open .ham-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  .drawer-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    z-index: 1000;
  }

  .admin-sidebar {
    flex: unset;
    width: 270px;
    max-width: 82vw;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 1010;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(.4,0,.2,1);
    will-change: transform;
    background: var(--bg-60-surface, #0e0e12);
    border-right: 1px solid var(--gold);
    border-top: none;
    padding: 0 0 24px;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    box-shadow: 4px 0 48px rgba(0, 0, 0, 0.65);
    box-sizing: border-box;
  }

  .admin-sidebar.drawer-open { transform: translateX(0); }

  .admin-sidebar .drawer-close-btn {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border-dim);
    padding: 14px 18px;
    margin-bottom: 8px;
    cursor: pointer;
    color: var(--muted);
    font-size: 1rem;
    transition: color 0.2s ease;
    box-sizing: border-box;
  }
  .admin-sidebar .drawer-close-btn:hover { color: var(--gold); }

  .sidebar-section-label { margin: 10px 0 6px 18px; }

  .nav-actions { padding: 0 18px 12px; }

  .profile-nav { padding: 0 10px; margin-bottom: 6px; }

  .profile-nav .nav-link {
    padding: 12px 14px;
    font-size: 0.82rem;
    border-radius: 6px;
    gap: 12px;
    white-space: normal;
    overflow: visible;
  }
  .profile-nav .nav-link .ti { font-size: 1.1rem; }

  .pn-sep { margin: 8px 18px; }
}
</style>

<!-- Global: Vue Transition classes for the overlay (must stay unscoped) -->
<style>
.overlay-fade-enter-active,
.overlay-fade-leave-active { transition: opacity 0.25s ease; }
.overlay-fade-enter-from,
.overlay-fade-leave-to     { opacity: 0; }
</style>