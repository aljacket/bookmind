<template>
    <div class="bg-ink-50 min-h-screen">
        <Header :title="t('reading_list')" :showBackButton="true" />

        <main class="container mx-auto px-6 pt-4 pb-12">
            <!-- Reading List Grid -->
            <div v-if="readingList.length > 0" class="mt-8">
                <h2 class="text-2xl font-serif font-semibold text-ink-800 mb-8">
                    {{ t('your_reading_list') }}
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div
                        v-for="(book, index) in readingList"
                        :key="`${book.title}-${book.author}`"
                        class="group bg-white rounded-lg border border-ink-200 overflow-hidden transition-all duration-500 hover:shadow-lg hover:border-ink-300 hover:-translate-y-1 animate-fade-in"
                        :style="{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }"
                    >
                        <!-- Cover Area -->
                        <div class="h-72 bg-ink-100 flex items-center justify-center p-6">
                            <img
                                v-if="book.thumbnailUrl"
                                :src="book.thumbnailUrl"
                                :alt="`Cover of ${book.title}`"
                                class="max-h-full max-w-[160px] object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                            />
                        </div>

                        <!-- Card Content -->
                        <div class="p-6">
                            <!-- Top Action Row: status toggle + like (if read) + remove -->
                            <div class="flex items-center justify-between gap-2 mb-3">
                                <!-- Status Pill Toggle -->
                                <button
                                    type="button"
                                    @click="toggleStatus(book)"
                                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-200"
                                    :class="book.status === 'read'
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                        : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100'"
                                    :title="book.status === 'read' ? t('mark_as_to_read') : t('mark_as_read')"
                                >
                                    <svg
                                        v-if="book.status === 'read'"
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="w-3.5 h-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2.5"
                                    >
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <svg
                                        v-else
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="w-3.5 h-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <circle cx="12" cy="12" r="9" />
                                    </svg>
                                    <span>{{ book.status === 'read' ? t('status_read') : t('status_to_read') }}</span>
                                </button>

                                <div class="flex items-center gap-2">
                                    <!-- Like Star (only when read) -->
                                    <button
                                        v-if="book.status === 'read'"
                                        type="button"
                                        @click="toggleLiked(book)"
                                        class="transition-colors duration-200"
                                        :class="book.liked ? 'text-amber-500 hover:text-amber-600' : 'text-ink-300 hover:text-amber-500'"
                                        :title="book.liked ? t('unlike_book') : t('like_book')"
                                    >
                                        <svg
                                            v-if="book.liked"
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="w-5 h-5"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                        </svg>
                                        <svg
                                            v-else
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="w-5 h-5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.5"
                                        >
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                        </svg>
                                    </button>

                                    <!-- Remove Button (heart, matches Home page save affordance) -->
                                    <button
                                        @click="removeBook(book)"
                                        class="text-accent-500 hover:text-red-500 transition-colors duration-200"
                                        :title="t('remove_from_reading_list')"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg"
                                             class="w-5 h-5"
                                             viewBox="0 0 24 24"
                                             fill="currentColor">
                                            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <h3 class="text-lg font-serif font-semibold text-ink-800 mb-1 leading-tight">
                                {{ book.title }}
                            </h3>
                            <p class="text-sm text-ink-500 mb-4 font-light">
                                {{ book.author }}
                            </p>

                            <!-- Reason -->
                            <p v-if="book.reason"
                               class="text-sm text-ink-600 italic mb-4 leading-relaxed">
                                {{ book.reason }}
                            </p>

                            <!-- Metadata Row -->
                            <div class="flex items-center gap-4 text-xs text-ink-400 mb-5">
                                <span v-if="book.pageCount">
                                    {{ t('pages') }}: {{ book.pageCount }}
                                </span>
                                <span v-if="book.publishedDate">
                                    {{ t('published') }}: {{ formatDate(book.publishedDate) }}
                                </span>
                            </div>

                            <!-- Purchase Links -->
                            <div class="flex flex-col space-y-2">
                                <a v-if="amazonLinkFor(book)"
                                   :href="amazonLinkFor(book)"
                                   target="_blank"
                                   class="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-ink-200 text-sm text-ink-600 hover:bg-ink-50 hover:border-ink-300 transition-all duration-200">
                                    <img src="/images/amazon_icon.png" alt="Amazon" class="w-5 h-5" />
                                    <span class="font-medium">{{ t('buy_on_amazon') }}</span>
                                </a>
                                <a v-if="googleBooksLinkFor(book)"
                                   :href="googleBooksLinkFor(book)"
                                   target="_blank"
                                   class="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-ink-200 text-sm text-ink-600 hover:bg-ink-50 hover:border-ink-300 transition-all duration-200">
                                    <img src="/images/googleBooks_icon.png" alt="Google Books" class="w-5 h-5" />
                                    <span class="font-medium">{{ t('buy_on_google_books') }}</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-if="readingList.length === 0" class="max-w-md mx-auto text-center py-16">
                <div class="mb-8 text-ink-300">
                    <svg class="w-24 h-24 mx-auto" fill="none" stroke="currentColor"
                         viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </div>
                <h3 class="text-2xl font-serif text-ink-700 mb-3">
                    {{ t('empty_reading_list') }}
                </h3>
                <p class="text-ink-500 font-light leading-relaxed max-w-sm mx-auto">
                    {{ t('empty_reading_list_message') }}
                </p>
            </div>
        </main>

        <Footer class="mb-6" />
    </div>
