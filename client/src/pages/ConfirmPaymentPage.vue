<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Notyf } from 'notyf'
import {
  createPassengerUser, createPassengerGuest, getMyPassengers, getPassengerForGuest,
  createBookingUser, createBookingGuest,
  createBookingPassenger, createBookingPassengerGuest,
  createPaymentUser, createPaymentGuest,
  getSeatsByFlight, getAirportById
} from '../api.js'
import { useBookingStore } from '../stores/booking.js'

const router = useRouter()
const bookingStore = useBookingStore()
const notyf = new Notyf({ duration: 4000, position: { x: 'right', y: 'top' }, ripple: true })

const paymentMethod = ref('credit_card')
const card = ref({ name: '', number: '', expiry: '', cvv: '' })
const isProcessing = ref(false)
const errorMsg = ref('')

// Airport cache: { [stringId]: airportObject } — same pattern as BookFlightPage
const airportCache = ref({})

async function fetchAirport(rawId) {
  const id = rawId ? String(rawId) : null
  if (!id) return null
  if (airportCache.value[id]) return airportCache.value[id]
  try {
    const res = await getAirportById(id)
    const airport = res.result ?? res ?? null
    if (airport?.iataCode) airportCache.value[id] = airport
    return airport
  } catch { return null }
}

function airportIata(rawId) {
  const id = rawId ? String(rawId) : null
  return airportCache.value[id]?.iataCode || null
}

// Pre-fetched profiles to prevent unnecessary 409 Conflict errors
const savedPassengers = ref([])

onMounted(async () => {
  if (bookingStore.legs.length === 0) {
    router.replace({ name: 'SearchFlights' })
    return
  }

  // CRITICAL: If leg.seats is missing (component navigated to fresh, store lost
  // the seats array which is not persisted across navigation), re-fetch them now.
  // This makes ConfirmPaymentPage self-healing — it never shows ₱0.
  for (let i = 0; i < bookingStore.legs.length; i++) {
    const leg = bookingStore.legs[i]
    if (!leg.seats || leg.seats.length === 0) {
      try {
        const res = await getSeatsByFlight(leg.flightId)
        leg.seats = res.seats || res.result || []
      } catch (e) {
        console.warn(`Could not re-fetch seats for leg ${i}:`, e)
      }
    }
  }

  // Fetch all airports referenced by every leg's flight object so legLabel()
  // can show real IATA codes instead of DEP/ARR.
  // leg.flight.originAirportId is a raw string ID — NOT a populated object.
  const airportIdSet = new Set()
  for (const leg of bookingStore.legs) {
    const f = leg.flight || {}
    if (f.originAirportId)      airportIdSet.add(String(f.originAirportId))
    if (f.destinationAirportId) airportIdSet.add(String(f.destinationAirportId))
  }
  await Promise.allSettled([...airportIdSet].map(fetchAirport))

  // Optimize: Pre-fetch saved passengers on mount for authenticated users
  if (bookingStore.mode !== 'guest') {
    try {
      const res = await getMyPassengers()
      savedPassengers.value = res?.passengers || res?.result || []
    } catch (e) {
      console.warn("Could not load saved profiles for checkout optimization.")
    }
  }
})

function legLabel(leg, i) {
  const f = leg.flight || {}
  // originAirportId is a raw string ID from the store — look it up in the cache
  const origin = airportIata(f.originAirportId) || f.originAirportId?.iataCode || '…'
  const dest   = airportIata(f.destinationAirportId) || f.destinationAirportId?.iataCode || '…'
  const dateLabel = f.departureTime
    ? new Date(f.departureTime).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    : ''
  const prefix = bookingStore.legs.length > 1 ? (i === 0 ? 'Departure · ' : 'Return · ') : ''
  return `${prefix}${origin} → ${dest} · ${dateLabel} · ${f.flightNumber || ''}`
}

