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
      <div class="container admin-layout">

        <!-- Sidebar stays fixed here; child pages swap in on the right -->
        <AdminSidebar />

        <!-- Child route renders here -->
        <div class="admin-main">
          <RouterView />
        </div>

      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── Admin layout: sidebar + main content side by side ── */
.admin-layout {
  display: flex;
  align-items: flex-start;
  gap: 32px;
  max-width: 1200px;
}

/* ── Sidebar theming — overrides Bootstrap classes so it matches the dark theme ── */
.admin-layout :deep(nav) {
  flex: 0 0 200px;
  min-width: 160px;
  background: transparent !important;
  border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
  min-height: unset;
  padding-right: 16px;
}

.admin-layout :deep(.nav-link) {
  color: rgba(255, 255, 255, 0.6);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: color 0.2s, background 0.2s;
  text-decoration: none;
  display: block;
}

.admin-layout :deep(.nav-link:hover),
.admin-layout :deep(.nav-link.router-link-active) {
  color: #fff;
  background: rgba(255, 255, 255, 0.07);
}

.admin-layout :deep(.nav-link.router-link-active) {
  color: var(--color-gold, #c9a84c);
}

.admin-layout :deep(hr) {
  border-color: rgba(255, 255, 255, 0.1);
  margin: 10px 0;
}

/* Logout button styled as a nav link */
.admin-layout :deep(.btn.btn-link.nav-link) {
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  color: rgba(220, 80, 80, 0.8);
  padding: 8px 12px;
}

.admin-layout :deep(.btn.btn-link.nav-link:hover) {
  color: #e05555;
  background: rgba(220, 80, 80, 0.08);
}

/* ── Main content area ── */
.admin-main {
  flex: 1;
  min-width: 0;
}

/* ── Responsive: sidebar collapses above the content on small screens ── */
@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
    gap: 24px;
  }

  .admin-layout :deep(nav) {
    flex: unset;
    width: 100%;
    border-right: none !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
    padding-right: 0;
    padding-bottom: 16px;
  }

  .admin-layout :deep(.nav.flex-column) {
    flex-direction: row !important;
    flex-wrap: wrap;
    gap: 4px;
  }

  .admin-layout :deep(hr) {
    display: none;
  }
}
</style>