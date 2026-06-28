<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getSeatsByFlight, getFlightById, getPassengersByBooking, updateSeatStatus } from '../../api.js';

const route = useRoute();
const router = useRouter();
const flightId = route.params.flightId;

const flight = ref(null);
const seats = ref([]);
const isLoading = ref(true);
const pageError = ref(null);
const actionSuccess = ref(null);
const actionError = ref(null);

// passenger lookup cache: seatId -> passenger name
const passengerCache = ref({});
const isLoadingPassengers = ref(false);

const stats = computed(() => {
    const total = seats.value.length;
    const occupied = seats.value.filter(s => s.isOccupied).length;
    const business = seats.value.filter(s => s.class === 'business').length;
    const businessOccupied = seats.value.filter(s => s.class === 'business' && s.isOccupied).length;
    return {
        total,
        occupied,
        available: total - occupied,
        business,
        businessOccupied,
        economy: total - business,
        economyOccupied: occupied - businessOccupied,
        occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0
    };
});

const businessSeats = computed(() => seats.value.filter(s => s.class === 'business'));
const economySeats = computed(() => seats.value.filter(s => s.class === 'economy'));

// Selected seat for detail panel
const selectedSeat = ref(null);

function selectSeat(seat) {
    selectedSeat.value = seat;
}

function getSeatButtonClass(seat) {
    if (!seat.isActive) return 'seat-btn seat-inactive';
    if (seat.isOccupied) return 'seat-btn seat-occupied';
    if (seat.class === 'business') return 'seat-btn seat-business';
    return 'seat-btn seat-economy';
}

async function fetchData() {
    isLoading.value = true;
    pageError.value = null;
    try {
        const [flightRes, seatsRes] = await Promise.all([
            getFlightById(flightId),
            getSeatsByFlight(flightId)
        ]);
        flight.value = flightRes.result;
        seats.value = seatsRes.seats;
    } catch (err) {
        pageError.value = 'Failed to load seat data.';
    } finally {
        isLoading.value = false;
    }
}

async function toggleSeatStatus(seat) {
    actionError.value = null;
    actionSuccess.value = null;
    try {
        await updateSeatStatus(seat._id, { isOccupied: !seat.isOccupied });
        actionSuccess.value = `Seat ${seat.seatNumber} updated successfully.`;
        await fetchData();
        selectedSeat.value = null;
        setTimeout(() => actionSuccess.value = null, 3000);
    } catch (err) {
        actionError.value = err.response?.data?.message || 'Failed to update seat.';
        setTimeout(() => actionError.value = null, 3000);
    }
}

