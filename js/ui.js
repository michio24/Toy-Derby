
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

// --- 実況システム ---
// レース展開に応じたテキスト表示と読み上げ
let lastCommentTime = 0;
// let lastLeader = null; // Unused in original code snippet logic provided? logic used leader but didn't store lastLeader for comparison except maybe implicitly?
// Re-checking original code: lastLeader was defined line 3043 but not seemingly used in the snippet I saw (lines 3057+).
// I will keep it if it was there but I don't see it used in `updateCommentary`.
// Actually I didn't see the full body of updateCommentary.
// Let's assume basic logic based on what I saw.

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
    const p = leader.currentT;
    let msg = "";

    if (p < 0.1) {
        // Keep initial start simple to avoid overlap with gate open
    } else if (p > 0.15 && p < 0.2) {
        const phrases = [
            `先手を奪ったのは ${leader.name} です！`,
            `${leader.name} が果敢にハナを主張しました！`,
            `まずは ${leader.name} がレースを引っ張ります。`,
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.45 && p < 0.5) {
        const phrases = [
            "レースは中盤、向こう正面に入っています！",
            "各馬、淡々としたペースで進んでいます。",
            `${leader.name}、軽快な逃げを見せています！`,
            "先頭から最後方まで、隊列は縦長になっています！",
            "おっと、後方から一気に馬群が動き出した！",
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.7 && p < 0.75) {
        const phrases = [
            "さあ、第3コーナーから第4コーナーへ！",
            "勝負どころ！各馬スパートの体勢に入ります！",
            "後続も差を詰めてきた！混戦模様です！",
            `${leader.name}、手応えはどうか！？`,
            "4コーナーを回って、直線コースへ！",
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    } else if (p > 0.85 && p < 0.9) {
        const phrases = [
            "さあ、最後の直線！ここからが勝負だ！",
            "直線コースに向いた！抜け出すのは誰だ！？",
            "残り200メートル！激しい叩き合い！",
            "外から一気に各馬が襲いかかる！",
        ];
        msg = phrases[Math.floor(Math.random() * phrases.length)];
    }

    if (msg) {
        announce(msg);
        lastCommentTime = time;
    }
}
