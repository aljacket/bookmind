<script setup lang="ts">
    import { useAuthStore } from '@/stores/auth'

    const authStore = useAuthStore()
</script>

<template>
    <div id="app">
        <router-view v-slot="{ Component, route }">
            <Transition name="page" mode="out-in">
                <component :is="Component" :key="route.path" />
            </Transition>
        </router-view>
    </div>
</template>

<style>
    .page-enter-active,
    .page-leave-active {
        transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .page-enter-from {
        opacity: 0;
        transform: translateY(8px);
    }
    .page-leave-to {
        opacity: 0;
        transform: translateY(-4px);
    }
</style>
