<template>
    <div class="min-h-screen bg-gray-100">
        <!-- Header -->
        <Header title="Preferenze" :showBackButton="true" />

        <!-- Main content -->
        <main class="container mx-auto p-6 mt-8">
            <form
                @submit.prevent="savePreferences"
                class="bg-white shadow-lg rounded-lg p-8 max-w-2xl mx-auto"
            >
                <div class="space-y-6">
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
                        <label class="block text-sm font-medium text-gray-700 mb-2"
                            >Cosa vuoi imparare? (max 20 caratteri)</label
                        >
                        <input
                            v-model="preferences.learningGoal"
                            type="text"
                            maxlength="20"
                            class="form-input block w-full"
                            placeholder="Es: Programmare in Python"
                        />
                    </div>
                </div>

                <div
                    v-if="error"
                    class="mt-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700"
                >
                    {{ error }}
                </div>

                <div class="mt-8">
                    <button
                        type="submit"
                        class="w-full bg-blue-600 text-white py-3 px-6 rounded-lg text-lg font-semibold hover:bg-blue-700 transition duration-300"
                    >
                        Scopri i tuoi prossimi libri preferiti
                    </button>
                </div>
            </form>
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

    const router = useRouter()
    const authStore = useAuthStore()
    const error = ref('')

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
                router.push({
                    name: 'Home',
                    query: { newRecommendations: JSON.stringify(newRecommendations) }
                })
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
        @apply mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50;
    }

    .preference-group {
        @apply bg-gray-50 p-4 rounded-md shadow-sm;
    }
</style>
