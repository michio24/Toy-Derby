
import { STATE } from '../state.js';
import { CONFIG } from '../data/constants.js';
import { Gate } from '../classes/Gate.js';
import { SpectatorManager } from '../classes/SpectatorManager.js';

// --- コース & トラック生成 ---
export let trackGroup = null;
export let spectatorManager = null;

// コース形状のデータ定義 (ベジェ曲線の制御点)
export const COURSES = [
    {
        name: "Classic Circuit",
        points: [
            new THREE.Vector3(200, 0, 0),
            new THREE.Vector3(180, 0, 80),
            new THREE.Vector3(100, 0, 120),
            new THREE.Vector3(-50, 0, 100),
            new THREE.Vector3(-150, 0, 40),
            new THREE.Vector3(-220, 0, 0),
            new THREE.Vector3(-180, 0, -80),
            new THREE.Vector3(-50, 0, -120),
            new THREE.Vector3(50, 0, -80),
            new THREE.Vector3(150, 0, -60),
            new THREE.Vector3(200, 0, 0),
        ],
    },
    {
        name: "Forest Oval",
        points: [
            new THREE.Vector3(200, 0, 0),
            new THREE.Vector3(200, 0, 80),
            new THREE.Vector3(0, 0, 120),
            new THREE.Vector3(-200, 0, 80),
            new THREE.Vector3(-200, 0, 0),
            new THREE.Vector3(-200, 0, -80),
            new THREE.Vector3(0, 0, -120),
            new THREE.Vector3(200, 0, -80),
            new THREE.Vector3(200, 0, 0),
        ],
    },
    {
        name: "Dragon's Long Run",
        points: [
            new THREE.Vector3(200, 0, 0), // Start
            new THREE.Vector3(250, 0, 100), // Wide turn
            new THREE.Vector3(150, 0, 180), // Deep curve
            new THREE.Vector3(0, 0, 150), // Inner twist
            new THREE.Vector3(-100, 0, 200), // Technical section
            new THREE.Vector3(-250, 0, 120), // Backstretch start
            new THREE.Vector3(-320, 0, 0), // Far edge (Long straight)
            new THREE.Vector3(-280, 0, -150), // Sharp turn
            new THREE.Vector3(-100, 0, -100), // S-curve entry
            new THREE.Vector3(0, 0, -160), // S-curve exit
            new THREE.Vector3(120, 0, -120), // Final turn setup
            new THREE.Vector3(200, 0, 0), // Loop close
        ],
    },
    {
        name: "Crescent Mile",
        points: [
            new THREE.Vector3(200, 0, 0),
            new THREE.Vector3(220, 0, 60),
            new THREE.Vector3(140, 0, 120),
            new THREE.Vector3(40, 0, 140),
            new THREE.Vector3(-60, 0, 120),
            new THREE.Vector3(-160, 0, 80),
            new THREE.Vector3(-220, 0, 0),
            new THREE.Vector3(-160, 0, -80),
            new THREE.Vector3(-40, 0, -140),
            new THREE.Vector3(80, 0, -120),
            new THREE.Vector3(180, 0, -60),
            new THREE.Vector3(200, 0, 0),
        ],
    },
];

export function createTrackCurve(points) {
    return new THREE.CatmullRomCurve3(points, true, "centripetal");
}

export function cleanupLevel(scene) {
    // Remove old track group
    if (trackGroup) {
        scene.remove(trackGroup);
        // Dispose logic could be added here for geometries/materials to avoid memory leaks
        // For now, relying on GC as per simple implementation
        trackGroup = null;
    }

    // Remove Gates
    if (STATE.gates.length > 0) {
        STATE.gates.forEach((g) => g.dispose());
        STATE.gates = [];
    }

    // Remove Spectators
    if (spectatorManager) {
        spectatorManager.dispose();
        spectatorManager = null;
    }
}

