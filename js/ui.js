
import { STATE } from './state.js';
import { SoundManager } from './utils/SoundManager.js';

// --- UI Helper Functions ---

export function showCutIn(horseName, skillName, icon) {
    const overlay = document.getElementById("cut-in-overlay");
    const hName = document.getElementById("cut-in-name");
    const sName = document.getElementById("cut-in-skill");
    const hIcon = document.getElementById("cut-in-horse");

    hName.innerText = horseName;
    sName.innerText = skillName + "!";
    hIcon.innerText = icon;

    overlay.classList.add("active");
    setTimeout(() => {
        overlay.classList.remove("active");
    }, 2000);
}

export function toggleMute() {
    SoundManager.isMuted = !SoundManager.isMuted;
    if (!SoundManager.isMuted) {
        SoundManager.init(); // Ensure context is resumed
        SoundManager.playClick();
    }
    const btn = document.getElementById("sound-toggle");
    if (btn) {
        btn.innerText = SoundManager.isMuted ? "🔇" : "🔊";
        btn.style.opacity = SoundManager.isMuted ? "0.5" : "1";
    }
}

// --- 実況システム ---
// レース展開に応じたテキスト表示と読み上げ
let lastCommentTime = 0;

const box = document.getElementById("commentary-box");
const txt = document.getElementById("commentary-text");

export function announce(msg) {
    if (!box || !txt) return;
    txt.innerText = msg;
    box.classList.add("active");
    SoundManager.speak(msg); // Read aloud
    setTimeout(() => {
        if (txt.innerText === msg) box.classList.remove("active");
    }, 3000);
}

export function updateCommentary(time) {
    if (time - lastCommentTime < 3.5) return;
    // Need STATE.horses
    if (!STATE.horses || STATE.horses.length === 0) return;

    const sorted = [...STATE.horses].sort(
        (a, b) => b.currentT - a.currentT,
    );
    const leader = sorted[0];
    const second = sorted[1];
    const last = sorted[sorted.length - 1];
    const p = leader.currentT;
    const gap = second ? (leader.currentT - second.currentT) : 0;
    const isClose = gap < 0.03;
    const isRunaway = gap > 0.08;
    let msg = "";

    if (p < 0.1) {
        // Keep initial start simple to avoid overlap with gate open
    } else if (p > 0.15 && p < 0.2) {
        const phrases = [
            `先手を奪ったのは ${leader.name} です！`,
            `${leader.name} が果敢にハナを主張しました！`,
            `まずは ${leader.name} がレースを引っ張ります。`,
            `スタートから積極的に出た ${leader.name}！`,
            `${leader.name} が好スタートを切りました！`,
            `序盤から ${leader.name} がリードを奪います！`,
            `${leader.name}、力強い先行！`,
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.25 && p < 0.35) {
        const phrases = [
            `${leader.name} が先頭をキープしています！`,
            `後続はどう動くか！？${leader.name} がマイペースで引っ張ります。`,
            isClose
                ? `${second ? second.name : "２番手"}が接近！${leader.name} を脅かす！`
                : `${leader.name}、現在余裕のある走りです！`,
            `各馬、序盤のポジション争いが続いています！`,
            `ペースはやや速い！各馬の脚が問われます！`,
            `${leader.name} が先頭、${second ? second.name : "２番手"}がぴったりと続きます！`,
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.45 && p < 0.5) {
        const phrases = [
            "レースは中盤、向こう正面に入っています！",
            "各馬、淡々としたペースで進んでいます。",
            `${leader.name}、軽快な逃げを見せています！`,
            "先頭から最後方まで、隊列は縦長になっています！",
            "おっと、後方から一気に馬群が動き出した！",
            isRunaway
                ? `${leader.name} が大きくリードを広げています！後続は追いつけるか！？`
                : `混戦！各馬が一団となって進んでいます！`,
            `${leader.name}、スタミナに余裕があるか！？`,
            `中盤戦、各馬の騎手が作戦を練っています！`,
            second ? `${second.name} が虎視眈々と２番手をキープ！` : "",
            `ペースが上がってきた！各馬の呼吸が荒くなります！`,
            `${last ? last.name : "最後方"}は後方から虎視眈々！大外一気はあるか！？`,
        ].filter(Boolean);
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.6 && p < 0.65) {
        const phrases = [
            `${leader.name}、第3コーナーに差し掛かります！`,
            "さあ、各馬がじわじわと動き始めました！",
            "後方の馬群がまとまって動き出した！",
            isClose
                ? "接戦！横一線の様相を呈してきた！"
                : `${leader.name} がリードを維持！苦しい展開の後続！`,
            `騎手が手綱を絞った！いよいよ勝負の時が近づく！`,
            `${second ? second.name : "２番手"}が外から並びかけようとしています！`,
            `残り半分！ここからがレースの真髄だ！`,
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.7 && p < 0.75) {
        const phrases = [
            "さあ、第3コーナーから第4コーナーへ！",
            "勝負どころ！各馬スパートの体勢に入ります！",
            "後続も差を詰めてきた！混戦模様です！",
            `${leader.name}、手応えはどうか！？`,
            "4コーナーを回って、直線コースへ！",
            isClose
                ? `${second ? second.name : "２番手"}が猛追！${leader.name} に迫る！`
                : `${leader.name} が独走態勢！このまま押し切れるか！？`,
            `各馬が仕掛けた！スパート合戦が始まりました！`,
            `騎手が必死に追い出す！残り僅か、どの馬が粘るか！`,
            `後方から一気に来る馬がいる！差し馬の猛追が始まった！`,
            `${leader.name}、手応えは十分！直線に向かいます！`,
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.85 && p < 0.9) {
        const phrases = [
            "さあ、最後の直線！ここからが勝負だ！",
            "直線コースに向いた！抜け出すのは誰だ！？",
            "残り200メートル！激しい叩き合い！",
            "外から一気に各馬が襲いかかる！",
            isClose
                ? `鼻の差の争い！${leader.name} と ${second ? second.name : "２番手"} が並んだ！`
                : `${leader.name} が先頭で直線へ！後続を引き離します！`,
            `どの馬も力の限り走っています！観客総立ち！`,
            `ゴールまであとわずか！諦めるな！`,
            `${leader.name}！${leader.name}！押せ押せ！`,
            `最後の直線、各馬が渾身のスパート！`,
            `全馬が限界を超えた走り！これがレースだ！`,
            second ? `${second.name} が外から追い込んできた！差し切れるか！？` : "",
            `騎手の鞭が入った！馬もそれに応えて加速！`,
        ].filter(Boolean);
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.92) {
        const phrases = [
            `${leader.name}！ゴール目前！力を振り絞れ！`,
            "ゴールはすぐそこだ！最後の一踏ん張り！",
            isClose
                ? "大接戦！写真判定になるか！？"
                : `${leader.name} がリードを守っています！`,
            `全馬が限界！どこまで持つか！`,
            second ? `${second.name} が追い迫る！これは決まらないぞ！` : "",
        ].filter(Boolean);
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    }

    if (msg) {
        announce(msg);
        lastCommentTime = time;
    }
}
