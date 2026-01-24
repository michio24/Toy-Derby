
// --- パーティクルシステム ---
// 砂埃、水しぶき、スキルエフェクトなどの粒子制御
export const ParticleType = { DUST: 0, SPLASH: 1, SKILL: 2 };

export class ParticleManager {
    constructor(scene, maxParticles = 3000) {
        this.maxParticles = maxParticles;
        this.particleCount = 0;
        this.scene = scene;

        // Geometry setup
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(maxParticles * 3);
        this.colors = new Float32Array(maxParticles * 3);
        this.sizes = new Float32Array(maxParticles);

        this.geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(this.positions, 3),
        );
        this.geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(this.colors, 3),
        );
        this.geometry.setAttribute(
            "size",
            new THREE.BufferAttribute(this.sizes, 1),
        );

        // Texture Loading
        const textureLoader = new THREE.TextureLoader();
        // If we had a real file we would load it, but we fallback to generated canvas
        this.sparkleTexture = this.createSparkleTexture();

        this.material = new THREE.PointsMaterial({
            size: 1,
            vertexColors: true,
            map: this.sparkleTexture, // Use sparkle texture for everything (looks okay for dust too, or mix)
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending, // Additive for glowing effect
        });

        this.mesh = new THREE.Points(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);

        // Particle data
        this.particles = [];
        for (let i = 0; i < maxParticles; i++) {
            this.particles.push({
                active: false,
                life: 0,
                maxLife: 1.0,
                velocity: new THREE.Vector3(),
                type: ParticleType.DUST,
            });
            this.positions[i * 3 + 1] = -1000;
        }
    }

    createSparkleTexture() {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");

        // Draw star shape
        const cx = 32,
            cy = 32,
            spikes = 4,
            outerRadius = 30,
            innerRadius = 5;
        let rot = (Math.PI / 2) * 3;
        let x = cx,
            y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();

        // Radial Gradient for bloom
        const grad = ctx.createRadialGradient(
            cx,
            cy,
            0,
            cx,
            cy,
            32,
        );
        grad.addColorStop(0, "rgba(255, 255, 255, 1)");
        grad.addColorStop(0.4, "rgba(255, 255, 255, 0.8)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = grad;
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    spawn(pos, type) {
        let index = -1;
        for (let i = 0; i < this.maxParticles; i++) {
            if (!this.particles[i].active) {
                index = i;
                break;
            }
        }

        if (index === -1) return;

        const p = this.particles[index];
        p.active = true;
        p.type = type;

        this.positions[index * 3] = pos.x;
        this.positions[index * 3 + 1] = pos.y;
        this.positions[index * 3 + 2] = pos.z;

        if (type === ParticleType.SKILL) {
            p.life = 1.0 + Math.random() * 0.5;
            p.maxLife = p.life;
            // Upward spiral / burst
            p.velocity.set(
                (Math.random() - 0.5) * 6,
                Math.random() * 10 + 5,
                (Math.random() - 0.5) * 6,
            );
            // Gold/White
            this.colors[index * 3] = 1.0;
            this.colors[index * 3 + 1] = 0.9;
            this.colors[index * 3 + 2] = 0.4;
            this.sizes[index] = Math.random() * 8 + 4;
        } else if (type === ParticleType.DUST) {
            p.life = 0.5 + Math.random() * 0.5;
            p.maxLife = p.life;
            p.velocity.set(
                (Math.random() - 0.5) * 4,
                Math.random() * 2 + 1,
                (Math.random() - 0.5) * 4,
            );
            // Dusty Brown (lightened for additive blending)
            this.colors[index * 3] = 0.5;
            this.colors[index * 3 + 1] = 0.4;
            this.colors[index * 3 + 2] = 0.3;
            this.sizes[index] = Math.random() * 4 + 2;
        } else {
            // SPLASH
            p.life = 0.4 + Math.random() * 0.3;
            p.maxLife = p.life;
            p.velocity.set(
                (Math.random() - 0.5) * 6,
                Math.random() * 5 + 3,
                (Math.random() - 0.5) * 6,
            );
            // Watery Blue
            this.colors[index * 3] = 0.4;
            this.colors[index * 3 + 1] = 0.6;
            this.colors[index * 3 + 2] = 1.0;
            this.sizes[index] = Math.random() * 3 + 1;
        }
    }

    update(delta) {
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.life -= delta;
            if (p.life <= 0) {
                p.active = false;
                this.positions[i * 3 + 1] = -1000;
                this.sizes[i] = 0;
                continue;
            }

            // Physics
            this.positions[i * 3] += p.velocity.x * delta * 5;
            this.positions[i * 3 + 1] += p.velocity.y * delta * 5;
            this.positions[i * 3 + 2] += p.velocity.z * delta * 5;

            if (p.type === ParticleType.SKILL) {
                p.velocity.y += delta * 2; // Rise
                // Twinkle size
                this.sizes[i] =
                    (Math.sin(Date.now() * 0.01 + i) * 0.5 + 1) *
                    ((p.life / p.maxLife) * 8);
            } else if (p.type === ParticleType.DUST) {
                p.velocity.y *= 0.95;
                const r = p.life / p.maxLife;
                this.sizes[i] = (1 - r) * 5 + 2;
            } else {
                // SPLASH
                p.velocity.y -= delta * 25;
                const r = p.life / p.maxLife;
                this.sizes[i] = r * 3;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
    }
}
