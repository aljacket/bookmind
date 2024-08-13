import { ref } from 'vue'

export const dailyRequests = ref(0)
export const dailyTokens = ref(0)

export function incrementUsage(tokens: number) {
    dailyRequests.value++
    dailyTokens.value += tokens

    if (dailyRequests.value > 9000) {
        // 90% del limite giornaliero
        console.warn('Attenzione: Stai per raggiungere il limite giornaliero di richieste')
    }

    if (dailyTokens.value > 1800000) {
        // 90% del limite giornaliero
        console.warn('Attenzione: Stai per raggiungere il limite giornaliero di token')
    }
}

// Resetta i contatori ogni giorno
setInterval(
    () => {
        dailyRequests.value = 0
        dailyTokens.value = 0
    },
    24 * 60 * 60 * 1000
)
