/**
 * Trello card reader/writer for the BookMind board.
 *
 * Talks to the Trello REST API directly instead of going through the `trello` MCP server:
 * MCP tools are not always available (deferred tools, subagents without ToolSearch), while
 * every agent has Bash. A card is its description PLUS its checklist — read both.
 *
 * Usage (Node >= 22.18 runs the TypeScript directly):
 *   npm run trello -- 12                                   # by card number (idShort)
 *   npm run trello -- 6U7xM7zj                             # by shortLink
 *   npm run trello -- https://trello.com/c/6U7xM7zj/12-...
 *
 *   npm run trello -- 12 --comment "PR #21 open, awaiting merge"
 *   npm run trello -- 12 --move "In Sviluppo"
 *   npm run trello -- 12 --check "type-check"              # tick one checklist item
 *   npm run trello -- 12 --set-desc-file /tmp/desc.md      # replace the description
 *   npm run trello -- --lists                              # list board lists
 *   npm run trello -- --cards "Da sviluppare"              # titles in one list
 *
 * Creating a card. Description and checklist come from files, because a real card body is
 * long markdown full of backticks and quotes that the shell would mangle:
 *
 *   npm run trello -- --create --list "Da sviluppare" \
 *     --name "Some feature" --desc-file /tmp/desc.md --checklist-file /tmp/steps.txt
 *
 * `--checklist-file` is one item per line; blank lines and lines starting with `#` are
 * skipped. Items are created in file order under a checklist named "Steps".
 *
 * Credentials: read from env `TRELLO_API_KEY` / `TRELLO_TOKEN` / `TRELLO_BOARD_ID`, and
 * otherwise from the `trello` server block in `.mcp.json` (gitignored — the secrets are
 * never in the repo). `.mcp.json` is looked up in the current directory first, then in the
 * main checkout this git worktree belongs to.
 *
 * Reading a card prints its comments too (newest last, `--comments=N` to change how many, 0
 * to hide).
 *
 * Read is the default. Writes happen only when a write flag is passed.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const API = 'https://api.trello.com/1'

interface Creds {
    key: string
    token: string
    boardId: string
}

interface TrelloCard {
    id: string
    idShort: number
    name: string
    desc: string
    due: string | null
    shortUrl: string
    idList: string
    labels: { name: string; color: string | null }[]
}

interface CheckItem {
    id: string
    name: string
    state: string
    pos: number
}

interface Checklist {
    id: string
    name: string
    pos: number
    checkItems: CheckItem[]
}

interface TrelloList {
    id: string
    name: string
}

interface TrelloComment {
    date: string
    data: { text: string }
    memberCreator?: { fullName?: string; username?: string }
}

/** `.mcp.json` candidates: cwd, then the main checkout behind a git worktree. */
function mcpJsonPaths(): string[] {
    const paths = [resolve(process.cwd(), '.mcp.json')]
    try {
        const commonDir = execFileSync(
            'git',
            ['rev-parse', '--path-format=absolute', '--git-common-dir'],
            {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            }
        ).trim()
        const mainCheckout = resolve(dirname(commonDir), '.mcp.json')
        if (!paths.includes(mainCheckout)) paths.push(mainCheckout)
    } catch {
        // not in a git checkout — cwd only
    }
    return paths
}

function loadCreds(): Creds {
    const fromEnv = {
        key: process.env.TRELLO_API_KEY,
        token: process.env.TRELLO_TOKEN,
        boardId: process.env.TRELLO_BOARD_ID
    }
    if (fromEnv.key && fromEnv.token && fromEnv.boardId) {
        return { key: fromEnv.key, token: fromEnv.token, boardId: fromEnv.boardId }
    }

    for (const path of mcpJsonPaths()) {
        try {
            const raw = readFileSync(path, 'utf8')
            const parsed = JSON.parse(raw) as {
                mcpServers?: Record<string, { env?: Record<string, string> }>
            }
            const env = parsed.mcpServers?.trello?.env
            if (env?.TRELLO_API_KEY && env.TRELLO_TOKEN && env.TRELLO_BOARD_ID) {
                return {
                    key: env.TRELLO_API_KEY,
                    token: env.TRELLO_TOKEN,
                    boardId: env.TRELLO_BOARD_ID
                }
            }
        } catch {
            // try the next candidate
        }
    }

    throw new Error(
        'No Trello credentials. Set TRELLO_API_KEY / TRELLO_TOKEN / TRELLO_BOARD_ID, or provide ' +
            'them in the `trello` server block of .mcp.json.'
    )
}

