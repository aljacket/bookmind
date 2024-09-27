<template>
    <div
        class="min-h-screen flex items-center justify-center bg-gradient-to-br from-bookmind-cyan-50 to-bookmind-cyan-100"
    >
        <div class="text-center">
            <svg class="animate-spin h-16 w-16 mx-auto mb-4 text-bookmind-600" viewBox="0 0 24 24">
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                ></circle>
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
            <h2 class="text-2xl font-bold text-bookmind-800 mb-2">
                Processando le tue preferenze...
            </h2>
            <p class="text-bookmind-600">
                Stiamo preparando le tue raccomandazioni personalizzate.
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted } from 'vue'
    import { useRouter } from 'vue-router'

    const router = useRouter()

    onMounted(() => {
        const recommendations = JSON.parse(localStorage.getItem('newRecommendations') || '[]')
        setTimeout(() => {
            router.push({
                name: 'Home',
                query: { newRecommendations: JSON.stringify(recommendations) }
            })
            localStorage.removeItem('newRecommendations') // Pulisci i dati dopo l'uso
        }, 2000) // Attendi 2 secondi prima di reindirizzare
    })
</script>
