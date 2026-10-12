<template>
    <div class="w-fit">
        <!-- Already reported in this session: same place and height, so nothing shifts. -->
        <span
            v-if="alreadyReported"
            ref="markerEl"
            tabindex="-1"
            class="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-sans not-italic text-sage-700 focus:outline-none"
        >
            <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
            >
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {{ t('report_done_inline') }}
        </span>
        <button
            v-else
            ref="buttonEl"
            type="button"
            aria-haspopup="dialog"
            :aria-label="ariaLabel"
            :disabled="disabled"
            class="inline-flex min-h-11 min-w-11 items-center gap-1.5 px-2 rounded-lg text-sm font-sans not-italic text-ink-600 hover:bg-ink-100 active:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400 disabled:opacity-50 disabled:hover:bg-transparent"
            @click="isOpen = true"
        >
            <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
                />
            </svg>
            {{ t('report_action') }}
        </button>

        <!-- Above the menu and the header: teleported to <body>. -->
        <Teleport to="body">
            <Transition name="rs" appear>
                <ReportAiContentSheet
                    v-if="isOpen"
                    :target="target"
                    @close="closeSheet"
                    @reported="reportsStore.markReported(target)"
                    @sign-in-again="signInAgain"
                />
            </Transition>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
    import { computed, nextTick, ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { useI18n } from 'vue-i18n'
    import { signOut } from 'firebase/auth'
    import { auth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'
    import { useReportsStore } from '@/stores/reports'
    import type { ReportTarget } from '@/services/reports/reportAiContent'
    import ReportAiContentSheet from '@/components/report/ReportAiContentSheet.vue'

    const props = defineProps<{
        target: ReportTarget
        /** The title shown on the card, for the accessible name. Defaults to the reported title. */
        bookTitle?: string
        /** The chat locks it while a request is in flight, so the sheet cannot be open then. */
        disabled?: boolean
    }>()

    const { t } = useI18n()
    const router = useRouter()
    const authStore = useAuthStore()
    const reportsStore = useReportsStore()

    const isOpen = ref(false)
    const buttonEl = ref<HTMLButtonElement | null>(null)
    const markerEl = ref<HTMLElement | null>(null)

    const alreadyReported = computed(() => reportsStore.isReported(props.target))

    // Both names start with the visible word "Report" (WCAG 2.5.3 Label in Name).
    const ariaLabel = computed(() =>
        props.target.kind === 'clarifier'
            ? t('report_action_clarifier_aria')
            : t('report_action_recommendation_aria', {
                  title: props.bookTitle ?? props.target.title ?? ''
              })
    )

    async function closeSheet() {
        isOpen.value = false
        // After a report the button has been replaced by the "Reported" marker.
        await nextTick()
        const next = markerEl.value ?? buttonEl.value
        next?.focus()
    }

    // The session cannot be recovered silently: close the sheet, sign out and go to the login
    // screen, which the router only shows to guests (same as the chat's "Sign in again").
    async function signInAgain() {
        isOpen.value = false
        try {
            await signOut(auth)
            authStore.clearUser()
            router.push('/login')
        } catch (err) {
            console.error('Sign out failed', err)
        }
    }
</script>
