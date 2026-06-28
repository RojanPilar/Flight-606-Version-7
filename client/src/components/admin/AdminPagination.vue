<script setup>
import { defineEmits } from 'vue';


const props = defineProps({
  currentPage: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  pageNumbers: { type: Array, required: true },
});

const emit = defineEmits(['go-to-page', 'first-page', 'last-page', 'prev-page', 'next-page']);

const firstPage = () => emit('go-to-page', 1);
const lastPage = () => emit('go-to-page', props.totalPages);
const prevPage = () => emit('go-to-page', Math.max(1, props.currentPage - 1));
const nextPage = () => emit('go-to-page', Math.min(props.totalPages, props.currentPage + 1));
</script>

<template>
  <div class="admin-pagination" v-if="totalPages > 1">
    <button
      class="pagination-btn icon-btn"
      :disabled="currentPage === 1"
      @click="firstPage"
      title="First Page"
    >
      «
    </button>
    <button
      class="pagination-btn icon-btn"
      :disabled="currentPage === 1"
      @click="prevPage"
      title="Previous Page"
    >
      ‹
    </button>

    <template v-for="(page, index) in pageNumbers" :key="index">
      <span
        v-if="page === 'left-ellipsis' || page === 'right-ellipsis'"
        class="pagination-ellipsis"
      >
        …
      </span>
      <button
        v-else
        class="pagination-btn page-number"
        :class="{ active: page === currentPage }"
        @click="$emit('go-to-page', page)"
      >
        {{ page }}
      </button>
    </template>

    <button
      class="pagination-btn icon-btn"
      :disabled="currentPage === totalPages"
      @click="nextPage"
      title="Next Page"
    >
      ›
    </button>
    <button
      class="pagination-btn icon-btn"
      :disabled="currentPage === totalPages"
      @click="lastPage"
      title="Last Page"
    >
      »
    </button>
  </div>
</template>

<style scoped>
.admin-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 0;
  margin-top: 1.5rem;
  border-top: 1px solid var(--border);
  background-color: var(--bg-60);
  transition: var(--theme-transition); /* Ensures smooth shifting on theme toggle */
}

.pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px; /* Crisp, luxurious corners */
  background-color: var(--dark-3); /* Dark surface in dark mode / subtle light surface in light mode */
  color: var(--text);
  font-family: var(--font-serif);
  font-size: 0.85rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  transition: var(--theme-transition), transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.pagination-btn:hover:not(:disabled) {
  border-color: var(--gold);
  background-color: var(--dark-4); /* Controlled hover contrast elevate */
  color: var(--gold);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px var(--gold-dim); /* Adapts perfectly to safe light/dark gold opacity */
}

.pagination-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 5px var(--accent-30-gls);
}

.pagination-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background-color: var(--bg-60-mid);
  border-color: var(--border-dim);
  color: var(--muted);
}

.pagination-btn.active {
  background-color: var(--gold);
  border-color: var(--gold);
  color: var(--bg-60); /* Inverts text cleanly (Black text in dark mode / White text in light mode) */
  font-weight: 700;
  box-shadow: 0 4px 20px var(--gold-dim);
}

.pagination-btn.active:hover {
  background-color: var(--gold-light); /* Uses alternating gold to accent clickability */
  border-color: var(--gold-light);
  color: var(--bg-60);
}

.icon-btn {
  font-size: 1.1rem;
  font-weight: 300;
  line-height: 1;
}

.pagination-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 1rem;
  letter-spacing: 2px;
}

</style>
