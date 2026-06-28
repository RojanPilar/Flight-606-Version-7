<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' }, // YYYY-MM-DD
  placeholder: { type: String, default: 'Select date…' },
  alignRight: { type: Boolean, default: false },
  minDate: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

// ── State ──────────────────────────────────────────
const isOpen    = ref(false)
const todayDate = new Date()
todayDate.setHours(0, 0, 0, 0)

const viewYear  = ref(todayDate.getFullYear())
const viewMonth = ref(todayDate.getMonth())

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

// ── Display label ──────────────────────────────────
const displayLabel = computed(() => {
  if (!props.modelValue) return ''
  const [y, m, d] = props.modelValue.split('-').map(Number)
  return `${MONTHS[m - 1].slice(0, 3)} ${String(d).padStart(2,'0')}, ${y}`
})

// ── Calendar grid ──────────────────────────────────
const monthLabel = computed(() => `${MONTHS[viewMonth.value]} ${viewYear.value}`)

const calDays = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstDay = new Date(y, m, 1).getDay()
  const totalDays = new Date(y, m + 1, 0).getDate()
  const days = []

  for (let i = 0; i < firstDay; i++) days.push({ empty: true })

  for (let d = 1; d <= totalDays; d++) {
    const dt  = new Date(y, m, d)
    dt.setHours(0,0,0,0)
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`

    const isSelected = props.modelValue === key
    const isToday    = dt.getTime() === todayDate.getTime()
    const isPast     = dt < todayDate
    const isBelowMin = props.minDate && key < props.minDate
    const disabled   = isPast || isBelowMin

    days.push({ d, key, isSelected, isToday, disabled, empty: false })
  }
  return days
})

// ── Methods ────────────────────────────────────────
function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}

function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

function pickDay(day) {
  if (day.disabled || day.empty) return
  emit('update:modelValue', day.key)
  // Auto-dismiss after selection
  setTimeout(() => { isOpen.value = false }, 160)
}

function clearDate() {
  emit('update:modelValue', '')
}

function toggle() {
  isOpen.value = !isOpen.value
}

// When navigating months, keep open — don't auto-close
// (only pickDay closes it)
</script>

<template>
  <div class="cal-wrapper">
    <!-- Trigger row -->
    <div style="display:flex; align-items:center; gap:6px;">
      <button
        class="date-btn"
        :class="{ empty: !modelValue }"
        @click="toggle"
        type="button"
      >
        {{ displayLabel || placeholder }}
      </button>
      <button
        v-if="modelValue"
        class="date-clear vis"
        @click.stop="clearDate"
        type="button"
      >✕</button>
    </div>

    <!-- Popup — fixed z-index, absolute positioning -->
    <div
      v-if="isOpen"
      class="cal-popup open"
      :class="{ right: alignRight }"
      style="position:absolute; z-index:9999; top:calc(100% + 8px); left:0;"
    >
      <!-- Month nav -->
      <div class="cal-nav">
        <button @click.stop="prevMonth" type="button" aria-label="Previous month">&#8249;</button>
        <span class="cal-month-lbl">{{ monthLabel }}</span>
        <button @click.stop="nextMonth" type="button" aria-label="Next month">&#8250;</button>
      </div>

      <!-- Day grid -->
      <div class="cal-grid">
        <div v-for="day in DAYS" :key="day" class="cal-dow">{{ day }}</div>

        <template v-for="(cell, idx) in calDays" :key="idx">
          <div v-if="cell.empty" class="cal-day empty"></div>
          <button
            v-else
            class="cal-day"
            :class="{
              selected:  cell.isSelected,
              today:     cell.isToday && !cell.isSelected,
              disabled:  cell.disabled
            }"
            @click.stop="pickDay(cell)"
            type="button"
          >{{ cell.d }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal-wrapper {
  position: relative;
}

/* Selected day — black text on gold, same in both themes
   (black has strong contrast against gold in dark AND light
   mode; --ink-on-gold never flips, unlike --dark/--text-10) */
.cal-day.selected {
  background: var(--gold) !important;
  color: var(--ink-on-gold) !important;
  font-weight: 700;
}

/* Unselected days use --text so they're never invisible */
.cal-day:not(.selected):not(.disabled):not(.empty) {
  color: var(--text);
}
</style>