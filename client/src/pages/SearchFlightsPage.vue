<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getAllAirports, searchFlights } from '../api.js' 
import { useGlobalStore } from '../stores/global.js' 
import { useBookingStore } from '../stores/booking.js'

const router = useRouter()
const route = useRoute()
const globalStore = useGlobalStore()
const bookingStore = useBookingStore()

// State Management
const airports = ref([])
const isSearching = ref(false)
const hasSearched = ref(false)
const errorMessage = ref('')

// Form Inputs
const tripType = ref('oneway') 
const fromVal  = ref('')       
const toVal    = ref('')       
const sfDate      = ref('')   
const returnDate  = ref('')   
const pax         = ref('2 Adults')

// Flight Result Buckets & Leg Trackers
const flightResultsPerSegment = ref([])
const selectedFlightIds = ref([])

// Authentication Provider Check
const isAuthenticated = computed(() => !!globalStore.user.token)

// Dynamic Luxury Banner Labels
const fromLabel = computed(() => {
  const origin = airports.value.find(a => a._id === fromVal.value)
  return origin ? `${origin.city} (${origin.iataCode})` : 'Select Origin'
})

const toLabel = computed(() => {
  const dest = airports.value.find(a => a._id === toVal.value)
  return dest ? `${dest.city} (${dest.iataCode})` : 'Select Destination'
})

// Check if selections are complete
const isSelectionComplete = computed(() => {
  const expectedLegs = tripType.value === 'roundtrip' ? 2 : 1
  return selectedFlightIds.value.length === expectedLegs && 
         selectedFlightIds.value.every(id => id !== null && id !== undefined)
})

// Initialize Airport Dropdowns and handle URL queries
onMounted(async () => {
  try {
    const res = await getAllAirports()
    airports.value = res.result || res

    if (route.query.from && route.query.to && route.query.date) {
      fromVal.value = route.query.from
      toVal.value   = route.query.to
      sfDate.value  = route.query.date
      if (route.query.type)       tripType.value  = route.query.type
      if (route.query.returnDate) returnDate.value = route.query.returnDate
      if (route.query.pax)        pax.value        = route.query.pax

      handleSearch()
    } else if (airports.value.length > 0) {
      fromVal.value = airports.value[0]._id
      if (airports.value[1]) toVal.value = airports.value[1]._id
    }
  } catch (err) {
    console.error('Failed to initialize airport resources:', err)
  }
})

// Reset configuration states whenever user alters the flight trip category
watch(tripType, () => {
  hasSearched.value = false
  errorMessage.value = ''
  selectedFlightIds.value = []
  flightResultsPerSegment.value = []
  returnDate.value = ''
})

