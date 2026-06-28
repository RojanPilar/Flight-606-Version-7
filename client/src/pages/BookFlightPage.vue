<!-- BookFlightPage.vue — Theme-aware refactor
     Key changes from the original:
     ─────────────────────────────────────────────────────────────────────────
     PROBLEM 1 — page wrapper used Bootstrap's `bg-light` (hard-coded #f8f9fa).
       In dark theme this forced a light background that ignored --bg-60.
       FIX: replaced with `booking-page` class driven by var(--bg-60).

     PROBLEM 2 — card headers used hardcoded Bootstrap classes:
       • `bg-primary text-white`  → invisible in some theme combos
       • `bg-dark text-white`     → always dark regardless of theme
       • `bg-white`               → always white regardless of theme
       FIX: replaced with `bf-card-header--primary` / `bf-card-header--dark`
       / `bf-card-header--plain` scoped classes that read from design tokens.

     PROBLEM 3 — `card-body bg-light` on passenger form bodies forced a
       hard white/grey background ignoring the token system.
       FIX: replaced with `bf-card-body` which uses var(--bg-60-surface).

     PROBLEM 4 — `text-dark`, `text-muted`, `text-primary`, `text-success`
       are Bootstrap semantic classes resolved by Bootstrap's own palette,
       NOT your design tokens. In dark mode they can render near-black text
       on near-black backgrounds.
       FIX: replaced with scoped token-driven classes:
         bf-text-main   → color: var(--text)
         bf-text-muted  → color: var(--muted)
         bf-text-gold   → color: var(--gold)
         bf-text-success→ color: var(--success)

     PROBLEM 5 — Booking Summary panel used `bg-dark text-white` header
       (hardcoded black) and `text-success fw-bold` total (hardcoded green).
       FIX: both now use token classes so they adapt to either theme.

     PROBLEM 6 — `fw-bold text-dark` on flight leg labels would go black
       even in dark theme. Fixed to bf-text-main.

     PROBLEM 7 — form labels had no explicit color, inheriting from Bootstrap
       which doesn't know about your dark theme. Fixed to bf-text-main.

     PROBLEM 8 — seat map container used `bg-light rounded border` — forces
       Bootstrap's hard #f8f9fa. Replaced with bf-seatmap-bg.
     ─────────────────────────────────────────────────────────────────────────
-->
<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBookingStore } from '../stores/booking';
import { Notyf } from 'notyf';
import { getFlightById, getSeatsByFlight, getMyPassengers, getAirportById } from '../api.js';

const route = useRoute();
const router = useRouter();
const bookingStore = useBookingStore();
const notyf = new Notyf({ duration: 4000, position: { x: 'right', y: 'top' }, ripple: true });

const isGuestRoute = computed(() => route.name === 'GuestCheckout');

const flightsMap = ref([]);
const seatsMap = ref({});
const isLoading = ref(true);
const errorMessage = ref('');
const savedPassengers = ref([]);
// Airport cache: { [airportId]: airportObject }
const airportCache = ref({});

const activeLegIndex = ref(0);
const activePassengerIndex = ref(0);
const closedSections = ref([]);
const COLS = ['A', 'B', 'C', null, 'D', 'E', 'F'];

const flightIds = route.params.flightId ? route.params.flightId.split(',').filter(Boolean) : [];

function isOpen(key) {
    return !closedSections.value.includes(key);
}
function toggleSection(key) {
    const i = closedSections.value.indexOf(key);
    if (i > -1) closedSections.value.splice(i, 1);
    else closedSections.value.push(key);
}

// ── Airport resolution ─────────────────────────────────────────────────────
// Always stringify IDs — MongoDB can return ObjectId objects, not plain strings,
// which causes cache key mismatches (objectA !== objectA.toString()).
async function fetchAirport(rawId) {
    const id = rawId ? String(rawId) : null;
    if (!id) return null;
    if (airportCache.value[id]) return airportCache.value[id];
    try {
        const res = await getAirportById(id);
        // api.js wraps response: { message, result: { airport } }
        const airport = res.result ?? res ?? null;
        if (airport && airport.iataCode) airportCache.value[id] = airport;
        return airport;
    } catch { return null; }
}

