<!-- src/views/HomePage.vue -->
<template>
    <div class="min-h-screen bg-gray-100">
        <Header title="BookMind" />

        <main class="container mx-auto p-6 mt-8">
            <h1 class="text-3xl font-bold mb-8">Welcome to BookMind</h1>
            <p v-if="authStore.user">
                Hello, {{ authStore.user.displayName || authStore.user.email }}
            </p>

            <div class="flex space-x-4 mb-8">
                <router-link
                    to="/preferences"
                    class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Aggiorna preferenze
                </router-link>
            </div>

            <WarningAlert
                v-if="showRemainingCallsWarning"
                message="Ti rimane solo una possibilità di ottenere raccomandazioni oggi."
            />

            <ErrorAlert
                v-if="showNoMoreCallsWarning"
                title="Limite raggiunto!"
                message="Hai esaurito le possibilità di ottenere raccomandazioni per oggi. Riprova tra 24 ore."
            />

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
        </main>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted } from 'vue'
    import { useAuthStore } from '@/stores/auth'
    import { generateAmazonLink } from '@/utils/isbnUtils'
    import { getBookDetails } from '@/services/googleBooks/googleBooksApi'
    import {
        saveLastRecommendations,
        getLastRecommendations,
        getRemainingCalls
    } from '@/services/indexedDB/userPreferences'
    import type { BookRecommendation } from '@/types/userPreferences'
    import { useRoute } from 'vue-router'

    import Header from '@/components/layout/Header.vue'
    import WarningAlert from '@/components/alert/WarningAlert.vue'
    import ErrorAlert from '@/components/alert/ErrorAlert.vue'

    const authStore = useAuthStore()
    const route = useRoute()
    const recommendations = ref<BookRecommendation[]>([])
    const isLoading = ref(false)
    const error = ref('')
    const showRemainingCallsWarning = ref(false)
    const showNoMoreCallsWarning = ref(false)
    const bookDetailsCache = new Map<string, any>()

    onMounted(async () => {
        if (authStore.user) {
            await loadRecommendations()
        }
    })

    async function loadRecommendations() {
        if (recommendations.value.length) return // Evita di ricaricare se già abbiamo raccomandazioni

        try {
            isLoading.value = true
            let recommendationsToProcess: BookRecommendation[] = []

            if (route.query.newRecommendations) {
                recommendationsToProcess = JSON.parse(route.query.newRecommendations as string)
            } else {
                const lastRecommendations = await getLastRecommendations(authStore.user!.uid)
                if (lastRecommendations && lastRecommendations.length > 0) {
                    recommendations.value = lastRecommendations
                    await checkRemainingCalls()
                    return // Usiamo direttamente le raccomandazioni salvate senza riprocessarle
                }
            }

            if (recommendationsToProcess.length > 0) {
                recommendations.value = await processRecommendations(recommendationsToProcess)
            }

            await checkRemainingCalls()
        } catch (err) {
            console.error('Error loading recommendations:', err)
            error.value = 'Errore nel caricamento delle raccomandazioni'
        } finally {
            isLoading.value = false
        }
    }

    async function processRecommendations(
        newRecommendations: BookRecommendation[]
    ): Promise<BookRecommendation[]> {
        console.log('Processing recommendations:', newRecommendations)
        const processedRecommendations = await Promise.all(
            newRecommendations.map(async (rec) => {
                const cacheKey = `${rec.title}-${rec.author}`
                let bookDetails

                if (bookDetailsCache.has(cacheKey)) {
                    console.log('Using cached details for:', rec.title, rec.author)
                    bookDetails = bookDetailsCache.get(cacheKey)
                } else {
                    console.log('Getting details for:', rec.title, rec.author)
                    bookDetails = await getBookDetails(rec.title, rec.author)
                    bookDetailsCache.set(cacheKey, bookDetails)
                }

                console.log('Book details:', bookDetails)
                return {
                    ...rec,
                    ...bookDetails,
                    fullRecommendation: JSON.stringify(rec),
                    amazonLink: bookDetails?.isbn13 ? generateAmazonLink(bookDetails.isbn13) : '',
                    iberLibroLink: bookDetails?.isbn13
                        ? `https://www.iberlibro.com/servlet/SearchResults?kn=${bookDetails.isbn13}`
                        : '',
                    googleBooksLink: bookDetails?.googleBooksLink || ''
                }
            })
        )

        if (authStore.user) {
            await saveLastRecommendations(authStore.user.uid, processedRecommendations)
        }

        return processedRecommendations
    }

    async function checkRemainingCalls() {
        if (authStore.user) {
            const callsLeft = await getRemainingCalls(authStore.user.uid)
            if (callsLeft === 1) {
                showRemainingCallsWarning.value = true
            } else if (callsLeft === 0) {
                showNoMoreCallsWarning.value = true
            }
        }
    }
</script>
