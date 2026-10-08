import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/plugins/i18n'
import en from '@/locales/en.json'
import LoginPage from '../LoginPage.vue'

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: vi.fn()
}))

// Mock Firebase config
vi.mock('@/services/firebase/config', () => ({
    initAuth: () => ({})
}))

const { signInWithEmailAndPassword } = vi.mocked(await import('firebase/auth'))

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
    const pinia = createPinia()
    setActivePinia(pinia)

    return mount(LoginPage, {
        global: {
            plugins: [router, pinia, i18n]
        }
    })
}

describe('LoginPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18n.global.locale.value = 'en'
    })

    it('renders correctly', () => {
        const wrapper = mountLoginPage()

        expect(wrapper.find('img[alt="BookMind Logo"]').exists()).toBe(true)
        expect(wrapper.find('input[type="email"]').attributes('placeholder')).toBe(
            en.email_placeholder
        )
        expect(wrapper.find('input[type="password"]').attributes('placeholder')).toBe(
            en.password_placeholder
        )
        expect(wrapper.find('button[type="submit"]').text()).toBe(en.login)
        expect(wrapper.text()).toContain(en.forgot_password)
        expect(wrapper.text()).toContain(en.register)
    })

    it('shows error message on login failure', async () => {
        signInWithEmailAndPassword.mockRejectedValue(new Error('Invalid credentials'))
        const wrapper = mountLoginPage()

        await wrapper.find('input[type="email"]').setValue('reader@example.com')
        await wrapper.find('input[type="password"]').setValue('wrong-password')
        await wrapper.find('form').trigger('submit')
        await flushPromises()

        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
            {},
            'reader@example.com',
            'wrong-password'
        )
        expect(wrapper.find('.text-red-600').text()).toBe('Invalid credentials')
    })
})
