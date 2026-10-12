import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { reportKey, type ReportTarget } from '@/services/reports/reportAiContent'

/**
 * Items the user reported during this app session, so that Home, the reading list and the chat agree
 * and the same text is not reported twice. Held in memory only: nothing is persisted on the device,
 * and the set is cleared when the signed-in user changes or signs out. After an app restart the
 * action is available again (the backend's daily limit bounds abuse).
 */
export const useReportsStore = defineStore('reports', () => {
    const reported = ref<Set<string>>(new Set())

    function isReported(target: ReportTarget): boolean {
        return reported.value.has(reportKey(target))
    }

    function markReported(target: ReportTarget) {
        reported.value = new Set(reported.value).add(reportKey(target))
    }

    function clear() {
        reported.value = new Set()
    }

    const authStore = useAuthStore()
    watch(() => authStore.user?.uid ?? null, clear)

    return { isReported, markReported, clear }
})
