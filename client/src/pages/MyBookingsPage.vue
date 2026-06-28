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
  getFlightById,
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

// ── Expanded detail panels ─────────────────────────────────────────────────
const openDetails = ref(new Set())

function toggleDetails(id) {
  const next = new Set(openDetails.value)
  next.has(id) ? next.delete(id) : next.add(id)
  openDetails.value = next
}

// ── Rebook modal state ─────────────────────────────────────────────────────
// step: 'confirm' | 'search' | null
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

// Resolved route IDs for the active rebook target. These are the values
// that actually get sent to searchFlights() — never booking.flightId
// directly — so the "Origin Airport ID required" failure mode can't recur
// even if the booking list response is unpopulated or only shallow.
const rebookOriginId    = ref('')
const rebookDestId      = ref('')

// Derived: the full seat object behind the currently selected seat id —
// used to render the seat-confirmation badge once a seat is chosen.
const selectedSeatObj = computed(() =>
  rebookSeats.value.find(s => s._id === selectedSeatId.value) || null
)

async function openRebookModal(booking) {
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
  rebookOriginId.value   = ''
  rebookDestId.value     = ''

  // booking.flightId is usually already populated by enrichBooking()'s
  // backfill by the time we get here. This is a safety net for the rare
  // case that backfill failed silently (caught error) — we resolve real
  // origin/destination IDs before the user can reach the search step, so
  // "Find" never fires with an undefined origin again.
  const flightRef = booking.flightId
  let originId = flightRef?.originAirportId?._id || flightRef?.originAirportId
  let destId   = flightRef?.destinationAirportId?._id || flightRef?.destinationAirportId

  if (!originId || !destId) {
    try {
      const flightId = flightRef?._id || flightRef
      const fRes      = await getFlightById(flightId)
      const flight     = fRes?.result || fRes?.flight || fRes
      if (flight) {
        booking.flightId = flight   // also fixes the card behind the modal
        originId = flight.originAirportId?._id || flight.originAirportId
        destId   = flight.destinationAirportId?._id || flight.destinationAirportId
      }
    } catch {
      rebookError.value = "Couldn't load this flight's route details."
    }
  }

  rebookOriginId.value = originId || ''
  rebookDestId.value   = destId   || ''
}

function proceedToSearch() { rebookStep.value = 'search' }

function closeRebookModal() {
  if (rebookSubmitting.value) return
  rebookTarget.value = null
  rebookStep.value   = null
}

