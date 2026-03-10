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

<template>
    <div class="min-h-screen flex items-center justify-center bg-ink-50 px-4">
        <!-- Forgot password card -->
        <div class="max-w-md w-full bg-white border border-ink-200 shadow-sm rounded-2xl p-10">
            <!-- Title -->
            <div class="text-center mb-8">
                <h2 class="text-3xl font-serif text-ink-900">
                    {{ t('recover_your_password') }}
                </h2>
            </div>

            <!-- Form -->
            <form @submit.prevent="recoverPassword" class="space-y-4">
                <div>
                    <label for="email" class="sr-only">{{ t('email') }}</label>
                    <input
                        id="email"
                        v-model="email"
                        type="email"
                        required
                        class="form-input"
                        :placeholder="t('enter_your_email')"
                    />
                </div>

                <div class="pt-2">
                    <CTAButton type="submit" variant="primary">
                        {{ t('send_reset_link') }}
                    </CTAButton>
                </div>
            </form>

            <!-- Success message -->
            <div v-if="successMessage" class="mt-4 text-sm text-green-600 font-sans">
                {{ successMessage }}
            </div>

            <!-- Error message -->
            <div v-if="errorMessage" class="mt-4 text-sm text-red-600 font-sans">
                {{ errorMessage }}
            </div>

            <!-- Back to login -->
            <div class="flex items-center justify-center mt-6 text-sm font-sans">
                <button
                    @click="goBack"
                    class="text-accent-600 hover:text-accent-700 transition-colors"
                >
                    {{ t('go_back_to_login') }}
                </button>
            </div>
        </div>
    </div>
</template>
