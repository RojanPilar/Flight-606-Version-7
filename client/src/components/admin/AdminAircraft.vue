<script setup>
import { ref, onMounted } from 'vue';
import { getAllAircraft, getAllAirlines, createAircraft, updateAircraft, deactivateAircraft, reactivateAircraft } from '../../api.js';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const aircraft = ref([]);
const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(aircraft);
const airlines = ref([]);
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);
const isSubmitting = ref(false);
const showCreateForm = ref(false);

const form = ref({ airlineId: '', model: '', totalSeats: '' });
const editForm = ref({ id: null, airlineId: '', model: '', totalSeats: '' });
const showEditModal = ref(false);

async function loadData() {
    try {
        isLoading.value = true;
        const [aircraftRes, airlinesRes] = await Promise.allSettled([getAllAircraft(), getAllAirlines()]);
        if (aircraftRes.status === 'fulfilled') aircraft.value = aircraftRes.value.result;
        if (airlinesRes.status === 'fulfilled') airlines.value = airlinesRes.value.result.filter(a => a.isActive);
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to load data.';
    } finally {
        isLoading.value = false;
    }
}

function getAirlineName(airlineId) {
    const airline = airlines.value.find(a => a._id === airlineId);
    return airline ? airline.name : 'Unknown';
}

async function handleCreate() {
    errorMessage.value = ''; successMessage.value = '';
    if (!form.value.airlineId) { errorMessage.value = 'Please select an airline.'; return; }
    if (!form.value.model.trim()) { errorMessage.value = 'Model is required.'; return; }
    if (!form.value.totalSeats || form.value.totalSeats < 150 || form.value.totalSeats > 250) {
        errorMessage.value = 'Total seats must be between 150 and 250.'; return;
    }
    try {
        isSubmitting.value = true;
        await createAircraft({ airlineId: form.value.airlineId, model: form.value.model, totalSeats: Number(form.value.totalSeats) });
        successMessage.value = 'Aircraft created successfully.';
        form.value = { airlineId: '', model: '', totalSeats: '' };
        showCreateForm.value = false;
        await loadData();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to create aircraft.';
    } finally {
        isSubmitting.value = false;
    }
}

function openEditModal(ac) {
    editForm.value = { id: ac._id, airlineId: ac.airlineId, model: ac.model, totalSeats: ac.totalSeats };
    showEditModal.value = true;
}

function closeEditModal() {
    showEditModal.value = false;
    editForm.value = { id: null, airlineId: '', model: '', totalSeats: '' };
}

async function handleEdit() {
    errorMessage.value = ''; successMessage.value = '';
    if (!editForm.value.airlineId) { errorMessage.value = 'Please select an airline.'; return; }
    if (!editForm.value.model.trim()) { errorMessage.value = 'Model is required.'; return; }
    if (!editForm.value.totalSeats || editForm.value.totalSeats < 150 || editForm.value.totalSeats > 250) {
        errorMessage.value = 'Total seats must be between 150 and 250.'; return;
    }
    try {
        isSubmitting.value = true;
        await updateAircraft(editForm.value.id, { airlineId: editForm.value.airlineId, model: editForm.value.model, totalSeats: Number(editForm.value.totalSeats) });
        successMessage.value = 'Aircraft updated successfully.';
        closeEditModal();
        await loadData();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to update aircraft.';
    } finally {
        isSubmitting.value = false;
    }
}

async function toggleStatus(ac) {
    errorMessage.value = ''; successMessage.value = '';
    try {
        ac.isActive ? await deactivateAircraft(ac._id) : await reactivateAircraft(ac._id);
        await loadData();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to update aircraft status.';
    }
}

onMounted(loadData);
</script>

<template>
    <div class="profile-section">

        <div class="ps-header">
            <h3>Aircraft</h3>
            <button class="btn-outline-gold" @click="showCreateForm = !showCreateForm">
                <i class="ti" :class="showCreateForm ? 'ti-x' : 'ti-plus'"></i>
                {{ showCreateForm ? 'Cancel' : 'New Aircraft' }}
            </button>
        </div>

        <div class="ps-body">

            <p v-if="successMessage" class="alert-msg alert-success">{{ successMessage }}</p>
            <p v-if="errorMessage" class="alert-msg alert-error">{{ errorMessage }}</p>

            <!-- Create Form -->
            <div v-if="showCreateForm" class="admin-form-panel">
                <p class="admin-form-eyebrow">New Aircraft</p>
                <form @submit.prevent="handleCreate">
                    <div class="admin-form-grid">
                        <div>
                            <label class="f-label">Airline</label>
                            <select v-model="form.airlineId" class="f-input">
                                <option value="" disabled>Select airline</option>
                                <option v-for="airline in airlines" :key="airline._id" :value="airline._id">{{ airline.name }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Model</label>
                            <input v-model="form.model" type="text" class="f-input" placeholder="e.g. Boeing 737" />
                        </div>
                        <div>
                            <label class="f-label">Total Seats <span style="text-transform:none; font-weight:400;">(150–250)</span></label>
                            <input v-model="form.totalSeats" type="number" class="f-input" min="150" max="250" placeholder="e.g. 180" />
                        </div>
                    </div>
                    <button type="submit" class="btn-gold-full" style="margin-top: 20px;" :disabled="isSubmitting">
                        {{ isSubmitting ? 'Saving…' : 'Save Aircraft' }}
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
                            <th>Airline</th>
                            <th>Model</th>
                            <th>Total Seats</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="aircraft.length === 0">
                            <td colspan="5" class="admin-empty-row">No aircraft found.</td>
                        </tr>
                        <tr v-for="ac in pagedItems" :key="ac._id">
                            <td>{{ getAirlineName(ac.airlineId) }}</td>
                            <td>{{ ac.model }}</td>
                            <td>{{ ac.totalSeats }}</td>
                            <td>
                                <span class="admin-badge" :class="ac.isActive ? 'badge-active' : 'badge-inactive'">
                                    {{ ac.isActive ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td class="admin-actions-cell">
                                <button class="btn-table-action" @click="openEditModal(ac)">
                                    <i class="ti ti-pencil"></i> Edit
                                </button>
                                <button class="btn-table-action" :class="ac.isActive ? 'btn-table-danger' : 'btn-table-success'" @click="toggleStatus(ac)">
                                    {{ ac.isActive ? 'Deactivate' : 'Reactivate' }}
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
                    <h4>Edit Aircraft</h4>
                    <button class="admin-modal-close" @click="closeEditModal"><i class="ti ti-x"></i></button>
                </div>
                <div class="admin-modal-body">
                    <div class="admin-form-stack">
                        <div>
                            <label class="f-label">Airline</label>
                            <select v-model="editForm.airlineId" class="f-input">
                                <option value="" disabled>Select airline</option>
                                <option v-for="airline in airlines" :key="airline._id" :value="airline._id">{{ airline.name }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Model</label>
                            <input v-model="editForm.model" type="text" class="f-input" placeholder="e.g. Boeing 737" />
                        </div>
                        <div>
                            <label class="f-label">Total Seats <span style="text-transform:none; font-weight:400;">(150–250)</span></label>
                            <input v-model="editForm.totalSeats" type="number" class="f-input" min="150" max="250" />
                        </div>
                    </div>
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