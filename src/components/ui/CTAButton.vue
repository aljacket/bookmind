<!-- src/components/ui/CTAButton.vue -->
<template>
    <button
        :type="type"
        class="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-bookmind-600 hover:bg-bookmind-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bookmind-500 transition-colors duration-300"
    >
        <slot></slot>
    </button>
</template>

<script setup lang="ts">
    defineProps<{
        type?: 'button' | 'submit' | 'reset'
    }>()
</script>
