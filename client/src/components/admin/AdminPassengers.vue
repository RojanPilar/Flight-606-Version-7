<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllPassengers, adminUpdatePassenger, activatePassenger, deactivatePassenger } from '../../api.js';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const passengers = ref([]);
const searchQuery = ref('');
const filterStatus = ref('all');

const filteredPassengers = computed(() => {
    let list = passengers.value;

    if (filterStatus.value === 'active') list = list.filter(p => p.isActive);
    else if (filterStatus.value === 'inactive') list = list.filter(p => !p.isActive);
    else if (filterStatus.value === 'guest') list = list.filter(p => !p.userId);
    else if (filterStatus.value === 'registered') list = list.filter(p => !!p.userId);

    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(p =>
            p.firstName?.toLowerCase().includes(q) ||
            p.lastName?.toLowerCase().includes(q) ||
            p.passportNumber?.toLowerCase().includes(q) ||
            p.nationality?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q)
        );
    }

    return list;
});
const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(filteredPassengers);
const isLoading = ref(true);
const pageError = ref(null);

// Edit modal
const showEditModal = ref(false);
const editTarget = ref(null);
const editForm = ref({
    firstName: '',
    lastName: '',
    gender: '',
    email: '',
    nationality: '',
    passportNumber: '',
    passportExpiry: '',
    phone: ''
});
const isSaving = ref(false);
const editError = ref(null);

// Action feedback
const actionSuccess = ref(null);
const actionError = ref(null);

// Passport expiry warning helper
const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
    return diffDays < 90 && diffDays > 0;
};

const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
};

const fetchPassengers = async () => {
    isLoading.value = true;
    pageError.value = null;
    try {
        const data = await getAllPassengers();
        passengers.value = data.result;
    } catch (err) {
        if (err.response?.status === 404) {
            passengers.value = [];
        } else {
            pageError.value = err.response?.data?.message || 'Failed to load passengers.';
        }
    } finally {
        isLoading.value = false;
    }
};

const openEditModal = (passenger) => {
    editTarget.value = passenger;
    editForm.value = {
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        gender: passenger.gender,
        email: passenger.email,
        nationality: passenger.nationality,
        passportNumber: passenger.passportNumber,
        passportExpiry: passenger.passportExpiry ? passenger.passportExpiry.substring(0, 10) : '',
        phone: passenger.phone
    };
    editError.value = null;
    showEditModal.value = true;
};

const closeEditModal = () => {
    showEditModal.value = false;
    editTarget.value = null;
};

const saveEdit = async () => {
    isSaving.value = true;
    editError.value = null;
    try {
        await adminUpdatePassenger(editTarget.value._id, editForm.value);
        await fetchPassengers();
        actionSuccess.value = `${editForm.value.firstName} ${editForm.value.lastName}'s profile updated successfully.`;
        closeEditModal();
        setTimeout(() => actionSuccess.value = null, 4000);
    } catch (err) {
        editError.value = err.response?.data?.message || 'Failed to update passenger.';
    } finally {
        isSaving.value = false;
    }
};

const toggleActive = async (passenger) => {
    actionError.value = null;
    actionSuccess.value = null;
    try {
        if (passenger.isActive) {
            await deactivatePassenger(passenger._id);
            actionSuccess.value = `${passenger.firstName} ${passenger.lastName}'s profile has been deactivated.`;
        } else {
            await activatePassenger(passenger._id);
            actionSuccess.value = `${passenger.firstName} ${passenger.lastName}'s profile has been reactivated.`;
        }
        await fetchPassengers();
        setTimeout(() => actionSuccess.value = null, 4000);
    } catch (err) {
        actionError.value = err.response?.data?.message || 'Action failed.';
        setTimeout(() => actionError.value = null, 4000);
    }
};

onMounted(() => {
    fetchPassengers();
});
</script>

