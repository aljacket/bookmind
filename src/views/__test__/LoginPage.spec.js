import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../LoginPage.vue'

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: vi.fn()
}))

// Mock Firebase config
vi.mock('@/services/firebase/config', () => ({
    auth: {}
}))

const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/home', component: { template: '<div>Home</div>' } }]
})

describe('LoginPage', () => {
    it('renders correctly', () => {
        const wrapper = mount(LoginPage, {
            global: {
                plugins: [router]
            }
        })
        expect(wrapper.find('h1').text()).toBe('BookMind')
        expect(wrapper.find('input[type="email"]').exists()).toBe(true)
        expect(wrapper.find('input[type="password"]').exists()).toBe(true)
        expect(wrapper.find('button').text()).toBe('Login')
    })

    it('shows error message on login failure', async () => {
        const wrapper = mount(LoginPage, {
            global: {
                plugins: [router]
            }
        })
        const mockSignIn = vi.mocked(require('firebase/auth').signInWithEmailAndPassword)
        mockSignIn.mockRejectedValue(new Error('Invalid credentials'))

        await wrapper.find('form').trigger('submit')

        expect(wrapper.find('.error-message').text()).toBe('Invalid credentials')
    })
})
