
import { CONFIG } from '../data/constants.js';
import { STATE, GP_STATE } from '../state.js';
import { SoundManager } from '../utils/SoundManager.js';
import { showCutIn } from '../ui.js';
import { ParticleType } from './ParticleManager.js';

// --- 馬クラス ---
// 馬の3Dモデル、移動ロジック、アニメーション、スキル発動を管理
export class Horse {
    constructor(id, data, scene, particleManager) {
        this.id = id;
        this.name = data.name;
        this.skillName = data.skill;
        this.skillDesc = data.skillDesc;
        this.icon = data.icon;
        this.checkSkill = data.check;
        this.applySkill = data.activate; // Store logic
        this.scene = scene;
        this.particleManager = particleManager;

        this.mesh = new THREE.Group();
        this.currentT = 0;
        this.speed = 0;
        this.baseSpeed =
            (0.045 + Math.random() * 0.01) * CONFIG.raceSpeedMult;
        this.maxSpeed = this.baseSpeed * 1.5;
        this.stamina = 1.0;
        this.finished = false;
        this.finishRank = null;
        this.skillTriggered = false;
        this.skillActive = false;
        this.skillTimer = 0;
        this.laneOffset = (id - 2) * CONFIG.laneWidth;
        this.createModel(data.color);
        this.scene.add(this.mesh);
        this.reset();
    }

