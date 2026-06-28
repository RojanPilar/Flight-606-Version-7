<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllFlights, getAllSeats, getAllAirports } from '../../api';
import { useRouter } from 'vue-router';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const router = useRouter();
const flightSummaries = ref([]);
const airportsList = ref([]); // Store airports for translation
const isLoading = ref(true);
const pageError = ref(null);
const searchQuery = ref('');

const filteredFlights = computed(() => {
    if (!searchQuery.value) return flightSummaries.value;
    const query = searchQuery.value.toLowerCase();
    return flightSummaries.value.filter(f =>
        f._id.toLowerCase().includes(query) ||
        f.displayOrigin.toLowerCase().includes(query) ||
        f.displayDest.toLowerCase().includes(query)
    );
});

const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(filteredFlights);

// Translator function: turns raw ID into an IATA Code (e.g., "JFK")
const getAirportCode = (id) => {
    if (!id) return 'TBA';
    // If backend ever populates it, use it directly
    if (id.iataCode) return id.iataCode;
    if (id.airportCode) return id.airportCode;

    // Otherwise, search our local list of airports
    const found = airportsList.value.find(a => a._id === id.toString());
    // Look for iataCode first, fallback to name, then TBA
    return found ? (found.iataCode || found.name) : 'TBA';
};

const fetchData = async () => {
    isLoading.value = true;
    pageError.value = null;
    try {
        // Fetch flights, seats, AND airports simultaneously
        const [flightsData, seatsData, airportsData] = await Promise.all([
            getAllFlights().catch(() => ({ result: [] })),
            getAllSeats().catch(() => ({ result: [] })),
            getAllAirports().catch(() => ({ result: [] }))
        ]);

        const flights = flightsData.result || flightsData.flights || [];
        const allSeats = seatsData.result || seatsData.seats || [];
        airportsList.value = airportsData.result || airportsData.airports || [];

        flightSummaries.value = flights.map(flight => {
            const flightSeats = allSeats.filter(seat => seat.flightId === flight._id);
            const total = flightSeats.length;
            const occupied = flightSeats.filter(seat => seat.isOccupied).length;

            // Format the date using departureTime from your backend
            const dateVal = flight.departureTime;
            const displayDate = dateVal ? new Date(dateVal).toLocaleString() : 'Date TBA';

            return {
                ...flight,
                displayOrigin: getAirportCode(flight.originAirportId),
                displayDest: getAirportCode(flight.destinationAirportId),
                displayDate: displayDate,
                seatStats: { total, occupied, available: total - occupied }
            };
        });
    } catch (error) {
        pageError.value = "Failed to load flight and seat data.";
    } finally {
        isLoading.value = false;
    }
};

const occupancyRate = (stats) => stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;

const navigateToDetails = (flightId) => {
    router.push(`/admin/seats/${flightId}`);
};

onMounted(() => fetchData());
</script>

<template>
  <div class="profile-section">

    <div class="ps-header">
      <h3><i class="ti ti-armchair"></i> Seat Capacity Overview</h3>
      <button @click="fetchData" class="btn-refresh" :disabled="isLoading">
        <i class="ti ti-refresh"></i> Refresh
      </button>
    </div>

    <div class="ps-body">

      <p v-if="pageError" class="alert-msg alert-error">{{ pageError }}</p>

      <div class="admin-filter-bar">
        <div class="admin-search-wrap">
          <i class="ti ti-search admin-search-icon"></i>
          <input
            type="text"
            class="admin-search-input"
            v-model="searchQuery"
            placeholder="Search by Flight ID or Airport Code…"
          >
        </div>
        <span class="admin-filter-count">Showing {{ filteredFlights.length }} of {{ flightSummaries.length }}</span>
      </div>

      <div v-if="isLoading" class="admin-loading">
        <i class="ti ti-loader-2 admin-spinner"></i> Loading flights…
      </div>

      <div v-else-if="filteredFlights.length === 0" class="admin-empty-state">
        <i class="ti ti-plane-off"></i>
        <p>No flights found.</p>
      </div>

      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Date</th>
              <th>Occupancy Status</th>
              <th>Capacity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="flight in pagedItems" :key="flight._id">
              <td>
                {{ flight.displayOrigin }} <i class="ti ti-arrow-right muted"></i> {{ flight.displayDest }}
                <span class="cell-sub"><i class="ti ti-fingerprint"></i> {{ flight._id }}</span>
              </td>
              <td class="muted">{{ flight.displayDate }}</td>
              <td>
                <div class="admin-progress-wrap" style="width: 150px;">
                  <div class="admin-progress">
                    <div
                      class="admin-progress-bar"
                      :class="occupancyRate(flight.seatStats) > 80 ? 'bar-danger' : occupancyRate(flight.seatStats) > 50 ? '' : 'bar-success'"
                      :style="{ width: occupancyRate(flight.seatStats) + '%' }"
                    ></div>
                  </div>
                </div>
                <span class="cell-sub">{{ flight.seatStats.occupied }} / {{ flight.seatStats.total }} Occupied</span>
              </td>
              <td>
                <span v-if="flight.seatStats.total === 0" class="admin-badge badge-muted">No Seats Generated</span>
                <span v-else class="admin-badge" :class="flight.seatStats.available > 0 ? 'badge-active' : 'badge-inactive'">
                  {{ flight.seatStats.available }} Available
                </span>
              </td>
              <td>
                <button @click="navigateToDetails(flight._id)" class="btn-table-action">
                  Manage Seats <i class="ti ti-arrow-right"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <AdminPagination
          :current-page="currentPage"
          :total-pages="totalPages"
          :page-numbers="pageNumbers"
          @go-to-page="goToPage"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './admin-shared.css';
</style>