function airportLabel(rawId) {
    const id = rawId ? String(rawId) : null;
    const a = airportCache.value[id];
    if (!a) return id ? '…' : '—';
    return a.iataCode ? `${a.iataCode}` : (a.city || a.name || '—');
}

// Full label with city name — used in Selected Flights card
function airportFullLabel(rawId) {
    const id = rawId ? String(rawId) : null;
    const a = airportCache.value[id];
    if (!a) return id ? '…' : '—';
    return a.city ? `${a.city} (${a.iataCode})` : (a.iataCode || '—');
}

onMounted(async () => {
    if (flightIds.length === 0) {
        errorMessage.value = 'No flight selected. Please go back and search again.';
        isLoading.value = false;
        return;
    }

    try {
        const flightsCollector = [];
        const flightSeatLoads = flightIds.map(id =>
            Promise.all([getFlightById(id), getSeatsByFlight(id)])
        );

        const [flightSeatResults, profilesResult] = await Promise.allSettled([
            Promise.all(flightSeatLoads),
            getMyPassengers()
        ]);

        if (flightSeatResults.status === 'fulfilled') {
            for (let i = 0; i < flightIds.length; i++) {
                const [flightRes, seatsRes] = flightSeatResults.value[i];
                flightsCollector.push(flightRes.result || flightRes.data || flightRes);
                seatsMap.value[flightIds[i]] = seatsRes.seats || seatsRes.result || [];
                selectedSeats.value[flightIds[i]] = [];
            }
            flightsMap.value = flightsCollector;
            bookingStore.startFunnel({ flights: flightsCollector, isGuest: isGuestRoute.value });

            for (let i = 0; i < flightIds.length; i++) {
                if (bookingStore.legs[i]) {
                    bookingStore.legs[i].seats = seatsMap.value[flightIds[i]] || [];
                }
            }

            // Fetch all unique airports used across all flights.
            // String() ensures ObjectId objects don't create duplicate cache keys.
            const airportIds = new Set();
            for (const f of flightsCollector) {
                if (f.originAirportId)      airportIds.add(String(f.originAirportId));
                if (f.destinationAirportId) airportIds.add(String(f.destinationAirportId));
            }
            await Promise.allSettled([...airportIds].map(fetchAirport));

        } else {
            errorMessage.value = 'Failed to load flight details. Please try again.';
        }

        if (profilesResult.status === 'fulfilled') {
            savedPassengers.value = profilesResult.value.passengers || profilesResult.value.result || [];
        }

    } catch (err) {
        errorMessage.value = 'We could not load this flight. Please search again.';
    } finally {
        isLoading.value = false;
    }
});

const passengerCount  = computed(() => bookingStore.passengers?.length || 1);
const selectedSeats   = ref({});

const currentLeg = computed(() => flightsMap.value[activeLegIndex.value] || null);
const currentFlightId = computed(() => currentLeg.value?._id);

function seatRows(flightId) {
    const seats = seatsMap.value[flightId];
    if (!seats || seats.length === 0) return [];
    const rows = new Set();
    seats.forEach(s => {
        if (s && s.seatNumber) {
            const num = parseInt(s.seatNumber, 10);
            if (!isNaN(num)) rows.add(num);
        }
    });
    return Array.from(rows).sort((a, b) => a - b);
}

function seatAt(flightId, row, col) {
    const seats = seatsMap.value[flightId];
    if (!seats) return null;
    return seats.find(s => s && s.seatNumber === `${row}${col}`) || null;
}

