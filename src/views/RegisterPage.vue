<script setup lang="ts">
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
    import { initAuth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'
    import CTAButton from '@/components/ui/CTAButton.vue'
    import { useI18n } from 'vue-i18n'

    const { t } = useI18n()
    const router = useRouter()
    const auth = initAuth()
    const authStore = useAuthStore()

    const name = ref('')
    const email = ref('')
    const password = ref('')
    const error = ref('')

    const register = async () => {
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email.value,
                password.value
            )
            await updateProfile(userCredential.user, { displayName: name.value })
            authStore.setUser(userCredential.user)
            router.push('/')
        } catch (e) {
            if (e instanceof Error) {
                error.value = e.message
            } else {
                error.value = 'An unexpected error occurred'
            }
        }
    }

    const goBack = () => {
        router.push('/login')
    }
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-ink-50 px-4">
        <!-- Register card -->
        <div class="max-w-md w-full bg-white border border-ink-200 shadow-sm rounded-2xl p-10">
            <!-- Title -->
            <div class="text-center mb-8">
                <h2 class="text-3xl font-serif text-ink-900">
                    {{ t('register_to_bookmind') }}
                </h2>
            </div>

            <!-- Form -->
            <form @submit.prevent="register" class="space-y-4">
                <div>
                    <label for="name" class="sr-only">{{ t('name') }}</label>
                    <input
                        id="name"
                        v-model="name"
                        type="text"
                        required
                        class="form-input"
                        :placeholder="t('name_placeholder')"
                    />
                </div>

                <div>
                    <label for="email" class="sr-only">{{ t('email') }}</label>
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
                        {{ t('create_account') }}
                    </CTAButton>
                </div>
            </form>

            <!-- Error message -->
            <div v-if="error" class="mt-4 text-sm text-red-600 font-sans">
                {{ error }}
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
