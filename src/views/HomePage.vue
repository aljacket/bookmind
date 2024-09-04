<!-- src/views/HomePage.vue -->
<template>
    <div class="min-h-screen bg-gray-100">
        <Header title="BookMind" />

        <main class="container mx-auto p-6 mt-8">
            <div class="mt-8 mb-12 text-center">
                <h2 v-if="authStore.user" class="text-3xl font-bold text-gray-800 mb-4">
                    Benvenuto, {{ authStore.user.displayName || authStore.user.email }}
                </h2>
                <p class="text-lg text-gray-600 mb-6">Pronto per un nuovo viaggio letterario?</p>
                <router-link
                    to="/preferences"
                    class="bg-gradient-to-r from-blue-500 to-teal-400 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition duration-300 hover:scale-105 inline-flex items-center"
                >
                    <svg
                        class="w-6 h-6 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        ></path>
                    </svg>
                    Scopri Nuovi Libri
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

            <div v-if="recommendations.length > 0" class="mt-12">
                <h2 class="text-2xl font-semibold mb-6 text-gray-800">I Tuoi Libri Consigliati</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div
                        v-for="(recommendation, index) in recommendations"
                        :key="index"
                        class="bg-white rounded-lg shadow-md overflow-hidden transform transition duration-300 hover:scale-105"
                    >
                        <img
                            v-if="recommendation.thumbnailUrl"
                            :src="recommendation.thumbnailUrl"
                            :alt="recommendation.title"
                            class="w-full h-64 object-cover"
                        />
                        <div class="p-6">
                            <h3 class="text-xl font-semibold mb-2 text-gray-800">
                                {{ recommendation.title }}
                            </h3>
                            <p class="text-gray-600 mb-4">{{ recommendation.author }}</p>
                            <p v-if="recommendation.pageCount" class="text-sm text-gray-500 mb-2">
                                Pagine: {{ recommendation.pageCount }}
                            </p>
                            <p
                                v-if="recommendation.publishedDate"
                                class="text-sm text-gray-500 mb-4"
                            >
                                Pubblicato: {{ recommendation.publishedDate }}
                            </p>

                            <div class="flex flex-col space-y-2">
                                <a
                                    v-if="recommendation.amazonLink"
                                    :href="recommendation.amazonLink"
                                    target="_blank"
                                    class="flex items-center justify-start bg-yellow-400 text-gray-900 px-4 py-2 rounded-full hover:bg-yellow-500 transition duration-300 w-full"
                                >
                                    <img
                                        src="/src/assets/images/amazon_icon.png"
                                        alt="Amazon"
                                        class="w-6 h-6 mr-4"
                                    />
                                    <span class="flex-grow text-center">Acquista su Amazon</span>
                                </a>
                                <a
                                    v-if="recommendation.iberLibroLink"
                                    :href="recommendation.iberLibroLink"
                                    target="_blank"
                                    class="flex items-center justify-start bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition duration-300 w-full"
                                >
                                    <img
                                        src="/src/assets/images/iberlibro_icon.png"
                                        alt="IberLibro"
                                        class="w-6 h-6 mr-4"
                                    />
                                    <span class="flex-grow text-center">Acquista su IberLibro</span>
                                </a>
                                <a
                                    v-if="recommendation.googleBooksLink"
                                    :href="recommendation.googleBooksLink"
                                    target="_blank"
                                    class="flex items-center justify-start bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition duration-300 w-full"
                                >
                                    <img
                                        src="/src/assets/images/googleBooks_icon.png"
                                        alt="Google Books"
                                        class="w-6 h-6 mr-4"
                                    />
                                    <span class="flex-grow text-center"
                                        >Acquista su Google Books</span
                                    >
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="recommendations.length === 0 && !isLoading" class="mt-12 text-center">
                <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
                    <div class="mb-6">
                        <svg
                            class="w-32 h-32 mx-auto text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="1.5"
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            ></path>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-2">Nessun libro consigliato</h3>
                    <p class="text-gray-600 mb-6">
                        Sembra che tu non abbia ancora ricevuto consigli di lettura. Inizia il tuo
                        viaggio letterario!
                    </p>
                </div>
            </div>

            <div v-if="error" class="mt-4 p-4 bg-red-100 text-red-700 rounded w-full max-w-md">
                {{ error }}
            </div>
        </main>

        <footer class="mt-16 py-6 bg-gray-100">
            <div class="container mx-auto text-center">
                <p class="text-gray-600">
                    Made with
                    <span class="text-red-500">&hearts;</span>
                    by
                    <span class="font-semibold text-gray-800">BookMind Team</span>
                </p>
            </div>
        </footer>
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