async function call<T>(
    creds: Creds,
    path: string,
    init: { method?: string; query?: Record<string, string>; body?: Record<string, string> } = {}
): Promise<T> {
    const url = new URL(`${API}${path}`)
    url.searchParams.set('key', creds.key)
    url.searchParams.set('token', creds.token)
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v)

    // Large text fields (a card's `desc`, a comment's `text`) go in a JSON body, never the query
    // string: Trello's own docs allow either, but CloudFront in front of api.trello.com caps URL
    // length and returns a bare HTTP 414 once `desc` crosses roughly 4 KB (run 17 defect).
    const hasBody = init.body && Object.keys(init.body).length > 0
    const res = await fetch(url, {
        method: init.method ?? 'GET',
        ...(hasBody
            ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) }
            : {})
    })
    if (!res.ok) {
        const body = await res.text()
        // Never echo the URL back — it carries the token.
        throw new Error(`Trello ${init.method ?? 'GET'} ${path} failed: ${res.status} ${body}`)
    }
    return (await res.json()) as T
}

/** Accepts a card number (`110`), a shortLink (`6U7xM7zj`) or a full card URL. */
async function resolveCard(creds: Creds, ref: string): Promise<TrelloCard> {
    const fields = 'id,idShort,name,desc,due,shortUrl,idList,labels'

    const urlMatch = ref.match(/trello\.com\/c\/([A-Za-z0-9]+)/)
    const shortLink = urlMatch?.[1]
    if (shortLink) return call<TrelloCard>(creds, `/cards/${shortLink}`, { query: { fields } })

    if (/^\d+$/.test(ref)) {
        const cards = await call<TrelloCard[]>(creds, `/boards/${creds.boardId}/cards`, {
            query: { fields, filter: 'all' }
        })
        const hit = cards.find((c) => c.idShort === Number(ref))
        if (!hit) {
            throw new Error(
                `No card #${ref} on board ${creds.boardId}. It may be on another board, or deleted.`
            )
        }
        return hit
    }

    return call<TrelloCard>(creds, `/cards/${ref}`, { query: { fields } })
}

