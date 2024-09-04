<!-- src/components/alert/WarningAlert.vue -->
<template>
    <div class="mb-4 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg shadow-md">
        <div class="flex items-center">
            <svg
                class="w-6 h-6 text-amber-400 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                ></path>
            </svg>
            <p class="font-semibold text-amber-700">Attenzione</p>
        </div>
        <p class="mt-2 text-sm text-amber-600">{{ message }}</p>
    </div>
</template>

<script setup lang="ts">
    defineProps<{
        message: string
    }>()
</script>
