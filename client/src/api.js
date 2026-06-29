import axios from "axios";

const api = axios.create({
    // 1. Clean up potential missing trailing slashes dynamically
    baseURL: import.meta.env.VITE_FLIGHT_606_API || "https://flight606.onrender.com",
    // 2. Enable credentials to allow cookie/session tracking if needed
    withCredentials: true 
});

// Attach token to every request if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 3. Prevent malformed URLs by making sure relative paths start with a slash
    if (config.url && !config.url.startsWith('/') && !config.url.startsWith('http')) {
        config.url = `/${config.url}`;
    }
    
    return config;
});


// ============================================================
// USER RESOURCE
// ============================================================

// --- Auth (Public) ---
export async function registerUser(data) {
    const { data: res } = await api.post("/users/register", data);
    return res;
}
export async function loginUser(data) {
    const { data: res } = await api.post("/users/login", data);
    return res;
}

// --- User Actions (Authenticated) ---
export async function getProfile() {
    const { data: res } = await api.get("/users/profile");
    return res;
}
export async function updateProfile(data) {
    const { data: res } = await api.patch("/users/update-profile", data);
    return res;
}
export async function updateEmail(data) {
    const { data: res } = await api.patch("/users/update-email", data);
    return res;
}
export async function updatePassword(data) {
    const { data: res } = await api.patch("/users/update-password", data);
    return res;
}

// --- Admin: User Management ---
export async function getAllUsers() {
    const { data: res } = await api.get("/users/show-all-users");
    return res;
}
export async function getUserById(id) {
    const { data: res } = await api.get(`/users/show-user/${id}`);
    return res;
}
export async function updateUserAsAdmin(id, data) {
    const { data: res } = await api.patch(`/users/update-user/${id}`, data);
    return res;
}
export async function deactivateUser(id) {
    const { data: res } = await api.patch(`/users/deactivate-user/${id}`);
    return res;
}
export async function reactivateUser(id) {
    const { data: res } = await api.patch(`/users/reactivate-user/${id}`);
    return res;
}


// ============================================================
// AIRLINE RESOURCE
// ============================================================

// --- Admin: Airline Management ---
export async function createAirline(data) {
    const { data: res } = await api.post("/airlines/create-airline", data);
    return res;
}
export async function getAirlineById(id) {
    const { data: res } = await api.get(`/airlines/get-airline/${id}`);
    return res;
}
export async function getAllAirlines() {
    const { data: res } = await api.get("/airlines/get-all-airlines");
    return res;
}
export async function updateAirline(id, data) {
    const { data: res } = await api.patch(`/airlines/update-airline/${id}`, data);
    return res;
}
export async function deactivateAirline(id) {
    const { data: res } = await api.patch(`/airlines/deactivate-airline/${id}`);
    return res;
}
export async function reactivateAirline(id) {
    const { data: res } = await api.patch(`/airlines/reactivate-airline/${id}`);
    return res;
}


// ============================================================
// AIRPORT RESOURCE
// ============================================================

// --- Public ---
export async function getAirportById(id) {
    const { data: res } = await api.get(`/airports/get-airport/${id}`);
    return res;
}
export async function getAllAirports() {
    const { data: res } = await api.get("/airports/get-all-airports");
    return res;
}

// --- Admin: Airport Management ---
export async function createAirport(data) {
    const { data: res } = await api.post("/airports/create-airport", data);
    return res;
}
export async function deactivateAirport(id) {
    const { data: res } = await api.patch(`/airports/deactivate-airport/${id}`);
    return res;
}
export async function reactivateAirport(id) {
    const { data: res } = await api.patch(`/airports/reactivate-airport/${id}`);
    return res;
}


// ============================================================
// AIRCRAFT RESOURCE
// ============================================================

