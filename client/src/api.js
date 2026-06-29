import axios from 'axios';

// ─── Base URL ────────────────────────────────────────────────────────────────
// Set VITE_API_URL=http://localhost:4000 in your client/.env file.
// Falls back to same origin for production deployments.
const API = import.meta.env.VITE_API_URL || '';

// ─── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: API,
    headers: { 'Content-Type': 'application/json' }
});

// ─── Request interceptor: attach JWT ────────────────────────────────────────
// Runs before EVERY request. Reads the token from localStorage at call time
// so a fresh login is reflected immediately without restarting the app.
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => Promise.reject(error)
);

// ─── Response interceptor: unwrap axios wrapper ──────────────────────────────
// Axios wraps every response in { data, status, headers, config, request }.
// Unwrapping here means every caller receives the backend's response body
// directly (e.g. { message, result } or { message, flights }) — no .data needed.
// Errors are re-thrown as-is so callers can still read err.response.status
// and err.response.data.message.
api.interceptors.response.use(
    response => response.data,
    error    => Promise.reject(error)
);


// ═══════════════════════════════════════════════════════════════════════════════
// USERS  →  server/controllers/user.js  |  server/routes/user.js
// Used by: LoginPage, SignupPage, ProfilePage, Navbar, globalStore
// ═══════════════════════════════════════════════════════════════════════════════

// POST /users/login
// Payload: { email, password }
// Returns: { message, token, isAdmin }
export const loginUser = (payload) =>
    api.post('/users/login', payload);

// POST /users/register  (SignupPage)
// Payload: { firstName, lastName, email, password, ... }
// Returns: { message, result }
export const registerUser = (payload) =>
    api.post('/users/register', payload);

// GET /users/details  (globalStore.getUserDetails, ProfilePage)
// NOTE: This endpoint returns the raw User doc WITHOUT a { message, result }
// wrapper — the global store reads res.email / res.isAdmin directly.
// Do NOT change this without updating globalStore.getUserDetails.
// Returns: { _id, email, firstName, lastName, isAdmin, ... }
export const getProfile = () =>
    api.get('/users/details');

// PATCH /users/update-profile  (ProfilePage)
// Payload: { firstName, lastName, phone, ... } — any updatable user fields
// Returns: { message, result }
export const updateProfile = (payload) =>
    api.patch('/users/update-profile', payload);

// PATCH /users/change-password  (ProfilePage)
// Payload: { currentPassword, newPassword }
// Returns: { message }
export const changePassword = (payload) =>
    api.patch('/users/change-password', payload);

// GET /users/get-all-users  (AdminUsers)
// Admin only. Returns: { message, result: [...] }
export const getAllUsers = () =>
    api.get('/users/get-all-users');

// PATCH /users/update-user/:id  (AdminUsers)
// Admin only. Payload: any user fields to update.
// Returns: { message, result }
export const updateUser = (id, payload) =>
    api.patch(`/users/update-user/${id}`, payload);

// PATCH /users/deactivate-user/:id  (AdminUsers)
// Admin only. Returns: { message, result }
export const deactivateUser = (id) =>
    api.patch(`/users/deactivate-user/${id}`);

// PATCH /users/reactivate-user/:id  (AdminUsers)
// Admin only. Returns: { message, result }
export const reactivateUser = (id) =>
    api.patch(`/users/reactivate-user/${id}`);


// ═══════════════════════════════════════════════════════════════════════════════
// AIRPORTS  →  server/controllers/airport.js  |  server/routes/airport.js
// Used by: BookingWidget, BookFlightPage, ConfirmPaymentPage, AdminAirports
// ═══════════════════════════════════════════════════════════════════════════════

// GET /airports/get-all-airports  (BookingWidget dropdown)
// Returns: { message, result: [...] }
export const getAllAirports = () =>
    api.get('/airports/get-all-airports');

// GET /airports/get-airport/:id
// Used by BookFlightPage + ConfirmPaymentPage to resolve
// originAirportId / destinationAirportId → { iataCode, city, name }
// Returns: { message, result: airportDoc }
export const getAirportById = (id) =>
    api.get(`/airports/get-airport/${id}`);

