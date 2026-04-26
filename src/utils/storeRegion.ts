import type { SupportedLocale } from '@/types/userPreferences'

export type StoreCountry = 'IT' | 'ES' | 'FR' | 'DE' | 'GB' | 'US'

const AMAZON_TLDS: Record<StoreCountry, string> = {
    IT: 'it',
    ES: 'es',
    FR: 'fr',
    DE: 'de',
    GB: 'co.uk',
    US: 'com'
}

const APP_LANG_TO_COUNTRY: Record<SupportedLocale, StoreCountry> = {
    en: 'US',
    es: 'ES',
    it: 'IT'
}

function isStoreCountry(value: string): value is StoreCountry {
    return value in AMAZON_TLDS
}

export function detectStoreCountry(appLang: SupportedLocale): StoreCountry {
    const browserLocale = typeof navigator !== 'undefined' ? navigator.language : ''
    const match = browserLocale.match(/^[a-z]{2}-([A-Z]{2})$/)
    if (match) {
        const country = match[1]
        if (isStoreCountry(country)) return country
    }
    return APP_LANG_TO_COUNTRY[appLang]
}

export function amazonTldFor(country: StoreCountry): string {
    return AMAZON_TLDS[country]
}
