<template>
    <div
        ref="rootEl"
        :class="['rs-root', centred ? 'rs-root--centred' : 'rs-root--sheet']"
        @keydown="onKeydown"
        @click="onRootClick"
    >
        <div class="rs-box">
            <form
                ref="panelEl"
                role="dialog"
                aria-modal="true"
                :aria-labelledby="isSent ? 'report-sheet-sent-title' : 'report-sheet-title'"
                :aria-describedby="isSent ? undefined : 'report-sheet-quote'"
                :aria-busy="isSending ? 'true' : 'false'"
                novalidate
                :class="['rs-panel', centred ? 'rs-panel--centred' : 'rs-panel--sheet']"
                @submit.prevent="submit"
            >
                <!-- The close button comes first in the DOM (focus order) and is drawn top-right. -->
                <div :class="['rs-header', centred ? 'rs-header--centred' : 'rs-header--sheet']">
                    <button
                        type="button"
                        class="rs-close"
                        :aria-label="t('report_close')"
                        :disabled="isSending"
                        @click="requestClose"
                    >
                        <svg
                            class="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                    <h2
                        v-if="!isSent"
                        id="report-sheet-title"
                        ref="titleEl"
                        tabindex="-1"
                        class="rs-title font-serif text-xl text-ink-900"
                    >
                        {{
                            t(
                                target.kind === 'clarifier'
                                    ? 'report_title_clarifier'
                                    : 'report_title_recommendation'
                            )
                        }}
                    </h2>
                </div>

                <!-- Sent -->
                <div
                    v-if="isSent"
                    role="status"
                    :class="['rs-body', centred ? 'rs-body--centred' : 'rs-body--sheet']"
                >
                    <div class="space-y-2 pb-2">
                        <svg
                            class="w-6 h-6 text-sage-700"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                            aria-hidden="true"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                            />
                        </svg>
                        <h2
                            id="report-sheet-sent-title"
                            ref="sentTitleEl"
                            tabindex="-1"
                            class="rs-title font-serif text-xl text-ink-900"
                        >
                            {{ t('report_sent_title') }}
                        </h2>
                        <p class="text-sm text-ink-700">{{ t('report_sent_body') }}</p>
                    </div>
                </div>

                <!-- Choose a reason -->
                <div v-else :class="['rs-body', centred ? 'rs-body--centred' : 'rs-body--sheet']">
                    <div class="space-y-4">
                        <blockquote
                            id="report-sheet-quote"
                            class="bg-ink-50 border-l-2 border-ink-300 rounded-r-lg px-3 py-2"
                        >
                            <template v-if="target.kind === 'clarifier'">
                                <p class="font-serif italic text-sm text-ink-700 line-clamp-4">
                                    {{ target.text }}
                                </p>
                            </template>
                            <template v-else>
                                <p class="font-serif font-semibold text-sm text-ink-800">
                                    {{ target.title }}
                                </p>
                                <p v-if="target.author" class="text-xs text-ink-600">
                                    {{ target.author }}
                                </p>
                                <p
                                    v-if="target.text"
                                    class="mt-1 font-serif italic text-sm text-ink-700 line-clamp-3"
                                >
                                    {{ target.text }}
                                </p>
                            </template>
                        </blockquote>

                        <fieldset :disabled="isSending" class="min-w-0">
                            <legend class="text-sm font-semibold font-sans text-ink-800 mb-2">
                                {{ t('report_reason_legend') }}
                            </legend>
                            <div class="space-y-2">
                                <label
                                    v-for="option in REPORT_REASONS"
                                    :key="option"
                                    :class="[
                                        'flex items-start gap-3 min-h-14 rounded-xl border px-4 py-3 cursor-pointer',
                                        'active:bg-ink-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink-400',
                                        reason === option
                                            ? 'border-ink-900 bg-ink-50'
                                            : 'border-ink-200 bg-white',
                                        isSending ? 'opacity-60 cursor-default' : ''
                                    ]"
                                >
                                    <input
                                        v-model="reason"
                                        type="radio"
                                        name="report-reason"
                                        :value="option"
                                        :aria-labelledby="`report-reason-label-${option}`"
                                        :aria-describedby="`report-reason-hint-${option}`"
                                        class="w-5 h-5 mt-0.5 shrink-0 accent-ink-900"
                                    />
                                    <span class="min-w-0 font-sans">
                                        <span
                                            :id="`report-reason-label-${option}`"
                                            class="block text-sm font-medium text-ink-900"
                                        >
                                            {{ t(`report_reason_${option}`) }}
                                        </span>
                                        <span
                                            :id="`report-reason-hint-${option}`"
                                            class="block text-sm text-ink-600"
                                        >
                                            {{ t(`report_reason_${option}_hint`) }}
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </fieldset>

                        <p class="text-xs text-ink-600 font-sans">
                            {{ t('report_privacy_note') }}
                        </p>

                        <!-- Error box: always mounted so screen readers announce it when filled. -->
                        <div role="alert">
                            <div
                                v-if="errorKind"
                                class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm"
                            >
                                {{ t(`report_error_${errorKind}`) }}
                                <button
                                    v-if="errorKind === 'session'"
                                    ref="sessionActionEl"
                                    type="button"
                                    class="mt-1 flex min-h-11 items-center font-medium underline underline-offset-2"
                                    @click="signInAgain"
                                >
                                    {{ t('chat_error_session_action') }}
                                </button>
                            </div>
                        </div>

                        <p class="sr-only" aria-live="polite">
                            {{ isSending ? t('report_sending') : '' }}
                        </p>
                    </div>
                </div>

                <!-- Actions. Send comes first in the DOM (focus order); CSS draws it on the right. -->
                <div :class="['rs-actions', centred ? 'rs-actions--centred' : 'rs-actions--sheet']">
                    <template v-if="isSent">
                        <button
                            ref="doneEl"
                            type="button"
                            class="rs-btn rs-btn--primary"
                            @click="requestClose"
                        >
                            {{ t('report_done') }}
                        </button>
                    </template>
                    <template v-else>
                        <button
                            v-if="canSend"
                            ref="sendEl"
                            type="submit"
                            class="rs-btn rs-btn--primary"
                            :disabled="!reason"
                            :aria-disabled="isSending ? 'true' : undefined"
                        >
                            <template v-if="isSending">
                                <svg
                                    class="w-4 h-4 animate-spin motion-reduce:animate-none"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <circle
                                        class="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        stroke-width="4"
                                    />
                                    <path
                                        class="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                    />
                                </svg>
                                {{ t('report_sending') }}
                            </template>
                            <template v-else>{{ t('report_send') }}</template>
                        </button>
                        <button
                            ref="cancelEl"
                            type="button"
                            class="rs-btn rs-btn--secondary"
                            :disabled="isSending"
                            @click="requestClose"
                        >
                            {{ canSend ? t('report_cancel') : t('report_close') }}
                        </button>
                    </template>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
    import { useI18n } from 'vue-i18n'
    import { useBackButton } from '@/composables/useBackButton'
    import type { ReportErrorKind } from '@/services/api/axios'
    import {
        REPORT_REASONS,
        ReportError,
        submitReport,
        type ReportReason,
        type ReportTarget
    } from '@/services/reports/reportAiContent'

    const props = defineProps<{ target: ReportTarget }>()

    const emit = defineEmits<{
        /** The user left the sheet (Cancel, Close, x, Escape, scrim, Back, Done). */
        (e: 'close'): void
        /** The backend accepted the report. The sheet stays open on its "sent" state. */
        (e: 'reported'): void
        /** Session gone: the parent signs the user out and goes to /login. */
        (e: 'sign-in-again'): void
    }>()

    const { t } = useI18n()

    const phase = ref<'idle' | 'sending' | 'sent'>('idle')
    const reason = ref<ReportReason | ''>('')
    const errorKind = ref<ReportErrorKind | ''>('')

    const isSending = computed(() => phase.value === 'sending')
    const isSent = computed(() => phase.value === 'sent')
    // A daily limit or an expired session cannot be fixed by sending again.
    const canSend = computed(() => errorKind.value !== 'quota' && errorKind.value !== 'session')

    const rootEl = ref<HTMLElement | null>(null)
    const panelEl = ref<HTMLElement | null>(null)
    const titleEl = ref<HTMLElement | null>(null)
    const sentTitleEl = ref<HTMLElement | null>(null)
    const sendEl = ref<HTMLButtonElement | null>(null)
    const cancelEl = ref<HTMLButtonElement | null>(null)
    const sessionActionEl = ref<HTMLButtonElement | null>(null)

    // ---- Presentation: decided by available width and height, never by device or orientation. ----
    // Compact width (< 600) or compact height (< 480, e.g. a landscape phone) gets the bottom sheet;
    // everything else the centred dialog. Same rule as the account-deletion dialog.
    const centredQuery =
        typeof window.matchMedia === 'function'
            ? window.matchMedia('(min-width: 600px) and (min-height: 480px)')
            : null
    const centred = ref(centredQuery?.matches ?? false)
    const onPresentationChange = (event: MediaQueryListEvent) => {
        centred.value = event.matches
    }

    // ---- The rest of the app is inert while the sheet is open (neither touch, Tab nor a
    // screen-reader swipe may reach it). The sheet itself is teleported to <body>, outside #app. ----
    const appRoot = () => document.getElementById('app')
    function releaseApp() {
        appRoot()?.removeAttribute('inert')
    }

    onMounted(() => {
        appRoot()?.setAttribute('inert', '')
        centredQuery?.addEventListener('change', onPresentationChange)
        void nextTick(() => titleEl.value?.focus({ preventScroll: true }))
    })

    onBeforeUnmount(() => {
        releaseApp()
        centredQuery?.removeEventListener('change', onPresentationChange)
    })

    // ---- Closing ----
    function requestClose() {
        if (isSending.value) return
        // Release first, so the parent can return focus to the Report button.
        releaseApp()
        emit('close')
    }

    // Android Back: closes the sheet like Escape, and is ignored while a report is being sent.
    useBackButton(requestClose)

    function onRootClick(event: MouseEvent) {
        // A tap on the scrim, outside the panel, cancels.
        if (
            panelEl.value &&
            event.target instanceof Node &&
            !panelEl.value.contains(event.target)
        ) {
            requestClose()
        }
    }

    const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            if (!isSending.value) {
                event.preventDefault()
                requestClose()
            }
            return
        }
        if (event.key !== 'Tab' || !rootEl.value) return

        // Trap focus inside the sheet, wrapping in both directions.
        const focusable = Array.from(rootEl.value.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (event.shiftKey && (active === first || !rootEl.value.contains(active))) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && (active === last || !rootEl.value.contains(active))) {
            event.preventDefault()
            first.focus()
        }
    }

    // ---- Sending ----
    async function submit() {
        // A flag checked first, not only the `disabled` attribute: repeated taps, a double tap or
        // Enter while sending must produce exactly one request.
        // `canSend` too: with Send removed (429, 401) Enter on a radio must not submit the form.
        if (isSending.value || isSent.value || !canSend.value || !reason.value) return
        errorKind.value = ''
        phase.value = 'sending'
        // The radios are about to be disabled: park focus on the (aria-disabled) Send button.
        sendEl.value?.focus()
        try {
            await submitReport(props.target, reason.value)
        } catch (error) {
            phase.value = 'idle'
            await showFailure(error instanceof ReportError ? error.kind : 'generic')
            return
        }
        phase.value = 'sent'
        emit('reported')
        await nextTick()
        sentTitleEl.value?.focus({ preventScroll: true })
    }

    async function showFailure(kind: ReportErrorKind) {
        errorKind.value = kind
        await nextTick()
        if (kind === 'session') sessionActionEl.value?.focus()
        else if (kind === 'quota') cancelEl.value?.focus()
        else sendEl.value?.focus()
    }

    function signInAgain() {
        releaseApp()
        emit('sign-in-again')
    }