// POST /airports/create-airport  (AdminAirports)
// Admin only. Payload: { name, city, iataCode, country, ... }
// Returns: { message, result }
export const createAirport = (payload) =>
    api.post('/airports/create-airport', payload);

// PATCH /airports/update-airport/:id  (AdminAirports)
// Admin only. Payload: any airport fields to update.
// Returns: { message, result }
export const updateAirport = (id, payload) =>
    api.patch(`/airports/update-airport/${id}`, payload);

// PATCH /airports/deactivate-airport/:id  (AdminAirports)
// Admin only. Returns: { message, result }
export const deactivateAirport = (id) =>
    api.patch(`/airports/deactivate-airport/${id}`);

// PATCH /airports/reactivate-airport/:id  (AdminAirports)
// Admin only. Returns: { message, result }
export const reactivateAirport = (id) =>
    api.patch(`/airports/reactivate-airport/${id}`);


// ═══════════════════════════════════════════════════════════════════════════════
// AIRLINES  →  server/controllers/airline.js  |  server/routes/airline.js
// Used by: AdminAirlines
// ═══════════════════════════════════════════════════════════════════════════════

// GET /airlines/get-all-airlines  (AdminAirlines)
// Returns: { message, result: [...] }
export const getAllAirlines = () =>
    api.get('/airlines/get-all-airlines');

// GET /airlines/get-airline/:id
// Returns: { message, result: airlineDoc }
export const getAirlineById = (id) =>
    api.get(`/airlines/get-airline/${id}`);

// POST /airlines/create-airline  (AdminAirlines)
// Admin only. Payload: { name, iataCode, country, ... }
// Returns: { message, result }
export const createAirline = (payload) =>
    api.post('/airlines/create-airline', payload);

// PATCH /airlines/update-airline/:id  (AdminAirlines)
// Admin only. Returns: { message, result }
export const updateAirline = (id, payload) =>
    api.patch(`/airlines/update-airline/${id}`, payload);

// PATCH /airlines/deactivate-airline/:id  (AdminAirlines)
// Admin only. Returns: { message, result }
export const deactivateAirline = (id) =>
    api.patch(`/airlines/deactivate-airline/${id}`);

// PATCH /airlines/reactivate-airline/:id  (AdminAirlines)
// Admin only. Returns: { message, result }
export const reactivateAirline = (id) =>
    api.patch(`/airlines/reactivate-airline/${id}`);


// ═══════════════════════════════════════════════════════════════════════════════
// AIRCRAFT  →  server/controllers/aircraft.js  |  server/routes/aircraft.js
// Used by: AdminAircraft, AdminFlights (aircraft dropdown when creating flights)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /aircraft/get-all-aircraft  (AdminAircraft)
// Returns: { message, result: [...] }
export const getAllAircraft = () =>
    api.get('/aircraft/get-all-aircraft');

// GET /aircraft/get-aircraft/:id
// Returns: { message, result: aircraftDoc }
export const getAircraftById = (id) =>
    api.get(`/aircraft/get-aircraft/${id}`);

// POST /aircraft/create-aircraft  (AdminAircraft)
// Admin only. Payload: { model, totalSeats, airlineId, ... }
// Returns: { message, result }
export const createAircraft = (payload) =>
    api.post('/aircraft/create-aircraft', payload);

// PATCH /aircraft/update-aircraft/:id  (AdminAircraft)
// Admin only. Returns: { message, result }
export const updateAircraft = (id, payload) =>
    api.patch(`/aircraft/update-aircraft/${id}`, payload);

// PATCH /aircraft/deactivate-aircraft/:id  (AdminAircraft)
// Admin only. Returns: { message, result }
export const deactivateAircraft = (id) =>
    api.patch(`/aircraft/deactivate-aircraft/${id}`);

// PATCH /aircraft/reactivate-aircraft/:id  (AdminAircraft)
// Admin only. Returns: { message, result }
export const reactivateAircraft = (id) =>
    api.patch(`/aircraft/reactivate-aircraft/${id}`);


