import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { signInWithEmailAndPassword } from 'firebase/auth'
import i18n from '@/plugins/i18n'
import LoginPage from '../LoginPage.vue'

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: vi.fn()
}))

// Mock Firebase config
vi.mock('@/services/firebase/config', () => ({
    initAuth: () => ({})
}))

const Stub = { template: '<div />' }

const mountLoginPage = () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: Stub },
            { path: '/register', component: Stub },
            { path: '/forgot-password', component: Stub }
        ]
    })
    return mount(LoginPage, {
        global: {
            plugins: [pinia, router, i18n]
        }
    })
}

describe('LoginPage', () => {
    beforeEach(() => {
        localStorage.clear()
        i18n.global.locale.value = 'en'
        vi.mocked(signInWithEmailAndPassword).mockReset()
    })

    it('renders correctly', () => {
        const wrapper = mountLoginPage()
        expect(wrapper.find('img[alt="BookMind Logo"]').exists()).toBe(true)
        expect(wrapper.find('input[type="email"]').exists()).toBe(true)
        expect(wrapper.find('input[type="password"]').exists()).toBe(true)
        expect(wrapper.find('button[type="submit"]').text()).toBe('Login')
    })

    it('shows error message on login failure', async () => {
        vi.mocked(signInWithEmailAndPassword).mockRejectedValue(new Error('Invalid credentials'))
        const wrapper = mountLoginPage()

        await wrapper.find('form').trigger('submit')
        await flushPromises()

        expect(wrapper.find('.text-red-600').text()).toBe('Invalid credentials')
    })
})
