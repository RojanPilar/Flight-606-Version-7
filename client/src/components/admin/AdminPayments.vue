<script setup>
import { ref, onMounted } from 'vue';
import { getAllPayments, updatePaymentStatus } from '../../api.js'; // Adjust path if needed
import AdminPagination from './AdminPagination.vue';
import { usePagination } from './pagination.js';

const payments = ref([]);
const { currentPage, totalPages, pagedItems, pageNumbers, goToPage } = usePagination(payments);
const isLoading = ref(true);
const pageError = ref(null);
const successMessage = ref(null);

// Modal state
const selectedPayment = ref(null);
const newStatus = ref('');
const isUpdating = ref(false);

const statusOptions = [
    { value: 'pending', label: 'Pending', icon: 'ti-hourglass' },
    { value: 'paid', label: 'Paid', icon: 'ti-circle-check' },
    { value: 'failed', label: 'Failed', icon: 'ti-circle-x' },
    { value: 'refunded', label: 'Refunded', icon: 'ti-receipt-refund' },
];

const fetchPayments = async () => {
    isLoading.value = true;
    pageError.value = null;
    try {
        const data = await getAllPayments();
        // The backend returns { message, payments: [...] }
        payments.value = data.payments;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            payments.value = [];
        } else {
            pageError.value = error.response?.data?.message || "Failed to load payments.";
        }
    } finally {
        isLoading.value = false;
    }
};

const openStatusModal = (payment) => {
    selectedPayment.value = payment;
    newStatus.value = payment.status;
    // Clear previous alerts
    pageError.value = null;
    successMessage.value = null;
};

const closeStatusModal = () => {
    selectedPayment.value = null;
    newStatus.value = '';
};

const submitStatusUpdate = async () => {
    if (!selectedPayment.value || !newStatus.value) return;

    // Prevent unnecessary API calls if the status hasn't actually changed
    if (newStatus.value === selectedPayment.value.status) {
        closeStatusModal();
        return;
    }

    isUpdating.value = true;
    pageError.value = null;

    try {
        await updatePaymentStatus(selectedPayment.value._id, { status: newStatus.value });
        successMessage.value = `Payment ${selectedPayment.value.transactionId} successfully updated to '${newStatus.value}'.`;

        closeStatusModal();

        // Refresh the list to reflect the new data
        await fetchPayments();
    } catch (error) {
        pageError.value = error.response?.data?.message || "Failed to update payment status.";
        // Hide modal so user can see the error on the main screen
        closeStatusModal();
    } finally {
        isUpdating.value = false;
    }
};

// UI Helper Functions
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'Php' }).format(amount);
};

const getStatusBadgeClass = (status) => {
    const badges = {
        paid: 'badge-active',
        pending: 'badge-warning',
        failed: 'badge-inactive',
        refunded: 'badge-muted'
    };
    return badges[status] || 'badge-muted';
};

onMounted(() => {
    fetchPayments();
});
</script>

<template>
  <div class="profile-section">

    <div class="ps-header">
      <h3><i class="ti ti-credit-card"></i> Payment Management</h3>
      <button @click="fetchPayments" class="btn-refresh" :disabled="isLoading">
        <i class="ti ti-refresh"></i> Refresh
      </button>
    </div>

    <div class="ps-body">

      <p v-if="pageError" class="alert-msg alert-error">{{ pageError }}</p>
      <p v-if="successMessage" class="alert-msg alert-success">{{ successMessage }}</p>

      <div v-if="isLoading" class="admin-loading">
        <i class="ti ti-loader-2 admin-spinner"></i> Loading payments…
      </div>

      <div v-else-if="payments.length === 0" class="admin-empty-state">
        <i class="ti ti-receipt-off"></i>
        <p>There are currently no transactions in the system.</p>
      </div>

      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Date</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in pagedItems" :key="payment._id">
              <td>
                {{ payment.transactionId }}
                <span class="cell-sub" title="Booking ID"><i class="ti ti-link"></i> {{ payment.bookingId }}</span>
              </td>
              <td class="muted">{{ new Date(payment.createdAt).toLocaleString() }}</td>
              <td class="muted capitalize">{{ payment.paymentMethod }}</td>
              <td>{{ formatCurrency(payment.amount) }}</td>
              <td>
                <span class="admin-badge" :class="getStatusBadgeClass(payment.status)">
                  {{ payment.status }}
                </span>
              </td>
              <td>
                <button @click="openStatusModal(payment)" class="btn-table-action">
                  <i class="ti ti-edit"></i> Update Status
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

    <!-- Update Status Modal -->
    <div v-if="selectedPayment" class="admin-modal-overlay" @click.self="closeStatusModal">
      <div class="admin-modal">
        <div class="admin-modal-header">
          <h4><i class="ti ti-credit-card-pay"></i> Update Payment Status</h4>
          <button class="admin-modal-close" @click="closeStatusModal"><i class="ti ti-x"></i></button>
        </div>
        <div class="admin-modal-body">

          <div class="admin-message-box">
            <strong>Transaction:</strong> {{ selectedPayment.transactionId }}<br>
            <strong>Amount:</strong> {{ formatCurrency(selectedPayment.amount) }}
          </div>

          <label class="f-label">Select New Status</label>
          <div class="status-option-grid">
            <div
              v-for="opt in statusOptions"
              :key="opt.value"
              class="status-option-card"
              :class="{ selected: newStatus === opt.value }"
              @click="newStatus = opt.value"
            >
              <i class="ti" :class="opt.icon"></i>
              <span class="option-label">{{ opt.label }}</span>
            </div>
          </div>

          <p v-if="newStatus === 'paid' && selectedPayment.status !== 'paid'" class="admin-inline-note note-success">
            <i class="ti ti-info-circle"></i>
            Marking this as paid will automatically confirm the booking and dispatch an email notification to the user.
          </p>

        </div>
        <div class="admin-modal-footer">
          <button class="btn-refresh" @click="closeStatusModal">Cancel</button>
          <button
            class="btn-gold-full"
            :disabled="isUpdating || newStatus === selectedPayment.status"
            @click="submitStatusUpdate"
          >
            {{ isUpdating ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
@import './admin-shared.css';
</style>