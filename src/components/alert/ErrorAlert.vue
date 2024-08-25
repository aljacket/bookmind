<!-- src/components/alert/ErrorAlert.vue -->
<template>
    <div class="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
        <p class="font-bold">{{ title }}</p>
        <p class="text-sm">{{ message }}</p>
    </div>
</template>

<script setup lang="ts">
    defineProps<{
        title: string
        message: string
    }>()
</script>
