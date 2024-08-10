<script setup lang="ts">
    import Menu from './components/layout/Menu.vue'

    import { useAuthStore } from '@/stores/auth'

    const authStore = useAuthStore()
</script>

<template>
    <div id="app">
        <Menu v-if="authStore.isAuthenticated" />
        <router-view></router-view>
    </div>
</template>

<style>
    /* Stili globali se necessario */
</style>
