import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { signInWithEmailAndPassword } from 'firebase/auth'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import LoginPage from '../LoginPage.vue'

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: vi.fn()
}))

// Mock Firebase config
vi.mock('@/services/firebase/config', () => ({
    initAuth: () => ({})
}))

const stub = { template: '<div />' }

const mountLoginPage = () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: stub },
            { path: '/register', component: stub },
            { path: '/forgot-password', component: stub }
        ]
    })
    const i18n = createI18n({
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })

    return mount(LoginPage, {
        global: {
            plugins: [router, createPinia(), i18n]
        }
    })
}

describe('LoginPage', () => {
    beforeEach(() => {
        vi.mocked(signInWithEmailAndPassword).mockReset()
    })

    it('renders correctly', () => {
        const wrapper = mountLoginPage()

        expect(wrapper.find('img[alt="BookMind Logo"]').exists()).toBe(true)
        expect(wrapper.find('input[type="email"]').attributes('placeholder')).toBe('Email Address')
        expect(wrapper.find('input[type="password"]').exists()).toBe(true)
        expect(wrapper.find('button[type="submit"]').text()).toBe('Login')
    })

    it('shows error message on login failure', async () => {
        vi.mocked(signInWithEmailAndPassword).mockRejectedValue(new Error('Invalid credentials'))
        const wrapper = mountLoginPage()

        await wrapper.find('form').trigger('submit')
        await flushPromises()

        expect(signInWithEmailAndPassword).toHaveBeenCalledOnce()
        expect(wrapper.find('.text-red-600').text()).toBe('Invalid credentials')
    })
})