// Core Multi-Segment Query Execution Layer
async function handleSearch() {
  if (!fromVal.value || !toVal.value || !sfDate.value) {
    errorMessage.value = 'Please select an origin, destination, and departure date.'
    return
  }
  if (tripType.value === 'roundtrip' && !returnDate.value) {
    errorMessage.value = 'Please select a return date for your round trip.'
    return
  }
  if (tripType.value === 'roundtrip' && returnDate.value <= sfDate.value) {
    errorMessage.value = 'Return date must be after the departure date.'
    return
  }

  errorMessage.value = ''
  hasSearched.value = true
  isSearching.value = true
  flightResultsPerSegment.value = []
  selectedFlightIds.value = []

  const segments = []

  // FIXED: Send the raw date string "YYYY-MM-DD" directly without forced timezone shifts!
  segments.push({ origin: fromVal.value, destination: toVal.value, date: sfDate.value })

  if (tripType.value === 'roundtrip') {
    segments.push({ origin: toVal.value, destination: fromVal.value, date: returnDate.value })
  }

  try {
    const searchPromises = segments.map(seg => searchFlights(seg.origin, seg.destination, seg.date))
    const responses = await Promise.allSettled(searchPromises)
    
    // PASTE IT DIRECTLY HERE RIGHT INSIDE YOUR TRY BLOCK:
    responses.forEach((res, index) => {
      if (res.status === 'fulfilled') {
        const rawFlights = res.value.flights || res.value.result || res.value || []
        flightResultsPerSegment.value[index] = Array.isArray(rawFlights) ? rawFlights : [rawFlights]
      } else {
        flightResultsPerSegment.value[index] = []
      }
    })
    
    selectedFlightIds.value = new Array(segments.length).fill(null)
  } catch (err) {


function selectFlight(segmentIndex, flightId) {
  if (selectedFlightIds.value[segmentIndex] === flightId) {
    selectedFlightIds.value[segmentIndex] = null
  } else {
    selectedFlightIds.value[segmentIndex] = flightId
  }
}

function proceedToCheckout() {
  if (!isSelectionComplete.value) return

  const bundledFlightIds = selectedFlightIds.value.join(',')
  const paxNumber = parseInt(pax.value, 10) || 1
  bookingStore.setPaxCount(paxNumber)

  if (isAuthenticated.value) {
    router.push({ name: 'Checkout', params: { flightId: bundledFlightIds } })
  } else {
    router.push({ name: 'GuestCheckout', params: { flightId: bundledFlightIds } })
  }
}

function formatTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDateLabel(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('en-PH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function calcTravelTime(departure, arrival) {
  if (!departure || !arrival) return ''
  const diff = new Date(arrival) - new Date(departure)
  if (diff <= 0) return ''
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m`
}
</script>

<template>
  <div class="page active">
    <div class="inner-page">
      
      <!-- Luxury Hero Header Banner Section -->
      <div class="inner-hero">
        <div class="container text-center">
          <p class="hero-eyebrow">Flight 606 · Luxury Redefined</p>
          <h1 class="hero-title">Paradise <em>Awaits</em> Your Arrival</h1>
          <p class="hero-sub">Discover untouched destinations in absolute comfort</p>
        </div>
      </div>

      <div class="mt-5">
        <div class="container">
          
          <!-- Navigation Breadcrumb Links Tracker -->
          <nav class="theme-breadcrumb" aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item">
                <RouterLink to="/">Home</RouterLink>
              </li>
              <li class="breadcrumb-item active" aria-current="page">Flights</li>
            </ol>
          </nav>

          <!-- Core Search Widget Parameter Engine Wrapper Form -->
          <div class="sf-search-bar">
            <div class="d-flex gap-4 mb-3 flex-wrap">
              <label class="r-lbl">
                <input type="radio" name="sf-trip" value="oneway" v-model="tripType">
                <span>One way</span>
              </label>
              <label class="r-lbl">
                <input type="radio" name="sf-trip" value="roundtrip" v-model="tripType">
                <span>Round trip</span>
              </label>
            </div>
            
            <div class="sf-bar-row">
              <div>
                <div class="sf-label">From</div>
                <select class="sf-select" v-model="fromVal" required>
                  <option value="" disabled>Select Origin</option>
                  <option v-for="airport in airports" :key="airport._id" :value="airport._id">
                    {{ airport.city }} ({{ airport.iataCode }})
                  </option>
                </select>
              </div>
              <div>
                <div class="sf-label">To</div>
                <select class="sf-select" v-model="toVal" required>
                  <option value="" disabled>Select Destination</option>
                  <option v-for="airport in airports" :key="airport._id" :value="airport._id">
                    {{ airport.city }} ({{ airport.iataCode }})
                  </option>
                </select>
              </div>
              <div>
                <div class="sf-label">Departure Date</div>
                <input type="date" class="sf-input" v-model="sfDate" :min="new Date().toISOString().split('T')[0]" required>
              </div>
              <div v-if="tripType === 'roundtrip'">
                <div class="sf-label">Return Date</div>
                <input type="date" class="sf-input" v-model="returnDate" :min="sfDate || new Date().toISOString().split('T')[0]" required>
              </div>
              <div>
                <div class="sf-label">Passengers</div>
                <select class="sf-select" v-model="pax">
                  <option>1 Adult</option>
                  <option>2 Adults</option>
                  <option>3 Adults</option>
                </select>
              </div>
              <div>
                <button class="sf-search-btn" @click="handleSearch" :disabled="isSearching">
                  <span v-if="isSearching" class="spinner-border spinner-border-sm me-1"></span> Search
                </button>
              </div>
            </div>
          </div>

          <!-- Network System Error Messages Banner Alerts -->
          <div v-if="errorMessage" class="alert alert-danger my-3">{{ errorMessage }}</div>

          <div v-if="hasSearched && !isSearching">
            
            <!-- SEGMENT ONE: OUTBOUND FLIGHT GRID SELECTION BLOCK -->
            <div class="results-banner gold-banner">
              ✈ Select departure flight from <strong>{{ fromLabel }}</strong> to <strong>{{ toLabel }}</strong>
            </div>
            
            <div class="date-scroll-row">
              <span class="date-arrow">‹</span>
              <div class="date-chips">
                <span class="date-chip active">{{ formatDateLabel(sfDate) || 'Selected Date' }}</span>
              </div>
              <span class="date-arrow">›</span>
            </div>

            <div v-if="!flightResultsPerSegment[0] || flightResultsPerSegment[0].length === 0" class="alert alert-warning text-center my-3">
              No flights found for this route segment on the specified date.
            </div>

            <!-- Outbound Flight Cards Generation Loop -->
            <div 
              v-for="flight in flightResultsPerSegment[0]" 
              :key="flight._id"
              class="flight-card" 
              :class="{ selected: selectedFlightIds[0] === flight._id }"
              @click="selectFlight(0, flight._id)"
            >
              <div class="fc-endpoint">
                <div class="fc-time">{{ formatTime(flight.departureTime) }}</div>
                <div class="fc-airport">{{ fromLabel.split('(')[0].trim() }} · {{ flight.originAirportId?.iataCode || 'MNL' }}</div>
                <div class="fc-date">{{ formatDateLabel(flight.departureTime) }}</div>
              </div>
              <div class="fc-mid">
                <div class="fc-duration">{{ calcTravelTime(flight.departureTime, flight.arrivalTime) }}</div>
                <div class="fc-line"><span class="fc-plane-icon"><i class="bi bi-airplane-fill"></i></span></div>
                <div class="fc-stops">Direct</div>
              </div>
              <div class="fc-endpoint">
                <div class="fc-time">{{ formatTime(flight.arrivalTime) }}</div>
                <div class="fc-airport">{{ toLabel.split('(')[0].trim() }} · {{ flight.destinationAirportId?.iataCode || 'SIN' }}</div>
                <div class="fc-date">{{ formatDateLabel(flight.arrivalTime) }}</div>
              </div>
              <div class="fc-price-box">
                <span class="fc-badge">Economy Class</span>
                <div class="fc-price-amt">₱{{ flight.basePrice?.toLocaleString() }}</div>
                <div class="fc-price-note">Flight {{ flight.flightNumber }}</div>
                <button class="fc-select-btn" @click.stop="selectFlight(0, flight._id)">
                  {{ selectedFlightIds[0] === flight._id ? 'Selected ✓' : 'Select →' }}
                </button>
              </div>
            </div>

            <div v-if="tripType === 'roundtrip'" class="mt-5">
              <div class="results-banner gold-banner-dim">
                🔄 Select return flight from <strong>{{ toLabel }}</strong> to <strong>{{ fromLabel }}</strong>
              </div>

              <div v-if="!flightResultsPerSegment[1] || flightResultsPerSegment[1].length === 0" class="alert alert-warning text-center my-3">
                No matching return flights found for this segment layout on the specified date.
              </div>

              <!-- Return Flight Cards Generation Loop -->
              <div 
                v-for="flight in flightResultsPerSegment[1]" 
                :key="flight._id"
                class="flight-card" 
                :class="{ selected: selectedFlightIds[1] === flight._id }"
                @click="selectFlight(1, flight._id)"
              >
                <div class="fc-endpoint">
                  <div class="fc-time">{{ formatTime(flight.departureTime) }}</div>
                  <div class="fc-airport">{{ toLabel.split('(')[0].trim() }} · {{ flight.originAirportId?.iataCode || 'SIN' }}</div>
                  <div class="fc-date">{{ formatDateLabel(flight.departureTime) }}</div>
                </div>
                <div class="fc-mid">
                  <div class="fc-duration">{{ calcTravelTime(flight.departureTime, flight.arrivalTime) }}</div>
                  <div class="fc-line"><span class="fc-plane-icon"><i class="bi bi-airplane-fill"></i></span></div>
                  <div class="fc-stops">Direct</div>
                </div>
                <div class="fc-endpoint">
                  <div class="fc-time">{{ formatTime(flight.arrivalTime) }}</div>
                  <div class="fc-airport">{{ fromLabel.split('(')[0].trim() }} · {{ flight.destinationAirportId?.iataCode || 'MNL' }}</div>
                  <div class="fc-date">{{ formatDateLabel(flight.arrivalTime) }}</div>
                </div>
                <div class="fc-price-box">
                  <span class="fc-badge">Economy Class</span>
                  <div class="fc-price-amt">₱{{ flight.basePrice?.toLocaleString() }}</div>
                  <div class="fc-price-note">Flight {{ flight.flightNumber }}</div>
                  <button class="fc-select-btn" @click.stop="selectFlight(1, flight._id)">
                    {{ selectedFlightIds[1] === flight._id ? 'Selected ✓' : 'Select →' }}
                  </button>
                </div>
              </div>
            </div> <!-- End of Roundtrip Check Wrapper -->

            <!-- SELECTION PROGRESS PROGRESS FOOTER CONTROL DOCK -->
            <div class="mt-5 mb-4">
              <div class="d-flex justify-content-between align-items-center bg-dark p-3 rounded border border-warning">
                <div class="selection-progress-box">
                  <span class="text-white me-2">Selection Progress:</span>
                  <span class="badge bg-warning text-dark px-3 py-2">
                    {{ selectedFlightIds.filter(id => id !== null).length }} / {{ tripType === 'roundtrip' ? 2 : 1 }} flight selected
                  </span>
                </div>
                <div>
                  <button 
                    class="btn btn-warning px-4 py-2 text-dark fw-bold" 
                    :disabled="!isSelectionComplete"
                    @click="proceedToCheckout"
                  >
                    Confirm Booking Sequence →
                  </button>
                </div>
              </div>
            </div>

          </div> <!-- End of hasSearched Check Wrapper -->
        </div>
      </div>
    </div>
  </div>
</template>
