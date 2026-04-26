<template>
    <div class="bg-ink-50 min-h-screen flex flex-col">
        <Header :title="t('preferences')" :showBackButton="true" />

        <main class="flex-1 container mx-auto px-4 py-6 flex flex-col">
            <div
                class="max-w-2xl w-full mx-auto bg-white rounded-2xl border border-ink-200 shadow-sm flex flex-col flex-1 overflow-hidden"
            >
                <!-- Transparency disclosure -->
                <div class="px-5 pt-5">
                    <AiTransparencyNote />
                </div>

                <!-- Chat log -->
                <div
                    ref="chatScroll"
                    class="flex-1 overflow-y-auto px-5 py-4 space-y-4"
                    aria-live="polite"
                >
                    <div
                        v-for="(msg, i) in chat"
                        :key="i"
                        class="flex"
                        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
                    >
                        <div
                            :class="[
                                'max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed animate-fade-in',
                                msg.role === 'user'
                                    ? 'bg-ink-900 text-ink-50 rounded-br-sm font-sans'
                                    : 'bg-ink-100 text-ink-800 rounded-bl-sm font-serif'
                            ]"
                        >
                            {{ msg.text }}
                        </div>
                    </div>

                    <div v-if="isAwaiting" class="flex justify-start">
                        <div
                            class="bg-ink-100 text-ink-500 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5"
                        >
                            <span
                                class="w-1.5 h-1.5 bg-ink-400 rounded-full animate-pulse"
                                style="animation-delay: 0ms"
                            ></span>
                            <span
                                class="w-1.5 h-1.5 bg-ink-400 rounded-full animate-pulse"
                                style="animation-delay: 150ms"
                            ></span>
                            <span
                                class="w-1.5 h-1.5 bg-ink-400 rounded-full animate-pulse"
                                style="animation-delay: 300ms"
                            ></span>
                            <span class="ml-2 text-xs italic font-sans">
                                {{ t('chat_thinking') }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Error -->
                <div v-if="error" class="px-5">
                    <div
                        class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm"
                    >
                        {{ error }}
                    </div>
                </div>

                <!-- Input area -->
                <form
                    @submit.prevent="handleSubmit"
                    class="border-t border-ink-200 p-4 space-y-3"
                >
                    <textarea
                        ref="inputEl"
                        v-model="inputValue"
                        :placeholder="t('chat_input_placeholder')"
                        :disabled="isAwaiting"
                        maxlength="500"
                        rows="2"
                        class="w-full px-4 py-3 rounded-lg border border-ink-200 bg-ink-50 text-sm text-ink-800 placeholder-ink-400 font-sans resize-none focus:outline-none focus:ring-2 focus:ring-ink-300 focus:border-transparent disabled:opacity-50"
                        @keydown.enter.exact.prevent="handleSubmit"
                    />
                    <div class="flex items-center gap-2">
                        <CTAButton
                            type="submit"
                            :disabled="isAwaiting || !inputValue.trim()"
                        >
                            {{ t('chat_send') }}
                        </CTAButton>
                        <button
                            v-if="userTurnCount === 2"
                            type="button"
                            @click="handleSkipClarifier"
                            :disabled="isAwaiting"
                            class="whitespace-nowrap text-sm text-ink-500 hover:text-ink-800 underline underline-offset-2 transition-colors px-2 disabled:opacity-50"
                        >
                            {{ t('chat_skip_clarifier') }}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
    import { ref, nextTick, onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import { useI18n } from 'vue-i18n'
    import { useAuthStore } from '@/stores/auth'
    import {
        fetchClarifier,
        fetchRecommendations
    } from '@/services/recommendations/bookRecommendation'
    import type { Transcript, TranscriptTurn } from '@/types/userPreferences'

    import Header from '@/components/layout/Header.vue'
    import CTAButton from '@/components/ui/CTAButton.vue'
    import AiTransparencyNote from '@/components/ui/AiTransparencyNote.vue'

    type ChatMessage = { role: 'assistant' | 'user'; text: string }

    const { t, tm } = useI18n()
    const router = useRouter()
    const authStore = useAuthStore()

    const chat = ref<ChatMessage[]>([])
    const userMessages = ref<string[]>([])
    const inputValue = ref('')
    const isAwaiting = ref(false)
    const error = ref('')
    const chatScroll = ref<HTMLElement | null>(null)
    const inputEl = ref<HTMLTextAreaElement | null>(null)

    const userTurnCount = ref(0)
    const anchorPrompt = ref('')

    function pickRandom<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)]
    }

    function pickPromptVariant(key: string, fallback: string): string {
        const variants = tm(key) as unknown
        if (Array.isArray(variants) && variants.length > 0) {
            return pickRandom(variants as string[])
        }
        return fallback
    }

    onMounted(() => {
        const opener = pickPromptVariant('chat_openers', t('chat_input_placeholder'))
        anchorPrompt.value = pickPromptVariant('chat_anchors', t('chat_input_placeholder'))
        chat.value.push({ role: 'assistant', text: opener })
        scrollToBottom()
        focusInput()
    })

    function scrollToBottom() {
        nextTick(() => {
            if (chatScroll.value) {
                chatScroll.value.scrollTop = chatScroll.value.scrollHeight
            }
        })
    }

    function focusInput() {
        nextTick(() => inputEl.value?.focus())
    }

    function buildTranscript(): Transcript {
        return userMessages.value.map<TranscriptTurn>((content) => ({
            role: 'user',
            content
        }))
    }

    async function handleSubmit() {
        if (isAwaiting.value) return
        const trimmed = inputValue.value.trim()
        if (!trimmed) {
            error.value = t('chat_input_required')
            return
        }
        if (trimmed.length > 500) {
            error.value = t('chat_input_too_long')
            return
        }
        error.value = ''

        chat.value.push({ role: 'user', text: trimmed })
        userMessages.value.push(trimmed)
        inputValue.value = ''
        userTurnCount.value++
        scrollToBottom()

        if (userTurnCount.value === 1) {
            chat.value.push({ role: 'assistant', text: anchorPrompt.value })
            scrollToBottom()
            focusInput()
            return
        }

        if (userTurnCount.value === 2) {
            await requestClarifier()
            return
        }

        if (userTurnCount.value === 3) {
            await requestRecommendations()
        }
    }

    async function requestClarifier() {
        isAwaiting.value = true
        scrollToBottom()
        try {
            const { question } = await fetchClarifier(buildTranscript())
            chat.value.push({ role: 'assistant', text: question })
            scrollToBottom()
            focusInput()
        } catch (err) {
            console.error('clarifier failed', err)
            error.value = t('chat_error')
        } finally {
            isAwaiting.value = false
        }
    }

    async function requestRecommendations() {
        if (!authStore.user) {
            error.value = t('user_not_authenticated')
            return
        }
        isAwaiting.value = true
        scrollToBottom()
        try {
            const recs = await fetchRecommendations(buildTranscript())
            localStorage.setItem('newRecommendations', JSON.stringify(recs))
            router.push({ name: 'Processing' })
        } catch (err) {
            console.error('recommendations failed', err)
            error.value = t('chat_error')
            isAwaiting.value = false
        }
    }

    async function handleSkipClarifier() {
        if (isAwaiting.value || userTurnCount.value !== 2) return
        await requestRecommendations()
    }
</script>
