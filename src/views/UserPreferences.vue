<template>
    <div class="min-h-screen bg-gradient-to-br from-bookmind-cyan-50 to-bookmind-cyan-100">
        <!-- Header -->
        <Header title="Preferenze" :showBackButton="true" class="bg-white shadow-md" />

        <!-- Main content -->
        <main class="container mx-auto p-6 mt-8">
            <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div class="p-6 bg-bookmind-600 text-white">
                    <h2 class="text-2xl font-bold mb-2">
                        {{ t('customize_your_literary_adventure') }}
                    </h2>
                    <p class="text-bookmind-100">
                        {{
                            t(
                                'choose_your_preferences_and_let_bookmind_guide_you_to_new_literary_worlds'
                            )
                        }}
                    </p>
                </div>

                <form @submit.prevent="savePreferences" class="p-6 space-y-6">
                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{
                            t('favorite_genre')
                        }}</label>
                        <select v-model="preferences.genre" class="form-select block w-full">
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

                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{
                            t('preferred_book_length')
                        }}</label>
                        <select v-model="preferences.bookLength" class="form-select block w-full">
                            <option value="short">{{ t('short') }}</option>
                            <option value="medium">{{ t('medium') }}</option>
                            <option value="long">{{ t('long') }}</option>
                        </select>
                    </div>

                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{
                            t('historical_period')
                        }}</label>
                        <select v-model="preferences.period" class="form-select block w-full">
                            <option value="contemporary">{{ t('contemporary') }}</option>
                            <option value="20th_century">{{ t('20th_century') }}</option>
                            <option value="pre_20th_century">{{ t('pre_20th_century') }}</option>
                            <option value="any">{{ t('any') }}</option>
                        </select>
                    </div>

                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{
                            t('complexity')
                        }}</label>
                        <select v-model="preferences.complexity" class="form-select block w-full">
                            <option value="easy">{{ t('easy') }}</option>
                            <option value="medium">{{ t('medium') }}</option>
                            <option value="hard">{{ t('hard') }}</option>
                        </select>
                    </div>

                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{
                            t('purpose_of_reading')
                        }}</label>
                        <select v-model="preferences.purpose" class="form-select block w-full">
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
                        class="preference-group"
                    >
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            {{ t('what_do_you_want_to_learn') }} ({{ t('max_40_characters') }})
                        </label>
                        <input
                            v-model="preferences.learningGoal"
                            type="text"
                            maxlength="40"
                            class="form-input block w-full"
                            :placeholder="t('what_do_you_want_to_learn_placeholder')"
                        />
                    </div>

                    <div
                        v-if="error"
                        class="mt-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded"
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
    import { getBookRecommendations } from '@/services/openai/bookRecommendation'
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
        learningGoal: ''
    })

    onMounted(async () => {
        if (authStore.user) {
            try {
                const savedPreferences = await getUserPreferences(authStore.user.uid)
                if (savedPreferences) {
                    preferences.value = savedPreferences
                }
            } catch (err) {
                console.error('Error loading preferences:', err)
                error.value = t('error_loading_preferences')
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

<style scoped>
    .form-select,
    .form-input {
        @apply mt-1 block w-full rounded-md border-bookmind-300 shadow-sm focus:border-bookmind-300 focus:ring focus:ring-bookmind-200 focus:ring-opacity-50;
    }

    .preference-group {
        @apply bg-bookmind-50 p-4 rounded-md shadow-sm;
    }
</style>
