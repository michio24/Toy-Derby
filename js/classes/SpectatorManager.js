
import { CONFIG } from '../data/constants.js';
import { STATE } from '../state.js';

// --- 観客システム ---
// InstancedMeshを使用して大量の観客を効率的に描画
export class SpectatorManager {
    constructor(scene, count = 1500) {
        this.scene = scene;
        this.count = count;
        this.dummy = new THREE.Object3D();

        // Low-poly spectator geometry - INCREASED SIZE for visibility
        const geometry = new THREE.BoxGeometry(1.2, 2.0, 1.2);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.8,
        });

        this.mesh = new THREE.InstancedMesh(
            geometry,
            material,
            count,
        );
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Position the entire mesh group to match the stand location
        const goalT = CONFIG.finishLineT;
        const goalPoint = STATE.trackCurve.getPointAt(goalT);
        const goalTangent = STATE.trackCurve
            .getTangentAt(goalT)
            .normalize();
        const goalNormal = new THREE.Vector3(
            -goalTangent.z,
            0,
            goalTangent.x,
        ).normalize();

        // Same transform as the Stand Group in buildTrack
        // Start from the same base position: goalPoint + -45 * goalNormal
        const standDistance = 45;
        const standPos = goalPoint
            .clone()
            .add(goalNormal.multiplyScalar(-standDistance));

        this.mesh.position.copy(standPos);
        this.mesh.lookAt(goalPoint);

        // Important: Add to scene
        this.scene.add(this.mesh);

        this.spectators = [];
        const colors = [
            0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff,
            0x00ffff, 0xffffff, 0x111111, 0xff9800, 0x4caf50,
        ];

        // Grid layout for "Bleachers" style - REDUCED density for visibility
        const rows = 12;
        const cols = 40;
        const standWidth = 55; // Slightly less than BoxWidth 60

        // Stand Local Dimensions (Approx from buildTrack box geometry)
        // Box(60, 20, 30) translated Y+10.
        // Local Y range of top surface: ~20.
        // Local Z range: -15 to +15.
        // We want stairs going back and up.

        // Let's assume the "front" of the stand is at Z=+15 (closer to track) and "back" is Z=-15.
        const depthStart = 12; // Front of stand (local Z)
        const depthEnd = -12; // Back of stand
        const heightStart = 21; // Bottom of seating area (on top of box)
        const heightEnd = 35; // Top of seating area

        let index = 0;
        for (let r = 0; r < rows; r++) {
            const rowProgress = r / (rows - 1);
            // Z goes from Positive (Front) to Negative (Back)
            const z =
                depthStart - rowProgress * (depthStart - depthEnd);
            // Y goes from Low to High
            const y =
                heightStart +
                rowProgress * (heightEnd - heightStart);

            for (let c = 0; c < cols; c++) {
                if (index >= count) break;

                // Spread columns centered
                const colProgress = c / (cols - 1);
                const x = (colProgress - 0.5) * standWidth;

                // Add some randomness
                const randX = (Math.random() - 0.5) * 0.4;
                const randZ = (Math.random() - 0.5) * 0.2;

                // Local position relative to the mesh group
                const pos = new THREE.Vector3(
                    x + randX,
                    y,
                    z + randZ,
                );
                const color = new THREE.Color(
                    colors[
                    Math.floor(Math.random() * colors.length)
                    ],
                );

                this.mesh.setColorAt(index, color);

                this.spectators.push({
                    basePos: pos, // Local position
                    offsetY: Math.random() * 0.5,
                    jumpPhase: Math.random() * Math.PI * 2,
                    speed: 0.5 + Math.random(),
                });

                this.dummy.position.copy(pos);
                this.dummy.rotation.set(0, 0, 0); // Reset rotation to local aligned
                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(index, this.dummy.matrix);

                index++;
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    update(time, leaderProgress) {
        // Determine excitement level
        const isExcited =
            (leaderProgress > 0.92 && leaderProgress < 1.0) ||
            STATE.winner;
        const jumpBaseSpeed = isExcited ? 15 : 2;
        const jumpBaseHeight = isExcited ? 0.6 : 0.05;

        for (let i = 0; i < this.spectators.length; i++) {
            const s = this.spectators[i]; // Use length instead of count just in case
            if (!s) break;

            // Simple jump animation
            const yAnim =
                Math.sin(
                    time * jumpBaseSpeed * s.speed + s.jumpPhase,
                ) * jumpBaseHeight;

            this.dummy.position.copy(s.basePos);
            this.dummy.position.y += Math.max(0, yAnim);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.dispose();
            this.mesh = null;
        }
    }
}
