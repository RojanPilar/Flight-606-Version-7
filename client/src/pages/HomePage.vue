<script setup>
import { useRouter } from 'vue-router'
import { onBeforeMount } from 'vue'
import { useGlobalStore } from '../stores/global.js'
import HeroSlider from '../components/HeroSlider.vue'

const store = useGlobalStore()
const router = useRouter()
function goToFlights() {
  router.push({ name: 'SearchFlights' })
}

onBeforeMount(() => {
  if (store.isAdmin) router.push({ path: '/admin-dashboard' })
})

</script>

<template>
  <div class="page active">

    <HeroSlider />

    <!-- Tour Plan -->
    <section id="tours" class="section-pad bg-dark-base">
      <div class="container">
        <p class="section-eyebrow">Curated Routes</p>
        <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-5">
          <h2 class="section-title">Tour <em>Plan</em></h2>
          <a href="#" class="view-all-link" @click.prevent="goToFlights">View All Routes &nbsp;→</a>
        </div>
        <div class="row g-3">
          <div class="col-6 col-lg-3">
            <div class="dest-card" @click="goToFlights">
              <img src="https://plus.unsplash.com/premium_photo-1661919210043-fd847a58522d?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Paris">
              <div class="dest-overlay">
                <span class="dest-tag">The City of Lights</span>
                <span class="dest-name">Paris</span>
              </div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="dest-card" @click="goToFlights">
              <img src="https://images.unsplash.com/photo-1590001155093-a3c66ab0c3ff?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D">
              <div class="dest-overlay">
                <span class="dest-tag">Ocean Sanctuary</span>
                <span class="dest-name">Maldives</span>
              </div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="dest-card" @click="goToFlights">
              <img src="https://images.unsplash.com/photo-1775990631111-ca4643f8f448?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Tokyo">
              <div class="dest-overlay">
                <span class="dest-tag"> Where Heritage Meets the Horizon</span>
                <span class="dest-name">Japan</span>
              </div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="dest-card" @click="goToFlights">
              <img src="https://images.unsplash.com/photo-1750493192599-95b66b78b5d3?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Manila">
              <div class="dest-overlay">
                <span class="dest-tag">It's More Fun Here</span>
                <span class="dest-name">Manila</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- About -->
    <section id="about" class="section-pad about-section">
      <div class="container">
        <div class="row align-items-center g-5">
          <div class="col-lg-6">
            <p class="section-eyebrow">Our Story</p>
            <h2 class="section-title">Time is your most<br>precious <em>commodity.</em></h2>
            <p class="body-text mt-4">We believe the journey should be as remarkable as the destination. Flight606 was founded on a singular principle: to return the romance, privacy, and absolute comfort to transcontinental travel.</p>
            <p class="body-text mt-3">From private terminal departures to bespoke culinary programs crafted by Michelin-starred chefs — every detail is engineered for those who demand nothing less than perfection.</p>
            <a href="#" class="btn-outline-gold mt-4 d-inline-block">Discover the Experience</a>
          </div>
          <div class="col-lg-6">
            <div class="about-visual">
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="section-pad testi-section">
      <div class="container">
        <p class="section-eyebrow text-center">Distinguished Guests</p>
        <h2 class="section-title text-center mb-5">Whispers of <em>Excellence</em></h2>
        <div class="row g-4">
          <div class="col-md-4">
            <div class="testi-card">
              <div class="testi-stars">★★★★★</div>
              <p class="testi-quote">"The only airline where I genuinely look forward to a 12-hour flight. The private suite and dining service rival the best hotels in the world."</p>
              <p class="testi-who">— Eleanor R., London</p>
            </div>
          </div>
          <div class="col-md-4">
            <div class="testi-card">
              <div class="testi-stars">★★★★★</div>
              <p class="testi-quote">"Flight606 has completely redefined business travel for me. Quiet, understated, and impeccably serviced. A masterclass in hospitality at altitude."</p>
              <p class="testi-who">— Marcus T., New York</p>
            </div>
          </div>
          <div class="col-md-4">
            <div class="testi-card">
              <div class="testi-stars">★★★★★</div>
              <p class="testi-quote">"From the chauffeur service to the arrivals lounge, it is a seamless cocoon of luxury. I simply refuse to fly any other way now."</p>
              <p class="testi-who">— Sophia C., Geneva</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>