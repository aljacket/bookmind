<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div class="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow">
            <button @click="goBack" class="mb-4 text-blue-600 hover:text-blue-800">
                &larr; Back to Login
            </button>
            <h1 class="text-3xl font-bold text-center text-blue-600">Register for BookMind</h1>
            <form @submit.prevent="register" class="space-y-6">
                <div>
                    <label for="name" class="block text-sm font-medium text-gray-700">Name:</label>
                    <input
                        id="name"
                        v-model="name"
                        type="text"
                        required
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700">
                        Email:
                    </label>
                    <input
                        id="email"
                        v-model="email"
                        type="email"
                        required
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700">
                        Password:
                    </label>
                    <input
                        id="password"
                        v-model="password"
                        type="password"
                        required
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <button
                    type="submit"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Create Account
                </button>
            </form>
            <div v-if="error" class="mt-3 text-sm text-red-600">
                {{ error }}
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
