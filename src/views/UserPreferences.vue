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
                </select>
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

    const preferences = ref({
        genre: 'Fantasy',
        bookLength: 'medium',
        period: 'any',
        complexity: 'medium',
        purpose: 'entertainment'
    })

    onMounted(() => {
        const savedPreferences = localStorage.getItem('userPreferences')
        if (savedPreferences) {
            preferences.value = JSON.parse(savedPreferences)
        }
    })

    const savePreferences = () => {
        localStorage.setItem('userPreferences', JSON.stringify(preferences.value))
        router.push('/')
    }
</script>