// ═══════════════════════════════════════════════════════════════════════════════
// FLIGHTS  →  server/controllers/flight.js  |  server/routes/flight.js
// Used by: SearchFlightsPage, BookFlightPage, FlightStatusPage, AdminFlights
// ═══════════════════════════════════════════════════════════════════════════════

// GET /flights/search?originAirportId=&destinationAirportId=&departureDate=
// Used by SearchFlightsPage to list available flights.
// Returns: { message, flights: [...] }
export const searchFlights = (params) =>
    api.get('/flights/search', { params });

// GET /flights/get-flight/:id
// Used by BookFlightPage (one call per leg ID from route.params.flightId).
// Returns: { message, result: flightDoc }
export const getFlightById = (id) =>
    api.get(`/flights/get-flight/${id}`);

// GET /flights/get-all-flights  (AdminFlights)
// Admin only. Returns: { message, result: [...] }
export const getAllFlights = () =>
    api.get('/flights/get-all-flights');

// POST /flights/create-flight  (AdminFlights)
// Admin only.
// Payload: { airlineId, aircraftId, originAirportId, destinationAirportId,
//            flightNumber, departureTime, arrivalTime, basePrice, businessPrice,
//            originTerminal?, destinationTerminal? }
// Returns: { message, result: flightDoc, seatsGenerated: n }
export const createFlight = (payload) =>
    api.post('/flights/create-flight', payload);

// PATCH /flights/update-flight/:id  (AdminFlights)
// Admin only. Payload: any flight fields to update.
// Returns: { message, result }
export const updateFlight = (id, payload) =>
    api.patch(`/flights/update-flight/${id}`, payload);

// PATCH /flights/deactivate-flight/:id  (AdminFlights)
// Admin only. Returns: { message, result }
export const deactivateFlight = (id) =>
    api.patch(`/flights/deactivate-flight/${id}`);

// PATCH /flights/reactivate-flight/:id  (AdminFlights)
// Admin only. Returns: { message, result }
export const reactivateFlight = (id) =>
    api.patch(`/flights/reactivate-flight/${id}`);


// ═══════════════════════════════════════════════════════════════════════════════
// SEATS  →  server/controllers/seat.js  |  server/routes/seat.js
// Used by: BookFlightPage (seat map), ConfirmPaymentPage (self-heal),
//          booking store enrichment, AdminSeats, AdminViewSeats
// ═══════════════════════════════════════════════════════════════════════════════

// GET /seats/get-seats-by-flight/:flightId
// PRIMARY FIX — this is what BookFlightPage calls. If this endpoint does not
// exist in your seat router, the whole page throws "Failed to load flight details."
// Returns: { message, seats: [...] }
export const getSeatsByFlight = (flightId) =>
    api.get(`/seats/get-seats-by-flight/${flightId}`);

// GET /seats/get-seat/:id
// Used by booking store enrichment (enrichBooking) to resolve a seat by ID.
// Returns: { message, result: seatDoc }
export const getSeatById = (seatId) =>
    api.get(`/seats/get-seat/${seatId}`);

// GET /seats/get-all-seats  (AdminSeats, AdminViewSeats)
// Admin only. Returns: { message, result: [...] }
export const getAllSeats = () =>
    api.get('/seats/get-all-seats');

// PATCH /seats/update-seat/:id  (AdminSeats)
// Admin only. Payload: { seatNumber?, class?, isActive?, isOccupied? }
// Returns: { message, result }
export const updateSeat = (id, payload) =>
    api.patch(`/seats/update-seat/${id}`, payload);

// PATCH /seats/deactivate-seat/:id  (AdminSeats)
// Admin only. Returns: { message, result }
export const deactivateSeat = (id) =>
    api.patch(`/seats/deactivate-seat/${id}`);

// PATCH /seats/reactivate-seat/:id  (AdminSeats)
// Admin only. Returns: { message, result }
export const reactivateSeat = (id) =>
    api.patch(`/seats/reactivate-seat/${id}`);


