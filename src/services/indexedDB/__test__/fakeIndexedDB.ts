/**
 * A tiny in-memory stand-in for the part of IndexedDB that `userPreferences.ts` uses
 * (`open`, `createObjectStore`, `transaction`, `get` / `put` / `delete` with a key or a key range,
 * `IDBKeyRange.bound`). jsdom ships no IndexedDB and the project has no `fake-indexeddb`
 * dependency. Requests complete asynchronously, like the real thing.
 */

import { vi } from 'vitest'

type Listener = ((event?: unknown) => void) | null

class FakeRange {
    constructor(
        readonly lower: string,
        readonly upper: string
    ) {}
    includes(key: string) {
        return key >= this.lower && key <= this.upper
    }
}

class FakeRequest<T = unknown> {
    result!: T
    error: unknown = null
    onsuccess: Listener = null
    onerror: Listener = null
    onupgradeneeded: Listener = null
}

class FakeStore {
    constructor(
        private readonly data: Map<string, unknown>,
        private readonly tx: FakeTransaction
    ) {}

    private run<T>(work: () => T): FakeRequest<T> {
        const request = new FakeRequest<T>()
        this.tx.pending++
        queueMicrotask(() => {
            request.result = work()
            request.onsuccess?.({ target: request })
            this.tx.pending--
            this.tx.maybeComplete()
        })
        return request
    }

    get(key: string) {
        return this.run(() => {
            const value = this.data.get(key)
            return value === undefined ? undefined : structuredClone(value)
        })
    }

    put(value: unknown, key: string) {
        return this.run(() => {
            this.data.set(key, structuredClone(value))
            return key
        })
    }

    delete(target: string | FakeRange) {
        return this.run(() => {
            for (const key of [...this.data.keys()]) {
                if (typeof target === 'string' ? key === target : target.includes(key)) {
                    this.data.delete(key)
                }
            }
            return undefined
        })
    }
}

class FakeTransaction {
    pending = 0
    error: unknown = null
    oncomplete: Listener = null
    onerror: Listener = null
    onabort: Listener = null

    constructor(
        private readonly db: FakeDatabase,
        private readonly names: string[]
    ) {
        // A transaction with no requests still completes.
        queueMicrotask(() => this.maybeComplete())
    }

    objectStore(name: string) {
        if (!this.names.includes(name)) throw new Error(`NotFoundError: ${name}`)
        return new FakeStore(this.db.stores.get(name)!, this)
    }

    private completed = false
    maybeComplete() {
        if (this.pending > 0 || this.completed) return
        this.completed = true
        queueMicrotask(() => this.oncomplete?.())
    }
}

class FakeDatabase {
    readonly stores = new Map<string, Map<string, unknown>>()
    version = 0

    get objectStoreNames() {
        return { contains: (name: string) => this.stores.has(name) }
    }

    createObjectStore(name: string) {
        this.stores.set(name, new Map())
    }

    transaction(names: string | string[]) {
        return new FakeTransaction(this, Array.isArray(names) ? names : [names])
    }

    close() {}
}

export interface FakeIndexedDB {
    open(name: string, version: number): FakeRequest<FakeDatabase>
    /** Test helper: the raw contents of one database, store name -> (key -> value). */
    stores(name: string): Map<string, Map<string, unknown>>
    /** Test helper: drops every database. */
    reset(): void
}

export function installFakeIndexedDB(): FakeIndexedDB {
    const databases = new Map<string, FakeDatabase>()

    const fake: FakeIndexedDB = {
        open(name, version) {
            const request = new FakeRequest<FakeDatabase>()
            queueMicrotask(() => {
                let db = databases.get(name)
                const isNew = !db || db.version < version
                if (!db) {
                    db = new FakeDatabase()
                    databases.set(name, db)
                }
                request.result = db
                if (isNew) {
                    db.version = version
                    request.onupgradeneeded?.({ target: request })
                }
                request.onsuccess?.({ target: request })
            })
            return request
        },
        stores(name) {
            const db = databases.get(name)
            if (!db) throw new Error(`No database named ${name}`)
            return db.stores
        },
        reset() {
            databases.clear()
        }
    }

    vi.stubGlobal('indexedDB', fake)
    vi.stubGlobal('IDBKeyRange', {
        bound: (lower: string, upper: string) => new FakeRange(lower, upper)
    })
    return fake
}