// ─── Pricing (mirrors Checkout.vue exactly) ───────────────────
// The store only holds seat IDs, not seat objects or flight prices.
// We resolve the full seat object from leg.seats and read the price
// from leg.flight — the same fields the backend sets on every flight.
function getSeatPrice(leg, seat) {
  if (!leg || !seat) return 0
  const flight = leg.flight || {}
  return seat.class === 'business'
    ? (flight.businessPrice ?? 0)
    : (flight.basePrice ?? 0)
}

function seatFor(leg, pIdx) {
  if (!leg?.selectedSeatIds || !leg?.seats) return null
  const seatId = leg.selectedSeatIds[pIdx]
  return leg.seats.find(s => s._id === seatId) || null
}

function legSubtotal(i) {
  const leg = bookingStore.legs[i]
  if (!leg?.selectedSeatIds || !leg?.seats) return 0
  return leg.selectedSeatIds.reduce((sum, seatId) => {
    const seat = leg.seats.find(s => s._id === seatId)
    return sum + getSeatPrice(leg, seat)
  }, 0)
}

// Grand total across all legs — replaces bookingStore.totalAmount (which doesn't know seat class prices)
const grandTotal = computed(() =>
  bookingStore.legs.reduce((sum, _, i) => sum + legSubtotal(i), 0)
)

function formatCardNumber(e) {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 19)
  card.value.number = digits.match(/.{1,4}/g)?.join(' ') || digits
}

function formatExpiry(e) {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
  card.value.expiry = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits
}

function formatCvv(e) {
  card.value.cvv = e.target.value.replace(/\D/g, '').slice(0, 4)
}

function validatePayment() {
  if (!paymentMethod.value) return 'Please choose a payment method.'
  if (paymentMethod.value === 'credit_card' || paymentMethod.value === 'debit_card') {
    const digits = card.value.number.replace(/\s/g, '')
    if (!card.value.name.trim()) return 'Cardholder name is required.'
    if (digits.length < 13 || digits.length > 19) return 'Please enter a valid card number.'
    if (!/^\d{2}\/\d{2}$/.test(card.value.expiry)) return 'Please enter the expiry as MM/YY.'
    if (card.value.cvv.length < 3) return 'Please enter a valid CVV.'
  }
  return ''
}

