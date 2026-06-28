<script setup>
import { ref, onMounted } from 'vue';
import { getAllAirlines, createAirline, updateAirline, deactivateAirline, reactivateAirline } from '../../api.js';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const airlines = ref([]);
const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(airlines);
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);
const isSubmitting = ref(false);
const showCreateForm = ref(false);

const form = ref({ name: '', iataCode: '', logoURL: '' });
const editForm = ref({ id: null, logoURL: '' });
const showEditModal = ref(false);

async function loadAirlines() {
    try {
        isLoading.value = true;
        const res = await getAllAirlines();
        airlines.value = res.result;
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to load airlines.';
    } finally {
        isLoading.value = false;
    }
}

async function handleCreate() {
    errorMessage.value = ''; successMessage.value = '';
    if (!form.value.name.trim()) { errorMessage.value = 'Name is required.'; return; }
    if (!form.value.iataCode.trim() || form.value.iataCode.length !== 2) { errorMessage.value = 'IATA code must be 2 letters.'; return; }
    if (!form.value.logoURL.trim()) { errorMessage.value = 'Logo URL is required.'; return; }
    try {
        isSubmitting.value = true;
        await createAirline({ name: form.value.name, iataCode: form.value.iataCode, logoURL: form.value.logoURL });
        successMessage.value = 'Airline created successfully.';
        form.value = { name: '', iataCode: '', logoURL: '' };
        showCreateForm.value = false;
        await loadAirlines();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to create airline.';
    } finally {
        isSubmitting.value = false;
    }
}

function openEditModal(airline) {
    editForm.value = { id: airline._id, logoURL: airline.logoURL };
    showEditModal.value = true;
}

function closeEditModal() {
    showEditModal.value = false;
    editForm.value = { id: null, logoURL: '' };
}

async function handleEdit() {
    errorMessage.value = ''; successMessage.value = '';
    if (!editForm.value.logoURL.trim()) { errorMessage.value = 'Logo URL is required.'; return; }
    try {
        isSubmitting.value = true;
        await updateAirline(editForm.value.id, { logoURL: editForm.value.logoURL });
        successMessage.value = 'Airline updated successfully.';
        closeEditModal();
        await loadAirlines();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to update airline.';
    } finally {
        isSubmitting.value = false;
    }
}

async function toggleStatus(airline) {
    errorMessage.value = ''; successMessage.value = '';
    try {
        airline.isActive ? await deactivateAirline(airline._id) : await reactivateAirline(airline._id);
        await loadAirlines();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to update airline status.';
    }
}

onMounted(loadAirlines);
</script>

<template>
    <div class="profile-section">

        <div class="ps-header">
            <h3>Airlines</h3>
            <button class="btn-outline-gold" @click="showCreateForm = !showCreateForm">
                <i class="ti" :class="showCreateForm ? 'ti-x' : 'ti-plus'"></i>
                {{ showCreateForm ? 'Cancel' : 'New Airline' }}
            </button>
        </div>

        <div class="ps-body">

            <p v-if="successMessage" class="alert-msg alert-success">{{ successMessage }}</p>
            <p v-if="errorMessage" class="alert-msg alert-error">{{ errorMessage }}</p>

            <!-- Create Form -->
            <div v-if="showCreateForm" class="admin-form-panel">
                <p class="admin-form-eyebrow">New Airline</p>
                <form @submit.prevent="handleCreate">
                    <div class="admin-form-grid">
                        <div>
                            <label class="f-label">Airline Name</label>
                            <input v-model="form.name" type="text" class="f-input" placeholder="e.g. Philippine Airlines" />
                        </div>
                        <div>
                            <label class="f-label">IATA Code</label>
                            <input v-model="form.iataCode" type="text" class="f-input" placeholder="e.g. PR" maxlength="2" />
                        </div>
                        <div class="col-span-2">
                            <label class="f-label">Logo URL</label>
                            <input v-model="form.logoURL" type="text" class="f-input" placeholder="https://example.com/logo.png" />
                        </div>
                    </div>
                    <button type="submit" class="btn-gold-full" style="margin-top: 20px;" :disabled="isSubmitting">
                        {{ isSubmitting ? 'Saving…' : 'Save Airline' }}
                    </button>
                </form>
            </div>

            <div v-if="isLoading" class="admin-loading">
                <i class="ti ti-loader-2 admin-spinner"></i> Loading…
            </div>

            <div v-else class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Logo</th>
                            <th>Name</th>
                            <th>IATA</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="airlines.length === 0">
                            <td colspan="5" class="admin-empty-row">No airlines found.</td>
                        </tr>
                        <tr v-for="airline in pagedItems" :key="airline._id">
                            <td>
                                <img :src="airline.logoURL" :alt="airline.name" class="admin-airline-logo" />
                            </td>
                            <td>{{ airline.name }}</td>
                            <td>
                                <span class="admin-badge badge-muted">{{ airline.iataCode }}</span>
                            </td>
                            <td>
                                <span class="admin-badge" :class="airline.isActive ? 'badge-active' : 'badge-inactive'">
                                    {{ airline.isActive ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td class="admin-actions-cell">
                                <button class="btn-table-action" @click="openEditModal(airline)">
                                    <i class="ti ti-pencil"></i> Edit Logo
                                </button>
                                <button class="btn-table-action" :class="airline.isActive ? 'btn-table-danger' : 'btn-table-success'" @click="toggleStatus(airline)">
                                    {{ airline.isActive ? 'Deactivate' : 'Reactivate' }}
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

        <!-- Edit Modal -->
        <div v-if="showEditModal" class="admin-modal-overlay" @click.self="closeEditModal">
            <div class="admin-modal">
                <div class="admin-modal-header">
                    <h4>Edit Airline Logo</h4>
                    <button class="admin-modal-close" @click="closeEditModal"><i class="ti ti-x"></i></button>
                </div>
                <div class="admin-modal-body">
                    <label class="f-label">Logo URL</label>
                    <input v-model="editForm.logoURL" type="text" class="f-input" placeholder="https://example.com/logo.png" />
                </div>
                <div class="admin-modal-footer">
                    <button class="btn-table-action" @click="closeEditModal">Cancel</button>
                    <button class="btn-gold-full" :disabled="isSubmitting" @click="handleEdit" style="width:auto; padding: 10px 28px;">
                        {{ isSubmitting ? 'Saving…' : 'Save Changes' }}
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
@import './admin-shared.css';
</style>