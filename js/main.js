
import { CONFIG, HORSE_DATA, WEATHER_TYPES, RELICS } from './data/constants.js';
import { STATE, GP_STATE } from './state.js';
import { SoundManager } from './utils/SoundManager.js';
import { showCutIn, announce, updateCommentary, toggleMute } from './ui.js';
import { Horse } from './classes/Horse.js';
import { Gate } from './classes/Gate.js';
import { ParticleManager, ParticleType } from './classes/ParticleManager.js';
import { ConfettiManager } from './classes/ConfettiManager.js';
import { COURSES, buildTrack, spectatorManager } from './core/track.js';

// --- Three.js 初期化 ---
// シーン、カメラ、レンダラー、ライトのセットアップ
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 350);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.5,
    1000,
);
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const hemiLight = new THREE.HemisphereLight(
    0xffffff,
    0xffffff,
    0.6,
);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 200, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
const d = 250;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// --- Managers ---
const particleManager = new ParticleManager(scene);
const confettiManager = new ConfettiManager(scene);

// --- Weather Functions ---
function createRainParticles() {
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 2000;
    const positions = [];

    for (let i = 0; i < rainCount; i++) {
        positions.push(
            (Math.random() - 0.5) * 400,
            Math.random() * 200,
            (Math.random() - 0.5) * 400,
        );
    }

    rainGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
    );
    const rainMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.5,
        transparent: true,
        opacity: 0.6,
    });

    return new THREE.Points(rainGeo, rainMaterial);
}

function applyWeather(weather) {
    // Set sky and fog
    scene.background.setHex(weather.skyColor);
    scene.fog.color.setHex(weather.fogColor);

    // Update lighting
    hemiLight.intensity = weather.ambientIntensity;
    dirLight.intensity = weather.directionalIntensity;
    dirLight.color.setHex(weather.directionalColor);

    // Remove existing rain if any
    if (STATE.rainParticles) {
        scene.remove(STATE.rainParticles);
        STATE.rainParticles = null;
    }

    // Add rain particles if rainy weather
    if (weather.rain) {
        STATE.rainParticles = createRainParticles();
        scene.add(STATE.rainParticles);
    }

    STATE.weather = weather;
    STATE.trackCondition = weather.trackCondition;
}

// --- Helper Functions ---
function selectRandomCourse() {
    const courseIdx = Math.floor(Math.random() * COURSES.length);
    STATE.currentCourse = COURSES[courseIdx];
    console.log("Selected Course: ", STATE.currentCourse.name);

    const el = document.getElementById("course-name-display");
    if (el) el.innerText = STATE.currentCourse.name;

    const pb = document.getElementById("progress-bar");
    if (pb) pb.style.width = "70%"; // Update loading visual

    buildTrack(STATE.currentCourse, scene);
}

// --- UI / Game Logic ---

function selectHorse(index, el) {
    SoundManager.init(); // Initialize audio context on first click
    SoundManager.playClick();
    if (STATE.isRacing) return;
    STATE.selectedHorse = index;
    document
        .querySelectorAll(".horse-card")
        .forEach((c) => c.classList.remove("selected"));
    el.classList.add("selected");
    const btn = document.getElementById("start-btn");
    btn.disabled = false;
    // Remove disabled styling
    btn.classList.remove("cursor-not-allowed", "opacity-50");
    btn.classList.add("cursor-pointer", "opacity-100");

    const txt = document.getElementById("start-btn-text");
    if (GP_STATE.active) {
        txt.innerHTML = GP_STATE.round === 1 ? "START GP!" : "NEXT ROUND";
    } else {
        txt.innerHTML = "START RACE!";
    }
}

