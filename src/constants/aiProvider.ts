/**
 * The third-party AI provider that receives the chat messages, and how long it may keep them.
 *
 * Single source of truth for every user-facing sentence that names the provider: the account-deletion
 * dialog (`delete_account_kept_ai`) and, in card #65, the consent panel and the transparency note.
 * Card #71 decides the final provider; when it does, only this constant changes, and the consent
 * `version` is raised so users are asked again.
 */
export const AI_PROVIDER = {
    /** Shown to the user, as `{provider}` in the locale strings. */
    name: 'OpenAI',
    /** Retention period the provider states for abuse monitoring, as `{days}` in the locale strings. */
    retentionDays: 30
} as const
