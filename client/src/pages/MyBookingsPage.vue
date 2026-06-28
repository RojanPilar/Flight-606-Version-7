<script setup>
import { ref, computed, onMounted } from 'vue'
import { useGlobalStore } from '../stores/global.js'
import {
  getMyBookingsUser, getMyBookingsGuest,
  cancelBookingUser, cancelBookingGuest,
  getFlightById, getAirportById,
  getPassengersByBooking, getSeatById,
  getMyPassengers
} from '../api.js'

const globalStore = useGlobalStore()
const isLoggedIn = computed(() => !!globalStore.user.token)

const bookings = ref([])
const loading = ref(false)
const hasSearched = ref(false)
const errorMsg = ref('')
const guestEmailInput = ref('')
const cancellingRef = ref('')
// Pre-loaded passenger profiles for name resolution
// (BookingPassenger.passengerId comes back as a raw ID string, not populated)
const savedPassengersMap = ref({})  // { [passengerId]: passengerObject }

function formatTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
}
function formatDateLabel(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function calcTravelTime(departure, arrival) {
  if (!departure || !arrival) return ''
  const diff = new Date(arrival) - new Date(departure)
  if (diff <= 0) return ''
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m`
}
function statusBadgeClass(status) {
  if (status === 'cancelled') return 'fc-badge cancelled'
  if (status === 'pending') return 'fc-badge pending'
  return 'fc-badge success'
}
function seatClassBadge(cls) {
  return cls === 'business' ? 'bg-warning text-dark' : 'bg-success'
}
function passengerName(p) {
  if (!p) return '—'
  if (typeof p === 'object') return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—'
  return '—'
}
function isUpcoming(booking) {
  const dep = booking.flight?.departureTime || booking.flightId?.departureTime
  return dep ? new Date(dep) > new Date() : true
}

async function enrich(bookingsList) {
  const enriched = await Promise.allSettled(
    bookingsList.map(async b => {
      // Fetch flight + booking-passenger record in parallel
      const [flightRes, bkpRes] = await Promise.allSettled([
        getFlightById(b.flightId),
        getPassengersByBooking(b._id)
      ])

      // api.js wraps all responses: { message, result } — unwrap here
      const flight = flightRes.status === 'fulfilled'
        ? (flightRes.value?.result ?? flightRes.value ?? null)
        : null

      // Fetch origin + destination airports in parallel (only if we have a flight)
      // String() coercion prevents ObjectId object vs string cache-key mismatches
      let originAirport = null
      let destinationAirport = null
      if (flight) {
        const originId = flight.originAirportId ? String(flight.originAirportId) : null
        const destId   = flight.destinationAirportId ? String(flight.destinationAirportId) : null
        const [originRes, destRes] = await Promise.allSettled([
          originId ? getAirportById(originId) : Promise.resolve(null),
          destId   ? getAirportById(destId)   : Promise.resolve(null)
        ])
        if (originRes.status === 'fulfilled') originAirport = originRes.value?.result ?? null
        if (destRes.status === 'fulfilled')   destinationAirport = destRes.value?.result ?? null
      }

      // Resolve passenger name + seat + ticket from BookingPassenger
      let passenger    = null
      let seat         = null
      let ticketNumber = null

      if (bkpRes.status === 'fulfilled') {
        const records = bkpRes.value.result ?? []
        const bkp = records.find(r => r.isActive) ?? records[0] ?? null
        if (bkp) {
          ticketNumber = bkp.ticketNumber ?? null
          // passengerId comes back as a raw ObjectId string — not a populated object.
          // Look it up in the pre-loaded savedPassengersMap (keyed by string ID).
          const pid = bkp.passengerId ? String(bkp.passengerId) : null
          passenger = (pid && savedPassengersMap.value[pid])
            ? savedPassengersMap.value[pid]
            : (typeof bkp.passengerId === 'object' ? bkp.passengerId : null)
          if (bkp.seatId) {
            try {
              const seatRes = await getSeatById(bkp.seatId)
              seat = seatRes.result ?? null
            } catch { /* seat unavailable — show — in UI */ }
          }
        }
      }

      return { ...b, flight, originAirport, destinationAirport, passenger, seat, ticketNumber }
    })
  )

  return enriched
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

async function loadMyBookings() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await getMyBookingsUser()
    const raw = res?.bookings || res?.result || (Array.isArray(res) ? res : [])
    bookings.value = await enrich(raw)
  } catch (err) {
    if (err.response?.status === 404) {
      bookings.value = []
    } else {
      errorMsg.value = err.response?.data?.message || 'Could not load your bookings right now.'
    }
  } finally {
    loading.value = false
    hasSearched.value = true
  }
}

async function lookupGuestBookings() {
  if (!guestEmailInput.value || !guestEmailInput.value.includes('@')) {
    errorMsg.value = 'Please enter a valid email address.'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await getMyBookingsGuest({ guestEmail: guestEmailInput.value })
    const raw = res?.result || res?.data || (Array.isArray(res) ? res : [])
    bookings.value = await enrich(raw)
  } catch (err) {
    bookings.value = []
    errorMsg.value = err.response?.data?.message || 'No bookings found for that email.'
  } finally {
    loading.value = false
    hasSearched.value = true
  }
}

async function cancelBooking(booking) {
  if (!window.confirm(`Cancel booking ${booking.bookingReference}? This cannot be undone.`)) return
  cancellingRef.value = booking.bookingReference
  errorMsg.value = ''
  try {
    if (isLoggedIn.value) {
      await cancelBookingUser(booking.bookingReference)
    } else {
      await cancelBookingGuest(booking.bookingReference, { guestEmail: guestEmailInput.value })
    }
    booking.status = 'cancelled'
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Could not cancel this booking.'
  } finally {
    cancellingRef.value = ''
  }
}

onMounted(async () => {
  if (isLoggedIn.value) {
    // Pre-load saved passengers so enrich() can resolve names from raw IDs
    try {
      const res = await getMyPassengers()
      const list = res?.passengers || res?.result || []
      list.forEach(p => { savedPassengersMap.value[String(p._id)] = p })
    } catch { /* non-fatal — names will show — if unavailable */ }
    loadMyBookings()
  }
})
</script>

<template>
  <div class="page active">
    <div class="inner-page">
      <div class="pt-5">
        <div class="container" style="max-width:900px;">

          <nav class="theme-breadcrumb" aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><RouterLink :to="{ name: 'Home' }">Home</RouterLink></li>
              <li class="breadcrumb-item active">My Bookings</li>
            </ol>
          </nav>

          <h1 class="confirm-headline mb-4">My <em class="gold">Bookings</em></h1>

          <!-- Guest lookup -->
          <div v-if="!isLoggedIn" class="booking-section mb-4">
            <div class="bs-body">
              <label class="f-label">Find your bookings by email</label>
              <div class="row g-2">
                <div class="col-8 col-md-9"><input type="email" class="f-input" v-model="guestEmailInput" placeholder="you@email.com" @keyup.enter="lookupGuestBookings"></div>
                <div class="col-4 col-md-3"><button class="fc-select-btn w-100" @click="lookupGuestBookings">Find</button></div>
              </div>
              <p class="body-text mt-2" style="font-size:0.78rem;">
                Booked while logged in? <RouterLink :to="{ name: 'Login', query: { redirect: '/my-bookings' } }" class="gold-link">Log in</RouterLink> to see everything in one place.
              </p>
            </div>
          </div>

          <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

          <div v-if="loading" class="text-center py-5">
            <span class="spinner-border text-warning"></span>
          </div>

          <div v-else-if="hasSearched && bookings.length === 0" class="text-center py-5">
            <p class="body-text">No bookings found.</p>
            <RouterLink :to="{ name: 'SearchFlights' }" class="gold-link">Search for a flight →</RouterLink>
          </div>

          <div v-for="booking in bookings" :key="booking._id" class="flight-card fc-static mb-3">

            <!-- Origin -->
            <div class="fc-endpoint">
              <div class="fc-time">{{ formatTime(booking.flight?.departureTime) }}</div>
              <div class="fc-airport">
                {{ booking.originAirport?.iataCode || '—' }}
                <span class="d-block" style="font-size:0.75rem; opacity:0.7;">{{ booking.originAirport?.city || '' }}</span>
              </div>
              <div class="fc-date">{{ formatDateLabel(booking.flight?.departureTime) }}</div>
            </div>

            <!-- Mid: flight track -->
            <div class="fc-mid">
              <div class="fc-duration">{{ calcTravelTime(booking.flight?.departureTime, booking.flight?.arrivalTime) }}</div>
              <div class="fc-line"><span class="fc-plane-icon"><i class="bi bi-airplane-fill"></i></span></div>
              <div class="fc-stops">{{ booking.flight?.flightNumber || '—' }}</div>
            </div>

            <!-- Destination -->
            <div class="fc-endpoint">
              <div class="fc-time">{{ formatTime(booking.flight?.arrivalTime) }}</div>
              <div class="fc-airport">
                {{ booking.destinationAirport?.iataCode || '—' }}
                <span class="d-block" style="font-size:0.75rem; opacity:0.7;">{{ booking.destinationAirport?.city || '' }}</span>
              </div>
              <div class="fc-date">{{ formatDateLabel(booking.flight?.arrivalTime) }}</div>
            </div>

            <!-- Price / Status / Actions -->
            <div class="fc-price-box">
              <span :class="statusBadgeClass(booking.status)">{{ booking.status }}</span>
              <div class="fc-price-amt">₱{{ booking.totalAmount?.toLocaleString() ?? '—' }}</div>
              <div class="fc-price-note">Ref: {{ booking.bookingReference }}</div>

              <div class="fc-actions">
                <RouterLink
                  v-if="booking.status === 'confirmed' && !booking.checkedIn && isUpcoming(booking)"
                  :to="{ name: 'CheckIn', query: { ref: booking.bookingReference } }"
                  class="fc-action-btn fc-action-btn--primary"
                >Check-in</RouterLink>

                <RouterLink
                  v-if="booking.status !== 'cancelled' && booking.flight"
                  :to="{
                    name: 'SearchFlights',
                    query: {
                      originAirportId: booking.flight.originAirportId,
                      destinationAirportId: booking.flight.destinationAirportId,
                      departureDate: booking.flight.departureTime
                        ? new Date(booking.flight.departureTime).toISOString().slice(0, 10)
                        : undefined
                    }
                  }"
                  class="fc-action-btn fc-action-btn--ghost"
                >Rebook</RouterLink>

                <button
                  v-if="booking.status !== 'cancelled' && !booking.checkedIn"
                  class="fc-action-btn fc-action-btn--danger"
                  :disabled="cancellingRef === booking.bookingReference"
                  @click="cancelBooking(booking)"
                >{{ cancellingRef === booking.bookingReference ? 'Cancelling…' : 'Cancel' }}</button>
              </div>
            </div>

            <!-- Boarding-pass stub: perforated tear line + ticket meta -->
            <div class="fc-stub">
              <div class="fc-stub-divider"></div>

              <div class="fc-meta-grid">
                <div class="fc-meta-item">
                  <span class="fc-meta-label">Flight</span>
                  <span class="fc-meta-value">
                    {{ booking.flight?.flightNumber || '—' }}
                    <span v-if="booking.flight?.airlineId?.name" class="fc-meta-value-sub">{{ booking.flight.airlineId.name }}</span>
                  </span>
                </div>

                <div class="fc-meta-item">
                  <span class="fc-meta-label">Passenger</span>
                  <span class="fc-meta-value">{{ passengerName(booking.passenger) }}</span>
                </div>

                <div class="fc-meta-item">
                  <span class="fc-meta-label">Seat</span>
                  <span class="fc-meta-value">
                    <template v-if="booking.seat">
                      {{ booking.seat.seatNumber }}
                      <span class="badge fc-seat-class" :class="seatClassBadge(booking.seat.class)">{{ booking.seat.class }}</span>
                    </template>
                    <template v-else>—</template>
                  </span>
                </div>

                <div class="fc-meta-item">
                  <span class="fc-meta-label">Ticket No.</span>
                  <span class="fc-meta-value fc-meta-value--mono font-monospace">{{ booking.ticketNumber || '—' }}</span>
                </div>

                <div class="fc-meta-item">
                  <span class="fc-meta-label">Departure Terminal</span>
                  <span class="fc-meta-value">{{ booking.flight?.originTerminal ? 'Terminal T' + booking.flight.originTerminal : '—' }}</span>
                </div>

                <div class="fc-meta-item">
                  <span class="fc-meta-label">Arrival Terminal</span>
                  <span class="fc-meta-value">{{ booking.flight?.destinationTerminal ? 'Terminal T' + booking.flight.destinationTerminal : '—' }}</span>
                </div>
              </div>

              <div class="fc-timebar">
                <div class="fc-timebar-block">
                  <span class="fc-meta-label">Departure</span>
                  <div class="fc-timebar-time">{{ formatTime(booking.flight?.departureTime) }}</div>
                  <div class="fc-timebar-date">{{ formatDateLabel(booking.flight?.departureTime) }}</div>
                </div>
                <div class="fc-timebar-arrow">→</div>
                <div class="fc-timebar-block">
                  <span class="fc-meta-label">Arrival</span>
                  <div class="fc-timebar-time fc-timebar-time--gold">{{ formatTime(booking.flight?.arrivalTime) }}</div>
                  <div class="fc-timebar-date">{{ formatDateLabel(booking.flight?.arrivalTime) }}</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  </div>
</template>