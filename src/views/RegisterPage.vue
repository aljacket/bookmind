<template>
    <div
        class="min-h-screen flex items-center justify-center bg-gradient-to-br from-bookmind-cyan-50 to-bookmind-cyan-100"
    >
        <div class="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
            <div class="flex flex-col items-center space-y-4">
                <h2 class="text-3xl font-extrabold text-bookmind-800 text-center">
                    Registrati a BookMind
                </h2>
            </div>
            <form @submit.prevent="register" class="mt-8 space-y-6">
                <div class="rounded-md shadow-sm -space-y-px">
                    <div>
                        <label for="name" class="sr-only">Nome</label>
                        <input
                            id="name"
                            v-model="name"
                            type="text"
                            required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-bookmind-300 placeholder-bookmind-500 text-bookmind-900 rounded-t-md focus:outline-none focus:ring-bookmind-500 focus:border-bookmind-500 focus:z-10 sm:text-sm"
                            placeholder="Nome completo"
                        />
                    </div>
                    <div>
                        <label for="email" class="sr-only">Email</label>
                        <input
                            id="email"
                            v-model="email"
                            type="email"
                            required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-bookmind-300 placeholder-bookmind-500 text-bookmind-900 focus:outline-none focus:ring-bookmind-500 focus:border-bookmind-500 focus:z-10 sm:text-sm"
                            placeholder="Indirizzo email"
                        />
                    </div>
                    <div>
                        <label for="password" class="sr-only">Password</label>
                        <input
                            id="password"
                            v-model="password"
                            type="password"
                            required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-bookmind-300 placeholder-bookmind-500 text-bookmind-900 rounded-b-md focus:outline-none focus:ring-bookmind-500 focus:border-bookmind-500 focus:z-10 sm:text-sm"
                            placeholder="Password"
                        />
                    </div>
                </div>

                <div>
                    <CTAButton type="submit">Crea Account</CTAButton>
                </div>
            </form>
            <div v-if="error" class="mt-3 text-sm text-red-600">
                {{ error }}
            </div>
            <div class="flex items-center justify-center mt-4 text-sm">
                <button
                    @click="goBack"
                    class="font-medium text-bookmind-600 hover:text-bookmind-500"
                >
                    Torna al Login
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
    import { initAuth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'
    import CTAButton from '@/components/ui/CTAButton.vue'

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
