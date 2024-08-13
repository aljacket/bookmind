export interface UserPreferences {
    genre: string
    bookLength: string
    period: string
    complexity: string
    purpose: string
    learningGoal?: string // Opzionale
}

export function isValidUserPreferences(obj: any): obj is UserPreferences {
    return (
        typeof obj === 'object' &&
        typeof obj.genre === 'string' &&
        typeof obj.bookLength === 'string' &&
        typeof obj.period === 'string' &&
        typeof obj.complexity === 'string' &&
        typeof obj.purpose === 'string' &&
        typeof obj.learningGoal === 'string'
    )
}
