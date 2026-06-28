<script setup>
import { ref, onMounted } from 'vue';
import { getAllAirports, createAirport, deactivateAirport, reactivateAirport } from '../../api.js';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const airports = ref([]);
const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(airports);
const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);
const isSubmitting = ref(false);
const showCreateForm = ref(false);

const form = ref({ name: '', iataCode: '', city: '', country: '' });

async function loadAirports() {
    try {
        isLoading.value = true;
        const res = await getAllAirports();
        airports.value = res.result;
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to load airports.';
    } finally {
        isLoading.value = false;
    }
}

async function handleCreate() {
    errorMessage.value = ''; successMessage.value = '';
    if (!form.value.name.trim()) { errorMessage.value = 'Name is required.'; return; }
    if (!form.value.iataCode.trim() || form.value.iataCode.length !== 3) { errorMessage.value = 'IATA code must be 3 letters.'; return; }
    if (!form.value.city.trim()) { errorMessage.value = 'City is required.'; return; }
    if (!form.value.country.trim()) { errorMessage.value = 'Country is required.'; return; }
    try {
        isSubmitting.value = true;
        await createAirport({ name: form.value.name, iataCode: form.value.iataCode, city: form.value.city, country: form.value.country });
        successMessage.value = 'Airport created successfully.';
        form.value = { name: '', iataCode: '', city: '', country: '' };
        showCreateForm.value = false;
        await loadAirports();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to create airport.';
    } finally {
        isSubmitting.value = false;
    }
}

async function toggleStatus(airport) {
    errorMessage.value = ''; successMessage.value = '';
    try {
        airport.isActive ? await deactivateAirport(airport._id) : await reactivateAirport(airport._id);
        await loadAirports();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to update airport status.';
    }
}

onMounted(loadAirports);
</script>

<template>
    <div class="profile-section">

        <div class="ps-header">
            <h3>Airports</h3>
            <button class="btn-outline-gold" @click="showCreateForm = !showCreateForm">
                <i class="ti" :class="showCreateForm ? 'ti-x' : 'ti-plus'"></i>
                {{ showCreateForm ? 'Cancel' : 'New Airport' }}
            </button>
        </div>

        <div class="ps-body">

            <p v-if="successMessage" class="alert-msg alert-success">{{ successMessage }}</p>
            <p v-if="errorMessage" class="alert-msg alert-error">{{ errorMessage }}</p>

            <!-- Create Form -->
            <div v-if="showCreateForm" class="admin-form-panel">
                <p class="admin-form-eyebrow">New Airport</p>
                <form @submit.prevent="handleCreate">
                    <div class="admin-form-grid">
                        <div class="col-span-2">
                            <label class="f-label">Airport Name</label>
                            <input v-model="form.name" type="text" class="f-input" placeholder="e.g. Ninoy Aquino International Airport" />
                        </div>
                        <div>
                            <label class="f-label">IATA Code</label>
                            <input v-model="form.iataCode" type="text" class="f-input" placeholder="e.g. MNL" maxlength="3" />
                        </div>
                        <div>
                            <label class="f-label">City</label>
                            <input v-model="form.city" type="text" class="f-input" placeholder="e.g. Manila" />
                        </div>
                        <div class="col-span-2">
                            <label class="f-label">Country</label>
                            <input v-model="form.country" type="text" class="f-input" placeholder="e.g. Philippines" />
                        </div>
                    </div>
                    <button type="submit" class="btn-gold-full" style="margin-top: 20px;" :disabled="isSubmitting">
                        {{ isSubmitting ? 'Saving…' : 'Save Airport' }}
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
                            <th>Name</th>
                            <th>IATA</th>
                            <th>City</th>
                            <th>Country</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="airports.length === 0">
                            <td colspan="6" class="admin-empty-row">No airports found.</td>
                        </tr>
                        <tr v-for="airport in pagedItems" :key="airport._id">
                            <td>{{ airport.name }}</td>
                            <td><span class="admin-badge badge-muted">{{ airport.iataCode }}</span></td>
                            <td>{{ airport.city }}</td>
                            <td>{{ airport.country }}</td>
                            <td>
                                <span class="admin-badge" :class="airport.isActive ? 'badge-active' : 'badge-inactive'">
                                    {{ airport.isActive ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td class="admin-actions-cell">
                                <button class="btn-table-action" :class="airport.isActive ? 'btn-table-danger' : 'btn-table-success'" @click="toggleStatus(airport)">
                                    {{ airport.isActive ? 'Deactivate' : 'Reactivate' }}
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