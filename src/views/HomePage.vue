<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 class="text-3xl font-bold mb-8">Welcome to BookMind</h1>
        <p v-if="authStore.user">Hello, {{ authStore.user.displayName || authStore.user.email }}</p>

        <button
            @click="getRecommendation"
            class="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            :disabled="isLoading"
        >
            {{ hasRecommendation ? 'Ottieni nuova raccomandazione' : 'Ottieni raccomandazione' }}
        </button>

        <div v-if="isLoading" class="my-4 text-center">
            Sto elaborando la tua raccomandazione...
        </div>

        <div v-if="recommendation" class="my-4 p-4 bg-white rounded shadow w-full max-w-md">
            <h2 class="text-xl font-semibold mb-2">Libro raccomandato:</h2>
            <p><strong>Titolo:</strong> {{ recommendation.title }}</p>
            <p><strong>Autore:</strong> {{ recommendation.author }}</p>
            <p><strong>ISBN:</strong> {{ recommendation.isbn || 'Non disponibile' }}</p>
            <a
                :href="amazonLink"
                target="_blank"
                class="text-blue-500 hover:underline mt-2 inline-block"
            >
                Acquista su Amazon
            </a>
        </div>

        <div v-if="error" class="mt-4 p-4 bg-red-100 text-red-700 rounded w-full max-w-md">
            {{ error }}
        </div>

        <router-link to="/preferences" class="mt-4 text-blue-500 hover:text-blue-700">
            Aggiorna preferenze di lettura
        </router-link>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted, computed } from 'vue'
    import { useAuthStore } from '@/stores/auth'
    import { getBookRecommendation } from '@/services/openai/bookRecommendation'
    import { generateAmazonLink } from '@/utils/isbnUtils'
    import {
        getUserPreferences,
        saveLastRecommendation,
        getLastRecommendation
    } from '@/services/indexedDB/userPreferences'

    const authStore = useAuthStore()
    const recommendation = ref<null | {
        title: string
        author: string
        isbn: string
        fullRecommendation: string
    }>(null)
    const isLoading = ref(false)
    const error = ref('')
    const hasRecommendation = ref(false)

    const amazonLink = computed(() => {
        console.log('reccomandation: ', recommendation.value)
        // console.log('reccomandation ISBN: ', recommendation.value.isbn)
        if (recommendation.value && recommendation.value.isbn) {
            return generateAmazonLink(recommendation.value.isbn)
        }
        return ''
    })

    onMounted(async () => {
        if (authStore.user) {
            try {
                const lastRecommendation = await getLastRecommendation(authStore.user.uid)
                if (lastRecommendation) {
                    recommendation.value = {
                        title: lastRecommendation.title,
                        author: lastRecommendation.author,
                        isbn: lastRecommendation.isbn,
                        fullRecommendation: lastRecommendation.fullRecommendation
                    }
                    hasRecommendation.value = true
                }
            } catch (err) {
                console.error('Error loading last recommendation:', err)
            }
        }
    })

    const getRecommendation = async () => {
        if (isLoading.value || !authStore.user) return

        isLoading.value = true
        error.value = ''
        try {
            const preferences = await getUserPreferences(authStore.user.uid)
            if (preferences) {
                const newRecommendation = await getBookRecommendation(preferences)
                recommendation.value = newRecommendation
                hasRecommendation.value = true
                await saveLastRecommendation(authStore.user.uid, newRecommendation)
            } else {
                error.value =
                    'Per favore, imposta le tue preferenze prima di ottenere una raccomandazione.'
            }
        } catch (err) {
            error.value = 'Si è verificato un errore. Riprova più tardi.'
            console.error(err)
        } finally {
            isLoading.value = false
        }
    }
</script>
