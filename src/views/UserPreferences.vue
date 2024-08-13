<template>
    <div class="max-w-2xl mx-auto p-4">
        <h2 class="text-2xl font-bold mb-4">Le tue preferenze di lettura</h2>
        <form @submit.prevent="savePreferences" class="space-y-6">
            <div>
                <label class="block mb-2">Genere preferito:</label>
                <select v-model="preferences.genre" class="w-full p-2 border rounded">
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

            <div>
                <label class="block mb-2">Lunghezza preferita del libro:</label>
                <select v-model="preferences.bookLength" class="w-full p-2 border rounded">
                    <option value="short">Breve (meno di 200 pagine)</option>
                    <option value="medium">Medio (200-400 pagine)</option>
                    <option value="long">Lungo (più di 400 pagine)</option>
                </select>
            </div>

            <div>
                <label class="block mb-2">Periodo storico:</label>
                <select v-model="preferences.period" class="w-full p-2 border rounded">
                    <option value="contemporary">Contemporaneo</option>
                    <option value="20th_century">XX secolo</option>
                    <option value="pre_20th_century">Prima del XX secolo</option>
                    <option value="any">Qualsiasi</option>
                </select>
            </div>

            <div>
                <label class="block mb-2">Complessità:</label>
                <select v-model="preferences.complexity" class="w-full p-2 border rounded">
                    <option value="easy">Lettura leggera</option>
                    <option value="medium">Moderatamente impegnativo</option>
                    <option value="hard">Molto impegnativo</option>
                </select>
            </div>

            <div>
                <label class="block mb-2">Scopo della lettura:</label>
                <select v-model="preferences.purpose" class="w-full p-2 border rounded">
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
            >
                <label class="block mb-2">Cosa vuoi imparare? (max 20 caratteri)</label>
                <input
                    v-model="preferences.learningGoal"
                    type="text"
                    maxlength="20"
                    class="w-full p-2 border rounded"
                    placeholder="Es: Programmare in Python"
                />
            </div>

            <div v-if="error" class="text-red-500 mt-4">{{ error }}</div>

            <button
                type="submit"
                class="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            >
                Salva preferenze
            </button>
        </form>
    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import { saveUserPreferences, getUserPreferences } from '@/services/indexedDB/userPreferences'
    import { useAuthStore } from '@/stores/auth'
    import type { UserPreferences } from '@/types/userPreferences'

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
                router.push('/')
            } catch (err) {
                console.error('Error saving preferences:', err)
                error.value = 'Errore nel salvataggio delle preferenze'
            }
        } else {
            error.value = 'Utente non autenticato'
        }
    }
</script>
