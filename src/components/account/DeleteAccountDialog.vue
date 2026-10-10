<template>
    <div
        ref="rootEl"
        :class="['dad-root', centred ? 'dad-root--centred' : 'dad-root--compact']"
        :style="{ '--bm-kb-inset': `${keyboardInset}px` }"
        @keydown="onKeydown"
        @click.self="onScrimClick"
    >
        <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-lead"
            :aria-busy="inProgress ? 'true' : 'false'"
            novalidate
            :class="[
                'dad-panel',
                centred ? 'dad-panel--centred' : 'dad-panel--compact',
                tight ? 'dad-panel--tight' : ''
            ]"
            @submit.prevent="submit"
        >
            <!-- Header. In the centred presentation it holds the title; on compact it is only the top bar. -->
            <div :class="centred ? 'dad-header' : 'dad-bar'">
                <button
                    type="button"
                    class="dad-close"
                    :aria-label="t('delete_account_close')"
                    :disabled="inProgress"
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
                    v-if="centred"
                    id="delete-account-title"
                    ref="titleEl"
                    tabindex="-1"
                    class="dad-title font-serif text-2xl text-ink-900"
                >
                    {{ t('delete_account_title') }}
                </h2>
            </div>

            <div class="dad-body">
                <div class="dad-column">
                    <h2
                        v-if="!centred"
                        id="delete-account-title"
                        ref="titleEl"
                        tabindex="-1"
                        class="dad-title font-serif text-2xl text-ink-900"
                    >
                        {{ t('delete_account_title') }}
                    </h2>
                    <p id="delete-account-lead" class="text-base text-ink-700">
                        {{ t('delete_account_lead') }}
                    </p>

                    <!-- What is deleted now -->
                    <section class="bg-red-50 border border-red-100 rounded-xl p-4">
                        <h3
                            class="flex items-center gap-2 text-sm font-semibold font-sans text-ink-800"
                        >
                            <svg
                                class="w-4 h-4 shrink-0 text-red-700"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                            {{ t('delete_account_deleted_heading') }}
                        </h3>
                        <ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-ink-700">
                            <li>{{ t('delete_account_deleted_account') }}</li>
                            <li>{{ t('delete_account_deleted_device') }}</li>
                        </ul>
                    </section>

                    <!-- What is kept, and for how long -->
                    <section class="bg-ink-50 border border-ink-200 rounded-xl p-4">
                        <h3
                            class="flex items-center gap-2 text-sm font-semibold font-sans text-ink-800"
                        >
                            <svg
                                class="w-4 h-4 shrink-0 text-ink-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            {{ t('delete_account_kept_heading') }}
                        </h3>
                        <ul class="mt-2 list-disc pl-5 space-y-1 text-sm text-ink-700">
                            <li>{{ t('delete_account_kept_counter') }}</li>
                            <li>
                                {{
                                    t('delete_account_kept_ai', {
                                        provider: AI_PROVIDER.name,
                                        days: AI_PROVIDER.retentionDays
                                    })
                                }}
                            </li>
                            <li>{{ t('delete_account_kept_logs') }}</li>
                            <li>{{ t('delete_account_kept_other_devices') }}</li>
                        </ul>
                    </section>

                    <p class="text-sm text-ink-600 break-words">
                        <i18n-t keypath="delete_account_signed_in_as" scope="global" tag="span">
                            <template #email>
                                <span class="font-medium text-ink-800 break-all">
                                    {{ accountEmail }}
                                </span>
                            </template>
                        </i18n-t>
                    </p>

                    <!-- Password. The hidden username field lets password managers pair the credential. -->
                    <div>
                        <input
                            type="email"
                            autocomplete="username"
                            readonly
                            tabindex="-1"
                            aria-hidden="true"
                            class="sr-only"
                            :value="accountEmail"
                        />
                        <label
                            ref="labelEl"
                            for="delete-account-password"
                            class="block text-sm font-medium font-sans text-ink-700 mb-1"
                        >
                            {{ t('delete_account_password_label') }}
                        </label>
                        <input
                            id="delete-account-password"
                            ref="passwordEl"
                            v-model="password"
                            type="password"
                            autocomplete="current-password"
                            enterkeyhint="go"
                            class="form-input min-h-12"
                            :class="fieldError ? 'border-red-400' : ''"
                            :disabled="inProgress"
                            :aria-invalid="fieldError ? 'true' : 'false'"
                            :aria-describedby="
                                fieldError ? 'delete-account-field-error' : undefined
                            "
                            @focus="onPasswordFocus"
                            @input="fieldError = ''"
                        />
                        <p
                            v-if="fieldError"
                            id="delete-account-field-error"
                            class="mt-1 text-sm text-red-700"
                        >
                            {{ t(fieldError) }}
                        </p>

                        <button
                            type="button"
                            class="dad-link inline-flex min-h-11 items-center gap-2 text-sm text-accent-700 underline underline-offset-2 disabled:no-underline disabled:text-ink-400"
                            :disabled="inProgress || resetState === 'sending'"
                            :aria-busy="resetState === 'sending' ? 'true' : 'false'"
                            @click="sendReset"
                        >
                            {{ t('forgot_password') }}
                            <svg
                                v-if="resetState === 'sending'"
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
                        </button>
                        <!-- Reset status: always mounted so screen readers announce it. It is separate
                             from the deletion error box, so neither replaces the other. -->
                        <p
                            aria-live="polite"
                            class="text-sm"
                            :class="resetState === 'sent' ? 'text-sage-700' : 'text-red-700'"
                        >
                            <i18n-t
                                v-if="resetState === 'sent'"
                                keypath="delete_account_reset_sent"
                                scope="global"
                                tag="span"
                            >
                                <template #email>
                                    <span class="font-medium break-all">{{ accountEmail }}</span>
                                </template>
                            </i18n-t>
                            <template v-else-if="resetState === 'error'">
                                {{ t('delete_account_reset_error') }}
                            </template>
                        </p>
                    </div>

                    <!-- Deletion error box: always mounted, filled on error. -->
                    <div role="alert">
                        <div
                            v-if="errorKey"
                            class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm"
                        >
                            {{ t(errorKey) }}
                            <button
                                v-if="showSessionAction"
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
                        {{ inProgress ? t('delete_account_in_progress') : '' }}
                    </p>
                </div>
            </div>

            <div :class="centred ? 'dad-footer' : 'dad-actions'">
                <button
                    ref="confirmEl"
                    type="submit"
                    class="dad-btn dad-btn--danger"
                    :aria-disabled="inProgress ? 'true' : undefined"
                >
                    <template v-if="inProgress">
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
                        {{ t('delete_account_in_progress') }}
                    </template>
                    <template v-else>{{ t('delete_account_confirm') }}</template>
                </button>
                <button
                    type="button"
                    class="dad-btn dad-btn--secondary"
                    :disabled="inProgress"
                    @click="requestClose"
                >
                    {{ t('delete_account_cancel') }}
                </button>
            </div>
        </form>
    </div>