function updateCamera(time) {
    let leader = STATE.horses[0];
    if (STATE.horses.length > 0) {
        STATE.horses.forEach((h) => {
            if (h.currentT > leader.currentT) leader = h;
        });
    }
    const leadPos = leader.mesh.position.clone();

    if (STATE.isWinningRun && STATE.winner) {
        // Winning Run Camera - dynamic orbit around winner
        const winner = STATE.winner;
        const winPos = winner.mesh.position.clone();
        const t = Date.now() * 0.0005;
        const orbitRadius = 15;
        const camX = winPos.x + Math.cos(t) * orbitRadius;
        const camZ = winPos.z + Math.sin(t) * orbitRadius;

        camera.position.lerp(
            new THREE.Vector3(camX, winPos.y + 5, camZ),
            0.05,
        );
        camera.lookAt(
            winPos.clone().add(new THREE.Vector3(0, 2, 0)),
        );
    } else if (!STATE.isRacing) {
        // Animated camera tour around the track during horse selection
        if (STATE.trackCurve) {
            const t = (Date.now() * 0.00008) % 1.0; // Very slow rotation for elegant presentation
            const tourPoint = STATE.trackCurve.getPointAt(t);
            const tangent = STATE.trackCurve
                .getTangentAt(t)
                .normalize();
            const normal = new THREE.Vector3(
                -tangent.z,
                0,
                tangent.x,
            ).normalize();

            // Position camera outside the track, looking inward
            const camPos = tourPoint
                .clone()
                .add(normal.multiplyScalar(-80)) // Outside the track
                .add(new THREE.Vector3(0, 60, 0)); // Elevated view

            const lookAt = tourPoint
                .clone()
                .add(new THREE.Vector3(0, 5, 0));
            camera.position.copy(camPos);
            camera.lookAt(lookAt);
        }
    } else {
        // Race Camera Modes
        const t = leader.currentT % 1.0;
        const tan = STATE.trackCurve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3(
            -tan.z,
            0,
            tan.x,
        ).normalize();

        if (STATE.cameraMode === 3) {
            // --- TV中継風 オートカメラロジック ---
            const p = leader.currentT;

            // Auto Switching Logic
            if (time - STATE.lastAutoSwitch > 2.5) {
                let nextType;
                do {
                    nextType = Math.floor(Math.random() * 4);
                } while (nextType === STATE.autoShotType);
                STATE.autoShotType = nextType;
                STATE.lastAutoSwitch = time;
            }

            let targetPos, targetLook;
            const lerpFactor = 0.05;

            if (p < 0.1) {
                // Start: High Rear Wide Shot
                targetPos = leadPos
                    .clone()
                    .sub(tan.multiplyScalar(25))
                    .add(new THREE.Vector3(0, 15, 0));
                targetLook = leadPos
                    .clone()
                    .add(tan.multiplyScalar(20));
            } else if (p > 0.85) {
                // Final Stretch: Dynamic Front Zoom
                targetPos = leadPos
                    .clone()
                    .add(tan.multiplyScalar(20))
                    .sub(normal.multiplyScalar(5))
                    .add(new THREE.Vector3(0, 4, 0));
                targetLook = leadPos
                    .clone()
                    .sub(new THREE.Vector3(0, 1, 0));
            } else {
                // Mid Race Switching
                switch (STATE.autoShotType) {
                    case 0: // Dynamic Side-Front
                        targetPos = leadPos
                            .clone()
                            .add(normal.multiplyScalar(12))
                            .add(tan.multiplyScalar(8))
                            .add(new THREE.Vector3(0, 6, 0));
                        targetLook = leadPos.clone();
                        break;
                    case 1: // Low Rear Tracking
                        targetPos = leadPos
                            .clone()
                            .sub(tan.multiplyScalar(10))
                            .add(new THREE.Vector3(0, 2, 0));
                        targetLook = leadPos
                            .clone()
                            .add(new THREE.Vector3(0, 1, 0));
                        break;
                    case 2: // High Bird's Eye
                        targetPos = leadPos
                            .clone()
                            .sub(tan.multiplyScalar(5))
                            .add(new THREE.Vector3(0, 50, 0));
                        targetLook = leadPos.clone();
                        break;
                    case 3: // Side Profile Long
                        const sideDist = 25;
                        targetPos = leadPos
                            .clone()
                            .add(normal.multiplyScalar(sideDist))
                            .add(new THREE.Vector3(0, 10, 0));
                        targetLook = leadPos.clone();
                        break;
                }
            }
            camera.position.lerp(targetPos, lerpFactor);
            camera.lookAt(targetLook);

            // --- CAMERA SHAKE ---
            if (STATE.cameraShake > 0) {
                const shakeAmount = STATE.cameraShake;
                camera.position.x +=
                    (Math.random() - 0.5) * shakeAmount;
                camera.position.y +=
                    (Math.random() - 0.5) * shakeAmount;
                camera.position.z +=
                    (Math.random() - 0.5) * shakeAmount;
                STATE.cameraShake *= 0.9; // Decay
                if (STATE.cameraShake < 0.01) STATE.cameraShake = 0;
            }
        } else if (STATE.cameraMode === 0) {
            // Follow camera
            const camPos = leadPos
                .clone()
                .sub(tan.multiplyScalar(40))
                .add(new THREE.Vector3(0, 25, 0));
            camera.position.lerp(camPos, 0.1);
            camera.lookAt(
                leadPos.clone().add(tan.multiplyScalar(20)),
            );
        } else if (STATE.cameraMode === 1) {
            // Top camera
            camera.position.lerp(
                new THREE.Vector3(0, 120, 120),
                0.05,
            );
            camera.lookAt(leadPos);
        } else {
            // Side camera
            const side = new THREE.Vector3(-tan.z, 0, tan.x)
                .normalize()
                .multiplyScalar(10);
            camera.position.copy(
                leadPos
                    .clone()
                    .add(side)
                    .add(new THREE.Vector3(0, 5, 0)),
            );
            camera.lookAt(leadPos);
        }
    }
}

