<script setup>
import { computed } from 'vue'
import { useBookingStore } from '../stores/booking.js'

const bookingStore = useBookingStore()
const order = computed(() => bookingStore.lastOrder)
</script>

<template>
  <div class="page active">
    <div class="inner-page">
      <div class="success-page">

        <template v-if="order">
          <div class="success-icon">✓</div>
          <h1 class="success-title">Booking Confirmed!</h1>
          <p class="success-sub">Your payment of <strong>₱{{ order.totalPaid.toLocaleString() }}</strong> has been <strong>successfully processed</strong>.<br>
            Check <RouterLink :to="{ name: 'MyBookings' }" class="gold-link">My Bookings</RouterLink> any time to view your tickets.</p>

          <div class="confirm-section text-start mt-4" style="max-width:520px; margin-inline:auto;">
            <h3 class="confirm-section-title"><i class="bi bi-ticket-perforated"></i> Your Booking Reference(s)</h3>
            <div class="confirm-row" v-for="(b, i) in order.bookings" :key="i">
              <div class="confirm-pax">
                <div class="confirm-pax-icon"><i class="bi bi-person"></i></div>
                <div class="confirm-pax-name">{{ b.passengerName }} — {{ b.leg }}</div>
              </div>
              <div class="confirm-detail"><i class="bi bi-ui-checks-grid"></i><span>{{ b.seat }}</span></div>
              <div class="confirm-detail"><i class="bi bi-upc"></i><span style="font-family:monospace;">{{ b.bookingReference }}</span></div>
            </div>
          </div>

          <p class="success-note mt-3">We will notify you two days before departure to prepare.</p>
        </template>

        <template v-else>
          <div class="success-icon">✓</div>
          <h1 class="success-title">All set!</h1>
          <p class="success-sub">Your most recent booking details aren't available in this session anymore —
            check <RouterLink :to="{ name: 'MyBookings' }" class="gold-link">My Bookings</RouterLink> for your full booking history.</p>
        </template>

        <div class="success-plane"><i class="bi bi-airplane-fill"></i></div>
        <div class="success-actions">
          <RouterLink class="btn-gold-full" :to="{ name: 'Home' }">Back to Home</RouterLink>
          <RouterLink class="btn-gold-full" :to="{ name: 'MyBookings' }">View My Bookings</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
