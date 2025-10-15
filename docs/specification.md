# 『空と縁ゲーム』仕様書 （MVP極シンプル版 / Web・TypeScript）

## 0. 目的

**できるだけシンプルに、選ぶ→合体を見る→もう一回** のループだけを体験できるMVP。

* Emoji Kitchen（または代替合成）で合体画像を取得して中央に表示。

---

## 1. ゲームループ（唯一の体験）

1. **Start** ボタン押下。
2. 画面中央に **顔系のメイン絵文字**（例: 😀）を表示。
3. その周囲に **ランダムな4つの絵文字**を表示（カテゴリはバラバラ、重複なし）。
4. プレイヤーが **1つ選択**。
5. **Emoji Kitchen 合体結果** を取得・中央に表示。
6. 右下に **[もう一回やる？]（Yes/No）** を表示。

   * Yes: 合体結果を**新しいメイン**として、手順3に戻る。
   * No: ホーム（Start画面）に戻る。

> 以上をひたすら繰り返すだけ。

---

## 2. 画面/UI

* **ホーム**: タイトル / [Start] / 簡単な説明テキスト（「顔＋何かを選ぶと合体します」）
* **プレイ**:

  * 中央: 現在のメイン絵文字（大アイコン）
  * 周囲: 候補4つ（ボタン。ホバー/フォーカスで軽い拡大）
  * フッタ: ステータス（"選んで合体"）
  * 合体後: 中央に合体画像、右下に [もう一回？ Yes / No]
* **アクセシビリティ**: Tabで候補選択、Enterで決定。Yes/No は Y/N で入力可。

---

## 3. データ構造（最小）

```ts
export type EmojiId = string; // "u1F600" など

export interface MergeResult {
  id: string;        // 例: "u1F600_u1F525"
  imageUrl?: string; // Emoji Kitchen 画像 or 代替
  text: string;      // フォールバック表現 "😀×🔥"
}

export interface PlayState {
  main: EmojiId;        // 現在中央に表示する絵文字
  candidates: EmojiId[]; // 周囲4つ
  lastMerge?: MergeResult; // 直近の合体
}
```

---

## 4. 主要関数（MVP）

```ts
function pickInitialMainFace(): EmojiId { /* 顔カテゴリから1つ乱択 */ }

function pickCandidates(main: EmojiId): EmojiId[] {
  // カテゴリ多様性をざっくり担保しつつ 4 つ取得（重複なし）
}

async function getMergedEmoji(e1: EmojiId, e2: EmojiId): Promise<MergeResult> {
  // Emoji Kitchen 取得。なければフォールバック。
}
```

---

## 5. ステート遷移（超シンプル）

```
HOME -> PLAYING_SELECT -> MERGED_VIEW -> PLAYING_SELECT ...
(終了) MERGED_VIEW --[No]--> HOME
```

* `PLAYING_SELECT`: main + candidates を表示し、選択を待つ。
* `MERGED_VIEW`: 合体結果を中央表示。「もう一回?」を待つ。

---

## 6. Emoji Kitchen 連携（方針）

* まずは **利用許諾を確認**。NG/未確定なら**代替**：

  1. 内部SVG合成（単純重ね合わせ/位置調整）
  2. テキスト表現（`E1 + E2`）
* 画像はCDNキャッシュ。取得失敗は即フォールバック。

---

## 7. 実装詳細（最小構成）

* **技術**: Vite + React + TypeScript + Tailwind（任意）
* **状態管理**: useState だけで十分（Zustand等不要）
* **乱数**: `Math.random()`（将来seed導入可）
* **データ**: `emojis.json`（顔カテゴリ + その他カテゴリの少数セットで開始, 例: 80～120個）
* **キーボード**: 数字キー 1–4 で候補選択、Y=Yes / N=No

---

## 8. 例: React 擬似コード（要点のみ）

```tsx
function App() {
  const [mode, setMode] = useState<'HOME'|'SELECT'|'MERGED'>('HOME');
  const [state, setState] = useState<PlayState | null>(null);

  const start = () => {
    const main = pickInitialMainFace();
    setState({ main, candidates: pickCandidates(main) });
    setMode('SELECT');
  };

  const choose = async (choice: EmojiId) => {
    if (!state) return;
    const merged = await getMergedEmoji(state.main, choice);
    setState({ ...state, lastMerge: merged });
    setMode('MERGED');
  };

  const again = () => {
    if (!state?.lastMerge) return start();
    const main = extractMainFromMerge(state.lastMerge); // 合体結果を新メインに
    setState({ main, candidates: pickCandidates(main) });
    setMode('SELECT');
  };

  const backHome = () => setMode('HOME');

  return (
    // HOME / SELECT / MERGED の3画面を条件分岐レンダリング
  );
}
```

---

## 9. タスク（MVP）

* [ ] `emojis.json`（顔カテゴリ20～30、その他50～80）
* [ ] UI（HOME/SELECT/MERGED）
* [ ] 候補4つの乱択 + 重複なし
* [ ] Emoji Kitchen API/アセット方針決定 & フォールバック
* [ ] キーボード操作（1–4, Y/N）
* [ ] 画像取得失敗時の即時フォールバック

---

> 極限まで削ぎ落とした **「選ぶ→合体→もう一回？」** だけの体験に集中します。