// --- Admin: Aircraft Management ---
export async function createAircraft(data) {
    const { data: res } = await api.post("/aircrafts/create-aircraft", data);
    return res;
}
export async function getAircraftById(id) {
    const { data: res } = await api.get(`/aircrafts/get-aircraft/${id}`);
    return res;
}
export async function getAllAircraft() {
    const { data: res } = await api.get("/aircrafts/get-all-aircraft");
    return res;
}
export async function updateAircraft(id, data) {
    const { data: res } = await api.patch(`/aircrafts/update-aircraft/${id}`, data);
    return res;
}
export async function deactivateAircraft(id) {
    const { data: res } = await api.patch(`/aircrafts/deactivate-aircraft/${id}`);
    return res;
}
export async function reactivateAircraft(id) {
    const { data: res } = await api.patch(`/aircrafts/reactivate-aircraft/${id}`);
    return res;
}


// ============================================================
// FLIGHT RESOURCE
// ============================================================

// --- Public ---
export async function searchFlights(originAirportId, destinationAirportId, departureDate) {
    const { data: res } = await api.get("/flights/search", {
        params: { originAirportId, destinationAirportId, departureDate }
    });
    return res;
}
export async function getFlightById(id) {
    const { data: res } = await api.get(`/flights/get-flight/${id}`);
    return res;
}
export async function getFlightStatus(flightNumber) {
    const { data: res } = await api.get(`/flights/status/${flightNumber}`);
    return res;
}

// --- Admin: Flight Management ---
export async function getAllFlights() {
    const { data: res } = await api.get("/flights/get-all-flights");
    return res;
}
export async function createFlight(data) {
    const { data: res } = await api.post("/flights/create-flight", data);
    return res;
}
export async function updateFlight(id, data) {
    const { data: res } = await api.patch(`/flights/update-flight/${id}`, data);
    return res;
}
export async function deactivateFlight(id) {
    const { data: res } = await api.patch(`/flights/deactivate-flight/${id}`);
    return res;
}
export async function reactivateFlight(id) {
    const { data: res } = await api.patch(`/flights/reactivate-flight/${id}`);
    return res;
}


// ============================================================
// SEAT RESOURCE
// ============================================================

// --- Public ---
export async function getSeatsByFlight(flightId) {
    const { data: res } = await api.get(`/seats/get-seats-by-flight/${flightId}`);
    return res;
}
export async function getSeatById(id) {
    const { data: res } = await api.get(`/seats/get-seat/${id}`);
    return res;
}

// --- Admin: Seat Management ---
export async function getAllSeats() {
    const { data: res } = await api.get("/seats/get-all-seats");
    return res;
}
export async function updateSeatStatus(id, data) {
    const { data: res } = await api.patch(`/seats/update-seat-status/${id}`, data);
    return res;
}
export async function deactivateSeat(id) {
    const { data: res } = await api.patch(`/seats/deactivate-seat/${id}`);
    return res;
}
export async function reactivateSeat(id) {
    const { data: res } = await api.patch(`/seats/reactivate-seat/${id}`);
    return res;
}


// ============================================================
// PASSENGER RESOURCE
// ============================================================

// --- User: Passenger Management (Authenticated) ---
export async function createPassengerUser(data) {
    const { data: res } = await api.post("/passengers/user/create-passenger", data);
    return res;
}
export async function getMyPassengers() {
    const { data: res } = await api.get("/passengers/user/my-passengers");
    return res;
}
export async function updatePassenger(id, data) {
    const { data: res } = await api.patch(`/passengers/user/update-passenger/${id}`, data);
    return res;
}

// --- Guest: Passenger Management (Public) ---
export async function createPassengerGuest(data) {
    const { data: res } = await api.post("/passengers/guest/create-passenger", data);
    return res;
}
export async function getPassengerForGuest(data) {
    const { data: res } = await api.post("/passengers/guest/get-passenger", data);
    return res;
}
export async function updatePassengerAsGuest(data) {
    const { data: res } = await api.patch("/passengers/guest/update-passenger", data);
    return res;
}

