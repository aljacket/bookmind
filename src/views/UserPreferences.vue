<template>
    <div class="max-w-2xl mx-auto p-4">
        <h2 class="text-2xl font-bold mb-4">Le tue preferenze di lettura</h2>
        <form @submit.prevent="savePreferences" class="space-y-6">
            <div>
                <label class="block mb-2">Generi preferiti:</label>
                <div class="grid grid-cols-2 gap-2">
                    <label v-for="genre in genres" :key="genre" class="flex items-center">
                        <input
                            type="checkbox"
                            v-model="preferences.genres"
                            :value="genre"
                            class="mr-2"
                        />
                        {{ genre }}
                    </label>
                </div>
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
                <label class="block mb-2">Periodo storico di interesse:</label>
                <select v-model="preferences.period" class="w-full p-2 border rounded">
                    <option value="now">Contemporaneo</option>
                    <option value="last_century">XX secolo</option>
                    <option value="before_century">Prima del XX secolo</option>
                    <option value="all_time">Qualsiasi</option>
                </select>
            </div>

            <div>
                <label class="block mb-2">Livello di complessità:</label>
                <select v-model="preferences.level" class="w-full p-2 border rounded">
                    <option value="easy">Lettura leggera</option>
                    <option value="medium">Moderatamente impegnativo</option>
                    <option value="hard">Molto impegnativo</option>
                </select>
            </div>

            <div>
                <label class="block mb-2">Scopo della lettura:</label>
                <select v-model="preferences.goal" class="w-full p-2 border rounded">
                    <option value="commedy">Intrattenimento</option>
                    <option value="learning">Apprendimento</option>
                    <option value="growing">Crescita personale</option>
                    <option value="inspiration">Ispirazione</option>
                </select>
            </div>

            <!-- Aggiungi qui gli altri campi per le domande rimanenti -->

            <div>
                <label class="block mb-2">Autori preferiti:</label>
                <input
                    v-model="preferences.favoriteAuthors"
                    type="text"
                    class="w-full p-2 border rounded"
                    placeholder="Separa gli autori con una virgola"
                />
            </div>

            <div>
                <label class="block mb-2">Libri recenti apprezzati:</label>
                <textarea
                    v-model="preferences.recentBooks"
                    class="w-full p-2 border rounded"
                    rows="3"
                    placeholder="Inserisci titoli di libri che hai apprezzato recentemente"
                ></textarea>
            </div>

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

    const router = useRouter()

    const genres = [
        'Fantasy',
        'Sci-Fi',
        'Thriller',
        'Romance',
        'Horror',
        'Biografie',
        'Storia',
        'Scienza',
        'Self-Help'
    ]

    const preferences = ref({
        genres: [],
        bookLength: '',
        favoriteAuthors: '',
        recentBooks: '',
        period: '',
        level: '',
        goal: ''
    })

    onMounted(() => {
        const savedPreferences = localStorage.getItem('userPreferences')
        if (savedPreferences) {
            preferences.value = JSON.parse(savedPreferences)
        }
    })

    const savePreferences = () => {
        localStorage.setItem('userPreferences', JSON.stringify(preferences.value))
        // Per ora, torniamo semplicemente alla home
        router.push('/')
    }
</script>