    createAuraTexture() {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");

        const gradient = ctx.createLinearGradient(0, 0, 0, 128);
        gradient.addColorStop(0, "rgba(255, 255, 200, 0)");
        gradient.addColorStop(0.2, "rgba(255, 220, 100, 0.5)");
        gradient.addColorStop(0.5, "rgba(255, 200, 0, 0.8)");
        gradient.addColorStop(0.8, "rgba(255, 150, 0, 0.5)");
        gradient.addColorStop(1, "rgba(255, 100, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 128);

        // Add vertical energy streaks
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * 64;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 128);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    createModel(colorHex) {
        this.mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.4,
            metalness: 0.1,
        });
        const maneColor = new THREE.Color(colorHex).multiplyScalar(
            0.7,
        );
        const maneMat = new THREE.MeshStandardMaterial({
            color: maneColor,
            roughness: 0.9,
        });
        const noseMat = new THREE.MeshStandardMaterial({
            color: 0xffaaaa,
            roughness: 0.5,
        });
        const eyeMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
        });
        const hoofMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.9,
        });

        // --- Common Body Structure ---
        const bodyGeo = new THREE.SphereGeometry(0.7, 16, 16);
        bodyGeo.scale(1, 1, 1.5);
        const body = new THREE.Mesh(bodyGeo, this.mat);
        body.position.y = 1.8;
        body.castShadow = true;
        this.body = body;

        // --- Unique Features: Body ---
        if (this.name === "ホワイトウィンド") {
            // Wings (Angel/Pegasus style)
            const wingGeo = new THREE.BoxGeometry(0.05, 0.8, 1.2);
            const wingMat = new THREE.MeshStandardMaterial({
                color: 0xeeffff,
                transparent: true,
                opacity: 0.9,
                roughness: 0.2,
            });

            const wLeft = new THREE.Mesh(wingGeo, wingMat);
            wLeft.position.set(0.65, 0.4, 0);
            wLeft.rotation.set(0.5, 0, -0.4);
            wLeft.castShadow = true;
            body.add(wLeft);

            const wRight = new THREE.Mesh(wingGeo, wingMat);
            wRight.position.set(-0.65, 0.4, 0);
            wRight.rotation.set(0.5, 0, 0.4);
            wRight.castShadow = true;
            body.add(wRight);
        } else if (this.name === "チョコチップ") {
            // Chocolate Chips
            const chipGeo = new THREE.SphereGeometry(0.12, 6, 6);
            const chipMat = new THREE.MeshStandardMaterial({
                color: 0x3e2723,
                roughness: 0.8,
            });
            for (let i = 0; i < 12; i++) {
                const chip = new THREE.Mesh(chipGeo, chipMat);
                // Random distribution on upper part
                const u = Math.random();
                const v = Math.random();
                const phi = 2 * Math.PI * u;
                const theta = Math.acos(2 * v - 1);
                const r = 0.68; // Slightly embedded

                const x = r * Math.sin(theta) * Math.cos(phi);
                const y = r * Math.sin(theta) * Math.sin(phi);
                const z = r * Math.cos(theta); // On sphere checks

                // We scaled body by (1, 1, 1.5) so distinct scaling needed if strictly adhering,
                // but adding to local space of scaled mesh works fine if we just want surface noise.
                // Bias towards top (y > 0)
                if (y > -0.2) {
                    chip.position.set(x, y, z * 1.5); // Crude adjust for body scale
                    body.add(chip);
                }
            }
        } else if (this.name === "シルバーブレット") {
            // Rocket Boosters
            const boosterGeo = new THREE.CylinderGeometry(
                0.15,
                0.12,
                0.8,
                16,
            );
            const boosterMat = new THREE.MeshStandardMaterial({
                color: 0x888888,
                metalness: 0.8,
                roughness: 0.3,
            });

            const b1 = new THREE.Mesh(boosterGeo, boosterMat);
            b1.rotation.x = Math.PI / 2;
            b1.position.set(0.45, 0.2, -0.6);
            body.add(b1);

            const b2 = b1.clone();
            b2.position.set(-0.45, 0.2, -0.6);
            body.add(b2);

            // Flame Effect (small static cones for now, could be particles)
            const flameGeo = new THREE.ConeGeometry(0.08, 0.4, 8);
            const flameMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
            }); // Blue flame
            const f1 = new THREE.Mesh(flameGeo, flameMat);
            f1.rotation.x = Math.PI; // Point back
            f1.position.set(0, -0.6, 0); // Relative to cylinder (rotated cylinder y is local z)
            b1.add(f1);
            const f2 = f1.clone();
            b2.add(f2);
        }

        // --- Neck ---
        const neckGeo = new THREE.CylinderGeometry(
            0.45,
            0.6,
            0.8,
            16,
        );
        const neck = new THREE.Mesh(neckGeo, this.mat);
        neck.position.set(0, 2.4, 0.8);
        neck.rotation.x = -0.5;
        neck.castShadow = true;

        // --- Head Group ---
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 3.0, 1.2);

        const headGeo = new THREE.SphereGeometry(0.65, 16, 16);
        const headMesh = new THREE.Mesh(headGeo, this.mat);
        headMesh.castShadow = true;
        headGroup.add(headMesh);

        const snoutGeo = new THREE.SphereGeometry(0.35, 16, 16);
        snoutGeo.scale(1, 0.8, 1.2);
        const snout = new THREE.Mesh(snoutGeo, this.mat);
        snout.position.set(0, -0.15, 0.55);
        snout.castShadow = true;
        headGroup.add(snout);

        const earGeo = new THREE.ConeGeometry(0.18, 0.4, 8);
        const earL = new THREE.Mesh(earGeo, this.mat);
        earL.position.set(0.35, 0.55, 0);
        earL.rotation.set(-0.2, 0, -0.3);
        earL.castShadow = true;
        const earR = new THREE.Mesh(earGeo, this.mat);
        earR.position.set(-0.35, 0.55, 0);
        earR.rotation.set(-0.2, 0, 0.3);
        earR.castShadow = true;
        headGroup.add(earL, earR);

        const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(0.28, 0.1, 0.5);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(-0.28, 0.1, 0.5);

        // Black Jack Visor replaces eyes visual or covers them
        if (this.name !== "ブラックジャック") {
            headGroup.add(eyeL, eyeR);
        }

        // Forelock
        const forelockGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const forelock = new THREE.Mesh(forelockGeo, maneMat);
        forelock.position.set(0, 0.55, 0.2);
        headGroup.add(forelock);

        // --- Unique Features: Head ---
        if (this.name === "ブラックジャック") {
            // Cyber Visor / Sunglasses
            const visorGeo = new THREE.BoxGeometry(0.7, 0.2, 0.2);
            const visorMat = new THREE.MeshStandardMaterial({
                color: 0x000000,
                metalness: 0.9,
                roughness: 0.1,
            });
            const visor = new THREE.Mesh(visorGeo, visorMat);
            visor.position.set(0, 0.15, 0.5);
            headGroup.add(visor);

            // Red Sensor Light
            const sensorGeo = new THREE.BoxGeometry(
                0.2,
                0.05,
                0.21,
            );
            const sensorMat = new THREE.MeshBasicMaterial({
                color: 0xff0000,
            });
            const sensor = new THREE.Mesh(sensorGeo, sensorMat);
            sensor.position.set(0, 0, 0);
            visor.add(sensor);
        } else if (this.name === "ゴールデンボーイ") {
            // Crown
            const crownGroup = new THREE.Group();
            crownGroup.position.set(0, 0.7, 0);
            const cGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
            const cMat = new THREE.MeshStandardMaterial({
                color: 0xffd700,
                metalness: 1.0,
                emissive: 0x222200,
            });

            for (let i = 0; i < 5; i++) {
                const p = new THREE.Mesh(cGeo, cMat);
                const a = (i / 5) * Math.PI * 2;
                p.position.set(
                    Math.cos(a) * 0.25,
                    0,
                    Math.sin(a) * 0.25,
                );
                p.rotation.x = -0.2; // Flare out
                p.rotation.y = a;
                crownGroup.add(p);
            }
            headGroup.add(crownGroup);
        }

        // --- Mane ---
        const maneGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const mane1 = new THREE.Mesh(maneGeo, maneMat);
        mane1.position.set(0, 0.35, -0.35);
        neck.add(mane1);
        const mane2 = new THREE.Mesh(maneGeo, maneMat);
        mane2.position.set(0, -0.05, -0.4);
        neck.add(mane2);
        const mane3 = new THREE.Mesh(maneGeo, maneMat);
        mane3.position.set(0, -0.45, -0.4);
        neck.add(mane3);

        // --- Legs ---
        this.legs = [];
        const legGeo = new THREE.CylinderGeometry(
            0.18,
            0.15,
            1.0,
            8,
        );
        const hoofGeo = new THREE.CylinderGeometry(
            0.19,
            0.22,
            0.2,
            8,
        );

        [
            [-0.35, 0.4],
            [0.35, 0.4],
            [-0.35, -0.5],
            [0.35, -0.5],
        ].forEach((p) => {
            const g = new THREE.Group();
            g.position.set(p[0], 1.2, p[1]);
            const l = new THREE.Mesh(legGeo, this.mat);
            l.position.y = -0.5;
            l.castShadow = true;
            g.add(l);
            const h = new THREE.Mesh(hoofGeo, hoofMat);
            h.position.y = -1.1;
            h.castShadow = true;
            g.add(h);
            this.mesh.add(g);
            this.legs.push(g);
        });

        // --- Tail ---
        const tailGeo = new THREE.SphereGeometry(0.35, 8, 8);
        tailGeo.scale(1, 1.5, 1);
        const tail = new THREE.Mesh(tailGeo, maneMat);
        tail.position.set(0, 2.2, -0.9);
        tail.rotation.x = 0.6;
        this.tail = tail;

        this.mesh.add(body, neck, headGroup, tail);

        // --- Luxurious Aura Effect (Common) ---
        this.aura = new THREE.Group();
        this.aura.visible = false;
        this.mesh.add(this.aura);

        const pillarGeo = new THREE.CylinderGeometry(
            1.0,
            1.0,
            7,
            32,
            1,
            true,
        );
        const pillarTex = this.createAuraTexture();
        const pillarMat = new THREE.MeshBasicMaterial({
            map: pillarTex,
            color: 0xffdd44,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.auraPillar = new THREE.Mesh(pillarGeo, pillarMat);
        this.auraPillar.position.y = 2.5;
        this.aura.add(this.auraPillar);

        const ringGeo = new THREE.TorusGeometry(1.5, 0.05, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
        });

        this.auraRing1 = new THREE.Mesh(ringGeo, ringMat);
        this.auraRing1.rotation.x = Math.PI / 2;
        this.auraRing1.position.y = 0.5;
        this.aura.add(this.auraRing1);

        this.auraRing2 = new THREE.Mesh(ringGeo, ringMat);
        this.auraRing2.rotation.x = Math.PI / 2.2;
        this.auraRing2.rotation.y = 0.2;
        this.auraRing2.position.y = 4.0;
        this.auraRing2.scale.setScalar(1.3);
        this.aura.add(this.auraRing2);

        const coreGeo = new THREE.SphereGeometry(0.8, 16, 16);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffee,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
        });
        this.auraCore = new THREE.Mesh(coreGeo, coreMat);
        this.auraCore.position.y = 2.0;
        this.aura.add(this.auraCore);
    }

    reset() {
        this.currentT = CONFIG.startLineT;
        this.finished = false;
        this.finishRank = null;
        this.speed = 0;

        // --- Calculate Stats based on GP/Relics ---
        const isPlayer = GP_STATE.active && this.id === STATE.selectedHorse;

        let speedMult = 1.0;
        let skillChanceBox = 0.012; // Base randomness

        // Weather Effect
        let weatherMult = STATE.weather ? STATE.weather.speedMultiplier : 1.0;

        // Apply Relics (Passive Check)
        if (isPlayer) {
            const hasGoggles = GP_STATE.relics.find(r => r.id === 'goggles');
            if (hasGoggles && STATE.weather && STATE.weather.rain) {
                weatherMult = 1.0; // Ignore rain penalty
            }

            const hasCarrot = GP_STATE.relics.find(r => r.id === 'carrot');
            if (hasCarrot) speedMult *= hasCarrot.value;

            const hasSaddle = GP_STATE.relics.find(r => r.id === 'saddle');
            if (hasSaddle) speedMult *= hasSaddle.value; // Simplistic application

            const hasShoe = GP_STATE.relics.find(r => r.id === 'shoe');
            if (hasShoe) skillChanceBox *= hasShoe.value;

            const hasDrink = GP_STATE.relics.find(r => r.id === 'drink');
            if (hasDrink) this.currentT += 0.02; // Start Boost
        }

        this.baseSpeed = (0.045 + Math.random() * skillChanceBox) * CONFIG.raceSpeedMult * weatherMult * speedMult;
        this.maxSpeed = this.baseSpeed * (1.4 + Math.random() * 0.3);

        this.skillTriggered = false;
        this.skillActive = false;
        this.skillTimer = 0;
        this.mat.emissive.setHex(0x000000);
        this.aura.visible = false;

        // Reset Anim
        this.legs.forEach((l) => (l.rotation.x = 0));
        if (this.body) this.body.position.y = 1.8;
        if (this.tail) this.tail.rotation.x = 0.6;
        this.updatePosition();
    }

    activateSkill() {
        if (this.skillTriggered) return;
        if (STATE.winner) return; // No skills after winner decided
        this.skillTriggered = true;
        this.skillActive = true;
        this.skillTimer = 3.0;
        showCutIn(this.name, this.skillName, this.icon);
        SoundManager.playSkill();
        this.mat.emissive.setHex(0xaaaaaa); // Brighter emission

        this.aura.visible = true;
        this.auraRing1.rotation.z = 0;
        this.auraRing2.rotation.z = 0;

        // --- NEW EFFECTS ---
        // 1. Camera Shake
        STATE.cameraShake = 0.5; // Intensity

        // 2. Speed Lines (Only if player horse or close to player)
        // For dramatic effect, show if player horse or if currently viewing this horse
        const isPlayer = this.id === STATE.selectedHorse;
        if (isPlayer) {
            const sl = document.getElementById("speed-lines");
            if (sl) {
                sl.classList.add("active");
                setTimeout(() => sl.classList.remove("active"), 1500);
            }
        }

        // 3. Initial Particle Burst
        if (this.particleManager) {
            for (let i = 0; i < 20; i++) {
                this.particleManager.spawn(
                    this.mesh.position
                        .clone()
                        .add(new THREE.Vector3(0, 2, 0)),
                    ParticleType.SKILL,
                );
            }
        }

        // Execute logical effect from data
        if (this.applySkill) this.applySkill(this);
    }

    updatePosition() {
        const t = this.currentT % 1.0;
        const point = STATE.trackCurve.getPointAt(t);
        const tangent = STATE.trackCurve
            .getTangentAt(t)
            .normalize();
        const normal = new THREE.Vector3(
            -tangent.z,
            0,
            tangent.x,
        ).normalize();
        const pos = point.add(
            normal.multiplyScalar(this.laneOffset),
        );
        const backward = tangent.clone().multiplyScalar(-1.5);
        pos.add(backward);
        this.mesh.position.copy(pos);
        this.mesh.lookAt(pos.clone().add(tangent));
    }

    update(delta) {
        if (this.finished && !STATE.isWinningRun) {
            this.legs.forEach((l) => (l.rotation.x = 0));
            return;
        }

        if (this.speed < this.baseSpeed) this.speed += delta * 0.05;

        const progress = this.currentT;
        if (!this.skillTriggered && this.speed > 0.01) {
            const r = Math.random();
            // Use data-driven check
            if (this.checkSkill && this.checkSkill(progress, r)) {
                this.activateSkill();
            }
        }

        if (this.skillActive) {
            this.skillTimer -= delta;

            const time = Date.now() * 0.005;
            // Rotate Rings
            this.auraRing1.rotation.z += delta * 4;
            this.auraRing1.scale.setScalar(
                1.0 + Math.sin(time * 3) * 0.1,
            );

            this.auraRing2.rotation.z -= delta * 3;
            this.auraRing2.rotation.x =
                Math.PI / 2.2 + Math.sin(time * 2) * 0.1;

            // Animate Pillar
            this.auraPillar.rotation.y -= delta * 2;
            this.auraPillar.scale.set(
                1.0 + Math.sin(time * 8) * 0.1,
                1,
                1.0 + Math.sin(time * 8) * 0.1,
            );

            // Core Pulse
            this.auraCore.scale.setScalar(
                0.9 + Math.sin(time * 10) * 0.2,
            );

            // Float
            this.aura.position.y = Math.sin(time * 3) * 0.2;

            if (this.skillTimer <= 0) {
                this.skillActive = false;
                this.mat.emissive.setHex(0x000000);
                this.aura.visible = false;
            }
        } else {
            // Random speed fluctuations (simulated jockeying)
            if (Math.random() < 0.05)
                this.speed += (Math.random() - 0.5) * 0.001;
        }

        this.currentT += this.speed * delta;
        this.updatePosition();

        if (this.currentT >= 1.0 && !this.finished) {
            this.finished = true;
            // Jump pose at finish
            this.body.position.y = 2.5;
        }

        const runFreq = 20 + this.speed * 200;
        const animT = Date.now() * 0.001;

        // Animate Body (Bounce) - Only if not finished
        if (!this.finished) {
            this.body.position.y =
                1.8 + Math.sin(animT * runFreq) * 0.1;
        }

        this.legs[0].rotation.x = Math.sin(animT * runFreq) * 0.8;
        this.legs[1].rotation.x =
            Math.sin(animT * runFreq + Math.PI) * 0.8;
        this.legs[2].rotation.x =
            Math.sin(animT * runFreq + Math.PI / 2) * 0.8;
        this.legs[3].rotation.x =
            Math.sin(animT * runFreq - Math.PI / 2) * 0.8;

        // Tail Animation
        if (this.tail) {
            this.tail.rotation.x =
                0.6 + Math.sin(animT * runFreq * 0.5) * 0.2;
        }

        // Particle Emission
        if (this.particleManager) {
            if (this.skillActive) {
                if (Math.random() < 0.3) {
                    const emitPos = this.mesh.position.clone();
                    emitPos.y += Math.random() * 3;
                    emitPos.x += (Math.random() - 0.5) * 1.5;
                    emitPos.z += (Math.random() - 0.5) * 1.5;
                    this.particleManager.spawn(emitPos, ParticleType.SKILL);
                }
            }

            if (this.speed > 0.02) {
                const chance = this.speed * 5; // Higher speed = more particles
                if (Math.random() < chance) {
                    const type =
                        STATE.weather && STATE.weather.rain
                            ? ParticleType.SPLASH
                            : ParticleType.DUST;
                    // Emit from base of horse approximate pos
                    const emitPos = this.mesh.position.clone();
                    emitPos.y = 0.5; // Near ground
                    // Add some randomness around the feet area
                    emitPos.x += (Math.random() - 0.5) * 1.0;
                    emitPos.z += (Math.random() - 0.5) * 1.0;
                    this.particleManager.spawn(emitPos, type);
                }
            }
        }
    }
}
