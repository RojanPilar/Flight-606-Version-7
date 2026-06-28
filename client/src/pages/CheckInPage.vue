<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGlobalStore } from '../stores/global.js'
import { getBookingByReference, checkInBookingUser, checkInBookingGuest, getFlightById, getAirportById } from '../api.js'

const route = useRoute()
const globalStore = useGlobalStore()
const isLoggedIn = computed(() => !!globalStore.user.token)

const bookingReference = ref(route.query.ref || '')
const guestEmail = ref('')
const booking = ref(null)
const flight = ref(null)
const originAirport = ref(null)
const destinationAirport = ref(null)
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
  flight.value = null
  originAirport.value = null
  destinationAirport.value = null
  if (!bookingReference.value.trim()) {
    errorMsg.value = 'Please enter your booking reference.'
    return
  }
  loading.value = true
  try {
    const res = await getBookingByReference(bookingReference.value.trim())
    booking.value = res.result

    // flightId comes back as a raw ID string — fetch the full flight + airports
    if (booking.value.flightId) {
      try {
        const flightRes = await getFlightById(booking.value.flightId)
        flight.value = flightRes?.result ?? null
        if (flight.value) {
          const [originRes, destRes] = await Promise.allSettled([
            getAirportById(flight.value.originAirportId),
            getAirportById(flight.value.destinationAirportId)
          ])
          if (originRes.status === 'fulfilled') originAirport.value = originRes.value?.result ?? null
          if (destRes.status === 'fulfilled')   destinationAirport.value = destRes.value?.result ?? null
        }
      } catch { /* non-fatal — airport names will fall back to — */ }
    }

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
                <div class="fc-time">{{ formatDateTime(flight?.departureTime) }}</div>
                <div class="fc-airport">{{ originAirport?.iataCode || '—' }}
                  <span class="d-block" style="font-size:0.75rem; opacity:0.7;">{{ originAirport?.city || '' }}</span>
                </div>
              </div>
              <div class="fc-mid">
                <div class="fc-line"><span class="fc-plane-icon"><i class="bi bi-airplane-fill"></i></span></div>
                <div class="fc-stops">{{ flight?.flightNumber }}</div>
              </div>
              <div class="fc-endpoint">
                <div class="fc-time">{{ formatDateTime(flight?.arrivalTime) }}</div>
                <div class="fc-airport">{{ destinationAirport?.iataCode || '—' }}
                  <span class="d-block" style="font-size:0.75rem; opacity:0.7;">{{ destinationAirport?.city || '' }}</span>
                </div>
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
                {{ flight?.flightNumber }} — {{ originAirport?.iataCode || 'DEP' }} → {{ destinationAirport?.iataCode || 'ARR' }}<br>
                Departs {{ formatDateTime(flight?.departureTime) }}
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