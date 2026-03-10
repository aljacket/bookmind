<template>
    <button
        :type="type"
        :disabled="disabled"
        :class="[
            'w-full flex items-center justify-center py-3.5 px-6',
            'rounded-lg font-sans font-medium text-sm tracking-wide',
            'transition-all duration-300 ease-out',
            disabled
                ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                : variant === 'secondary'
                  ? 'bg-transparent text-ink-700 border border-ink-300 hover:border-ink-500 hover:text-ink-900'
                  : 'bg-ink-900 text-ink-50 hover:bg-ink-800 active:bg-ink-700 shadow-sm hover:shadow-md',
        ]"
    >
        <slot></slot>
    </button>
</template>

<script setup lang="ts">
    withDefaults(
        defineProps<{
            type?: 'button' | 'submit' | 'reset'
            variant?: 'primary' | 'secondary'
            disabled?: boolean
        }>(),
        {
            type: 'button',
            variant: 'primary',
            disabled: false
        }
    )
</script>
