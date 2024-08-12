import openai from './config'

export async function getSimpleBookRecommendation(genre: string): Promise<string> {
    const prompt = `Suggerisci un libro del genere ${genre}. Fornisci solo il titolo e l'autore.`

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'Sei un esperto di libri. Rispondi in modo conciso.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 50 // Ridotto per ottenere risposte più brevi
        })

        return completion.choices[0].message.content || 'Nessuna raccomandazione disponibile'
    } catch (error) {
        console.error('Errore nel ottenere raccomandazioni:', error)
        return 'Si è verificato un errore. Riprova più tardi.'
    }
}
