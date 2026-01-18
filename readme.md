
# Toy Derby: Grand Prix 🐎

ブラウザで楽しめる、リッチな3D競馬観戦シミュレーションゲームです。
Three.jsによる臨場感あふれるレースシーン、個性的な馬たちのスキル発動、そして興奮の実況システムを体験してください。

## 🎮 特徴 (Features)

- **3Dグラフィックス**: Three.jsを使用した本格的な3Dレース描写。
- **多彩な演出**: TV中継のようなダイナミックなカメラワーク、天候変化、スキルエフェクト、スローモーションゴール。
- **個性豊かな競走馬**: それぞれ異なる外見、パラメーター、固有スキル（必殺技）を持つユニークな馬たちが登場。
- **実況システム**: レース展開に合わせてリアルタイムにテキスト表示＆音声合成による読み上げを行います。
- **ベッティング**: 推し馬に賭けて所持金を増やすゲーム要素を搭載。

## 🕹️ 遊び方 (How to Play)

1. **馬を選ぶ**: エントリーしている5頭の馬の中から、オッズや特徴を見て賭ける馬をクリックして選びます。
2. **レース開始**: 「START RACE」ボタンを押してレーススタート！所持金から100Gがベットされます。
3. **観戦**: 
    - 自動でカメラが切り替わりますが、右上のボタンで「追尾」「上空」「サイド」「TVモード」を手動で切り替えることも可能です。
    - 馬たちのスキル発動（カットイン演出）や位置取りに注目してください。
4. **結果**: 選んだ馬が見事1着になれば、オッズに応じた賞金を獲得できます。
5. **次へ**: 「NEXT RACE」で次のレースへ。コースはランダムに変更されます。

## 🐴 登場する馬 (Horses)

| 名前 | カラー | 特徴 | スキル |
| --- | --- | --- | --- |
| **ホワイトウィンド** | ⚪ 白 | 天使の翼を持つ。 | **Divine Wind**: ラストスパート超加速 |
| **チョコチップ** | 🟤 茶 | チョコチップ模様。 | **Sugar Rush**: 中盤で爆発的な加速 |
| **ブラックジャック** | ⚫ 黒 | サイバーバイザー装備。 | **Shadow Step**: スタミナ減らずに加速 |
| **ゴールデンボーイ** | 🟡 金 | 王冠を被った王者の風格。 | **Gold Aura**: 全体的な速度底上げ |
| **シルバーブレット** | ⚪ 銀 | ロケットブースター搭載。 | **Bullet Time**: ゴール直前で一瞬の伸び |

## 🛠️ 技術スタック

*   **HTML5 / JavaScript (Vanilla)**: フレームワークなしのピュアな実装。
*   **Three.js**: 3Dレンダリング、モデル生成（プリミティブの組み合わせ）、パーティクルシステム。
*   **TailwindCSS**: モダンで美しいUIスタイリング。
*   **Web Audio API**: BGM、効果音のプロシージャル生成。
*   **Web Speech API**: ブラウザ標準機能による音声実況。

## 📊 プログラムフローチャート

```mermaid
graph TD
    %% 初期化フェーズ
    Start((開始)) --> Init["<b>initGame()</b><br/>Three.js初期化<br/>コース生成<br/>馬・ゲート生成<br/>UI構築"]
    Init --> IdleState["<b>待機状態</b><br/>カメラ: トラック全景を旋回<br/>馬: 待機モーション"]

    %% ユーザー操作フェーズ
    IdleState --> UserSelect["<b>ユーザー操作</b><br/>馬を選択 selectHorse()"]
    UserSelect --> BetCheck{所持金チェック}
    BetCheck -- OK --> EnableStart[スタートボタン有効化]
    BetCheck -- NG --> IdleState
    EnableStart --> UserStart[<b>STARTボタン押下</b>]

    %% レース準備フェーズ
    UserStart --> PreRace["<b>レース開始処理 startRace()</b><br/>・ベット金支払い<br/>・天候決定  applyWeather()<br/>・カメラモード変更<br/>・ファンファーレ再生"]
    PreRace --> Countdown["<b>カウントダウン</b><br/>3, 2, 1... GO!"]
    
    %% メインループ (Animate)
    subgraph MainLoop ["<b>メインループ animate()</b>"]
        UpdateDelta[デルタ時間計算<br/>スローモーション判定]
        updateGates[ゲート更新<br/>開閉アニメーション]
        updateHorses["<b>各馬の更新 Horse.update()</b><br/>・位置/速度計算<br/>・スキル判定/発動<br/>・モデルアニメーション"]
        updateEffects[エフェクト更新<br/>パーティクル/観客]
        updateCam["カメラ制御 updateCamera()<br/>TV中継風/追尾など"]
        Render[Three.js レンダリング]
        UpdateDelta --> updateGates --> updateHorses --> updateEffects --> updateCam --> Render
    end
    Countdown --> RaceStarted[<b>レース中フラグ ON</b>]
    RaceStarted --> MainLoop
    %% レース中の判定
    updateHorses -- ゴール? --> CheckWinner{着順判定}
    CheckWinner -- 1着確定 --> AnnounceWin[実況: 勝者コール]
    CheckWinner -- 全馬ゴール? --> FinishRace["<b>レース終了 finishRace()</b>"]
    
    %% リザルトフェーズ
    FinishRace --> ResultState["<b>リザルト画面</b><br/>・ウィニングラン isWinningRun<br/>・紙吹雪 Confetti<br/>・配当金計算"]
    
    ResultState --> UserReset[<b>NEXT RACEボタン押下</b>]
    UserReset --> ResetProcess["<b>リセット処理 resetGame()</b><br/>・コース再抽選<br/>・パラメータ初期化"]
    ResetProcess --> IdleState
```