// ═══════════════════════════════════════════════════════════════════════════════
// PASSENGERS  →  server/controllers/passenger.js  |  server/routes/passenger.js
// Used by: BookFlightPage (autofill), ConfirmPaymentPage (create/reuse profile)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /passengers/my-passengers  (BookFlightPage autofill, ConfirmPaymentPage pre-fetch)
// Logged-in user. Returns: { message, passengers: [...] }
export const getMyPassengers = () =>
    api.get('/passengers/my-passengers');

// GET /passengers/get-passenger/:id
// Used by booking store enrichment to resolve passengerName.
// Returns: { message, result: passengerDoc }
export const getPassengerById = (id) =>
    api.get(`/passengers/get-passenger/${id}`);

// POST /passengers/user/create-passenger  (ConfirmPaymentPage — logged-in user)
// Payload: { firstName, lastName, gender, dateOfBirth, nationality,
//            passportNumber, passportExpiry, phone }
// Returns: { message, result: { _id, ... } }
export const createPassengerUser = (payload) =>
    api.post('/passengers/user/create-passenger', payload);

// POST /passengers/guest/create-passenger  (ConfirmPaymentPage — guest checkout)
// Payload: { firstName, lastName, gender, dateOfBirth, nationality,
//            passportNumber, passportExpiry, phone, email }
// Returns: { message, result: { _id, ... } }
export const createPassengerGuest = (payload) =>
    api.post('/passengers/guest/create-passenger', payload);

// POST /passengers/guest/get-passenger  (ConfirmPaymentPage — 409 fallback for guests)
// Used when createPassengerGuest returns 409 (passport already on file).
// Payload: { passportNumber }
// Returns: { message, passenger: { _id, ... } }
export const getPassengerForGuest = (payload) =>
    api.post('/passengers/guest/get-passenger', payload);

// GET /passengers/get-all-passengers  (AdminPassengers)
// Admin only. Returns: { message, result: [...] }
export const getAllPassengers = () =>
    api.get('/passengers/get-all-passengers');

// PATCH /passengers/update-passenger/:id  (AdminPassengers)
// Admin only. Returns: { message, result }
export const updatePassenger = (id, payload) =>
    api.patch(`/passengers/update-passenger/${id}`, payload);

// PATCH /passengers/deactivate-passenger/:id  (AdminPassengers)
// Admin only. Returns: { message, result }
export const deactivatePassenger = (id) =>
    api.patch(`/passengers/deactivate-passenger/${id}`);

// PATCH /passengers/reactivate-passenger/:id  (AdminPassengers)
// Admin only. Returns: { message, result }
export const reactivatePassenger = (id) =>
    api.patch(`/passengers/reactivate-passenger/${id}`);


// ═══════════════════════════════════════════════════════════════════════════════
// BOOKINGS  →  server/controllers/booking.js  |  server/routes/booking.js
// Used by: ConfirmPaymentPage, MyBookingsPage, AdminBookings, booking store
// ═══════════════════════════════════════════════════════════════════════════════

// POST /bookings/user/create-booking  (ConfirmPaymentPage — logged-in user)
// Payload: { flightId, seatId }
// Returns: { message, bookingReference, bookingId, totalAmount, ... }
export const createBookingUser = (payload) =>
    api.post('/bookings/user/create-booking', payload);

// POST /bookings/guest/create-booking  (ConfirmPaymentPage — guest)
// Payload: { flightId, seatId, guestEmail }
// Returns: { message, bookingReference, bookingId, totalAmount, ... }
export const createBookingGuest = (payload) =>
    api.post('/bookings/guest/create-booking', payload);

// GET /bookings/user/my-bookings  (MyBookingsPage — logged-in user)
// Returns: { message, bookings: [...] }
export const getMyBookingsUser = () =>
    api.get('/bookings/user/my-bookings');

// POST /bookings/guest/my-bookings  (MyBookingsPage — guest)
// Payload: { guestEmail }
// Returns: { message, bookings: [...] }
export const getMyBookingsGuest = (payload) =>
    api.post('/bookings/guest/my-bookings', payload);