async function confirmAndPay() {
  errorMsg.value = ''
  const payErr = validatePayment()
  
  if (payErr) { 
    errorMsg.value = payErr
    notyf.error(payErr)
    return 
  }

  isProcessing.value = true
  const results = []
  const isGuest = bookingStore.mode === 'guest'

  try {
    // Structural optimization: Loop passengers first, then flights.
    // This allows us to create the passenger profile ONCE, and apply that 
    // same passenger ID across all connecting flights/legs.
    for (let pi = 0; pi < bookingStore.passengers.length; pi++) {
      const p = bookingStore.passengers[pi]
      let passengerId = null

      // 1. Create or Reuse Passenger Profile
      const existingProfile = savedPassengers.value.find(saved => saved.passportNumber === p.passportNumber)

      if (existingProfile && !isGuest) {
        passengerId = existingProfile._id
      } else {
        const passengerPayload = {
          firstName: p.firstName, lastName: p.lastName, gender: p.gender,
          dateOfBirth: p.dateOfBirth, nationality: p.nationality,
          passportNumber: p.passportNumber, passportExpiry: p.passportExpiry, phone: p.phone
        }
        
        try {
          const res = isGuest
            ? await createPassengerGuest({ ...passengerPayload, email: p.email || bookingStore.guestEmail })
            : await createPassengerUser(passengerPayload)
            
          passengerId = res.result?._id || res.passengerId || res._id
        } catch (err) {
          if (err.response?.status === 409) {
            // Fallback for Guests or stale arrays: Passport already on file
            const existing = isGuest
              ? await getPassengerForGuest({ passportNumber: p.passportNumber })
              : { passenger: (await getMyPassengers()).passengers.find(x => x.passportNumber === p.passportNumber) }
              
            passengerId = existing.passenger?._id
            if (!passengerId) throw err
          } else {
            throw err
          }
        }
      }

      if (!passengerId) throw new Error(`Could not resolve passenger ID for ${p.firstName}.`)

      // 2. Loop through each leg to execute the booking pipeline for this passenger
      for (let li = 0; li < bookingStore.legs.length; li++) {
        const leg = bookingStore.legs[li]
        const seatId = leg.selectedSeatIds[pi]

        // Create booking record
        const bookingPayload = isGuest
          ? { flightId: leg.flightId, seatId, guestEmail: bookingStore.guestEmail }
          : { flightId: leg.flightId, seatId }
          
        const bookingRes = isGuest
          ? await createBookingGuest(bookingPayload)
          : await createBookingUser(bookingPayload)
          
        const bookingId = bookingRes.bookingId || bookingRes.result?._id

        // Link passenger to seat
        const bkpPayload = isGuest
          ? { bookingId, passengerId, seatId, guestEmail: bookingStore.guestEmail }
          : { bookingId, passengerId, seatId }
          
        if (isGuest) await createBookingPassengerGuest(bkpPayload)
        else await createBookingPassenger(bkpPayload)

        // Process payment
        const paymentPayload = isGuest
          ? { bookingId, paymentMethod: paymentMethod.value, amount: bookingRes.totalAmount, guestEmail: bookingStore.guestEmail }
          : { bookingId, paymentMethod: paymentMethod.value, amount: bookingRes.totalAmount }
          
        if (isGuest) await createPaymentGuest(paymentPayload)
        else await createPaymentUser(paymentPayload)

        results.push({
          bookingReference: bookingRes.bookingReference || bookingId,
          passengerName: `${p.firstName} ${p.lastName}`,
          leg: legLabel(leg, li),
          seat: leg.seats.find(s => s._id === seatId)?.seatNumber || '',
          amount: bookingRes.totalAmount || 0
        })
      }
    }

    // Success payload
    bookingStore.setLastOrder({
      bookings: results,
      totalPaid: results.reduce((sum, r) => sum + r.amount, 0),
      paymentMethod: paymentMethod.value,
      guestEmail: bookingStore.guestEmail
    })
    
    bookingStore.clearFunnel()
    notyf.success('Payment confirmed! Your itinerary is ready.')
    router.push({ name: 'PaymentSuccess' })

  } catch (err) {
    console.error(err)
    const msg = err.response?.data?.message || 'Something went wrong while processing your payment. A seat may have just been taken.'
    errorMsg.value = msg
    notyf.error(msg)
  } finally {
    isProcessing.value = false
  }
}

function routerBack() {
  router.back()
}
</script>

