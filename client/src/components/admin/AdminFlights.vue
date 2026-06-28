<script setup>
import { ref, onMounted } from 'vue';
import { getAllFlights, createFlight, updateFlight, deactivateFlight, reactivateFlight, getAllAirlines, getAllAircraft, getAllAirports } from '../../api.js';
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const flights = ref([]);
const airlines = ref([]);
const aircraft = ref([]);
const airports = ref([]);
const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(flights);

const errorMessage = ref('');
const successMessage = ref('');
const isLoading = ref(false);
const isSubmitting = ref(false);
const showCreateForm = ref(false);
const showEditModal = ref(false);

const emptyForm = () => ({ airlineId:'', aircraftId:'', originAirportId:'', destinationAirportId:'', flightNumber:'', departureTime:'', arrivalTime:'', basePrice:'', businessPrice:'', originTerminal:'', destinationTerminal:'' });

const form = ref(emptyForm());
const editForm = ref({ id: null, ...emptyForm(), status: '' });

const statusOptions = ['scheduled', 'delayed', 'on-time', 'cancelled', 'departed', 'arrived'];

function formatToPHTPayload(dt) { return dt ? `${dt}:00+08:00` : null; }

function convertToPHTInputString(dt) {
    if (!dt) return '';
    const date = new Date(dt);
    const datePart = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const timePart = date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
    return `${datePart}T${timePart}`;
}

