<template>
    <div class="bg-ink-50 min-h-screen">
        <!-- Header -->
        <Header :title="t('preferences')" :showBackButton="true" />

        <!-- Main content -->
        <main class="container mx-auto p-6 mt-8">
            <div class="max-w-2xl mx-auto bg-white rounded-2xl border border-ink-200 shadow-sm overflow-hidden">
                <div class="p-8 border-b border-ink-200">
                    <h2 class="text-2xl font-serif font-semibold text-ink-800 mb-2">
                        {{ t('customize_your_literary_adventure') }}
                    </h2>
                    <p class="text-ink-500 font-light">
                        {{
                            t(
                                'choose_your_preferences_and_let_bookmind_guide_you_to_new_literary_worlds'
                            )
                        }}
                    </p>
                </div>

                <form @submit.prevent="savePreferences" class="p-8 space-y-6">
                    <div class="bg-ink-50 border border-ink-100 rounded-lg p-5">
                        <label class="block text-sm font-medium text-ink-600 mb-2">{{
                            t('favorite_genre')
                        }}</label>
                        <select v-model="preferences.genre" class="form-select">
                            <option value="Fantasy">{{ t('fantasy') }}</option>
                            <option value="Sci-Fi">{{ t('sci_fi') }}</option>
                            <option value="Romance">{{ t('romance') }}</option>
                            <option value="Mystery">{{ t('mystery') }}</option>
                            <option value="Non-Fiction">{{ t('non_fiction') }}</option>
                            <option value="Self-Help">{{ t('self_help') }}</option>
                            <option value="Business">{{ t('business') }}</option>
                            <option value="Programming">{{ t('programming') }}</option>
                            <option value="Language Learning">{{ t('language_learning') }}</option>
                            <option value="Science">{{ t('science') }}</option>
                            <option value="History">{{ t('history') }}</option>
                            <option value="Biography">{{ t('biography') }}</option>
                            <option value="Travel">{{ t('travel') }}</option>
                        </select>
                    </div>

                    <div class="bg-ink-50 border border-ink-100 rounded-lg p-5">
                        <label class="block text-sm font-medium text-ink-600 mb-2">{{
                            t('preferred_book_length')
                        }}</label>
                        <select v-model="preferences.bookLength" class="form-select">
                            <option value="short">{{ t('short') }}</option>
                            <option value="medium">{{ t('medium') }}</option>
                            <option value="long">{{ t('long') }}</option>
                        </select>
                    </div>

                    <div class="bg-ink-50 border border-ink-100 rounded-lg p-5">
                        <label class="block text-sm font-medium text-ink-600 mb-2">{{
                            t('historical_period')
                        }}</label>
                        <select v-model="preferences.period" class="form-select">
                            <option value="contemporary">{{ t('contemporary') }}</option>
                            <option value="20th_century">{{ t('20th_century') }}</option>
                            <option value="pre_20th_century">{{ t('pre_20th_century') }}</option>
                            <option value="any">{{ t('any') }}</option>
                        </select>
                    </div>

                    <div class="bg-ink-50 border border-ink-100 rounded-lg p-5">
                        <label class="block text-sm font-medium text-ink-600 mb-2">{{
                            t('complexity')
                        }}</label>
                        <select v-model="preferences.complexity" class="form-select">
                            <option value="easy">{{ t('easy') }}</option>
                            <option value="medium">{{ t('medium') }}</option>
                            <option value="hard">{{ t('hard') }}</option>
                        </select>
                    </div>

                    <div class="bg-ink-50 border border-ink-100 rounded-lg p-5">
                        <label class="block text-sm font-medium text-ink-600 mb-2">{{
                            t('purpose_of_reading')
                        }}</label>
                        <select v-model="preferences.purpose" class="form-select">
                            <option value="entertainment">{{ t('entertainment') }}</option>
                            <option value="learning">{{ t('learning') }}</option>
                            <option value="personal_growth">{{ t('personal_growth') }}</option>
                            <option value="inspiration">{{ t('inspiration') }}</option>
                            <option value="skill_development">{{ t('skill_development') }}</option>
                        </select>
                    </div>

                    <div
                        v-if="
                            preferences.purpose === 'learning' ||
                            preferences.purpose === 'skill_development'
                        "
                        class="bg-ink-50 border border-ink-100 rounded-lg p-5"
                    >
                        <label class="block text-sm font-medium text-ink-600 mb-2">
                            {{ t('what_do_you_want_to_learn') }} ({{ t('max_40_characters') }})
                        </label>
                        <input
                            v-model="preferences.learningGoal"
                            type="text"
                            maxlength="40"
                            class="form-input"
                            :placeholder="t('what_do_you_want_to_learn_placeholder')"
                        />
                    </div>

                    <div
                        v-if="error"
                        class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4"
                    >
                        {{ error }}
                    </div>

                    <div class="mt-8">
                        <CTAButton type="submit">
                            <svg
                                class="w-5 h-5 mr-2"
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
                            <span>{{ t('discover_new_literary_worlds') }}</span>
                        </CTAButton>
                    </div>
                </form>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import {
        saveUserPreferences,
        getUserPreferences,
        incrementApiCallCount
    } from '@/services/indexedDB/userPreferences'
    import { useAuthStore } from '@/stores/auth'
    import { getBookRecommendations } from '@/services/recommendations/bookRecommendation'
    import type { UserPreferences } from '@/types/userPreferences'
    import { useI18n } from 'vue-i18n'

    import Header from '@/components/layout/Header.vue'
    import CTAButton from '@/components/ui/CTAButton.vue'

    const { t } = useI18n()
    const router = useRouter()
    const authStore = useAuthStore()
    const error = ref('')
    const isLoading = ref(false)

    const preferences = ref<UserPreferences>({
        genre: 'Fantasy',
        bookLength: 'medium',
        period: 'any',
        complexity: 'medium',
        purpose: 'entertainment',
        learningGoal: '',
        lang: 'en'
    })

    onMounted(async () => {
        if (authStore.user) {
            const savedPreferences = await getUserPreferences(authStore.user.uid)
            if (savedPreferences) {
                preferences.value = { ...savedPreferences, lang: preferences.value.lang }
            }
        }
    })

    const savePreferences = async () => {
        if (authStore.user) {
            try {
                await saveUserPreferences(authStore.user.uid, preferences.value)
                const canMakeCall = await incrementApiCallCount(authStore.user.uid)
                if (!canMakeCall) {
                    error.value = t('api_call_limit_reached')
                    return
                }
                const newRecommendations = await getBookRecommendations(preferences.value)
                localStorage.setItem('newRecommendations', JSON.stringify(newRecommendations))
                router.push({ name: 'Processing' })
            } catch (err) {
                console.error('Error saving preferences or getting recommendations:', err)
                error.value = t('error_saving_preferences_or_getting_recommendations')
            }
        } else {
            error.value = t('user_not_authenticated')
        }
    }
</script>