// --- Admin: Passenger Management ---
export async function getAllPassengers() {
    const { data: res } = await api.get("/passengers/get-all-passengers");
    return res;
}
export async function getPassengerById(id) {
    const { data: res } = await api.get(`/passengers/get-passenger/${id}`);
    return res;
}
export async function adminUpdatePassenger(id, data) {
    const { data: res } = await api.put(`/passengers/admin-update-passenger/${id}`, data);
    return res;
}
export async function activatePassenger(id) {
    const { data: res } = await api.patch(`/passengers/activate-passenger/${id}`);
    return res;
}
export async function deactivatePassenger(id) {
    const { data: res } = await api.patch(`/passengers/deactivate-passenger/${id}`);
    return res;
}


// ============================================================
// BOOKING RESOURCE
// ============================================================

// --- User: Booking Actions (Authenticated) ---
export async function createBookingUser(data) {
    const { data: res } = await api.post("/bookings/user/create-booking", data);
    return res;
}
export async function getMyBookingsUser() {
    const { data: res } = await api.get("/bookings/user/my-bookings");
    return res;
}

export async function rescheduleBookingUser(id, data) {
    const { data: res } = await api.patch(`/bookings/user/update-booking/${id}`, data);
    return res;
}
export async function cancelBookingUser(bookingReference) {
    const { data: res } = await api.patch(`/bookings/user/cancel-booking/${bookingReference}`);
    return res;
}
export async function checkInBookingUser(bookingReference) {
    const { data: res } = await api.patch(`/bookings/user/check-in/${bookingReference}`);
    return res;
}

// --- Guest: Booking Actions (Public) ---
export async function createBookingGuest(data) {
    const { data: res } = await api.post("/bookings/guest/create-booking", data);
    return res;
}
export async function getMyBookingsGuest(data) {
    const { data: res } = await api.post("/bookings/guest/my-bookings", data);
    return res;
}
export async function cancelBookingGuest(bookingReference, data) {
    const { data: res } = await api.patch(`/bookings/guest/cancel-booking/${bookingReference}`, data);
    return res;
}
export async function checkInBookingGuest(bookingReference, data) {
    const { data: res } = await api.patch(`/bookings/guest/check-in/${bookingReference}`, data);
    return res;
}

export async function secureGuestLookup(data) {
    const { data: res } = await api.post("/bookings/guest/secure-lookup", data);
    return res;
}

// --- Public ---
export async function getBookingByReference(bookingReference) {
    const { data: res } = await api.get(`/bookings/get-booking/${bookingReference}`);
    return res;
}

// --- Admin: Booking Management ---
export async function getAllBookings() {
    const { data: res } = await api.get("/bookings/get-all-bookings");
    return res;
}
export async function updateBooking(id, data) {
    const { data: res } = await api.patch(`/bookings/update-booking/${id}`, data);
    return res;
}
export async function updateBookingStatus(id, data) {
    const { data: res } = await api.patch(`/bookings/update-booking-status/${id}`, data);
    return res;
}
export async function deactivateBooking(id) {
    const { data: res } = await api.patch(`/bookings/deactivate-booking/${id}`);
    return res;
}
export async function reactivateBooking(id) {
    const { data: res } = await api.patch(`/bookings/reactivate-booking/${id}`);
    return res;
}


// ============================================================
// BOOKING PASSENGER RESOURCE
// ============================================================

// --- User: Booking Passenger Actions (Authenticated) ---
export async function createBookingPassenger(data) {
    const { data: res } = await api.post("/bookingpassengers/create-booking-passenger", data);
    return res;
}

export async function createBookingPassengerGuest(data) {
       const { data: res } = await api.post("/bookingpassengers/guest/create-booking-passenger",
           data
       );
       return res;
}

// --- Public ---
export async function getPassengersByBooking(bookingId) {
    const { data: res } = await api.get(`/bookingpassengers/get-booking-passengers/${bookingId}`);
    return res;
}

// --- Admin: Booking Passenger Management ---
export async function getAllBookingPassengers() {
    const { data: res } = await api.get("/bookingpassengers/get-all-booking-passengers");
    return res;
}
export async function deactivateBookingPassenger(id) {
    const { data: res } = await api.patch(`/bookingpassengers/deactivate-booking-passenger/${id}`);
    return res;
}
export async function reactivateBookingPassenger(id) {
    const { data: res } = await api.patch(`/bookingpassengers/reactivate-booking-passenger/${id}`);
    return res;
}


