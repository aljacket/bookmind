<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 class="text-3xl font-bold mb-8">Welcome to BookMind</h1>
        <p v-if="authStore.user">Hello, {{ authStore.user.displayName || authStore.user.email }}</p>

        <div v-if="hasPreferences" class="my-4 p-4 bg-white rounded shadow w-full max-w-md">
            <h2 class="text-xl font-semibold mb-2">Le tue preferenze:</h2>
            <p>Genere: {{ preferences.genre }}</p>
            <p>Lunghezza: {{ preferences.bookLength }}</p>
            <p>Periodo: {{ preferences.period }}</p>
            <p>Complessità: {{ preferences.complexity }}</p>
            <p>Scopo: {{ preferences.purpose }}</p>
        </div>

        <button
            @click="getRecommendation"
            class="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            :disabled="isLoading || !hasPreferences"
        >
            {{ hasRecommendation ? 'Ottieni nuova raccomandazione' : 'Ottieni raccomandazione' }}
        </button>

        <div v-if="isLoading" class="my-4 text-center">
            Sto elaborando la tua raccomandazione...
        </div>

        <div v-if="recommendation" class="my-4 p-4 bg-white rounded shadow w-full max-w-md">
            <h2 class="text-xl font-semibold mb-2">Libro raccomandato:</h2>
            <p>{{ recommendation }}</p>
        </div>

        <div v-if="error" class="mt-4 p-4 bg-red-100 text-red-700 rounded w-full max-w-md">
            {{ error }}
        </div>

        <router-link to="/preferences" class="mt-4 text-blue-500 hover:text-blue-700">
            {{ hasPreferences ? 'Aggiorna preferenze' : 'Imposta preferenze di lettura' }}
        </router-link>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted } from 'vue'
    import { useAuthStore } from '@/stores/auth'
    import { getBookRecommendation } from '@/services/openai/bookRecommendation'

    const authStore = useAuthStore()
    const preferences = ref({
        genre: 'Fantasy',
        bookLength: 'medium',
        period: 'any',
        complexity: 'medium',
        purpose: 'entertainment'
    })
    const hasPreferences = ref(false)
    const recommendation = ref('')
    const isLoading = ref(false)
    const error = ref('')
    const hasRecommendation = ref(false)

    onMounted(() => {
        const savedPreferences = localStorage.getItem('userPreferences')
        if (savedPreferences) {
            preferences.value = JSON.parse(savedPreferences)
            hasPreferences.value = true
        }
    })

    const getRecommendation = async () => {
        if (isLoading.value || !hasPreferences.value) return

        isLoading.value = true
        error.value = ''
        try {
            recommendation.value = await getBookRecommendation(preferences.value)
            hasRecommendation.value = true
        } catch (err) {
            error.value = 'Si è verificato un errore. Riprova più tardi.'
            console.error(err)
        } finally {
            isLoading.value = false
        }
    }
</script>