function updateRankingUI() {
    if (!STATE.horses.length) return;
    const sorted = [...STATE.horses].sort((a, b) => {
        if (a.finished && b.finished)
            return a.finishRank - b.finishRank;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.currentT - a.currentT;
    });
    const list = document.getElementById("rank-list");
    if (!list) return;
    list.innerHTML = "";
    sorted.forEach((h, i) => {
        const li = document.createElement("li");
        li.className =
            "flex items-center justify-between p-1 rounded bg-white/10";
        const isPlayer = h.id === STATE.selectedHorse;
        if (isPlayer)
            li.classList.add("border", "border-yellow-500/50");
        const rankDisplay = h.finished ? h.finishRank : i + 1;
        const rankClass = h.finished
            ? "text-green-400"
            : i === 0
                ? "text-yellow-400"
                : "text-gray-400";
        li.innerHTML = `<div class="flex items-center gap-2"><span class="w-4 text-center font-bold ${rankClass}">${rankDisplay}</span><div class="w-4 h-4 rounded-full flex items-center justify-center text-[8px]" style="background:#${h.mat.color.getHexString()}">${h.icon}</div><span class="text-xs truncate w-24 ${isPlayer ? "text-yellow-200" : "text-gray-300"}">${h.name}</span></div>${h.finished ? '<span class="text-[10px] text-green-400">✓</span>' : ""}`;
        list.appendChild(li);
    });
}

function toggleCamera() {
    STATE.cameraMode = (STATE.cameraMode + 1) % 4;
    const btn = document.getElementById("camera-btn");
    const icons = ["📷", "🚁", "↔", "📺"];
    if (btn) btn.innerText = icons[STATE.cameraMode];
}

// --- GP & Game Functions ---

function toggleGPMode() {
    if (STATE.isRacing) return;
    GP_STATE.active = !GP_STATE.active;
    const btn = document.getElementById('gp-toggle-btn');
    if (GP_STATE.active) {
        btn.innerHTML = '<span class="text-gold-400 font-bold glow">🏆 GP MODE: ON</span>';
        btn.classList.add('border-gold-500');
        GP_STATE.round = 1;
        GP_STATE.relics = [];
        GP_STATE.totalScore = 0;
    } else {
        btn.innerHTML = '<span class="opacity-50">🏆 GP MODE: OFF</span>';
        btn.classList.remove('border-gold-500');
    }
}

