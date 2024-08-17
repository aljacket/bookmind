<template>
    <div>
        <!-- Hamburger/X button -->
        <button @click="toggleMenu" class="fixed top-4 right-4 z-50">
            <div class="w-6 h-6 flex flex-col justify-between" :class="{ 'toggle-open': isOpen }">
                <span class="w-full h-1 bg-black transition-all duration-300"></span>
                <span class="w-full h-1 bg-black transition-all duration-300"></span>
                <span class="w-full h-1 bg-black transition-all duration-300"></span>
            </div>
        </button>

        <!-- Full-screen menu -->
        <Transition name="slide-menu">
            <div
                v-if="isOpen"
                class="fixed inset-0 bg-white z-40 flex flex-col items-center justify-center"
            >
                <button
                    @click="logout"
                    class="text-xl mb-4 hover:text-blue-500 bg-red-100 px-4 py-2 rounded-md transition-colors duration-300 hover:bg-red-200"
                >
                    Logout
                </button>
                <!-- Add more menu items here -->
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { signOut } from 'firebase/auth'
    import { initAuth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'

    const isOpen = ref(false)
    const router = useRouter()
    const auth = initAuth()
    const authStore = useAuthStore()

    const toggleMenu = () => {
        isOpen.value = !isOpen.value
    }

    const logout = async () => {
        try {
            await signOut(auth)
            authStore.clearUser()
            isOpen.value = false
            router.push('/login')
        } catch (error) {
            console.error('Logout failed', error)
        }
    }
</script>

<style scoped>
    .toggle-open span:first-child {
        transform: translateY(10px) rotate(45deg);
    }
    .toggle-open span:nth-child(2) {
        opacity: 0;
    }
    .toggle-open span:last-child {
        transform: translateY(-10px) rotate(-45deg);
    }

    .slide-menu-enter-active,
    .slide-menu-leave-active {
        transition: transform 0.3s ease;
    }

    .slide-menu-enter-from,
    .slide-menu-leave-to {
        transform: translateX(100%);
    }
</style>