// POST /bookings/guest/secure-lookup  (MyBookingsPage / CheckInPage — guest)
// Payload: { guestEmail, bookingReference }
// Returns: { message, booking: { ...populated } }
export const secureGuestLookup = (payload) =>
    api.post('/bookings/guest/secure-lookup', payload);

// GET /bookings/get-booking/:bookingReference  (MyBookingsPage, PaymentSuccessPage)
// Returns: { message, result: bookingDoc }
export const getBookingByReference = (ref) =>
    api.get(`/bookings/get-booking/${ref}`);

// PATCH /bookings/user/cancel-booking/:bookingReference  (MyBookingsPage)
// Logged-in user. Returns: { message, result }
export const cancelBookingUser = (bookingReference) =>
    api.patch(`/bookings/user/cancel-booking/${bookingReference}`);

// PATCH /bookings/guest/cancel-booking/:bookingReference  (MyBookingsPage — guest)
// Payload: { guestEmail }
// Returns: { message, result }
export const cancelBookingGuest = (bookingReference, payload) =>
    api.patch(`/bookings/guest/cancel-booking/${bookingReference}`, payload);

// PATCH /bookings/user/update-booking/:bookingReference  (MyBookingsPage — reschedule)
// Logged-in user. Payload: { newFlightId, newSeatId }
// Returns: { message, bookingReference, newFlight, newSeatClass, newTotalAmount }
export const rescheduleBookingUser = (bookingReference, payload) =>
    api.patch(`/bookings/user/update-booking/${bookingReference}`, payload);

// GET /bookings/get-all-bookings  (AdminBookings)
// Admin only. Returns: { message, result: [...] }
export const getAllBookings = () =>
    api.get('/bookings/get-all-bookings');

// PATCH /bookings/update-booking/:id  (AdminBookings)
// Admin only. Payload: { flightId?, totalAmount? }
// Returns: { message, result }
export const updateBooking = (id, payload) =>
    api.patch(`/bookings/update-booking/${id}`, payload);

// PATCH /bookings/update-booking-status/:id  (AdminBookings)
// Admin only. Payload: { status: 'pending'|'confirmed'|'cancelled' }
// Returns: { message, result }
export const updateBookingStatus = (id, payload) =>
    api.patch(`/bookings/update-booking-status/${id}`, payload);

// PATCH /bookings/deactivate-booking/:id  (AdminBookings)
// Admin only. Returns: { message, result }
export const deactivateBooking = (id) =>
    api.patch(`/bookings/deactivate-booking/${id}`);

// PATCH /bookings/reactivate-booking/:id  (AdminBookings)
// Admin only. Returns: { message, result }
export const reactivateBooking = (id) =>
    api.patch(`/bookings/reactivate-booking/${id}`);


// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING PASSENGERS  →  server/controllers/bookingPassenger.js
//                         server/routes/bookingPassenger.js
// The join table: one record per (booking, passenger, seat) triplet.
// Used by: ConfirmPaymentPage, booking store enrichment (enrichBooking),
//          AdminBookings (ticket number display)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /booking-passengers/user/create  (ConfirmPaymentPage — logged-in user)
// Links a passenger to a booking and seat.
// Payload: { bookingId, passengerId, seatId }
// Returns: { message, result }
export const createBookingPassenger = (payload) =>
    api.post('/booking-passengers/user/create', payload);

// POST /booking-passengers/guest/create  (ConfirmPaymentPage — guest)
// Payload: { bookingId, passengerId, seatId, guestEmail }
// Returns: { message, result }
export const createBookingPassengerGuest = (payload) =>
    api.post('/booking-passengers/guest/create', payload);

// GET /booking-passengers/get-by-booking/:bookingId
// Used by booking store enrichment (enrichBooking) to resolve
// ticketNumber, passengerId, and seatId for a given booking.
// Returns: { message, result: [...bookingPassengerDocs] }
export const getPassengersByBooking = (bookingId) =>
    api.get(`/booking-passengers/get-by-booking/${bookingId}`);

