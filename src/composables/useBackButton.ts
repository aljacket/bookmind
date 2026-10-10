import { onBeforeUnmount, onMounted } from 'vue'
import { pushBackInterceptor } from '@/services/backButton'

/**
 * Takes the Android Back button over for the lifetime of the calling component: while it is mounted
 * Back calls `handler` instead of navigating, and once it unmounts Back behaves as before. Nothing
 * happens on the web, where there is no Back button event.
 */
export function useBackButton(handler: () => void) {
    let remove: (() => void) | null = null

    onMounted(() => {
        remove = pushBackInterceptor(handler)
    })

    onBeforeUnmount(() => {
        remove?.()
        remove = null
    })
}
