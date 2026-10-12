import api, { classifyReportError, type ReportErrorKind } from '@/services/api/axios'
import { useLanguageStore } from '@/stores/language'
import type { BookRecommendation } from '@/types/userPreferences'

export type ReportKind = 'clarifier' | 'recommendation'
export type ReportReason = 'offensive' | 'inaccurate' | 'other'

/** Same order as the sheet shows them. */
export const REPORT_REASONS: readonly ReportReason[] = ['offensive', 'inaccurate', 'other']

// The backend rejects `content` longer than 1000 characters (422): see `ReportRequest`.
const MAX_CONTENT_LENGTH = 1000

/** What the user is reporting: the exact AI text that would leave the device, plus how to show it. */
export interface ReportTarget {
    kind: ReportKind
    /** The string sent as `content`. */
    content: string
    /** Recommendation only: the model's title and author. */
    title?: string
    author?: string
    /** The clarifier question, or the recommendation's reason. May be empty for a recommendation. */
    text: string
}

export class ReportError extends Error {
    readonly kind: ReportErrorKind
    readonly cause?: unknown
    constructor(kind: ReportErrorKind, cause?: unknown) {
        super(`Report failed: ${kind}`)
        this.name = 'ReportError'
        this.kind = kind
        this.cause = cause
    }
}

function clampContent(value: string): string {
    return value.length > MAX_CONTENT_LENGTH ? `${value.slice(0, MAX_CONTENT_LENGTH - 1)}…` : value
}

export function clarifierTarget(question: string): ReportTarget {
    const text = question.trim()
    return { kind: 'clarifier', content: clampContent(text), text }
}

/**
 * The model's own output for a recommendation. `fullRecommendation` is the raw `{title, author,
 * reason}` JSON the model returned (Google Books may have corrected the card's title since), so it
 * wins when it parses; otherwise the card's own fields are used. The user's messages never appear.
 */
export function recommendationTarget(book: BookRecommendation): ReportTarget {
    let title = book.title
    let author = book.author
    let reason = book.reason ?? ''
    if (book.fullRecommendation) {
        try {
            const raw: unknown = JSON.parse(book.fullRecommendation)
            if (raw && typeof raw === 'object') {
                const model = raw as Record<string, unknown>
                if (typeof model.title === 'string' && model.title.trim()) {
                    title = model.title
                    author = typeof model.author === 'string' ? model.author : author
                    reason = typeof model.reason === 'string' ? model.reason : reason
                }
            }
        } catch {
            // Not JSON: keep the card's fields.
        }
    }
    title = title.trim()
    author = author.trim()
    reason = reason.trim()
    const byline = author ? `${title} — ${author}` : title
    const content = clampContent(reason ? `${byline}\n${reason}` : byline)
    return { kind: 'recommendation', content, title, author, text: reason }
}

/** Key of an item in the "already reported" set: the exact string that was sent. */
export function reportKey(target: Pick<ReportTarget, 'kind' | 'content'>): string {
    return `${target.kind}\u0000${target.content}`
}

/**
 * `POST /reports` with the AI text and the reason only: no transcript, no user id (the backend logs
 * neither). Throws a `ReportError` whose `kind` the caller maps to a localized message. Offline
 * fails at once, without a request.
 */
export async function submitReport(target: ReportTarget, reason: ReportReason): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new ReportError('network')
    }
    try {
        await api.post('/reports', {
            kind: target.kind,
            lang: useLanguageStore().selectedLanguage,
            content: target.content,
            reason
        })
    } catch (error) {
        throw new ReportError(classifyReportError(error), error)
    }
}
