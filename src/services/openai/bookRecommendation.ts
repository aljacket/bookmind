// src/services/openai/bookRecommendation.ts

import openai from './config'
import { incrementUsage } from './usageMonitor'
import type { UserPreferences } from '@/types/userPreferences'

export async function getBookRecommendation(preferences: UserPreferences) {
    const systemMessage =
        'Sei un bibliotecario esperto. Raccomanda libri in base alle preferenze fornite.'
    const prompt = `Genera una raccomandazione di libro basata su: Genere: ${preferences.genre}, Lunghezza: ${preferences.bookLength}, Periodo: ${preferences.period}, Complessità: ${preferences.complexity}, Scopo: ${preferences.purpose}${preferences.learningGoal ? `, Obiettivo di apprendimento: ${preferences.learningGoal}` : ''}. Rispondi SOLO con un oggetto JSON contenente "title" e "author". Niente altro testo.`

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 100
        })

        const content = response.choices[0].message.content?.trim() || '{}'

        // Rimuovi i backticks e l'indicatore "json" se presenti
        const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim()

        // Parse JSON response
        let recommendation
        try {
            recommendation = JSON.parse(cleanedContent)
        } catch (parseError) {
            console.error('Errore nel parsing JSON:', parseError)
            throw new Error("Formato di risposta non valido dall'API")
        }

        // Monitora l'uso dei token
        const tokensUsed = response.usage?.total_tokens || 0
        incrementUsage(tokensUsed)

        return {
            title: recommendation.title || '',
            author: recommendation.author || '',
            fullRecommendation: JSON.stringify(recommendation, null, 2)
        }
    } catch (error: any) {
        console.error('Errore:', error.response?.data || error.message)
        throw error
    }
}
