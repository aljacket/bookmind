<!-- src/components/layout/Menu.vue -->
<template>
    <div class="flex items-center h-full">
        <!-- Pulsante hamburger con area cliccabile più ampia e padding a destra -->
        <button
            @click="toggleMenu"
            class="text-bookmind-600 hover:text-bookmind-800 z-50 relative py-4 pr-4 transition-all duration-300 ease-in-out"
            aria-label="Toggle menu"
        >
            <div class="w-6 h-6 flex items-center justify-center">
                <span class="hamburger-icon" :class="{ open: isOpen }"></span>
            </div>
        </button>

        <!-- Menu a schermo intero -->
        <Transition name="fade">
            <div
                v-if="isOpen"
                class="fixed inset-0 bg-gradient-to-br from-bookmind-cyan-50 to-bookmind-cyan-100 z-40 flex flex-col items-center justify-center"
            >
                <div class="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full">
                    <button
                        @click="logout"
                        class="w-full text-left mb-4 py-2 px-4 rounded-md transition-colors duration-300 hover:bg-bookmind-100 text-bookmind-600 hover:text-bookmind-800"
                    >
                        <span class="flex items-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                class="w-5 h-5 mr-2"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                />
                            </svg>
                            Logout
                        </span>
                    </button>
                    <!-- Aggiungi altri elementi del menu qui -->
                </div>
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
    .fade-enter-active,
    .fade-leave-active {
        transition:
            opacity 0.3s,
            transform 0.3s;
    }
    .fade-enter-from,
    .fade-leave-to {
        opacity: 0;
        transform: scale(0.95);
    }

    .hamburger-icon,
    .hamburger-icon::before,
    .hamburger-icon::after {
        width: 24px;
        height: 2px;
        background-color: currentColor;
        transition: all 0.3s ease;
    }

    .hamburger-icon {
        position: relative;
    }

    .hamburger-icon::before,
    .hamburger-icon::after {
        content: '';
        position: absolute;
        left: 0;
    }

    .hamburger-icon::before {
        top: -8px;
    }

    .hamburger-icon::after {
        bottom: -8px;
    }

    .hamburger-icon.open {
        background-color: transparent;
    }

    .hamburger-icon.open::before {
        top: 0;
        transform: rotate(45deg);
    }

    .hamburger-icon.open::after {
        bottom: 0;
        transform: rotate(-45deg);
    }
</style>
