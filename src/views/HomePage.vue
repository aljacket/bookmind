<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 class="text-3xl font-bold mb-8">Welcome to BookMind</h1>
        <p v-if="authStore.user">Hello, {{ authStore.user.displayName || authStore.user.email }}</p>

        <div v-if="hasPreferences" class="my-4 p-4 bg-white rounded shadow">
            <h2 class="text-xl font-semibold mb-2">Libro suggerito:</h2>
            <p>"Il nome del vento" di Patrick Rothfuss</p>
        </div>

        <router-link to="/preferences" class="mb-4 text-blue-500 hover:text-blue-700">
            {{ hasPreferences ? 'Aggiorna preferenze' : 'Imposta preferenze di lettura' }}
        </router-link>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted } from 'vue'
    import { useAuthStore } from '@/stores/auth'

    const authStore = useAuthStore()
    const hasPreferences = ref(false)

    onMounted(() => {
        const savedPreferences = localStorage.getItem('userPreferences')
        hasPreferences.value = !!savedPreferences
    })
</script>
