<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import BookingWidget from './BookingWidget.vue'

const slides = [
  'https://images.unsplash.com/photo-1778785396727-1bef2246bd4e?q=100&w=1920&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1774600787142-cdd5611e49dc?q=100&w=1920&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1713116818886-f43d23f1ef73?q=100&w=1920&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
]

const current = ref(0)
let timer = null

function goSlide(i) {
  current.value = (i + slides.length) % slides.length
}
function next() { 
  goSlide(current.value + 1) 
}
function prev() { 
  goSlide(current.value - 1) 
}

function start() { 
  // FIX: Wrapped in an arrow function to guarantee Vue reactivity triggers every 5 seconds
  timer = setInterval(() => {
    next()
  }, 5000) 
}

function stop() { 
  clearInterval(timer) 
}

onMounted(() => { 
  goSlide(0)
  start() 
})
onUnmounted(stop)

</script>

<template>
  <section class="hero-section">
    <div class="hero-overlay"></div>
    <div
      class="hero-slider-bg"
      :style="{ backgroundImage: `url('${slides[current]}')` }"
    ></div>

    <div class="container hero-content">
      <p class="hero-eyebrow">Flight 606 &nbsp;·&nbsp; Luxury Redefined</p>
      <h1 class="hero-title">Paradise <em>Awaits</em><br>Your Arrival</h1>
      <p class="hero-sub">Discover untouched destinations in absolute comfort</p>

      <div class="hero-slider-nav">
        <button class="slider-arrow" @click="prev" aria-label="Previous slide">
          <i class="bi bi-arrow-left"></i>
        </button>
        <div class="slider-dots">
          <button
            v-for="(_, i) in slides"
            :key="i"
            class="dot"
            :class="{ active: i === current }"
            @click="goSlide(i)"
            :aria-label="`Slide ${i + 1}`"
          ></button>
        </div>
        <button class="slider-arrow" @click="next" aria-label="Next slide">
          <i class="bi bi-arrow-right"></i>
        </button>
      </div>

      <BookingWidget />
    </div>
  </section>
</template>