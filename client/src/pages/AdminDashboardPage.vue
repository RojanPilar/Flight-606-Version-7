<script setup>
import AdminSidebar from '../components/admin/AdminSidebar.vue'
</script>

<template>
  <div class="page inner-page active">

    <section class="inner-hero">
      <div class="container">
        <p class="hero-eyebrow">Admin</p>
        <h1 class="hero-title">Control <em>Panel</em></h1>
        <p class="hero-sub">Manage flights, passengers, bookings, and all operational data from one place.</p>
      </div>
    </section>

    <section class="section-pad bg-dark-base" style="padding-top: 56px; padding-bottom: 80px;">
      <div class="container">

        <!--
          .admin-layout and .admin-main are defined in admin-shared.css.
          AdminSidebar handles its own mobile drawer toggle internally.
          RouterView renders the active sub-page into .admin-main.
        -->
        <div class="admin-layout">
          <AdminSidebar />
          <main class="admin-main">
            <RouterView />
          </main>
        </div>

      </div>
    </section>

  </div>
</template>

<!--
  NO scoped layout styles here — admin-shared.css owns .admin-layout and .admin-main.
  Keeping this file free of layout overrides prevents specificity conflicts.
-->
<style scoped>
@import '../components/admin/admin-shared.css';

/* Page-level adjustments only — nothing that touches layout or sidebar */
.inner-hero {
  /* inherits from global styles */
}
</style>