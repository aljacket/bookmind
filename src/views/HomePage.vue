<template>
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 class="text-3xl font-bold mb-8">Welcome to BookMind</h1>
        <button
            @click="logout"
            class="mt-auto mb-8 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
            Logout
        </button>
    </div>
</template>

<script setup lang="ts">
    import { useRouter } from 'vue-router'
    import { signOut } from 'firebase/auth'
    import { initAuth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'

    const router = useRouter()
    const auth = initAuth()
    const authStore = useAuthStore()

    const logout = async () => {
        try {
            await signOut(auth)
            authStore.clearUser()
            router.push('/login')
        } catch (error) {
            console.error('Logout failed', error)
        }
    }
</script>
