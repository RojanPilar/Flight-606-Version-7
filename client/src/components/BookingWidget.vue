<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CalendarPicker from './CalendarPicker.vue'
import { getAllAirports } from '../api.js'

const router = useRouter()

// ── Live airport data ──────────────────────────────────────────────────────
const airports = ref([])

onMounted(async () => {
  try {
    const res = await getAllAirports()
    airports.value = res.result || res || []
    if (airports.value.length > 0) {
      fromVal.value = airports.value[0]._id
      if (airports.value[1]) toVal.value = airports.value[1]._id
      // Pre-fill the first two multi-city rows with real airport IDs
      if (mcRows.value[0]) mcRows.value[0].from = airports.value[0]._id
      if (mcRows.value[0] && airports.value[1]) mcRows.value[0].to = airports.value[1]._id
      if (mcRows.value[1] && airports.value[1]) mcRows.value[1].from = airports.value[1]._id
      if (mcRows.value[1] && airports.value[0]) mcRows.value[1].to = airports.value[0]._id
    }
  } catch (err) {
    console.error('Failed to load airports for the booking widget:', err)
  }
})

// ── Tabs ───────────────────────────────────────────────────────────────────
const activeTab = ref('buy')   // 'buy' | 'status'

// ── Trip mode ──────────────────────────────────────────────────────────────
const tripMode  = ref('one')   // 'one' | 'round' | 'multi'

// ── Date models ────────────────────────────────────────────────────────────
const depDate   = ref('')      // one-way departure
const rtDepDate = ref('')      // round-trip departure
const rtRetDate = ref('')      // round-trip return
const stDate    = ref('')      // flight-status date

// ── Form values ────────────────────────────────────────────────────────────
const fromVal   = ref('')
const toVal     = ref('')
const paxVal    = ref('2 Adults')

// ── Validation ─────────────────────────────────────────────────────────────
const isBookDisabled = computed(() => {
  if (tripMode.value === 'multi') {
    // Every multi-city row must have from, to, and a date
    return mcRows.value.some(r => !r.from || !r.to || !r.date)
  }
  if (!fromVal.value || !toVal.value) return true
  if (tripMode.value === 'one')   return !depDate.value
  if (tripMode.value === 'round') return !rtDepDate.value || !rtRetDate.value || rtRetDate.value <= rtDepDate.value
  return true
})

// ── Navigate to SearchFlightsPage ──────────────────────────────────────────
// Mirrors exactly what SearchFlightsPage.vue reads from route.query on mount.
function goToSearch() {
  if (isBookDisabled.value) return

  if (tripMode.value === 'multi') {
    // Multi-city: chain the legs by navigating with the first leg's params.
    // SearchFlightsPage handles one or two legs; for true multi we pass the
    // first two as outbound + return so the user can at least see those results.
    // Full multi-city search is a future feature.
    const first = mcRows.value[0]
    router.push({
      name: 'SearchFlights',
      query: {
        from: first.from,
        to:   first.to,
        date: first.date,
        type: 'oneway',
        pax:  paxVal.value
      }
    })
    return
  }

  const query = {
    from: fromVal.value,
    to:   toVal.value,
    date: tripMode.value === 'round' ? rtDepDate.value : depDate.value,
    type: tripMode.value === 'round' ? 'roundtrip' : 'oneway',
    pax:  paxVal.value
  }

  // Pass returnDate so SearchFlightsPage can auto-fill it and fire both legs
  if (tripMode.value === 'round') {
    query.returnDate = rtRetDate.value
  }

  router.push({ name: 'SearchFlights', query })
}

// ── Flight status lookup ───────────────────────────────────────────────────
const flightNumberQuery = ref('')
function goToFlightStatus() {
  if (!flightNumberQuery.value.trim()) return
  router.push({
    name: 'FlightStatus',
    query: {
      flightNumber: flightNumberQuery.value.trim(),
      ...(stDate.value ? { date: stDate.value } : {})
    }
  })
}

