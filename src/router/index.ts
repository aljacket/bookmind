import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        name: 'Home',
        component: () => import('@/views/HomePage.vue'),
        meta: { requiresAuth: true },
        props: true
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/LoginPage.vue'),
        meta: { guestOnly: true }
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('@/views/RegisterPage.vue'),
        meta: { guestOnly: true }
    },
    {
        path: '/preferences',
        name: 'Preferences',
        component: () => import('@/views/UserPreferences.vue'),
        meta: { requiresAuth: true }
    }
    // Other routes can be added here
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
    const guestOnly = to.matched.some((record) => record.meta.guestOnly)

    if (requiresAuth && !authStore.isAuthenticated) {
        next('/login')
    } else if (guestOnly && authStore.isAuthenticated) {
        next('/') // Redirect to home if user is authenticated
    } else {
        next()
    }
})

export default router
