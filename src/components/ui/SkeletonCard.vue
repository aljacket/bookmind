<template>
    <div class="bg-white rounded-lg border border-ink-200 overflow-hidden">
        <!-- Cover Area Skeleton -->
        <div class="h-72 bg-ink-100 flex items-center justify-center p-6">
            <div class="w-[120px] h-[180px] bg-ink-200 rounded animate-pulse-soft"></div>
        </div>

        <!-- Content Skeleton -->
        <div class="p-6">
            <div class="h-5 bg-ink-200 rounded w-3/4 mb-2 animate-pulse-soft"></div>
            <div class="h-4 bg-ink-100 rounded w-1/2 mb-4 animate-pulse-soft"
                 style="animation-delay: 100ms"></div>
            <div class="h-3 bg-ink-100 rounded w-full mb-4 animate-pulse-soft"
                 style="animation-delay: 150ms"></div>

            <div class="flex items-center gap-4 mb-5">
                <div class="h-3 bg-ink-100 rounded w-16 animate-pulse-soft"
                     style="animation-delay: 200ms"></div>
                <div class="h-3 bg-ink-100 rounded w-24 animate-pulse-soft"
                     style="animation-delay: 250ms"></div>
            </div>

            <div class="flex flex-col space-y-2">
                <div class="h-10 bg-ink-100 rounded-lg animate-pulse-soft"
                     style="animation-delay: 300ms"></div>
                <div class="h-10 bg-ink-100 rounded-lg animate-pulse-soft"
                     style="animation-delay: 350ms"></div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    // Pure presentational component
</script>
