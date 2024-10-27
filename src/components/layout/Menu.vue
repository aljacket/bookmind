<template>
    <div class="flex items-center h-full">
        <!-- Hamburger button -->
        <button
            @click="toggleMenu"
            class="text-bookmind-600 hover:text-bookmind-800 z-50 relative py-4 pr-4 transition-all duration-300 ease-in-out"
            aria-label="Toggle menu"
        >
            <div class="w-6 h-6 flex items-center justify-center">
                <span class="hamburger-icon" :class="{ open: isOpen }"></span>
            </div>
        </button>

        <!-- Fullscreen menu -->
        <Transition name="fade">
            <div
                v-if="isOpen"
                class="fixed inset-0 bg-gradient-to-br from-bookmind-cyan-50 to-bookmind-cyan-100 z-40 flex flex-col items-center justify-between py-16"
            >
                <!-- Top section with menu items -->
                <div class="w-full max-w-sm px-4">
                    <div class="bg-white rounded-xl shadow-lg p-8 space-y-6">
                        <!-- Language Selector -->
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-bookmind-600">
                                {{ t('select_language') }}
                            </label>
                            <select
                                v-model="selectedLanguage"
                                @change="changeLanguage"
                                class="w-full bg-white border border-bookmind-300 text-bookmind-700 py-2 px-3 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-bookmind-500 focus:border-bookmind-500 transition duration-200"
                            >
                                <option value="en">English</option>
                                <option value="it">Italiano</option>
                                <option value="es">Español</option>
                            </select>
                        </div>

                        <!-- Other menu items can go here -->
                        <button
                            @click="goToPreferences"
                            class="w-full flex items-center text-left py-2 px-4 rounded-md transition-colors duration-300 hover:bg-bookmind-100 text-bookmind-600 hover:text-bookmind-800"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-5 h-5 mr-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                            </svg>
                            {{ t('preferences') }}
                        </button>
                    </div>
                </div>

                <!-- Bottom section with logout -->
                <div class="w-full max-w-sm px-4">
                    <div class="bg-white rounded-xl shadow-lg">
                        <button
                            @click="logout"
                            class="w-full flex items-center text-left py-4 px-6 rounded-md transition-colors duration-300 hover:bg-bookmind-100 text-bookmind-600 hover:text-bookmind-800"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-5 h-5 mr-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                />
                            </svg>
                            {{ t('logout') }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { signOut } from 'firebase/auth'
    import { useI18n } from 'vue-i18n'
    import { initAuth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'
    import { useLanguageStore } from '@/stores/language'
    import type { SupportedLocale } from '@/types/userPreferences'

    const { t } = useI18n()
    const router = useRouter()
    const auth = initAuth()
    const authStore = useAuthStore()
    const languageStore = useLanguageStore()

    const isOpen = ref(false)
    const selectedLanguage = ref<SupportedLocale>(languageStore.selectedLanguage)

    const toggleMenu = () => {
        isOpen.value = !isOpen.value
    }

    const changeLanguage = () => {
        languageStore.setLanguage(selectedLanguage.value)
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

    const goToPreferences = () => {
        router.push('/preferences')
        isOpen.value = false
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
