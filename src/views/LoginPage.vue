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
    <div
        class="min-h-screen flex items-center justify-center bg-gradient-to-br from-bookmind-cyan-50 to-bookmind-cyan-100"
    >
        <div class="absolute top-4 right-4 z-10 bg-white p-2 rounded-lg shadow-md">
            <select
                v-model="selectedLanguage"
                @change="changeLanguage"
                class="bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-bookmind-500 focus:border-bookmind-500"
            >
                <option value="en">English</option>
                <option value="it">Italiano</option>
                <option value="es">Español</option>
            </select>
        </div>
        <div class="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
            <div class="flex flex-col items-center space-y-4">
                <img
                    src="@/assets/images/bookmind-logo-tp.png"
                    alt="BookMind Logo"
                    class="w-full h-42"
                />
            </div>
            <form @submit.prevent="login" class="mt-8 space-y-6">
                <div class="rounded-md shadow-sm -space-y-px">
                    <div>
                        <label for="email" class="sr-only">Email</label>
                        <input
                            id="email"
                            v-model="email"
                            type="email"
                            required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-bookmind-300 placeholder-bookmind-500 text-bookmind-900 rounded-t-md focus:outline-none focus:ring-bookmind-500 focus:border-bookmind-500 focus:z-10 sm:text-sm"
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
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-bookmind-300 placeholder-bookmind-500 text-bookmind-900 rounded-b-md focus:outline-none focus:ring-bookmind-500 focus:border-bookmind-500 focus:z-10 sm:text-sm"
                            :placeholder="t('password_placeholder')"
                        />
                    </div>
                </div>

                <div>
                    <CTAButton type="submit">{{ t('login') }}</CTAButton>
                </div>
            </form>
            <div v-if="errorMessage" class="mt-3 text-sm text-red-600">
                {{ errorMessage }}
            </div>
            <div class="flex items-center justify-between mt-4 text-sm">
                <a href="#" class="font-medium text-bookmind-600 hover:text-bookmind-500" @click.prevent="navigateToForgotPassword">
                    {{ t('forgot_password') }}
                </a>
                <router-link
                    to="/register"
                    class="font-medium text-bookmind-600 hover:text-bookmind-500"
                >
                    {{ t('register') }}
                </router-link>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .language-selector {
        position: absolute;
        top: 10px;
        right: 10px;
    }
</style>
