<!-- src/components/layout/Header.vue -->
<template>
    <header
        class="bg-gradient-to-r from-bookmind-50 to-bookmind-100 text-bookmind-800 p-4 flex items-center justify-between"
    >
        <div class="w-6 mr-4">
            <router-link
                v-if="showBackButton"
                to="/"
                class="text-bookmind-600 hover:text-bookmind-800"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                </svg>
            </router-link>
        </div>
        <h1 class="text-2xl font-bold text-bookmind-700">{{ title }}</h1>
        <div class="w-6">
            <Menu />
        </div>
    </header>
</template>

<script setup lang="ts">
    import Menu from './Menu.vue'

    defineProps<{
        title: string
        showBackButton?: boolean
    }>()
</script>