function formatDateTime(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

onMounted(fetchData);
</script>

<template>
  <div class="profile-section">

    <div class="ps-header">
      <h3>
        <i class="ti ti-armchair"></i> Seat Map
        <template v-if="flight"> — Flight {{ flight.flightNumber }}</template>
      </h3>
      <button class="btn-refresh" @click="router.push('/admin/seats')">
        <i class="ti ti-arrow-left"></i> All Flights
      </button>
    </div>

    <div class="ps-body">

      <!-- Loading -->
      <div v-if="isLoading" class="admin-loading">
        <i class="ti ti-loader-2 admin-spinner"></i> Loading seat map…
      </div>

      <!-- Error -->
      <p v-else-if="pageError" class="alert-msg alert-error">{{ pageError }}</p>

      <template v-else>

        <!-- Flight summary strip -->
        <div class="flight-summary-strip" style="margin-bottom: 20px;">
          <i class="ti ti-plane-tilt" style="color: var(--gold); font-size: 1.3rem;"></i>
          <div>
            <span class="fs-label">Departure</span><br>
            {{ formatDateTime(flight?.departureTime) }}
          </div>
          <button class="btn-refresh ml-auto" @click="fetchData" :disabled="isLoading">
            <i class="ti ti-refresh"></i> Refresh
          </button>
        </div>

        <!-- Feedback -->
        <p v-if="actionSuccess" class="alert-msg alert-success">{{ actionSuccess }}</p>
        <p v-if="actionError" class="alert-msg alert-error">{{ actionError }}</p>

        <!-- Stats row -->
        <div class="admin-stats-row cols-6">
          <div class="admin-stat-card">
            <div class="admin-stat-number">{{ stats.total }}</div>
            <div class="admin-stat-label">Total</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number stat-error">{{ stats.occupied }}</div>
            <div class="admin-stat-label">Occupied</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number stat-success">{{ stats.available }}</div>
            <div class="admin-stat-label">Available</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number">{{ stats.occupancyRate }}%</div>
            <div class="admin-stat-label">Occupancy</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number">{{ stats.businessOccupied }}/{{ stats.business }}</div>
            <div class="admin-stat-label">Business</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number stat-success">{{ stats.economyOccupied }}/{{ stats.economy }}</div>
            <div class="admin-stat-label">Economy</div>
          </div>
        </div>

        <!-- Occupancy progress -->
        <div class="admin-progress-wrap" style="margin-bottom: 28px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <span class="fs-label">Occupancy Rate</span>
            <span class="muted" style="font-size: 0.7rem;">{{ stats.occupied }} / {{ stats.total }} seats</span>
          </div>
          <div class="admin-progress">
            <div
              class="admin-progress-bar"
              :class="stats.occupancyRate > 80 ? 'bar-danger' : stats.occupancyRate > 50 ? '' : 'bar-success'"
              :style="{ width: stats.occupancyRate + '%' }"
            ></div>
          </div>
        </div>

        <div class="admin-split-layout">

          <!-- Seat map -->
          <div>
            <div class="seat-legend" style="margin-bottom: 22px;">
              <span class="sl-item"><span class="seat-btn seat-sm seat-business">1A</span> Business — available</span>
              <span class="sl-item"><span class="seat-btn seat-sm seat-economy">1A</span> Economy — available</span>
              <span class="sl-item"><span class="seat-btn seat-sm seat-occupied">1A</span> Occupied</span>
              <span class="sl-item"><span class="seat-btn seat-sm seat-inactive">1A</span> Inactive</span>
            </div>

            <div class="luggage-heading"><i class="ti ti-star-filled" style="color: var(--gold);"></i> Business Class</div>
            <div class="admin-seat-grid" style="margin-bottom: 22px;">
              <button
                v-for="seat in businessSeats"
                :key="seat._id"
                :class="[getSeatButtonClass(seat), selectedSeat?._id === seat._id ? 'seat-selected' : '']"
                @click="selectSeat(seat)"
                :title="seat.isOccupied ? 'Occupied — click to view details' : 'Available'"
              >
                {{ seat.seatNumber }}
              </button>
            </div>

            <div class="pn-sep" style="margin: 20px 0;"></div>

            <div class="luggage-heading"><i class="ti ti-layout-grid"></i> Economy Class</div>
            <div class="admin-seat-grid">
              <button
                v-for="seat in economySeats"
                :key="seat._id"
                :class="[getSeatButtonClass(seat), selectedSeat?._id === seat._id ? 'seat-selected' : '']"
                @click="selectSeat(seat)"
                :title="seat.isOccupied ? 'Occupied — click to view details' : 'Available'"
              >
                {{ seat.seatNumber }}
              </button>
            </div>
          </div>

          <!-- Detail panel -->
          <div class="admin-detail-panel">

            <div v-if="!selectedSeat" class="admin-empty-state">
              <i class="ti ti-hand-click"></i>
              <p>Click any seat on the map to view details.</p>
            </div>

            <div v-else>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <div>
                  <h4 style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--text); margin-bottom: 8px;">
                    Seat {{ selectedSeat.seatNumber }}
                  </h4>
                  <span class="admin-badge" :class="selectedSeat.class === 'business' ? 'badge-warning' : 'badge-active'">
                    {{ selectedSeat.class }}
                  </span>
                </div>
                <button class="btn-table-icon" @click="selectedSeat = null"><i class="ti ti-x"></i></button>
              </div>

              <table class="admin-detail-table">
                <tbody>
                  <tr>
                    <td class="admin-detail-label">Status</td>
                    <td>
                      <span class="admin-badge" :class="selectedSeat.isOccupied ? 'badge-inactive' : 'badge-active'">
                        {{ selectedSeat.isOccupied ? 'Occupied' : 'Available' }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="admin-detail-label">Active</td>
                    <td>
                      <span class="admin-badge" :class="selectedSeat.isActive ? 'badge-active' : 'badge-inactive'">
                        {{ selectedSeat.isActive ? 'Yes' : 'No' }}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="admin-detail-label">Class</td>
                    <td class="capitalize">{{ selectedSeat.class }}</td>
                  </tr>
                  <tr>
                    <td class="admin-detail-label">Seat ID</td>
                    <td class="mono muted" style="font-size: 0.7rem;">{{ selectedSeat._id }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="pn-sep" style="margin: 16px 0;"></div>

              <span class="fs-label">Admin Override</span>
              <button
                class="btn-table-action btn-block"
                :class="selectedSeat.isOccupied ? 'btn-table-success' : 'btn-table-danger'"
                style="margin-top: 10px;"
                @click="toggleSeatStatus(selectedSeat)"
              >
                <i class="ti" :class="selectedSeat.isOccupied ? 'ti-lock-open' : 'ti-lock'"></i>
                {{ selectedSeat.isOccupied ? 'Mark as Available' : 'Mark as Occupied' }}
              </button>
              <p class="admin-inline-note">
                Use this only to manually correct seat status after a cancelled booking.
              </p>
            </div>

          </div>

        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
@import './admin-shared.css';
</style>