import { useCallback, useEffect, useMemo, useState } from "react"
import "./App.css"
import { Button } from "./components/ui/button"
import type { EmojiDefinition } from "./data"
import {
  extractMainFromMerge,
  getMergedEmoji,
  pickCandidates,
  pickInitialMainFace,
  type PlayState,
} from "./lib/emoji"

const STATUS_MESSAGES = {
  select: "好きな絵文字を選んで合体！ (1〜4で選択)",
  merging: "合体中…",
  merged: "もう一回やる？ (Y / N)",
} as const

type Mode = "HOME" | "SELECT" | "MERGED"

function CandidateButton({
  emoji,
  index,
  onChoose,
  disabled,
}: {
  emoji: EmojiDefinition
  index: number
  onChoose: (emoji: EmojiDefinition) => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onChoose(emoji)}
      disabled={disabled}
      className="group relative flex h-32 flex-col items-center justify-center rounded-3xl border-2 border-slate-200 bg-white/80 p-4 text-5xl font-semibold leading-none text-slate-900 shadow-lg transition-all duration-150 ease-out hover:-translate-y-1 hover:scale-105 focus-visible:-translate-y-1 focus-visible:scale-105 focus-visible:border-sky-400 focus-visible:shadow-xl disabled:translate-y-0 disabled:scale-100 disabled:opacity-60"
      aria-label={`${emoji.name} を選択 (${index + 1}キー)`}
    >
      <span className="absolute left-3 top-3 text-xs font-bold uppercase tracking-wide text-slate-400">
        {index + 1}
      </span>
      <span className="text-6xl leading-none">{emoji.emoji}</span>
      <span className="mt-3 text-sm font-semibold text-slate-600 group-hover:text-slate-800">
        {emoji.name}
      </span>
    </button>
  )
}

function FusionPreview({ result }: { result: NonNullable<PlayState["lastMerge"]> }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative flex size-56 items-center justify-center overflow-hidden rounded-4xl border-4 border-white/70 bg-white/80 shadow-2xl">
        {result.imageUrl ? (
          <img
            src={result.imageUrl}
            alt={`${result.primary.name} と ${result.secondary.name} の合体`}
            className="size-full object-contain"
          />
        ) : (
          <div className="relative flex size-full items-center justify-center">
            <span className="text-8xl drop-shadow-sm">{result.primary.emoji}</span>
            <span className="absolute text-8xl opacity-80 drop-shadow-sm">
              {result.secondary.emoji}
            </span>
          </div>
        )}
      </div>
      <p className="text-lg font-semibold text-slate-700" aria-live="polite">
        {result.text}
      </p>
    </div>
  )
}

function App() {
  const [mode, setMode] = useState<Mode>("HOME")
  const [state, setState] = useState<PlayState | null>(null)
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusMessage = useMemo(() => {
    if (mode === "SELECT") return isMerging ? STATUS_MESSAGES.merging : STATUS_MESSAGES.select
    if (mode === "MERGED") return STATUS_MESSAGES.merged
    return "Start を押してはじめよう"
  }, [isMerging, mode])

  const startGame = useCallback(() => {
    const main = pickInitialMainFace()
    const candidates = pickCandidates(main)
    setState({ main, candidates })
    setMode("SELECT")
    setIsMerging(false)
    setError(null)
  }, [])

  const chooseEmoji = useCallback(
    async (emoji: EmojiDefinition) => {
      if (!state || mode !== "SELECT" || isMerging) return
      setIsMerging(true)
      setError(null)
      try {
        const merged = await getMergedEmoji(state.main, emoji)
        setState((prev) => (prev ? { ...prev, lastMerge: merged } : prev))
        setMode("MERGED")
      } catch (err) {
        console.error(err)
        setError("合体に失敗しました。別の絵文字で試してください。")
        setMode("SELECT")
      } finally {
        setIsMerging(false)
      }
    },
    [isMerging, mode, state],
  )

  const playAgain = useCallback(() => {
    setState((prev) => {
      if (!prev?.lastMerge) {
        const main = pickInitialMainFace()
        return { main, candidates: pickCandidates(main) }
      }
      const main = extractMainFromMerge(prev.lastMerge)
      return {
        main,
        candidates: pickCandidates(main),
      }
    })
    setMode("SELECT")
    setIsMerging(false)
    setError(null)
  }, [])

  const backHome = useCallback(() => {
    setMode("HOME")
    setState(null)
    setIsMerging(false)
    setError(null)
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (mode === "HOME" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault()
        startGame()
        return
      }

      if (mode === "SELECT") {
        if (isMerging) return
        if (!state) return
        if (["1", "2", "3", "4"].includes(event.key)) {
          const index = Number.parseInt(event.key, 10) - 1
          const target = state.candidates[index]
          if (target) {
            event.preventDefault()
            void chooseEmoji(target)
          }
        }
        return
      }

      if (mode === "MERGED") {
        if (event.key.toLowerCase() === "y") {
          event.preventDefault()
          playAgain()
        } else if (event.key.toLowerCase() === "n") {
          event.preventDefault()
          backHome()
        }
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [backHome, chooseEmoji, isMerging, mode, playAgain, startGame, state])

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-emerald-100 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-12 px-4 py-12">
        {mode === "HOME" && (
          <section className="flex flex-col items-center gap-6 text-center">
            <h1 className="text-5xl font-black tracking-tight text-slate-900">
              空と縁ゲーム
            </h1>
            <p className="max-w-xl text-lg text-slate-600">
              顔のメイン絵文字にぴったりな仲間を選んで、Emoji Kitchen での合体やフォールバックの表現を楽しもう。
            </p>
            <Button
              type="button"
              size="lg"
              onClick={startGame}
              className="rounded-full px-10 py-5 text-xl font-semibold shadow-lg shadow-sky-200 transition hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Start
            </Button>
            <p className="text-sm text-slate-500">Enter / Space でも開始できます</p>
          </section>
        )}

        {mode === "SELECT" && state && (
          <section className="flex w-full flex-col items-center gap-12">
            <div className="grid w-full gap-10 lg:grid-cols-[1fr_minmax(0,1.2fr)] lg:items-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  メイン
                </span>
                <div className="flex min-h-[16rem] min-w-[16rem] flex-col items-center justify-center gap-4 rounded-4xl border border-white/70 bg-white/80 px-8 py-10 shadow-xl">
                  <span className="text-8xl drop-shadow">{state.main.emoji}</span>
                  <p className="text-base font-medium text-slate-600">{state.main.name}</p>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  合体させる相手を選ぶ (1〜4)
                </span>
                <div className="grid gap-4 sm:grid-cols-2">
                  {state.candidates.map((candidate, index) => (
                    <CandidateButton
                      key={candidate.id}
                      emoji={candidate}
                      index={index}
                      onChoose={(item) => void chooseEmoji(item)}
                      disabled={isMerging}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {mode === "MERGED" && state?.lastMerge && (
          <section className="flex w-full flex-col items-center gap-10 text-center">
            <FusionPreview result={state.lastMerge} />
            <p className="text-base text-slate-600">もう一回やる？ (Y / N)</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                type="button"
                size="lg"
                onClick={playAgain}
                className="rounded-full px-8 py-4 text-lg font-semibold shadow-lg shadow-emerald-200"
              >
                Yes
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={backHome}
                className="rounded-full px-8 py-4 text-lg font-semibold"
              >
                No
              </Button>
            </div>
          </section>
        )}

        <footer className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-slate-700" aria-live="polite">
            {statusMessage}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </footer>
      </main>
    </div>
  )
}

export default App