function prepareNextRaceConditions() {
    // Random Course & Weather for NEXT race
    const cIdx = Math.floor(Math.random() * COURSES.length);
    GP_STATE.nextCourse = COURSES[cIdx];
    const wIdx = Math.floor(Math.random() * WEATHER_TYPES.length);
    GP_STATE.nextWeather = WEATHER_TYPES[wIdx];
}

function updateGPUI() {
    const overlay = document.getElementById('gp-info-overlay');
    if (GP_STATE.active) {
        overlay.classList.remove('hidden');
        document.getElementById('gp-round-display').innerText = GP_STATE.round;
        const list = document.getElementById('gp-relics-list');
        list.innerHTML = GP_STATE.relics.map(r => `<span title="${r.name}: ${r.desc}">${r.icon}</span>`).join('');
    } else {
        overlay.classList.add('hidden');
    }
}

function startGrandPrix() {
    GP_STATE.relics = [];
    GP_STATE.round = 1;
    updateGPUI();
    prepareNextRaceConditions();
    startRace();
}

function handleStartButton() {
    if (GP_STATE.active && GP_STATE.round === 1) {
        startGrandPrix();
    } else {
        startRace();
    }
}

function announceWinner(winner) {
    const winPhrases = [
        `１着、${winner.name}！ 見事な勝利です！`,
        `勝ったのは ${winner.name}！ 圧倒的な強さを見せつけました！`,
        `${winner.name}、ゴールイン！ 素晴らしい走りでした！`,
        `大歓声の中、${winner.name} が先頭でゴールを駆け抜けました！`,
    ];
    const msg =
        winPhrases[Math.floor(Math.random() * winPhrases.length)];
    announce(msg);
    STATE.winnerAnnounced = true;
}

function startRace() {
    if (STATE.wallet < STATE.betAmount) {
        alert("No money!");
        return;
    }
    STATE.wallet -= STATE.betAmount;
    const walletDisp = document.getElementById("wallet-display");
    if (walletDisp) walletDisp.innerText = STATE.wallet;

    STATE.isRacing = true;
    STATE.raceStarted = false;

    // Set weather
    let raceWeather;
    if (GP_STATE.active && GP_STATE.nextWeather) {
        raceWeather = GP_STATE.nextWeather;
    } else {
        raceWeather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
    }
    applyWeather(raceWeather);

    const bettingPanel = document.getElementById("betting-panel");
    bettingPanel.classList.add("opacity-0", "pointer-events-none");
    bettingPanel.querySelector(".glass-panel").classList.add("scale-95");

    document.getElementById("camera-btn").classList.remove("hidden");
    document.getElementById("rank-panel").classList.remove("hidden");

    STATE.horses.forEach((h) => {
        h.reset();
        h.speed = 0;
    });
    STATE.gates.forEach((g) => g.reset());
    STATE.winnerAnnounced = false; // Reset winner announcement flag
    STATE.cameraMode = 3;
    updateCamera(0); // Auto Camera Start

    SoundManager.playFanfare();
    announce(
        `${raceWeather.icon} ${raceWeather.name}、馬場状態: ${raceWeather.trackCondition}`,
    );

    const cdOverlay = document.getElementById("countdown-overlay");
    const cdText = document.getElementById("countdown-text");
    cdOverlay.classList.remove("hidden");
    cdText.style.opacity = "1";
    let count = 3;

    // Wait for Fanfare (roughly 3s) then start countdown
    setTimeout(() => {
        cdText.innerText = count;
        cdText.className =
            "text-9xl font-black text-white drop-shadow-lg scale-in";
        SoundManager.playCountdown(3);

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                cdText.innerText = count;
                cdText.classList.remove("scale-in");
                void cdText.offsetWidth;
                cdText.classList.add("scale-in");
                SoundManager.playCountdown(count);
            } else if (count === 0) {
                cdText.innerText = "GO!";
                cdText.classList.remove("text-white");
                cdText.classList.add("text-yellow-400", "scale-in");
                SoundManager.playCountdown(0); // GO sound
                SoundManager.playGate();
                SoundManager.playAtmosphere(true); // Start crowd/run noise

                STATE.gates.forEach((g) => g.open());
                announce("ゲートが開いた！");
                setTimeout(() => {
                    STATE.raceStarted = true;
                    STATE.horses.forEach((h) => {
                        h.speed = h.baseSpeed * 0.3;
                    });
                }, 200);
            } else {
                clearInterval(interval);
                cdText.style.opacity = "0";
                setTimeout(() => {
                    cdOverlay.classList.add("hidden");
                    cdText.innerText = "";
                    cdText.style.opacity = "1";
                }, 500);
            }
        }, 1000);
    }, 2500);
}