</template>

<script setup lang="ts">
    import { ref, computed, onMounted } from 'vue'
    import { useAuthStore } from '@/stores/auth'
    import { useLanguageStore } from '@/stores/language'
    import { useI18n } from 'vue-i18n'
    import {
        getReadingList,
        removeFromReadingList,
        setReadingListItemStatus,
        setReadingListItemLiked
    } from '@/services/indexedDB/userPreferences'
    import type { BookRecommendation, ReadStatus } from '@/types/userPreferences'
    import { detectStoreCountry } from '@/utils/storeRegion'
    import { buildAmazonLink, buildGoogleBooksLink } from '@/utils/bookLinks'

    import Header from '@/components/layout/Header.vue'
    import Footer from '@/components/layout/Footer.vue'

    const authStore = useAuthStore()
    const { t, locale } = useI18n()
    const languageStore = useLanguageStore()
    const readingList = ref<BookRecommendation[]>([])
    const storeCountry = computed(() => detectStoreCountry(languageStore.selectedLanguage))

    function amazonLinkFor(book: BookRecommendation): string {
        return buildAmazonLink(book, storeCountry.value)
    }

    function googleBooksLinkFor(book: BookRecommendation): string {
        return buildGoogleBooksLink(book, languageStore.selectedLanguage)
    }

    onMounted(async () => {
        if (authStore.user) {
            readingList.value = await getReadingList(authStore.user.uid)
        }
    })

    async function reload() {
        if (!authStore.user) return
        readingList.value = await getReadingList(authStore.user.uid)
    }

    async function removeBook(book: BookRecommendation) {
        if (!authStore.user) return
        await removeFromReadingList(authStore.user.uid, book)
        await reload()
    }

    async function toggleStatus(book: BookRecommendation) {
        if (!authStore.user) return
        const next: ReadStatus = book.status === 'read' ? 'to-read' : 'read'
        // Optimistic update
        const prev = { status: book.status, liked: book.liked }
        book.status = next
        if (next === 'to-read') book.liked = false
        try {
            await setReadingListItemStatus(authStore.user.uid, book, next)
        } catch (err) {
            console.error('Failed to update status; rolling back', err)
            book.status = prev.status
            book.liked = prev.liked
            await reload()
        }
    }

    async function toggleLiked(book: BookRecommendation) {
        if (!authStore.user || book.status !== 'read') return
        const next = !book.liked
        const prev = book.liked
        book.liked = next
        try {
            await setReadingListItemLiked(authStore.user.uid, book, next)
        } catch (err) {
            console.error('Failed to update liked; rolling back', err)
            book.liked = prev
            await reload()
        }
    }

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr)
        return new Intl.DateTimeFormat(locale.value, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date)
    }
</script>
