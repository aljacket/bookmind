<template>
    <div
        class="flex items-start gap-2 text-xs text-ink-400 font-sans bg-ink-50 border border-ink-100 rounded-lg px-3 py-2"
    >
        <svg
            class="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
        </svg>
        <span class="leading-snug">{{ t('ai_transparency') }}</span>
    </div>
</template>

<script setup lang="ts">
    import { useI18n } from 'vue-i18n'

    const { t } = useI18n()
</script>