</template>

<script setup lang="ts">
    import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
    import { useI18n } from 'vue-i18n'
    import { AI_PROVIDER } from '@/constants/aiProvider'
    import {
        DeleteAccountError,
        deleteAccount,
        sendAccountPasswordReset
    } from '@/services/account/deleteAccount'
    import { useAuthStore } from '@/stores/auth'
    import { useBackButton } from '@/composables/useBackButton'

    const emit = defineEmits<{
        /** The user left the dialog without deleting anything (Cancel, x, Escape, scrim). */
        (e: 'close'): void
        /** The account is gone: the parent closes its menu and goes to /login?deleted=1. */
        (e: 'deleted'): void
        /** Session gone: the parent signs the user out and goes to /login. */
        (e: 'sign-in-again'): void
    }>()

    const { t } = useI18n()
    const authStore = useAuthStore()

    // Read once: `deleteUser` signs the user out, which would blank the address while the dialog is
    // still on screen.
    const accountEmail = authStore.user?.email ?? ''

    const password = ref('')
    const fieldError = ref('')
    const errorKey = ref('')
    const showSessionAction = ref(false)
    const inProgress = ref(false)
    const resetState = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')

    const rootEl = ref<HTMLElement | null>(null)
    const titleEl = ref<HTMLElement | null>(null)
    const passwordEl = ref<HTMLInputElement | null>(null)
    const labelEl = ref<HTMLElement | null>(null)
    const confirmEl = ref<HTMLButtonElement | null>(null)
    const sessionActionEl = ref<HTMLButtonElement | null>(null)

    // ---- Presentation: decided by available width and height, never by device or orientation. ----
    // Compact width (< 600) or compact height (< 480, e.g. a landscape phone) gets the full-screen
    // dialog; everything else the centred modal.
    const centredQuery =
        typeof window.matchMedia === 'function'
            ? window.matchMedia('(min-width: 600px) and (min-height: 480px)')
            : null
    const centred = ref(centredQuery?.matches ?? false)
    const onPresentationChange = (event: MediaQueryListEvent) => {
        centred.value = event.matches
    }

    // ---- Keyboard inset: Android 15+ draws edge-to-edge and the WebView may not resize, so the
    // dialog measures the on-screen keyboard itself. ----
    const keyboardInset = ref(0)
    // Height the user can actually see: it shrinks when the on-screen keyboard opens.
    const viewportHeight = ref(window.visualViewport?.height ?? window.innerHeight)
    // On a landscape phone with the keyboard open there can be ~100 px left, less than the sticky
    // top bar plus action bar. Below this height the bars stop being sticky and scroll with the
    // content, so the field and the primary action can always be scrolled into view.
    const TIGHT_BELOW_PX = 340
    const tight = computed(() => !centred.value && viewportHeight.value < TIGHT_BELOW_PX)
    const updateKeyboardInset = () => {
        const viewport = window.visualViewport
        viewportHeight.value = viewport?.height ?? window.innerHeight
        if (!viewport) return
        keyboardInset.value = Math.max(
            0,
            Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
        )
    }

    function onPasswordFocus() {
        // Tight: put the label at the top so label and field are both visible in what is left.
        const scrollToField = () =>
            tight.value
                ? labelEl.value?.scrollIntoView({ block: 'start' })
                : passwordEl.value?.scrollIntoView({ block: 'center' })
        scrollToField()
        // Scroll again once the keyboard has finished opening: that is a visualViewport resize.
        window.visualViewport?.addEventListener('resize', scrollToField, { once: true })
    }

    // ---- The rest of the app is inert while the dialog is open (neither touch, Tab nor a
    // screen-reader swipe may reach it). The dialog itself is teleported to <body>, outside #app. ----
    const appRoot = () => document.getElementById('app')
    function releaseApp() {
        appRoot()?.removeAttribute('inert')
    }

    function onOnline() {
        if (errorKey.value === 'delete_account_error_offline') errorKey.value = ''
    }

    onMounted(() => {
        appRoot()?.setAttribute('inert', '')
        centredQuery?.addEventListener('change', onPresentationChange)
        window.visualViewport?.addEventListener('resize', updateKeyboardInset)
        window.visualViewport?.addEventListener('scroll', updateKeyboardInset)
        window.addEventListener('online', onOnline)
        window.addEventListener('resize', updateKeyboardInset)
        updateKeyboardInset()
        // The title takes focus, not the field, so the keyboard does not cover the explanation.
        void nextTick(() => titleEl.value?.focus({ preventScroll: true }))
    })

    onBeforeUnmount(() => {
        releaseApp()
        centredQuery?.removeEventListener('change', onPresentationChange)
        window.visualViewport?.removeEventListener('resize', updateKeyboardInset)
        window.visualViewport?.removeEventListener('scroll', updateKeyboardInset)
        window.removeEventListener('online', onOnline)
        window.removeEventListener('resize', updateKeyboardInset)
        password.value = ''
    })

    // ---- Closing ----
    function requestClose() {
        if (inProgress.value) return
        password.value = ''
        releaseApp()
        emit('close')
    }

    // Android Back: closes the dialog like Escape when idle, is ignored while the deletion runs.
    // Scoped to the dialog's lifetime, so Back behaves as before once it is gone.
    useBackButton(requestClose)

    function onScrimClick() {
        // The scrim only exists in the centred presentation.
        if (centred.value) requestClose()
    }

    const FOCUSABLE =
        'button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), a[href], [tabindex]:not([tabindex="-1"]):not(:disabled)'

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            if (!inProgress.value) {
                event.preventDefault()
                requestClose()
            }
            return
        }
        if (event.key !== 'Tab' || !rootEl.value) return

        // Trap focus inside the dialog, wrapping in both directions.
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

    // ---- Deletion ----
    async function submit() {
        if (inProgress.value) return
        fieldError.value = ''
        errorKey.value = ''
        showSessionAction.value = false

        if (!password.value) {
            fieldError.value = 'delete_account_error_empty'
            passwordEl.value?.focus()
            return
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            errorKey.value = 'delete_account_error_offline'
            return
        }

        inProgress.value = true
        // The field is about to be disabled: park focus on the (aria-disabled) confirm button.
        confirmEl.value?.focus()
        try {
            await deleteAccount(password.value)
        } catch (error) {
            inProgress.value = false
            await showFailure(error instanceof DeleteAccountError ? error.kind : 'generic')
            return
        }

        // The account is gone. No success state here: the parent closes the menu and lands on
        // /login?deleted=1. A reset request still in flight is ignored.
        resetState.value = 'idle'
        password.value = ''
        authStore.clearUser()
        releaseApp()
        emit('deleted')
    }

    async function showFailure(kind: DeleteAccountError['kind']) {
        switch (kind) {
            case 'wrong-password':
                fieldError.value = 'delete_account_error_wrong_password'
                await nextTick()
                passwordEl.value?.focus()
                passwordEl.value?.select()
                break
            case 'reauth-needed':
                password.value = ''
                fieldError.value = 'delete_account_error_reauth'
                await nextTick()
                passwordEl.value?.focus()
                break
            case 'too-many-attempts':
                errorKey.value = 'delete_account_error_too_many'
                break
            case 'session':
                errorKey.value = 'delete_account_error_session'
                showSessionAction.value = true
                await nextTick()
                sessionActionEl.value?.focus()
                break
            case 'network':
                errorKey.value = 'delete_account_error_offline'
                await nextTick()
                confirmEl.value?.focus()
                break
            default:
                errorKey.value = 'delete_account_error_generic'
                await nextTick()
                confirmEl.value?.focus()
        }
    }

    function signInAgain() {
        releaseApp()
        emit('sign-in-again')
    }

    // ---- Forgot password: sends the Firebase reset email from inside the dialog ----
    const resetBlocked = computed(() => inProgress.value || resetState.value === 'sending')
    async function sendReset() {
        if (resetBlocked.value) return
        resetState.value = 'idle'
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            resetState.value = 'error'
            return
        }
        resetState.value = 'sending'
        try {
            await sendAccountPasswordReset(accountEmail)
            // Ignore the result if the account was deleted meanwhile (state already reset).
            if (resetState.value === 'sending') resetState.value = 'sent'
        } catch (error) {
            console.error('Password reset email failed', error)
            if (resetState.value === 'sending') resetState.value = 'error'
        }
    }
