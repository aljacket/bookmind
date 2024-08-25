<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 class="text-3xl font-bold mb-8">Welcome to BookMind</h1>
        <p v-if="authStore.user">Hello, {{ authStore.user.displayName || authStore.user.email }}</p>

        <WarningAlert
            v-if="showRemainingCallsWarning"
            message="Ti rimane solo una possibilità di ottenere raccomandazioni oggi."
        />

        <ErrorAlert
            v-if="showNoMoreCallsWarning"
            title="Limite raggiunto!"
            message="Hai esaurito le possibilità di ottenere raccomandazioni per oggi. Riprova tra 24 ore."
        />

        <button
            @click="getRecommendations"
            class="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            :disabled="isLoading || showNoMoreCallsWarning"
        >
            {{
                recommendations.length > 0
                    ? 'Ottieni nuove raccomandazioni'
                    : 'Ottieni raccomandazioni'
            }}
        </button>

        <div v-if="isLoading" class="my-4 text-center">
            Sto elaborando le tue raccomandazioni...
        </div>

        <div
            v-if="recommendations.length > 0"
            class="my-4 p-4 bg-white rounded shadow w-full max-w-md"
        >
            <h2 class="text-xl font-semibold mb-2">Libri raccomandati:</h2>
            <div
                v-for="(recommendation, index) in recommendations"
                :key="index"
                class="mb-4 pb-4 border-b border-gray-200"
            >
                <p><strong>Titolo:</strong> {{ recommendation.title }}</p>
                <p><strong>Autore:</strong> {{ recommendation.author }}</p>
                <p v-if="recommendation.isbn13">
                    <strong>ISBN-13:</strong> {{ recommendation.isbn13 }}
                </p>
                <p v-if="recommendation.pageCount">
                    <strong>Pagine:</strong> {{ recommendation.pageCount }}
                </p>
                <p v-if="recommendation.publishedDate">
                    <strong>Data di pubblicazione:</strong> {{ recommendation.publishedDate }}
                </p>
                <img
                    v-if="recommendation.thumbnailUrl"
                    :src="recommendation.thumbnailUrl"
                    alt="Copertina del libro"
                    class="mt-2"
                />
                <div class="mt-4 space-y-2">
                    <a
                        v-if="recommendation.amazonLink"
                        :href="recommendation.amazonLink"
                        target="_blank"
                        class="text-blue-500 hover:underline block"
                    >
                        Acquista su Amazon
                    </a>
                    <a
                        v-if="recommendation.iberLibroLink"
                        :href="recommendation.iberLibroLink"
                        target="_blank"
                        class="text-blue-500 hover:underline block"
                    >
                        Acquista su IberLibro
                    </a>
                    <a
                        v-if="recommendation.googleBooksLink"
                        :href="recommendation.googleBooksLink"
                        target="_blank"
                        class="text-blue-500 hover:underline block"
                    >
                        Acquista su Google Books
                    </a>
                </div>
            </div>
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
    import { ref, onMounted } from 'vue'
    import { useAuthStore } from '@/stores/auth'
    import { getBookRecommendations } from '@/services/openai/bookRecommendation'
    import { generateAmazonLink } from '@/utils/isbnUtils'
    import { getBookDetails } from '@/services/googleBooks/googleBooksApi'
    import {
        getUserPreferences,
        saveLastRecommendations,
        getLastRecommendations,
        incrementApiCallCount,
        getRemainingCalls
    } from '@/services/indexedDB/userPreferences'
    import type { BookRecommendation } from '@/types/userPreferences'
    import WarningAlert from '@/components/alert/WarningAlert.vue'
    import ErrorAlert from '@/components/alert/ErrorAlert.vue'

    const authStore = useAuthStore()
    const recommendations = ref<BookRecommendation[]>([])
    const isLoading = ref(false)
    const error = ref('')
    const showRemainingCallsWarning = ref(false)
    const showNoMoreCallsWarning = ref(false)

    onMounted(async () => {
        if (authStore.user) {
            try {
                const lastRecommendations = await getLastRecommendations(authStore.user.uid)
                if (lastRecommendations && lastRecommendations.length > 0) {
                    recommendations.value = lastRecommendations
                }
            } catch (err) {
                console.error('Error loading last recommendations:', err)
            }
        }
    })

    const getRecommendations = async () => {
        if (isLoading.value || !authStore.user) return

        isLoading.value = true
        error.value = ''
        showRemainingCallsWarning.value = false
        showNoMoreCallsWarning.value = false

        try {
            const canMakeCall = await incrementApiCallCount(authStore.user.uid)
            if (!canMakeCall) {
                showNoMoreCallsWarning.value = true
                isLoading.value = false
                return
            }

            const preferences = await getUserPreferences(authStore.user.uid)
            if (preferences) {
                const newRecommendations = await getBookRecommendations(preferences)
                recommendations.value = await Promise.all(
                    newRecommendations.map(async (rec) => {
                        const bookDetails = await getBookDetails(rec.title, rec.author)
                        return {
                            ...rec,
                            ...bookDetails,
                            fullRecommendation: JSON.stringify(rec),
                            amazonLink: bookDetails?.isbn13
                                ? generateAmazonLink(bookDetails.isbn13)
                                : '',
                            iberLibroLink: bookDetails?.isbn13
                                ? `https://www.iberlibro.com/servlet/SearchResults?kn=${bookDetails.isbn13}`
                                : '',
                            googleBooksLink: bookDetails?.googleBooksLink || ''
                        }
                    })
                )

                await saveLastRecommendations(authStore.user.uid, recommendations.value)

                // Controlla le chiamate rimanenti dopo aver completato con successo
                const callsLeft = await getRemainingCalls(authStore.user.uid)
                if (callsLeft === 1) {
                    showRemainingCallsWarning.value = true
                } else if (callsLeft === 0) {
                    showNoMoreCallsWarning.value = true
                }
            } else {
                error.value =
                    'Per favore, imposta le tue preferenze prima di ottenere raccomandazioni.'
            }
        } catch (err) {
            error.value = 'Si è verificato un errore. Riprova più tardi.'
            console.error(err)
        } finally {
            isLoading.value = false
        }
    }
</script>