function selectRelic(relic) {
    GP_STATE.relics.push(relic);
    GP_STATE.round++;

    // Hide upgrade panel
    document.getElementById('upgrade-panel').classList.add('hidden');

    // Reset for next race
    resetGame(true); // pass true to indicate continuation
}

function showUpgradeScreen() {
    const panel = document.getElementById('upgrade-panel');
    panel.classList.remove('hidden');

    const cardContainer = document.getElementById('upgrade-cards');
    cardContainer.innerHTML = '';

    // Pick 3 random relics
    const options = [];
    for (let i = 0; i < 3; i++) {
        const r = RELICS[Math.floor(Math.random() * RELICS.length)];
        options.push(r);
    }

    options.forEach((relic, idx) => {
        const el = document.createElement('div');
        el.className = 'relic-card';
        el.onclick = () => selectRelic(relic);
        el.innerHTML = `
            <div class="icon">${relic.icon}</div>
            <h4>${relic.name}</h4>
            <p>${relic.desc}</p>
        `;
        cardContainer.appendChild(el);
    });

    // Show Forecast
    const nextInfo = document.getElementById('next-race-info');
    nextInfo.innerText = `${GP_STATE.nextWeather.icon} ${GP_STATE.nextWeather.name} / 🚦 ${GP_STATE.nextCourse.name}`;
}

function finishRace(winner) {
    STATE.isRacing = false;
    STATE.raceStarted = false;
    STATE.isWinningRun = true;
    const win = winner.id === STATE.selectedHorse;
    document.getElementById("rank-panel").classList.add("hidden");

    // Winning Run Setup
    confettiManager.start(winner.mesh.position);
    updateCamera(0); // Trigger camera update to switch to winning mode immediately

    if (win) SoundManager.playWin();

    setTimeout(() => {
        const modal = document.getElementById("result-modal");
        modal.classList.remove("hidden", "scale-95", "opacity-0");
        const msg = document.getElementById("result-message");
        const pay = document.getElementById("payout-display");
        const btn = document.querySelector('#result-modal button');

        if (win) {
            const cards = document.querySelectorAll(".horse-card");
            const odds = parseFloat(
                cards[STATE.selectedHorse].dataset.odds,
            );
            const prize = Math.floor(STATE.betAmount * odds);
            STATE.wallet += prize;
            msg.innerHTML = `<span class="text-green-600 font-bold">${winner.name}</span> WON!`;
            pay.innerText = `+${prize} G`;
            document.getElementById("wallet-display").innerText =
                STATE.wallet;
        } else {
            msg.innerHTML = `Winner: <span class="text-gray-800 font-bold">${winner.name}</span>`;
            pay.innerText = "0 G";
        }

        // --- GP MODE HANDLING ---
        if (GP_STATE.active) {
            const playerRank = STATE.horses[STATE.selectedHorse].finishRank;
            if (playerRank <= 3) {
                // Success
                if (GP_STATE.round >= GP_STATE.maxRounds) {
                    // VICTORY
                    msg.innerHTML += "<br><span class='text-gold-500 text-2xl'>🏆 GRAND PRIX CHAMPION! 🏆</span>";
                    btn.innerText = "RETURN TO LOBBY";
                    btn.onclick = () => { toggleGPMode(); resetGame(); };
                } else {
                    // Prepare Upgrade Screen call
                    btn.innerText = "GET REWARDS";
                    btn.onclick = () => {
                        // Logic to show upgrade
                        document.getElementById("result-modal").classList.add("hidden");
                        prepareNextRaceConditions();
                        showUpgradeScreen();
                    };
                }
            } else {
                // Game Over
                msg.innerHTML += "<br><span class='text-red-500 font-bold'>GP ELIMINATED...</span>";
                btn.innerText = "TRY AGAIN";
                btn.onclick = () => { toggleGPMode(); resetGame(); };
            }
        } else {
            // Normal Mode
            btn.innerText = "NEXT RACE";
            btn.onclick = () => resetGame();
        }
    }, 3000);
}

