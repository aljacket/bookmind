export function convertISBN13ToISBN10(isbn13: string): string {
    if (isbn13.length !== 13 || !isbn13.startsWith('978')) {
        return isbn13 // Ritorna l'ISBN originale se non è un ISBN-13 valido
    }

    const isbn10 = isbn13.slice(3, 12)
    let checksum = 0

    for (let i = 0; i < 9; i++) {
        checksum += (10 - i) * parseInt(isbn10[i])
    }

    checksum = (11 - (checksum % 11)) % 11
    const lastChar = checksum === 10 ? 'X' : checksum.toString()

    return isbn10 + lastChar
}

export function generateAmazonLink(isbn: string | undefined): string {
    if (!isbn) {
        console.warn('ISBN non disponibile per generare il link Amazon')
        return ''
    }
    // const isbn10 = isbn.length > 10 ? convertISBN13ToISBN10(isbn) : isbn
    // return `https://www.amazon.com/dp/${isbn10}/`
    return `https://www.amazon.com/s?k=${isbn}`
}
