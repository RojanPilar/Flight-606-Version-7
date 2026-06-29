<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGlobalStore } from '../stores/global.js'
import { getBookingByReference, checkInBookingUser, checkInBookingGuest } from '../api.js'

const route = useRoute()
const globalStore = useGlobalStore()
const isLoggedIn = computed(() => !!globalStore.user.token)

const bookingReference = ref(route.query.ref || '')
const guestEmail = ref('')
const booking = ref(null)
const step = ref('lookup') // 'lookup' | 'found' | 'done'
const loading = ref(false)
const errorMsg = ref('')

function formatDateTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

async function lookupBooking() {
  errorMsg.value = ''
  booking.value = null
  if (!bookingReference.value.trim()) {
    errorMsg.value = 'Please enter your booking reference.'
    return
  }
  loading.value = true
  try {
    const res = await getBookingByReference(bookingReference.value.trim())
    booking.value = res.result
    if (booking.value.checkedIn) {
      errorMsg.value = 'This booking is already checked in.'
    } else if (booking.value.status !== 'confirmed') {
      errorMsg.value = `This booking is "${booking.value.status}" and can't be checked in yet.`
    } else {
      step.value = 'found'
    }
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Booking not found. Please check your reference and try again.'
  } finally {
    loading.value = false
  }
}

async function doCheckIn() {
  errorMsg.value = ''
  loading.value = true
  try {
    const res = isLoggedIn.value
      ? await checkInBookingUser(bookingReference.value.trim())
      : await checkInBookingGuest(bookingReference.value.trim(), { guestEmail: guestEmail.value })
    booking.value = res.result
    step.value = 'done'
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Check-in failed. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (bookingReference.value) lookupBooking()
})
</script>

<template>
  <div class="page active">
    <div class="inner-page">
            <div class="inner-hero">
        <div class="container text-center">
          <p class="hero-eyebrow">Flight 606 · Luxury Redefined</p>
          <h1 class="hero-title">Your Next <em>Chapter</em> Begins Here</h1>
          <p class="hero-sub">Bespoke journeys crafted for the modern global traveler</p>
        </div>
      </div>
      <div class="pt-5">
        <div class="container" style="max-width:640px;">

          <nav class="theme-breadcrumb" aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><RouterLink :to="{ name: 'Home' }">Home</RouterLink></li>
              <li class="breadcrumb-item active">Check-in</li>
            </ol>
          </nav>

          <template v-if="step !== 'done'">
            <h1 class="confirm-headline mb-4">Online <em class="gold">Check-in</em></h1>

            <div class="booking-section">
              <div class="bs-body">
                <label class="f-label">Booking Reference</label>
                <input type="text" class="f-input mb-3" v-model="bookingReference" placeholder="e.g. F606-XXXXXXXX" @keyup.enter="lookupBooking">

                <template v-if="!isLoggedIn">
                  <label class="f-label">Email used for booking</label>
                  <input type="email" class="f-input mb-3" v-model="guestEmail" placeholder="you@email.com">
                </template>

                <button class="fc-select-btn w-100" :disabled="loading" @click="step === 'found' ? doCheckIn() : lookupBooking()">
                  {{ loading ? 'Please wait…' : (step === 'found' ? 'Confirm Check-in' : 'Find My Booking') }}
                </button>
              </div>
            </div>

            <div v-if="errorMsg" class="alert alert-danger mt-3">{{ errorMsg }}</div>

            <div v-if="booking && step === 'found'" class="flight-card mt-4" style="cursor:default;">
              <div class="fc-endpoint">
                <div class="fc-time">{{ formatDateTime(booking.flightId?.departureTime) }}</div>
                <div class="fc-airport">{{ booking.flightId?.originAirportId?.city || booking.flightId?.originAirportId?.iataCode || 'DEP' }}</div>
              </div>
              <div class="fc-mid">
                <div class="fc-line"><span class="fc-plane-icon"><i class="bi bi-airplane-fill"></i></span></div>
                <div class="fc-stops">{{ booking.flightId?.flightNumber }}</div>
              </div>
              <div class="fc-endpoint">
                <div class="fc-time">{{ formatDateTime(booking.flightId?.arrivalTime) }}</div>
                <div class="fc-airport">{{ booking.flightId?.destinationAirportId?.city || booking.flightId?.destinationAirportId?.iataCode || 'ARR' }}</div>
              </div>
              <div class="fc-price-box">
                <span class="fc-badge success">Confirmed</span>
                <div class="fc-price-note">Ref: {{ booking.bookingReference }}</div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="success-page" style="min-height:auto; padding-top:20px;">
              <div class="success-icon">✓</div>
              <h1 class="success-title">You're checked in!</h1>
              <p class="success-sub">
                {{ booking.flightId?.flightNumber }} — {{ booking.flightId?.originAirportId?.iataCode || 'DEP' }} → {{ booking.flightId?.destinationAirportId?.iataCode || 'ARR' }}<br>
                Departs {{ formatDateTime(booking.flightId?.departureTime) }}
              </p>
              <p class="success-note">Please arrive at the airport at least 2 hours before departure with a valid ID and your booking reference: <strong>{{ booking.bookingReference }}</strong></p>
              <div class="success-actions">
                <RouterLink class="btn-gold-full" :to="{ name: 'MyBookings' }">View My Bookings</RouterLink>
                <RouterLink class="btn-gold-full" :to="{ name: 'Home' }">Back to Home</RouterLink>
              </div>
            </div>
          </template>

        </div>
      </div>
    </div>
  </div>
</template>
