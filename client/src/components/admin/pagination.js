import { ref, computed, watch } from 'vue';

export function usePagination(items, pageSize = 10) {
  const currentPage = ref(1);
  const pageSizeRef = ref(pageSize);

  const totalPages = computed(() => {
    return Math.max(1, Math.ceil(items.value.length / pageSizeRef.value));
  });

  const pagedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSizeRef.value;
    return items.value.slice(start, start + pageSizeRef.value);
  });

  const goToPage = (page) => {
    const clamped = Math.min(Math.max(page, 1), totalPages.value);
    currentPage.value = clamped;
  };

  const firstPage = () => goToPage(1);
  const lastPage = () => goToPage(totalPages.value);
  const prevPage = () => goToPage(currentPage.value - 1);
  const nextPage = () => goToPage(currentPage.value + 1);

  watch(items, () => {
    currentPage.value = 1;
  });

  watch(totalPages, (next) => {
    if (currentPage.value > next) {
      currentPage.value = next;
    }
  });

  const pageNumbers = computed(() => {
    const total = totalPages.value;
    const current = currentPage.value;
    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const pages = [];
    const left = Math.max(1, current - 2);
    const right = Math.min(total, current + 2);

    if (left > 1) {
      pages.push(1);
      if (left > 2) pages.push('left-ellipsis');
    }

    for (let i = left; i <= right; i += 1) {
      pages.push(i);
    }

    if (right < total) {
      if (right < total - 1) pages.push('right-ellipsis');
      pages.push(total);
    }

    return pages;
  });

  return {
    currentPage,
    pageSize: pageSizeRef,
    totalPages,
    pagedItems,
    pageNumbers,
    goToPage,
    firstPage,
    lastPage,
    prevPage,
    nextPage,
  };
}