<template>
  <div class="page active">
    <div class="inner-page">
      <div class="pt-5">
        <div class="container" style="max-width:800px;">
          <h1 class="confirm-headline">Confirm<br><em class="gold">information</em></h1>
          <nav class="theme-breadcrumb" aria-label="breadcrumb">
            <ol class="breadcrumb mb-0">
              <li class="breadcrumb-item"><RouterLink :to="{ name: 'Home' }">Home</RouterLink></li>
              <li class="breadcrumb-item"><RouterLink :to="{ name: 'SearchFlights' }">Flights</RouterLink></li>
              <li class="breadcrumb-item"><a href="#" @click.prevent="routerBack">Booking Flights</a></li>
              <li class="breadcrumb-item active">Confirm Payment</li>
            </ol>
          </nav>

          <div class="confirm-section mt-3" v-for="(leg, li) in bookingStore.legs" :key="li">
            <h3 class="confirm-section-title"><i class="bi bi-airplane-fill"></i> {{ legLabel(leg, li) }}</h3>
            <div class="confirm-row" v-for="(p, pi) in bookingStore.passengers" :key="pi">
              <div class="confirm-pax">
                <div class="confirm-pax-icon"><i class="bi bi-person"></i></div>
                <div class="confirm-pax-name">Adult {{ pi + 1 }} – {{ p.firstName }} {{ p.lastName }}</div>
              </div>
              <div class="confirm-detail"><i class="bi bi-ui-checks-grid"></i><span>{{ seatFor(leg, pi)?.seatNumber || '—' }}</span></div>
              <div class="confirm-detail"><i class="bi bi-tag"></i><span>{{ seatFor(leg, pi)?.class === 'business' ? 'Business' : 'Economy' }}</span></div>
              <div class="confirm-detail"><i class="bi bi-currency-dollar"></i><span>₱{{ getSeatPrice(leg, seatFor(leg, pi)).toLocaleString() }}</span></div>
            </div>
          </div>

          <div class="confirm-section">
            <h3 class="confirm-section-title"><i class="bi bi-credit-card"></i> Payment Method</h3>
            <div class="pay-cards">
              <label class="pay-card" :class="{ selected: paymentMethod === 'credit_card' }">
                <input type="radio" value="credit_card" v-model="paymentMethod">
                <div class="pay-logo visa-logo">CARD</div>
                <div><div class="pay-num">Credit Card</div></div>
              </label>
              <label class="pay-card" :class="{ selected: paymentMethod === 'debit_card' }">
                <input type="radio" value="debit_card" v-model="paymentMethod">
                <div class="pay-logo visa-logo">DEBIT</div>
                <div><div class="pay-num">Debit Card</div></div>
              </label>
              <label class="pay-card" :class="{ selected: paymentMethod === 'gcash' }">
                <input type="radio" value="gcash" v-model="paymentMethod">
                <div class="pay-logo visa-logo">GC</div>
                <div><div class="pay-num">GCash</div></div>
              </label>
              <label class="pay-card" :class="{ selected: paymentMethod === 'cash' }">
                <input type="radio" value="cash" v-model="paymentMethod">
                <div class="pay-logo visa-logo">₱</div>
                <div><div class="pay-num">Pay at Counter</div></div>
              </label>
            </div>

            <div v-if="paymentMethod === 'credit_card' || paymentMethod === 'debit_card'" class="row g-3 mt-3">
              <div class="col-12"><label class="f-label">Cardholder Name</label><input class="f-input" v-model="card.name" placeholder="Name on card"></div>
              <div class="col-12">
                <label class="f-label">Card Number</label>
                <input class="f-input" :value="card.number" @input="formatCardNumber" maxlength="19" placeholder="1234 5678 9012 3456">
              </div>
              <div class="col-6">
                <label class="f-label">Expiry (MM/YY)</label>
                <input class="f-input" :value="card.expiry" @input="formatExpiry" maxlength="5" placeholder="MM/YY">
              </div>
              <div class="col-6">
                <label class="f-label">CVV</label>
                <input class="f-input" type="password" :value="card.cvv" @input="formatCvv" maxlength="4" placeholder="•••">
              </div>
            </div>
            <p v-else class="body-text mt-3" style="font-size:0.85rem;">
              {{ paymentMethod === 'gcash' ? "You'll be redirected to GCash to complete payment (simulated for this demo)." : "Settle payment in cash at the airport counter using this booking reference." }}
            </p>
          </div>

          <div class="confirm-section">
            <h3 class="confirm-section-title"><i class="bi bi-receipt"></i> Subtotal</h3>
            <div class="subtotal-row" v-for="(leg, li) in bookingStore.legs" :key="li">
              <span><span class="subtotal-qty">{{ bookingStore.passengers.length }}×</span> {{ legLabel(leg, li) }}</span>
              <span>₱{{ legSubtotal(li).toLocaleString() }}</span>
            </div>
            <div class="confirm-total"><span>Total :</span><span class="confirm-total-amt">₱{{ grandTotal.toLocaleString() }}</span></div>
          </div>

          <div v-if="errorMsg" class="alert alert-danger my-3">{{ errorMsg }}</div>

          <div class="d-flex justify-content-end mt-3 mb-5">
            <button class="complete-btn" @click="confirmAndPay" :disabled="isProcessing">
              <span v-if="isProcessing" class="spinner-border spinner-border-sm me-2"></span>
              {{ isProcessing ? 'Processing…' : 'Confirm and Pay →' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>