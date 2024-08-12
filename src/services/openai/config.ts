import OpenAI from 'openai'

const apiKey = import.meta.env.VITE_OPENAI_API_KEY

if (!apiKey) {
    throw new Error('OpenAI API key is not set in environment variables')
}

const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: import.meta.env.MODE === 'development'
})

export default openai
