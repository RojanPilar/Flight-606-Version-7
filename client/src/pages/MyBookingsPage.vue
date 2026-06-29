<script setup>
import { ref, computed, onMounted } from 'vue'
import { useGlobalStore } from '../stores/global.js'
import {
  getMyBookingsUser,
  getMyBookingsGuest,
  cancelBookingUser,
  cancelBookingGuest,
  rescheduleBookingUser,
  searchFlights,
  getPassengersByBooking,
  getSeatById,
  getMyPassengers,
  getPassengerById,
  getSeatsByFlight,
} from '../api.js'

const globalStore = useGlobalStore()
const isLoggedIn  = computed(() => !!globalStore.user.token)

// ── State ──────────────────────────────────────────────────────────────────
const bookings        = ref([])
const loading         = ref(false)
const hasSearched     = ref(false)
const errorMsg        = ref('')
const guestEmailInput = ref('')
const cancellingRef   = ref('')

// ── Expanded detail panels (Set of booking._id) ────────────────────────────
const openDetails = ref(new Set())

function toggleDetails(id) {
  const next = new Set(openDetails.value)
  next.has(id) ? next.delete(id) : next.add(id)
  openDetails.value = next
}

// ── Rebook modal state ─────────────────────────────────────────────────────
const rebookStep        = ref(null)
const rebookTarget      = ref(null)
const rebookDate        = ref('')
const rebookFlights     = ref([])
const rebookLoading     = ref(false)
const rebookSubmitting  = ref(false)
const rebookError       = ref('')
const selectedFlightId  = ref('')
const rebookSeats       = ref([])
const seatsLoading      = ref(false)
const selectedSeatId    = ref('')

function openRebookModal(booking) {
  rebookTarget.value     = booking
  rebookStep.value       = 'confirm'
  rebookDate.value       = ''
  rebookFlights.value    = []
  rebookLoading.value    = false
  rebookSubmitting.value = false
  rebookError.value      = ''
  selectedFlightId.value = ''
  rebookSeats.value      = []
  seatsLoading.value     = false
  selectedSeatId.value   = ''
}

function proceedToSearch() {
  rebookStep.value = 'search'
}

function closeRebookModal() {
  if (rebookSubmitting.value) return
  rebookTarget.value = null
  rebookStep.value   = null
}

async function searchRebookFlights() {
  if (!rebookDate.value) { rebookError.value = 'Please pick a date.'; return }
  rebookLoading.value    = true
  rebookError.value      = ''
  rebookFlights.value    = []
  selectedFlightId.value = ''
  rebookSeats.value      = []
  selectedSeatId.value   = ''
  try {
    const b      = rebookTarget.value
    const origin = b.flightId?.originAirportId?._id      || b.flightId?.originAirportId
    const dest   = b.flightId?.destinationAirportId?._id || b.flightId?.destinationAirportId
    const res    = await searchFlights(origin, dest, rebookDate.value)
    rebookFlights.value = res?.result || res?.flights || (Array.isArray(res) ? res : [])
    if (rebookFlights.value.length === 0) {
      rebookError.value = 'No flights found on that date for this route.'
    }
  } catch (err) {
    rebookError.value = err.response?.data?.message || 'Could not fetch available flights.'
  } finally {
    rebookLoading.value = false
  }
}

async function selectRebookFlight(flightId) {
  selectedFlightId.value = flightId
  selectedSeatId.value   = ''
  rebookSeats.value      = []
  seatsLoading.value     = true
  rebookError.value      = ''
  try {
    const res = await getSeatsByFlight(flightId)
    rebookSeats.value = (res?.result || res?.seats || []).filter(s => s.isAvailable !== false)
  } catch (err) {
    rebookError.value = 'Could not load seats for this flight.'
  } finally {
    seatsLoading.value = false
  }
}

async function confirmRebook() {
  if (!selectedFlightId.value) { rebookError.value = 'Please select a flight.'; return }
  if (!selectedSeatId.value)   { rebookError.value = 'Please select a seat.'; return }
  rebookSubmitting.value = true
  rebookError.value      = ''
  try {
    await rescheduleBookingUser(rebookTarget.value.bookingReference, {
      newFlightId: selectedFlightId.value,
      newSeatId:   selectedSeatId.value
    })
    closeRebookModal()
    await loadBookings()
  } catch (err) {
    rebookError.value = err.response?.data?.message || 'Rebook failed. Please try again.'
  } finally {
    rebookSubmitting.value = false
  }
}