// GET /booking-passengers/get-all  (AdminBookings detail view)
// Admin only. Returns: { message, result: [...] }
export const getAllBookingPassengers = () =>
    api.get('/booking-passengers/get-all');


// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS  →  server/controllers/payment.js  |  server/routes/payment.js
// Used by: ConfirmPaymentPage, AdminPayments
// ═══════════════════════════════════════════════════════════════════════════════

// POST /payments/user/create-payment  (ConfirmPaymentPage — logged-in user)
// Payload: { bookingId, paymentMethod, amount }
// Returns: { message, result }
export const createPaymentUser = (payload) =>
    api.post('/payments/user/create-payment', payload);

// POST /payments/guest/create-payment  (ConfirmPaymentPage — guest)
// Payload: { bookingId, paymentMethod, amount, guestEmail }
// Returns: { message, result }
export const createPaymentGuest = (payload) =>
    api.post('/payments/guest/create-payment', payload);

// GET /payments/get-all-payments  (AdminPayments)
// Admin only. Returns: { message, result: [...] }
export const getAllPayments = () =>
    api.get('/payments/get-all-payments');

// GET /payments/get-my-payments  (ProfilePage — payment history)
// Logged-in user. Returns: { message, result: [...] }
export const getMyPayments = () =>
    api.get('/payments/get-my-payments');

// PATCH /payments/update-payment-status/:id  (AdminPayments)
// Admin only. Payload: { status: 'pending'|'completed'|'failed'|'refunded' }
// Returns: { message, result }
export const updatePaymentStatus = (id, payload) =>
    api.patch(`/payments/update-payment-status/${id}`, payload);


// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS  →  server/controllers/notification.js
//                    server/routes/notification.js
// Used by: Navbar (badge count), AdminNotifications
// ═══════════════════════════════════════════════════════════════════════════════

// GET /notifications/my-notifications  (Navbar bell icon, logged-in user)
// Returns: { message, result: [...] }
export const getMyNotifications = () =>
    api.get('/notifications/my-notifications');

// PATCH /notifications/mark-read/:id  (Navbar — mark one as read)
// Returns: { message, result }
export const markNotificationRead = (id) =>
    api.patch(`/notifications/mark-read/${id}`);

// PATCH /notifications/mark-all-read  (Navbar — mark all as read)
// Returns: { message }
export const markAllNotificationsRead = () =>
    api.patch('/notifications/mark-all-read');

// GET /notifications/get-all  (AdminNotifications)
// Admin only. Returns: { message, result: [...] }
export const getAllNotifications = () =>
    api.get('/notifications/get-all');


// ═══════════════════════════════════════════════════════════════════════════════
// ITINERARIES  →  server/controllers/itinerary.js  |  server/routes/itinerary.js
// Used by: CheckInPage, MyBookingsPage (itinerary/e-ticket view)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /itineraries/get-my-itineraries  (MyBookingsPage, CheckInPage)
// Logged-in user. Returns: { message, result: [...] }
export const getMyItineraries = () =>
    api.get('/itineraries/get-my-itineraries');

// GET /itineraries/get-itinerary/:id
// Returns: { message, result: itineraryDoc }
export const getItineraryById = (id) =>
    api.get(`/itineraries/get-itinerary/${id}`);

// GET /itineraries/get-itinerary-by-booking/:bookingId
// Used by CheckInPage to find the itinerary tied to a specific booking.
// Returns: { message, result: itineraryDoc }
export const getItineraryByBooking = (bookingId) =>
    api.get(`/itineraries/get-itinerary-by-booking/${bookingId}`);

// POST /itineraries/create-itinerary  (auto-called after payment success, or admin)
// Payload: { bookingId, passengerId, ... }
// Returns: { message, result }
export const createItinerary = (payload) =>
    api.post('/itineraries/create-itinerary', payload);

// GET /itineraries/get-all  (AdminDashboard summary)
// Admin only. Returns: { message, result: [...] }
export const getAllItineraries = () =>
    api.get('/itineraries/get-all');