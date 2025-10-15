import { EMOJIS, FACE_EMOJIS, type EmojiDefinition } from "@/data"

const EMOJI_KITCHEN_API_BASE = "https://emoji-kitchen.vercel.app/api"

const LEGACY_KITCHEN_BASES = [
  "https://www.gstatic.com/android/keyboard/emojikitchen/20201001",
  "https://www.gstatic.com/android/keyboard/emojikitchen/20240226",
]

interface KitchenApiResult {
  id?: string
  url?: string
  imageUrl?: string
  text?: string
}

function buildLegacyUrls(a: EmojiDefinition, b: EmojiDefinition): string[] {
  const pairs: [EmojiDefinition, EmojiDefinition][] = [
    [a, b],
    [b, a],
  ]
  const urls: string[] = []
  for (const [first, second] of pairs) {
    for (const base of LEGACY_KITCHEN_BASES) {
      urls.push(`${base}/${first.id}/${first.id}_${second.id}.png`)
    }
  }
  return urls
}

function ensureImageLoaded(url: string): Promise<void> {
  if (typeof Image === "undefined") {
    return Promise.reject(new Error("Image API unavailable"))
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("Failed to load"))
    image.src = url
  })
}

function extractKitchenPayload(payload: unknown): KitchenApiResult | null {
  if (!payload) return null

  if (typeof payload === "string") {
    return { url: payload }
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const result = extractKitchenPayload(item)
      if (result) return result
    }
    return null
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>
    const url =
      typeof record.url === "string"
        ? record.url
        : typeof record.imageUrl === "string"
          ? record.imageUrl
          : undefined

    const text =
      typeof record.text === "string"
        ? record.text
        : typeof record.description === "string"
          ? record.description
          : undefined

    const id = typeof record.id === "string" ? record.id : undefined

    if (url) {
      return { id, url, text }
    }

    for (const key of ["result", "results", "data", "fusion", "payload"]) {
      if (key in record) {
        const nested = extractKitchenPayload(record[key])
        if (nested) {
          return {
            id: nested.id ?? id,
            url: nested.url,
            text: nested.text ?? text,
          }
        }
      }
    }
  }

  return null
}

async function fetchKitchenFusion(
  primary: EmojiDefinition,
  secondary: EmojiDefinition,
): Promise<KitchenApiResult | null> {
  const searchParamVariants: URLSearchParams[] = [
    new URLSearchParams({ primary: primary.id, secondary: secondary.id }),
    new URLSearchParams({ primary: primary.emoji, secondary: secondary.emoji }),
    new URLSearchParams({ emojis: `${primary.id},${secondary.id}` }),
  ]

  const pathVariants = ["fusion", "merge", ""]

  for (const path of pathVariants) {
    for (const params of searchParamVariants) {
      const endpoint = new URL(
        path ? `${path}?${params.toString()}` : `?${params.toString()}`,
        `${EMOJI_KITCHEN_API_BASE}/`,
      )

      try {
        const response = await fetch(endpoint.toString(), {
          headers: { Accept: "application/json" },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json().catch(() => null)
        const parsed = extractKitchenPayload(data)

        if (parsed?.url) {
          await ensureImageLoaded(parsed.url)
          return parsed
        }
      } catch (error) {
        console.debug("Emoji Kitchen API request failed", endpoint.toString(), error)
      }
    }
  }

  return tryLegacyKitchenFusion(primary, secondary)
}

async function tryLegacyKitchenFusion(
  primary: EmojiDefinition,
  secondary: EmojiDefinition,
): Promise<KitchenApiResult | null> {
  const candidateUrls = buildLegacyUrls(primary, secondary)

  for (const url of candidateUrls) {
    try {
      await ensureImageLoaded(url)
      return {
        id: `${primary.id}_${secondary.id}`,
        url,
        text: `${primary.emoji}×${secondary.emoji}`,
      }
    } catch (error) {
      console.debug("Emoji Kitchen legacy image failed", url, error)
    }
  }

  return null
}

export interface MergeResult {
  id: string
  imageUrl?: string
  text: string
  primary: EmojiDefinition
  secondary: EmojiDefinition
}

export interface PlayState {
  main: EmojiDefinition
  candidates: EmojiDefinition[]
  lastMerge?: MergeResult
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function pickInitialMainFace(): EmojiDefinition {
  if (FACE_EMOJIS.length === 0) {
    throw new Error("No face emojis available")
  }
  const index = Math.floor(Math.random() * FACE_EMOJIS.length)
  return FACE_EMOJIS[index]
}

export function pickCandidates(main: EmojiDefinition): EmojiDefinition[] {
  const pool = EMOJIS.filter((emoji) => emoji.id !== main.id)
  if (pool.length <= 4) {
    return shuffle(pool)
  }

  const byCategory = new Map<string, EmojiDefinition[]>()
  for (const emoji of pool) {
    if (!byCategory.has(emoji.category)) {
      byCategory.set(emoji.category, [])
    }
    byCategory.get(emoji.category)!.push(emoji)
  }

  const uniqueCategories = shuffle([...byCategory.keys()])
  const selected: EmojiDefinition[] = []
  const usedIds = new Set<string>()

  for (const category of uniqueCategories) {
    if (selected.length === 4) break
    const bucket = shuffle(byCategory.get(category) ?? [])
    for (const emoji of bucket) {
      if (usedIds.has(emoji.id)) continue
      selected.push(emoji)
      usedIds.add(emoji.id)
      break
    }
  }

  if (selected.length < 4) {
    for (const emoji of shuffle(pool)) {
      if (selected.length === 4) break
      if (usedIds.has(emoji.id)) continue
      selected.push(emoji)
      usedIds.add(emoji.id)
    }
  }

  return selected.slice(0, 4)
}

export async function getMergedEmoji(
  primary: EmojiDefinition,
  secondary: EmojiDefinition,
): Promise<MergeResult> {
  const result = await fetchKitchenFusion(primary, secondary)

  if (result) {
    const imageUrl = result.url ?? result.imageUrl
    return {
      id: result.id ?? `${primary.id}_${secondary.id}`,
      imageUrl,
      text: result.text ?? `${primary.emoji}×${secondary.emoji}`,
      primary,
      secondary,
    }
  }

  return {
    id: `${primary.id}_${secondary.id}`,
    text: `${primary.emoji}×${secondary.emoji}`,
    primary,
    secondary,
  }
}

export function extractMainFromMerge(merge: MergeResult): EmojiDefinition {
  return {
    id: merge.id,
    emoji: merge.text,
    name: `${merge.primary.name} + ${merge.secondary.name}`,
    category: "fusion",
  }
}
