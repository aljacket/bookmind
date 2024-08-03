import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const isAuthenticated = computed(() => user.value !== null)

    function setUser(newUser: User | null) {
        user.value = newUser
    }

    function clearUser() {
        user.value = null
    }

    return { user, isAuthenticated, setUser, clearUser }
})
