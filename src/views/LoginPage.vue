<script setup lang="ts">
    import { nextTick, onMounted, ref } from 'vue'
    import { useRoute, useRouter } from 'vue-router'
    import { signInWithEmailAndPassword } from 'firebase/auth'
    import { useI18n } from 'vue-i18n'
    import { initAuth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'
    import { useLanguageStore } from '@/stores/language'
    import type { SupportedLocale } from '@/types/userPreferences'
    import CTAButton from '@/components/ui/CTAButton.vue'

    const { t, locale } = useI18n()
    const auth = initAuth()
    const route = useRoute()
    const router = useRouter()
    const authStore = useAuthStore()
    const languageStore = useLanguageStore()

    const email = ref('')
    const password = ref('')
    const errorMessage = ref('')
    const selectedLanguage = ref<SupportedLocale>(languageStore.selectedLanguage)

    const login = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email.value,
                password.value
            )
            authStore.setUser(userCredential.user)
            router.push('/')
        } catch (error: any) {
            if (error instanceof Error) {
                errorMessage.value = error.message
            } else {
                errorMessage.value = 'An unexpected error occurred'
            }
        }
    }

    // /login?deleted=1 is where account deletion lands (card #63). Read once, kept in state, then drop
    // the query so a reload or Back does not show the confirmation again.
    const accountDeleted = ref(route.query.deleted === '1')
    const deletedHeading = ref<HTMLElement | null>(null)

    onMounted(async () => {
        if (!accountDeleted.value) return
        await router.replace({ query: {} })
        await nextTick()
        // Focus the heading so screen readers read the confirmation first.
        deletedHeading.value?.focus()
    })

    const changeLanguage = () => {
        languageStore.setLanguage(selectedLanguage.value)
        locale.value = selectedLanguage.value
    }

    const navigateToForgotPassword = () => {
        router.push('/forgot-password')
    }
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-ink-50 px-4">
        <!-- Language selector -->
        <div class="absolute top-6 right-6">
            <select
                v-model="selectedLanguage"
                @change="changeLanguage"
                class="form-select"
            >
                <option value="en">English</option>
                <option value="it">Italiano</option>
                <option value="es">Español</option>
            </select>
        </div>

        <!-- Login card -->
        <div class="max-w-md w-full bg-white border border-ink-200 shadow-sm rounded-2xl p-10">
            <!-- Account deleted: stays until the user leaves the page, with nothing to tap by mistake. -->
            <div
                v-if="accountDeleted"
                role="status"
                class="mb-6 flex items-start gap-3 bg-sage-50 border border-sage-200 rounded-xl p-4"
            >
                <svg
                    class="w-5 h-5 mt-0.5 shrink-0 text-sage-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <div>
                    <h2
                        ref="deletedHeading"
                        tabindex="-1"
                        class="font-sans text-sm font-semibold text-sage-800 focus:outline-none"
                    >
                        {{ t('delete_account_done_title') }}
                    </h2>
                    <p class="text-sm text-sage-800">{{ t('delete_account_done_body') }}</p>
                </div>
            </div>

            <!-- Logo -->
            <div class="flex justify-center mb-8">
                <img
                    src="@/assets/images/bookmind-logo-tp.png"
                    alt="BookMind Logo"
                    class="w-full h-42"
                />
            </div>

            <!-- Form -->
            <form @submit.prevent="login" class="space-y-4">
                <div>
                    <label for="email" class="sr-only">Email</label>
                    <input
                        id="email"
                        v-model="email"
                        type="email"
                        required
                        class="form-input"
                        :placeholder="t('email_placeholder')"
                    />
                </div>

                <div>
                    <label for="password" class="sr-only">{{ t('password') }}</label>
                    <input
                        id="password"
                        v-model="password"
                        type="password"
                        required
                        class="form-input"
                        :placeholder="t('password_placeholder')"
                    />
                </div>

                <div class="pt-2">
                    <CTAButton type="submit" variant="primary">
                        {{ t('login') }}
                    </CTAButton>
                </div>
            </form>

            <!-- Error message -->
            <div v-if="errorMessage" class="mt-4 text-sm text-red-600 font-sans">
                {{ errorMessage }}
            </div>

            <!-- Links -->
            <div class="flex items-center justify-between mt-6 text-sm font-sans">
                <a
                    href="#"
                    class="text-accent-600 hover:text-accent-700 transition-colors"
                    @click.prevent="navigateToForgotPassword"
                >
                    {{ t('forgot_password') }}
                </a>
                <router-link
                    to="/register"
                    class="text-accent-600 hover:text-accent-700 transition-colors"
                >
                    {{ t('register') }}
                </router-link>
            </div>
        </div>
    </div>
</template>
