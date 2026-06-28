import { createRouter, createWebHistory } from 'vue-router'
import { useGlobalStore } from '../stores/global.js'

import HomePage from '../pages/HomePage.vue'
import LoginPage from '../pages/LoginPage.vue'
import SignupPage from '../pages/SignupPage.vue'
import SearchFlightsPage from '../pages/SearchFlightsPage.vue'
import BookFlightPage from '../pages/BookFlightPage.vue'
import ConfirmPaymentPage from '../pages/ConfirmPaymentPage.vue'
import PaymentSuccessPage from '../pages/PaymentSuccessPage.vue'
import ContactPage from '../pages/ContactPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import MyBookingsPage from '../pages/MyBookingsPage.vue'
import CheckInPage from '../pages/CheckInPage.vue'
import FlightStatusPage from '../pages/FlightStatusPage.vue'
import AdminDashboardPage from '../pages/AdminDashboardPage.vue'

const routes = [
  { path: '/', name: 'Home', component: HomePage },
  { path: '/login', name: 'Login', component: LoginPage, meta: { guestOnly: true } },
  { path: '/signup', name: 'Signup', component: SignupPage, meta: { guestOnly: true } },
  { path: '/flights', name: 'SearchFlights', component: SearchFlightsPage },

  { path: '/checkout/:flightId', name: 'Checkout', component: BookFlightPage, meta: { requiresAuth: true } },
  { path: '/guest-checkout/:flightId', name: 'GuestCheckout', component: BookFlightPage },

  { path: '/confirm-payment', name: 'ConfirmPayment', component: ConfirmPaymentPage },
  { path: '/payment-success', name: 'PaymentSuccess', component: PaymentSuccessPage },

  { path: '/contact', name: 'Contact', component: ContactPage },
  { path: '/profile', name: 'Profile', component: ProfilePage, meta: { requiresAuth: true } },
  { path: '/my-bookings', name: 'MyBookings', component: MyBookingsPage },
  { path: '/check-in', name: 'CheckIn', component: CheckInPage },
  { path: '/flight-status', name: 'FlightStatus', component: FlightStatusPage },

  // Admin shell — sidebar lives here; child views render inside <RouterView />.
  // requiresAuth + requiresAdmin cascade to all children automatically.
  {
    path: '/admin-dashboard',
    name: 'AdminDashboard',
    component: AdminDashboardPage,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      // Default child — loads at /admin-dashboard
      { path: '',              name: 'AdminFlights',       component: () => import('../components/admin/AdminFlights.vue') },

      // Operations
      { path: 'passengers',   name: 'AdminPassengers',    component: () => import('../components/admin/AdminPassengers.vue') },
      { path: 'bookings',     name: 'AdminBookings',      component: () => import('../components/admin/AdminBookings.vue') },
      { path: 'seats',        name: 'AdminSeats',         component: () => import('../components/admin/AdminSeats.vue') },
      { path: 'payments',     name: 'AdminPayments',      component: () => import('../components/admin/AdminPayments.vue') },

      // Infrastructure
      { path: 'airlines',     name: 'AdminAirlines',      component: () => import('../components/admin/AdminAirlines.vue') },
      { path: 'airports',     name: 'AdminAirports',      component: () => import('../components/admin/AdminAirports.vue') },
      { path: 'aircraft',     name: 'AdminAircraft',      component: () => import('../components/admin/AdminAircraft.vue') },
      { path: 'users',        name: 'AdminUsers',         component: () => import('../components/admin/AdminUsers.vue') },
      { path: 'notifications',name: 'AdminNotifications', component: () => import('../components/admin/AdminNotifications.vue') },
    ]
  },

  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  const globalStore = useGlobalStore()
  const isLoggedIn = !!globalStore.user.token

  if (to.meta.requiresAuth && !isLoggedIn) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !globalStore.isAdmin) {
    return { name: 'Home' }
  }
  if (to.meta.guestOnly && isLoggedIn) {
    return { name: 'Home' }
  }
  return true
})

export default router