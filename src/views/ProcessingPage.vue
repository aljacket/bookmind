<template>
    <div class="min-h-screen bg-ink-50 flex items-center justify-center">
        <div class="text-center max-w-md mx-auto px-6">
            <div class="mb-8">
                <div class="flex justify-center gap-1.5">
                    <span class="w-2 h-2 bg-ink-400 rounded-full animate-pulse" style="animation-delay: 0ms"></span>
                    <span class="w-2 h-2 bg-ink-400 rounded-full animate-pulse" style="animation-delay: 150ms"></span>
                    <span class="w-2 h-2 bg-ink-400 rounded-full animate-pulse" style="animation-delay: 300ms"></span>
                </div>
            </div>
            <h2 class="text-2xl font-serif text-ink-800 mb-3">
                {{ t('processing_recommendations') }}
            </h2>
            <p class="text-ink-500 font-light">
                {{ t('processing_recommendations_message') }}
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import { useI18n } from 'vue-i18n'

    const { t } = useI18n()
    const router = useRouter()

    onMounted(() => {
        const recommendations = JSON.parse(localStorage.getItem('newRecommendations') || '[]')
        setTimeout(() => {
            router.push({
                name: 'Home',
                query: { newRecommendations: JSON.stringify(recommendations) }
            })
            localStorage.removeItem('newRecommendations')
        }, 2000)
    })
</script>
