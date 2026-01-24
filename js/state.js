
// ================================================================================
// ゲーム状態管理
// ================================================================================
// レースの進行状況、所持金、カメラ設定などを保持
export const STATE = {
    wallet: 1000, // 所持金(ゲーム内通貨)
    betAmount: 100, // 賭け金額(固定)
    selectedHorse: null, // プレイヤーが選択した馬のID
    isRacing: false, // レース中かどうか
    raceStarted: false, // レースが実際に開始されたか(カウントダウン後)
    horses: [], // 馬オブジェクトの配列
    gates: [], // ゲートオブジェクトの配列
    cameraMode: 0, // カメラモード (0:追従, 1:上空, 2:サイド, 3:オート)
    lastAutoSwitch: 0, // オートカメラの最後の切り替え時刻
    autoShotType: 0, // オートカメラの現在のショットタイプ
    trackCurve: null, // トラックの曲線オブジェクト(CatmullRomCurve3)
    winner: null, // 勝者の馬オブジェクト
    weather: null, // 現在の天候オブジェクト
    trackCondition: null, // 馬場状態(良、重など)
    rainParticles: null, // 雨のパーティクルオブジェクト
    isWinningRun: false, // 勝利走行演出中かどうか
    cameraShake: 0, // カメラシェイクの強度
    timeScale: 1.0, // 時間スケール(スローモーション用)
    currentCourse: null, // 現在選択されているコース
};

export let GP_STATE = {
    active: false,
    round: 1,
    maxRounds: 5,
    relics: [],
    totalScore: 0,
    nextWeather: null,
    nextCourse: null
};
