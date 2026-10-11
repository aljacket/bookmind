import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { signOut } from 'firebase/auth'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import Menu from '../Menu.vue'

vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/services/firebase/config', () => ({ initAuth: () => ({}) }))

// The dialog has its own spec: here it only has to be mounted, and to emit what the real one emits.
const DialogStub = defineComponent({
    name: 'DeleteAccountDialog',
    emits: ['close', 'deleted', 'sign-in-again'],
    template: '<div data-testid="delete-dialog" />'
})

const stub = { template: '<div />' }
let wrapper: VueWrapper

const mountMenu = async () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: stub },
            { path: '/login', component: stub }
        ]
    })
    await router.push('/')
    const replaceSpy = vi.spyOn(router, 'replace')
    const pushSpy = vi.spyOn(router, 'push')
    const i18n = createI18n({
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })
    wrapper = mount(Menu, {
        attachTo: document.body,
        global: {
            plugins: [router, createPinia(), i18n],
            stubs: { DeleteAccountDialog: DialogStub }
        }
    })
    await wrapper.find('button[aria-label="Toggle menu"]').trigger('click')
    return { replaceSpy, pushSpy }
}

const deleteRow = () => wrapper.findAll('button').find((b) => b.text() === en.delete_account_menu)!
const dialog = () => document.body.querySelector('[data-testid="delete-dialog"]')

describe('Menu: delete account entry', () => {
    afterEach(() => {
        wrapper.unmount()
    })

    it('is its own card below Logout, 24 px apart, in red with a trash icon, at least 48 px high', async () => {
        await mountMenu()
        const row = deleteRow()
        const logoutRow = wrapper.findAll('button').find((b) => b.text() === en.logout)!
        const card = row.element.parentElement!
        const logoutCard = logoutRow.element.parentElement!

        expect(card).not.toBe(logoutCard)
        expect(logoutCard.nextElementSibling).toBe(card)
        expect(card.className).toContain('mt-6')
        expect(card.className).toContain('rounded-xl')
        expect(row.classes()).toEqual(
            expect.arrayContaining(['min-h-12', 'text-red-700', 'active:bg-red-50', 'w-full'])
        )
        expect(row.attributes('type')).toBe('button')
        expect(row.find('svg').attributes('aria-hidden')).toBe('true')
    })

    it('opens the dialog over the menu, which stays open underneath', async () => {
        await mountMenu()
        expect(dialog()).toBeNull()

        await deleteRow().trigger('click')

        expect(dialog()).not.toBeNull()
        expect(deleteRow().exists()).toBe(true)
    })

    it('Cancel closes the dialog and returns focus to the row', async () => {
        await mountMenu()
        await deleteRow().trigger('click')

        wrapper.findComponent(DialogStub).vm.$emit('close')
        await flushPromises()

        expect(dialog()).toBeNull()
        expect(document.activeElement).toBe(deleteRow().element)
    })

    it('after the deletion, closes the menu and replaces the route with /login?deleted=1', async () => {
        const { replaceSpy } = await mountMenu()
        await deleteRow().trigger('click')

        wrapper.findComponent(DialogStub).vm.$emit('deleted')
        await flushPromises()

        expect(replaceSpy).toHaveBeenCalledWith({ path: '/login', query: { deleted: '1' } })
        expect(dialog()).toBeNull()
        expect(wrapper.text()).not.toContain(en.logout)
    })

    it('"Sign in again" signs out and goes to /login', async () => {
        const { pushSpy } = await mountMenu()
        await deleteRow().trigger('click')

        wrapper.findComponent(DialogStub).vm.$emit('sign-in-again')
        await flushPromises()

        expect(signOut).toHaveBeenCalled()
        expect(pushSpy).toHaveBeenCalledWith('/login')
        expect(dialog()).toBeNull()
    })
})