function renderCard(
    card: TrelloCard,
    list: string,
    checklists: Checklist[],
    comments: TrelloComment[],
    commentLimit: number
): string {
    const out: string[] = []
    const checkedAt = new Date().toISOString()

    out.push(`# Trello card #${card.idShort} — ${card.name}`)
    out.push('')
    out.push(`Fetched from the Trello API at ${checkedAt}. This is the live board, verbatim.`)
    out.push('')
    out.push(`- URL: ${card.shortUrl}`)
    out.push(`- List: ${list}`)
    out.push(`- Due: ${card.due ?? '(none)'}`)
    out.push(
        `- Labels: ${card.labels.length ? card.labels.map((l) => l.name || l.color).join(', ') : '(none)'}`
    )
    out.push('')
    out.push('---')
    out.push('')
    out.push('## DESCRIPTION (verbatim)')
    out.push('')
    out.push(card.desc.trim() || '(empty)')
    out.push('')
    out.push('---')
    out.push('')

    if (checklists.length === 0) {
        out.push('## CHECKLISTS')
        out.push('')
        out.push('(none)')
    } else {
        const total = checklists.reduce((n, c) => n + c.checkItems.length, 0)
        out.push(`## CHECKLISTS — ${checklists.length} list(s), ${total} item(s) total`)
        out.push('')
        out.push(
            'Checklist items routinely carry requirements the description does not state. They are ' +
                'part of the card. Honour all of them.'
        )
        for (const cl of [...checklists].sort((a, b) => a.pos - b.pos)) {
            out.push('')
            out.push(`### ${cl.name}`)
            out.push('')
            const items = [...cl.checkItems].sort((a, b) => a.pos - b.pos)
            items.forEach((item, i) => {
                const box = item.state === 'complete' ? '[x]' : '[ ]'
                out.push(`${i + 1}. ${box} ${item.name}`)
            })
        }
    }

    if (commentLimit > 0) {
        out.push('')
        out.push('---')
        out.push('')
        // Trello returns newest first; print the latest N in chronological order.
        const shown = comments.slice(0, commentLimit).reverse()
        const more =
            comments.length > shown.length ? ` (latest ${shown.length} of ${comments.length})` : ''
        out.push(`## COMMENTS — ${comments.length}${more}, oldest first`)
        if (shown.length === 0) {
            out.push('')
            out.push('(none)')
        }
        for (const c of shown) {
            const who = c.memberCreator?.fullName || c.memberCreator?.username || 'unknown'
            out.push('')
            out.push(`### ${c.date} — ${who}`)
            out.push('')
            out.push(c.data.text.trim())
        }
    }

    out.push('')
    out.push('---')
    out.push('')
    out.push('END OF CARD. Nothing above was inferred, summarised or supplemented.')
    return out.join('\n')
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2)
    const creds = loadCreds()

    const flag = (name: string): string | undefined => {
        const withEq = argv.find((a) => a.startsWith(`--${name}=`))
        if (withEq) return withEq.slice(name.length + 3)
        const i = argv.indexOf(`--${name}`)
        return i >= 0 ? argv[i + 1] : undefined
    }

    const boardLists = async (): Promise<TrelloList[]> =>
        call<TrelloList[]>(creds, `/boards/${creds.boardId}/lists`, { query: { fields: 'name' } })

    const listByName = async (name: string): Promise<TrelloList> => {
        const lists = await boardLists()
        const hit = lists.find((l) => l.name.toLowerCase() === name.toLowerCase())
        if (!hit) {
            throw new Error(
                `No list named "${name}". Board lists: ${lists.map((l) => l.name).join(', ')}`
            )
        }
        return hit
    }

    if (argv.includes('--lists')) {
        for (const l of await boardLists()) console.log(l.name)
        return
    }

    const cardsIn = flag('cards')
    if (cardsIn) {
        const target = await listByName(cardsIn)
        const cards = await call<TrelloCard[]>(creds, `/lists/${target.id}/cards`, {
            query: { fields: 'idShort,name' }
        })
        if (cards.length === 0) console.log(`(${target.name} is empty)`)
        for (const c of cards) console.log(`#${c.idShort} ${c.name}`)
        return
    }

    if (argv.includes('--create')) {
        const name = flag('name')
        const listName = flag('list')
        const descFile = flag('desc-file')
        const checklistFile = flag('checklist-file')
        if (!name || !listName) {
            throw new Error('--create needs --name and --list (and normally --desc-file).')
        }

        const desc = descFile ? readFileSync(resolve(descFile), 'utf8') : ''
        const target = await listByName(listName)
        const created = await call<TrelloCard>(creds, '/cards', {
            method: 'POST',
            query: { idList: target.id, pos: 'bottom' },
            body: { name, desc }
        })
        console.log(`Created #${created.idShort} in ${target.name}: ${created.shortUrl}`)

        if (checklistFile) {
            const items = readFileSync(resolve(checklistFile), 'utf8')
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && !l.startsWith('#'))
            if (items.length > 0) {
                const cl = await call<Checklist>(creds, `/cards/${created.id}/checklists`, {
                    method: 'POST',
                    query: { name: 'Steps' }
                })
                // Sequential on purpose: Trello orders check items by insertion, and parallel
                // POSTs come back in a nondeterministic order.
                for (const item of items) {
                    await call(creds, `/checklists/${cl.id}/checkItems`, {
                        method: 'POST',
                        query: { name: item, pos: 'bottom' }
                    })
                }
                console.log(`Added ${items.length} checklist item(s).`)
            }
        }
        return
    }

    const ref = argv.find((a) => !a.startsWith('--'))
    if (!ref) {
        console.error('Usage: npm run trello -- <card-number|shortLink|url> [flags]')
        process.exit(1)
    }

    const card = await resolveCard(creds, ref)

    const comment = flag('comment')
    const moveTo = flag('move')
    const check = flag('check')
    const setDescFile = flag('set-desc-file')
    const isWrite = Boolean(comment || moveTo || check || setDescFile)

    if (setDescFile) {
        const desc = readFileSync(resolve(setDescFile), 'utf8')
        await call(creds, `/cards/${card.id}`, { method: 'PUT', body: { desc } })
        console.log(`Set description on #${card.idShort} (${desc.length} bytes).`)
    }

    if (comment) {
        await call(creds, `/cards/${card.id}/actions/comments`, {
            method: 'POST',
            body: { text: comment }
        })
        console.log(`Commented on #${card.idShort}.`)
    }

    if (moveTo) {
        const target = await listByName(moveTo)
        await call(creds, `/cards/${card.id}`, { method: 'PUT', query: { idList: target.id } })
        console.log(`Moved #${card.idShort} to ${target.name}.`)
    }

    if (check) {
        const checklists = await call<Checklist[]>(creds, `/cards/${card.id}/checklists`)
        const needle = check.toLowerCase()
        const matches = checklists
            .flatMap((cl) => cl.checkItems)
            .filter((it) => it.name.toLowerCase().includes(needle))
        if (matches.length === 0) throw new Error(`No checklist item matching "${check}".`)
        if (matches.length > 1) {
            throw new Error(
                `"${check}" matches ${matches.length} items — be more specific:\n` +
                    matches.map((m) => `  - ${m.name}`).join('\n')
            )
        }
        const item = matches[0]
        await call(creds, `/cards/${card.id}/checkItem/${item.id}`, {
            method: 'PUT',
            query: { state: 'complete' }
        })
        console.log(`Ticked: ${item.name}`)
    }

    if (isWrite) return

    const commentsFlag = flag('comments')
    const commentLimit = commentsFlag === undefined ? 10 : Number(commentsFlag)
    if (!Number.isInteger(commentLimit) || commentLimit < 0) {
        throw new Error('--comments needs a whole number (0 hides comments).')
    }

    const [checklists, list, comments] = await Promise.all([
        call<Checklist[]>(creds, `/cards/${card.id}/checklists`),
        call<TrelloList>(creds, `/lists/${card.idList}`, { query: { fields: 'name' } }),
        commentLimit > 0
            ? call<TrelloComment[]>(creds, `/cards/${card.id}/actions`, {
                  query: {
                      filter: 'commentCard',
                      limit: '1000',
                      memberCreator_fields: 'fullName,username'
                  }
              })
            : Promise.resolve([])
    ])

    console.log(renderCard(card, list.name, checklists, comments, commentLimit))
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
})