export function buildTrack(courseData, scene) {
    cleanupLevel(scene);

    STATE.trackCurve = createTrackCurve(courseData.points);
    trackGroup = new THREE.Group();
    scene.add(trackGroup);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    // Create material immediately so we can assign texture later
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x4caf50,
        roughness: 1.0,
    });

    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load(
        "textures/grass.png",
        function (texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(25, 25);
            groundMat.map = texture;
            groundMat.needsUpdate = true;
        },
        undefined,
        function (error) {
            console.warn(
                "Error loading grass texture, using procedural fallback",
            );
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#4CAF50";
            ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 10000; i++) {
                ctx.fillStyle =
                    Math.random() > 0.5 ? "#66BB6A" : "#388E3C";
                const size = Math.random() * 3 + 1;
                ctx.fillRect(
                    Math.random() * 512,
                    Math.random() * 512,
                    size,
                    size,
                );
            }
            const fallbackTexture = new THREE.CanvasTexture(canvas);
            fallbackTexture.wrapS = THREE.RepeatWrapping;
            fallbackTexture.wrapT = THREE.RepeatWrapping;
            fallbackTexture.repeat.set(25, 25);
            groundMat.map = fallbackTexture;
            groundMat.needsUpdate = true;
        },
    );

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    trackGroup.add(ground);

    // Track Surface
    const trackWidth = CONFIG.laneWidth * 6;
    const points = STATE.trackCurve.getSpacedPoints(200);
    const vertices = [],
        uvs = [],
        indices = [];

    points.forEach((p, i) => {
        const tangent = STATE.trackCurve
            .getTangentAt(i / 200)
            .normalize();
        const normal = new THREE.Vector3(
            -tangent.z,
            0,
            tangent.x,
        ).normalize();
        const p1 = p
            .clone()
            .add(normal.clone().multiplyScalar(trackWidth / 2));
        const p2 = p
            .clone()
            .add(normal.clone().multiplyScalar(-trackWidth / 2));
        vertices.push(p1.x, 0.5, p1.z, p2.x, 0.5, p2.z);
        const v = i / 10;
        uvs.push(0, v, 1, v);
    });
    for (let i = 0; i < points.length - 1; i++) {
        const offset = i * 2;
        indices.push(
            offset,
            offset + 1,
            offset + 2,
            offset + 1,
            offset + 3,
            offset + 2,
        );
    }
    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
    );
    trackGeo.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(uvs, 2),
    );
    trackGeo.setIndex(indices);
    trackGeo.computeVertexNormals();

    // Track Texture
    const trackTex = textureLoader.load(
        "textures/dirt.png",
        (t) => {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(4, 4);
        },
        undefined,
        (err) => {
            const sandCanvas = document.createElement("canvas");
            sandCanvas.width = 512;
            sandCanvas.height = 512;
            const sCtx = sandCanvas.getContext("2d");
            sCtx.fillStyle = "#6B4423";
            sCtx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 10000; i++) {
                const rand = Math.random();
                if (rand < 0.4) sCtx.fillStyle = "#8B5A3C";
                else if (rand < 0.7) sCtx.fillStyle = "#5C3317";
                else sCtx.fillStyle = "#A0522D";
                sCtx.fillRect(
                    Math.random() * 512,
                    Math.random() * 512,
                    4,
                    4,
                );
            }
            const fallback = new THREE.CanvasTexture(sandCanvas);
            fallback.wrapS = THREE.RepeatWrapping;
            fallback.wrapT = THREE.RepeatWrapping;
            fallback.repeat.set(4, 4);
            trackMesh.material.map = fallback;
            trackMesh.material.needsUpdate = true;
        },
    );

    const trackMesh = new THREE.Mesh(
        trackGeo,
        new THREE.MeshStandardMaterial({
            map: trackTex,
            color: 0xffffff,
            roughness: 1.0,
            side: THREE.DoubleSide,
        }),
    );
    trackMesh.receiveShadow = true;
    trackMesh.castShadow = true;
    trackGroup.add(trackMesh);

    // Objects
    const innerRailPoints = [],
        outerRailPoints = [];
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2);
    const poleMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
    });

    points.forEach((p, i) => {
        const tangent = STATE.trackCurve
            .getTangentAt(i / 200)
            .normalize();
        const normal = new THREE.Vector3(
            -tangent.z,
            0,
            tangent.x,
        ).normalize();

        if (i % 5 === 0) {
            const posIn = p
                .clone()
                .add(
                    normal
                        .clone()
                        .multiplyScalar((trackWidth / 2) * 1.05),
                );
            const poleIn = new THREE.Mesh(poleGeo, poleMat);
            poleIn.position.set(posIn.x, 0.6, posIn.z);
            trackGroup.add(poleIn);

            const posOut = p
                .clone()
                .add(
                    normal
                        .clone()
                        .multiplyScalar((-trackWidth / 2) * 1.05),
                );
            const poleOut = new THREE.Mesh(poleGeo, poleMat);
            poleOut.position.set(posOut.x, 0.6, posOut.z);
            trackGroup.add(poleOut);
        }
        innerRailPoints.push(
            p
                .clone()
                .add(
                    normal
                        .clone()
                        .multiplyScalar((trackWidth / 2) * 1.05),
                )
                .setY(1.0),
        );
        outerRailPoints.push(
            p
                .clone()
                .add(
                    normal
                        .clone()
                        .multiplyScalar((-trackWidth / 2) * 1.05),
                )
                .setY(1.0),
        );
    });
    trackGroup.add(
        new THREE.Mesh(
            new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3(innerRailPoints, true),
                200,
                0.08,
                6,
                true,
            ),
            new THREE.MeshStandardMaterial({ color: 0xffffff }),
        ),
    );
    trackGroup.add(
        new THREE.Mesh(
            new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3(outerRailPoints, true),
                200,
                0.08,
                6,
                true,
            ),
            new THREE.MeshStandardMaterial({ color: 0xffffff }),
        ),
    );

    const goalT = CONFIG.finishLineT;
    const goalPoint = STATE.trackCurve.getPointAt(goalT);
    const prevPoint = STATE.trackCurve.getPointAt(0.99);
    const goalGroup = new THREE.Group();
    goalGroup.position.copy(goalPoint);
    goalGroup.lookAt(prevPoint);
    const postGeo = new THREE.CylinderGeometry(0.3, 0.3, 8);
    const postMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
    });
    const gp1 = new THREE.Mesh(postGeo, postMat);
    gp1.position.set(-trackWidth / 2 - 1, 4, 0);
    const gp2 = new THREE.Mesh(postGeo, postMat);
    gp2.position.set(trackWidth / 2 + 1, 4, 0);
    const banner = new THREE.Mesh(
        new THREE.BoxGeometry(trackWidth + 4, 2, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xb71c1c }),
    );
    banner.position.set(0, 7, 0);
    const tCtx = document.createElement("canvas").getContext("2d");
    tCtx.canvas.width = 256;
    tCtx.canvas.height = 64;
    tCtx.fillStyle = "#B71C1C";
    tCtx.fillRect(0, 0, 256, 64);
    tCtx.fillStyle = "white";
    tCtx.font = "bold 40px Arial";
    tCtx.textAlign = "center";
    tCtx.textBaseline = "middle";
    tCtx.fillText("GOAL", 128, 32);
    banner.material = new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(tCtx.canvas),
    });
    goalGroup.add(gp1, gp2, banner);
    trackGroup.add(goalGroup);

    const standGroup = new THREE.Group();
    standGroup.add(
        new THREE.Mesh(
            new THREE.BoxGeometry(60, 20, 30),
            new THREE.MeshStandardMaterial({ color: 0xffffff }),
        )
            .translateX(0)
            .translateY(10),
    );
    standGroup.add(
        new THREE.Mesh(
            new THREE.BoxGeometry(64, 2, 40),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee }),
        )
            .translateY(25)
            .translateZ(5),
    );
    const goalTangent = STATE.trackCurve
        .getTangentAt(goalT)
        .normalize();
    const goalNormal = new THREE.Vector3(
        -goalTangent.z,
        0,
        goalTangent.x,
    ).normalize();
    standGroup.position.copy(
        goalPoint.clone().add(goalNormal.multiplyScalar(-45)),
    );
    standGroup.lookAt(goalPoint);
    trackGroup.add(standGroup);

    // Trees
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 2.5, 7);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3828,
        roughness: 0.9,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
        color: 0x2e7d32,
        roughness: 0.8,
        flatShading: true,
    });
    const foliageGeo1 = new THREE.ConeGeometry(3.0, 4.0, 7);
    const foliageGeo2 = new THREE.ConeGeometry(2.3, 3.5, 7);
    const foliageGeo3 = new THREE.ConeGeometry(1.6, 3.0, 7);

    const treeCount = 60;
    for (let i = 0; i < treeCount; i++) {
        const t = Math.random();
        const p = STATE.trackCurve.getPointAt(t);
        const tan = STATE.trackCurve.getTangentAt(t).normalize();
        const nor = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const dist = 35 + Math.random() * 60;
        const side = Math.random() > 0.3 ? 1 : -1;
        const treePos = p.add(nor.multiplyScalar(dist * side));
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);
        const l1 = new THREE.Mesh(foliageGeo1, foliageMat);
        l1.position.y = 3.0;
        l1.receiveShadow = true;
        l1.rotation.y = Math.random();
        tree.add(l1);
        const l2 = new THREE.Mesh(foliageGeo2, foliageMat);
        l2.position.y = 5.0;
        l2.receiveShadow = true;
        l2.rotation.y = Math.random();
        tree.add(l2);
        const l3 = new THREE.Mesh(foliageGeo3, foliageMat);
        l3.position.y = 7.0;
        l3.receiveShadow = true;
        l3.rotation.y = Math.random();
        tree.add(l3);
        const scale = 0.8 + Math.random() * 0.6;
        tree.scale.set(scale, scale, scale);
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.position.copy(treePos);
        trackGroup.add(tree);
    }

    // Initialize Spectators for new track
    spectatorManager = new SpectatorManager(scene);

    // Re-initialize Gates
    if (STATE.horses.length > 0) {
        // If horses exist (rebuild), we need to remake gates for them
        STATE.horses.forEach((h, index) => {
            const gate = new Gate((index - 2) * CONFIG.laneWidth);
            STATE.gates.push(gate);
        });
    }
}