</script>

<style scoped>
    /* Presentation is chosen in script (matchMedia on width AND height) and mirrored here. */
    .rs-root {
        position: fixed;
        inset: 0;
        z-index: 60;
        background: rgb(26 22 20 / 0.5);
    }

    /* ---- Bottom sheet (compact width or compact height) ---- */
    .rs-root--sheet .rs-box {
        position: absolute;
        bottom: 0;
        left: var(--bm-safe-left);
        right: var(--bm-safe-right);
    }
    .rs-panel {
        display: flex;
        flex-direction: column;
        background: #fff;
        container-type: inline-size;
    }
    .rs-panel--sheet {
        width: 100%;
        max-width: 640px;
        margin: 0 auto;
        max-height: calc(100dvh - var(--bm-safe-top) - 24px);
        border-top-left-radius: 1rem;
        border-top-right-radius: 1rem;
        box-shadow:
            0 20px 25px -5px rgb(0 0 0 / 0.1),
            0 8px 10px -6px rgb(0 0 0 / 0.1);
    }
    .rs-header {
        display: flex;
        flex-direction: row-reverse;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        flex: none;
    }
    .rs-header--sheet {
        padding: 0.5rem 0.5rem 0 1.25rem;
    }
    .rs-header--sheet .rs-title {
        padding-top: 0.75rem;
    }
    .rs-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        /* At large text sizes a long word must wrap instead of forcing a horizontal scroll. */
        overflow-wrap: anywhere;
    }
    .rs-body--sheet {
        padding: 0.5rem 1.25rem 1rem;
    }
    .rs-actions {
        flex: none;
        display: flex;
        gap: 0.75rem;
        border-top: 1px solid #e8e4dd;
        background: #fff;
    }
    .rs-actions--sheet {
        flex-direction: column;
        padding: 0.75rem 1.25rem calc(0.75rem + var(--bm-safe-bottom));
    }
    .rs-actions--sheet .rs-btn {
        width: 100%;
    }
    /* A panel 480 px or wider (a landscape phone): one row, Send on the right. */
    @container (min-width: 480px) {
        .rs-actions--sheet {
            flex-direction: row-reverse;
        }
        .rs-actions--sheet .rs-btn {
            flex: 1 1 0;
            width: auto;
        }
    }

    /* ---- Centred dialog (width >= 600 and height >= 480) ---- */
    .rs-root--centred {
        display: grid;
        place-items: center;
        padding: calc(24px + var(--bm-safe-top)) calc(24px + var(--bm-safe-right))
            calc(24px + var(--bm-safe-bottom)) calc(24px + var(--bm-safe-left));
    }
    .rs-root--centred .rs-box {
        /* The panel is a size container, so it cannot size its own box: the box sets the width. */
        width: min(480px, 100%);
    }
    .rs-panel--centred {
        width: 100%;
        max-height: calc(100dvh - 48px - var(--bm-safe-top) - var(--bm-safe-bottom));
        overflow: hidden;
        border: 1px solid #e8e4dd;
        border-radius: 1rem;
        box-shadow:
            0 20px 25px -5px rgb(0 0 0 / 0.1),
            0 8px 10px -6px rgb(0 0 0 / 0.1);
    }
    .rs-header--centred {
        padding: 1.25rem 1rem 0 1.5rem;
    }
    .rs-header--centred .rs-title {
        padding-top: 0.25rem;
    }
    .rs-body--centred {
        padding: 0.5rem 1.5rem 1rem;
    }
    .rs-actions--centred {
        flex-direction: row-reverse;
        flex-wrap: wrap;
        justify-content: flex-start;
        padding: 1rem 1.5rem;
    }

    /* ---- Shared ---- */
    .rs-title {
        flex: 1 1 auto;
        min-width: 0;
        /* A long word ("recommendation", "segnalazione") must wrap at 320 px with 200 % text. */
        overflow-wrap: anywhere;
    }
    .rs-title:focus {
        outline: none;
    }
    .rs-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 48px;
        height: 48px;
        border-radius: 9999px;
        color: #565048;
    }
    .rs-close:hover {
        background: #f5f3ef;
    }
    .rs-close:disabled {
        color: #a8a193;
    }
    .rs-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        min-height: 3rem;
        padding: 0.5rem 1.5rem;
        border-radius: 0.5rem;
        font-family: Inter, system-ui, sans-serif;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.25rem;
        letter-spacing: 0.025em;
        text-align: center;
    }
    .rs-btn:focus-visible,
    .rs-close:focus-visible {
        outline: none;
        box-shadow:
            0 0 0 2px #fff,
            0 0 0 4px #7c7568;
    }
    .rs-btn--primary {
        background: #1a1614;
        color: #faf9f7;
    }
    .rs-btn--primary:hover {
        background: #2a2520;
    }
    .rs-btn--primary:active {
        background: #3d3831;
    }
    .rs-btn--primary:disabled {
        background: #e8e4dd;
        color: #a8a193;
        cursor: not-allowed;
    }
    .rs-btn--primary[aria-disabled='true'] {
        opacity: 0.8;
        cursor: progress;
    }
    .rs-btn--secondary {
        border: 1px solid #d4cfc5;
        color: #3d3831;
    }
    .rs-btn--secondary:hover {
        border-color: #7c7568;
        color: #1a1614;
    }
    .rs-btn--secondary:disabled {
        color: #a8a193;
        border-color: #e8e4dd;
    }

    /* ---- Motion: the sheet slides up over 220 ms; the dialog fades and scales over 150 ms. ---- */
    .rs-enter-active {
        transition: opacity 220ms cubic-bezier(0.2, 0, 0, 1);
    }
    .rs-leave-active {
        transition: opacity 150ms ease-in;
    }
    .rs-enter-from,
    .rs-leave-to {
        opacity: 0;
    }
    .rs-root--sheet .rs-panel {
        transition: transform 220ms cubic-bezier(0.2, 0, 0, 1);
    }
    .rs-root--sheet.rs-enter-from .rs-panel,
    .rs-root--sheet.rs-leave-to .rs-panel {
        transform: translateY(100%);
    }
    .rs-root--centred .rs-panel {
        transition: transform 150ms ease-out;
    }
    .rs-root--centred.rs-enter-from .rs-panel,
    .rs-root--centred.rs-leave-to .rs-panel {
        transform: scale(0.95);
    }
    @media (prefers-reduced-motion: reduce) {
        .rs-root--sheet.rs-enter-from .rs-panel,
        .rs-root--sheet.rs-leave-to .rs-panel,
        .rs-root--centred.rs-enter-from .rs-panel,
        .rs-root--centred.rs-leave-to .rs-panel {
            transform: none;
        }
    }
</style>