function ownerOf(legIndex, seatId) {
    const leg = bookingStore.legs?.[legIndex];
    if (!leg?.selectedSeatIds) return -1;
    return leg.selectedSeatIds.indexOf(seatId);
}

function seatBtnClass(legIndex, seat) {
    if (!seat || seat.isOccupied) return 'btn-secondary disabled';
    const owner = ownerOf(legIndex, seat._id);
    if (owner === activePassengerIndex.value) return 'btn-primary';
    if (owner > -1) return 'btn-info';
    return seat.class === 'business' ? 'btn-outline-warning' : 'btn-outline-success';
}

function onSeatClick(legIndex, seat) {
    if (!seat || seat.isOccupied) return;
    const flight = flightsMap.value[legIndex];
    if (!flight) return;

    const paxCount = passengerCount.value;
    const existingOwner = ownerOf(legIndex, seat._id);

    if (existingOwner > -1) {
        bookingStore.selectSeatForLeg(legIndex, existingOwner, null);
        const collection = [...(selectedSeats.value[flight._id] || [])];
        const idx = collection.findIndex(s => s._id === seat._id);
        if (idx > -1) collection.splice(idx, 1);
        selectedSeats.value[flight._id] = collection;
        activePassengerIndex.value = existingOwner;
        return;
    }

    if (activePassengerIndex.value >= paxCount) return;

    const leg = bookingStore.legs?.[legIndex];
    const prevSeatId = leg?.selectedSeatIds?.[activePassengerIndex.value];
    if (prevSeatId) {
        const collection = [...(selectedSeats.value[flight._id] || [])];
        const prevIdx = collection.findIndex(s => s._id === prevSeatId);
        if (prevIdx > -1) collection.splice(prevIdx, 1);
        selectedSeats.value[flight._id] = collection;
    }

    bookingStore.selectSeatForLeg(legIndex, activePassengerIndex.value, seat._id);

    if (bookingStore.legs[legIndex] && !bookingStore.legs[legIndex].seats?.length) {
        bookingStore.legs[legIndex].seats = seatsMap.value[flight._id] || [];
    }

    const collection = [...(selectedSeats.value[flight._id] || [])];
    collection.push(seat);
    selectedSeats.value[flight._id] = collection;

    const nextUnassigned = leg?.selectedSeatIds?.findIndex(
        (id, i) => i > activePassengerIndex.value && (id === null || id === undefined)
    ) ?? -1;

    if (nextUnassigned > -1) {
        activePassengerIndex.value = nextUnassigned;
    } else {
        activePassengerIndex.value = paxCount - 1;
    }
}

function applySaved(pIdx, savedId) {
    const sp = savedPassengers.value.find(s => s._id === savedId);
    if (!sp) return;
    const p = bookingStore.passengers[pIdx];
    if (!p) return;
    p.firstName   = sp.firstName || '';
    p.lastName    = sp.lastName || '';
    p.gender      = sp.gender || '';
    p.dateOfBirth = sp.dateOfBirth ? sp.dateOfBirth.substring(0, 10) : '';
    p.nationality = sp.nationality || '';
    p.passportNumber = sp.passportNumber || '';
    p.passportExpiry = sp.passportExpiry ? sp.passportExpiry.substring(0, 10) : '';
    p.phone = sp.phone || '';
}

function digitsOnly(p) {
    if (p) p.phone = (p.phone || '').replace(/\D/g, '').slice(0, 11);
}

function getSeatPrice(flight, seat) {
    if (!flight || !seat) return 0;
    return seat.class === 'business' ? (flight.businessPrice ?? 0) : (flight.basePrice ?? 0);
}

const grandTotalValue = computed(() => {
    let total = 0;
    for (const flight of flightsMap.value) {
        for (const seat of (selectedSeats.value[flight._id] || [])) {
            total += getSeatPrice(flight, seat);
        }
    }
    return total;
});

