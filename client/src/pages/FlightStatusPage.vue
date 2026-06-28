<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getFlightStatus, getBookingByReference, getFlightById } from '../api.js'

const route = useRoute()
const flightNumber = ref(route.query.flightNumber || '')
const flight = ref(null)
const loading = ref(false)
const errorMsg = ref('')
const hasSearched = ref(false)

function formatDateTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
function statusClass(status) {
  if (status === 'cancelled' || status === 'delayed') return 'fc-badge cancelled'
  if (status === 'on-time') return 'fc-badge success'
  if (status === 'departed' || status === 'arrived') return 'fc-badge pending'
  return 'fc-badge'
}
function statusLabel(status) {
  return (status || '').replace('-', ' ')
}

// Attempts a flight-number lookup, swallowing "not found" so the caller
// can try the next candidate without a try/catch at every call site.
async function tryFlightNumber(num) {
  if (!num) return null
  try {
    const res = await getFlightStatus(num)
    return res?.result || null
  } catch {
    return null
  }
}

// Resolves either a plain flight number ("F606") or a full booking
// reference ("F606-1782627391737") to a flight record the template can
// render. Tries the cheapest path first and only escalates when needed:
//
//   1. The raw input, exactly as typed — covers ordinary flight numbers,
//      including any that legitimately contain a hyphen themselves.
//   2. If there's a hyphen and (1) didn't resolve, the substring before
//      the first hyphen. This is the "split/sanitize" step: it turns a
//      booking reference like "F606-1782627391737" into the flight
//      number "F606".
//   3. If neither lookup resolves, treat the original input as a
//      booking reference: fetch the booking, then read its flight
//      straight off it (using the already-populated flight doc when
//      present, otherwise fetching it by id). This is the dual-query
//      fallback — it bypasses the flight-number search entirely.
async function resolveFlightStatus(input) {
  let result = await tryFlightNumber(input)
  if (result) return result

  const hyphenIndex = input.indexOf('-')
  const hasPrefix = hyphenIndex > 0

  if (hasPrefix) {
    result = await tryFlightNumber(input.slice(0, hyphenIndex))
    if (result) return result
  }

  if (hasPrefix) {
    const bookingRes = await getBookingByReference(input)
    const booking = bookingRes?.result || bookingRes?.booking || bookingRes
    const flightRef = booking?.flightId
    if (!flightRef) throw new Error('This booking has no associated flight.')

    // flightId is sometimes already the populated flight document.
    if (typeof flightRef === 'object' && flightRef.departureTime) return flightRef

    const flightId = flightRef?._id || flightRef
    const flightRes = await getFlightById(flightId)
    return flightRes?.result || flightRes?.flight || flightRes
  }

  throw new Error('No flight found with that number.')
}

async function lookupStatus() {
  errorMsg.value = ''
  flight.value = null
  const raw = flightNumber.value.trim()
  if (!raw) {
    errorMsg.value = 'Please enter a flight number.'
    return
  }
  loading.value = true
  try {
    flight.value = await resolveFlightStatus(raw)
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'No flight found with that number.'
  } finally {
    loading.value = false
    hasSearched.value = true
  }
}

onMounted(() => {
  if (flightNumber.value) lookupStatus()
})
</script>

<template>
  <div class="page active">
    <div class="inner-page">

      <div class="inner-hero">
        <div class="container text-center">
          <p class="hero-eyebrow">Flight 606 · Luxury Redefined</p>
          <h1 class="hero-title">Unleash Your <em>Wanderlust</em> Today</h1>
          <p class="hero-sub">Seek the unknown and conquer wild landscapes without compromise</p>
        </div>
      </div>

      <div class="pt-5">
        <div class="container" style="max-width:640px;">
          <nav class="theme-breadcrumb" aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><RouterLink :to="{ name: 'Home' }">Home</RouterLink></li>
              <li class="breadcrumb-item active">Flight Status</li>
            </ol>
          </nav>

          <h1 class="confirm-headline mb-4">Flight <em class="gold">Status</em></h1>

          <div class="booking-section">
            <div class="bs-body">
              <label class="f-label">Flight Number or Booking Reference</label>
              <div class="row g-2">
                <div class="col-8"><input type="text" class="f-input" v-model="flightNumber" placeholder="e.g. F606 or F606-1782627391737" @keyup.enter="lookupStatus"></div>
                <div class="col-4"><button class="fc-select-btn w-100" :disabled="loading" @click="lookupStatus">{{ loading ? '...' : 'Track' }}</button></div>
              </div>
            </div>
          </div>

          <div v-if="errorMsg" class="alert alert-danger mt-3">{{ errorMsg }}</div>

          <div v-if="flight" class="flight-card mt-4" style="cursor:default;">
            <div class="fc-endpoint">
              <div class="fc-time">{{ formatDateTime(flight.departureTime) }}</div>
              <div class="fc-airport">{{ flight.originAirportId?.city || flight.originAirportId?.iataCode || 'DEP' }} · {{ flight.originAirportId?.iataCode }}</div>
            </div>
            <div class="fc-mid">
              <div class="fc-line"><span class="fc-plane-icon"><i class="bi bi-airplane-fill"></i></span></div>
              <div class="fc-stops">{{ flight.flightNumber }} · {{ flight.airlineId?.name }}</div>
            </div>
            <div class="fc-endpoint">
              <div class="fc-time">{{ formatDateTime(flight.arrivalTime) }}</div>
              <div class="fc-airport">{{ flight.destinationAirportId?.city || flight.destinationAirportId?.iataCode || 'ARR' }} · {{ flight.destinationAirportId?.iataCode }}</div>
            </div>
            <div class="fc-price-box">
              <span :class="statusClass(flight.status)" style="text-transform:capitalize;">{{ statusLabel(flight.status) }}</span>
            </div>
          </div>

          <div v-else-if="hasSearched && !loading" class="text-center py-4">
            <p class="body-text">No flight found with that number.</p>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>