<template>
    <div
        class="min-h-screen flex items-center justify-center bg-gradient-to-br from-bookmind-cyan-50 to-bookmind-cyan-100"
    >
        <div class="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
            <div class="flex flex-col items-center space-y-4">
                <h2 class="text-3xl font-extrabold text-bookmind-800 text-center">
                    {{ t('recover_your_password') }}
                </h2>
            </div>
            <form @submit.prevent="recoverPassword" class="mt-8 space-y-6">
                <div class="rounded-md shadow-sm -space-y-px">
                    <div>
                        <label for="email" class="sr-only">{{ t('email') }}</label>
                        <input
                            id="email"
                            v-model="email"
                            type="email"
                            required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-bookmind-300 placeholder-bookmind-500 text-bookmind-900 rounded-t-md focus:outline-none focus:ring-bookmind-500 focus:border-bookmind-500 focus:z-10 sm:text-sm"
                            :placeholder="t('enter_your_email')"
                        />
                    </div>
                </div>

                <div>
                    <CTAButton type="submit">{{ t('send_reset_link') }}</CTAButton>
                </div>
            </form>
            <div v-if="successMessage" class="mt-3 text-sm text-green-600">
                {{ successMessage }}
            </div>
            <div v-if="errorMessage" class="mt-3 text-sm text-red-600">
                {{ errorMessage }}
            </div>
            <div class="flex items-center justify-center mt-4 text-sm">
                <button
                    @click="goBack"
                    class="font-medium text-bookmind-600 hover:text-bookmind-500"
                >
                    {{ t('go_back_to_login') }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { sendPasswordResetEmail } from 'firebase/auth'
    import { useI18n } from 'vue-i18n'
    import { initAuth } from '@/services/firebase/config'
    import CTAButton from '@/components/ui/CTAButton.vue'

    const { t } = useI18n()
    const router = useRouter()
    const auth = initAuth()

    const email = ref('')
    const successMessage = ref('')
    const errorMessage = ref('')

    const recoverPassword = async () => {
        try {
            await sendPasswordResetEmail(auth, email.value)
            successMessage.value = t('reset_link_sent')
            errorMessage.value = ''
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                errorMessage.value = t('user_not_found')
            } else if (error.code === 'auth/invalid-email') {
                errorMessage.value = t('invalid_email')
            } else {
                errorMessage.value = t('unexpected_error')
            }
            successMessage.value = ''
        }
    }

    const goBack = () => {
        router.push('/login')
    }
</script>

<style scoped>
    /* Add any additional styles if necessary */
</style>
