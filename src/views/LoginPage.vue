<script setup lang="ts">
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { signInWithEmailAndPassword } from 'firebase/auth'
    import { useI18n } from 'vue-i18n'
    import { initAuth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'
    import { useLanguageStore } from '@/stores/language'
    import type { SupportedLocale } from '@/types/userPreferences'
    import CTAButton from '@/components/ui/CTAButton.vue'

    const { t, locale } = useI18n()
    const auth = initAuth()
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
