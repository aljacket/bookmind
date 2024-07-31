<script setup lang="ts">
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { signInWithEmailAndPassword } from 'firebase/auth'
    import { initAuth } from '@/services/firebase/config'

    const auth = initAuth()
    const router = useRouter()

    const email = ref('')
    const password = ref('')
    const errorMessage = ref('')

    const login = async () => {
        try {
            await signInWithEmailAndPassword(auth, email.value, password.value)
            router.push('/home')
        } catch (error) {
            if (error instanceof Error) {
                errorMessage.value = error.message
            } else {
                errorMessage.value = 'An unexpected error occurred'
            }
        }
    }
</script>

<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div class="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow">
            <h1 class="text-3xl font-bold text-center text-blue-600">BookMind</h1>
            <form @submit.prevent="login" class="space-y-6">
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700">
                        Email:
                    </label>
                    <input
                        id="email"
                        v-model="email"
                        type="email"
                        required
                        placeholder="Enter your email"
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
                        placeholder="Enter your password"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <button
                    type="submit"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Login
                </button>
            </form>
            <div v-if="errorMessage" class="mt-3 text-sm text-red-600">
                {{ errorMessage }}
            </div>
            <div class="flex justify-between mt-4 text-sm">
                <a href="#" class="font-medium text-blue-600 hover:text-blue-500">
                    Forgot Password?
                </a>
                <a href="#" class="font-medium text-blue-600 hover:text-blue-500"> Register </a>
            </div>
        </div>
    </div>
</template>
