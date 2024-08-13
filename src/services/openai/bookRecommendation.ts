import openai from './config'
import { incrementUsage } from './usageMonitor'

interface UserPreferences {
    genre: string
    bookLength: string
    period: string
    complexity: string
    purpose: string
}

export async function getBookRecommendation(preferences: UserPreferences) {
    const systemMessage =
        'Sei un bibliotecario. Raccomanda libri in base alle preferenze date. Rispondi solo con titolo e autore.'
    const prompt = `Libro: ${preferences.genre}, ${preferences.bookLength}, ${preferences.period}, ${preferences.complexity}, ${preferences.purpose}. Solo titolo e autore.`

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
            ],
            max_tokens: 50
        })

        incrementUsage(response.usage?.total_tokens || 0)

        return response.choices[0].message.content?.trim() || 'Nessuna raccomandazione disponibile.'
    } catch (error: any) {
        console.error('Errore:', error.response?.data || error.message)
        throw error
    }
}
