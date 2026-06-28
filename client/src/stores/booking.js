import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
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
} from '../api.js';

// ── UTILITY ACTION FOR ENRICHING BOOKING DATA ────────────────────────
// This utility fixes the "DEP"/"ARR" placeholder issues and missing ID errors 
// by pulling missing deep properties from your backend.
async function enrichBooking(b, passengerMap = new Map()) {
  // Self-heal an unpopulated/shallow flightId
  try {
    const flightRef = b.flightId
    const flightId   = (flightRef && typeof flightRef === 'object') ? flightRef._id : flightRef
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

// Holds the in-progress checkout funnel: Search -> Book (seats + passengers)
// -> Confirm & Pay -> Success. Nothing here is persisted to localStorage on
// purpose — it's a single checkout session, and starting a fresh search
// should always start a fresh booking.
export const useBookingStore = defineStore('booking', () => {
    const mode = ref('guest');        // 'user' | 'guest'
    const guestEmail = ref('');
    const paxCount = ref(1);
    
    // Rebooking state variables
    const selectedSeatId = ref('');
    const rebookOriginId = ref('');   
    const rebookDestId = ref('');     

    // One entry per flight leg (1 for one-way, 2 for round-trip).
    // Each entry: { flightId, flight, seats, selectedSeatIds: [ids, one per passenger] }
    const legs = ref([]);

    // One entry per passenger: { firstName, lastName, gender, dateOfBirth,
    // nationality, passportNumber, passportExpiry, phone, email }
    const passengers = ref([]);

    // Result of the most recently completed purchase, read by the success page.
    const lastOrder = ref(null);

    function blankPassenger() {
        return {
            firstName: '',
            lastName: '',
            gender: '',
            dateOfBirth: '',
            nationality: '',
            passportNumber: '',
            passportExpiry: '',
            phone: '',
            email: ''
        };
    }

    function startFunnel({ flights, isGuest }) {
        mode.value = isGuest ? 'guest' : 'user';
        legs.value = flights.map(flight => ({
            flightId: flight._id,
            flight,
            seats: [],
            selectedSeatIds: new Array(paxCount.value).fill(null)
        }));
        if (passengers.value.length !== paxCount.value) {
            passengers.value = Array.from({ length: paxCount.value }, blankPassenger);
        }
    }

    function setPaxCount(n) {
        const count = Math.max(1, Number(n) || 1);
        paxCount.value = count;
        passengers.value = Array.from({ length: count }, (_, i) => passengers.value[i] || blankPassenger());
        legs.value.forEach(leg => {
            const next = new Array(count).fill(null);
            leg.selectedSeatIds.forEach((id, i) => { if (i < count) next[i] = id; });
            leg.selectedSeatIds = next;
        });
    }

    function setSeatsForLeg(legIndex, seats) {
        if (legs.value[legIndex]) legs.value[legIndex].seats = seats;
    }

    function selectSeatForLeg(legIndex, passengerIndex, seatId) {
        const leg = legs.value[legIndex];
        if (!leg) return;
        // A seat can only be held by one passenger at a time on a given leg.
        const dupeIndex = leg.selectedSeatIds.indexOf(seatId);
        if (dupeIndex > -1) leg.selectedSeatIds[dupeIndex] = null;
        leg.selectedSeatIds[passengerIndex] = seatId;
    }

    function seatPrice(leg, seatId) {
        const seat = leg.seats.find(s => s._id === seatId);
        if (!seat) return 0;
        return seat.class === 'business' ? leg.flight.businessPrice : leg.flight.basePrice;
    }

    const isSeatSelectionComplete = computed(() => {
        if (legs.value.length === 0) return false;
        return legs.value.every(leg =>
            leg.selectedSeatIds.length === paxCount.value &&
            leg.selectedSeatIds.every(id => !!id)
        );
    });

    const totalAmount = computed(() => {
        return legs.value.reduce((legSum, leg) => {
            const legTotal = leg.selectedSeatIds.reduce((sum, seatId) => sum + seatPrice(leg, seatId), 0);
            return legSum + legTotal;
        }, 0);
    });

    function setLastOrder(order) {
        lastOrder.value = order;
    }

    function clearFunnel() {
        legs.value = [];
        passengers.value = [];
        paxCount.value = 1;
        guestEmail.value = '';
    }

    function clearLastOrder() {
        lastOrder.value = null;
    }

    return {
        mode,
        guestEmail,
        paxCount,
        legs,
        passengers,
        lastOrder,
        selectedSeatId,   
        rebookOriginId,   
        rebookDestId,     
        startFunnel,
        setPaxCount,
        setSeatsForLeg,
        selectSeatForLeg,
        seatPrice,
        isSeatSelectionComplete,
        totalAmount,
        setLastOrder,
        clearFunnel,
        clearLastOrder
    };
});
