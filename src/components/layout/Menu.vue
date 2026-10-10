<template>
    <div class="flex items-center h-full">
        <!-- Hamburger button -->
        <button
            @click="toggleMenu"
            class="text-ink-600 hover:text-ink-800 z-50 relative py-4 pr-4 transition-all duration-300 ease-in-out"
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
                class="fixed inset-0 bg-ink-50 z-40 flex flex-col items-center justify-between overflow-y-auto pt-[calc(4rem+var(--bm-safe-top))] pb-[calc(4rem+var(--bm-safe-bottom))] pl-[var(--bm-safe-left)] pr-[var(--bm-safe-right)]"
            >
                <!-- Top section with menu items -->
                <div class="w-full max-w-sm px-4">
                    <div class="bg-white rounded-xl shadow-lg p-8 space-y-6">
                        <!-- Language Selector -->
                        <div class="space-y-2">
                            <label class="block text-sm font-medium text-ink-600">
                                {{ t('select_language') }}
                            </label>
                            <select
                                v-model="selectedLanguage"
                                @change="changeLanguage"
                                class="form-select w-full"
                            >
                                <option value="en">English</option>
                                <option value="it">Italiano</option>
                                <option value="es">Español</option>
                            </select>
                        </div>

                        <!-- Other menu items can go here -->
                        <button
                            @click="goToPreferences"
                            class="w-full flex items-center text-left py-2 px-4 rounded-md transition-colors duration-300 hover:bg-ink-100 text-ink-600 hover:text-ink-800"
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

                        <button
                            @click="goToReadingList"
                            class="w-full flex items-center text-left py-2 px-4 rounded-md transition-colors duration-300 hover:bg-ink-100 text-ink-600 hover:text-ink-800"
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
                                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                />
                            </svg>
                            {{ t('reading_list') }}
                        </button>
                    </div>
                </div>

                <!-- Bottom section with logout -->
                <div class="w-full max-w-sm px-4">
                    <div class="bg-white rounded-xl shadow-lg">
                        <button
                            @click="logout"
                            class="w-full flex items-center text-left py-4 px-6 rounded-md transition-colors duration-300 hover:bg-ink-100 text-ink-600 hover:text-ink-800"
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

                    <!-- Danger zone: its own card, visibly apart from Logout. -->
                    <div class="mt-6 bg-white rounded-xl shadow-lg">
                        <button
                            ref="deleteAccountRow"
                            type="button"
                            class="w-full min-h-12 flex items-center text-left py-3 px-6 rounded-xl transition-colors duration-300 text-red-700 hover:bg-red-50 active:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600"
                            @click="openDeleteDialog"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-5 h-5 mr-2 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                            {{ t('delete_account_menu') }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Above the menu and the hamburger button (z-50): teleported to <body>. -->
        <Teleport to="body">
            <Transition name="dad" appear>
                <DeleteAccountDialog
                    v-if="showDeleteDialog"
                    @close="closeDeleteDialog"
                    @deleted="onAccountDeleted"
                    @sign-in-again="onSignInAgain"
                />
            </Transition>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
    import { nextTick, ref } from 'vue'
    import { useRouter } from 'vue-router'
    import { signOut } from 'firebase/auth'
    import { useI18n } from 'vue-i18n'
    import { initAuth } from '@/services/firebase/config'
    import { useAuthStore } from '@/stores/auth'
    import { useLanguageStore } from '@/stores/language'
    import type { SupportedLocale } from '@/types/userPreferences'
    import DeleteAccountDialog from '@/components/account/DeleteAccountDialog.vue'

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

    const showDeleteDialog = ref(false)
    const deleteAccountRow = ref<HTMLButtonElement | null>(null)

    const openDeleteDialog = () => {
        showDeleteDialog.value = true
    }

    // Cancelled: the menu stays open underneath, and focus goes back to the row that opened the dialog.
    const closeDeleteDialog = async () => {
        showDeleteDialog.value = false
        await nextTick()
        deleteAccountRow.value?.focus()
    }

    // The account is gone: `replace` so Back cannot return to an authenticated screen.
    const onAccountDeleted = () => {
        showDeleteDialog.value = false
        isOpen.value = false
        router.replace({ path: '/login', query: { deleted: '1' } })
    }

    const onSignInAgain = () => {
        showDeleteDialog.value = false
        logout()
    }

    const goToPreferences = () => {
        router.push('/preferences')
        isOpen.value = false
    }

    const goToReadingList = () => {
        router.push('/reading-list')
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
