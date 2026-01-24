
import { CONFIG } from '../data/constants.js';
import { STATE } from '../state.js';

// --- ゲートクラス ---
// スタートゲートの3Dモデル生成とアニメーション制御
const GATE_GEO = {
    post: new THREE.BoxGeometry(0.2, 4, 0.2),
    top: new THREE.BoxGeometry(3.2, 0.4, 0.4),
    door: new THREE.BoxGeometry(1.4, 3, 0.1),
    bars: new THREE.BoxGeometry(1.2, 2.5, 0.15),
};

export class Gate {
    constructor(laneOffset, scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        const t = CONFIG.startLineT;
        const point = STATE.trackCurve.getPointAt(t);
        const tangent = STATE.trackCurve
            .getTangentAt(t)
            .normalize();
        const normal = new THREE.Vector3(
            -tangent.z,
            0,
            tangent.x,
        ).normalize();
        const pos = point.add(normal.multiplyScalar(laneOffset));
        this.mesh.position.copy(pos);
        this.mesh.lookAt(pos.clone().add(tangent));

        const mat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.5,
        });
        const doorMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.5,
        });

        const p1 = new THREE.Mesh(GATE_GEO.post, mat);
        p1.position.set(-1.5, 2, 0);
        const p2 = new THREE.Mesh(GATE_GEO.post, mat);
        p2.position.set(1.5, 2, 0);
        const top = new THREE.Mesh(GATE_GEO.top, mat);
        top.position.set(0, 3.8, 0);
        this.mesh.add(p1, p2, top);

        const createDoor = (isLeft) => {
            const group = new THREE.Group();
            group.position.set(isLeft ? -1.5 : 1.5, 2, 0);
            const door = new THREE.Mesh(GATE_GEO.door, doorMat);
            door.position.set(isLeft ? 0.7 : -0.7, 0, 0);
            const bars = new THREE.Mesh(
                GATE_GEO.bars,
                new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    wireframe: true,
                }),
            );
            bars.position.set(isLeft ? 0.7 : -0.7, 0, 0);
            group.add(door, bars);
            return group;
        };
        this.leftDoor = createDoor(true);
        this.rightDoor = createDoor(false);
        this.mesh.add(this.leftDoor, this.rightDoor);
        this.isOpen = false;
        // Note: scene is passed in
        this.scene.add(this.mesh);
    }
    open() {
        this.isOpen = true;
    }
    reset() {
        this.isOpen = false;
        this.leftDoor.rotation.y = 0;
        this.rightDoor.rotation.y = 0;
    }
    update(delta) {
        if (this.isOpen && this.leftDoor.rotation.y < 1.8) {
            const speed = 8.0;
            this.leftDoor.rotation.y += delta * speed;
            this.rightDoor.rotation.y -= delta * speed;
        }
    }
    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            // traverse and dispose geometry/material if needed
            this.mesh = null;
        }
    }
}
