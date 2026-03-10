<!-- src/views/HomePage.vue -->
<template>
    <div class="bg-ink-50 min-h-screen">
        <Header title="BookMind" />

        <main class="container mx-auto px-6 pt-4 pb-12">
            <!-- Hero Section -->
            <div class="max-w-2xl mx-auto text-center py-12">
                <h2 v-if="authStore.user" class="text-4xl font-serif font-medium text-ink-800 mb-3">
                    {{
                        t('welcome_user', {
                            user: authStore.user.displayName || authStore.user.email
                        })
                    }}
                </h2>
                <p class="text-lg text-ink-500 font-light mb-8">
                    {{ t('ready_for_a_new_literary_journey') }}
                </p>
                <div class="max-w-xs mx-auto">
                    <CTAButton @click="$router.push('/preferences')">
                        {{ t('discover_new_books') }}
                    </CTAButton>
                </div>
            </div>

            <!-- Loading Skeleton State -->
            <div v-if="isLoading" class="mt-8">
                <div class="h-7 bg-ink-200 rounded w-64 mb-8 animate-pulse-soft"></div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <SkeletonCard v-for="i in 3" :key="i" />
                </div>
            </div>

            <!-- Recommendations Grid -->
            <div v-if="recommendations.length > 0" class="mt-8">
                <h2 class="text-2xl font-serif font-semibold text-ink-800 mb-8">
                    {{ t('your_recommended_books') }}
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div
                        v-for="(recommendation, index) in recommendations"
                        :key="index"
                        class="group bg-white rounded-lg border border-ink-200 overflow-hidden transition-all duration-500 hover:shadow-lg hover:border-ink-300 hover:-translate-y-1 animate-fade-in"
                        :style="{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }"
                    >
                        <!-- Cover Area -->
                        <div class="h-72 bg-ink-100 flex items-center justify-center p-6">
                            <img
                                v-if="recommendation.thumbnailUrl"
                                :src="recommendation.thumbnailUrl"
                                :alt="`Cover image for ${recommendation.title}`"
                                class="max-h-full max-w-[160px] object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                            />
                        </div>

                        <!-- Card Content -->
                        <div class="p-6">
                            <!-- Bookmark Button -->
                            <div class="flex justify-end mb-2">
                                <button
                                    @click.stop="toggleReadingList(recommendation)"
                                    class="text-ink-400 hover:text-accent-500 transition-colors duration-200"
                                    :title="isInReadingList(recommendation)
                                        ? t('remove_from_reading_list')
                                        : t('add_to_reading_list')"
                                >
                                    <svg v-if="isInReadingList(recommendation)"
                                         xmlns="http://www.w3.org/2000/svg"
                                         class="w-5 h-5 text-accent-500"
                                         viewBox="0 0 24 24"
                                         fill="currentColor">
                                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                                    </svg>
                                    <svg v-else
                                         xmlns="http://www.w3.org/2000/svg"
                                         class="w-5 h-5"
                                         viewBox="0 0 24 24"
                                         fill="none"
                                         stroke="currentColor"
                                         stroke-width="1.5">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                                    </svg>
                                </button>
                            </div>

                            <h3 class="text-lg font-serif font-semibold text-ink-800 mb-1 leading-tight">
                                {{ recommendation.title }}
                            </h3>
                            <p class="text-sm text-ink-500 mb-4 font-light">
                                {{ recommendation.author }}
                            </p>

                            <!-- Recommendation Reason -->
                            <p v-if="recommendation.reason"
                               class="text-sm text-ink-600 italic mb-4 leading-relaxed">
                                {{ recommendation.reason }}
                            </p>

                            <!-- Metadata Row -->
                            <div class="flex items-center gap-4 text-xs text-ink-400 mb-5">
                                <span v-if="recommendation.pageCount">
                                    {{ t('pages') }}: {{ recommendation.pageCount }}
                                </span>
                                <span v-if="recommendation.publishedDate">
                                    {{ t('published') }}: {{ formatDate(recommendation.publishedDate) }}
                                </span>
                            </div>

                            <!-- Purchase Links -->
                            <div class="flex flex-col space-y-2">
                                <a
                                    v-if="recommendation.amazonLink"
                                    :href="recommendation.amazonLink"
                                    target="_blank"
                                    class="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-ink-200 text-sm text-ink-600 hover:bg-ink-50 hover:border-ink-300 transition-all duration-200"
                                >
                                    <img
                                        src="/images/amazon_icon.png"
                                        alt="Amazon"
                                        class="w-5 h-5"
                                    />
                                    <span class="font-medium">
                                        {{ t('buy_on_amazon') }}
                                    </span>
                                </a>
                                <a
                                    v-if="recommendation.googleBooksLink"
                                    :href="recommendation.googleBooksLink"
                                    target="_blank"
                                    class="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-ink-200 text-sm text-ink-600 hover:bg-ink-50 hover:border-ink-300 transition-all duration-200"
                                >
                                    <img
                                        src="/images/googleBooks_icon.png"
                                        alt="Google Books"
                                        class="w-5 h-5"
                                    />
                                    <span class="font-medium">
                                        {{ t('buy_on_google_books') }}
                                    </span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-if="recommendations.length === 0 && !isLoading" class="max-w-md mx-auto text-center py-16">
                <div class="mb-8 text-ink-300">
                    <svg
                        class="w-24 h-24 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1"
                            d="M12 3v18M9 3a2 2 0 00-2 2v14a2 2 0 002 2h9a2 2 0 002-2V5a2 2 0 00-2-2H9z"
                        ></path>
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1"
                            d="M9 3a2 2 0 00-2 2v14a2 2 0 002 2"
                        ></path>
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1"
                            d="M12 7h5M12 11h5M12 15h3"
                        ></path>
                    </svg>
                </div>
                <h3 class="text-2xl font-serif text-ink-700 mb-3">
                    {{ t('no_recommended_books') }}
                </h3>
                <p class="text-ink-500 font-light leading-relaxed max-w-sm mx-auto">
                    {{ t('no_recommended_books_message') }}
                </p>
            </div>

            <!-- Error State -->
            <div v-if="error" class="mt-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg max-w-md mx-auto">
                {{ error }}
            </div>
        </main>

        <Footer class="mb-6" />
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
        getReadingList,
        addToReadingList,
        removeFromReadingList
    } from '@/services/indexedDB/userPreferences'
    import type { BookRecommendation } from '@/types/userPreferences'
    import { useRoute } from 'vue-router'
    import { useI18n } from 'vue-i18n'

    import Header from '@/components/layout/Header.vue'
    import Footer from '@/components/layout/Footer.vue'
    import CTAButton from '@/components/ui/CTAButton.vue'
    import SkeletonCard from '@/components/ui/SkeletonCard.vue'

    const authStore = useAuthStore()
    const route = useRoute()
    const recommendations = ref<BookRecommendation[]>([])
    const isLoading = ref(false)
    const error = ref('')
    const readingList = ref<BookRecommendation[]>([])
    const bookDetailsCache = new Map<string, any>()
    const { t, locale } = useI18n()

    onMounted(async () => {
        if (authStore.user) {
            await loadRecommendations()
            readingList.value = await getReadingList(authStore.user.uid)
        }
    })

    async function loadRecommendations() {
        if (recommendations.value.length) return

        try {
            isLoading.value = true
            let recommendationsToProcess: BookRecommendation[] = []

            if (route.query.newRecommendations) {
                recommendationsToProcess = JSON.parse(route.query.newRecommendations as string)
            } else {
                const lastRecommendations = await getLastRecommendations(authStore.user!.uid)
                if (lastRecommendations && lastRecommendations.length > 0) {
                    recommendations.value = lastRecommendations
                    return // Use the saved recommendations directly without reprocessing
                }
            }

            if (recommendationsToProcess.length > 0) {
                recommendations.value = await processRecommendations(recommendationsToProcess)
            }

        } catch (err) {
            console.error('Error loading recommendations:', err)
            error.value = t('error_loading_recommendations')
        } finally {
            isLoading.value = false
        }
    }

    async function processRecommendations(
        newRecommendations: BookRecommendation[]
    ): Promise<BookRecommendation[]> {
        const processedRecommendations = await Promise.all(
            newRecommendations.map(async (rec) => {
                const cacheKey = `${rec.title}-${rec.author}`
                let bookDetails

                if (bookDetailsCache.has(cacheKey)) {
                    bookDetails = bookDetailsCache.get(cacheKey)
                } else {
                    bookDetails = await getBookDetails(rec.title, rec.author)
                    bookDetailsCache.set(cacheKey, bookDetails)
                }

                return {
                    ...rec,
                    ...bookDetails,
                    reason: rec.reason,
                    fullRecommendation: JSON.stringify(rec),
                    amazonLink: bookDetails?.isbn13 ? generateAmazonLink(bookDetails.isbn13) : '',
                    googleBooksLink: bookDetails?.googleBooksLink || ''
                }
            })
        )

        if (authStore.user) {
            await saveLastRecommendations(authStore.user.uid, processedRecommendations)
        }

        return processedRecommendations
    }

    /**
     * Formats a date string based on the current locale.
     * @param dateStr - The date string to format.
     * @returns Formatted date string.
     */
    function formatDate(dateStr: string): string {
        const date = new Date(dateStr)
        return new Intl.DateTimeFormat(locale.value, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date)
    }

    function isInReadingList(book: BookRecommendation): boolean {
        return readingList.value.some(
            (b) => b.title === book.title && b.author === book.author
        )
    }

    async function toggleReadingList(book: BookRecommendation) {
        if (!authStore.user) return
        if (isInReadingList(book)) {
            await removeFromReadingList(authStore.user.uid, book)
        } else {
            await addToReadingList(authStore.user.uid, book)
        }
        readingList.value = await getReadingList(authStore.user.uid)
    }
</script>