async function searchRebookFlights() {
  if (!rebookDate.value) { rebookError.value = 'Please pick a date.'; return }
  if (!rebookOriginId.value || !rebookDestId.value) {
    rebookError.value = 'Missing route info for this booking — try reopening the rebook dialog.'
    return
  }
  rebookLoading.value    = true
  rebookError.value      = ''
  rebookFlights.value    = []
  selectedFlightId.value = ''
  rebookSeats.value      = []
  selectedSeatId.value   = ''
  try {
    const res = await searchFlights(rebookOriginId.value, rebookDestId.value, rebookDate.value)
    rebookFlights.value = res?.result || res?.flights || (Array.isArray(res) ? res : [])
    if (rebookFlights.value.length === 0)
      rebookError.value = 'No flights available on that date for this route.'
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

    // Success: close the modal immediately, then refresh in the
    // background. `rebookSubmitting` has to be cleared *before* we call
    // closeRebookModal() — that function intentionally refuses to close
    // while a request is in flight (so a stray click mid-submit can't
    // dismiss it), so leaving the flag true here (as the old `finally`
    // did) made the modal silently fail to close on success.
    rebookSubmitting.value = false
    closeRebookModal()

    if (isLoggedIn.value) await loadBookings()
    else await lookupGuestBookings()
  } catch (err) {
    rebookError.value = err.response?.data?.message || 'Rebook failed. Please try again.'
    rebookSubmitting.value = false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
}
function formatDateLabel(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTimeOnly(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
}
function calcTravelTime(departure, arrival) {
  if (!departure || !arrival) return ''
  const diff = new Date(arrival) - new Date(departure)
  if (diff <= 0) return ''
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`
}
function statusBadgeClass(status) {
  if (status === 'cancelled') return 'fc-badge cancelled'
  if (status === 'pending')   return 'fc-badge pending'
  return 'fc-badge success'
}
function seatClassLabel(cls) {
  if (!cls) return ''
  return cls.charAt(0).toUpperCase() + cls.slice(1)
}
function isUpcoming(booking) {
  const dep = booking.flightId?.departureTime
  return dep ? new Date(dep) > new Date() : true
}

// ── Enrich a single booking with passenger + seat data ────────────────────
async function enrichBooking(b, passengerMap = new Map()) {
  // ── Self-heal an unpopulated/shallow flightId ────────────────────────
  // getMyBookingsUser/Guest don't reliably deep-populate flightId, which is
  // why cards were showing "DEP"/"ARR" placeholders and the rebook search
  // threw "Origin Airport ID required" — origin/destAirportId were missing
  // because flightId was just a raw ObjectId string, not the populated doc.
  try {
    const flightRef   = b.flightId
    const flightId     = (flightRef && typeof flightRef === 'object') ? flightRef._id : flightRef
    const isPopulated = !!(flightRef && typeof flightRef === 'object' && flightRef.departureTime)

    if (flightId && !isPopulated) {
      const fRes  = await getFlightById(flightId)
      const flight = fRes?.result || fRes?.flight || fRes
      if (flight) b.flightId = flight
    }
  } catch {
    // leave b.flightId as-is; template falls back to 'DEP'/'ARR'/'—'
  }

  try {
    const bkpRes = await getPassengersByBooking(b._id)
    const bkp    = bkpRes?.result?.find(r => r.isActive) ?? bkpRes?.result?.[0]
    if (!bkp) return b
    b.ticketNumber = bkp.ticketNumber ?? null
    const passengerId = bkp.passengerId?._id
      ? String(bkp.passengerId._id)
      : bkp.passengerId ? String(bkp.passengerId) : null
    if (passengerId) {
      let passenger = passengerMap.get(passengerId) ?? null
      if (!passenger) {
        try { const pRes = await getPassengerById(passengerId); passenger = pRes?.result ?? null } catch {}
      }
      if (passenger) b.passengerName = [passenger.firstName, passenger.lastName].filter(Boolean).join(' ') || null
    }
    if (bkp.seatId) {
      try { const seatRes = await getSeatById(bkp.seatId); b.seat = seatRes?.result ?? null } catch { b.seat = null }
    }
  } catch {}
  return b
}

// ── Load bookings ──────────────────────────────────────────────────────────
async function loadBookings() {
  loading.value = true; errorMsg.value = ''; openDetails.value = new Set()
  try {
    const res = await getMyBookingsUser()
    const raw = res?.bookings || res?.result || (Array.isArray(res) ? res : [])
    const passengerMap = new Map()
    try {
      const pRes = await getMyPassengers()
      for (const p of pRes?.passengers ?? pRes?.result ?? []) passengerMap.set(String(p._id), p)
    } catch {}
    bookings.value = await Promise.all(raw.map(b => enrichBooking(b, passengerMap)))
  } catch (err) {
    if (err.response?.status === 404) bookings.value = []
    else errorMsg.value = err.response?.data?.message || 'Could not load your bookings right now.'
  } finally {
    loading.value = false; hasSearched.value = true
  }
}

async function lookupGuestBookings() {
  if (!guestEmailInput.value || !guestEmailInput.value.includes('@')) {
    errorMsg.value = 'Please enter a valid email address.'; return
  }
  loading.value = true; errorMsg.value = ''; openDetails.value = new Set()
  try {
    const res      = await getMyBookingsGuest({ guestEmail: guestEmailInput.value })
    const raw      = res?.result || res?.data || (Array.isArray(res) ? res : [])
    bookings.value = await Promise.all(raw.map(b => enrichBooking(b, new Map())))
  } catch (err) {
    bookings.value = []; errorMsg.value = err.response?.data?.message || 'No bookings found for that email.'
  } finally {
    loading.value = false; hasSearched.value = true
  }
}

async function cancelBooking(booking) {
  if (!window.confirm(`Cancel booking ${booking.bookingReference}? This cannot be undone.`)) return
  cancellingRef.value = booking.bookingReference; errorMsg.value = ''
  try {
    if (isLoggedIn.value) await cancelBookingUser(booking.bookingReference)
    else await cancelBookingGuest(booking.bookingReference, { guestEmail: guestEmailInput.value })
    booking.status = 'cancelled'
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Could not cancel this booking.'
  } finally {
    cancellingRef.value = ''
  }
}

onMounted(() => { if (isLoggedIn.value) loadBookings() })
</script>

<template>
  <div class="page active">
    <div class="inner-page">
      <div class="bk-page-wrap">
        <div class="container bk-container">

          <nav class="theme-breadcrumb" aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><RouterLink :to="{ name: 'Home' }">Home</RouterLink></li>
              <li class="breadcrumb-item active">My Bookings</li>
            </ol>
          </nav>

          <h1 class="confirm-headline mb-4">My <em class="gold">Bookings</em></h1>

          <!-- ── Guest lookup ───────────────────────────────────────────── -->
          <div v-if="!isLoggedIn" class="booking-section mb-4">
            <div class="bs-body">
              <label class="f-label">Find your bookings by email</label>
              <div class="bk-guest-row">
                <input
                  type="email" class="f-input bk-guest-input"
                  v-model="guestEmailInput" placeholder="you@email.com"
                  @keyup.enter="lookupGuestBookings"
                />
                <button class="fc-select-btn bk-guest-btn" @click="lookupGuestBookings">Find</button>
              </div>
              <p class="bk-guest-hint">
                Booked while logged in?
                <RouterLink :to="{ name: 'Login', query: { redirect: '/my-bookings' } }" class="gold-link">Log in</RouterLink>
                to see everything in one place.
              </p>
            </div>
          </div>

          <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

          <div v-if="loading" class="bk-loading">
            <span class="spinner-border text-warning"></span>
            <span class="bk-loading-text">Loading your bookings…</span>
          </div>

          <div v-else-if="hasSearched && bookings.length === 0" class="bk-empty">
            <i class="bi bi-ticket-perforated bk-empty-icon"></i>
            <p class="bk-empty-text">No bookings found.</p>
            <RouterLink :to="{ name: 'SearchFlights' }" class="gold-link">Search for a flight →</RouterLink>
          </div>

          <!-- ── Booking cards ──────────────────────────────────────────── -->
          <div
            v-for="booking in bookings" :key="booking._id"
            class="bk-card-wrap mb-4"
            :class="{ 'is-cancelled': booking.status === 'cancelled' }"
          >
            <!-- Flight summary row -->
            <div class="bk-flight-row">

              <!-- Tight center block: origin + track + destination move
                   and size as one unit instead of stretching corner to
                   corner. This is the wrapper that fixes the dead space. -->
              <div class="bk-flight-info">

                <!-- Origin -->
                <div class="bk-endpoint">
                  <div class="bk-time">{{ formatTime(booking.flightId?.departureTime) }}</div>
                  <div class="bk-airport">
                    {{ booking.flightId?.originAirportId?.city || booking.flightId?.originAirportId?.iataCode || 'DEP' }}
                  </div>
                  <div class="bk-date">{{ formatDateLabel(booking.flightId?.departureTime) }}</div>
                </div>

                <!-- Track -->
                <div class="bk-track">
                  <div class="bk-duration">{{ calcTravelTime(booking.flightId?.departureTime, booking.flightId?.arrivalTime) }}</div>
                  <div class="bk-track-line">
                    <span class="bk-plane-medallion"><i class="bi bi-airplane-fill"></i></span>
                  </div>
                  <div class="bk-airline-name">{{ booking.flightId?.airlineId?.name || '' }}</div>
                </div>

                <!-- Destination -->
                <div class="bk-endpoint bk-endpoint--right">
                  <div class="bk-time">{{ formatTime(booking.flightId?.arrivalTime) }}</div>
                  <div class="bk-airport">
                    {{ booking.flightId?.destinationAirportId?.city || booking.flightId?.destinationAirportId?.iataCode || 'ARR' }}
                  </div>
                  <div class="bk-date">{{ formatDateLabel(booking.flightId?.arrivalTime) }}</div>
                </div>

              </div>
              <!-- /bk-flight-info -->

              <!-- Action panel -->
              <div class="bk-action-panel">
                <span :class="statusBadgeClass(booking.status)">{{ booking.status }}</span>
                <div class="bk-price">₱{{ booking.totalAmount?.toLocaleString() }}</div>
                <div class="bk-ref">Ref: {{ booking.bookingReference }}</div>
                <div v-if="booking.checkedIn" class="bk-checked-in">
                  <i class="bi bi-check-circle-fill"></i> Checked in
                </div>
                <div class="bk-btn-stack">
                  <RouterLink
                    v-if="booking.status === 'confirmed' && !booking.checkedIn && isUpcoming(booking)"
                    :to="{ name: 'CheckIn', query: { ref: booking.bookingReference } }"
                    class="bk-btn bk-btn--primary"
                  ><i class="bi bi-qr-code-scan"></i> Check-in</RouterLink>

                  <button
                    v-if="booking.status !== 'cancelled' && isUpcoming(booking)"
                    class="bk-btn bk-btn--gold"
                    @click="openRebookModal(booking)"
                  ><i class="bi bi-arrow-repeat"></i> Rebook</button>

                  <button
                    v-if="booking.status !== 'cancelled' && !booking.checkedIn"
                    class="bk-btn bk-btn--danger"
                    :disabled="cancellingRef === booking.bookingReference"
                    @click="cancelBooking(booking)"
                  >
                    <i class="bi bi-x-circle"></i>
                    {{ cancellingRef === booking.bookingReference ? 'Cancelling…' : 'Cancel' }}
                  </button>

                  <button class="bk-btn bk-btn--ghost" @click="toggleDetails(booking._id)">
                    <i :class="`bi ${openDetails.has(booking._id) ? 'bi-chevron-up' : 'bi-chevron-down'}`"></i>
                    {{ openDetails.has(booking._id) ? 'Less info' : 'More info' }}
                  </button>
                </div>
              </div>
            </div>
            <!-- /flight row -->

            <!-- Detail panel -->
            <transition name="bk-slide">
              <div v-if="openDetails.has(booking._id)" class="bk-detail-panel">
                <div class="bk-detail-grid">
                  <div class="bk-detail-cell">
                    <span class="bk-detail-label">Flight</span>
                    <span class="bk-detail-value">
                      {{ booking.flightId?.flightNumber || '—' }}
                      <span v-if="booking.flightId?.airlineId?.name" class="bk-detail-sub">· {{ booking.flightId.airlineId.name }}</span>
                    </span>
                  </div>
                  <div class="bk-detail-cell">
                    <span class="bk-detail-label">Passenger</span>
                    <span class="bk-detail-value">{{ booking.passengerName || '—' }}</span>
                  </div>
                  <div class="bk-detail-cell">
                    <span class="bk-detail-label">Seat</span>
                    <span class="bk-detail-value">
                      <template v-if="booking.seat">
                        {{ booking.seat.seatNumber }}
                        <span class="bk-seat-badge" :class="`bk-seat-badge--${booking.seat.class}`">
                          {{ seatClassLabel(booking.seat.class) }}
                        </span>
                      </template>
                      <template v-else>—</template>
                    </span>
                  </div>
                  <div class="bk-detail-cell">
                    <span class="bk-detail-label">Ticket No.</span>
                    <span class="bk-detail-value bk-detail-mono">{{ booking.ticketNumber || '—' }}</span>
                  </div>
                  <div class="bk-detail-cell">
                    <span class="bk-detail-label">Departure Terminal</span>
                    <span class="bk-detail-value">
                      {{ booking.flightId?.originTerminal ? 'Terminal ' + booking.flightId.originTerminal : '—' }}
                    </span>
                  </div>
                  <div class="bk-detail-cell">
                    <span class="bk-detail-label">Arrival Terminal</span>
                    <span class="bk-detail-value">
                      {{ booking.flightId?.destinationTerminal ? 'Terminal ' + booking.flightId.destinationTerminal : '—' }}
                    </span>
                  </div>
                </div>

                <div class="bk-timebar">
                  <div class="bk-timebar-block">
                    <span class="bk-detail-label">Departure</span>
                    <span class="bk-timebar-time">{{ formatTimeOnly(booking.flightId?.departureTime) }}</span>
                    <span class="bk-timebar-date">{{ formatDateLabel(booking.flightId?.departureTime) }}</span>
                  </div>
                  <i class="bi bi-arrow-right bk-timebar-arrow"></i>
                  <div class="bk-timebar-block">
                    <span class="bk-detail-label">Arrival</span>
                    <span class="bk-timebar-time">{{ formatTimeOnly(booking.flightId?.arrivalTime) }}</span>
                    <span class="bk-timebar-date">{{ formatDateLabel(booking.flightId?.arrivalTime) }}</span>
                  </div>
                </div>
              </div>
            </transition>
          </div>
          <!-- /booking cards -->

        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- REBOOK MODAL                                                         -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <teleport to="body">
    <transition name="rb-fade">
      <div
        v-if="rebookTarget"
        class="rb-overlay"
        @click.self="closeRebookModal"
        role="dialog" aria-modal="true"
      >
        <transition name="rb-slide-up" appear>
          <div class="rb-modal">

            <!-- ── STEP 1: Confirm intent ─────────────────────────────── -->
            <template v-if="rebookStep === 'confirm'">
              <div class="rb-header">
                <div class="rb-header-icon"><i class="bi bi-arrow-repeat"></i></div>
                <div class="rb-header-text">
                  <h5 class="rb-header-title">Rebook this flight?</h5>
                  <p class="rb-header-sub">{{ rebookTarget.bookingReference }}</p>
                </div>
                <button class="rb-close" @click="closeRebookModal" aria-label="Close"><i class="bi bi-x-lg"></i></button>
              </div>

              <div class="rb-confirm-body">
                <div class="rb-summary-card">
                  <div class="rb-summary-endpoints">
                    <div class="rb-summary-ep">
                      <div class="rb-summary-iata">{{ rebookTarget.flightId?.originAirportId?.iataCode || 'DEP' }}</div>
                      <div class="rb-summary-city">{{ rebookTarget.flightId?.originAirportId?.city || 'Origin' }}</div>
                      <div class="rb-summary-time">{{ formatTimeOnly(rebookTarget.flightId?.departureTime) }}</div>
                    </div>
                    <div class="rb-summary-track">
                      <div class="rb-summary-duration">{{ calcTravelTime(rebookTarget.flightId?.departureTime, rebookTarget.flightId?.arrivalTime) }}</div>
                      <div class="rb-summary-track-line">
                        <i class="bi bi-airplane-fill rb-summary-plane"></i>
                      </div>
                      <div class="rb-summary-airline">{{ rebookTarget.flightId?.airlineId?.name || '' }}</div>
                    </div>
                    <div class="rb-summary-ep rb-summary-ep--right">
                      <div class="rb-summary-iata">{{ rebookTarget.flightId?.destinationAirportId?.iataCode || 'ARR' }}</div>
                      <div class="rb-summary-city">{{ rebookTarget.flightId?.destinationAirportId?.city || 'Destination' }}</div>
                      <div class="rb-summary-time">{{ formatTimeOnly(rebookTarget.flightId?.arrivalTime) }}</div>
                    </div>
                  </div>
                  <div class="rb-summary-datebar">
                    <i class="bi bi-calendar3 me-2"></i>{{ formatDateLabel(rebookTarget.flightId?.departureTime) }}
                  </div>
                </div>

                <div class="rb-notice">
                  <i class="bi bi-info-circle-fill rb-notice-icon"></i>
                  <span>You'll choose a new date, flight, and seat on the next screen. Any fare difference may apply.</span>
                </div>
              </div>

              <div class="rb-footer">
                <button class="rb-btn rb-btn--cancel" @click="closeRebookModal">Keep current flight</button>
                <button class="rb-btn rb-btn--primary" @click="proceedToSearch">
                  Continue <i class="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </template>
            <!-- /step 1 -->

            <!-- ── STEP 2: Search & pick ───────────────────────────────── -->
            <template v-if="rebookStep === 'search'">
              <div class="rb-header">
                <button class="rb-back" @click="rebookStep = 'confirm'" :disabled="rebookSubmitting" aria-label="Back">
                  <i class="bi bi-arrow-left"></i>
                </button>
                <div class="rb-header-text">
                  <h5 class="rb-header-title">Choose a new flight</h5>
                  <p class="rb-header-sub">{{ rebookTarget.bookingReference }}</p>
                </div>
                <button class="rb-close" @click="closeRebookModal" :disabled="rebookSubmitting" aria-label="Close">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>

              <div class="rb-route-strip">
                <span class="rb-route-iata">{{ rebookTarget.flightId?.originAirportId?.iataCode || 'DEP' }}</span>
                <i class="bi bi-arrow-right rb-route-arrow"></i>
                <span class="rb-route-iata">{{ rebookTarget.flightId?.destinationAirportId?.iataCode || 'ARR' }}</span>
                <span class="rb-route-current">Currently: {{ formatDateLabel(rebookTarget.flightId?.departureTime) }}</span>
              </div>

              <!-- Step progress -->
              <div class="rb-progress">
                <div class="rb-progress-step" :class="{ 'is-active': true, 'is-done': rebookFlights.length > 0 }">
                  <span class="rb-progress-num">1</span>
                  <span class="rb-progress-label">Date</span>
                </div>
                <div class="rb-progress-line"></div>
                <div class="rb-progress-step" :class="{ 'is-active': rebookFlights.length > 0, 'is-done': !!selectedFlightId }">
                  <span class="rb-progress-num">2</span>
                  <span class="rb-progress-label">Flight</span>
                </div>
                <div class="rb-progress-line"></div>
                <div class="rb-progress-step" :class="{ 'is-active': !!selectedFlightId, 'is-done': !!selectedSeatId }">
                  <span class="rb-progress-num">3</span>
                  <span class="rb-progress-label">Seat</span>
                </div>
              </div>

              <div class="rb-body">

                <!-- Date + search -->
                <div class="rb-field-group">
                  <div class="rb-field-label-row">
                    <label class="f-label">Select a new date</label>
                    <span class="rb-step-pill" :class="{ 'is-done': !!rebookDate }">
                      <i v-if="rebookDate" class="bi bi-check-lg"></i>
                      <template v-else>Step 1</template>
                    </span>
                  </div>
                  <div class="rb-date-row">
                    <div class="rb-tip-anchor">
                      <input type="date" class="f-input rb-date-input" v-model="rebookDate"
                        :min="new Date().toISOString().slice(0, 10)" />
                      <span class="rb-tip">Pick a date, then tap Find</span>
                    </div>
                    <button class="rb-btn rb-btn--primary rb-find-btn"
                      :disabled="rebookLoading || !rebookDate" @click="searchRebookFlights">
                      <span v-if="rebookLoading" class="spinner-border spinner-border-sm"></span>
                      <i v-else class="bi bi-search"></i>
                      {{ rebookLoading ? 'Searching…' : 'Find' }}
                    </button>
                  </div>
                </div>

                <!-- Flight list -->
                <div v-if="rebookFlights.length > 0" class="rb-field-group">
                  <div class="rb-field-label-row">
                    <label class="f-label">Choose a flight</label>
                    <span class="rb-step-pill" :class="{ 'is-done': !!selectedFlightId }">
                      <i v-if="selectedFlightId" class="bi bi-check-lg"></i>
                      <template v-else>Step 2</template>
                    </span>
                  </div>
                  <div class="rb-flight-list">
                    <div
                      v-for="flight in rebookFlights" :key="flight._id"
                      class="rb-flight-card"
                      :class="{ 'is-selected': selectedFlightId === flight._id }"
                      @click="selectRebookFlight(flight._id)"
                      role="radio" :aria-checked="selectedFlightId === flight._id"
                      tabindex="0"
                      @keydown.enter="selectRebookFlight(flight._id)"
                      @keydown.space.prevent="selectRebookFlight(flight._id)"
                    >
                      <span v-if="selectedFlightId !== flight._id" class="rb-fc-tooltip">Select to continue →</span>
                      <div class="rb-fc-left">
                        <div class="rb-fc-times">
                          <span class="rb-fc-time">{{ formatTimeOnly(flight.departureTime) }}</span>
                          <i class="bi bi-arrow-right rb-fc-arrow"></i>
                          <span class="rb-fc-time">{{ formatTimeOnly(flight.arrivalTime) }}</span>
                        </div>
                        <div class="rb-fc-meta">
                          <span>{{ flight.flightNumber }}</span>
                          <span v-if="flight.airlineId?.name" class="rb-fc-dot">·</span>
                          <span v-if="flight.airlineId?.name">{{ flight.airlineId.name }}</span>
                          <span class="rb-fc-dot">·</span>
                          <span>{{ calcTravelTime(flight.departureTime, flight.arrivalTime) }}</span>
                        </div>
                      </div>
                      <div class="rb-fc-right">
                        <div class="rb-fc-price">₱{{ (flight.basePrice ?? flight.price ?? flight.economyPrice)?.toLocaleString() || '—' }}</div>
                        <i v-if="selectedFlightId === flight._id" class="bi bi-check-circle-fill rb-fc-check"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Seat picker -->
                <div v-if="selectedFlightId" class="rb-field-group">
                  <div class="rb-field-label-row">
                    <label class="f-label">Choose a seat</label>
                    <span class="rb-step-pill" :class="{ 'is-done': !!selectedSeatId }">
                      <i v-if="selectedSeatId" class="bi bi-check-lg"></i>
                      <template v-else>Step 3</template>
                    </span>
                  </div>
                  <div v-if="seatsLoading" class="rb-seats-loading">
                    <span class="spinner-border spinner-border-sm text-warning"></span>
                    <span>Loading seats…</span>
                  </div>
                  <div v-else-if="rebookSeats.length === 0" class="rb-seats-empty">
                    No available seats found for this flight.
                  </div>
                  <div v-else class="rb-seat-grid">
                    <button
                      v-for="seat in rebookSeats" :key="seat._id"
                      class="rb-seat"
                      :class="{ 'is-selected': selectedSeatId === seat._id, 'is-business': seat.class === 'business', 'is-first': seat.class === 'first' }"
                      @click="selectedSeatId = seat._id"
                      :data-tooltip="`${seat.seatNumber} · ${seatClassLabel(seat.class)}`"
                      :aria-label="`Seat ${seat.seatNumber}, ${seat.class}`"
                    >
                      <i v-if="selectedSeatId === seat._id" class="bi bi-check-circle-fill rb-seat-check"></i>
                      <span class="rb-seat-num">{{ seat.seatNumber }}</span>
                      <span class="rb-seat-cls">{{ seat.class }}</span>
                    </button>
                  </div>

                  <transition name="rb-pop">
                    <div v-if="selectedSeatObj" class="rb-seat-confirm">
                      <i class="bi bi-check-circle-fill"></i>
                      <span>Seat <strong>{{ selectedSeatObj.seatNumber }}</strong> · {{ seatClassLabel(selectedSeatObj.class) }} selected</span>
                    </div>
                  </transition>

                  <div v-if="rebookSeats.length > 0" class="rb-seat-legend">
                    <span class="rb-legend-item rb-legend-economy">Economy</span>
                    <span class="rb-legend-item rb-legend-business">Business</span>
                    <span class="rb-legend-item rb-legend-first">First</span>
                  </div>
                </div>

                <div v-if="rebookError" class="rb-error-msg">
                  <i class="bi bi-exclamation-circle me-2"></i>{{ rebookError }}
                </div>

              </div>
              <!-- /rb-body -->

              <div class="rb-footer">
                <button class="rb-btn rb-btn--cancel" :disabled="rebookSubmitting" @click="closeRebookModal">Cancel</button>
                <button class="rb-btn rb-btn--primary"
                  :disabled="!selectedFlightId || !selectedSeatId || rebookSubmitting"
                  @click="confirmRebook">
                  <span v-if="rebookSubmitting" class="spinner-border spinner-border-sm me-1"></span>
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
/* ═══════════════════════════════════════════════════════════════════════
   ALL COLOUR VALUES USE CSS CUSTOM PROPERTIES FROM index.css.
   This means light/dark theme switching works automatically.
   No hardcoded hex values appear here except where CSS vars are
   unavailable (e.g. rgba() arithmetic that needs a concrete number).
═══════════════════════════════════════════════════════════════════════ */

/* ── Page shell ──────────────────────────────────────────────────────── */
.bk-page-wrap { padding-top: 80px; padding-bottom: 80px; min-height: 100vh; }
.bk-container { max-width: 900px; }

/* ── Guest lookup ────────────────────────────────────────────────────── */
.bk-guest-row   { display: flex; gap: 10px; margin-top: 8px; }
.bk-guest-input { flex: 1; min-width: 0; }
.bk-guest-btn   { flex-shrink: 0; white-space: nowrap; }
.bk-guest-hint  { font-size: 0.78rem; color: var(--muted); margin-top: 10px; margin-bottom: 0; }

/* ── Loading / empty ─────────────────────────────────────────────────── */
.bk-loading      { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 64px 0; }
.bk-loading-text { color: var(--muted); font-size: 0.85rem; }
.bk-empty        { text-align: center; padding: 72px 24px; }
.bk-empty-icon   { display: block; font-size: 3rem; color: var(--border); margin-bottom: 14px; }
.bk-empty-text   { color: var(--muted); font-size: 0.9rem; margin-bottom: 10px; }

/* ═══════════════════════════════════════════════════════════════════════
   BOOKING CARD
═══════════════════════════════════════════════════════════════════════ */
.bk-card-wrap {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  box-shadow: 0 4px 24px var(--glass-shadow);
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}
.bk-card-wrap:hover    { border-color: var(--border); box-shadow: 0 8px 36px var(--glass-shadow); }
.bk-card-wrap.is-cancelled { opacity: 0.55; }

/* ── Flight summary row ──────────────────────────────────────────────────
   REDESIGN: flex instead of a 1fr/auto/1fr/auto grid. The old grid let
   .bk-endpoint stretch to fill its whole track, which is what pinned the
   departure block to the far-left edge and the arrival block to the far-
   right edge of THEIR OWN columns — producing the dead space in the
   middle. Flex children size to content unless told otherwise, so nothing
   stretches unless we explicitly ask it to (.bk-flight-info does, via
   justify-content: center). Generous padding here also keeps every
   element off the card's border. */
.bk-flight-row {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 30px 36px;
}

/* Tight center block — origin, track, and destination move and size as
   ONE unit, centered in whatever space remains once the action panel
   takes its fixed width. This is what makes the block feel composed
   instead of stretched across the screen. */
.bk-flight-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  flex: 1 1 auto;
  min-width: 0;
}

/* ── Endpoints ───────────────────────────────────────────────────────── */
.bk-endpoint {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  flex: 0 0 auto;     /* size to content, never stretch */
  min-width: 84px;
}
.bk-endpoint--right { align-items: flex-end; text-align: right; }

/* Graceful type scale: each tier steps down by a comfortable ratio
   instead of jumping straight from a big time to a barely-visible date.
   The airport label is now a real middle tier (was 0.65rem, easy to miss
   under a 1.7rem time) rather than an afterthought. */
.bk-time {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text);
}
.bk-airport {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.bk-date {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--muted);
  opacity: 0.75;
}

/* ── Flight track ────────────────────────────────────────────────────── */
.bk-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 126px;       /* fixed, not min-width — keeps the medallion centered
                          between endpoints at any card width */
  flex: 0 0 auto;
}
.bk-duration {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  white-space: nowrap;
}
.bk-track-line {
  width: 100%;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--gold) 20%, var(--gold) 80%, transparent);
  position: relative;
  margin: 4px 0;
}
.bk-plane-medallion {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--glass-border);
  background: var(--bg-60-mid);
  color: var(--gold);
  font-size: 0.65rem;
}
.bk-airline-name {
  font-size: 0.66rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
}

/* ── Action panel ────────────────────────────────────────────────────── */
.bk-action-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  width: 188px;        /* fixed width — every card's button stack lines up
                           identically regardless of badge/price text length */
  flex: 0 0 auto;
  padding-left: 28px;
  border-left: 1px solid var(--border-dim);
}
.bk-price {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--gold);
  line-height: 1;
}
.bk-ref       { font-size: 0.72rem; color: var(--gold); opacity: 0.8; }
.bk-checked-in {
  font-size: 0.72rem;
  color: var(--success);
  display: flex; align-items: center; gap: 4px;
}

/* ── Button stack ────────────────────────────────────────────────────── */
.bk-btn-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.bk-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 7px;
  font-family: var(--font-sans);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}
.bk-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.bk-btn--primary {
  background: var(--gold);
  color: var(--ink-on-gold);
  border-color: var(--gold);
  box-shadow: 0 2px 10px rgba(212, 175, 55, 0.25);
}
.bk-btn--primary:hover { background: var(--gold-light); border-color: var(--gold-light); }

.bk-btn--gold { background: transparent; color: var(--gold); border-color: var(--gold); }
.bk-btn--gold:hover { background: var(--gold-dim); }

.bk-btn--danger { background: transparent; color: var(--error); border-color: rgba(255, 77, 77, 0.4); }
.bk-btn--danger:hover { background: rgba(255, 77, 77, 0.08); border-color: var(--error); }

.bk-btn--ghost { background: transparent; color: var(--muted); border-color: var(--border-dim); }
.bk-btn--ghost:hover { color: var(--gold); border-color: var(--gold); }

/* ═══════════════════════════════════════════════════════════════════════
   DETAIL PANEL
═══════════════════════════════════════════════════════════════════════ */
.bk-detail-panel {
  background: rgba(0, 0, 0, 0.22);
  border-top: 1px solid var(--border-dim);
  padding: 24px 36px 28px;   /* horizontal padding now matches .bk-flight-row
                                 so the columns line up visually when expanded */
}
[data-theme="light"] .bk-detail-panel { background: rgba(0, 0, 0, 0.03); }

.bk-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px 16px;
  margin-bottom: 20px;
}
.bk-detail-cell  { display: flex; flex-direction: column; gap: 5px; }

.bk-detail-label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.bk-detail-value {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text);
}
.bk-detail-sub  { color: var(--muted); font-weight: 400; margin-left: 2px; }
.bk-detail-mono { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 0.78rem; letter-spacing: 0.04em; }

.bk-seat-badge {
  display: inline-block;
  font-size: 0.62rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  margin-left: 6px;
  text-transform: capitalize;
}
.bk-seat-badge--economy  { background: rgba(46, 204, 113, 0.15); color: var(--success); }
.bk-seat-badge--business { background: var(--gold-dim); color: var(--gold); }
.bk-seat-badge--first    { background: rgba(111, 66, 193, 0.18); color: #b07eef; }

.bk-timebar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--border-dim);
  flex-wrap: wrap;
}
.bk-timebar-block { display: flex; flex-direction: column; gap: 3px; }
.bk-timebar-time  { font-family: var(--font-serif); font-size: 1.3rem; font-weight: 700; color: var(--text); line-height: 1; }
.bk-timebar-date  { font-size: 0.72rem; color: var(--muted); }
.bk-timebar-arrow { color: var(--gold); font-size: 1.1rem; flex-shrink: 0; }

/* Detail panel slide transition */
.bk-slide-enter-active, .bk-slide-leave-active {
  transition: max-height 0.28s ease, opacity 0.22s ease;
  max-height: 500px;
  overflow: hidden;
}
.bk-slide-enter-from, .bk-slide-leave-to { max-height: 0; opacity: 0; }

/* ═══════════════════════════════════════════════════════════════════════
   REBOOK MODAL
═══════════════════════════════════════════════════════════════════════ */

.rb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(4px);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
}

.rb-modal {
  background: var(--bg-60-surface);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
  margin: auto;   /* keeps it centered in the scrollable overlay */
}

/* Header */
.rb-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--border-dim);
  flex-shrink: 0;
}
.rb-header-icon {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: var(--gold-dim);
  color: var(--gold);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; flex-shrink: 0;
}
.rb-header-text { flex: 1; min-width: 0; }
.rb-header-title { font-size: 0.95rem; font-weight: 700; color: var(--text); margin: 0; line-height: 1.3; }
.rb-header-sub   { font-size: 0.72rem; color: var(--muted); margin: 3px 0 0; }

.rb-close {
  background: transparent; border: none;
  color: var(--muted); font-size: 1rem; cursor: pointer;
  padding: 6px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.rb-close:hover:not(:disabled) { color: var(--text); background: var(--border-dim); }
.rb-close:disabled { opacity: 0.35; cursor: not-allowed; }

.rb-back {
  background: transparent;
  border: 1px solid var(--border-dim);
  border-radius: 6px;
  color: var(--muted); font-size: 0.9rem;
  cursor: pointer; padding: 5px 10px;
  display: flex; align-items: center;
  transition: color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.rb-back:hover:not(:disabled) { color: var(--text); border-color: var(--border); }
.rb-back:disabled { opacity: 0.35; cursor: not-allowed; }

/* Confirm body */
.rb-confirm-body { padding: 22px; }

.rb-summary-card {
  background: var(--glass-bg-lt);
  border: 1px solid var(--border-dim);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
}
.rb-summary-endpoints {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.rb-summary-ep           { display: flex; flex-direction: column; gap: 4px; }
.rb-summary-ep--right    { text-align: right; }
.rb-summary-iata {
  font-family: var(--font-serif);
  font-size: 1.65rem; font-weight: 900;
  color: var(--text); line-height: 1; letter-spacing: 0.04em;
}
.rb-summary-city { font-size: 0.68rem; color: var(--muted); }
.rb-summary-time { font-size: 0.82rem; font-weight: 600; color: var(--gold); margin-top: 2px; }

.rb-summary-track {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 0 10px;
}
.rb-summary-duration  { font-size: 0.65rem; color: var(--muted); }
.rb-summary-track-line {
  width: 100%; height: 1px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(to right, transparent, var(--border) 20%, var(--border) 80%, transparent);
  position: relative;
}
.rb-summary-plane {
  color: var(--gold); font-size: 0.8rem;
  background: var(--bg-60-surface); padding: 0 5px;
}
.rb-summary-airline { font-size: 0.65rem; color: var(--muted); }

.rb-summary-datebar {
  font-size: 0.76rem; color: var(--muted);
  border-top: 1px solid var(--border-dim); padding-top: 12px;
}

/* Notice box */
.rb-notice {
  display: flex; gap: 10px; align-items: flex-start;
  background: var(--gold-dim);
  border: 1px solid var(--border);
  border-radius: 8px; padding: 12px 16px;
  font-size: 0.8rem;
  color: var(--text);
  line-height: 1.55;
}
.rb-notice-icon { color: var(--gold); font-size: 1rem; flex-shrink: 0; margin-top: 1px; }

/* Route strip */
.rb-route-strip {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 22px;
  background: var(--gold-dim);
  border-top: 1px solid var(--border-dim);
  border-bottom: 1px solid var(--border-dim);
  flex-wrap: wrap; flex-shrink: 0;
}
.rb-route-iata   { font-weight: 800; font-size: 0.95rem; color: var(--text); }
.rb-route-arrow  { color: var(--gold); font-size: 0.85rem; }
.rb-route-current { margin-left: auto; font-size: 0.72rem; color: var(--muted); }

/* Progress strip */
.rb-progress {
  display: flex; align-items: center;
  padding: 12px 22px;
  border-bottom: 1px solid var(--border-dim);
  gap: 0; flex-shrink: 0;
}
.rb-progress-step {
  display: flex; align-items: center; gap: 7px;
  opacity: 0.3; transition: opacity 0.2s ease;
}
.rb-progress-step.is-active { opacity: 1; }
.rb-progress-step.is-done   { opacity: 0.65; }
.rb-progress-num {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--gold-dim);
  border: 1px solid var(--gold);
  color: var(--gold);
  font-size: 0.68rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rb-progress-step.is-done .rb-progress-num {
  background: var(--gold); color: var(--ink-on-gold);
}
.rb-progress-label {
  font-size: 0.68rem; font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}
.rb-progress-line { flex: 1; height: 1px; background: var(--border-dim); margin: 0 10px; }

/* Scrollable modal body */
.rb-body {
  padding: 20px 22px;
  overflow-y: auto;
  flex: 1;
  display: flex; flex-direction: column; gap: 20px;
  max-height: 55vh;
}

.rb-field-group { display: flex; flex-direction: column; gap: 10px; }

/* Field label row + step pill — the per-field "you are here" indicator
   shown above the date, flight, and seat sections. Mirrors the same
   gold/ink-on-gold language as .rb-progress-num above. */
.rb-field-label-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.rb-step-pill {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 46px; height: 20px; padding: 0 8px;
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 20px;
  background: var(--gold-dim); color: var(--gold);
  border: 1px solid var(--border);
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;
}
.rb-step-pill.is-done { background: var(--gold); color: var(--ink-on-gold); border-color: var(--gold); }
.rb-step-pill i { font-size: 0.7rem; }

/* Date row */
.rb-date-row   { display: flex; gap: 10px; align-items: center; }
.rb-date-input { flex: 1; min-width: 0; width: 100%; }
.rb-find-btn   { flex-shrink: 0; white-space: nowrap; padding: 10px 18px; }

/* Step-1 hover/focus tooltip anchored to the date input */
.rb-tip-anchor { position: relative; flex: 1; min-width: 0; }
.rb-tip {
  position: absolute; left: 2px; bottom: calc(100% + 10px);
  background: var(--text); color: var(--bg-60-surface);
  border-radius: 6px; padding: 6px 11px;
  font-size: 0.7rem; font-weight: 600; white-space: nowrap;
  opacity: 0; pointer-events: none;
  transform: translateY(4px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  z-index: 2;
}
.rb-tip::after {
  content: ''; position: absolute; top: 100%; left: 16px;
  border: 5px solid transparent; border-top-color: var(--text);
}
.rb-tip-anchor:hover .rb-tip,
.rb-tip-anchor:focus-within .rb-tip { opacity: 1; transform: translateY(0); }

/* Flight list */
.rb-flight-list { display: flex; flex-direction: column; gap: 8px; }

.rb-flight-card {
  display: flex; align-items: center;
  justify-content: space-between;
  gap: 12px; padding: 13px 16px;
  border: 1px solid var(--border-dim);
  border-radius: 8px; cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  position: relative;
}
.rb-flight-card:hover     { border-color: var(--border); background: var(--glass-bg-lt); }
.rb-flight-card:hover:not(.is-selected) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); }
.rb-flight-card.is-selected { border-color: var(--gold); background: var(--gold-dim); }
.rb-flight-card:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

/* "Next step" tooltip — nudges the user on hover/focus of an unselected
   card; the selected card shows the check icon instead (.rb-fc-check). */
.rb-fc-tooltip {
  position: absolute; top: 0; right: 16px;
  transform: translateY(-100%) translateY(-6px);
  background: var(--text); color: var(--bg-60-surface);
  font-size: 0.64rem; font-weight: 700;
  padding: 5px 10px; border-radius: 6px;
  white-space: nowrap; opacity: 0; pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 2;
}
.rb-flight-card:hover .rb-fc-tooltip,
.rb-flight-card:focus-visible .rb-fc-tooltip { opacity: 1; transform: translateY(-100%) translateY(-2px); }

.rb-fc-left  { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.rb-fc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }

.rb-fc-times { display: flex; align-items: center; gap: 7px; }
.rb-fc-time  { font-weight: 700; font-size: 0.95rem; color: var(--text); }
.rb-fc-arrow { color: var(--muted); font-size: 0.75rem; }

.rb-fc-meta {
  display: flex; align-items: center; gap: 5px;
  flex-wrap: wrap;
  font-size: 0.72rem; color: var(--muted);
}
.rb-fc-dot { opacity: 0.5; }

.rb-fc-price { font-size: 0.92rem; font-weight: 700; color: var(--gold); }
.rb-fc-check { color: var(--gold); font-size: 0.9rem; }

/* Seat grid */
.rb-seat-grid { display: flex; flex-wrap: wrap; gap: 7px; }

.rb-seat {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  width: 54px; height: 50px;
  border: 1px solid var(--border-dim);
  border-radius: 7px;
  background: var(--glass-bg-lt);
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.15s;
  padding: 3px; flex-shrink: 0;
  position: relative;
}
.rb-seat:hover                   { border-color: var(--gold); color: var(--gold); background: var(--gold-dim); transform: translateY(-2px); }
.rb-seat.is-selected             { border-color: var(--gold); background: var(--gold); color: var(--ink-on-gold); animation: rb-seat-pop 0.3s ease; }
.rb-seat.is-business             { border-color: rgba(212, 175, 55, 0.35); }
.rb-seat.is-first                { border-color: rgba(111, 66, 193, 0.35); }
.rb-seat.is-first.is-selected   { background: #7c4dcc; border-color: #7c4dcc; color: #fff; }

.rb-seat-num   { font-size: 0.82rem; font-weight: 700; line-height: 1; }
.rb-seat-cls   { font-size: 0.56rem; text-transform: capitalize; opacity: 0.7; margin-top: 2px; }
.rb-seat-check {
  position: absolute; top: -7px; right: -7px;
  font-size: 0.85rem; color: var(--gold);
  background: var(--bg-60-surface); border-radius: 50%;
  line-height: 1;
}

@keyframes rb-seat-pop {
  0%   { transform: scale(0.8); }
  55%  { transform: scale(1.12); }
  100% { transform: scale(1); }
}

/* Hover tooltip built from data-tooltip, so we don't need a v-for'd
   <span> per seat in the template. */
.rb-seat[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute; bottom: calc(100% + 9px); left: 50%;
  transform: translateX(-50%);
  background: var(--text); color: var(--bg-60-surface);
  font-size: 0.64rem; font-weight: 700;
  padding: 4px 9px; border-radius: 5px;
  white-space: nowrap; z-index: 3;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
.rb-seat[data-tooltip]:hover::before {
  content: ''; position: absolute; bottom: calc(100% + 4px); left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent; border-top-color: var(--text);
  z-index: 3;
}

/* Seat legend */
.rb-seat-legend { display: flex; gap: 14px; flex-wrap: wrap; padding-top: 10px; }
.rb-legend-item {
  font-size: 0.65rem; font-weight: 600;
  display: flex; align-items: center; gap: 5px;
  color: var(--muted);
}
.rb-legend-item::before {
  content: ''; display: inline-block;
  width: 12px; height: 12px; border-radius: 3px; border: 1px solid;
}
.rb-legend-economy::before  { border-color: var(--border-dim); background: var(--glass-bg-lt); }
.rb-legend-business::before { border-color: rgba(212, 175, 55, 0.5); background: var(--gold-dim); }
.rb-legend-first::before    { border-color: rgba(111, 66, 193, 0.5); background: rgba(111, 66, 193, 0.12); }

/* Seat-confirmation badge — pops in the moment a seat is chosen, giving
   immediate feedback before the user moves on to "Confirm Rebook". */
.rb-seat-confirm {
  display: flex; align-items: center; gap: 9px;
  margin-top: 2px;
  background: var(--gold-dim); border: 1px solid var(--gold);
  border-radius: 8px; padding: 10px 14px;
  font-size: 0.78rem; font-weight: 600; color: var(--text);
}
.rb-seat-confirm i { color: var(--gold); font-size: 1rem; flex-shrink: 0; }

.rb-pop-enter-active { animation: rb-pop-in 0.28s ease; }
.rb-pop-leave-active { transition: opacity 0.15s ease; }
.rb-pop-leave-to      { opacity: 0; }
@keyframes rb-pop-in {
  0%   { opacity: 0; transform: scale(0.9) translateY(4px); }
  60%  { opacity: 1; transform: scale(1.03) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* Loading / empty seat states */
.rb-seats-loading {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.82rem; color: var(--muted); padding: 12px 0;
}
.rb-seats-empty { font-size: 0.82rem; color: var(--muted); padding: 8px 0; }

/* Error message */
.rb-error-msg {
  display: flex; align-items: center;
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid rgba(255, 77, 77, 0.35);
  color: var(--error);
  font-size: 0.82rem; padding: 10px 14px; border-radius: 6px;
}

/* Footer */
.rb-footer {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 14px 22px;
  border-top: 1px solid var(--border-dim);
  flex-shrink: 0; flex-wrap: wrap;
}

/* Modal buttons */
.rb-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; padding: 10px 22px; border-radius: 6px;
  font-family: var(--font-sans); font-size: 0.74rem; font-weight: 700;
  letter-spacing: 0.05em; border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}
.rb-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.rb-btn--primary { background: var(--gold); color: var(--ink-on-gold); border-color: var(--gold); }
.rb-btn--primary:hover:not(:disabled) { background: var(--gold-light); border-color: var(--gold-light); }

.rb-btn--cancel { background: transparent; color: var(--muted); border-color: var(--border-dim); }
.rb-btn--cancel:hover:not(:disabled) { color: var(--text); border-color: var(--border); }

/* Modal entrance transitions */
.rb-fade-enter-active, .rb-fade-leave-active { transition: opacity 0.22s ease; }
.rb-fade-enter-from, .rb-fade-leave-to       { opacity: 0; }

.rb-slide-up-enter-active, .rb-slide-up-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.rb-slide-up-enter-from, .rb-slide-up-leave-to       { opacity: 0; transform: translateY(18px); }

/* Light-mode modal surfaces */
[data-theme="light"] .rb-modal        { background: var(--bg-60-mid); border-color: var(--glass-border); }
[data-theme="light"] .rb-summary-card { background: rgba(255, 255, 255, 0.65); border-color: var(--border-dim); }
[data-theme="light"] .rb-summary-plane { background: var(--bg-60-mid); }
[data-theme="light"] .rb-seat         { background: rgba(255, 255, 255, 0.5); }
[data-theme="light"] .rb-flight-card:hover { background: rgba(255, 255, 255, 0.55); }

/* ═══════════════════════════════════════════════════════════════════════
   RESPONSIVE LAYOUT
   Three breakpoints handle the transition from desktop → tablet → phone
   without any overlap or clipping.
═══════════════════════════════════════════════════════════════════════ */

/* ── 768 px — tablet ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .bk-page-wrap { padding-top: 60px; padding-bottom: 60px; }

  /* Flight row stacks: centered flight-info on top, action panel below
     spanning full width. */
  .bk-flight-row {
    flex-direction: column;
    align-items: stretch;
    padding: 24px 22px;
    gap: 20px;
  }
  .bk-flight-info { gap: 24px; }

  .bk-action-panel {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border-dim);
    padding: 16px 0 0 0;
    gap: 10px;
  }
  .bk-price { font-size: 1.15rem; }

  /* Horizontal button stack */
  .bk-btn-stack {
    flex-direction: row;
    flex-wrap: wrap;
    width: auto;
    flex: 1 1 auto;
    justify-content: flex-end;
    margin-top: 0;
  }
  .bk-btn { width: auto; }

  /* Detail panel: 2 columns */
  .bk-detail-grid { grid-template-columns: repeat(2, 1fr); }

  /* Modal alignment: push to top so it scrolls naturally on tablet */
  .rb-overlay { align-items: flex-start; padding-top: 24px; padding-bottom: 24px; }
  .rb-modal   { max-width: 100%; }
  .rb-body    { max-height: 60vh; }
  .rb-summary-iata { font-size: 1.3rem; }
}

/* ── 520 px — phone ──────────────────────────────────────────────────── */
@media (max-width: 520px) {
  .bk-flight-row {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 20px 18px;
  }

  /* Origin / track / destination stack vertically, each as a full-width
     row, instead of the desktop's tight horizontal cluster. */
  .bk-flight-info {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .bk-endpoint         { flex-direction: row; align-items: baseline; gap: 10px; min-width: 0; }
  .bk-endpoint--right  { justify-content: flex-end; text-align: right; }
  .bk-time             { font-size: 1.3rem; }

  .bk-track { flex-direction: row; align-items: center; width: 100%; gap: 10px; }
  .bk-track-line { flex: 1; margin: 0; }

  .bk-action-panel {
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    padding-left: 0;
    margin-top: 0;
  }
  .bk-btn-stack { flex-direction: column; width: 100%; }
  .bk-btn       { width: 100%; }

  /* Detail panel: 1 column */
  .bk-detail-grid { grid-template-columns: 1fr; }

  /* Guest row stacks */
  .bk-guest-row { flex-direction: column; }
  .bk-guest-btn { width: 100%; }

  /* Modal sheet-from-bottom on phones */
  .rb-overlay { padding: 0; align-items: flex-end; }
  .rb-modal   { border-radius: 14px 14px 0 0; max-height: 92vh; }
  .rb-body    { max-height: 45vh; }

  /* Confirm summary: wrap endpoints */
  .rb-summary-endpoints { flex-wrap: wrap; gap: 14px; }
  .rb-summary-track     { min-width: 100%; order: 3; flex-direction: row; }

  /* Date row stacks */
  .rb-date-row { flex-direction: column; }
  .rb-find-btn { width: 100%; }

  /* Footer buttons stack */
  .rb-footer { flex-direction: column; }
  .rb-btn    { width: 100%; justify-content: center; }

  /* Flight card stacks */
  .rb-flight-card { flex-direction: column; align-items: flex-start; gap: 8px; }
  .rb-fc-right    { flex-direction: row; align-items: center; gap: 12px; }
}
</style>