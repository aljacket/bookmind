<template>
    <div class="min-h-screen bg-gradient-to-br from-bookmind-cyan-50 to-bookmind-cyan-100">
        <!-- Header -->
        <Header title="Preferenze" :showBackButton="true" class="bg-white shadow-md" />

        <!-- Main content -->
        <main class="container mx-auto p-6 mt-8">
            <div class="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div class="p-6 bg-bookmind-600 text-white">
                    <h2 class="text-2xl font-bold mb-2">
                        Personalizza la Tua Avventura Letteraria
                    </h2>
                    <p class="text-bookmind-100">
                        Scegli le tue preferenze e lascia che BookMind ti guidi verso nuovi mondi di
                        carta.
                    </p>
                </div>

                <form @submit.prevent="savePreferences" class="p-6 space-y-6">
                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2"
                            >Genere preferito</label
                        >
                        <select v-model="preferences.genre" class="form-select block w-full">
                            <option value="Fantasy">Fantasy</option>
                            <option value="Sci-Fi">Sci-Fi</option>
                            <option value="Romance">Romance</option>
                            <option value="Mystery">Mystery</option>
                            <option value="Non-Fiction">Non-Fiction</option>
                            <option value="Self-Help">Self-Help</option>
                            <option value="Business">Business</option>
                            <option value="Programming">Programming</option>
                            <option value="Language Learning">Language Learning</option>
                            <option value="Science">Science</option>
                            <option value="History">History</option>
                            <option value="Biography">Biography</option>
                            <option value="Travel">Travel</option>
                        </select>
                    </div>

                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2"
                            >Lunghezza preferita del libro</label
                        >
                        <select v-model="preferences.bookLength" class="form-select block w-full">
                            <option value="short">Breve (meno di 200 pagine)</option>
                            <option value="medium">Medio (200-400 pagine)</option>
                            <option value="long">Lungo (più di 400 pagine)</option>
                        </select>
                    </div>

                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2"
                            >Periodo storico</label
                        >
                        <select v-model="preferences.period" class="form-select block w-full">
                            <option value="contemporary">Contemporaneo</option>
                            <option value="20th_century">XX secolo</option>
                            <option value="pre_20th_century">Prima del XX secolo</option>
                            <option value="any">Qualsiasi</option>
                        </select>
                    </div>

                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2"
                            >Complessità</label
                        >
                        <select v-model="preferences.complexity" class="form-select block w-full">
                            <option value="easy">Lettura leggera</option>
                            <option value="medium">Moderatamente impegnativo</option>
                            <option value="hard">Molto impegnativo</option>
                        </select>
                    </div>

                    <div class="preference-group">
                        <label class="block text-sm font-medium text-gray-700 mb-2"
                            >Scopo della lettura</label
                        >
                        <select v-model="preferences.purpose" class="form-select block w-full">
                            <option value="entertainment">Intrattenimento</option>
                            <option value="learning">Apprendimento</option>
                            <option value="personal_growth">Crescita personale</option>
                            <option value="inspiration">Ispirazione</option>
                            <option value="skill_development">Sviluppo di competenze</option>
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
                            Cosa vuoi imparare? (max 40 caratteri)
                        </label>
                        <input
                            v-model="preferences.learningGoal"
                            type="text"
                            maxlength="40"
                            class="form-input block w-full"
                            placeholder="Es: Programmare in Python e sviluppo web"
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
                            <span>Scopri Nuovi Mondi Letterari</span>
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

    import Header from '@/components/layout/Header.vue'
    import CTAButton from '@/components/ui/CTAButton.vue'

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
                error.value = 'Errore nel caricamento delle preferenze'
            }
        }
    })

    const savePreferences = async () => {
        if (authStore.user) {
            try {
                await saveUserPreferences(authStore.user.uid, preferences.value)
                const canMakeCall = await incrementApiCallCount(authStore.user.uid)
                if (!canMakeCall) {
                    error.value = 'Hai raggiunto il limite di chiamate per oggi'
                    return
                }
                const newRecommendations = await getBookRecommendations(preferences.value)
                localStorage.setItem('newRecommendations', JSON.stringify(newRecommendations))
                router.push({ name: 'Processing' })
            } catch (err) {
                console.error('Error saving preferences or getting recommendations:', err)
                error.value =
                    'Errore nel salvataggio delle preferenze o nel recupero delle raccomandazioni'
            }
        } else {
            error.value = 'Utente non autenticato'
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
