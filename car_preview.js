document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("carPreviewContainer");
    if (!container) return;

    const W = container.clientWidth || window.innerWidth;
    const H = container.clientHeight || window.innerHeight;

    // ─── SCENE & CAMERA ───────────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(17, W / H, 0.1, 300);
    camera.position.set(13.0, 0.7, 0);
    camera.lookAt(0, -0.4, 0);

    // ─── RENDERER ─────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // ─── LIGHTING & HIGH-OCTANE AURA ──────────────────────────────────
    scene.add(new THREE.AmbientLight(0x0e0e0e, 0.9));

    const keyLight = new THREE.DirectionalLight(0xffffff, 5.5);
    keyLight.position.set(-6, 12, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.85);
    fillLight.position.set(10, 4, 2);
    scene.add(fillLight);

    const redRim = new THREE.PointLight(0xe8000d, 15.0, 20);
    redRim.position.set(-4, 1.2, -5);
    scene.add(redRim);

    const redUnder = new THREE.PointLight(0xe8000d, 8.0, 10);
    redUnder.position.set(0, -0.5, 0);
    scene.add(redUnder);

    const topEdge = new THREE.DirectionalLight(0xffffff, 2.2);
    topEdge.position.set(0, 15, 0);
    scene.add(topEdge);

    const sweepLight = new THREE.SpotLight(0xffffff, 12.0, 20, Math.PI / 8, 0.5, 1.0);
    sweepLight.position.set(0, 6, 0);
    sweepLight.target.position.set(0, 0, 0);
    scene.add(sweepLight);
    scene.add(sweepLight.target);

    // ─── SHADOW FLOOR ────────────────────────────────────────────────
    const shadowFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.ShadowMaterial({ opacity: 0.2, transparent: true })
    );
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = -2.0;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);

    // ─── AERODYNAMIC WIND-TUNNEL STREAMLINES (Bodywork Contour Curves) ──
    const aeroStreamlines = [];
    const aeroPaths = [
        // 1. Nose -> Cockpit -> Airbox -> Rear Wing
        [ new THREE.Vector3(0, -0.1, -2.8), new THREE.Vector3(0, 0.1, -1.2), new THREE.Vector3(0, 0.45, 0.2), new THREE.Vector3(0, 0.55, 1.8), new THREE.Vector3(0, 0.7, 2.8) ],
        // 2. Left Sidepod & Rear Wing
        [ new THREE.Vector3(-0.35, -0.15, -2.7), new THREE.Vector3(-0.75, 0.05, -1.0), new THREE.Vector3(-0.85, 0.15, 0.5), new THREE.Vector3(-0.8, 0.6, 2.8) ],
        // 3. Right Sidepod & Rear Wing
        [ new THREE.Vector3(0.35, -0.15, -2.7), new THREE.Vector3(0.75, 0.05, -1.0), new THREE.Vector3(0.85, 0.15, 0.5), new THREE.Vector3(0.8, 0.6, 2.8) ],
        // 4. Undercar Venturi Channel Left
        [ new THREE.Vector3(-0.1, -0.35, -2.2), new THREE.Vector3(-0.45, -0.38, 0.0), new THREE.Vector3(-0.65, -0.32, 2.2) ],
        // 5. Undercar Venturi Channel Right
        [ new THREE.Vector3(0.1, -0.35, -2.2), new THREE.Vector3(0.45, -0.38, 0.0), new THREE.Vector3(0.65, -0.32, 2.2) ]
    ];

    aeroPaths.forEach((pathPoints, pIdx) => {
        const curve = new THREE.CatmullRomCurve3(pathPoints);
        const tubeGeo = new THREE.TubeGeometry(curve, 40, 0.012, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
            color: pIdx % 2 === 0 ? 0xff0035 : 0xffffff,
            transparent: true,
            opacity: 0.65
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        scene.add(tubeMesh);

        // Moving pulse particle along the curve
        const pulseGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        scene.add(pulseMesh);

        aeroStreamlines.push({
            curve: curve,
            tube: tubeMesh,
            pulse: pulseMesh,
            progress: Math.random(),
            speed: 0.012 + Math.random() * 0.008
        });
    });

    // ─── REAR WING DOWNFORCE VORTEX SPIRAL BEAMS ──────────────────────
    const vortexBeams = [];
    [-0.85, 0.85].forEach(sideX => {
        const vortexGeo = new THREE.BufferGeometry();
        const vortexMat = new THREE.LineBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.85, linewidth: 2 });
        const line = new THREE.Line(vortexGeo, vortexMat);
        scene.add(line);
        vortexBeams.push({ line: line, sideX: sideX, offset: Math.random() * Math.PI * 2 });
    });

    // ─── HYPER-SPEED LASER WIND TUNNEL BEAMS ──────────────────────────
    const speedLineCount = 45;
    const speedLines = [];
    const neonRedMat = new THREE.MeshBasicMaterial({ color: 0xff002b, transparent: true, opacity: 0.75 });
    const neonWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const lineGeo = new THREE.BoxGeometry(0.02, 0.012, 4.2);

    for (let i = 0; i < speedLineCount; i++) {
        const isRed = Math.random() > 0.35;
        const line = new THREE.Mesh(lineGeo, isRed ? neonRedMat : neonWhiteMat);
        scene.add(line);

        speedLines.push({
            mesh: line,
            x: THREE.MathUtils.randFloat(-5.5, 3.5),
            y: THREE.MathUtils.randFloat(-3.5, 3.5),
            z: THREE.MathUtils.randFloat(-24, 24),
            speed: THREE.MathUtils.randFloat(0.5, 1.0)
        });
    }

    // ─── REAR EXHAUST / DIFFUSER PARTICLES ─────────────────────────────
    const exhaustCount = 18;
    const exhaustParticles = [];
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.8 });
    const exhaustGeo = new THREE.BoxGeometry(0.03, 0.015, 0.8);

    for (let i = 0; i < exhaustCount; i++) {
        const p = new THREE.Mesh(exhaustGeo, exhaustMat);
        scene.add(p);
        exhaustParticles.push({
            mesh: p,
            x: THREE.MathUtils.randFloat(-0.4, 0.4),
            y: THREE.MathUtils.randFloat(-1.2, -0.7),
            z: THREE.MathUtils.randFloat(2.0, 6.0),
            speed: THREE.MathUtils.randFloat(0.8, 1.6)
        });
    }

    // ─── STATE VARIABLES ──────────────────────────────────────────────
    let bottomY = -2.0;
    let baseY = 0;
    let scaledCenter = new THREE.Vector3();

    let launchZ = 22.0;
    let isLaunching = false;
    let isIntro = false;
    let transitionStartedAt = 0;
    let transitionDuration = 0;
    let transitionFromZ = 0;
    let transitionToZ = 0;
    let cameraShake = 0;

    // ─── LOAD MODEL WITH FAILSAFE FALLBACK ─────────────────────────────
    let loadedModel = null;
    const wheels = [];
    const loader = new THREE.GLTFLoader();

    function setupCarModel(gltf) {
        loadedModel = gltf.scene;

        loadedModel.traverse(child => {
            const name = child.name.toLowerCase();
            if (name.includes("steer") || name.includes("knuckle") || name.includes("hub") || name.includes("pivot")) {
                if (child.rotation) {
                    child.rotation.y = 0;
                    child.rotation.z = 0;
                }
            }
            if (child.isMesh) {
                if (name.includes("platform") || name.includes("floor") || name.includes("ground") || 
                    name.includes("stand") || name.includes("plane") || name.includes("base") || 
                    name.includes("disk") || name.includes("cylinder") || name.includes("podium") ||
                    name.includes("shadow")) {
                    child.visible = false;
                }
                if (name.includes("wheel") || name.includes("tire") || name.includes("tyre") || name.includes("rim")) {
                    wheels.push(child);
                    if (child.rotation) {
                        child.rotation.y = 0;
                        child.rotation.z = 0;
                    }
                    let parent = child.parent;
                    while (parent && parent !== loadedModel) {
                        if (parent.rotation) {
                            parent.rotation.y = 0;
                            parent.rotation.z = 0;
                        }
                        parent = parent.parent;
                    }
                }
            }
        });

        const box3 = new THREE.Box3().setFromObject(loadedModel);
        const size3 = box3.getSize(new THREE.Vector3());
        const longestAxis = Math.max(size3.x, size3.y, size3.z);
        const scale = 5.6 / longestAxis;
        loadedModel.scale.set(scale, scale, scale);

        const scaledBox = new THREE.Box3().setFromObject(loadedModel);
        scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        baseY = -scaledCenter.y - 0.4;
        loadedModel.position.set(
            -scaledCenter.x,
            baseY,
            -scaledCenter.z + launchZ
        );

        bottomY = scaledBox.min.y - scaledCenter.y - 0.4;
        shadowFloor.position.y = bottomY;

        loadedModel.traverse(child => {
            if (child.isMesh && child.visible) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.envMapIntensity = 2.5;
                    if (child.material.roughness !== undefined) {
                        child.material.roughness = Math.max(0.04, child.material.roughness * 0.35);
                    }
                    child.material.needsUpdate = true;
                }
            }
        });

        scene.add(loadedModel);

        if (window.carIntroRequested || !document.getElementById("landingScreenMain")) {
            window.startCarIntro();
        }
    }

    loader.load(
        'assets/hero_car.glb/scene.gltf',
        gltf => setupCarModel(gltf),
        undefined,
        err => {
            console.warn("hero_car load failed, loading ferrari fallback:", err);
            loader.load(
                'assets/ferrari.glb',
                gltf => setupCarModel(gltf),
                undefined,
                err2 => console.error("All 3D models failed to load:", err2)
            );
        }
    );

    // ─── MOUSE PARALLAX ───────────────────────────────────────────────
    let mouseX = 0, mouseY = 0;
    let targetMouseX = 0, targetMouseY = 0;

    window.addEventListener("mousemove", (e) => {
        targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    // ─── TRANSITIONS (GSAP Sub-Pixel Interpolation + Fallback) ───────
    window.animObj = { z: 22.0, shake: 0.0 };
    window.hasPlayedInitialIntro = false;
    let isIntroPlaying = false;

    window.launchCarPreview = function(onCompleteCallback) {
        if (window.gsap) {
            gsap.killTweensOf(window.animObj);
            window.animObj.z = launchZ;
            window.animObj.shake = 0.7;
            isLaunching = true;
            isIntro = false;
            gsap.to(window.animObj, {
                z: -32.0,
                shake: 0.0,
                duration: 1.0,
                ease: "power4.in",
                onUpdate: () => {
                    launchZ = window.animObj.z;
                    cameraShake = window.animObj.shake;
                },
                onComplete: () => {
                    isLaunching = false;
                    if (typeof onCompleteCallback === "function") {
                        onCompleteCallback();
                    }
                }
            });
        } else {
            isLaunching = true;
            isIntro = false;
            transitionStartedAt = performance.now();
            transitionDuration = 1000;
            transitionFromZ = launchZ;
            transitionToZ = -32.0;
            cameraShake = 0.6;
            setTimeout(() => {
                isLaunching = false;
                if (typeof onCompleteCallback === "function") {
                    onCompleteCallback();
                }
            }, 1000);
        }
    };

    window.startCarIntro = function(forcePlay = false) {
        window.carIntroRequested = true;

        if (!loadedModel) return;

        if (window.hasPlayedInitialIntro && !forcePlay) {
            return;
        }

        if (isIntroPlaying) return;
        isIntroPlaying = true;
        window.hasPlayedInitialIntro = true;

        launchZ = 22.0;
        if (window.gsap) {
            gsap.killTweensOf(window.animObj);
            window.animObj.z = 22.0;
            window.animObj.shake = 0.5;
            isIntro = true;
            isLaunching = false;
            gsap.to(window.animObj, {
                z: 0.0,
                shake: 0.0,
                duration: 0.9,
                ease: "power3.out",
                onUpdate: () => {
                    launchZ = window.animObj.z;
                    cameraShake = window.animObj.shake;
                },
                onComplete: () => {
                    isIntro = false;
                    isIntroPlaying = false;
                }
            });
        } else {
            isIntro = true;
            isLaunching = false;
            transitionStartedAt = performance.now();
            transitionDuration = 900;
            transitionFromZ = 22.0;
            transitionToZ = 0.0;
            launchZ = transitionFromZ;
            cameraShake = 0.4;
            setTimeout(() => {
                isIntro = false;
                isIntroPlaying = false;
            }, 900);
        }
    };

    let isReturning = false;

    window.returnToLandingPreview = function() {
        if (isReturning) return;
        isReturning = true;

        const landing = document.getElementById("landingScreenMainWrapper");
        const mainMenu = document.getElementById("mainMenu");

        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.backgroundColor = "var(--accent)";
        overlay.style.transform = "translateX(-100%)";
        overlay.style.zIndex = "9999";
        overlay.style.pointerEvents = "none";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";

        const text = document.createElement("div");
        text.textContent = "RETURNING TO MENU...";
        text.style.fontFamily = "var(--font-heading)";
        text.style.fontSize = "3.5rem";
        text.style.color = "#fff";
        text.style.letterSpacing = "4px";
        overlay.appendChild(text);

        document.body.appendChild(overlay);

        const doReturn = () => {
            if (landing) landing.style.display = "block";
            if (mainMenu) mainMenu.classList.remove("anim-slide-up");
            
            isIntroPlaying = false;
            launchZ = 22.0;
            if (window.animObj) window.animObj.z = 22.0;
            window.startCarIntro(true);

            if (window.gsap) {
                gsap.to(overlay, {
                    xPercent: 100,
                    duration: 0.5,
                    ease: "power4.inOut",
                    onComplete: () => {
                        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                        isReturning = false;
                    }
                });
            } else {
                overlay.style.transition = "transform 0.5s cubic-bezier(0.86, 0, 0.07, 1)";
                overlay.style.transform = "translateX(100%)";
                setTimeout(() => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    isReturning = false;
                }, 520);
            }
        };

        if (window.gsap) {
            gsap.to(overlay, {
                xPercent: 0,
                duration: 0.5,
                ease: "power4.inOut",
                onComplete: () => setTimeout(doReturn, 200)
            });
        } else {
            overlay.style.transition = "transform 0.5s cubic-bezier(0.86, 0, 0.07, 1)";
            overlay.offsetHeight;
            overlay.style.transform = "translateX(0%)";
            setTimeout(doReturn, 700);
        }

        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            isReturning = false;
        }, 1800);
    };

    // ─── ANIMATION LOOP ───────────────────────────────────────────────
    const clock = new THREE.Clock();
    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        const landingWrapper = document.getElementById("landingScreenMainWrapper");
        if (landingWrapper && landingWrapper.style.display === "none") return;

        const delta = Math.min(clock.getDelta(), 0.1);
        const dtScale = delta * 60;
        time += delta;

        mouseX += (targetMouseX - mouseX) * 0.05 * dtScale;
        mouseY += (targetMouseY - mouseY) * 0.05 * dtScale;

        // 1. Natural Suspension Dynamics
        const engineRumble = Math.sin(time * 35.0) * 0.0025;
        const aeroBounce   = Math.sin(time * 7.0)  * 0.012;
        const nosePitch    = Math.sin(time * 4.5)  * 0.006;
        const currentY = baseY + engineRumble + aeroBounce;

        if (isLaunching || isIntro) {
            const progress = Math.min((performance.now() - transitionStartedAt) / transitionDuration, 1);
            const eased = isLaunching
                ? 1 - Math.pow(1 - progress, 5)
                : 1 - Math.pow(1 - progress, 3);
            launchZ = THREE.MathUtils.lerp(transitionFromZ, transitionToZ, eased);
            cameraShake = Math.max(0, cameraShake - 0.02 * dtScale);

            for (let i = 0; i < speedLineCount; i++) {
                speedLines[i].speed = isLaunching ? 2.5 : 0.7 + (1 - progress) * 1.5;
                speedLines[i].mesh.scale.z = isLaunching ? 14.0 : 1.2 + (1 - progress) * 6.0;
            }

            if (progress === 1) {
                isLaunching = false;
                isIntro = false;
                launchZ = transitionToZ;
            }
        } else {
            for (let i = 0; i < speedLineCount; i++) {
                speedLines[i].mesh.scale.z = 1.0;
            }
        }

        // Camera damping
        const shakeOffset = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake * 0.2 : 0;
        const targetCamY = 0.7 + mouseY * 0.35 + shakeOffset;
        const targetCamZ = mouseX * 0.5 + shakeOffset;

        camera.position.y += (targetCamY - camera.position.y) * 0.06 * dtScale;
        camera.position.z += (targetCamZ - camera.position.z) * 0.06 * dtScale;
        camera.lookAt(0, -0.4, 0);

        if (loadedModel) {
            loadedModel.rotation.y = 0.16 + mouseX * 0.04;
            loadedModel.rotation.x = -0.04 + mouseY * 0.02 + nosePitch;
            loadedModel.rotation.z = mouseX * 0.025;

            loadedModel.position.set(
                -scaledCenter.x,
                currentY,
                -scaledCenter.z + launchZ
            );

            const spinSpeed = (isLaunching ? 1.5 : (isIntro ? 0.8 : 0.45)) * dtScale;
            wheels.forEach(wheel => {
                wheel.rotation.x += spinSpeed;
            });
        }

        // 2. Dynamic Bodywork Overhead Sweep
        sweepLight.position.z = Math.sin(time * 2.0) * 10.0;
        sweepLight.target.position.z = sweepLight.position.z;

        // 3. Pulse Aura Lights
        redRim.intensity   = 15.0 + Math.sin(time * 5.0) * 3.0;
        redUnder.intensity =  8.0 + Math.sin(time * 3.5) * 2.0;

        // 4. Update Aerodynamic Wind-Tunnel Streamlines & Energy Pulses
        aeroStreamlines.forEach((s) => {
            s.progress += s.speed * (isLaunching ? 3.0 : 1.0) * dtScale;
            if (s.progress > 1) s.progress = 0;
            const pt = s.curve.getPoint(s.progress);
            s.pulse.position.set(
                pt.x - scaledCenter.x,
                currentY + pt.y,
                pt.z - scaledCenter.z + launchZ
            );
            s.tube.position.set(
                -scaledCenter.x,
                currentY,
                -scaledCenter.z + launchZ
            );
        });

        // 5. Update Rear Wing Downforce Vortex Spirals
        vortexBeams.forEach((v) => {
            const points = [];
            const numPoints = 25;
            for (let i = 0; i < numPoints; i++) {
                const t = i / numPoints;
                const radius = 0.02 + t * 0.18;
                const angle = time * 18.0 + t * 12.0 + v.offset;
                const vx = v.sideX + Math.cos(angle) * radius - scaledCenter.x;
                const vy = currentY + 0.55 + Math.sin(angle) * radius;
                const vz = 2.6 + t * 5.0 - scaledCenter.z + launchZ;
                points.push(new THREE.Vector3(vx, vy, vz));
            }
            v.line.geometry.setFromPoints(points);
        });

        // 6. Update Environmental Wind-Tunnel Beams
        for (let i = 0; i < speedLineCount; i++) {
            const line = speedLines[i];
            const currentSpeed = (isLaunching ? 2.5 : (isIntro ? line.speed * 1.6 : line.speed)) * dtScale;
            line.z += currentSpeed;

            if (line.z > 24) {
                line.z = -24;
                line.x = THREE.MathUtils.randFloat(-5.5, 3.5);
                line.y = THREE.MathUtils.randFloat(-3.5, 3.5);
            }
            line.mesh.position.set(line.x + 0.5, line.y, line.z);
        }

        // 7. Diffuser Exhaust Sparks
        if (loadedModel) {
            for (let i = 0; i < exhaustParticles.length; i++) {
                const ep = exhaustParticles[i];
                ep.z += ep.speed * dtScale;
                if (ep.z > 14.0) {
                    ep.z = THREE.MathUtils.randFloat(1.8, 3.5);
                    ep.x = THREE.MathUtils.randFloat(-0.4, 0.4);
                    ep.y = THREE.MathUtils.randFloat(-1.2, -0.7);
                }
                ep.mesh.position.set(ep.x, currentY + ep.y, ep.z + launchZ);
            }
        }

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener("resize", () => {
        const nW = container.clientWidth || window.innerWidth;
        const nH = container.clientHeight || window.innerHeight;
        if (nW > 0 && nH > 0) {
            camera.aspect = nW / nH;
            camera.updateProjectionMatrix();
            renderer.setSize(nW, nH);
        }
    });
});

// ─── TAB VISIBILITY AUDIO CONTROL ─────────────────────────────────────
let bgmWasPlaying = false;

function handleVisibilityChange() {
    const bgm = document.getElementById("bgm");
    if (!bgm) return;

    if (document.hidden) {
        if (!bgm.paused) {
            bgmWasPlaying = true;
            bgm.pause();
        }
    } else {
        if (bgmWasPlaying || bgm.paused) {
            bgm.play().catch(() => {});
            bgmWasPlaying = false;
        }
    }
}

document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("blur", () => {
    const bgm = document.getElementById("bgm");
    if (bgm && !bgm.paused) {
        bgmWasPlaying = true;
        bgm.pause();
    }
});
window.addEventListener("focus", () => {
    const bgm = document.getElementById("bgm");
    if (bgm && bgmWasPlaying) {
        bgm.play().catch(() => {});
        bgmWasPlaying = false;
    }
});
