<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllBookings, updateBookingStatus, deactivateBooking, reactivateBooking, getFlightById } from '../../api.js';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const bookings = ref([]);
const flightCache = ref({});
const searchQuery = ref('');
const filterStatus = ref('all');
const filterActive = ref('all');

const filteredBookings = computed(() => {
    let list = bookings.value;
    if (filterStatus.value !== 'all') list = list.filter(b => b.status === filterStatus.value);
    if (filterActive.value === 'active') list = list.filter(b => b.isActive);
    else if (filterActive.value === 'inactive') list = list.filter(b => !b.isActive);
    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(b =>
            b.bookingReference?.toLowerCase().includes(q) ||
            b.guestEmail?.toLowerCase().includes(q) ||
            flightCache.value[b.flightId]?.flightNumber?.toLowerCase().includes(q)
        );
    }
    return list;
});
const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(filteredBookings);
const isLoading = ref(true);
const pageError = ref(null);

const showStatusModal = ref(false);
const statusTarget = ref(null);
const newStatus = ref('');
const isSaving = ref(false);
const statusError = ref(null);

const showDetailModal = ref(false);
const detailTarget = ref(null);
const isFetchingDetail = ref(false);

const actionSuccess = ref(null);
const actionError = ref(null);

const STATUS_META = {
    pending:   { icon: 'ti-clock',        label: 'Pending',   badgeClass: 'badge-warning' },
    confirmed: { icon: 'ti-circle-check',  label: 'Confirmed', badgeClass: 'badge-active'  },
    cancelled: { icon: 'ti-circle-x',      label: 'Cancelled', badgeClass: 'badge-inactive'},
};

const getStatusMeta = (status) => STATUS_META[status] || { icon: 'ti-question-mark', label: status, badgeClass: 'badge-muted' };

const stats = computed(() => ({
    total:     bookings.value.length,
    pending:   bookings.value.filter(b => b.status === 'pending').length,
    confirmed: bookings.value.filter(b => b.status === 'confirmed').length,
    cancelled: bookings.value.filter(b => b.status === 'cancelled').length,
}));

const fetchFlightForBooking = async (flightId) => {
    if (flightCache.value[flightId]) return;
    try {
        const data = await getFlightById(flightId);
        flightCache.value[flightId] = data.result;
    } catch { flightCache.value[flightId] = null; }
};

const fetchBookings = async () => {
    isLoading.value = true; pageError.value = null;
    try {
        const data = await getAllBookings();
        bookings.value = data.result;
        const uniqueFlightIds = [...new Set(data.result.map(b => b.flightId))];
        await Promise.allSettled(uniqueFlightIds.map(id => fetchFlightForBooking(id)));
    } catch (err) {
        if (err.response?.status === 404) bookings.value = [];
        else pageError.value = err.response?.data?.message || 'Failed to load bookings.';
    } finally {
        isLoading.value = false;
    }
};

const openStatusModal = (booking) => {
    statusTarget.value = booking; newStatus.value = booking.status;
    statusError.value = null; showStatusModal.value = true;
};
const closeStatusModal = () => { showStatusModal.value = false; statusTarget.value = null; };

const saveStatus = async () => {
    if (newStatus.value === statusTarget.value.status) { statusError.value = 'Please select a different status.'; return; }
    isSaving.value = true; statusError.value = null;
    try {
        await updateBookingStatus(statusTarget.value._id, { status: newStatus.value });
        await fetchBookings();
        actionSuccess.value = `Booking ${statusTarget.value.bookingReference} updated to "${newStatus.value}".`;
        closeStatusModal();
        setTimeout(() => actionSuccess.value = null, 4000);
    } catch (err) {
        statusError.value = err.response?.data?.message || 'Failed to update status.';
    } finally {
        isSaving.value = false;
    }
};

const openDetail = async (booking) => {
    detailTarget.value = { ...booking }; showDetailModal.value = true; isFetchingDetail.value = true;
    try {
        if (!flightCache.value[booking.flightId]) await fetchFlightForBooking(booking.flightId);
        detailTarget.value.flight = flightCache.value[booking.flightId];
    } catch { /* best effort */ } finally { isFetchingDetail.value = false; }
};

const toggleActive = async (booking) => {
    actionError.value = null; actionSuccess.value = null;
    try {
        if (booking.isActive) {
            await deactivateBooking(booking._id);
            actionSuccess.value = `Booking ${booking.bookingReference} deactivated.`;
        } else {
            await reactivateBooking(booking._id);
            actionSuccess.value = `Booking ${booking.bookingReference} reactivated.`;
        }
        await fetchBookings();
        setTimeout(() => actionSuccess.value = null, 4000);
    } catch (err) {
        actionError.value = err.response?.data?.message || 'Action failed.';
        setTimeout(() => actionError.value = null, 4000);
    }
};

onMounted(fetchBookings);
</script>