function validateAndContinue() {
    errorMessage.value = '';

    if (!bookingStore.isSeatSelectionComplete) {
        errorMessage.value = 'Please select a seat for every passenger on every flight.';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    let hasError = false;
    bookingStore.passengers.forEach((p) => {
        if (!p.firstName.trim() || !p.lastName.trim() || !p.passportNumber.trim() || !p.gender || String(p.phone).length !== 11) {
            hasError = true;
        }
    });

    if (hasError) {
        errorMessage.value = 'Please complete all required passenger details (Phone must be 11 digits).';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    router.push({ name: 'ConfirmPayment' });
}

// ── Leg label ──────────────────────────────────────────────────────────────
function legLabel(flight, i) {
    if (!flight) return 'Flight';
    const origin = airportFullLabel(flight.originAirportId);
    const dest   = airportFullLabel(flight.destinationAirportId);
    const dateLabel = flight.departureTime
        ? new Date(flight.departureTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
        : '';
    const prefix = flightsMap.value.length > 1
        ? (i === 0 ? 'Departure Flight · ' : 'Return Flight · ')
        : '';
    return `${prefix}${origin} → ${dest} · ${dateLabel} · ${flight.flightNumber || ''}`;
}

// Short label for leg tab buttons
function legTabLabel(flight, i) {
    if (!flight) return `Flight ${i + 1}`;
    const originId = String(flight.originAirportId || '');
    const destId   = String(flight.destinationAirportId || '');
    const origin = airportCache.value[originId]?.iataCode || '???';
    const dest   = airportCache.value[destId]?.iataCode   || '???';
    const prefix = flightsMap.value.length > 1
        ? (i === 0 ? 'Departure' : 'Return')
        : flight.flightNumber || `Flight ${i + 1}`;
    return flightsMap.value.length > 1 ? `${prefix}: ${origin} → ${dest}` : prefix;
}

function routerBack() {
  router.back()
}
</script>

<template>
    <div class="booking-page">
        <div class="container py-5">

            <div v-if="isLoading" class="text-center py-5">
                <div class="spinner-border bf-text-gold" role="status"></div>
                <p class="mt-3 fw-bold bf-text-muted">Loading your flight details…</p>
            </div>

            <div v-else-if="errorMessage" class="alert alert-danger shadow-sm my-5 d-flex justify-content-between align-items-center">
                <span><i class="bi bi-exclamation-triangle-fill me-2"></i> {{ errorMessage }}</span>
                <button class="btn btn-sm btn-outline-danger" @click="router.push({ name: 'SearchFlights' })">Search again</button>
            </div>

            <div v-else class="row g-4 mt-5">
                <!-- ── Left column ────────────────────────────────── -->
                <div class="col-lg-8">

                    <!-- Breadcrumbs -->
                    <nav class="theme-breadcrumb mb-4" aria-label="breadcrumb">
                      <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item">
                            <RouterLink :to="{ name: 'Home' }">Home</RouterLink>
                        </li>
                        <li class="breadcrumb-item active"><a href="#" @click.prevent="routerBack">Flights</a></li>
                        <li class="breadcrumb-item active">Booking Details</li>
                      </ol>
                    </nav>

                    <!-- Selected Flights card -->
                    <div class="card bf-card shadow-sm border-0 mb-4">
                        <div class="bf-card-header--primary py-3 px-3">
                            <h5 class="mb-0"><i class="bi bi-airplane me-2"></i> Selected Flights</h5>
                        </div>
                        <div class="bf-card-body">
                            <div v-for="(flight, i) in flightsMap" :key="i" class="fw-bold bf-text-main py-1">
                                {{ legLabel(flight, i) }}
                            </div>
                        </div>
                    </div>

                    <!-- Passenger Forms (Accordion) -->
                    <div v-for="(p, pIdx) in bookingStore.passengers" :key="pIdx" class="card bf-card shadow-sm border-0 mb-4">
                        <div
                            class="bf-card-header--plain d-flex justify-content-between align-items-center py-3 px-3"
                            style="cursor: pointer;"
                            @click="toggleSection(pIdx)"
                        >
                            <div class="d-flex align-items-center">
                                <i class="bi bi-person-badge fs-4 bf-text-gold me-3"></i>
                                <div>
                                    <h6 class="mb-0 fw-bold bf-text-main">Passenger {{ pIdx + 1 }}</h6>
                                    <small class="bf-text-muted">Personal &amp; passport details</small>
                                </div>
                            </div>
                            <i :class="isOpen(pIdx) ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" class="bf-text-muted"></i>
                        </div>

                        <div class="bf-card-body bf-card-body--alt border-top" v-if="isOpen(pIdx)">
                            <div v-if="savedPassengers.length > 0" class="mb-4">
                                <label class="form-label small fw-bold bf-text-gold">Autofill from saved profile</label>
                                <select class="form-select bf-select" @change="applySaved(pIdx, $event.target.value)">
                                    <option value="">— Select —</option>
                                    <option v-for="sp in savedPassengers" :key="sp._id" :value="sp._id">
                                        {{ sp.firstName }} {{ sp.lastName }} ({{ sp.passportNumber }})
                                    </option>
                                </select>
                            </div>

                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label small fw-bold bf-text-main">First Name</label>
                                    <input type="text" class="form-control bf-input" v-model="p.firstName" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label small fw-bold bf-text-main">Last Name</label>
                                    <input type="text" class="form-control bf-input" v-model="p.lastName" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold bf-text-main">Date of Birth</label>
                                    <input type="date" class="form-control bf-input" v-model="p.dateOfBirth" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold bf-text-main">Gender</label>
                                    <select class="form-select bf-select" v-model="p.gender" required>
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold bf-text-main">Nationality</label>
                                    <input type="text" class="form-control bf-input" v-model="p.nationality" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold bf-text-main">Phone (11 digits)</label>
                                    <input type="tel" class="form-control bf-input" v-model="p.phone" maxlength="11" @input="digitsOnly(p)" placeholder="09XXXXXXXXX" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold bf-text-main">Passport Number</label>
                                    <input type="text" class="form-control bf-input" v-model="p.passportNumber" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small fw-bold bf-text-main">Passport Expiry</label>
                                    <input type="date" class="form-control bf-input" v-model="p.passportExpiry" required>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Seat Map -->
                    <div class="card bf-card shadow-sm border-0 mb-4">
                        <div
                            class="bf-card-header--plain d-flex justify-content-between align-items-center py-3 px-3"
                            style="cursor: pointer;"
                            @click="toggleSection('seats')"
                        >
                            <div class="d-flex align-items-center">
                                <i class="bi bi-grid-3x3-gap fs-4 bf-text-gold me-3"></i>
                                <div>
                                    <h6 class="mb-0 fw-bold bf-text-main">Select Seats</h6>
                                    <small class="bf-text-muted">Choose a seat for each passenger</small>
                                </div>
                            </div>
                            <i :class="isOpen('seats') ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" class="bf-text-muted"></i>
                        </div>

                        <div class="bf-card-body p-4" v-if="isOpen('seats')">

                            <!-- Leg tabs: "Departure: HND → MNL" / "Return: MNL → HND" -->
                            <div class="d-flex gap-2 mb-4 overflow-auto">
                                <button
                                    v-for="(flight, i) in flightsMap"
                                    :key="i"
                                    class="btn"
                                    :class="activeLegIndex === i ? 'btn-primary' : 'btn-outline-secondary'"
                                    @click="activeLegIndex = i; activePassengerIndex = bookingStore.legs?.[i]?.selectedSeatIds?.findIndex(id => !id) ?? 0; activePassengerIndex = activePassengerIndex < 0 ? passengerCount - 1 : activePassengerIndex"
                                >
                                    {{ legTabLabel(flight, i) }}
                                    <i
                                        v-if="bookingStore.legs?.[i]?.selectedSeatIds?.every(id => !!id) && bookingStore.legs?.[i]?.selectedSeatIds?.length === passengerCount"
                                        class="bi bi-check-circle-fill text-warning ms-1"
                                    ></i>
                                </button>
                            </div>

                            <!-- Passenger status strip: numbered 1, 2, 3 (no "Pax" prefix) -->
                            <div class="d-flex align-items-center gap-2 mb-4 pb-3 border-bottom flex-wrap">
                                <span class="bf-text-muted small me-1">Assigning seats:</span>
                                <div
                                    v-for="(p, i) in bookingStore.passengers"
                                    :key="i"
                                    class="d-flex align-items-center gap-1 px-3 py-2 rounded"
                                    :class="i === activePassengerIndex
                                        ? 'bg-success text-white fw-bold'
                                        : bookingStore.legs?.[activeLegIndex]?.selectedSeatIds?.[i]
                                            ? 'bf-pax-done'
                                            : 'bf-pax-pending'"
                                    style="font-size: 0.85rem; min-width: 2.5rem; justify-content: center;"
                                >
                                    <i
                                        class="bi me-1"
                                        :class="bookingStore.legs?.[activeLegIndex]?.selectedSeatIds?.[i]
                                            ? 'bi-check-circle-fill'
                                            : i === activePassengerIndex ? 'bi-cursor-fill' : 'bi-circle'"
                                    ></i>
                                    <!-- Number only: 1, 2, 3 -->
                                    {{ i + 1 }}
                                    <span v-if="bookingStore.legs?.[activeLegIndex]?.selectedSeatIds?.[i]" class="ms-1 small opacity-75">
                                        {{ seatsMap[currentFlightId]?.find(s => s._id === bookingStore.legs[activeLegIndex].selectedSeatIds[i])?.seatNumber || '' }}
                                    </span>
                                    <span v-else-if="i === activePassengerIndex" class="ms-1 small opacity-75">←</span>
                                </div>
                            </div>

                            <div class="bf-seatmap-bg text-center p-3 rounded">

                                <!-- Column headers -->
                                <div class="d-flex justify-content-center gap-2 mb-2">
                                    <div style="width:20px"></div>
                                    <template v-for="col in COLS" :key="col ?? 'aisle'">
                                        <div v-if="col === null" style="width: 30px;"></div>
                                        <div v-else class="fw-bold bf-text-muted" style="width: 40px;">{{ col }}</div>
                                    </template>
                                </div>

                                <!-- Business class -->
                                <div class="d-flex align-items-center gap-2 mb-2 mt-3">
                                    <span class="badge bg-warning text-dark px-3 py-2">
                                        <i class="bi bi-star-fill me-1"></i>Business Class
                                    </span>
                                    <span class="bf-text-muted small fw-bold" v-if="currentLeg">
                                        ₱{{ (currentLeg.businessPrice ?? 0).toLocaleString() }} / seat
                                    </span>
                                </div>

                                <div v-for="r in seatRows(currentFlightId).filter(r => r <= 2)" :key="'b-' + r" class="d-flex justify-content-center gap-2 mb-2">
                                    <div class="fw-bold bf-text-muted d-flex align-items-center justify-content-center" style="width: 20px;">{{ r }}</div>
                                    <template v-for="col in COLS" :key="col ?? 'aisle'">
                                        <div v-if="col === null" style="width: 30px;"></div>
                                        <button
                                            v-else
                                            type="button"
                                            class="btn btn-sm p-0 d-flex align-items-center justify-content-center"
                                            :class="seatBtnClass(activeLegIndex, seatAt(currentFlightId, r, col))"
                                            style="width: 40px; height: 40px;"
                                            :disabled="!seatAt(currentFlightId, r, col) || seatAt(currentFlightId, r, col).isOccupied"
                                            @click="onSeatClick(activeLegIndex, seatAt(currentFlightId, r, col))"
                                        >{{ r }}{{ col }}</button>
                                    </template>
                                </div>

                                <hr class="my-3" />

                                <!-- Economy class -->
                                <div class="d-flex align-items-center gap-2 mb-2">
                                    <span class="badge bg-success px-3 py-2">
                                        <i class="bi bi-person-fill me-1"></i>Economy Class
                                    </span>
                                    <span class="bf-text-muted small fw-bold" v-if="currentLeg">
                                        ₱{{ (currentLeg.basePrice ?? 0).toLocaleString() }} / seat
                                    </span>
                                </div>

                                <div v-for="r in seatRows(currentFlightId).filter(r => r > 2)" :key="'e-' + r" class="d-flex justify-content-center gap-2 mb-2">
                                    <div class="fw-bold bf-text-muted d-flex align-items-center justify-content-center" style="width: 20px;">{{ r }}</div>
                                    <template v-for="col in COLS" :key="col ?? 'aisle'">
                                        <div v-if="col === null" style="width: 30px;"></div>
                                        <button
                                            v-else
                                            type="button"
                                            class="btn btn-sm p-0 d-flex align-items-center justify-content-center"
                                            :class="seatBtnClass(activeLegIndex, seatAt(currentFlightId, r, col))"
                                            style="width: 40px; height: 40px;"
                                            :disabled="!seatAt(currentFlightId, r, col) || seatAt(currentFlightId, r, col).isOccupied"
                                            @click="onSeatClick(activeLegIndex, seatAt(currentFlightId, r, col))"
                                        >{{ r }}{{ col }}</button>
                                    </template>
                                </div>

                                <!-- Legend -->
                                <div class="d-flex justify-content-center gap-3 mt-4 flex-wrap">
                                    <span class="d-flex align-items-center gap-1 small bf-text-muted">
                                        <span class="btn btn-sm btn-outline-warning px-2 py-0" style="pointer-events:none;">1A</span> Business
                                    </span>
                                    <span class="d-flex align-items-center gap-1 small bf-text-muted">
                                        <span class="btn btn-sm btn-outline-success px-2 py-0" style="pointer-events:none;">3A</span> Economy
                                    </span>
                                    <span class="d-flex align-items-center gap-1 small bf-text-muted">
                                        <span class="btn btn-sm btn-primary px-2 py-0" style="pointer-events:none;">✓</span> Your seat
                                    </span>
                                    <span class="d-flex align-items-center gap-1 small bf-text-muted">
                                        <span class="btn btn-sm btn-info px-2 py-0" style="pointer-events:none;">✓</span> Other pax
                                    </span>
                                    <span class="d-flex align-items-center gap-1 small bf-text-muted">
                                        <span class="btn btn-sm btn-secondary px-2 py-0" style="pointer-events:none;">✗</span> Taken
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="d-flex justify-content-end mb-5">
                        <button type="button" class="btn btn-lg btn-success px-5 fw-bold shadow" @click="validateAndContinue">
                            Continue to Payment <i class="bi bi-arrow-right ms-2"></i>
                        </button>
                    </div>
                </div>

                <!-- ── Booking Summary sidebar ──────────────────── -->
                <div class="col-lg-4">
                    <div class="card bf-card shadow-sm border-0 position-sticky" style="top: 5rem;">
                        <div class="bf-card-header--dark py-3 px-3">
                            <h5 class="mb-0"><i class="bi bi-receipt me-2"></i> Booking Summary</h5>
                        </div>
                        <div class="bf-card-body">
                            <div class="bf-text-muted small border-bottom pb-2 mb-3">
                                {{ bookingStore.passengers.length }} passenger(s) · {{ flightsMap.length }} flight(s)
                            </div>

                            <div v-for="flight in flightsMap" :key="flight._id" class="mb-3">
                                <div class="fw-bold small bf-text-gold text-uppercase mb-1">
                                    {{ flight.flightNumber }}
                                    <span class="bf-text-muted fw-normal text-lowercase ms-1" style="font-size:0.75rem;">
                                        {{ airportLabel(flight.originAirportId) }} → {{ airportLabel(flight.destinationAirportId) }}
                                    </span>
                                </div>
                                <div
                                    v-for="(seat, pIdx) in (selectedSeats[flight._id] || [])"
                                    :key="seat._id"
                                    class="d-flex justify-content-between align-items-center my-1 ms-1"
                                >
                                    <span class="small bf-text-muted">
                                        <!-- Number only: 1, 2, 3 -->
                                        {{ pIdx + 1 }} · Seat {{ seat.seatNumber }}
                                        <span
                                            class="badge ms-1"
                                            :class="seat.class === 'business' ? 'bg-warning text-dark' : 'bg-success'"
                                        >{{ seat.class }}</span>
                                    </span>
                                    <span class="fw-bold small bf-text-main">
                                        ₱{{ getSeatPrice(flight, seat).toLocaleString() }}
                                    </span>
                                </div>
                                <div v-if="!(selectedSeats[flight._id] || []).length" class="small bf-text-muted ms-1">
                                    No seats selected yet
                                </div>
                            </div>

                            <div class="d-flex justify-content-between align-items-center pt-3 mt-2 border-top">
                                <h5 class="fw-bold mb-0 bf-text-main">Total</h5>
                                <h4 class="bf-text-success fw-bold mb-0">
                                    ₱{{ grandTotalValue.toLocaleString() }}
                                </h4>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
.booking-page {
    background: var(--bg-60);
    min-height: 100vh;
    transition: var(--theme-transition);
}
.bf-card {
    background: var(--bg-60-surface) !important;
    border: 1px solid var(--border-dim) !important;
    transition: var(--theme-transition);
}
.bf-card-header--primary {
    background: var(--gold-dim);
    border-bottom: 1px solid var(--border);
    color: var(--gold);
    font-family: var(--font-sans);
}
.bf-card-header--plain {
    background: var(--bg-60-surface);
    border-bottom: 1px solid var(--border-dim);
    transition: var(--theme-transition);
}
.bf-card-header--dark {
    background: var(--bg-60-mid);
    border-bottom: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font-sans);
    transition: var(--theme-transition);
}
.bf-card-body {
    background: var(--bg-60-surface);
    padding: 1.25rem;
    transition: var(--theme-transition);
}
.bf-card-body--alt {
    background: var(--bg-60-mid);
}
.bf-text-main    { color: var(--text) !important; }
.bf-text-muted   { color: var(--muted) !important; }
.bf-text-gold    { color: var(--gold) !important; }
.bf-text-success { color: var(--success) !important; }
.bf-input,
.bf-select {
    background: var(--glass-bg-lt) !important;
    border-color: var(--border-dim) !important;
    color: var(--text) !important;
    transition: border-color 0.2s ease, background 0.2s ease;
}
.bf-input:focus,
.bf-select:focus {
    background: var(--gold-dim) !important;
    border-color: var(--gold) !important;
    color: var(--text) !important;
    box-shadow: 0 0 0 0.15rem var(--accent-30-dim) !important;
}
.bf-input::placeholder { color: var(--muted) !important; }
.bf-select option {
    background: var(--bg-60-mid);
    color: var(--text);
}
.bf-seatmap-bg {
    background: var(--bg-60-mid);
    border: 1px solid var(--border-dim);
    transition: var(--theme-transition);
}
.bf-pax-done {
    background: var(--gold-dim);
    color: var(--success);
    border: 1px solid var(--success);
}
.bf-pax-pending {
    background: var(--bg-60-mid);
    color: var(--muted);
    border: 1px solid var(--border-dim);
}
</style>