<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllNotifications, deactivateNotification } from '../../api.js';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const notifications = ref([]);
const searchQuery = ref('');
const filterType = ref('all');
const filterStatus = ref('all');
const filterRead = ref('all');

const filteredNotifications = computed(() => {
    let list = notifications.value;
    if (filterType.value !== 'all') list = list.filter(n => n.type === filterType.value);
    if (filterStatus.value === 'active') list = list.filter(n => n.isActive);
    else if (filterStatus.value === 'inactive') list = list.filter(n => !n.isActive);
    if (filterRead.value === 'read') list = list.filter(n => n.isRead);
    else if (filterRead.value === 'unread') list = list.filter(n => !n.isRead);
    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(n => n.message?.toLowerCase().includes(q) || n.guestEmail?.toLowerCase().includes(q) || n.userId?.toLowerCase().includes(q));
    }
    return list;
});
const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(filteredNotifications);
const isLoading = ref(true);
const pageError = ref(null);

const actionSuccess = ref(null);
const actionError = ref(null);

const showDetailModal = ref(false);
const detailTarget = ref(null);

const TYPE_META = {
    booking_confirmed:    { label: 'Booking Confirmed',   icon: 'ti-circle-check',  badgeClass: 'badge-active'   },
    flight_status_change: { label: 'Flight Status Change', icon: 'ti-plane',         badgeClass: 'badge-warning'  },
    itinerary_created:    { label: 'Itinerary Created',    icon: 'ti-map',           badgeClass: 'badge-muted'    },
};

const getTypeMeta = (type) => TYPE_META[type] || { label: type, icon: 'ti-bell', badgeClass: 'badge-muted' };

const uniqueTypes = computed(() => [...new Set(notifications.value.map(n => n.type))]);

const stats = computed(() => ({
    total:    notifications.value.length,
    unread:   notifications.value.filter(n => !n.isRead && n.isActive).length,
    active:   notifications.value.filter(n => n.isActive).length,
    inactive: notifications.value.filter(n => !n.isActive).length,
}));

const fetchNotifications = async () => {
    isLoading.value = true; pageError.value = null;
    try {
        const data = await getAllNotifications();
        notifications.value = data.result;
    } catch (err) {
        if (err.response?.status === 404) notifications.value = [];
        else pageError.value = err.response?.data?.message || 'Failed to load notifications.';
    } finally {
        isLoading.value = false;
    }
};

const openDetail = (notification) => { detailTarget.value = notification; showDetailModal.value = true; };

const deactivate = async (notification) => {
    if (!confirm('Deactivate this notification? It will be hidden from the user.')) return;
    actionError.value = null; actionSuccess.value = null;
    try {
        await deactivateNotification(notification._id);
        await fetchNotifications();
        actionSuccess.value = 'Notification deactivated successfully.';
        if (showDetailModal.value && detailTarget.value?._id === notification._id) showDetailModal.value = false;
        setTimeout(() => actionSuccess.value = null, 4000);
    } catch (err) {
        actionError.value = err.response?.data?.message || 'Failed to deactivate notification.';
        setTimeout(() => actionError.value = null, 4000);
    }
};

onMounted(fetchNotifications);
</script>

