
// --- 紙吹雪システム ---
// ゴール時の演出用
export class ConfettiManager {
    constructor(scene, count = 1000) {
        this.count = count;
        this.scene = scene;
        this.active = false;

        const geometry = new THREE.PlaneGeometry(0.3, 0.3);
        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
        });
        this.mesh = new THREE.InstancedMesh(
            geometry,
            material,
            count,
        );
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        this.dummy = new THREE.Object3D();
        this.particles = [];

        const colors = [
            0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff,
            0x00ffff, 0xffffff,
        ];

        for (let i = 0; i < count; i++) {
            this.particles.push({
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3(),
                rot: new THREE.Vector3(),
                rotVel: new THREE.Vector3(),
                color: new THREE.Color(
                    colors[
                    Math.floor(Math.random() * colors.length)
                    ],
                ),
            });
            this.mesh.setColorAt(i, this.particles[i].color);
        }

        this.mesh.visible = false;
        scene.add(this.mesh);
    }

    start(centerPos) {
        this.active = true;
        this.mesh.visible = true;
        this.particles.forEach((p, i) => {
            // Spawn area around the winner
            p.pos.set(
                centerPos.x + (Math.random() - 0.5) * 40,
                centerPos.y + 20 + Math.random() * 20,
                centerPos.z + (Math.random() - 0.5) * 40,
            );
            p.vel.set(
                (Math.random() - 0.5) * 0.5,
                -(Math.random() * 0.2 + 0.1),
                (Math.random() - 0.5) * 0.5,
            );
            p.rot.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI,
            );
            p.rotVel.set(
                Math.random() * 0.2,
                Math.random() * 0.2,
                Math.random() * 0.2,
            );

            this.updateParticle(i, p);
        });
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    stop() {
        this.active = false;
        this.mesh.visible = false;
    }

    updateParticle(i, p) {
        this.dummy.position.copy(p.pos);
        this.dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    update(delta) {
        if (!this.active) return;

        this.particles.forEach((p, i) => {
            p.pos.add(p.vel);
            p.rot.x += p.rotVel.x;
            p.rot.y += p.rotVel.y;
            p.rot.z += p.rotVel.z;

            // Swing effect
            p.pos.x += Math.sin(Date.now() * 0.001 + i) * 0.02;

            // Reset if too low
            if (p.pos.y < 0) {
                p.pos.y = 40;
            }

            this.updateParticle(i, p);
        });
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}
