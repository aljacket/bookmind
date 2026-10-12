import { describe, expect, it } from 'vitest'
import en from '../en.json'
import it_ from '../it.json'
import es from '../es.json'

// The keys of the "Report" flow, as listed in the UX spec (design.md, section 8) of the
// account-deletion-and-launch change.
const REPORT_KEYS = [
    'report_action',
    'report_action_clarifier_aria',
    'report_action_recommendation_aria',
    'report_done_inline',
    'report_title_clarifier',
    'report_title_recommendation',
    'report_reason_legend',
    'report_reason_offensive',
    'report_reason_offensive_hint',
    'report_reason_inaccurate',
    'report_reason_inaccurate_hint',
    'report_reason_other',
    'report_reason_other_hint',
    'report_privacy_note',
    'report_send',
    'report_sending',
    'report_cancel',
    'report_close',
    'report_sent_title',
    'report_sent_body',
    'report_done',
    'report_error_network',
    'report_error_generic',
    'report_error_quota',
    'report_error_session'
]

const locales = { en, it: it_, es } as Record<string, Record<string, unknown>>

describe('report copy in every locale', () => {
    describe.each(Object.keys(locales))('%s', (locale) => {
        const messages = locales[locale]

        it.each(REPORT_KEYS)('has a non-empty text for %s', (key) => {
            expect(typeof messages[key]).toBe('string')
            expect((messages[key] as string).trim().length).toBeGreaterThan(0)
        })

        it('has no report_ key beyond the spec, so none is left untranslated elsewhere', () => {
            const actual = Object.keys(messages).filter((key) => key.startsWith('report_'))
            expect(actual.sort()).toEqual([...REPORT_KEYS].sort())
        })

        it('reuses the existing "Sign in again" key for the 401 action', () => {
            expect(typeof messages.chat_error_session_action).toBe('string')
        })

        it('puts the book title in the recommendation name, and the visible word first (WCAG 2.5.3)', () => {
            expect(messages.report_action_recommendation_aria).toContain('{title}')
            expect(messages.report_action_clarifier_aria).not.toContain('{title}')
            for (const key of [
                'report_action_clarifier_aria',
                'report_action_recommendation_aria'
            ]) {
                expect((messages[key] as string).startsWith(messages.report_action as string)).toBe(
                    true
                )
            }
        })

        it('does not translate the same sentence into English by accident', () => {
            if (locale === 'en') return
            for (const key of ['report_send', 'report_error_quota', 'report_sent_body']) {
                expect(messages[key]).not.toBe(en[key as keyof typeof en])
            }
        })
    })
})
