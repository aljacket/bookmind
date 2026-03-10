export function convertISBN13ToISBN10(isbn13: string): string {
    if (isbn13.length !== 13 || !isbn13.startsWith('978')) {
        return isbn13 // Return original ISBN if not a valid ISBN-13
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
        return ''
    }
    return `https://www.amazon.com/s?k=${isbn}`
}
