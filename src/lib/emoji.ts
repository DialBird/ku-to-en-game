import { EMOJIS, FACE_EMOJIS, type EmojiDefinition } from "@/data"

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

const KITCHEN_BASES = [
  "https://www.gstatic.com/android/keyboard/emojikitchen/20201001",
  "https://www.gstatic.com/android/keyboard/emojikitchen/20240226",
]

function buildKitchenUrls(a: EmojiDefinition, b: EmojiDefinition): string[] {
  const pairs: [EmojiDefinition, EmojiDefinition][] = [
    [a, b],
    [b, a],
  ]
  const urls: string[] = []
  for (const [first, second] of pairs) {
    for (const base of KITCHEN_BASES) {
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

export async function getMergedEmoji(
  primary: EmojiDefinition,
  secondary: EmojiDefinition,
): Promise<MergeResult> {
  const candidateUrls = buildKitchenUrls(primary, secondary)

  for (const url of candidateUrls) {
    try {
      await ensureImageLoaded(url)
      return {
        id: `${primary.id}_${secondary.id}`,
        imageUrl: url,
        text: `${primary.emoji}×${secondary.emoji}`,
        primary,
        secondary,
      }
    } catch (error) {
      console.warn("Emoji Kitchen image failed", url, error)
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