// ── Formatters ─────────────────────────────────────────────────────────────
function formatTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit'
  })
}
function formatDateLabel(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-PH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })
}
function formatTimeOnly(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit'
  })
}
function calcTravelTime(departure, arrival) {
  if (!departure || !arrival) return ''
  const diff = new Date(arrival) - new Date(departure)
  if (diff <= 0) return ''
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m`
}
function statusBadgeClass(status) {
  if (status === 'cancelled') return 'fc-badge cancelled'
  if (status === 'pending')   return 'fc-badge pending'
  return 'fc-badge success'
}
function statusIcon(status) {
  if (status === 'cancelled') return 'bi-x-circle-fill'
  if (status === 'pending')   return 'bi-clock-fill'
  return 'bi-check-circle-fill'
}
function seatClassLabel(cls) {
  if (!cls) return ''
  return cls.charAt(0).toUpperCase() + cls.slice(1)
}
function isUpcoming(booking) {
  const dep = booking.flightId?.departureTime
  return dep ? new Date(dep) > new Date() : true
}

// ── Enrich a single booking ────────────────────────────────────────────────
async function enrichBooking(b, passengerMap = new Map()) {
  try {
    const bkpRes = await getPassengersByBooking(b._id)
    const bkp    = bkpRes?.result?.find(r => r.isActive) ?? bkpRes?.result?.[0]
    if (!bkp) return b

    b.ticketNumber = bkp.ticketNumber ?? null

    const passengerId = bkp.passengerId?._id
      ? String(bkp.passengerId._id)
      : bkp.passengerId
        ? String(bkp.passengerId)
        : null

    if (passengerId) {
      let passenger = passengerMap.get(passengerId) ?? null
      if (!passenger) {
        try {
          const pRes = await getPassengerById(passengerId)
          passenger  = pRes?.result ?? null
        } catch { /* leave null */ }
      }
      if (passenger) {
        b.passengerName = [passenger.firstName, passenger.lastName]
          .filter(Boolean).join(' ') || null
      }
    }

    if (bkp.seatId) {
      try {
        const seatRes = await getSeatById(bkp.seatId)
        b.seat = seatRes?.result ?? null
      } catch { b.seat = null }
    }
  } catch { /* silent */ }
  return b
}

// ── Load bookings ──────────────────────────────────────────────────────────
async function loadBookings() {
  loading.value     = true
  errorMsg.value    = ''
  openDetails.value = new Set()
  try {
    const res = await getMyBookingsUser()
    const raw = res?.bookings || res?.result || (Array.isArray(res) ? res : [])

    const passengerMap = new Map()
    try {
      const pRes = await getMyPassengers()
      for (const p of pRes?.passengers ?? pRes?.result ?? []) {
        passengerMap.set(String(p._id), p)
      }
    } catch { /* map stays empty */ }

    bookings.value = await Promise.all(raw.map(b => enrichBooking(b, passengerMap)))
  } catch (err) {
    if (err.response?.status === 404) {
      bookings.value = []
    } else {
      errorMsg.value = err.response?.data?.message || 'Could not load your bookings right now.'
    }
  } finally {
    loading.value     = false
    hasSearched.value = true
  }
}

async function lookupGuestBookings() {
  if (!guestEmailInput.value || !guestEmailInput.value.includes('@')) {
    errorMsg.value = 'Please enter a valid email address.'
    return
  }
  loading.value     = true
  errorMsg.value    = ''
  openDetails.value = new Set()
  try {
    const res = await getMyBookingsGuest({ guestEmail: guestEmailInput.value })
    const raw      = res?.result || res?.data || (Array.isArray(res) ? res : [])
    bookings.value = await Promise.all(raw.map(b => enrichBooking(b, new Map())))
  } catch (err) {
    bookings.value = []
    errorMsg.value = err.response?.data?.message || 'No bookings found for that email.'
  } finally {
    loading.value     = false
    hasSearched.value = true
  }
}

async function cancelBooking(booking) {
  if (!window.confirm(`Cancel booking ${booking.bookingReference}? This cannot be undone.`)) return
  cancellingRef.value = booking.bookingReference
  errorMsg.value      = ''
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

onMounted(() => {
  if (isLoggedIn.value) loadBookings()
})
</script>

<template>
  <div class="page active">
    <div class="inner-page">
      <div class="bk-page-wrapper">
        <div class="bk-container">

          <!-- Breadcrumb -->
          <nav class="theme-breadcrumb" aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item">
                <RouterLink :to="{ name: 'Home' }">Home</RouterLink>
              </li>
              <li class="breadcrumb-item active">My Bookings</li>
            </ol>
          </nav>

          <!-- Page header -->
          <div class="bk-page-header">
            <div>
              <h1 class="bk-page-title">My <em class="gold">Bookings</em></h1>
              <p class="bk-page-sub">Manage, rebook, or cancel your upcoming flights.</p>
            </div>
            <div v-if="bookings.length > 0" class="bk-booking-count">
              <span class="bk-count-num">{{ bookings.length }}</span>
              <span class="bk-count-label">{{ bookings.length === 1 ? 'booking' : 'bookings' }}</span>
            </div>
          </div>

          <!-- Guest email lookup -->
          <div v-if="!isLoggedIn" class="bk-guest-lookup">
            <div class="bk-guest-icon"><i class="bi bi-envelope-open"></i></div>
            <div class="bk-guest-content">
              <p class="bk-guest-title">Find your booking</p>
              <p class="bk-guest-sub">Enter the email used when you booked.</p>
              <div class="bk-guest-row">
                <input
                  type="email"
                  class="f-input bk-guest-input"
                  v-model="guestEmailInput"
                  placeholder="you@email.com"
                  @keyup.enter="lookupGuestBookings"
                />
                <button class="bk-find-btn" @click="lookupGuestBookings">
                  <i class="bi bi-search me-1"></i> Find
                </button>
              </div>
              <p class="bk-guest-login-hint">
                Booked while logged in?
                <RouterLink :to="{ name: 'Login', query: { redirect: '/my-bookings' } }" class="gold-link">
                  Sign in to see all your trips →
                </RouterLink>
              </p>
            </div>
          </div>

          <!-- Error -->
          <div v-if="errorMsg" class="bk-error-banner">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ errorMsg }}
          </div>

          <!-- Loading -->
          <div v-if="loading" class="bk-loading">
            <div class="bk-spinner"></div>
            <span class="bk-loading-label">Loading your bookings…</span>
          </div>

          <!-- Empty state -->
          <div v-else-if="hasSearched && bookings.length === 0" class="bk-empty">
            <div class="bk-empty-icon"><i class="bi bi-calendar-x"></i></div>
            <p class="bk-empty-title">No bookings found</p>
            <p class="bk-empty-sub">Ready to go somewhere?</p>
            <RouterLink :to="{ name: 'SearchFlights' }" class="bk-search-cta">
              <i class="bi bi-search me-2"></i>Search flights
            </RouterLink>
          </div>

          <!-- ── Booking cards ──────────────────────────────────────────── -->
          <div class="bk-list">
            <div
              v-for="(booking, idx) in bookings"
              :key="booking._id"
              class="bk-card"
              :class="{ 'is-cancelled': booking.status === 'cancelled' }"
            >

              <!-- Card top bar: status + ref -->
              <div class="bk-card-topbar">
                <div class="bk-topbar-left">
                  <span :class="statusBadgeClass(booking.status)">
                    <i :class="`bi ${statusIcon(booking.status)} me-1`"></i>
                    {{ booking.status }}
                  </span>
                  <span class="bk-ref-pill">
                    <i class="bi bi-hash me-1"></i>{{ booking.bookingReference }}
                  </span>
                  <span v-if="booking.checkedIn" class="bk-checkedin-pill">
                    <i class="bi bi-qr-code-scan me-1"></i>Checked in
                  </span>
                </div>
                <div class="bk-topbar-price">
                  ₱{{ booking.totalAmount?.toLocaleString() }}
                </div>
              </div>

              <!-- Flight route row -->
              <div class="bk-route-row">

                <!-- Origin -->
                <div class="bk-endpoint">
                  <div class="bk-iata">
                    {{ booking.flightId?.originAirportId?.iataCode || 'DEP' }}
                  </div>
                  <div class="bk-city">
                    {{ booking.flightId?.originAirportId?.city || 'Departure' }}
                  </div>
                  <div class="bk-time">{{ formatTime(booking.flightId?.departureTime) }}</div>
                  <div class="bk-date">{{ formatDateLabel(booking.flightId?.departureTime) }}</div>
                </div>

                <!-- Mid / timeline -->
                <div class="bk-mid">
                  <div class="bk-duration">
                    {{ calcTravelTime(booking.flightId?.departureTime, booking.flightId?.arrivalTime) }}
                  </div>
                  <div class="bk-line-wrap">
                    <div class="bk-line-dot"></div>
                    <div class="bk-line-track">
                      <i class="bi bi-airplane-fill bk-plane-icon"></i>
                    </div>
                    <div class="bk-line-dot"></div>
                  </div>
                  <div class="bk-airline">
                    {{ booking.flightId?.airlineId?.name || '' }}
                  </div>
                </div>

                <!-- Destination -->
                <div class="bk-endpoint bk-endpoint--right">
                  <div class="bk-iata">
                    {{ booking.flightId?.destinationAirportId?.iataCode || 'ARR' }}
                  </div>
                  <div class="bk-city">
                    {{ booking.flightId?.destinationAirportId?.city || 'Arrival' }}
                  </div>
                  <div class="bk-time">{{ formatTime(booking.flightId?.arrivalTime) }}</div>
                  <div class="bk-date">{{ formatDateLabel(booking.flightId?.arrivalTime) }}</div>
                </div>

              </div>

              <!-- Action buttons row -->
              <div class="bk-actions">
                <RouterLink
                  v-if="booking.status === 'confirmed' && !booking.checkedIn && isUpcoming(booking)"
                  :to="{ name: 'CheckIn', query: { ref: booking.bookingReference } }"
                  class="bk-btn bk-btn--checkin"
                >
                  <i class="bi bi-qr-code-scan"></i>
                  <span>Check-in</span>
                </RouterLink>

                <button
                  v-if="booking.status !== 'cancelled' && isUpcoming(booking)"
                  class="bk-btn bk-btn--rebook"
                  @click="openRebookModal(booking)"
                >
                  <i class="bi bi-arrow-repeat"></i>
                  <span>Rebook</span>
                </button>

                <button
                  v-if="booking.status !== 'cancelled' && !booking.checkedIn"
                  class="bk-btn bk-btn--cancel"
                  :disabled="cancellingRef === booking.bookingReference"
                  @click="cancelBooking(booking)"
                >
                  <i class="bi bi-x-circle"></i>
                  <span>{{ cancellingRef === booking.bookingReference ? 'Cancelling…' : 'Cancel' }}</span>
                </button>

                <button
                  class="bk-btn bk-btn--details"
                  @click="toggleDetails(booking._id)"
                >
                  <i :class="`bi ${openDetails.has(booking._id) ? 'bi-chevron-up' : 'bi-chevron-down'}`"></i>
                  <span>{{ openDetails.has(booking._id) ? 'Less' : 'Details' }}</span>
                </button>
              </div>

              <!-- ── Detail panel ────────────────────────────────────── -->
              <transition name="bk-slide">
                <div v-if="openDetails.has(booking._id)" class="bk-detail">

                  <div class="bk-detail-grid">
                    <div class="bk-ditem">
                      <span class="bk-dlabel">Flight</span>
                      <span class="bk-dvalue">
                        {{ booking.flightId?.flightNumber || '—' }}
                        <span v-if="booking.flightId?.airlineId?.name" class="bk-dsub">
                          · {{ booking.flightId.airlineId.name }}
                        </span>
                      </span>
                    </div>

                    <div class="bk-ditem">
                      <span class="bk-dlabel">Passenger</span>
                      <span class="bk-dvalue">{{ booking.passengerName || '—' }}</span>
                    </div>

                    <div class="bk-ditem">
                      <span class="bk-dlabel">Seat</span>
                      <span class="bk-dvalue">
                        <template v-if="booking.seat">
                          {{ booking.seat.seatNumber }}
                          <span class="bk-seat-badge" :class="booking.seat.class">
                            {{ seatClassLabel(booking.seat.class) }}
                          </span>
                        </template>
                        <template v-else>—</template>
                      </span>
                    </div>

                    <div class="bk-ditem">
                      <span class="bk-dlabel">Ticket No.</span>
                      <span class="bk-dvalue bk-mono">{{ booking.ticketNumber || '—' }}</span>
                    </div>

                    <div class="bk-ditem">
                      <span class="bk-dlabel">Dep. Terminal</span>
                      <span class="bk-dvalue">
                        {{ booking.flightId?.originTerminal
                          ? 'Terminal ' + booking.flightId.originTerminal : '—' }}
                      </span>
                    </div>

                    <div class="bk-ditem">
                      <span class="bk-dlabel">Arr. Terminal</span>
                      <span class="bk-dvalue">
                        {{ booking.flightId?.destinationTerminal
                          ? 'Terminal ' + booking.flightId.destinationTerminal : '—' }}
                      </span>
                    </div>
                  </div>

                  <!-- Times -->
                  <div class="bk-times">
                    <div class="bk-tblock">
                      <span class="bk-dlabel">Departure</span>
                      <span class="bk-tbig">{{ formatTimeOnly(booking.flightId?.departureTime) }}</span>
                      <span class="bk-tdate">{{ formatDateLabel(booking.flightId?.departureTime) }}</span>
                    </div>
                    <div class="bk-tarrow"><i class="bi bi-arrow-right"></i></div>
                    <div class="bk-tblock">
                      <span class="bk-dlabel">Arrival</span>
                      <span class="bk-tbig">{{ formatTimeOnly(booking.flightId?.arrivalTime) }}</span>
                      <span class="bk-tdate">{{ formatDateLabel(booking.flightId?.arrivalTime) }}</span>
                    </div>
                  </div>

                </div>
              </transition>

            </div>
          </div>
          <!-- /booking cards -->

        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- REBOOK MODAL                                                          -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <teleport to="body">
    <transition name="rb-fade">
      <div
        v-if="rebookTarget"
        class="rb-overlay"
        @click.self="closeRebookModal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="rebookStep === 'confirm' ? 'rb-confirm-title' : 'rb-search-title'"
      >
        <transition name="rb-slide-up">
          <div class="rb-modal" v-if="rebookTarget">

            <!-- ── STEP 1: Confirm ──────────────────────────────────── -->
            <template v-if="rebookStep === 'confirm'">

              <div class="rb-header">
                <div class="rb-header-icon">
                  <i class="bi bi-arrow-repeat"></i>
                </div>
                <div class="flex-grow-1">
                  <h5 id="rb-confirm-title" class="rb-modal-title">Rebook this flight?</h5>
                  <p class="rb-modal-sub">Ref: {{ rebookTarget.bookingReference }}</p>
                </div>
                <button class="rb-close" @click="closeRebookModal" aria-label="Close">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>

              <div class="rb-confirm-body">

                <!-- Current flight summary card -->
                <div class="rb-summary-card">
                  <div class="rb-summary-airports">
                    <div class="rb-sum-endpoint">
                      <div class="rb-sum-iata">
                        {{ rebookTarget.flightId?.originAirportId?.iataCode || 'DEP' }}
                      </div>
                      <div class="rb-sum-city">
                        {{ rebookTarget.flightId?.originAirportId?.city || 'Origin' }}
                      </div>
                      <div class="rb-sum-time">
                        {{ formatTimeOnly(rebookTarget.flightId?.departureTime) }}
                      </div>
                    </div>

                    <div class="rb-sum-mid">
                      <div class="rb-sum-duration">
                        {{ calcTravelTime(rebookTarget.flightId?.departureTime, rebookTarget.flightId?.arrivalTime) }}
                      </div>
                      <div class="rb-sum-track">
                        <div class="rb-sum-dot"></div>
                        <div class="rb-sum-line">
                          <i class="bi bi-airplane-fill rb-sum-plane"></i>
                        </div>
                        <div class="rb-sum-dot"></div>
                      </div>
                      <div class="rb-sum-airline">
                        {{ rebookTarget.flightId?.airlineId?.name || '' }}
                      </div>
                    </div>

                    <div class="rb-sum-endpoint rb-sum-endpoint--right">
                      <div class="rb-sum-iata">
                        {{ rebookTarget.flightId?.destinationAirportId?.iataCode || 'ARR' }}
                      </div>
                      <div class="rb-sum-city">
                        {{ rebookTarget.flightId?.destinationAirportId?.city || 'Destination' }}
                      </div>
                      <div class="rb-sum-time">
                        {{ formatTimeOnly(rebookTarget.flightId?.arrivalTime) }}
                      </div>
                    </div>
                  </div>

                  <div class="rb-summary-date">
                    <i class="bi bi-calendar3 me-2"></i>
                    {{ formatDateLabel(rebookTarget.flightId?.departureTime) }}
                  </div>
                </div>

                <!-- Notice -->
                <div class="rb-notice">
                  <i class="bi bi-info-circle-fill rb-notice-icon"></i>
                  <p class="rb-notice-text">
                    You're about to rebook this flight. You'll choose a new date, flight, and seat on the next screen.
                    Any fare difference may apply.
                  </p>
                </div>

              </div>

              <div class="rb-footer">
                <button class="rb-btn rb-btn--ghost" @click="closeRebookModal">
                  Keep current flight
                </button>
                <button class="rb-btn rb-btn--primary" @click="proceedToSearch">
                  Continue <i class="bi bi-arrow-right ms-2"></i>
                </button>
              </div>

            </template>
            <!-- /step 1 -->

            <!-- ── STEP 2: Search & seat picker ─────────────────────── -->
            <template v-if="rebookStep === 'search'">

              <div class="rb-header">
                <button
                  class="rb-back"
                  @click="rebookStep = 'confirm'"
                  aria-label="Back"
                  :disabled="rebookSubmitting"
                >
                  <i class="bi bi-arrow-left"></i>
                </button>
                <div class="flex-grow-1">
                  <h5 id="rb-search-title" class="rb-modal-title">
                    Choose a new flight
                    <span class="rb-ref-inline">· {{ rebookTarget.bookingReference }}</span>
                  </h5>
                </div>
                <button
                  class="rb-close"
                  @click="closeRebookModal"
                  aria-label="Close"
                  :disabled="rebookSubmitting"
                >
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>

              <!-- Route strip -->
              <div class="rb-route-strip">
                <div class="rb-strip-route">
                  <span class="rb-strip-iata">{{ rebookTarget.flightId?.originAirportId?.iataCode || 'DEP' }}</span>
                  <i class="bi bi-arrow-right rb-strip-arrow"></i>
                  <span class="rb-strip-iata">{{ rebookTarget.flightId?.destinationAirportId?.iataCode || 'ARR' }}</span>
                </div>
                <span class="rb-strip-current">
                  Currently: {{ formatDateLabel(rebookTarget.flightId?.departureTime) }}
                </span>
              </div>

              <div class="rb-search-body">

                <!-- Step indicators -->
                <div class="rb-steps">
                  <div class="rb-step" :class="{ active: true, done: !!selectedFlightId }">
                    <div class="rb-step-num">
                      <i v-if="selectedFlightId" class="bi bi-check-lg"></i>
                      <span v-else>1</span>
                    </div>
                    <span class="rb-step-label">Date</span>
                  </div>
                  <div class="rb-step-line"></div>
                  <div class="rb-step" :class="{ active: rebookFlights.length > 0, done: !!selectedFlightId }">
                    <div class="rb-step-num">
                      <i v-if="selectedFlightId" class="bi bi-check-lg"></i>
                      <span v-else>2</span>
                    </div>
                    <span class="rb-step-label">Flight</span>
                  </div>
                  <div class="rb-step-line"></div>
                  <div class="rb-step" :class="{ active: !!selectedFlightId }">
                    <div class="rb-step-num">3</div>
                    <span class="rb-step-label">Seat</span>
                  </div>
                </div>

                <!-- Date + search -->
                <div class="rb-section">
                  <label class="rb-label">Select a new date</label>
                  <div class="rb-date-row">
                    <input
                      type="date"
                      class="f-input rb-date-input"
                      v-model="rebookDate"
                      :min="new Date().toISOString().slice(0, 10)"
                    />
                    <button
                      class="rb-btn rb-btn--primary rb-search-btn"
                      :disabled="rebookLoading || !rebookDate"
                      @click="searchRebookFlights"
                    >
                      <span v-if="rebookLoading" class="rb-spinner"></span>
                      {{ rebookLoading ? 'Searching…' : 'Find Flights' }}
                    </button>
                  </div>
                </div>

                <!-- Flight list -->
                <transition name="rb-fade">
                  <div v-if="rebookFlights.length > 0" class="rb-section">
                    <label class="rb-label">Available flights</label>
                    <div class="rb-flight-list">
                      <div
                        v-for="flight in rebookFlights"
                        :key="flight._id"
                        class="rb-flight-row"
                        :class="{ selected: selectedFlightId === flight._id }"
                        @click="selectRebookFlight(flight._id)"
                        role="button"
                        tabindex="0"
                        @keyup.enter="selectRebookFlight(flight._id)"
                      >
                        <div class="rb-flight-left">
                          <div class="rb-flight-times">
                            <span class="rb-ftime">{{ formatTimeOnly(flight.departureTime) }}</span>
                            <i class="bi bi-arrow-right rb-time-arrow"></i>
                            <span class="rb-ftime">{{ formatTimeOnly(flight.arrivalTime) }}</span>
                          </div>
                          <div class="rb-flight-meta">
                            {{ flight.flightNumber }}
                            <span v-if="flight.airlineId?.name"> · {{ flight.airlineId.name }}</span>
                            <span class="rb-flight-dur">{{ calcTravelTime(flight.departureTime, flight.arrivalTime) }}</span>
                          </div>
                        </div>
                        <div class="rb-flight-right">
                          <div class="rb-flight-price">
                            ₱{{ (flight.basePrice ?? flight.price ?? flight.economyPrice)?.toLocaleString() || '—' }}
                          </div>
                          <i v-if="selectedFlightId === flight._id" class="bi bi-check-circle-fill rb-tick"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </transition>

                <!-- Seat picker -->
                <transition name="rb-fade">
                  <div v-if="selectedFlightId" class="rb-section">
                    <label class="rb-label">Choose a seat</label>

                    <div v-if="seatsLoading" class="rb-seats-loading">
                      <span class="rb-spinner"></span>
                      <span>Loading seats…</span>
                    </div>

                    <p v-else-if="rebookSeats.length === 0" class="rb-no-seats">
                      No seats available for this flight.
                    </p>

                    <div v-else class="rb-seat-grid">
                      <button
                        v-for="seat in rebookSeats"
                        :key="seat._id"
                        class="rb-seat"
                        :class="{
                          selected:  selectedSeatId === seat._id,
                          business:  seat.class === 'business',
                          first:     seat.class === 'first',
                          economy:   seat.class === 'economy'
                        }"
                        @click="selectedSeatId = seat._id"
                        :title="seat.class"
                      >
                        <span class="rb-seat-num">{{ seat.seatNumber }}</span>
                        <span class="rb-seat-cls">{{ seat.class }}</span>
                      </button>
                    </div>
                  </div>
                </transition>

                <!-- Error -->
                <div v-if="rebookError" class="rb-error">
                  <i class="bi bi-exclamation-circle-fill me-2"></i>{{ rebookError }}
                </div>

              </div>

              <div class="rb-footer">
                <button
                  class="rb-btn rb-btn--ghost"
                  :disabled="rebookSubmitting"
                  @click="closeRebookModal"
                >
                  Cancel
                </button>
                <button
                  class="rb-btn rb-btn--primary"
                  :disabled="!selectedFlightId || !selectedSeatId || rebookSubmitting"
                  @click="confirmRebook"
                >
                  <span v-if="rebookSubmitting" class="rb-spinner me-1"></span>
                  {{ rebookSubmitting ? 'Confirming…' : 'Confirm Rebook' }}
                </button>
              </div>

            </template>
            <!-- /step 2 -->

          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
/* ─────────────────────────────────────────────────────────────────────────
   PAGE LAYOUT
───────────────────────────────────────────────────────────────────────── */
.bk-page-wrapper {
  padding: 40px 16px 80px;
}
.bk-container {
  max-width: 860px;
  margin: 0 auto;
}

.bk-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 24px 0 28px;
  gap: 16px;
}
.bk-page-title {
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  font-weight: 800;
  color: #f0f0f0;
  margin: 0 0 4px;
  letter-spacing: -0.02em;
}
.bk-page-sub {
  font-size: 0.85rem;
  color: #777;
  margin: 0;
}
.bk-booking-count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  flex-shrink: 0;
}
.bk-count-num {
  font-size: 1.8rem;
  font-weight: 800;
  color: #d4a843;
  line-height: 1;
}
.bk-count-label {
  font-size: 0.72rem;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ─────────────────────────────────────────────────────────────────────────
   GUEST LOOKUP
───────────────────────────────────────────────────────────────────────── */
.bk-guest-lookup {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(212,168,67,0.18);
  border-radius: 14px;
  padding: 20px 22px;
  margin-bottom: 28px;
}
.bk-guest-icon {
  width: 42px;
  height: 42px;
  background: rgba(212,168,67,0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d4a843;
  font-size: 1.1rem;
  flex-shrink: 0;
}
.bk-guest-content { flex: 1; }
.bk-guest-title   { font-size: 0.95rem; font-weight: 700; color: #e8e8e8; margin: 0 0 2px; }
.bk-guest-sub     { font-size: 0.78rem; color: #888; margin: 0 0 12px; }
.bk-guest-row     { display: flex; gap: 8px; }
.bk-guest-input   { flex: 1; }
.bk-find-btn {
  white-space: nowrap;
  padding: 8px 18px;
  background: #d4a843;
  color: #0e0e1a;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.bk-find-btn:hover  { background: #e0b84d; }
.bk-find-btn:active { transform: scale(0.97); }
.bk-guest-login-hint {
  font-size: 0.75rem;
  color: #777;
  margin: 10px 0 0;
}

/* ─────────────────────────────────────────────────────────────────────────
   ERROR / LOADING / EMPTY
───────────────────────────────────────────────────────────────────────── */
.bk-error-banner {
  background: rgba(255,77,77,0.1);
  border: 1px solid rgba(255,77,77,0.3);
  color: #ff8080;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 0.85rem;
  margin-bottom: 20px;
}
.bk-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 60px 0;
}
.bk-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(212,168,67,0.2);
  border-top-color: #d4a843;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
.bk-loading-label { font-size: 0.85rem; color: #888; }
.bk-empty {
  text-align: center;
  padding: 70px 20px;
}
.bk-empty-icon {
  width: 60px;
  height: 60px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #555;
  margin: 0 auto 16px;
}
.bk-empty-title { font-size: 1rem; font-weight: 700; color: #ccc; margin: 0 0 6px; }
.bk-empty-sub   { font-size: 0.82rem; color: #666; margin: 0 0 20px; }
.bk-search-cta {
  display: inline-flex;
  align-items: center;
  padding: 10px 22px;
  background: #d4a843;
  color: #0e0e1a;
  font-weight: 700;
  font-size: 0.85rem;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.15s;
}
.bk-search-cta:hover { background: #e0b84d; color: #0e0e1a; }

/* ─────────────────────────────────────────────────────────────────────────
   BOOKING LIST
───────────────────────────────────────────────────────────────────────── */
.bk-list { display: flex; flex-direction: column; gap: 16px; }

/* ─────────────────────────────────────────────────────────────────────────
   BOOKING CARD
───────────────────────────────────────────────────────────────────────── */
.bk-card {
  background: #14142a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  overflow: hidden;
  transition: opacity 0.2s, border-color 0.2s;
  box-shadow: 0 4px 24px rgba(0,0,0,0.25);
}
.bk-card:hover          { border-color: rgba(212,168,67,0.22); }
.bk-card.is-cancelled   { opacity: 0.55; }

/* Top bar */
.bk-card-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
}
.bk-topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.bk-topbar-price {
  font-size: 1.1rem;
  font-weight: 800;
  color: #d4a843;
  white-space: nowrap;
}

/* Badge variants */
.fc-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 9px;
  border-radius: 20px;
}
.fc-badge.success   { background: rgba(40,167,69,0.15);   color: #4caf7d; border: 1px solid rgba(40,167,69,0.3); }
.fc-badge.pending   { background: rgba(255,193,7,0.12);   color: #ffc107; border: 1px solid rgba(255,193,7,0.3); }
.fc-badge.cancelled { background: rgba(255,77,77,0.12);   color: #ff6b6b; border: 1px solid rgba(255,77,77,0.3); }

.bk-ref-pill {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  color: #888;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  padding: 3px 8px;
  border-radius: 20px;
  font-family: monospace;
}
.bk-checkedin-pill {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  color: #4caf7d;
  background: rgba(40,167,69,0.1);
  border: 1px solid rgba(40,167,69,0.25);
  padding: 3px 8px;
  border-radius: 20px;
}

/* Route row */
.bk-route-row {
  display: flex;
  align-items: center;
  padding: 20px 20px 16px;
  gap: 12px;
}
.bk-endpoint {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.bk-endpoint--right { text-align: right; }
.bk-iata {
  font-size: 1.8rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.02em;
  line-height: 1;
}
.bk-city   { font-size: 0.72rem; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-time   { font-size: 0.95rem; font-weight: 700; color: #e0e0e0; margin-top: 4px; }
.bk-date   { font-size: 0.7rem; color: #777; }

/* Flight timeline */
.bk-mid {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  min-width: 100px;
}
.bk-duration { font-size: 0.7rem; color: #888; letter-spacing: 0.04em; }
.bk-line-wrap {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0;
}
.bk-line-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(212,168,67,0.5);
  flex-shrink: 0;
}
.bk-line-track {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(212,168,67,0.3), rgba(212,168,67,0.6), rgba(212,168,67,0.3));
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.bk-plane-icon {
  color: #d4a843;
  font-size: 0.85rem;
  background: #14142a;
  padding: 0 4px;
  position: relative;
}
.bk-airline { font-size: 0.68rem; color: #777; text-align: center; }

/* Action buttons */
.bk-actions {
  display: flex;
  gap: 8px;
  padding: 0 20px 16px;
  flex-wrap: wrap;
}
.bk-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s, transform 0.1s;
  border: 1px solid transparent;
  text-decoration: none;
  white-space: nowrap;
}
.bk-btn:active          { transform: scale(0.96); }
.bk-btn:disabled        { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

.bk-btn--checkin {
  background: rgba(212,168,67,0.12);
  color: #d4a843;
  border-color: rgba(212,168,67,0.4);
}
.bk-btn--checkin:hover  { background: rgba(212,168,67,0.22); }

.bk-btn--rebook {
  background: transparent;
  color: #8ecdf7;
  border-color: rgba(142,205,247,0.4);
}
.bk-btn--rebook:hover   { background: rgba(142,205,247,0.08); }

.bk-btn--cancel {
  background: transparent;
  color: #ff7070;
  border-color: rgba(255,112,112,0.4);
}
.bk-btn--cancel:hover   { background: rgba(255,112,112,0.08); }

.bk-btn--details {
  background: transparent;
  color: #777;
  border-color: rgba(255,255,255,0.1);
  margin-left: auto;
}
.bk-btn--details:hover  { color: #d4a843; border-color: rgba(212,168,67,0.4); }

/* ─────────────────────────────────────────────────────────────────────────
   DETAIL PANEL
───────────────────────────────────────────────────────────────────────── */
.bk-detail {
  background: #0f0f22;
  border-top: 1px solid rgba(212,168,67,0.12);
  padding: 20px 20px 22px;
}
.bk-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 12px;
  margin-bottom: 20px;
}
@media (max-width: 580px) {
  .bk-detail-grid { grid-template-columns: repeat(2, 1fr); }
}
.bk-ditem   { display: flex; flex-direction: column; gap: 4px; }
.bk-dlabel  { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.09em; color: #666; }
.bk-dvalue  { font-size: 0.88rem; color: #ddd; font-weight: 500; }
.bk-dsub    { color: #777; font-weight: 400; }
.bk-mono    { font-family: monospace; font-size: 0.8rem; letter-spacing: 0.03em; }

.bk-seat-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  margin-left: 6px;
  text-transform: capitalize;
}
.bk-seat-badge.economy  { background: rgba(40,167,69,0.15);   color: #4caf7d; }
.bk-seat-badge.business { background: rgba(212,168,67,0.15);  color: #d4a843; }
.bk-seat-badge.first    { background: rgba(111,66,193,0.18);  color: #b07eef; }

.bk-times {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.bk-tblock  { display: flex; flex-direction: column; gap: 3px; }
.bk-tbig    { font-size: 1.5rem; font-weight: 800; color: #fff; line-height: 1; }
.bk-tdate   { font-size: 0.72rem; color: #888; }
.bk-tarrow  { color: #d4a843; font-size: 1.1rem; }

/* Slide transition for detail panel */
.bk-slide-enter-active,
.bk-slide-leave-active {
  transition: max-height 0.28s ease, opacity 0.22s ease;
  overflow: hidden;
  max-height: 400px;
}
.bk-slide-enter-from,
.bk-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ─────────────────────────────────────────────────────────────────────────
   REBOOK MODAL
───────────────────────────────────────────────────────────────────────── */
.rb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(4px);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.rb-modal {
  background: #11112a;
  border: 1px solid rgba(212,168,67,0.2);
  border-radius: 16px;
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,168,67,0.06);
}

/* Modal header */
.rb-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}
.rb-header-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(212,168,67,0.1);
  border: 1px solid rgba(212,168,67,0.25);
  color: #d4a843;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}
.rb-modal-title {
  font-size: 0.97rem;
  font-weight: 700;
  color: #e8e8e8;
  margin: 0;
}
.rb-modal-sub {
  font-size: 0.72rem;
  color: #888;
  margin: 3px 0 0;
}
.rb-ref-inline { color: #d4a843; font-size: 0.85rem; }

.rb-close {
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.rb-close:hover:not(:disabled) { color: #fff; background: rgba(255,255,255,0.07); }
.rb-close:disabled              { opacity: 0.35; cursor: not-allowed; }

.rb-back {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: #aaa;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 5px 10px;
  transition: color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.rb-back:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,0.3); }
.rb-back:disabled              { opacity: 0.35; cursor: not-allowed; }

/* Step 1: confirm body */
.rb-confirm-body {
  padding: 22px 20px;
  flex: 1;
  overflow-y: auto;
}

/* Summary card */
.rb-summary-card {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 18px 18px 14px;
  margin-bottom: 16px;
}
.rb-summary-airports {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
.rb-sum-endpoint          { display: flex; flex-direction: column; gap: 3px; }
.rb-sum-endpoint--right   { text-align: right; }
.rb-sum-iata  { font-size: 1.6rem; font-weight: 900; color: #fff; line-height: 1; }
.rb-sum-city  { font-size: 0.68rem; color: #888; }
.rb-sum-time  { font-size: 0.85rem; font-weight: 700; color: #d4a843; margin-top: 3px; }

.rb-sum-mid {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
}
.rb-sum-duration { font-size: 0.68rem; color: #888; }
.rb-sum-track {
  display: flex;
  align-items: center;
  width: 100%;
}
.rb-sum-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(212,168,67,0.5);
  flex-shrink: 0;
}
.rb-sum-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg,
    rgba(212,168,67,0.3), rgba(212,168,67,0.6), rgba(212,168,67,0.3));
  display: flex;
  align-items: center;
  justify-content: center;
}
.rb-sum-plane {
  color: #d4a843;
  font-size: 0.78rem;
  background: #11112a;
  padding: 0 4px;
}
.rb-sum-airline { font-size: 0.65rem; color: #777; }

.rb-summary-date {
  font-size: 0.78rem;
  color: #aaa;
  border-top: 1px solid rgba(255,255,255,0.07);
  padding-top: 10px;
}

/* Notice */
.rb-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(212,168,67,0.06);
  border: 1px solid rgba(212,168,67,0.18);
  border-radius: 10px;
  padding: 12px 14px;
}
.rb-notice-icon { color: #d4a843; font-size: 0.95rem; flex-shrink: 0; margin-top: 1px; }
.rb-notice-text { font-size: 0.8rem; color: #bbb; line-height: 1.55; margin: 0; }

/* Route strip */
.rb-route-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: rgba(212,168,67,0.04);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 6px;
}
.rb-strip-route {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rb-strip-iata    { font-size: 1rem; font-weight: 800; color: #fff; }
.rb-strip-arrow   { color: #d4a843; font-size: 0.85rem; }
.rb-strip-current { font-size: 0.75rem; color: #888; }

/* Step 2: search body */
.rb-search-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.rb-section { margin-bottom: 20px; }
.rb-section:last-child { margin-bottom: 0; }
.rb-label {
  display: block;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #888;
  margin-bottom: 10px;
  font-weight: 700;
}

/* Step indicators */
.rb-steps {
  display: flex;
  align-items: center;
  margin-bottom: 22px;
}
.rb-step {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.3;
  transition: opacity 0.2s;
}
.rb-step.active { opacity: 1; }
.rb-step.done   { opacity: 0.65; }
.rb-step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(212,168,67,0.12);
  border: 1px solid rgba(212,168,67,0.35);
  color: #d4a843;
  font-size: 0.72rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
}
.rb-step.done .rb-step-num { background: rgba(212,168,67,0.22); }
.rb-step-label { font-size: 0.72rem; color: #ccc; white-space: nowrap; }
.rb-step-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin: 0 10px;
  min-width: 18px;
}

/* Date row */
.rb-date-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}
.rb-date-input { flex: 1; }
.rb-search-btn { white-space: nowrap; flex-shrink: 0; }

/* Flight list */
.rb-flight-list { display: flex; flex-direction: column; gap: 8px; }
.rb-flight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  outline: none;
}
.rb-flight-row:hover    { border-color: rgba(212,168,67,0.4); background: rgba(212,168,67,0.04); }
.rb-flight-row.selected { border-color: #d4a843; background: rgba(212,168,67,0.08); }
.rb-flight-row:focus-visible { box-shadow: 0 0 0 2px #d4a843; }

.rb-flight-left  { display: flex; flex-direction: column; gap: 4px; }
.rb-flight-times { display: flex; align-items: center; gap: 4px; }
.rb-ftime        { font-size: 0.95rem; font-weight: 800; color: #e8e8e8; }
.rb-time-arrow   { color: #888; font-size: 0.75rem; }
.rb-flight-meta  { font-size: 0.75rem; color: #888; }
.rb-flight-dur   { margin-left: 8px; color: #666; }

.rb-flight-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.rb-flight-price { font-size: 0.95rem; font-weight: 800; color: #d4a843; }
.rb-tick         { color: #d4a843; font-size: 1rem; }

/* Seat grid */
.rb-seat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.rb-seat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 54px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.03);
  color: #ccc;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.1s;
}
.rb-seat:hover             { border-color: #d4a843; color: #d4a843; transform: translateY(-1px); }
.rb-seat.selected          { border-color: #d4a843; background: rgba(212,168,67,0.14); color: #d4a843; }
.rb-seat.business          { border-color: rgba(212,168,67,0.28); }
.rb-seat.first             { border-color: rgba(111,66,193,0.32); }
.rb-seat.first.selected    { background: rgba(111,66,193,0.15); color: #b07eef; border-color: #b07eef; }
.rb-seat-num { font-size: 0.85rem; font-weight: 800; line-height: 1; }
.rb-seat-cls { font-size: 0.58rem; text-transform: capitalize; opacity: 0.6; margin-top: 2px; }

/* Seats loading */
.rb-seats-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #888;
  font-size: 0.82rem;
  padding: 10px 0;
}
.rb-no-seats { font-size: 0.82rem; color: #777; margin: 0; }

/* Error */
.rb-error {
  background: rgba(255,77,77,0.1);
  border: 1px solid rgba(255,77,77,0.28);
  color: #ff8080;
  border-radius: 9px;
  padding: 10px 14px;
  font-size: 0.82rem;
  margin-top: 12px;
}

/* Footer */
.rb-footer {
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}

/* Modal buttons */
.rb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 9px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, opacity 0.15s, transform 0.1s;
  border: 1px solid transparent;
  white-space: nowrap;
}
.rb-btn:active { transform: scale(0.97); }
.rb-btn:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }

.rb-btn--primary {
  background: #d4a843;
  color: #0e0e1a;
  border-color: #d4a843;
  flex: 1;
}
.rb-btn--primary:hover:not(:disabled) { background: #e0b84d; }

.rb-btn--ghost {
  background: transparent;
  color: #aaa;
  border-color: rgba(255,255,255,0.14);
}
.rb-btn--ghost:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,0.3); }

/* Inline spinner */
.rb-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(14,14,26,0.3);
  border-top-color: #0e0e1a;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ─────────────────────────────────────────────────────────────────────────
   MODAL TRANSITIONS
───────────────────────────────────────────────────────────────────────── */
.rb-fade-enter-active,
.rb-fade-leave-active { transition: opacity 0.22s ease; }
.rb-fade-enter-from,
.rb-fade-leave-to     { opacity: 0; }

.rb-slide-up-enter-active { transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease; }
.rb-slide-up-leave-active { transition: transform 0.2s ease, opacity 0.18s ease; }
.rb-slide-up-enter-from   { transform: translateY(24px) scale(0.97); opacity: 0; }
.rb-slide-up-leave-to     { transform: translateY(12px) scale(0.98); opacity: 0; }

/* ─────────────────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────────────────── */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.gold { color: #d4a843; font-style: italic; }
.gold-link { color: #d4a843; text-decoration: none; }
.gold-link:hover { text-decoration: underline; }
</style>