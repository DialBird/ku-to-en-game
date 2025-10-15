import rawEmojis from "./emojis.json?raw"

export interface EmojiDefinition {
  id: string
  emoji: string
  name: string
  category: string
}

const parsed: EmojiDefinition[] = JSON.parse(rawEmojis)

export const EMOJIS: readonly EmojiDefinition[] = parsed
export const FACE_EMOJIS: readonly EmojiDefinition[] = parsed.filter(
  (emoji) => emoji.category === "face",
)

export function findEmojiById(id: string): EmojiDefinition | undefined {
  return parsed.find((emoji) => emoji.id === id)
}