<template>
    <div class="profile-section">

        <div class="ps-header">
            <h3>Bookings</h3>
            <button class="btn-refresh" @click="fetchBookings">
                <i class="ti ti-refresh"></i> Refresh
            </button>
        </div>

        <div class="ps-body">

            <!-- Stats -->
            <div class="admin-stats-row" style="grid-template-columns: repeat(4,1fr);">
                <div class="admin-stat-card">
                    <div class="admin-stat-number">{{ stats.total }}</div>
                    <div class="admin-stat-label">Total</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number" style="color: var(--gold);">{{ stats.pending }}</div>
                    <div class="admin-stat-label">Pending</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number stat-success">{{ stats.confirmed }}</div>
                    <div class="admin-stat-label">Confirmed</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number stat-error">{{ stats.cancelled }}</div>
                    <div class="admin-stat-label">Cancelled</div>
                </div>
            </div>

            <!-- Alerts -->
            <p v-if="actionSuccess" class="alert-msg alert-success">{{ actionSuccess }}</p>
            <p v-if="actionError" class="alert-msg alert-error">{{ actionError }}</p>

            <!-- Filters -->
            <div class="admin-filter-bar">
                <div class="admin-search-wrap">
                    <i class="ti ti-search admin-search-icon"></i>
                    <input type="text" class="admin-search-input" placeholder="Search by reference, email, or flight…" v-model="searchQuery" />
                </div>
                <select class="admin-filter-select" v-model="filterStatus">
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select class="admin-filter-select" v-model="filterActive">
                    <option value="all">Active & Inactive</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                </select>
                <span class="admin-filter-count">{{ filteredBookings.length }} of {{ bookings.length }}</span>
            </div>

            <!-- Loading -->
            <div v-if="isLoading" class="admin-loading">
                <i class="ti ti-loader-2 admin-spinner"></i> Loading bookings…
            </div>

            <!-- Error -->
            <p v-else-if="pageError" class="alert-msg alert-error">{{ pageError }}</p>

            <!-- Empty -->
            <div v-else-if="filteredBookings.length === 0" class="admin-empty-state">
                <i class="ti ti-ticket"></i>
                <p>No bookings match your current filters.</p>
            </div>

            <!-- Table -->
            <div v-else class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Reference</th>
                            <th>Flight</th>
                            <th>Booker</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Active</th>
                            <th style="text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="booking in pagedItems" :key="booking._id" :class="{ 'row-inactive': !booking.isActive }">
                            <td class="cell-mono">{{ booking.bookingReference }}</td>
                            <td>
                                <span v-if="flightCache[booking.flightId]" class="cell-highlight">
                                    {{ flightCache[booking.flightId].flightNumber }}
                                </span>
                                <span v-else class="cell-muted">Loading…</span>
                            </td>
                            <td>
                                <span v-if="booking.guestEmail" class="cell-muted">
                                    <i class="ti ti-user"></i> {{ booking.guestEmail }}
                                </span>
                                <span v-else-if="booking.userId" class="cell-muted cell-mono" style="font-size:0.72rem;">
                                    <i class="ti ti-user-check"></i> {{ String(booking.userId).substring(0, 12) }}…
                                </span>
                                <span v-else class="cell-muted">—</span>
                            </td>
                            <td class="cell-highlight">₱{{ Number(booking.totalAmount).toLocaleString() }}</td>
                            <td>
                                <span class="admin-badge" :class="getStatusMeta(booking.status).badgeClass">
                                    <i class="ti" :class="getStatusMeta(booking.status).icon"></i>
                                    {{ getStatusMeta(booking.status).label }}
                                </span>
                            </td>
                            <td>
                                <span class="admin-badge" :class="booking.isActive ? 'badge-active' : 'badge-inactive'">
                                    {{ booking.isActive ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td>
                                <div class="admin-actions-cell" style="justify-content:flex-end;">
                                    <button class="btn-table-icon" title="View details" @click="openDetail(booking)">
                                        <i class="ti ti-eye"></i>
                                    </button>
                                    <button class="btn-table-icon" title="Update status" @click="openStatusModal(booking)">
                                        <i class="ti ti-refresh"></i>
                                    </button>
                                    <button class="btn-table-icon" :class="booking.isActive ? 'danger' : 'success'"
                                        :title="booking.isActive ? 'Deactivate' : 'Reactivate'"
                                        @click="toggleActive(booking)">
                                        <i class="ti" :class="booking.isActive ? 'ti-toggle-left' : 'ti-toggle-right'"></i>
                                    </button>
                                </div>
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

        <!-- Status Modal -->
        <div v-if="showStatusModal && statusTarget" class="admin-modal-overlay" @click.self="closeStatusModal">
            <div class="admin-modal">
                <div class="admin-modal-header">
                    <h4>Update Booking Status</h4>
                    <button class="admin-modal-close" @click="closeStatusModal"><i class="ti ti-x"></i></button>
                </div>
                <div class="admin-modal-body">
                    <p v-if="statusError" class="alert-msg alert-error" style="margin-bottom:14px;">{{ statusError }}</p>
                    <p class="cell-muted" style="margin-bottom:16px; font-size:0.78rem;">
                        Reference: <span class="cell-mono cell-highlight">{{ statusTarget.bookingReference }}</span>
                    </p>
                    <p class="f-label" style="margin-bottom:10px;">Current status</p>
                    <span class="admin-badge" :class="getStatusMeta(statusTarget.status).badgeClass" style="margin-bottom: 20px; display:inline-flex;">
                        <i class="ti" :class="getStatusMeta(statusTarget.status).icon"></i>
                        {{ getStatusMeta(statusTarget.status).label }}
                    </span>
                    <p class="f-label" style="margin: 16px 0 10px;">New Status</p>
                    <div class="status-option-grid">
                        <div v-for="option in ['pending', 'confirmed', 'cancelled']" :key="option"
                            class="status-option-card" :class="{ selected: newStatus === option }"
                            @click="newStatus = option">
                            <i class="ti" :class="[getStatusMeta(option).icon, newStatus === option ? 'ti-icon-gold' : 'ti-icon-muted']"></i>
                            <span class="option-label">{{ option }}</span>
                        </div>
                    </div>
                    <p v-if="newStatus === 'confirmed'" class="alert-msg alert-success" style="margin-top:14px; margin-bottom:0;">
                        <i class="ti ti-mail"></i> A confirmation will be sent to the booker.
                    </p>
                </div>
                <div class="admin-modal-footer">
                    <button class="btn-table-action" @click="closeStatusModal">Cancel</button>
                    <button class="btn-gold-full" @click="saveStatus" :disabled="isSaving" style="width:auto; padding: 10px 28px;">
                        <i v-if="isSaving" class="ti ti-loader-2 admin-spinner"></i>
                        {{ isSaving ? 'Saving…' : 'Update Status' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Detail Modal -->
        <div v-if="showDetailModal && detailTarget" class="admin-modal-overlay" @click.self="showDetailModal = false">
            <div class="admin-modal">
                <div class="admin-modal-header">
                    <h4>Booking Detail</h4>
                    <button class="admin-modal-close" @click="showDetailModal = false"><i class="ti ti-x"></i></button>
                </div>
                <div class="admin-modal-body">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                        <span class="cell-mono" style="font-size:1rem; font-weight:700; color:var(--text);">{{ detailTarget.bookingReference }}</span>
                        <span class="admin-badge" :class="getStatusMeta(detailTarget.status).badgeClass">
                            <i class="ti" :class="getStatusMeta(detailTarget.status).icon"></i>
                            {{ getStatusMeta(detailTarget.status).label }}
                        </span>
                    </div>
                    <div v-if="isFetchingDetail" class="admin-loading" style="padding:20px 0;">
                        <i class="ti ti-loader-2 admin-spinner"></i> Fetching flight info…
                    </div>
                    <table class="admin-detail-table">
                        <tbody>
                            <tr>
                                <td class="admin-detail-label">Flight</td>
                                <td class="cell-highlight">{{ detailTarget.flight?.flightNumber || '—' }}</td>
                            </tr>
                            <tr v-if="detailTarget.flight">
                                <td class="admin-detail-label">Departure</td>
                                <td>{{ new Date(detailTarget.flight.departureTime).toLocaleString() }}</td>
                            </tr>
                            <tr v-if="detailTarget.flight">
                                <td class="admin-detail-label">Arrival</td>
                                <td>{{ new Date(detailTarget.flight.arrivalTime).toLocaleString() }}</td>
                            </tr>
                            <tr>
                                <td class="admin-detail-label">Booker</td>
                                <td>{{ detailTarget.guestEmail || detailTarget.userId || '—' }}</td>
                            </tr>
                            <tr>
                                <td class="admin-detail-label">Type</td>
                                <td>{{ detailTarget.guestEmail ? 'Guest' : 'Registered User' }}</td>
                            </tr>
                            <tr>
                                <td class="admin-detail-label">Total Amount</td>
                                <td class="cell-highlight" style="font-weight:700;">₱{{ Number(detailTarget.totalAmount).toLocaleString() }}</td>
                            </tr>
                            <tr>
                                <td class="admin-detail-label">Active</td>
                                <td>
                                    <span class="admin-badge" :class="detailTarget.isActive ? 'badge-active' : 'badge-inactive'">
                                        {{ detailTarget.isActive ? 'Active' : 'Inactive' }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="admin-modal-footer">
                    <button class="btn-table-action" @click="showDetailModal = false">Close</button>
                    <button class="btn-gold-full" @click="() => { showDetailModal = false; openStatusModal(detailTarget); }" style="width:auto; padding: 10px 28px;">
                        <i class="ti ti-refresh"></i> Update Status
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
@import './admin-shared.css';

.row-inactive td { opacity: 0.55; }
.cell-mono  { font-family: 'DM Mono', 'Courier New', monospace; font-size: 0.8rem; }
.cell-muted { color: var(--muted); font-size: 0.8rem; }
.cell-highlight { color: var(--gold); font-weight: 700; }
.ti-icon-gold   { color: var(--gold); }
.ti-icon-muted  { color: var(--muted); }

.status-option-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}
.status-option-card .ti { font-size: 1.3rem; color: var(--muted); margin-bottom: 5px; display: block; }
.status-option-card.selected .ti { color: var(--gold); }
</style>