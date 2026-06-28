import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Holds the in-progress checkout funnel: Search -> Book (seats + passengers)
// -> Confirm & Pay -> Success. Nothing here is persisted to localStorage on
// purpose — it's a single checkout session, and starting a fresh search
// should always start a fresh booking.
export const useBookingStore = defineStore('booking', () => {
    const mode = ref('guest');        // 'user' | 'guest'
    const guestEmail = ref('');
    const paxCount = ref(1);

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
