<!-- src/components/alert/WarningAlert.vue -->
<template>
    <div class="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
        <p class="font-bold">Attenzione!</p>
        <p class="text-sm">{{ message }}</p>
    </div>
</template>

<script setup lang="ts">
    defineProps<{
        message: string
    }>()
</script>
