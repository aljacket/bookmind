<script setup lang="ts">
    import { useAuthStore } from '@/stores/auth'

    const authStore = useAuthStore()
</script>

<template>
    <div id="app">
        <router-view></router-view>
    </div>
</template>

<style>
    /* Stili globali se necessario */
</style>