// ============================================================
// PAYMENT RESOURCE
// ============================================================

// --- User: Payment Actions (Authenticated) ---
export async function createPaymentUser(data) {
    const { data: res } = await api.post("/payments/user/create-payment", data);
    return res;
}
export async function getMyPaymentsUser() {
    const { data: res } = await api.get("/payments/user/my-payments");
    return res;
}

// --- Guest: Payment Actions (Public) ---
export async function createPaymentGuest(data) {
    const { data: res } = await api.post("/payments/guest/create-payment", data);
    return res;
}
export async function getMyPaymentsGuest(data) {
    const { data: res } = await api.post("/payments/guest/my-payments", data);
    return res;
}

// --- Admin: Payment Management ---
export async function getAllPayments() {
    const { data: res } = await api.get("/payments/get-all-payments");
    return res;
}
export async function getPaymentById(id) {
    const { data: res } = await api.get(`/payments/get-payment/${id}`);
    return res;
}
export async function updatePaymentStatus(id, data) {
    const { data: res } = await api.patch(`/payments/update-payment-status/${id}`, data);
    return res;
}


// ============================================================
// ITINERARY RESOURCE
// ============================================================

// --- User: Itinerary Actions (Authenticated) ---
export async function createItineraryUser(data) {
    const { data: res } = await api.post("/itineraries/create-itinerary", data);
    return res;
}
export async function getMyItinerariesUser() {
    const { data: res } = await api.get("/itineraries/my-itineraries");
    return res;
}
export async function getItineraryById(id) {
    const { data: res } = await api.get(`/itineraries/get-itinerary/${id}`);
    return res;
}
export async function addBookingToItinerary(id, data) {
    const { data: res } = await api.patch(`/itineraries/add-booking/${id}`, data);
    return res;
}
export async function removeBookingFromItinerary(id, data) {
    const { data: res } = await api.patch(`/itineraries/remove-booking/${id}`, data);
    return res;
}

// --- Guest: Itinerary Actions (Public) ---
export async function createItineraryGuest(data) {
    const { data: res } = await api.post("/itineraries/create-itinerary-guest", data);
    return res;
}
export async function getMyItinerariesGuest(data) {
    const { data: res } = await api.post("/itineraries/my-itineraries-guest", data);
    return res;
}

// --- Admin: Itinerary Management ---
export async function getAllItineraries() {
    const { data: res } = await api.get("/itineraries/get-all-itineraries");
    return res;
}
export async function deactivateItinerary(id) {
    const { data: res } = await api.patch(`/itineraries/deactivate-itinerary/${id}`);
    return res;
}
export async function reactivateItinerary(id) {
    const { data: res } = await api.patch(`/itineraries/reactivate-itinerary/${id}`);
    return res;
}


// ============================================================
// NOTIFICATION RESOURCE
// ============================================================

// --- User: Notification Actions (Authenticated) ---
export async function getMyNotificationsUser() {
    const { data: res } = await api.get("/notifications/my-notifications");
    return res;
}
export async function markAsRead(id) {
    const { data: res } = await api.patch(`/notifications/mark-as-read/${id}`);
    return res;
}
export async function markAllAsRead() {
    const { data: res } = await api.patch("/notifications/mark-all-as-read");
    return res;
}

// --- Guest: Notification Actions (Public) ---
export async function getMyNotificationsGuest(data) {
    const { data: res } = await api.post("/notifications/my-notifications-guest", data);
    return res;
}

// --- Admin: Notification Management ---
export async function getAllNotifications() {
    const { data: res } = await api.get("/notifications/get-all-notifications");
    return res;
}
export async function deactivateNotification(id) {
    const { data: res } = await api.patch(`/notifications/deactivate-notification/${id}`);
    return res;
}

export default api;