<template>
  <div class="profile-section">

    <!-- Header -->
    <div class="ps-header">
      <h3><i class="ti ti-id-badge"></i> Passenger Management</h3>
      <button class="btn-refresh" @click="fetchPassengers" :disabled="isLoading">
        <i class="ti ti-refresh"></i> Refresh
      </button>
    </div>

    <div class="ps-body">

      <!-- Alerts -->
      <p v-if="actionSuccess" class="alert-msg alert-success">{{ actionSuccess }}</p>
      <p v-if="actionError" class="alert-msg alert-error">{{ actionError }}</p>

      <!-- Search & Filters -->
      <div class="admin-filter-bar">
        <div class="admin-search-wrap">
          <i class="ti ti-search admin-search-icon"></i>
          <input
            type="text"
            class="admin-search-input"
            placeholder="Search by name, passport, nationality, email…"
            v-model="searchQuery"
          />
        </div>
        <select class="admin-filter-select" v-model="filterStatus">
          <option value="all">All Passengers</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
          <option value="registered">Registered Users</option>
          <option value="guest">Guests Only</option>
        </select>
        <span class="admin-filter-count">Showing {{ filteredPassengers.length }} of {{ passengers.length }}</span>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="admin-loading">
        <i class="ti ti-loader-2 admin-spinner"></i> Loading passengers…
      </div>

      <!-- Page Error -->
      <p v-else-if="pageError" class="alert-msg alert-error">{{ pageError }}</p>

      <!-- Table -->
      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Passport</th>
              <th>Nationality</th>
              <th>Passport Expiry</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredPassengers.length === 0">
              <td colspan="8" class="admin-empty-row">No passengers match your current filters.</td>
            </tr>
            <tr v-for="passenger in pagedItems" :key="passenger._id" :class="{ 'row-inactive': !passenger.isActive }">
              <td>
                {{ passenger.firstName }} {{ passenger.lastName }}
                <span class="cell-sub">{{ passenger.gender || '—' }}</span>
              </td>
              <td class="mono">{{ passenger.passportNumber }}</td>
              <td class="muted">{{ passenger.nationality }}</td>
              <td>
                <span v-if="isExpired(passenger.passportExpiry)" class="admin-badge badge-inactive">Expired</span>
                <span v-else-if="isExpiringSoon(passenger.passportExpiry)" class="admin-badge badge-warning">Expiring Soon</span>
                <span v-else class="muted">
                  {{ passenger.passportExpiry ? new Date(passenger.passportExpiry).toLocaleDateString() : '—' }}
                </span>
              </td>
              <td class="muted">{{ passenger.phone || '—' }}</td>
              <td>
                <span class="admin-badge" :class="passenger.userId ? 'badge-active' : 'badge-muted'">
                  {{ passenger.userId ? 'Registered' : 'Guest' }}
                </span>
              </td>
              <td>
                <span class="admin-badge" :class="passenger.isActive ? 'badge-active' : 'badge-inactive'">
                  {{ passenger.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <div class="admin-actions-cell">
                  <button class="btn-table-icon" title="Edit passenger" @click="openEditModal(passenger)">
                    <i class="ti ti-pencil"></i>
                  </button>
                  <button
                    class="btn-table-icon"
                    :class="passenger.isActive ? 'danger' : 'success'"
                    :title="passenger.isActive ? 'Deactivate' : 'Reactivate'"
                    @click="toggleActive(passenger)"
                  >
                    <i class="ti" :class="passenger.isActive ? 'ti-user-off' : 'ti-user-check'"></i>
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

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="admin-modal-overlay" @click.self="closeEditModal">
      <div class="admin-modal admin-modal-lg">
        <div class="admin-modal-header">
          <h4><i class="ti ti-id-badge"></i> Edit Passenger <span class="muted" style="font-weight: 400; margin-left: 6px;">(Admin Action)</span></h4>
          <button class="admin-modal-close" @click="closeEditModal"><i class="ti ti-x"></i></button>
        </div>
        <div class="admin-modal-body">
          <p v-if="editError" class="alert-msg alert-error">{{ editError }}</p>

          <div class="admin-form-grid">
            <div>
              <label class="f-label">First Name</label>
              <input type="text" class="f-input" v-model="editForm.firstName" />
            </div>
            <div>
              <label class="f-label">Last Name</label>
              <input type="text" class="f-input" v-model="editForm.lastName" />
            </div>
            <div>
              <label class="f-label">Gender</label>
              <select class="f-input" v-model="editForm.gender">
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label class="f-label">Email</label>
              <input type="email" class="f-input" v-model="editForm.email" />
            </div>
            <div>
              <label class="f-label">Nationality</label>
              <input type="text" class="f-input" v-model="editForm.nationality" />
            </div>
            <div>
              <label class="f-label">Phone</label>
              <input type="text" class="f-input" v-model="editForm.phone" />
            </div>
            <div>
              <label class="f-label">Passport Number</label>
              <input type="text" class="f-input mono" v-model="editForm.passportNumber" />
            </div>
            <div>
              <label class="f-label">Passport Expiry</label>
              <input type="date" class="f-input" v-model="editForm.passportExpiry" />
              <p v-if="isExpired(editForm.passportExpiry)" class="admin-inline-note note-error">
                <i class="ti ti-alert-triangle"></i> This passport is expired.
              </p>
              <p v-else-if="isExpiringSoon(editForm.passportExpiry)" class="admin-inline-note note-warning">
                <i class="ti ti-clock-exclamation"></i> Expiring within 90 days.
              </p>
            </div>
          </div>
        </div>
        <div class="admin-modal-footer">
          <button class="btn-refresh" @click="closeEditModal">Cancel</button>
          <button class="btn-gold-full" :disabled="isSaving" @click="saveEdit">
            {{ isSaving ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
@import './admin-shared.css';
</style>