// ── Multi-city rows ────────────────────────────────────────────────────────
// IDs start empty — onMounted fills them with real airport _ids once loaded
const mcRows = ref([
  { id: 1, from: '', to: '', date: '' },
  { id: 2, from: '', to: '', date: '' },
])
let mcNextId = 3

function addMcRow() {
  if (mcRows.value.length >= 5) return
  // Pre-fill from = last row's "to" as a convenience
  const last = mcRows.value[mcRows.value.length - 1]
  mcRows.value.push({ id: mcNextId++, from: last?.to || '', to: '', date: '' })
}

function removeMcRow(id) {
  if (mcRows.value.length <= 2) return   // keep at least 2 rows
  mcRows.value = mcRows.value.filter(r => r.id !== id)
}
</script>

<template>
  <div class="booking-widget" aria-label="Flight booking widget">

    <!-- Header: tabs + CTA -->
    <div class="widget-header">
      <div class="widget-tabs">
        <button
          class="w-tab"
          :class="{ active: activeTab === 'buy' }"
          @click="activeTab = 'buy'"
        >Buy Tickets</button>
        <button
          class="w-tab"
          :class="{ active: activeTab === 'status' }"
          @click="activeTab = 'status'"
        >Check Flight Status</button>
      </div>
      <button
        class="btn-gold"
        :disabled="isBookDisabled"
        :title="tripMode === 'round' && rtRetDate && rtRetDate <= rtDepDate
          ? 'Return date must be after departure date.'
          : tripMode === 'multi' && mcRows.some(r => !r.from || !r.to || !r.date)
            ? 'Please fill in all flight legs.'
            : ''"
        @click="goToSearch"
      >Book Now</button>
    </div>

    <!-- ── BUY TICKETS ── -->
    <div v-if="activeTab === 'buy'">

      <div class="trip-radios">
        <label class="r-lbl">
          <input type="radio" name="trip" value="one" v-model="tripMode">
          <span>One way</span>
        </label>
        <label class="r-lbl">
          <input type="radio" name="trip" value="round" v-model="tripMode">
          <span>Round trip</span>
        </label>
        <label class="r-lbl">
          <input type="radio" name="trip" value="multi" v-model="tripMode">
          <span>Multi-city</span>
        </label>
      </div>

      <!-- ONE WAY -->
      <div v-if="tripMode === 'one'" class="wf wf-1">
        <div class="w-field">
          <label class="w-flabel"><i class="ti ti-plane-departure"></i> From</label>
          <select class="w-sel" v-model="fromVal">
            <option value="">Select Departure…</option>
            <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.city }} ({{ a.iataCode }})</option>
          </select>
        </div>
        <div class="w-field">
          <label class="w-flabel"><i class="ti ti-plane-arrival"></i> To</label>
          <select class="w-sel" v-model="toVal">
            <option value="">Select Destination…</option>
            <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.city }} ({{ a.iataCode }})</option>
          </select>
        </div>
        <div class="w-field" style="position:relative; overflow:visible;">
          <label class="w-flabel"><i class="ti ti-calendar"></i> Departure Date</label>
          <CalendarPicker v-model="depDate" placeholder="Select date…" />
        </div>
        <div class="w-field">
          <label class="w-flabel"><i class="ti ti-users"></i> Passengers</label>
          <select class="w-sel" v-model="paxVal">
            <option>1 Adult</option>
            <option>2 Adults</option>
            <option>3 Adults</option>
          </select>
        </div>
      </div>

      <!-- ROUND TRIP -->
      <div v-else-if="tripMode === 'round'" class="wf wf-rt">
        <div class="w-field">
          <label class="w-flabel"><i class="ti ti-plane-departure"></i> From</label>
          <select class="w-sel" v-model="fromVal">
            <option value="">Select Departure…</option>
            <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.city }} ({{ a.iataCode }})</option>
          </select>
        </div>
        <div class="w-field">
          <label class="w-flabel"><i class="ti ti-plane-arrival"></i> To</label>
          <select class="w-sel" v-model="toVal">
            <option value="">Select Destination…</option>
            <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.city }} ({{ a.iataCode }})</option>
          </select>
        </div>
        <div class="w-field" style="position:relative; overflow:visible;">
          <label class="w-flabel"><i class="ti ti-calendar"></i> Departure</label>
          <CalendarPicker v-model="rtDepDate" placeholder="Select date…" />
        </div>
        <div class="w-field" style="position:relative; overflow:visible;">
          <label class="w-flabel"><i class="ti ti-calendar-event"></i> Return</label>
          <CalendarPicker v-model="rtRetDate" placeholder="Select date…" :align-right="true" :min-date="rtDepDate" />
          <small v-if="rtRetDate && rtRetDate <= rtDepDate" style="color:#ff4d4d; font-size:0.72rem;">
            Must be after departure
          </small>
        </div>
        <div class="w-field">
          <label class="w-flabel"><i class="ti ti-users"></i> Passengers</label>
          <select class="w-sel" v-model="paxVal">
            <option>1 Adult</option>
            <option>2 Adults</option>
            <option>3 Adults</option>
          </select>
        </div>
      </div>

      <!-- MULTI-CITY -->
      <div v-else-if="tripMode === 'multi'">
        <div
          v-for="row in mcRows"
          :key="row.id"
          class="mc-row"
        >
          <div class="w-field">
            <label class="w-flabel"><i class="ti ti-plane-departure"></i> From</label>
            <select class="w-sel" v-model="row.from">
              <option value="">Select Departure…</option>
              <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.city }} ({{ a.iataCode }})</option>
            </select>
          </div>
          <div class="w-field">
            <label class="w-flabel"><i class="ti ti-plane-arrival"></i> To</label>
            <select class="w-sel" v-model="row.to">
              <option value="">Select Destination…</option>
              <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.city }} ({{ a.iataCode }})</option>
            </select>
          </div>
          <div class="w-field" style="position:relative; overflow:visible;">
            <label class="w-flabel"><i class="ti ti-calendar"></i> Date</label>
            <CalendarPicker v-model="row.date" placeholder="Select date…" />
          </div>
          <button class="mc-remove" @click="removeMcRow(row.id)" :aria-label="`Remove flight ${row.id}`">
            <i class="ti ti-x" style="font-size:14px"></i>
          </button>
        </div>

        <button
          v-if="mcRows.length < 5"
          class="mc-add"
          @click="addMcRow"
        >
          <i class="ti ti-plus" style="font-size:14px"></i> Add another flight
        </button>

        <div class="pax-row">
          <div class="w-field">
            <label class="w-flabel"><i class="ti ti-users"></i> Passengers</label>
            <select class="w-sel" v-model="paxVal">
              <option>1 Adult</option>
              <option>2 Adults</option>
              <option>3 Adults</option>
            </select>
          </div>
        </div>
      </div>

    </div><!-- /buy -->

    <!-- ── FLIGHT STATUS ── -->
    <div v-else-if="activeTab === 'status'">
      <div class="wf wf-st">
        <div class="w-field">
          <label class="w-flabel"><i class="ti ti-plane"></i> Flight Number</label>
          <input type="text" class="w-inp" v-model="flightNumberQuery" placeholder="e.g. F606-001" @keyup.enter="goToFlightStatus">
        </div>
        <div class="w-field" style="position:relative; overflow:visible;">
          <label class="w-flabel"><i class="ti ti-calendar"></i> Date</label>
          <CalendarPicker v-model="stDate" placeholder="Select date…" />
        </div>
      </div>
      <button class="btn-gold-full mt-3" :disabled="!flightNumberQuery.trim()" @click="goToFlightStatus">Track Flight</button>
    </div>

  </div>
</template>