</script>

<style scoped>
    /* Presentation is chosen in script (matchMedia on width AND height) and mirrored here. */
    .dad-root {
        position: fixed;
        inset: 0;
        z-index: 60;
    }

    /* ---- Full screen (compact width or compact height) ---- */
    .dad-root--compact {
        background: #fff;
    }
    .dad-panel--compact {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
    .dad-bar {
        display: flex;
        align-items: center;
        flex: none;
        height: calc(56px + var(--bm-safe-top));
        padding-top: var(--bm-safe-top);
        padding-left: calc(0.5rem + var(--bm-safe-left));
        padding-right: calc(0.5rem + var(--bm-safe-right));
    }
    .dad-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    .dad-panel--compact .dad-body {
        padding: 0.5rem calc(1rem + var(--bm-safe-right)) 1.5rem calc(1rem + var(--bm-safe-left));
    }
    .dad-column {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        max-width: 65ch;
        margin: 0 auto;
        /* At large text sizes a long word must wrap instead of forcing a horizontal scroll. */
        overflow-wrap: anywhere;
    }
    .dad-actions {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-top: 1px solid #e8e4dd;
        background: #fff;
        padding: 0.75rem calc(1rem + var(--bm-safe-right))
            calc(0.75rem + max(var(--bm-safe-bottom), var(--bm-kb-inset, 0px)))
            calc(1rem + var(--bm-safe-left));
    }

    /* ---- Tight: full-screen with under ~340 px visible (landscape phone + keyboard) ----
       Nothing is sticky: the whole panel scrolls, and the two actions share one row. */
    .dad-panel--tight {
        display: block;
        overflow-y: auto;
        overscroll-behavior: contain;
        height: calc(100% - var(--bm-kb-inset, 0px));
    }
    .dad-panel--tight .dad-body {
        overflow: visible;
    }
    .dad-panel--tight .dad-actions {
        flex-direction: row;
        flex-wrap: wrap;
        padding-bottom: calc(0.75rem + var(--bm-safe-bottom));
    }
    .dad-panel--tight .dad-actions .dad-btn {
        flex: 1 1 10rem;
    }

    /* ---- Centred modal (width >= 600 and height >= 480) ---- */
    .dad-root--centred {
        display: grid;
        place-items: center;
        background: rgb(26 22 20 / 0.5);
        padding: calc(24px + var(--bm-safe-top)) calc(24px + var(--bm-safe-right))
            calc(24px + max(var(--bm-safe-bottom), var(--bm-kb-inset, 0px)))
            calc(24px + var(--bm-safe-left));
    }
    .dad-panel--centred {
        display: flex;
        flex-direction: column;
        width: min(560px, 100%);
        max-height: calc(
            100dvh - 48px - var(--bm-safe-top) - max(var(--bm-safe-bottom), var(--bm-kb-inset, 0px))
        );
        overflow: hidden;
        background: #fff;
        border: 1px solid #e8e4dd;
        border-radius: 1rem;
        box-shadow:
            0 20px 25px -5px rgb(0 0 0 / 0.1),
            0 8px 10px -6px rgb(0 0 0 / 0.1);
    }
    .dad-header {
        /* The close button comes first in the DOM (focus order) and is drawn top-right. */
        display: flex;
        flex-direction: row-reverse;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        flex: none;
        padding: 1.5rem 1rem 0.5rem 1.5rem;
    }
    .dad-panel--centred .dad-title {
        flex: 1 1 auto;
        min-width: 0;
        padding-top: 0.25rem;
    }
    .dad-panel--centred .dad-body {
        padding: 0 1.5rem 1rem;
    }
    .dad-footer {
        flex: none;
        display: flex;
        /* Delete comes first in the DOM (focus order) and is drawn on the right. */
        flex-direction: row-reverse;
        flex-wrap: wrap;
        gap: 0.75rem;
        border-top: 1px solid #e8e4dd;
        padding: 1rem 1.5rem;
    }

    /* ---- Shared ---- */
    .dad-title:focus {
        outline: none;
    }
    .dad-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 48px;
        height: 48px;
        border-radius: 9999px;
        color: #565048;
    }
    .dad-close:hover {
        background: #f5f3ef;
    }
    .dad-close:disabled {
        color: #a8a193;
    }
    .dad-btn {
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
        text-align: center;
    }
    .dad-btn:focus-visible,
    .dad-close:focus-visible,
    .dad-link:focus-visible {
        outline: none;
        box-shadow:
            0 0 0 2px #fff,
            0 0 0 4px #dc2626;
    }
    .dad-btn--danger {
        background: #b91c1c;
        color: #fff;
    }
    .dad-btn--danger:hover,
    .dad-btn--danger:active {
        background: #991b1b;
    }
    .dad-btn--danger[aria-disabled='true'] {
        background: #b91c1c;
        opacity: 0.8;
        cursor: progress;
    }
    .dad-btn--secondary {
        border: 1px solid #d4cfc5;
        color: #3d3831;
    }
    .dad-btn--secondary:hover {
        border-color: #7c7568;
        color: #1a1614;
    }
    .dad-btn--secondary:disabled {
        color: #a8a193;
        border-color: #e8e4dd;
    }

    /* ---- Motion: 200 ms slide-up + fade on compact, 150 ms fade + scale on centred. ---- */
    .dad-enter-active {
        transition:
            opacity 200ms ease-out,
            transform 200ms ease-out;
    }
    .dad-leave-active {
        transition:
            opacity 150ms ease-in,
            transform 150ms ease-in;
    }
    .dad-enter-from,
    .dad-leave-to {
        opacity: 0;
    }
    .dad-root--compact.dad-enter-from,
    .dad-root--compact.dad-leave-to {
        transform: translateY(16px);
    }
    .dad-root--centred.dad-enter-from .dad-panel,
    .dad-root--centred.dad-leave-to .dad-panel {
        transform: scale(0.95);
    }
    .dad-root--centred .dad-panel {
        transition: transform 150ms ease-out;
    }
    @media (prefers-reduced-motion: reduce) {
        .dad-root--compact.dad-enter-from,
        .dad-root--compact.dad-leave-to,
        .dad-root--centred.dad-enter-from .dad-panel,
        .dad-root--centred.dad-leave-to .dad-panel {
            transform: none;
        }
    }
</style>
