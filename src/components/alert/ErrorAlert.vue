<!-- src/components/alert/ErrorAlert.vue -->
<template>
    <div class="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg shadow-md">
        <div class="flex items-center">
            <svg
                class="w-6 h-6 text-red-400 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
            </svg>
            <p class="font-semibold text-red-700">{{ title }}</p>
        </div>
        <p class="mt-2 text-sm text-red-600">{{ message }}</p>
    </div>
</template>

<script setup lang="ts">
    defineProps<{
        title: string
        message: string
    }>()
</script>
