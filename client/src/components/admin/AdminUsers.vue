<script setup>
import { ref, onMounted, computed } from 'vue';
import { getAllUsers, updateUserAsAdmin, deactivateUser, reactivateUser } from '../../api.js';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const users = ref([]);
const searchQuery = ref('');
const filterStatus = ref('all');

const filteredUsers = computed(() => {
    let list = users.value;

    if (filterStatus.value === 'active') list = list.filter(u => u.isActive);
    else if (filterStatus.value === 'inactive') list = list.filter(u => !u.isActive);
    else if (filterStatus.value === 'admin') list = list.filter(u => u.isAdmin);

    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(u =>
            u.firstName?.toLowerCase().includes(q) ||
            u.lastName?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
        );
    }

    return list;
});

const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(filteredUsers);
const isLoading = ref(true);
const pageError = ref(null);

// Search/filter

// Edit modal
const showEditModal = ref(false);
const editTarget = ref(null);
const editForm = ref({ firstName: '', lastName: '', email: '', phone: '', gender: '', isAdmin: false });
const isSaving = ref(false);
const editError = ref(null);

// Action feedback
const actionSuccess = ref(null);
const actionError = ref(null);

const fetchUsers = async () => {
    isLoading.value = true;
    pageError.value = null;
    try {
        const data = await getAllUsers();
        users.value = data.result;
    } catch (err) {
        if (err.response?.status === 404) {
            users.value = [];
        } else {
            pageError.value = err.response?.data?.message || 'Failed to load users.';
        }
    } finally {
        isLoading.value = false;
    }
};

const openEditModal = (user) => {
    editTarget.value = user;
    editForm.value = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        isAdmin: user.isAdmin
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
        await updateUserAsAdmin(editTarget.value._id, editForm.value);
        await fetchUsers();
        actionSuccess.value = `${editForm.value.firstName} ${editForm.value.lastName}'s profile updated successfully.`;
        closeEditModal();
        setTimeout(() => actionSuccess.value = null, 4000);
    } catch (err) {
        editError.value = err.response?.data?.message || 'Failed to update user.';
    } finally {
        isSaving.value = false;
    }
};

const toggleActive = async (user) => {
    actionError.value = null;
    actionSuccess.value = null;
    try {
        if (user.isActive) {
            await deactivateUser(user._id);
            actionSuccess.value = `${user.firstName} ${user.lastName} has been deactivated.`;
        } else {
            await reactivateUser(user._id);
            actionSuccess.value = `${user.firstName} ${user.lastName} has been reactivated.`;
        }
        await fetchUsers();
        setTimeout(() => actionSuccess.value = null, 4000);
    } catch (err) {
        actionError.value = err.response?.data?.message || 'Action failed.';
        setTimeout(() => actionError.value = null, 4000);
    }
};

onMounted(() => {
    fetchUsers();
});
</script>

<template>
  <div class="profile-section">

    <!-- Header -->
    <div class="ps-header">
      <h3><i class="ti ti-users"></i> User Management</h3>
      <button class="btn-refresh" @click="fetchUsers" :disabled="isLoading">
        <i class="ti ti-refresh"></i> Refresh
      </button>
    </div>

    <div class="ps-body">

      <!-- Feedback -->
      <p v-if="actionSuccess" class="alert-msg alert-success">{{ actionSuccess }}</p>
      <p v-if="actionError" class="alert-msg alert-error">{{ actionError }}</p>

      <!-- Filters -->
      <div class="admin-filter-bar">
        <div class="admin-search-wrap">
          <i class="ti ti-search admin-search-icon"></i>
          <input
            type="text"
            class="admin-search-input"
            placeholder="Search by name or email…"
            v-model="searchQuery"
          />
        </div>
        <select class="admin-filter-select" v-model="filterStatus">
          <option value="all">All Users</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
          <option value="admin">Admins Only</option>
        </select>
        <span class="admin-filter-count">Showing {{ filteredUsers.length }} of {{ users.length }}</span>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="admin-loading">
        <i class="ti ti-loader-2 admin-spinner"></i> Loading users…
      </div>

      <!-- Page Error -->
      <p v-else-if="pageError" class="alert-msg alert-error">{{ pageError }}</p>

      <!-- Empty State -->
      <div v-else-if="filteredUsers.length === 0" class="admin-empty-state">
        <i class="ti ti-user-x"></i>
        <p>No users match your current filters.</p>
      </div>

      <!-- Users Table -->
      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in pagedItems" :key="user._id" :class="{ 'row-inactive': !user.isActive }">
              <td>{{ user.firstName }} {{ user.lastName }}</td>
              <td class="muted">{{ user.email }}</td>
              <td class="muted">{{ user.phone || '—' }}</td>
              <td class="muted">{{ user.gender || '—' }}</td>
              <td>
                <span v-if="user.isAdmin" class="admin-badge badge-warning">
                  <i class="ti ti-shield-filled"></i> Admin
                </span>
                <span v-else class="admin-badge badge-muted">User</span>
              </td>
              <td>
                <span v-if="user.isActive" class="admin-badge badge-active">
                  <i class="ti ti-circle-filled" style="font-size: 0.5rem;"></i> Active
                </span>
                <span v-else class="admin-badge badge-inactive">
                  <i class="ti ti-circle-filled" style="font-size: 0.5rem;"></i> Inactive
                </span>
              </td>
              <td>
                <div class="admin-actions-cell">
                  <button
                    @click="openEditModal(user)"
                    class="btn-table-icon"
                    title="Edit user"
                  >
                    <i class="ti ti-pencil"></i>
                  </button>
                  <button
                    @click="toggleActive(user)"
                    class="btn-table-icon"
                    :class="user.isActive ? 'danger' : 'success'"
                    :title="user.isActive ? 'Deactivate' : 'Reactivate'"
                  >
                    <i class="ti" :class="user.isActive ? 'ti-user-off' : 'ti-user-check'"></i>
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
      <div class="admin-modal">
        <div class="admin-modal-header">
          <h4><i class="ti ti-user-edit"></i> Edit User</h4>
          <button class="admin-modal-close" @click="closeEditModal"><i class="ti ti-x"></i></button>
        </div>
        <div class="admin-modal-body">

          <p v-if="editError" class="alert-msg alert-error">{{ editError }}</p>

          <div class="admin-form-grid">
            <div>
              <label class="f-label">First Name</label>
              <input type="text" class="f-input" v-model="editForm.firstName">
            </div>
            <div>
              <label class="f-label">Last Name</label>
              <input type="text" class="f-input" v-model="editForm.lastName">
            </div>
            <div class="col-span-2">
              <label class="f-label">Email</label>
              <input type="email" class="f-input" v-model="editForm.email">
            </div>
            <div>
              <label class="f-label">Phone</label>
              <input type="text" class="f-input" v-model="editForm.phone">
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
            <div class="col-span-2">
              <label class="r-lbl">
                <input type="checkbox" v-model="editForm.isAdmin">
                <span>Grant Admin Privileges <i class="ti ti-shield-filled" style="color: var(--gold);"></i></span>
              </label>
              <p v-if="editForm.isAdmin" class="admin-inline-note note-warning">
                <i class="ti ti-alert-triangle"></i> This user will have full admin access.
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