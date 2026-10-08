<script setup lang="ts">
    import { useAuthStore } from '@/stores/auth'

    const authStore = useAuthStore()
</script>

<template>
    <div id="app">
        <!-- Solid scrim under the status bar so scrolled content never renders behind the clock/icons.
             Height is the top inset: 0 in a browser. -->
        <div aria-hidden="true" class="bm-status-scrim"></div>
        <router-view v-slot="{ Component, route }">
            <Transition name="page" mode="out-in">
                <component :is="Component" :key="route.path" />
            </Transition>
        </router-view>
    </div>
</template>

<style>
    .bm-status-scrim {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: var(--bm-safe-top);
        background: #ffffff;
        z-index: 30;
        pointer-events: none;
    }

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
