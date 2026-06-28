<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalStore } from '../stores/global.js'
import { getProfile, updateProfile, getMyPaymentsUser } from '../api.js'

const router = useRouter()
const globalStore = useGlobalStore()

const form = ref({ firstName: '', lastName: '', gender: '', phone: '' })
const email = ref('')
const memberSince = ref('')
const payments = ref([])

const loading = ref(true)
const saving = ref(false)
const saveMsg = ref('')
const errorMsg = ref('')

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function loadProfile() {
  try {
    const user = await getProfile() // getProfile returns the raw user doc, not wrapped
    form.value = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      gender: user.gender || '',
      phone: user.phone || ''
    }
    email.value = user.email || ''
    memberSince.value = user.createdAt || ''
  } catch (err) {
    errorMsg.value = 'Could not load your profile.'
  }
}

async function loadPayments() {
  try {
    const res = await getMyPaymentsUser()
    payments.value = res.payments || []
  } catch {
    payments.value = []
  }
}

onMounted(async () => {
  await Promise.all([loadProfile(), loadPayments()])
  loading.value = false
})

async function saveProfile() {
  saving.value = true
  saveMsg.value = ''
  errorMsg.value = ''
  try {
    await updateProfile({ ...form.value })
    saveMsg.value = 'Saved!'
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Could not save your changes.'
  } finally {
    saving.value = false
  }
}

function doLogout() {
  globalStore.getUserDetails(null)
  router.push({ name: 'Home' })
}
</script>
<template>
  <div class="page active">
    <div class="inner-page">
      <div class="pt-5">
        <div class="container">
          <div v-if="loading" class="text-center py-5"><span class="spinner-border text-warning"></span></div>

          <div v-else class="profile-layout">
            <div class="profile-sidebar">
              <div class="profile-avatar-wrap">
                <div class="profile-avatar"><i class="bi bi-person-circle"></i></div>
                <div class="profile-name-display">{{ form.firstName }} {{ form.lastName }}</div>
              </div>
              <nav class="profile-nav">
                <a href="#" class="active"><i class="bi bi-person"></i> Personal Details</a>
                <RouterLink :to="{ name: 'MyBookings' }"><i class="bi bi-wallet2"></i> My Bookings</RouterLink>
                <RouterLink :to="{ name: 'CheckIn' }"><i class="bi bi-qr-code-scan"></i> Check-in</RouterLink>
                <div class="pn-sep"></div>
                <a href="#" class="logout-nav" @click.prevent="doLogout"><i class="bi bi-box-arrow-right"></i> Log out</a>
              </nav>
            </div>
            <div class="profile-main">
              <div class="profile-section">
                <div class="ps-header"><h3>Personal Details</h3></div>
                <div class="ps-body">
                  <div class="row g-3">
                    <div class="col-md-6"><label class="f-label">First Name</label><input type="text" class="f-input" v-model="form.firstName"></div>
                    <div class="col-md-6"><label class="f-label">Last Name</label><input type="text" class="f-input" v-model="form.lastName"></div>
                    <div class="col-md-6">
                      <label class="f-label">Gender</label>
                      <select class="f-input" v-model="form.gender">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div class="col-md-6"><label class="f-label">Phone Number</label><input type="tel" class="f-input" v-model="form.phone" maxlength="11" @input="form.phone = form.phone.replace(/\D/g, '').slice(0, 11)"></div>
                  </div>
                  <p v-if="saveMsg" class="body-text mt-2" style="color:var(--success);">{{ saveMsg }}</p>
                  <p v-if="errorMsg" class="err-msg mt-2">{{ errorMsg }}</p>
                  <button class="btn-gold mt-3" :disabled="saving" @click="saveProfile">{{ saving ? 'Saving…' : 'Save' }}</button>
                </div>
              </div>
              <div class="profile-section">
                <div class="ps-header"><h3>Account Details</h3></div>
                <div class="ps-body">
                  <div class="ps-account-row"><span class="ps-account-label">Email</span><span>{{ email }}</span></div>
                  <div class="ps-account-row"><span class="ps-account-label">Member since</span><span>{{ formatDate(memberSince) }}</span></div>
                </div>
              </div>
              <div class="profile-section">
                <div class="ps-header"><h3>Payment History</h3></div>
                <div class="ps-body">
                  <div v-if="payments.length === 0" class="body-text">No payments on file yet.</div>
                  <div class="ps-account-row" v-for="p in payments" :key="p._id">
                    <span class="ps-account-label" style="text-transform:capitalize;">{{ p.paymentMethod?.replace('_', ' ') }} · {{ formatDate(p.createdAt) }}</span>
                    <span>₱{{ p.amount?.toLocaleString() }} <span :class="p.status === 'paid' ? 'fc-badge success' : 'fc-badge pending'" style="margin-left:8px;">{{ p.status }}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