function resetGame(continueGP = false) {
    STATE.isWinningRun = false;
    STATE.winner = null;
    confettiManager.stop();

    document.getElementById("result-modal").classList.add("hidden", "scale-95", "opacity-0");

    const bettingPanel = document.getElementById("betting-panel");

    if (GP_STATE.active) {
        if (continueGP) {
            bettingPanel.classList.remove("opacity-0", "pointer-events-none");
            bettingPanel.querySelector(".glass-panel").classList.remove("scale-95");

            // Apply pre-selected course/weather
            STATE.currentCourse = GP_STATE.nextCourse;
            buildTrack(STATE.currentCourse, scene);
            // Weather applied in startRace, preview shown in UI
            updateGPUI();
        } else {
            bettingPanel.classList.remove("opacity-0", "pointer-events-none");
            bettingPanel.querySelector(".glass-panel").classList.remove("scale-95");
            selectRandomCourse();
            updateGPUI(); // likely cleared by toggleGPMode logic if quitting
        }
    } else {
        // Normal Mode Reset
        bettingPanel.classList.remove("opacity-0", "pointer-events-none");
        bettingPanel.querySelector(".glass-panel").classList.remove("scale-95");
        selectRandomCourse();
    }

    document.getElementById("camera-btn").classList.add("hidden");

    STATE.horses.forEach((h) => h.reset());
    updateCamera(0);
    document.getElementById("commentary-box").classList.remove("active");
    SoundManager.playAtmosphere(false);
}

function initGame() {
    const pb = document.getElementById("progress-bar");
    if (pb) pb.style.width = "80%";

    // 1. Build Track first (Needed for Horse positioning logic)
    selectRandomCourse();

    // 2. Create Horses
    HORSE_DATA.forEach((data, index) => {
        const h = new Horse(index, data, scene, particleManager);
        STATE.horses.push(h);
        // 3. Create Gates (since buildTrack skipped them as horses array was empty)
        const gate = new Gate((index - 2) * CONFIG.laneWidth, scene);
        STATE.gates.push(gate);
    });

    const selector = document.getElementById("horse-selector");
    if (selector) {
        HORSE_DATA.forEach((data, index) => {
            const el = document.createElement("div");
            el.className =
                "horse-card p-2 pb-8 cursor-pointer flex flex-col items-center relative overflow-hidden";
            el.innerHTML = `<div class="horse-badge">x${(Math.random() * 2 + 1.5).toFixed(1)}</div><div class="w-10 h-10 rounded-full mb-1 border-2 border-white/20 text-xl flex items-center justify-center shadow-inner" style="background:#${data.color.toString(16)}">${data.icon}</div><div class="text-xs font-bold text-gray-200 leading-tight text-center font-tech tracking-wide mb-1">${data.name}</div><div class="skill-badge w-full">${data.skill}</div>`;
            el.dataset.odds = el
                .querySelector(".horse-badge")
                .innerText.replace("x", "");
            el.onclick = () => selectHorse(index, el);
            selector.appendChild(el);
        });
    }

    setTimeout(() => {
        const l = document.getElementById("loader");
        if (l) {
            l.style.opacity = 0;
            setTimeout(() => l.remove(), 500);
        }
    }, 1000);
    updateCamera(0);
}

