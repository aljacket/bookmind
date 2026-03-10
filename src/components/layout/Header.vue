<!-- src/components/layout/Header.vue -->
<template>
    <header
        class="bg-white border-b border-ink-200 px-6 py-4 flex items-center justify-between"
    >
        <div class="w-6 mr-4">
            <router-link
                v-if="showBackButton"
                to="/"
                class="text-ink-500 hover:text-ink-800 transition-colors"
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
        <h1 class="text-xl font-serif font-semibold text-ink-800 tracking-wide">
            {{ title }}
        </h1>
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