function formatDateTime(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function calcTravelTime(departure, arrival) {
    if (!departure || !arrival) return '—';
    const diff = new Date(arrival) - new Date(departure);
    if (diff <= 0) return '—';
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}

function getLabel(list, id, field = 'name') {
    const found = list?.find(i => String(i._id) === String(id));
    return found ? found[field] : '—';
}

function getAirportCode(id) {
    const found = airports.value?.find(i => String(i._id) === String(id));
    return found ? found.iataCode : '—';
}

function flightStatusBadge(status) {
    const map = { scheduled:'badge-scheduled', delayed:'badge-delayed', 'on-time':'badge-on-time', cancelled:'badge-cancelled', departed:'badge-departed', arrived:'badge-arrived' };
    return map[status] || 'badge-muted';
}

async function loadData() {
    try {
        isLoading.value = true;
        const [flightsRes, airlinesRes, aircraftRes, airportsRes] = await Promise.allSettled([getAllFlights(), getAllAirlines(), getAllAircraft(), getAllAirports()]);
        if (flightsRes.status === 'fulfilled') flights.value = flightsRes.value.result || flightsRes.value.flights || [];
        if (airlinesRes.status === 'fulfilled') airlines.value = airlinesRes.value.result.filter(a => a.isActive);
        if (aircraftRes.status === 'fulfilled') aircraft.value = aircraftRes.value.result.filter(a => a.isActive);
        if (airportsRes.status === 'fulfilled') airports.value = airportsRes.value.result.filter(a => a.isActive);
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to load data.';
    } finally {
        isLoading.value = false;
    }
}

function validateForm(f) {
    if (!f.airlineId) return 'Please select an airline.';
    if (!f.aircraftId) return 'Please select an aircraft.';
    if (!f.originAirportId) return 'Please select an origin airport.';
    if (!f.destinationAirportId) return 'Please select a destination airport.';
    if (f.originAirportId === f.destinationAirportId) return 'Origin and destination airports cannot be the same.';
    if (!f.flightNumber.trim()) return 'Flight number is required.';
    if (!f.departureTime) return 'Departure time is required.';
    if (!f.arrivalTime) return 'Arrival time is required.';
    if (new Date(formatToPHTPayload(f.arrivalTime)) <= new Date(formatToPHTPayload(f.departureTime))) return 'Arrival must be after departure.';
    if (!f.basePrice || f.basePrice <= 0) return 'Economy price must be a positive number.';
    if (!f.businessPrice || f.businessPrice <= 0) return 'Business price must be a positive number.';
    if (Number(f.businessPrice) <= Number(f.basePrice)) return 'Business price must be greater than economy price.';
    return null;
}

async function handleCreate() {
    errorMessage.value = ''; successMessage.value = '';
    const err = validateForm(form.value);
    if (err) { errorMessage.value = err; return; }
    try {
        isSubmitting.value = true;
        await createFlight({ airlineId:form.value.airlineId, aircraftId:form.value.aircraftId, originAirportId:form.value.originAirportId, destinationAirportId:form.value.destinationAirportId, flightNumber:form.value.flightNumber, departureTime:formatToPHTPayload(form.value.departureTime), arrivalTime:formatToPHTPayload(form.value.arrivalTime), basePrice:Number(form.value.basePrice), businessPrice:Number(form.value.businessPrice), originTerminal:form.value.originTerminal||null, destinationTerminal:form.value.destinationTerminal||null });
        successMessage.value = 'Flight created successfully.';
        form.value = emptyForm();
        showCreateForm.value = false;
        await loadData();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to create flight.';
    } finally {
        isSubmitting.value = false;
    }
}

function openEditModal(flight) {
    editForm.value = { id:flight._id, airlineId:flight.airlineId, aircraftId:flight.aircraftId, originAirportId:flight.originAirportId, destinationAirportId:flight.destinationAirportId, flightNumber:flight.flightNumber, departureTime:convertToPHTInputString(flight.departureTime), arrivalTime:convertToPHTInputString(flight.arrivalTime), basePrice:flight.basePrice, businessPrice:flight.businessPrice, originTerminal:flight.originTerminal||'', destinationTerminal:flight.destinationTerminal||'', status:flight.status };
    showEditModal.value = true;
}

function closeEditModal() { showEditModal.value = false; editForm.value = { id:null, ...emptyForm(), status:'' }; }

async function handleEdit() {
    errorMessage.value = ''; successMessage.value = '';
    const err = validateForm(editForm.value);
    if (err) { errorMessage.value = err; return; }
    try {
        isSubmitting.value = true;
        await updateFlight(editForm.value.id, { airlineId:editForm.value.airlineId, aircraftId:editForm.value.aircraftId, originAirportId:editForm.value.originAirportId, destinationAirportId:editForm.value.destinationAirportId, flightNumber:editForm.value.flightNumber, departureTime:formatToPHTPayload(editForm.value.departureTime), arrivalTime:formatToPHTPayload(editForm.value.arrivalTime), basePrice:Number(editForm.value.basePrice), businessPrice:Number(editForm.value.businessPrice), originTerminal:editForm.value.originTerminal||null, destinationTerminal:editForm.value.destinationTerminal||null, status:editForm.value.status });
        successMessage.value = 'Flight updated successfully.';
        closeEditModal();
        await loadData();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to update flight.';
    } finally {
        isSubmitting.value = false;
    }
}

async function toggleStatus(flight) {
    errorMessage.value = ''; successMessage.value = '';
    try {
        flight.isActive ? await deactivateFlight(flight._id) : await reactivateFlight(flight._id);
        await loadData();
    } catch (err) {
        errorMessage.value = err.response?.data?.message || 'Failed to update flight status.';
    }
}

onMounted(loadData);
</script>

<template>
    <div class="profile-section">

        <div class="ps-header">
            <h3>Flights</h3>
            <button class="btn-outline-gold" @click="showCreateForm = !showCreateForm">
                <i class="ti" :class="showCreateForm ? 'ti-x' : 'ti-plus'"></i>
                {{ showCreateForm ? 'Cancel' : 'Create Flight' }}
            </button>
        </div>

        <div class="ps-body">

            <p v-if="successMessage" class="alert-msg alert-success">{{ successMessage }}</p>
            <p v-if="errorMessage" class="alert-msg alert-error">{{ errorMessage }}</p>

            <!-- Create Form -->
            <div v-if="showCreateForm" class="admin-form-panel">
                <p class="admin-form-eyebrow">New Flight</p>
                <form @submit.prevent="handleCreate">
                    <div class="admin-form-grid admin-form-grid-3">
                        <div>
                            <label class="f-label">Airline</label>
                            <select v-model="form.airlineId" class="f-input">
                                <option value="" disabled>Select airline</option>
                                <option v-for="a in airlines" :key="a._id" :value="a._id">{{ a.name }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Aircraft</label>
                            <select v-model="form.aircraftId" class="f-input">
                                <option value="" disabled>Select aircraft</option>
                                <option v-for="a in aircraft" :key="a._id" :value="a._id">{{ a.model }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Flight Number</label>
                            <input v-model="form.flightNumber" type="text" class="f-input" placeholder="e.g. JL782" />
                        </div>
                        <div>
                            <label class="f-label">Origin Airport</label>
                            <select v-model="form.originAirportId" class="f-input">
                                <option value="" disabled>Select origin</option>
                                <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.iataCode }} — {{ a.city }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Destination Airport</label>
                            <select v-model="form.destinationAirportId" class="f-input">
                                <option value="" disabled>Select destination</option>
                                <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.iataCode }} — {{ a.city }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Origin Terminal <span style="text-transform:none; font-weight:400;">(optional)</span></label>
                            <input v-model="form.originTerminal" type="text" class="f-input" placeholder="e.g. T1" />
                        </div>
                        <div>
                            <label class="f-label">Destination Terminal <span style="text-transform:none; font-weight:400;">(optional)</span></label>
                            <input v-model="form.destinationTerminal" type="text" class="f-input" placeholder="e.g. T3" />
                        </div>
                        <div>
                            <label class="f-label">Departure Time</label>
                            <input v-model="form.departureTime" type="datetime-local" class="f-input" />
                            <p v-if="form.departureTime" class="pht-preview">PHT: {{ formatDateTime(formatToPHTPayload(form.departureTime)) }}</p>
                        </div>
                        <div>
                            <label class="f-label">Arrival Time</label>
                            <input v-model="form.arrivalTime" type="datetime-local" class="f-input" />
                            <p v-if="form.arrivalTime" class="pht-preview">PHT: {{ formatDateTime(formatToPHTPayload(form.arrivalTime)) }}</p>
                        </div>
                        <div>
                            <label class="f-label">Economy Price (₱)</label>
                            <input v-model="form.basePrice" type="number" class="f-input" min="1" placeholder="e.g. 5000" />
                        </div>
                        <div>
                            <label class="f-label">Business Price (₱)</label>
                            <input v-model="form.businessPrice" type="number" class="f-input" min="1" placeholder="e.g. 10000" />
                        </div>
                    </div>
                    <button type="submit" class="btn-gold-full" style="margin-top:20px;" :disabled="isSubmitting">
                        {{ isSubmitting ? 'Saving…' : 'Save Flight' }}
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
                            <th>Flight No.</th>
                            <th>Airline</th>
                            <th>Route</th>
                            <th>Departure</th>
                            <th>Travel Time</th>
                            <th>Economy</th>
                            <th>Business</th>
                            <th>Status</th>
                            <th>Active</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="flights.length === 0">
                            <td colspan="10" class="admin-empty-row">No flights found.</td>
                        </tr>
                        <tr v-for="flight in pagedItems" :key="flight._id">
                            <td><strong>{{ flight.flightNumber }}</strong></td>
                            <td>{{ getLabel(airlines, flight.airlineId) }}</td>
                            <td>
                                <span class="route-display">
                                    {{ getAirportCode(flight.originAirportId) }}
                                    <i class="ti ti-arrow-right route-arrow"></i>
                                    {{ getAirportCode(flight.destinationAirportId) }}
                                </span>
                            </td>
                            <td style="white-space:nowrap;">{{ formatDateTime(flight.departureTime) }}</td>
                            <td>{{ calcTravelTime(flight.departureTime, flight.arrivalTime) }}</td>
                            <td>₱{{ flight.basePrice.toLocaleString() }}</td>
                            <td>₱{{ flight.businessPrice.toLocaleString() }}</td>
                            <td>
                                <span class="admin-badge" :class="flightStatusBadge(flight.status)">{{ flight.status }}</span>
                            </td>
                            <td>
                                <span class="admin-badge" :class="flight.isActive ? 'badge-active' : 'badge-inactive'">
                                    {{ flight.isActive ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td class="admin-actions-cell">
                                <button class="btn-table-action" @click="openEditModal(flight)"><i class="ti ti-pencil"></i> Edit</button>
                                <button class="btn-table-action" :class="flight.isActive ? 'btn-table-danger' : 'btn-table-success'" @click="toggleStatus(flight)">
                                    {{ flight.isActive ? 'Deactivate' : 'Reactivate' }}
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
            <div class="admin-modal admin-modal-lg">
                <div class="admin-modal-header">
                    <h4>Edit Flight</h4>
                    <button class="admin-modal-close" @click="closeEditModal"><i class="ti ti-x"></i></button>
                </div>
                <div class="admin-modal-body">
                    <div class="admin-form-grid admin-form-grid-3">
                        <div>
                            <label class="f-label">Airline</label>
                            <select v-model="editForm.airlineId" class="f-input">
                                <option value="" disabled>Select airline</option>
                                <option v-for="a in airlines" :key="a._id" :value="a._id">{{ a.name }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Aircraft</label>
                            <select v-model="editForm.aircraftId" class="f-input">
                                <option value="" disabled>Select aircraft</option>
                                <option v-for="a in aircraft" :key="a._id" :value="a._id">{{ a.model }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Flight Number</label>
                            <input v-model="editForm.flightNumber" type="text" class="f-input" />
                        </div>
                        <div>
                            <label class="f-label">Origin Airport</label>
                            <select v-model="editForm.originAirportId" class="f-input">
                                <option value="" disabled>Select origin</option>
                                <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.iataCode }} — {{ a.city }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Destination Airport</label>
                            <select v-model="editForm.destinationAirportId" class="f-input">
                                <option value="" disabled>Select destination</option>
                                <option v-for="a in airports" :key="a._id" :value="a._id">{{ a.iataCode }} — {{ a.city }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Status</label>
                            <select v-model="editForm.status" class="f-input">
                                <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="f-label">Origin Terminal</label>
                            <input v-model="editForm.originTerminal" type="text" class="f-input" placeholder="e.g. T1" />
                        </div>
                        <div>
                            <label class="f-label">Destination Terminal</label>
                            <input v-model="editForm.destinationTerminal" type="text" class="f-input" placeholder="e.g. T3" />
                        </div>
                        <div><!-- spacer --></div>
                        <div>
                            <label class="f-label">Departure Time</label>
                            <input v-model="editForm.departureTime" type="datetime-local" class="f-input" />
                            <p v-if="editForm.departureTime" class="pht-preview">PHT: {{ formatDateTime(formatToPHTPayload(editForm.departureTime)) }}</p>
                        </div>
                        <div>
                            <label class="f-label">Arrival Time</label>
                            <input v-model="editForm.arrivalTime" type="datetime-local" class="f-input" />
                            <p v-if="editForm.arrivalTime" class="pht-preview">PHT: {{ formatDateTime(formatToPHTPayload(editForm.arrivalTime)) }}</p>
                        </div>
                        <div><!-- spacer --></div>
                        <div>
                            <label class="f-label">Economy Price (₱)</label>
                            <input v-model="editForm.basePrice" type="number" min="1" class="f-input" />
                        </div>
                        <div>
                            <label class="f-label">Business Price (₱)</label>
                            <input v-model="editForm.businessPrice" type="number" min="1" class="f-input" />
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

.admin-form-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
@media (max-width: 768px) { .admin-form-grid-3 { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .admin-form-grid-3 { grid-template-columns: 1fr; } }

.pht-preview {
  font-family: var(--font-sans);
  font-size: 0.66rem;
  color: var(--success);
  font-weight: 700;
  margin: 5px 0 0;
}

.route-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: var(--text);
  font-size: 0.85rem;
}
.route-arrow { color: var(--gold); font-size: 0.8rem; }
</style>