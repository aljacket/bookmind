// src/services/openai/bookRecommendation.ts

import openai from './config'
import { incrementUsage } from './usageMonitor'
import type { UserPreferences } from '@/types/userPreferences'

export async function getBookRecommendations(preferences: UserPreferences) {
    const systemMessage = 'Sei un esperto bibliotecario. Consiglia 3 libri in base alle preferenze.'
    const prompt = `3 libri: g:${preferences.genre},l:${preferences.bookLength},p:${preferences.period},c:${preferences.complexity},s:${preferences.purpose}${preferences.learningGoal ? `,o:${preferences.learningGoal}` : ''}. Solo JSON:{b:[{t,a}]}`

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        })

        const content = response.choices[0].message.content?.trim() || '{}'
        let recommendations = JSON.parse(content).b as Array<{ t: string; a: string }>

        // Monitora l'uso dei token
        const tokensUsed = response.usage?.total_tokens || 0
        incrementUsage(tokensUsed)

        return recommendations.map(({ t, a }: { t: string; a: string }) => ({
            title: t,
            author: a
        }))
    } catch (error: any) {
        console.error('Errore:', error.response?.data || error.message)
        throw error
    }
}
