
// ================================================================================
// サウンド管理システム (Web Audio API)
// ================================================================================
// ゲーム内の全ての音響効果を管理するオブジェクト
// - BGM、効果音、実況音声の再生を制御
// - Web Audio APIを使用してプロシージャルな音を生成
// - Speech Synthesis APIで実況テキストを読み上げ
export const SoundManager = {
    // Web Audio APIのコンテキスト(音声処理の中核)
    ctx: null,
    // ミュート状態フラグ
    isMuted: false,

    /**
     * オーディオコンテキストの初期化
     * ユーザーインタラクション後に呼び出す必要がある(ブラウザのポリシー)
     */
    init: function () {
        // コンテキストが未作成の場合は新規作成
        if (!this.ctx) {
            const AudioContext =
                window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        // サスペンド状態の場合は再開(ブラウザの自動再生ポリシー対策)
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    },

    /**
     * オシレーター(発振器)を使用して音を生成・再生
     * @param {string} type - 波形タイプ ('sine', 'square', 'triangle', 'sawtooth')
     * @param {number} freq - 周波数(Hz)
     * @param {number} duration - 持続時間(秒)
     * @param {number} startTime - 開始遅延時間(秒)
     * @param {number} vol - 音量(0.0-1.0)
     */
    playOscillator: function (
        type,
        freq,
        duration,
        startTime = 0,
        vol = 0.1,
    ) {
        if (!this.ctx || this.isMuted) return;
        // オシレーターノード(音源)を作成
        const osc = this.ctx.createOscillator();
        // ゲインノード(音量調整)を作成
        const gain = this.ctx.createGain();
        // 波形タイプを設定
        osc.type = type;
        // 周波数を設定
        osc.frequency.setValueAtTime(
            freq,
            this.ctx.currentTime + startTime,
        );
        // 初期音量を設定
        gain.gain.setValueAtTime(
            vol,
            this.ctx.currentTime + startTime,
        );
        // 音量を徐々に減衰させる(フェードアウト効果)
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            this.ctx.currentTime + startTime + duration,
        );
        // オシレーターをゲインに接続
        osc.connect(gain);
        // ゲインをスピーカー出力に接続
        gain.connect(this.ctx.destination);
        // 音の再生開始
        osc.start(this.ctx.currentTime + startTime);
        // 音の再生停止
        osc.stop(this.ctx.currentTime + startTime + duration);
    },

    /**
     * UIクリック音を再生
     * 800Hzのサイン波で短い「ピッ」という音
     */
    playClick: function () {
        this.playOscillator("sine", 800, 0.1, 0, 0.1);
    },

    /**
     * カウントダウン音を再生
     * @param {number} count - カウント数(0でGO!音)
     */
    playCountdown: function (count) {
        if (count > 0) {
            // 3, 2, 1のカウント音(600Hzの矩形波)
            this.playOscillator("square", 600, 0.15, 0, 0.1);
        } else {
            // GO!の音(1200Hzの矩形波、より高く長い)
            this.playOscillator("square", 1200, 0.4, 0, 0.1);
        }
    },

    /**
     * スタートゲート開放音を再生
     * ホワイトノイズをローパスフィルターで加工して重厚な音を生成
     */
    playGate: function () {
        if (!this.ctx || this.isMuted) return;
        // ノイズバッファを作成(0.5秒分)
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(
            1,
            bufferSize,
            this.ctx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        // ホワイトノイズを生成(ランダムな値)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        // バッファソースノードを作成
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();

        // ローパスフィルター(高周波をカット)で重厚な音に加工
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 500; // 500Hz以下の周波数のみ通過

        // 音量を設定し、徐々に減衰
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            this.ctx.currentTime + 0.3,
        );

        // ノード接続: ノイズ → フィルター → ゲイン → 出力
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    },

    /**
     * ファンファーレ音を再生
     * アルペジオ(分散和音)でC-E-G-Cのメロディーを演奏
     */
    playFanfare: function () {
        if (!this.ctx || this.isMuted) return;
        // Cメジャーコードの音階(ド・ミ・ソ・ド)
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C, E, G, C
        // 各音を0.15秒間隔で順次再生
        notes.forEach((freq, i) => {
            this.playOscillator(
                "triangle",
                freq,
                0.3,
                i * 0.15,
                0.15,
            );
        });
        // 最後の高いCを長めに再生
        this.playOscillator("triangle", 1046.5, 0.8, 0.6, 0.15);
    },

    /**
     * スキル発動音を再生
     * 周波数が上昇する効果音(400Hz → 1200Hz)
     */
    playSkill: function () {
        if (!this.ctx || this.isMuted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        // 開始周波数を設定
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        // 0.5秒かけて周波数を上昇(ピッチベンド効果)
        osc.frequency.linearRampToValueAtTime(
            1200,
            this.ctx.currentTime + 0.5,
        );
        // 音量を設定し、徐々に減衰
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(
            0,
            this.ctx.currentTime + 0.5,
        );
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    },

    /**
     * 勝利音を再生
     * メジャーコード(C-E-G)を同時に鳴らして華やかな音を生成
     */
    playWin: function () {
        if (!this.ctx || this.isMuted) return;
        // Cメジャーコードの構成音
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((f) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "triangle"; // 三角波で柔らかい音色
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 1.0);
        });
    },

    // 環境音用のノードとフィルター状態
    noiseNode: null,
    lastOut: 0,

    /**
     * 環境音(観客の歓声・馬の蹄の音)をループ再生
     * @param {boolean} active - true:再生開始, false:停止
     */
    playAtmosphere: function (active) {
        if (!this.ctx || this.isMuted) return;
        if (active) {
            // 既に再生中の場合は何もしない
            if (this.noiseNode) return;
            // ピンクノイズ風の音を生成(ホワイトノイズより低周波が強調)
            const bufferSize = this.ctx.sampleRate * 2;
            const buffer = this.ctx.createBuffer(
                1,
                bufferSize,
                this.ctx.sampleRate,
            );
            const data = buffer.getChannelData(0);
            // ローパスフィルター効果を持つノイズ生成
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                // 前の値と混ぜることで低周波を強調
                data[i] = (this.lastOut + 0.02 * white) / 1.02;
                this.lastOut = data[i];
                data[i] *= 3.5; // 音量を増幅
            }
            this.noiseNode = this.ctx.createBufferSource();
            this.noiseNode.buffer = buffer;
            this.noiseNode.loop = true; // ループ再生を有効化

            // 音量調整
            const gain = this.ctx.createGain();
            gain.gain.value = 0.05; // 控えめな音量

            // ローパスフィルターで高周波をカット(こもった音に)
            const filter = this.ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = 400;

            // ノード接続
            this.noiseNode.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            this.noiseNode.start();
            this.bgGain = gain;
        } else {
            // 環境音を停止
            if (this.noiseNode) {
                this.noiseNode.stop();
                this.noiseNode = null;
                this.lastOut = 0;
            }
        }
    },

    /**
     * テキストを音声で読み上げ(実況)
     * @param {string} text - 読み上げるテキスト
     */
    speak: function (text) {
        if (this.isMuted) return;
        if (!window.speechSynthesis) return;

        // 現在再生中の音声をキャンセル(新しい実況を優先)
        window.speechSynthesis.cancel();

        // 音声合成の設定
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ja-JP"; // 日本語
        utterance.rate = 1.3; // 話速(1.3倍速で興奮感を演出)
        utterance.pitch = 1.1; // ピッチ(やや高めで明るい印象)
        utterance.volume = 1.0; // 音量(最大)

        // 音声を再生
        window.speechSynthesis.speak(utterance);
    },
};