<template>
    <div class="profile-section">

        <div class="ps-header">
            <h3>Notifications</h3>
            <button class="btn-refresh" @click="fetchNotifications">
                <i class="ti ti-refresh"></i> Refresh
            </button>
        </div>

        <div class="ps-body">

            <!-- Stats -->
            <div class="admin-stats-row">
                <div class="admin-stat-card">
                    <div class="admin-stat-number">{{ stats.total }}</div>
                    <div class="admin-stat-label">Total</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number stat-error">{{ stats.unread }}</div>
                    <div class="admin-stat-label">Unread</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number stat-success">{{ stats.active }}</div>
                    <div class="admin-stat-label">Active</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-number stat-muted">{{ stats.inactive }}</div>
                    <div class="admin-stat-label">Deactivated</div>
                </div>
            </div>

            <!-- Alerts -->
            <p v-if="actionSuccess" class="alert-msg alert-success">{{ actionSuccess }}</p>
            <p v-if="actionError" class="alert-msg alert-error">{{ actionError }}</p>

            <!-- Filters -->
            <div class="admin-filter-bar">
                <div class="admin-search-wrap">
                    <i class="ti ti-search admin-search-icon"></i>
                    <input type="text" class="admin-search-input" placeholder="Search message or recipient…" v-model="searchQuery" />
                </div>
                <select class="admin-filter-select" v-model="filterType">
                    <option value="all">All Types</option>
                    <option v-for="type in uniqueTypes" :key="type" :value="type">{{ getTypeMeta(type).label }}</option>
                </select>
                <select class="admin-filter-select" v-model="filterStatus">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                <select class="admin-filter-select" v-model="filterRead">
                    <option value="all">Read & Unread</option>
                    <option value="unread">Unread Only</option>
                    <option value="read">Read Only</option>
                </select>
                <span class="admin-filter-count">{{ filteredNotifications.length }}</span>
            </div>

            <!-- Loading -->
            <div v-if="isLoading" class="admin-loading">
                <i class="ti ti-loader-2 admin-spinner"></i> Loading notifications…
            </div>

            <p v-else-if="pageError" class="alert-msg alert-error">{{ pageError }}</p>

            <div v-else-if="filteredNotifications.length === 0" class="admin-empty-state">
                <i class="ti ti-bell-off"></i>
                <p>No notifications match your current filters.</p>
            </div>

            <!-- Table -->
            <div v-else class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Message</th>
                            <th>Recipient</th>
                            <th style="text-align:center;">Read</th>
                            <th style="text-align:center;">Email</th>
                            <th>Status</th>
                            <th>Sent At</th>
                            <th style="text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="n in pagedItems" :key="n._id" :class="{ 'row-inactive': !n.isActive }">
                            <td>
                                <span class="admin-badge" :class="getTypeMeta(n.type).badgeClass">
                                    <i class="ti" :class="getTypeMeta(n.type).icon"></i>
                                    {{ getTypeMeta(n.type).label }}
                                </span>
                            </td>
                            <td class="cell-truncate" :title="n.message">{{ n.message }}</td>
                            <td class="cell-muted">
                                <span v-if="n.guestEmail"><i class="ti ti-user"></i> {{ n.guestEmail }}</span>
                                <span v-else-if="n.userId" class="cell-mono" style="font-size:0.72rem;">{{ String(n.userId).substring(0,12) }}…</span>
                                <span v-else>—</span>
                            </td>
                            <td style="text-align:center;">
                                <i class="ti" :class="n.isRead ? 'ti-circle-check read-icon' : 'ti-circle unread-icon'"></i>
                            </td>
                            <td style="text-align:center;">
                                <i class="ti" :class="n.emailSent ? 'ti-mail-check email-sent-icon' : 'ti-mail-off email-unsent-icon'"></i>
                            </td>
                            <td>
                                <span class="admin-badge" :class="n.isActive ? 'badge-active' : 'badge-inactive'">
                                    {{ n.isActive ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td class="cell-muted" style="white-space:nowrap;">
                                {{ n.emailSentAt ? new Date(n.emailSentAt).toLocaleDateString() : '—' }}
                            </td>
                            <td>
                                <div class="admin-actions-cell" style="justify-content:flex-end;">
                                    <button class="btn-table-icon" title="View details" @click="openDetail(n)">
                                        <i class="ti ti-eye"></i>
                                    </button>
                                    <button v-if="n.isActive" class="btn-table-icon danger" title="Deactivate" @click="deactivate(n)">
                                        <i class="ti ti-trash"></i>
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

        <!-- Detail Modal -->
        <div v-if="showDetailModal && detailTarget" class="admin-modal-overlay" @click.self="showDetailModal = false">
            <div class="admin-modal">
                <div class="admin-modal-header">
                    <h4>Notification Detail</h4>
                    <button class="admin-modal-close" @click="showDetailModal = false"><i class="ti ti-x"></i></button>
                </div>
                <div class="admin-modal-body">
                    <span class="admin-badge" :class="getTypeMeta(detailTarget.type).badgeClass" style="margin-bottom:16px; display:inline-flex;">
                        <i class="ti" :class="getTypeMeta(detailTarget.type).icon"></i>
                        {{ getTypeMeta(detailTarget.type).label }}
                    </span>
                    <div class="admin-message-box">{{ detailTarget.message }}</div>
                    <table class="admin-detail-table">
                        <tbody>
                            <tr>
                                <td class="admin-detail-label">Recipient</td>
                                <td>{{ detailTarget.guestEmail || detailTarget.userId || '—' }}</td>
                            </tr>
                            <tr>
                                <td class="admin-detail-label">Read</td>
                                <td>
                                    <i class="ti" :class="detailTarget.isRead ? 'ti-circle-check read-icon' : 'ti-circle unread-icon'"></i>
                                    {{ detailTarget.isRead ? 'Yes' : 'No' }}
                                </td>
                            </tr>
                            <tr>
                                <td class="admin-detail-label">Email Sent</td>
                                <td>{{ detailTarget.emailSent ? 'Yes' : 'No' }}</td>
                            </tr>
                            <tr>
                                <td class="admin-detail-label">Sent At</td>
                                <td>{{ detailTarget.emailSentAt ? new Date(detailTarget.emailSentAt).toLocaleString() : '—' }}</td>
                            </tr>
                            <tr>
                                <td class="admin-detail-label">Status</td>
                                <td>
                                    <span class="admin-badge" :class="detailTarget.isActive ? 'badge-active' : 'badge-inactive'">
                                        {{ detailTarget.isActive ? 'Active' : 'Inactive' }}
                                    </span>
                                </td>
                            </tr>
                            <tr v-if="detailTarget.referenceModel">
                                <td class="admin-detail-label">Reference</td>
                                <td class="cell-mono" style="font-size:0.72rem;">{{ detailTarget.referenceModel }}: {{ String(detailTarget.referenceId).substring(0,16) }}…</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="admin-modal-footer">
                    <button class="btn-table-action" @click="showDetailModal = false">Close</button>
                    <button v-if="detailTarget.isActive" class="btn-table-action btn-table-danger" @click="deactivate(detailTarget)">
                        <i class="ti ti-trash"></i> Deactivate
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
@import './admin-shared.css';

.row-inactive td { opacity: 0.5; }
.cell-truncate { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; color: var(--muted); }
.cell-muted { color: var(--muted); font-size: 0.8rem; }
.cell-mono  { font-family: 'DM Mono', monospace; }

.read-icon       { color: var(--success); font-size: 1rem; }
.unread-icon     { color: var(--muted);   font-size: 1rem; }
.email-sent-icon { color: var(--gold);    font-size: 1rem; }
.email-unsent-icon { color: var(--muted); font-size: 1rem; }
</style>