// --- Main Loop ---
const clock = new THREE.Clock();
let lastRankUpdate = 0;

function animate() {
    requestAnimationFrame(animate);
    const deltaRaw = clock.getDelta();
    const now = clock.getElapsedTime();

    // --- Time Scale Logic (Photo Finish) ---
    let targetTimeScale = 1.0;
    const leader =
        STATE.horses.length > 0
            ? STATE.horses.reduce((prev, current) =>
                prev.currentT > current.currentT ? prev : current,
            )
            : null;

    if (STATE.isRacing && !STATE.winner && leader) {
        if (leader.currentT > 0.96 && leader.currentT < 1.0) {
            targetTimeScale = 0.2; // Slow Motion!
        }
    } else if (STATE.winner) {
        targetTimeScale = 1.0;
    }

    STATE.timeScale += (targetTimeScale - STATE.timeScale) * 0.1;
    const delta = Math.min(deltaRaw, 0.1) * STATE.timeScale;

    STATE.gates.forEach((g) => g.update(delta));

    if (spectatorManager) {
        const leaderP = leader ? leader.currentT : 0;
        spectatorManager.update(now, leaderP);
    }

    if (STATE.isWinningRun && STATE.winner) {
        const winner = STATE.winner;
        winner.speed = 0.01;
        winner.update(delta);

        STATE.horses.forEach((h) => {
            if (h !== winner) {
                h.body.position.y =
                    2 + Math.sin(Date.now() * 0.003 + h.id) * 0.05;
                h.legs.forEach((l) => (l.rotation.x = 0));
            }
        });

        confettiManager.update(delta);
        particleManager.update(delta);
        updateCamera(now);
        renderer.render(scene, camera);
        return;
    }

    if (STATE.isRacing) {
        particleManager.update(delta);
        if (STATE.raceStarted) {
            let finishedCount = 0;
            STATE.horses.forEach((h) => {
                if (!h.finished) {
                    h.update(delta);
                    if (h.finished) {
                        const finishedHorses = STATE.horses.filter(
                            (horse) => horse.finished,
                        );
                        h.finishRank = finishedHorses.length;
                        if (!STATE.winner) {
                            STATE.winner = h;
                            if (!STATE.winnerAnnounced)
                                announceWinner(h);
                        }
                    }
                } else {
                    finishedCount++;
                }
            });
            if (!STATE.winner) updateCommentary(now);
            if (now - lastRankUpdate > 0.5) {
                updateRankingUI();
                lastRankUpdate = now;
            }
            if (
                STATE.winner &&
                STATE.isRacing &&
                finishedCount === STATE.horses.length
            ) {
                finishRace(STATE.winner);
            }
        } else {
            STATE.horses.forEach((h) => {
                h.body.position.y =
                    2 + Math.sin(Date.now() * 0.005 + h.id) * 0.02;
            });
        }
    } else {
        STATE.horses.forEach((h) => {
            h.body.position.y =
                2 + Math.sin(Date.now() * 0.003 + h.id) * 0.05;
        });
    }

    if (STATE.rainParticles) {
        const positions =
            STATE.rainParticles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= 2 * STATE.timeScale;
            if (positions[i + 1] < 0) {
                positions[i + 1] = 200;
            }
        }
        STATE.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    updateCamera(now);
    renderer.render(scene, camera);
}

// --- Attach to Window for UI ---
window.toggleMute = toggleMute;
window.toggleCamera = toggleCamera;
window.toggleGPMode = toggleGPMode;
window.handleStartButton = handleStartButton;
window.resetGame = resetGame;
// selectHorse needs to be global because generated HTML calls it.
// No, I can't easily export generated HTML click handler to module.
// BUT, I can attach selectHorse to window.
window.selectHorse = selectHorse;

// Initial Start
initGame();
animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
