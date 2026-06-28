import axios from "axios";

const api = axios.create({
    // Live Render backend address
    baseURL: import.meta.env.VITE_FLIGHT_606_API || "https://flight-606-version-7.onrender.com",
    
    // Enable credentials to allow cookie/session tracking if needed
    withCredentials: true 
});

// Attach token to every request if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Prevent malformed URLs by making sure relative paths start with a slash
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
export async function createPassenger(data) {
    const { data: res } = await api.post("/passengers/create-passenger", data);
    return res;
}
export async function getPassengerById(id) {
    const { data: res } = await api.get(`/passengers/get-passenger/${id}`);
    return res;
}
export async function getMyPassengers() {
    const { data: res } = await api.get("/passengers/get-my-passengers");
    return res;
}


// ============================================================
// BOOKING RESOURCE (RESTORED MISSING EXPORTS)
// ============================================================

export async function createBookingUser(data) {
    const { data: res } = await api.post("/bookings/create-booking", data);
    return res;
}

export async function createBookingGuest(data) {
    const { data: res } = await api.post("/bookings/create-guest-booking", data);
    return res;
}

export async function getMyBookingsUser() {
    const { data: res } = await api.get("/bookings/my-bookings");
    return res;
}

export async function getMyBookingsGuest(params) {
    const { data: res } = await api.get("/bookings/guest-bookings", { params });
    return res;
}

export async function cancelBookingUser(bookingReference) {
    const { data: res } = await api.patch(`/bookings/cancel/${bookingReference}`);
    return res;
}

export async function cancelBookingGuest(bookingReference, data) {
    const { data: res } = await api.patch(`/bookings/cancel-guest/${bookingReference}`, data);
    return res;
}

export async function rescheduleBookingUser(bookingReference, data) {
    const { data: res } = await api.patch(`/bookings/reschedule/${bookingReference}`, data);
    return res;
}

export async function getPassengersByBooking(bookingId) {
    const { data: res } = await api.get(`/bookingpassengers/booking/${bookingId}`);
    return res;
}
