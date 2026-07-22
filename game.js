function toggleFS() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => console.log(e));
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}
window.f1CarModel = null;
const canvas = document.getElementById('c');
let cameraMode = '3RD_PERSON';
let cinematicStartTime = 0;
let defaultCameraMode = '3RD_PERSON';
let shakeMultiplier = 1.0;
let sfxMasterVolume = 0.2;

function toggleCamera() {
    cameraMode = cameraMode === '3RD_PERSON' ? '1ST_PERSON' : '3RD_PERSON';
}
window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'c') toggleCamera();
    if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
        if (document.getElementById('settingsModal').style.display !== 'none') {
            closeSettings();
        } else {
            togglePause();
        }
    }
});

// ---- Phase 1: Settings Modal ----
function openSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    // Sync slider values from current state
    const bgm = document.getElementById('bgm');
    if (bgm) {
        document.getElementById('musicVolume').value = bgm.volume;
        document.getElementById('musicVolVal').textContent = Math.round(bgm.volume * 100) + '%';
    }
}
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}
function setMusicVolume(val) {
    const bgm = document.getElementById('bgm');
    if (bgm) bgm.volume = parseFloat(val);
    document.getElementById('musicVolVal').textContent = Math.round(val * 100) + '%';
    localStorage.setItem('nr_musicVol', val);
}
function setSfxVolume(val) {
    sfxMasterVolume = parseFloat(val);
    document.getElementById('sfxVolVal').textContent = Math.round(val * 100) + '%';
    localStorage.setItem('nr_sfxVol', val);
    // Apply to all positional audio if initialized
    if (typeof sounds !== 'undefined' && sounds) {
        if (sounds.engine) sounds.engine.setVolume(sfxMasterVolume * 0.3);
    }
}
function setDefaultCamera(val) {
    defaultCameraMode = val;
    localStorage.setItem('nr_defaultCam', val);
}
function setShakeIntensity(val) {
    shakeMultiplier = parseFloat(val);
    document.getElementById('shakeVal').textContent = Math.round(val * 100) + '%';
    localStorage.setItem('nr_shake', val);
}

// Load saved settings
(function loadSettings() {
    const mv = localStorage.getItem('nr_musicVol');
    const sv = localStorage.getItem('nr_sfxVol');
    const cam = localStorage.getItem('nr_defaultCam');
    const shake = localStorage.getItem('nr_shake');
    if (mv) { const bgm = document.getElementById('bgm'); if (bgm) bgm.volume = parseFloat(mv); }
    if (sv) sfxMasterVolume = parseFloat(sv);
    if (cam) { defaultCameraMode = cam; }
    if (shake) shakeMultiplier = parseFloat(shake);
})();

// ---- Phase 2: Personal Best & Lap Records ----
function getBestKey() {
    return 'nr_best_' + (typeof currentWeather !== 'undefined' ? currentWeather : 'summer');
}
function checkPersonalBest(timeMs) {
    const key = getBestKey();
    const prev = localStorage.getItem(key);
    if (!prev || timeMs < parseInt(prev)) {
        localStorage.setItem(key, timeMs);
        return true; // new best
    }
    return false;
}
function formatBestTime(ms) {
    if (!ms) return '--:--.--';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const t = Math.floor((ms % 1000) / 100);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${t}`;
}
function updateBestTimeOnMenu() {
    const weathers = ['summer','rain','snow','night'];
    weathers.forEach(w => {
        const chip = document.getElementById('best_' + w);
        if (!chip) return;
        const ms = localStorage.getItem('nr_best_' + w);
        chip.textContent = ms ? '🏆 ' + formatBestTime(parseInt(ms)) : '';
        chip.style.display = ms ? 'inline-flex' : 'none';
    });
}

// Share lap time
function shareLapTime() {
    const time = document.getElementById('time').textContent;
    const weather = typeof currentWeather !== 'undefined' ? currentWeather : 'race';
    const pos = document.getElementById('pos') ? document.getElementById('pos').textContent : '?';
    const drift = player ? player.driftScore.toLocaleString() : '0';
    const text = `🏎️ Nitro Racer Result\nWeather: ${weather}\nFinish Time: ${time}\nPosition: ${pos}\nDrift Score: ${drift} pts\nPlay at: localhost:8000/game.html`;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('[onclick="shareLapTime()"]');
        if (btn) { const old = btn.textContent; btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = old, 2000); }
    }).catch(() => { alert('Result:\n' + text); });
}

// Phase 6: Show animated floating drift score popup
let _driftPopupTimeout = null;
function showDriftScorePopup(pts, combo) {
    const el = document.getElementById('driftPopup');
    if (!el) return;
    const comboText = combo > 1 ? ` x${combo.toFixed(1)}` : '';
    el.textContent = `+${pts.toLocaleString()}${comboText}`;
    el.style.display = 'block';
    // Force restart animation
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'driftPop 1.5s ease-out forwards';
    if (_driftPopupTimeout) clearTimeout(_driftPopupTimeout);
    _driftPopupTimeout = setTimeout(() => { el.style.display = 'none'; }, 1600);
}


function togglePause() {
    if (!raceStarted || gameOver || isResuming) return;
    
    isPaused = !isPaused;
    
    if (isPaused) {
        pauseTime = Date.now();
        let pm = document.getElementById('pauseMenu');
        pm.style.display = 'flex';
        pm.classList.remove('anim-modal-drop');
        void pm.offsetWidth;
        pm.classList.add('anim-modal-drop');
        
        const resumeText = document.getElementById('resumeText');
        resumeText.style.display = 'block';
        resumeText.style.color = '#ffffff';
        resumeText.textContent = '3';
        
        let count = 3;
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                resumeText.textContent = count;
            } else if (count === 0) {
                resumeText.textContent = 'GO!!!';
                resumeText.style.color = '#ffffff';
            } else {
                clearInterval(countdownInterval);
                resumeText.style.display = 'none';
                isResuming = false;
                raceStartTime += (Date.now() - pauseTime);
            }
        }, 1000);
    } else {
        document.getElementById('pauseMenu').style.display = 'none';
    }
}
// ---- Texture Generators ----
function createSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 4096; canvas.height = 1024; // High-res for smooth scaling
    const ctx = canvas.getContext('2d');
    
    // ── Weather-dependent Sky Gradients ──────────────────────
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    
    if (currentWeather === 'summer') {
        grad.addColorStop(0.0,  '#1e40af');   // deep blue
        grad.addColorStop(0.3,  '#3b82f6');   // clear blue sky
        grad.addColorStop(0.6,  '#7dd3fc');   // light sky blue
        grad.addColorStop(0.85, '#bae6fd');   // very light blue near horizon
        grad.addColorStop(1.0,  '#f0f9ff');   // bright atmospheric horizon
    } else if (currentWeather === 'rain') {
        grad.addColorStop(0.0,  '#3C444E');   // dark moody grey
        grad.addColorStop(0.4,  '#515F7A');   // slate grey-blue
        grad.addColorStop(0.7,  '#6B7682');   // misty grey
        grad.addColorStop(1.0,  '#D9DEE3');   // thick overcast horizon
    } else if (currentWeather === 'snow') {
        grad.addColorStop(0.0,  '#003459');   // icy deep blue
        grad.addColorStop(0.4,  '#85CCDD');   // bright icy blue
        grad.addColorStop(0.7,  '#E0FFFF');   // pale cyan
        grad.addColorStop(1.0,  '#FFFAFA');   // snow white horizon
    } else if (currentWeather === 'night') {
        grad.addColorStop(0.0,  '#020617');   // space black
        grad.addColorStop(0.5,  '#090d16');   // deep navy
        grad.addColorStop(1.0,  '#1e1b4b');   // indigo horizon
    }
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4096, 1024);

    // Stars at night
    if (currentWeather === 'night') {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 150; i++) {
            const starX = Math.random() * 4096;
            const starY = Math.random() * 800; // stars above horizon
            const starSize = Math.random() * 1.5 + 0.5;
            ctx.beginPath();
            ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // ── Sun disc (Only in Summer and Snow) ──────────────────
    if (currentWeather !== 'rain' && currentWeather !== 'night') {
        const sunX = 2048, sunY = 500, sunR = 80;
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 5);
        if (currentWeather === 'summer') {
            sunGrad.addColorStop(0,    'rgba(255,255,255,1)');
            sunGrad.addColorStop(0.2,  'rgba(255,250,220,0.9)');
            sunGrad.addColorStop(0.5,  'rgba(255,240,180,0.5)');
            sunGrad.addColorStop(1,    'rgba(255,255,255,0)');
        } else { // snow sun (paler, more diffuse)
            sunGrad.addColorStop(0,    'rgba(255,255,255,0.9)');
            sunGrad.addColorStop(0.4,  'rgba(255,255,255,0.4)');
            sunGrad.addColorStop(1,    'rgba(255,255,255,0)');
        }
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, 4096, 1024);
    }

    // ── Atmospheric haze band at horizon ──────────────
    const haze = ctx.createLinearGradient(0, 800, 0, 1024);
    if (currentWeather === 'rain') {
        haze.addColorStop(0, 'rgba(200,210,220,0)');
        haze.addColorStop(1, 'rgba(200,210,220,0.9)');
    } else if (currentWeather === 'night') {
        haze.addColorStop(0, 'rgba(15,23,42,0)');
        haze.addColorStop(1, 'rgba(15,23,42,0.8)');
    } else {
        haze.addColorStop(0, 'rgba(255,255,255,0)');
        haze.addColorStop(1, 'rgba(255,255,255,0.7)');
    }
    ctx.fillStyle = haze;
    ctx.fillRect(0, 800, 4096, 224);

    // ── Perfectly Tileable Distant Mountains ──────────
    if (currentWeather === 'rain') ctx.fillStyle = '#4b5563'; // darker grey
    else if (currentWeather === 'snow') ctx.fillStyle = '#e2e8f0'; // snowy grey-white
    else if (currentWeather === 'night') ctx.fillStyle = '#0f172a'; // space blue silhouette
    else ctx.fillStyle = '#64748b'; // distant blue-grey mountains
    
    ctx.beginPath();
    ctx.moveTo(0, 1024);
    for (let x = 0; x <= 4096; x += 10) {
        let h = 0;
        h += Math.sin((x / 4096) * Math.PI * 2) * 50;
        h += Math.sin((x / 4096) * Math.PI * 6) * 40;
        h += Math.cos((x / 4096) * Math.PI * 14) * 20;
        ctx.lineTo(x, 930 - h);
    }
    ctx.lineTo(4096, 1024);
    ctx.closePath();
    ctx.fill();
    
    // ── Front Hills ───────────────────────────────────
    if (currentWeather === 'rain') ctx.fillStyle = '#374151'; // dark muddy grey
    else if (currentWeather === 'snow') ctx.fillStyle = '#f8fafc'; // crisp snow
    else if (currentWeather === 'night') ctx.fillStyle = '#020617'; // foreground hills very dark silhouette
    else ctx.fillStyle = '#475569'; // closer, slightly darker
    
    ctx.beginPath();
    ctx.moveTo(0, 1024);
    for (let x = 0; x <= 4096; x += 10) {
        let h = 0;
        h += Math.cos((x / 4096) * Math.PI * 4) * 60;
        h += Math.sin((x / 4096) * Math.PI * 10) * 25;
        h += Math.sin((x / 4096) * Math.PI * 22) * 10;
        ctx.lineTo(x, 970 - h);
    }
    ctx.lineTo(4096, 1024);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    // Repeat set to 1 so there's only 1 sun and the mountains tile perfectly 1:1
    tex.repeat.set(1, 1);
    return tex;
}

function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    
    if (currentWeather === 'summer') {
        grad.addColorStop(0, '#15803d');
        grad.addColorStop(1, '#166534');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = 'rgba(10,30,10,0.2)'; // subtle texture variation
    } else if (currentWeather === 'rain') {
        grad.addColorStop(0, '#064e3b'); // darker, muddy green
        grad.addColorStop(1, '#022c22');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = 'rgba(50,40,30,0.3)'; // mud puddles
    } else if (currentWeather === 'snow') {
        grad.addColorStop(0, '#f8fafc'); // crisp white snow
        grad.addColorStop(1, '#e2e8f0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = 'rgba(200,210,255,0.3)'; // icy sparkles
    } else if (currentWeather === 'night') {
        grad.addColorStop(0, '#052e16'); // dark forest green
        grad.addColorStop(1, '#022c22');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; // shadows
    }

    for (let i = 0; i < 60; i++) {
        ctx.fillRect(Math.random()*256, Math.random()*256, 2 + Math.random()*6, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(200, 200);
    return tex;
}

function createCurbTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ef4444'; // vibrant racing red
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#f8fafc'; // clean white
    ctx.fillRect(128, 0, 128, 64);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(120, 1);
    return tex;
}

function createLineTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff'; 
    ctx.fillRect(0, 0, 128, 64);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(80, 1);
    return tex;
}

function createStartLineTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(track.width / 20, 2);
    return tex;
}

// ---- Real Audio System ----
let audioListener = null;
let audioLoader = null;
let sounds = {
    engine: null,
    screech: null,
    nitro: null,
    crash: null,
    bgm: null
};

function playThud(intensity) {
    if (sounds.crash && sounds.crash.buffer && !sounds.crash.isPlaying) {
        sounds.crash.setVolume(intensity);
        sounds.crash.play();
    }
}

function initAudio() {
    if (audioListener) return;
    try {
        audioListener = new THREE.AudioListener();
        if (camera) camera.add(audioListener);
        audioLoader = new THREE.AudioLoader();

        Object.keys(sounds).forEach(key => {
            sounds[key] = new THREE.Audio(audioListener);
        });

        const loadSound = (key, path, loop = false, volume = 1.0) => {
            audioLoader.load(path, function(buffer) {
                sounds[key].setBuffer(buffer);
                sounds[key].setLoop(loop);
                sounds[key].setVolume(volume);
                if (key === 'bgm') sounds[key].play();
                if (key === 'engine') sounds[key].play();
            }, undefined, function(err) {
                console.warn(`Could not load audio file: ${path}. Please add real audio files to this directory for the full experience.`);
            });
        };

        // Load placeholders - drop real MP3s/WAVs into the assets/audio folder!
        loadSound('bgm', 'assets/audio/bgm.wav', true, 0.1);
        loadSound('engine', 'assets/audio/engine.wav', true, 0.2);
        loadSound('screech', 'assets/audio/screech.wav', false, 0.25);
        loadSound('nitro', 'assets/audio/nitro.wav', false, 0.4);
        loadSound('crash', 'assets/audio/crash.wav', false, 0.4);
        
    } catch(e) {
        console.error("Audio system init failed", e);
    }
}

function scheduleBGM() {}

// ---- Minimap System ----
function drawMinimap() {
    const canvas = document.getElementById('minimapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scale = 130 / (track.rx * 2); 
    
    // Draw radar grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < canvas.width; i += 20) {
        ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height);
    }
    for (let i = 0; i < canvas.height; i += 20) {
        ctx.moveTo(0, i); ctx.lineTo(canvas.width, i);
    }
    ctx.stroke();

    // Radar sweep
    const sweepAngle = (Date.now() / 600) % (Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 140, sweepAngle, sweepAngle + 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle + 0.6) * 140, cy + Math.sin(sweepAngle + 0.6) * 140);
    ctx.stroke();
    
    // Draw track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = (track.width * scale);
    ctx.beginPath();
    ctx.ellipse(cx, cy, track.rx * scale, track.ry * scale, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke(); // inner bright line
    
    // Draw cars as directional triangles
    allCars.forEach(c => {
        const mx = cx + c.x * scale;
        const my = cy + c.y * scale;
        
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(c.heading);
        
        if (c.isPlayer) {
            // Pulse glow for player
            const pulse = 1 + Math.sin(Date.now() / 150) * 0.2;
            ctx.shadowColor = '#0ff';
            ctx.shadowBlur = 10 * pulse;
            ctx.fillStyle = '#0ff';
            ctx.beginPath();
            ctx.moveTo(8 * pulse, 0);
            ctx.lineTo(-5 * pulse, -5 * pulse);
            ctx.lineTo(-3 * pulse, 0);
            ctx.lineTo(-5 * pulse, 5 * pulse);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.shadowColor = c.color;
            ctx.shadowBlur = 5;
            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(-4, -4);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-4, 4);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    });
}

function createEnvironmentMap() {
    const size = 128;
    const envCanvases = [];
    for (let i = 0; i < 6; i++) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        
        if (i === 2) { // Top (Sky)
            ctx.fillStyle = '#0ea5e9';
            ctx.fillRect(0,0,size,size);
        } else if (i === 3) { // Bottom (Ground)
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0,0,size,size);
        } else { // Sides (Horizon)
            const grad = ctx.createLinearGradient(0,0,0,size);
            grad.addColorStop(0, '#0ea5e9'); // sky
            grad.addColorStop(0.48, '#bae6fd'); // bright horizon
            grad.addColorStop(0.5, '#1e293b'); // ground
            grad.addColorStop(1, '#0f172a');
            ctx.fillStyle = grad;
            ctx.fillRect(0,0,size,size);
        }
        envCanvases.push(c);
    }
    const envMap = new THREE.CubeTexture(envCanvases);
    envMap.needsUpdate = true;
    return envMap;
}

// ---- Three.js Setup ----
let scene, camera, renderer, mainLight;
function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0284c7'); 
    scene.fog = new THREE.FogExp2('#0ea5e9', 0.00015); 
    scene.environment = createEnvironmentMap(); // Applies reflections to all metallic materials!

    // Custom GLB loading is restricted to the landing page only.
    window.f1CarModel = null;

    camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 4000);
    
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // ── ACES Filmic tone mapping — cinema-grade ──────
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05; // Balanced exposure to prevent blowout
    renderer.outputEncoding = THREE.sRGBEncoding;

    // Post-Processing — bloom tuned for cinematic glow (only brights bloom)
    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight),
        1.2,   // strength (more punch for highlights)
        0.8,   // radius (wider softer glow)
        0.85   // threshold (only truly bright pixels will glow)
    );
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // ── 3-Point Cinematic Lighting (Daytime) ───────────────────
    // 1. Ambient — lower intensity to preserve contrast and shadows
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    // 2. Key light — bright midday/afternoon sun
    mainLight = new THREE.DirectionalLight(0xfffaeb, 2.0); // increased for more contrast
    mainLight.position.set(300, 600, -400);  // high angle
    mainLight.castShadow = true;
    
    // Tighter shadow frustum (600x600 instead of 2400x2400) for much sharper shadows
    mainLight.shadow.camera.top    =  300;
    mainLight.shadow.camera.bottom = -300;
    mainLight.shadow.camera.left   = -300;
    mainLight.shadow.camera.right  =  300;
    
    // Smaller shadow map size for performance (2048 instead of 4096)
    mainLight.shadow.mapSize.width  = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0003;
    mainLight.shadow.normalBias = 0.02;
    scene.add(mainLight);
    scene.add(mainLight.target);

    // 3. Fill light — cool blue sky fill from opposite side
    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.7);
    rimLight.position.set(-300, 200, 300);
    rimLight.name = "rimLight";
    scene.add(rimLight);

    // 4. Ground bounce — subtle warm uplighting
    const groundLight = new THREE.HemisphereLight(0xffb060, 0x0a1520, 0.45);
    groundLight.name = "groundLight";
    scene.add(groundLight);

    // ── Skybox Cylinder ───────────────────────────────
    const skyGeo = new THREE.CylinderGeometry(3000, 3000, 1200, 32);
    const skyMat = new THREE.MeshBasicMaterial({ map: createSkyTexture(), side: THREE.BackSide, fog: false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.y = 200;
    scene.add(sky);

    // ── Ground ────────────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(12000, 12000);
    const groundMat = new THREE.MeshLambertMaterial({ map: createGrassTexture() });
    groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    
    initWeather();
}

function resize() { 
    if (camera && renderer) {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
        if (typeof composer !== 'undefined') composer.setSize(innerWidth, innerHeight);
    }
}
window.addEventListener('resize', resize);
// ---- Horizon Track Layouts & Vehicle Classes ----
const TRACK_LAYOUTS = {
    grand_prix: {
        name: "Grand Prix Serpent",
        width: 420,
        controlPoints: [
            new THREE.Vector3( 1400, 0,    0),
            new THREE.Vector3( 2000, 0,  900),
            new THREE.Vector3( 1100, 0, 1800),
            new THREE.Vector3(  200, 0, 1100),
            new THREE.Vector3( -400, 0, 1900),
            new THREE.Vector3(-1200, 0, 1300),
            new THREE.Vector3(-1800, 0,  500),
            new THREE.Vector3(-1100, 0, -500),
            new THREE.Vector3(-2000, 0,-1300),
            new THREE.Vector3(-1100, 0,-2000),
            new THREE.Vector3(    0, 0,-1300),
            new THREE.Vector3(  700, 0,-1900),
            new THREE.Vector3( 1600, 0,-1100)
        ]
    },
    canyon_run: {
        name: "Canyon Switchbacks",
        width: 400,
        controlPoints: [
            new THREE.Vector3( 1600, 0,    0),
            new THREE.Vector3( 2300, 0,  700),
            new THREE.Vector3( 1800, 0, 1700),
            new THREE.Vector3(  700, 0,  800),
            new THREE.Vector3( -100, 0, 1800),
            new THREE.Vector3(-1000, 0,  800),
            new THREE.Vector3(-2000, 0, 1700),
            new THREE.Vector3(-2300, 0,  100),
            new THREE.Vector3(-1400, 0,-1000),
            new THREE.Vector3(-2100, 0,-1800),
            new THREE.Vector3( -700, 0,-1100),
            new THREE.Vector3(  400, 0,-2100),
            new THREE.Vector3( 1200, 0,-1100)
        ]
    },
    tokyo_drift: {
        name: "Tokyo Expressway Ring",
        width: 460,
        controlPoints: [
            new THREE.Vector3( 1800, 0,    0),
            new THREE.Vector3( 1800, 0, 1400),
            new THREE.Vector3(  500, 0, 1400),
            new THREE.Vector3(  500, 0, 2200),
            new THREE.Vector3(-1000, 0, 2200),
            new THREE.Vector3(-1000, 0,  700),
            new THREE.Vector3(-2200, 0,  700),
            new THREE.Vector3(-2200, 0,-1200),
            new THREE.Vector3( -800, 0,-1200),
            new THREE.Vector3( -800, 0,-2200),
            new THREE.Vector3( 1200, 0,-2200),
            new THREE.Vector3( 1200, 0, -900)
        ]
    }
};

const CAR_CLASSES = {
    hypercar: {
        name: "Apex Horizon (Hypercar)",
        type: "hypercar",
        maxSpeed: 17.5,
        accel: 0.35,
        handling: 0.062,
        nitro: 1.6,
        description: "Ultra-low aerodynamic profile, active wings, extreme top speed."
    },
    jdm_drift: {
        name: "Kaze GT (JDM Drift Spec)",
        type: "jdm_drift",
        maxSpeed: 15.8,
        accel: 0.30,
        handling: 0.082,
        nitro: 1.9,
        description: "Widebody stance, aggressive GT wing, maximum drift angle control."
    },
    muscle: {
        name: "V8 Supercharger (Muscle)",
        type: "muscle",
        maxSpeed: 16.8,
        accel: 0.42,
        handling: 0.052,
        nitro: 2.2,
        description: "Raw V8 supercharged muscle, explosive launch acceleration."
    },
    offroad: {
        name: "Dune Buster (Rally Buggy)",
        type: "offroad",
        maxSpeed: 15.2,
        accel: 0.32,
        handling: 0.070,
        nitro: 1.7,
        description: "Elevated suspension, offroad tires, roll cage chassis."
    }
};

let currentCarClass = 'hypercar';
let currentTrackLayout = 'grand_prix';
let currentUnderglow = '#00f3ff';

// ---- Globals ----
let track = { cx: 0, cy: 0, rx: 1600, ry: 1000, width: 450 };
let trackMesh = null;
let checkpoints = [];
let CP_COUNT = 64;
let player;
let rivals = [];
let allCars = [];
let streetLights = [];
let particles = [];
let skidMarks = [];
let sparkParticles = [];
let raceStarted = false;
let gameOver = false;
let isPaused = false;
let isResuming = false;
let pauseTime = 0;
let countdown = 3;
let countdownTimer;
let animationFrameId;
let raceStartTime = 0;
let finishedCount = 0;
let cameraShake = 0;
let composer;

// ---- Weather System ----
let rainSystem = null;
let rainGeo = null;
let lightningLight = null;
const RAIN_COUNT = 5000;

function initWeather() {
    lightningLight = new THREE.PointLight(0xffffff, 0, 5000);
    lightningLight.position.set(0, 1000, 0);
    scene.add(lightningLight);

    rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 3000;
        positions[i * 3 + 1] = Math.random() * 1500;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 3000;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const rainMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 3.5,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    
    rainSystem = new THREE.Points(rainGeo, rainMat);
    scene.add(rainSystem);
}

function updateWeather() {
    if (!scene) return;

    const ambient = scene.children.find(c => c.isAmbientLight);
    const sunLight = scene.children.find(c => c.isDirectionalLight && c.intensity >= 0.5);
    const rimLight = scene.getObjectByName("rimLight");
    const groundLight = scene.getObjectByName("groundLight");

    if (currentWeather === 'rain') {
        rainSystem.visible = true;
        scene.fog.color.setHex(0x3C444E);
        scene.fog.density = 0.0006;
        rainSystem.material.color.setHex(0xaaaaaa);
        rainSystem.material.size = 2.0;
        
        if (ambient) ambient.intensity = 0.2;
        if (sunLight) sunLight.intensity = 0.5;
        if (rimLight) rimLight.intensity = 0.3;
        if (groundLight) groundLight.intensity = 0.1;
        
        // Fast falling rain
        const positions = rainGeo.attributes.position.array;
        for (let i = 0; i < RAIN_COUNT; i++) {
            positions[i * 3 + 1] -= 25; // fast drop speed
            if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 1000;
            
            if (camera) {
                if (positions[i * 3] < camera.position.x - 1500) positions[i * 3] += 3000;
                if (positions[i * 3] > camera.position.x + 1500) positions[i * 3] -= 3000;
                if (positions[i * 3 + 2] < camera.position.z - 1500) positions[i * 3 + 2] += 3000;
                if (positions[i * 3 + 2] > camera.position.z + 1500) positions[i * 3 + 2] -= 3000;
            }
        }
        rainGeo.attributes.position.needsUpdate = true;
        
        // Random Lightning
        if (Math.random() < 0.01) {
            lightningLight.intensity = 8 + Math.random() * 15;
            scene.background.setHex(0x8899aa);
        } else {
            lightningLight.intensity = Math.max(0, lightningLight.intensity - 1.0);
            if (lightningLight.intensity === 0) scene.background.setHex(0x3C444E);
        }
    } else if (currentWeather === 'snow') {
        rainSystem.visible = true;
        scene.fog.color.setHex(0xFFFAFA); // crisp white fog
        scene.fog.density = 0.00045; // dense snow fog
        rainSystem.material.color.setHex(0xffffff);
        rainSystem.material.size = 5.0; // larger flakes
        
        if (ambient) ambient.intensity = 0.4;
        if (sunLight) sunLight.intensity = 1.0;
        if (rimLight) rimLight.intensity = 0.5;
        if (groundLight) groundLight.intensity = 0.4;
        lightningLight.intensity = 0;
        
        // Slow drifting snow
        const positions = rainGeo.attributes.position.array;
        const time = Date.now() * 0.001;
        for (let i = 0; i < RAIN_COUNT; i++) {
            positions[i * 3 + 1] -= 5; // slow drop speed
            positions[i * 3] += Math.sin(time + i) * 2; // horizontal drift
            
            if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 1000;
            
            if (camera) {
                if (positions[i * 3] < camera.position.x - 1500) positions[i * 3] += 3000;
                if (positions[i * 3] > camera.position.x + 1500) positions[i * 3] -= 3000;
                if (positions[i * 3 + 2] < camera.position.z - 1500) positions[i * 3 + 2] += 3000;
                if (positions[i * 3 + 2] > camera.position.z + 1500) positions[i * 3 + 2] -= 3000;
            }
        }
        rainGeo.attributes.position.needsUpdate = true;
        scene.background.setHex(0x85CCDD); // icy blue horizon
    } else if (currentWeather === 'night') {
        rainSystem.visible = false;
        lightningLight.intensity = 0;
        scene.fog.color.setHex(0x020617);
        scene.fog.density = 0.0003;
        scene.background.setHex(0x020617);
        
        if (ambient) ambient.intensity = 0.08;
        if (sunLight) sunLight.intensity = 0.0;
        if (rimLight) rimLight.intensity = 0.15; // Moonlight
        if (groundLight) groundLight.intensity = 0.0;
    } else {
        // Summer
        rainSystem.visible = false;
        lightningLight.intensity = 0;
        scene.fog.color.setHex(0x87ceeb); // Light sky blue
        scene.fog.density = 0.0002;
        scene.background.setHex(0x87ceeb);
        
        if (ambient) ambient.intensity = 0.3;
        if (sunLight) sunLight.intensity = 1.2;
        
        if (rimLight) rimLight.intensity = 0.7;
        if (groundLight) groundLight.intensity = 0.45;
    }
    // Update street lights
    streetLights.forEach(light => {
        if (currentWeather === 'night') {
            light.intensity = 1.5; // bright track lights
        } else {
            light.intensity = 0;
        }
    });
}

let weatherCycleTime = 0; // 0 to 1 over the course of the race
function updateDynamicWeather() {
    if (!scene || !raceStarted) return;
    
    // progress weather over roughly 2 minutes (120000 ms)
    const elapsed = Date.now() - raceStartTime;
    weatherCycleTime = Math.min(elapsed / 120000, 1.0); 

    const ambient = scene.children.find(c => c.isAmbientLight);
    const sunLight = scene.children.find(c => c.isDirectionalLight && c.intensity >= 0.5);
    const rimLight = scene.getObjectByName("rimLight");
    const groundLight = scene.getObjectByName("groundLight");
    const skyMesh = scene.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry');
    const skyMat = skyMesh ? skyMesh.material : null;

    let fogColor = new THREE.Color();
    let skyColor = new THREE.Color();
    let sunColor = new THREE.Color();
    let ambientInt, sunInt, rimInt, groundInt;
    
    if (weatherCycleTime < 0.4) { // Summer
        let t = weatherCycleTime / 0.4;
        fogColor.setHex(0x87ceeb).lerp(new THREE.Color(0x3C444E), t);
        skyColor.setHex(0xffffff).lerp(new THREE.Color(0x555555), t);
        sunColor.setHex(0xfffaeb).lerp(new THREE.Color(0xffffff), t);
        ambientInt = 0.3 - (0.1 * t);
        sunInt = 1.2 - (0.7 * t);
        rimInt = 0.7 - (0.4 * t);
        groundInt = 0.45 - (0.35 * t);
        if(rainSystem) rainSystem.visible = false;
        if(lightningLight) lightningLight.intensity = 0;
    } else if (weatherCycleTime < 0.7) { // Rain transition
        let t = (weatherCycleTime - 0.4) / 0.3;
        fogColor.setHex(0x3C444E).lerp(new THREE.Color(0x020617), t);
        skyColor.setHex(0x555555).lerp(new THREE.Color(0x111111), t);
        sunColor.setHex(0xffffff).lerp(new THREE.Color(0x222222), t);
        ambientInt = 0.2 - (0.12 * t);
        sunInt = 0.5 - (0.5 * t);
        rimInt = 0.3 - (0.15 * t);
        groundInt = 0.1 - (0.1 * t);
        
        if (rainSystem) {
            rainSystem.visible = true;
            rainSystem.material.opacity = 0.6;
            // make it rain
            const positions = rainGeo.attributes.position.array;
            for (let i = 0; i < RAIN_COUNT; i++) {
                positions[i * 3 + 1] -= 25; 
                if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 1000;
                if (camera) {
                    if (positions[i * 3] < camera.position.x - 1500) positions[i * 3] += 3000;
                    if (positions[i * 3] > camera.position.x + 1500) positions[i * 3] -= 3000;
                    if (positions[i * 3 + 2] < camera.position.z - 1500) positions[i * 3 + 2] += 3000;
                    if (positions[i * 3 + 2] > camera.position.z + 1500) positions[i * 3 + 2] -= 3000;
                }
            }
            rainGeo.attributes.position.needsUpdate = true;
        }
        
        // Random Lightning
        if (lightningLight) {
            if (Math.random() < 0.01) {
                lightningLight.intensity = 8 + Math.random() * 15;
                fogColor.setHex(0x8899aa);
            } else {
                lightningLight.intensity = Math.max(0, lightningLight.intensity - 1.0);
            }
        }
    } else { // Night
        let t = Math.min((weatherCycleTime - 0.7) / 0.3, 1.0);
        fogColor.setHex(0x020617);
        skyColor.setHex(0x111111).lerp(new THREE.Color(0x020617), t);
        sunColor.setHex(0x222222).lerp(new THREE.Color(0x000000), t);
        ambientInt = 0.08;
        sunInt = 0.0;
        rimInt = 0.15;
        groundInt = 0.0;
        
        if (rainSystem) {
            // fade rain out
            rainSystem.material.opacity = Math.max(0, 0.6 - (t * 0.6));
            if (rainSystem.material.opacity === 0) rainSystem.visible = false;
            
            // falling rain still updates slightly to fade out gracefully
            if (rainSystem.visible) {
                 const positions = rainGeo.attributes.position.array;
                 for (let i = 0; i < RAIN_COUNT; i++) {
                     positions[i * 3 + 1] -= 25; 
                     if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 1000;
                 }
                 rainGeo.attributes.position.needsUpdate = true;
            }
        }
        if (lightningLight) lightningLight.intensity = 0;
    }
    
    if (scene.fog) scene.fog.color.copy(fogColor);
    if (scene.background) scene.background.copy(fogColor);
    if (skyMat) skyMat.color.copy(skyColor);
    if (ambient) ambient.intensity = ambientInt;
    if (sunLight) {
        sunLight.intensity = sunInt;
        sunLight.color.copy(sunColor);
    }
    if (rimLight) rimLight.intensity = rimInt;
    if (groundLight) groundLight.intensity = groundInt;
    
    // Update street lights at night
    streetLights.forEach(light => {
        light.intensity = weatherCycleTime > 0.6 ? (weatherCycleTime - 0.6) * 3.75 : 0; // ramps up to 1.5
    });
}

function buildTrack3D() {
    if (trackMesh) scene.remove(trackMesh);
    streetLights = [];
    trackMesh = new THREE.Group();

    const layout = TRACK_LAYOUTS[currentTrackLayout] || TRACK_LAYOUTS.grand_prix;
    const curve = new THREE.CatmullRomCurve3(layout.controlPoints, true, 'centripetal', 0.5);
    const N = 200;
    const points = curve.getSpacedPoints(N);
    const trackWidth = layout.width || 420;
    const halfW = trackWidth / 2;

    const asphaltMat = new THREE.MeshLambertMaterial({ color: '#0f172a' });
    const tireWallMat = new THREE.MeshLambertMaterial({ color: '#111111' });
    const innerWallMat = new THREE.MeshLambertMaterial({ color: '#0369a1' });
    const curbMat = new THREE.MeshLambertMaterial({ map: createCurbTexture() });

    // Build custom track ribbon mesh
    const ribbonGeo = new THREE.BufferGeometry();
    const pos = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= N; i++) {
        const pt = points[i % N];
        const nextPt = points[(i + 1) % N];
        const tangent = new THREE.Vector3().subVectors(nextPt, pt).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        const leftX = pt.x + normal.x * halfW;
        const leftZ = pt.z + normal.z * halfW;
        const rightX = pt.x - normal.x * halfW;
        const rightZ = pt.z - normal.z * halfW;

        pos.push(leftX, 0.5, leftZ);
        pos.push(rightX, 0.5, rightZ);

        uvs.push(0, i / N * 20);
        uvs.push(1, i / N * 20);

        if (i < N) {
            const row1 = i * 2;
            const row2 = (i + 1) * 2;
            indices.push(row1, row2, row1 + 1);
            indices.push(row1 + 1, row2, row2 + 1);
        }
    }

    ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ribbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    ribbonGeo.setIndex(indices);
    ribbonGeo.computeVertexNormals();

    const surfaceMesh = new THREE.Mesh(ribbonGeo, asphaltMat);
    surfaceMesh.receiveShadow = true;
    trackMesh.add(surfaceMesh);

    // Build Outer & Inner Barrier Walls & Streetlights
    const outerWallGeo = new THREE.BufferGeometry();
    const outerWallPos = [];
    const outerWallIndices = [];

    for (let i = 0; i <= N; i++) {
        const pt = points[i % N];
        const nextPt = points[(i + 1) % N];
        const tangent = new THREE.Vector3().subVectors(nextPt, pt).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        const outerX = pt.x + normal.x * (halfW + 15);
        const outerZ = pt.z + normal.z * (halfW + 15);

        outerWallPos.push(outerX, 0.5, outerZ);
        outerWallPos.push(outerX, 22, outerZ);

        if (i < N) {
            const r1 = i * 2;
            const r2 = (i + 1) * 2;
            outerWallIndices.push(r1, r2, r1 + 1);
            outerWallIndices.push(r1 + 1, r2, r2 + 1);
        }

        // Add streetlights every 6th node
        if (i % 6 === 0) {
            const poleGeo = new THREE.CylinderGeometry(2, 2, 80, 8);
            const poleMat = new THREE.MeshLambertMaterial({ color: '#1e293b' });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(outerX + normal.x * 20, 40, outerZ + normal.z * 20);

            const light = new THREE.SpotLight(0xfffaeb, 0, 1500, Math.PI / 3, 0.5, 1.2);
            light.position.set(0, 35, 10);

            const target = new THREE.Object3D();
            target.position.set(-normal.x * 100, -60, -normal.z * 100);
            pole.add(target);
            light.target = target;
            pole.add(light);
            trackMesh.add(pole);
            streetLights.push(light);
        }
    }

    outerWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerWallPos, 3));
    outerWallGeo.setIndex(outerWallIndices);
    outerWallGeo.computeVertexNormals();

    const outerWallMesh = new THREE.Mesh(outerWallGeo, tireWallMat);
    outerWallMesh.castShadow = true;
    outerWallMesh.receiveShadow = true;
    trackMesh.add(outerWallMesh);

    // Start Line
    const startPt = points[0];
    const startNext = points[1];
    const startTang = new THREE.Vector3().subVectors(startNext, startPt).normalize();
    const startMat = new THREE.MeshBasicMaterial({ map: createStartLineTexture(), transparent: true });
    const startMesh = new THREE.Mesh(new THREE.PlaneGeometry(trackWidth, 30), startMat);
    startMesh.rotation.x = -Math.PI / 2;
    startMesh.rotation.z = Math.atan2(startTang.z, startTang.x);
    startMesh.position.set(startPt.x, 1.2, startPt.z);
    trackMesh.add(startMesh);

    scene.add(trackMesh);
    addAudience();
}

function surfaceGrip(x, z) {
    if (!checkpoints || checkpoints.length === 0) return 1.0;
    let minDist = Infinity;
    for (let i = 0; i < checkpoints.length; i++) {
        const cp = checkpoints[i];
        const dx = x - cp.x;
        const dz = z - cp.y;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minDist) minDist = dist;
    }
    const layout = TRACK_LAYOUTS[currentTrackLayout] || TRACK_LAYOUTS.grand_prix;
    const halfWidth = (layout.width || 420) / 2;
    let grip = 1.0;
    if (minDist > halfWidth + 15) grip = 0.15; // Off-track grass penalty

    if (currentWeather === 'rain') grip *= 0.75;
    else if (currentWeather === 'snow') grip *= 0.6;

    return grip;
}

function formatTime(ms) {
    let d = new Date(ms);
    let m = d.getUTCMinutes().toString().padStart(2, '0');
    let s = d.getUTCSeconds().toString().padStart(2, '0');
    let ms1 = Math.floor(d.getUTCMilliseconds() / 100).toString();
    return `${m}:${s}.${ms1}`;
}

// ---- 3D Car Builder ----
function buildCarMesh(colorHex) {
    const car = new THREE.Group();

    if (window.f1CarModel) {
        const f1Mesh = window.f1CarModel.clone();
        
        f1Mesh.traverse(function(child) {
            if (child.isMesh) {
                if (child.name.includes("Chassis") || child.name.includes("Nose") || child.name.includes("Sidepods") || child.name.includes("Airbox")) {
                    child.material = child.material.clone();
                    child.material.color.set(colorHex);
                }
            }
        });
        
        car.add(f1Mesh);
        
        car.wheels = [];
        f1Mesh.traverse((child) => {
            if (child.name.includes("Wheel_F")) {
                car.wheels.push(child);
            }
        });

        const exhaust = new THREE.PointLight(0xffaa00, 0, 40);
        exhaust.position.set(0, 0.5, -2);
        car.add(exhaust);
        car.exhaustGlow = exhaust;

        car.rotation.y = Math.PI;
        return car;
    }

    // Enhanced physical materials for extreme realism and glossy paint
    var bodyMat = new THREE.MeshPhysicalMaterial({ color: colorHex, metalness: 0.6, roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.1 });
    var accentMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.7, roughness: 0.3 });
    var whiteStripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.2 });
    var trimMat = new THREE.MeshStandardMaterial({ color: 0x2ee6d6, emissive: 0x0fbfae, emissiveIntensity: 1.5, metalness: 0.8, roughness: 0.1 });
    var carbonMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.6 });
    var visorMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.0, metalness: 0.9, clearcoat: 1.0, clearcoatRoughness: 0.0 });
    var tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9, side: THREE.DoubleSide });
    var treadMat = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 1 });
    var rimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.1 });
    var discGlowMat = new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0xff4400, emissiveIntensity: 1.5, metalness: 0.9, roughness: 0.4 });
    var caliperMat = new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.4, roughness: 0.2 });
    var headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 });
    var tailMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xaa0000, emissiveIntensity: 0.6 });
    var numberMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    var neonMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, metalness: 0.1, roughness: 0.6 });
    var hubMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.9, roughness: 0.2 });

    function addMesh(group, geo, mat, x, y, z, castShadow) {
        var m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        if (castShadow !== false) m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
        return m;
    }

    // monocoque tub with white side stripe (livery)
    addMesh(car, new THREE.BoxGeometry(0.85, 0.32, 2.6), bodyMat, 0, 0, 0);
    addMesh(car, new THREE.BoxGeometry(0.87, 0.06, 2.56), whiteStripeMat, 0, 0.02, 0);
    addMesh(car, new THREE.BoxGeometry(0.87, 0.03, 2.56), trimMat, 0, -0.05, 0);

    // nose cone: smooth curved ellipsoid taper (natural aero shape, not boxy)
    var noseShape = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), bodyMat);
    noseShape.scale.set(0.82, 0.62, 1.55);
    noseShape.position.set(0, -0.05, -1.75);
    noseShape.castShadow = true; noseShape.receiveShadow = true;
    car.add(noseShape);
    addMesh(car, new THREE.SphereGeometry(0.1, 10, 8), accentMat, 0, -0.1, -2.55).scale.set(1, 0.7, 1.6);
    // camera pod bumps either side of nose (realism detail)
    addMesh(car, new THREE.BoxGeometry(0.06, 0.06, 0.12), accentMat, 0.28, 0.12, -1.9);
    addMesh(car, new THREE.BoxGeometry(0.06, 0.06, 0.12), accentMat, -0.28, 0.12, -1.9);

    // front wing: fixed main plane + endplates + footplate
    addMesh(car, new THREE.BoxGeometry(2.0, 0.04, 0.4), carbonMat, 0, -0.26, -2.4);
    var epGeo = new THREE.BoxGeometry(0.06, 0.32, 0.46);
    addMesh(car, epGeo, accentMat, 1.0, -0.13, -2.4);
    addMesh(car, epGeo, accentMat, -1.0, -0.13, -2.4);
    addMesh(car, new THREE.BoxGeometry(0.5, 0.02, 0.2), carbonMat, 1.0, -0.3, -2.35);
    addMesh(car, new THREE.BoxGeometry(0.5, 0.02, 0.2), carbonMat, -1.0, -0.3, -2.35);
    // cascade winglets above the endplates
    addMesh(car, new THREE.BoxGeometry(0.22, 0.02, 0.16), carbonMat, 1.0, -0.02, -2.35);
    addMesh(car, new THREE.BoxGeometry(0.22, 0.02, 0.16), carbonMat, -1.0, -0.02, -2.35);
    // pylons welding nose underside to the wing plane (closes the floating gap)
    addMesh(car, new THREE.BoxGeometry(0.05, 0.11, 0.05), accentMat, 0.28, -0.195, -2.32);
    addMesh(car, new THREE.BoxGeometry(0.05, 0.11, 0.05), accentMat, -0.28, -0.195, -2.32);

    // ACTIVE AERO: hinged front flap group (2026 X-mode/Z-mode). Hinge sits at the flap's leading edge.
    var frontFlapGroup = new THREE.Group();
    frontFlapGroup.position.set(0, -0.21, -2.44);
    var ffMain = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.16), whiteStripeMat);
    ffMain.position.set(0, 0, -0.06);
    ffMain.castShadow = true; ffMain.receiveShadow = true;
    frontFlapGroup.add(ffMain);
    var ffGap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.14), carbonMat);
    ffGap.position.set(0, 0.05, -0.13);
    ffGap.castShadow = true; ffGap.receiveShadow = true;
    frontFlapGroup.add(ffGap);
    car.add(frontFlapGroup);
    car.frontFlapGroup = frontFlapGroup;

    // bargeboards ahead of sidepods (turning vanes)
    addMesh(car, new THREE.BoxGeometry(0.05, 0.22, 0.4), carbonMat, 0.5, -0.14, -1.1);
    addMesh(car, new THREE.BoxGeometry(0.05, 0.22, 0.4), carbonMat, -0.5, -0.14, -1.1);
    // small in-washing turning vanes routing front-tire wake toward the floor (2026-style)
    var vaneGeo = new THREE.BoxGeometry(0.03, 0.14, 0.22);
    var vane1 = new THREE.Mesh(vaneGeo, carbonMat);
    vane1.position.set(0.72, -0.2, -1.35);
    vane1.rotation.y = 0.3;
    vane1.castShadow = true;
    car.add(vane1);
    var vane2 = vane1.clone();
    vane2.position.x = -0.72;
    vane2.rotation.y = -0.3;
    car.add(vane2);

    // sidepods with inlet detail
    var podGeo = new THREE.BoxGeometry(0.5, 0.34, 1.3);
    addMesh(car, podGeo, bodyMat, 0.62, -0.02, -0.1);
    addMesh(car, podGeo, bodyMat, -0.62, -0.02, -0.1);
    // curved aero shoulder blending the sidepod's leading edge
    [0.62, -0.62].forEach(function (xs) {
        var shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bodyMat);
        shoulder.scale.set(1, 0.72, 1.15);
        shoulder.position.set(xs, -0.02, -0.72);
        shoulder.castShadow = true; shoulder.receiveShadow = true;
        car.add(shoulder);
    });
    var inletGeo = new THREE.BoxGeometry(0.06, 0.22, 0.5);
    addMesh(car, inletGeo, accentMat, 0.86, -0.02, -0.55);
    addMesh(car, inletGeo, accentMat, -0.86, -0.02, -0.55);
    // cooling louvers on the sidepod tops
    var louverGeo = new THREE.BoxGeometry(0.4, 0.01, 0.04);
    [0.15, 0.28, 0.41].forEach(function (zo) {
        addMesh(car, louverGeo, accentMat, 0.62, 0.15, -0.1 + zo);
        addMesh(car, louverGeo, accentMat, -0.62, 0.15, -0.1 + zo);
    });
    // floor edge strips (ground-effect floor lip)
    addMesh(car, new THREE.BoxGeometry(0.08, 0.02, 2.2), accentMat, 0.9, -0.28, 0.2);
    addMesh(car, new THREE.BoxGeometry(0.08, 0.02, 2.2), accentMat, -0.9, -0.28, 0.2);
    // floor edge fences (vortex-generating strakes, real ground-effect detail)
    var fenceGeo = new THREE.BoxGeometry(0.1, 0.09, 0.02);
    [-0.7, -0.2, 0.3, 0.8].forEach(function (zf) {
        addMesh(car, fenceGeo, accentMat, 0.92, -0.22, zf);
        addMesh(car, fenceGeo, accentMat, -0.92, -0.22, zf);
    });

    // halo (fuller loop) + mirrors
    var haloRing = addMesh(car, new THREE.TorusGeometry(0.29, 0.028, 8, 20, Math.PI * 1.5), accentMat, 0, 0.42, -0.5);
    haloRing.rotation.x = Math.PI / 2;
    haloRing.rotation.z = Math.PI * 0.75;
    addMesh(car, new THREE.BoxGeometry(0.05, 0.35, 0.05), accentMat, 0, 0.24, -0.78);
    addMesh(car, new THREE.BoxGeometry(0.05, 0.3, 0.05), accentMat, 0.2, 0.28, -0.35);

    var mirrorStalkGeo = new THREE.BoxGeometry(0.04, 0.2, 0.04);
    var mirrorHeadGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
    [0.55, -0.55].forEach(function (side) {
        addMesh(car, mirrorStalkGeo, accentMat, side, 0.24, -0.7);
        addMesh(car, mirrorHeadGeo, accentMat, side, 0.35, -0.78);
    });

    // cockpit rim, visor, headrest, driver number
    addMesh(car, new THREE.BoxGeometry(0.5, 0.14, 0.6), carbonMat, 0, 0.2, -0.35);
    addMesh(car, new THREE.BoxGeometry(0.3, 0.1, 0.2), visorMat, 0, 0.24, -0.55);
    addMesh(car, new THREE.BoxGeometry(0.34, 0.22, 0.3), bodyMat, 0, 0.18, 0.2);
    var headrestCap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), bodyMat);
    headrestCap.scale.set(1, 0.6, 0.9);
    headrestCap.position.set(0, 0.3, 0.2);
    headrestCap.castShadow = true; headrestCap.receiveShadow = true;
    car.add(headrestCap);
    addMesh(car, new THREE.PlaneGeometry(0.16, 0.16), numberMat, 0.44, 0.06, 0.15).rotation.y = Math.PI / 2;
    addMesh(car, new THREE.PlaneGeometry(0.16, 0.16), numberMat, -0.44, 0.06, 0.15).rotation.y = -Math.PI / 2;

    // engine cover, shark fin, air intake snorkel
    addMesh(car, new THREE.BoxGeometry(0.6, 0.28, 1.0), bodyMat, 0, 0.06, 0.8);
    var engineDome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
    engineDome.scale.set(0.85, 0.75, 1.5);
    engineDome.position.set(0, 0.2, 0.8);
    engineDome.castShadow = true; engineDome.receiveShadow = true;
    car.add(engineDome);
    addMesh(car, new THREE.BoxGeometry(0.06, 0.3, 0.9), trimMat, 0, 0.28, 0.85);
    var airbox = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
    airbox.scale.set(0.9, 1.1, 1.3);
    airbox.position.set(0, 0.38, 0.1);
    airbox.castShadow = true; airbox.receiveShadow = true;
    car.add(airbox);

    // rear wing: fixed main plane + endplates on pylons
    var pylonGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
    addMesh(car, pylonGeo, accentMat, 0.35, 0.4, 1.55);
    addMesh(car, pylonGeo, accentMat, -0.35, 0.4, 1.55);
    addMesh(car, new THREE.BoxGeometry(1.05, 0.05, 0.32), carbonMat, 0, 0.62, 1.55);
    var rwEpGeo = new THREE.BoxGeometry(0.04, 0.42, 0.4);
    addMesh(car, rwEpGeo, accentMat, 0.52, 0.5, 1.55);
    addMesh(car, rwEpGeo, accentMat, -0.52, 0.5, 1.55);
    // endplate serrations (real cars use these to bleed turbulent wake air)
    var serrGeo = new THREE.BoxGeometry(0.03, 0.05, 0.1);
    [0.44, 0.5, 0.56, 0.62].forEach(function (yy) {
        var serr = new THREE.Mesh(serrGeo, accentMat);
        serr.rotation.z = 0.4;
        serr.position.set(0.53, yy, 1.72);
        serr.castShadow = true;
        car.add(serr);
        var serr2 = serr.clone();
        serr2.position.x = -0.53;
        car.add(serr2);
    });

    // beam wing: small curved plane bridging the diffuser and main rear wing
    var beamWing = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.03, 0.12), carbonMat);
    beamWing.position.set(0, 0.02, 1.62);
    beamWing.rotation.x = -0.15;
    beamWing.castShadow = true; beamWing.receiveShadow = true;
    car.add(beamWing);
    var beamPylonGeo = new THREE.BoxGeometry(0.03, 0.14, 0.03);
    addMesh(car, beamPylonGeo, accentMat, 0.3, -0.06, 1.6);
    addMesh(car, beamPylonGeo, accentMat, -0.3, -0.06, 1.6);

    // ACTIVE AERO: hinged rear flap group (2026 X-mode/Z-mode). Hinge at the flap's front edge.
    var rearFlapGroup = new THREE.Group();
    rearFlapGroup.position.set(0, 0.7, 1.56);
    var rfMain = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.14), carbonMat);
    rfMain.position.set(0, 0, 0.06);
    rfMain.castShadow = true; rfMain.receiveShadow = true;
    rearFlapGroup.add(rfMain);
    var rfLine = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.03, 0.1), whiteStripeMat);
    rfLine.position.set(0, 0, 0.12);
    rfLine.castShadow = true; rfLine.receiveShadow = true;
    rearFlapGroup.add(rfLine);
    car.add(rearFlapGroup);
    car.rearFlapGroup = rearFlapGroup;

    // diffuser with fins + rear crash structure
    addMesh(car, new THREE.BoxGeometry(0.9, 0.1, 0.3), accentMat, 0, -0.16, 1.35);
    var finGeo = new THREE.BoxGeometry(0.03, 0.08, 0.28);
    for (var f = -0.35; f <= 0.35; f += 0.14) {
        addMesh(car, finGeo, accentMat, f, -0.14, 1.36);
    }
    addMesh(car, new THREE.BoxGeometry(0.25, 0.25, 0.12), bodyMat, 0, 0.02, 1.68);
    var tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 10), bodyMat);
    tailCone.rotation.x = Math.PI / 2;
    tailCone.position.set(0, 0.03, 1.82);
    tailCone.castShadow = true; tailCone.receiveShadow = true;
    car.add(tailCone);
    // rain light on the crash structure
    addMesh(car, new THREE.BoxGeometry(0.06, 0.06, 0.03), tailMat, 0, 0.16, 1.72);

    // lights
    addMesh(car, new THREE.BoxGeometry(0.1, 0.06, 0.06), headMat, 0.2, 0.02, -2.5);
    addMesh(car, new THREE.BoxGeometry(0.1, 0.06, 0.06), headMat, -0.2, 0.02, -2.5);
    addMesh(car, new THREE.BoxGeometry(0.1, 0.06, 0.04), tailMat, 0.22, 0.06, 1.42);
    addMesh(car, new THREE.BoxGeometry(0.1, 0.06, 0.04), tailMat, -0.22, 0.06, 1.42);

    car.flapAngle = 0;

    // ---------- wheels with rims, discs, calipers, suspension arms ----------
    car.wheels = [];
    car.allWheels = [];
    var wheelPositions = [
        { x: 0.95, z: -1.7, w: 0.32, r: 0.42, front: true },
        { x: -0.95, z: -1.7, w: 0.32, r: 0.42, front: true },
        { x: 1.05, z: 1.15, w: 0.36, r: 0.46, front: false },
        { x: -1.05, z: 1.15, w: 0.36, r: 0.46, front: false }
    ];

    wheelPositions.forEach(function (p) {
        var wheel = new THREE.Group();

        var tire = addMesh(wheel, new THREE.CylinderGeometry(p.r, p.r, p.w, 28, 1, true), tireMat, 0, 0, 0);
        tire.rotation.z = Math.PI / 2;

        [p.w * 0.5, -p.w * 0.5].forEach(function (side) {
            var sidewall = addMesh(wheel, new THREE.RingGeometry(p.r * 0.58, p.r, 28), tireMat, side, 0, 0);
            sidewall.rotation.y = Math.PI / 2;
        });

        [0.3, -0.3].forEach(function (side) {
            var ring = new THREE.Mesh(new THREE.TorusGeometry(p.r - 0.01, 0.012, 6, 28), treadMat);
            ring.rotation.y = Math.PI / 2;
            ring.position.set(side * p.w * 0.5, 0, 0);
            wheel.add(ring);
        });
        
        var stripe = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.82, 0.015, 6, 28), neonMat);
        stripe.rotation.y = Math.PI / 2;
        stripe.position.set(p.w * 0.51, 0, 0);
        wheel.add(stripe);

        var hub = addMesh(wheel, new THREE.CylinderGeometry(p.r * 0.16, p.r * 0.16, p.w + 0.03, 12), hubMat, 0, 0, 0);
        hub.rotation.z = Math.PI / 2;
        for (var s = 0; s < 7; s++) {
            var ang = (s / 7) * Math.PI * 2;
            var spoke = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.9, 0.035, 0.02), rimMat);
            spoke.position.set(0, Math.sin(ang) * p.r * 0.32, Math.cos(ang) * p.r * 0.32);
            spoke.rotation.x = ang;
            wheel.add(spoke);
        }
        var rimRing = addMesh(wheel, new THREE.TorusGeometry(p.r * 0.56, 0.025, 8, 20), rimMat, 0, 0, 0);
        rimRing.rotation.y = Math.PI / 2;

        var disc = addMesh(wheel, new THREE.CylinderGeometry(p.r * 0.4, p.r * 0.4, 0.03, 16), discGlowMat, 0, 0, 0);
        disc.rotation.z = Math.PI / 2;
        var caliper = addMesh(wheel, new THREE.BoxGeometry(0.05, p.r * 0.5, p.r * 0.3), caliperMat, 0, p.r * 0.35, 0);
        caliper.userData.fixed = true;

        var wheelLocalY = p.r - 0.42;
        wheel.position.set(p.x, wheelLocalY, p.z);
        car.add(wheel);
        
        car.allWheels.push(wheel);
        if (p.front) {
            car.wheels.push(wheel);
        }

        var armGeo = new THREE.BoxGeometry(Math.abs(p.x) - 0.35, 0.025, 0.025);
        var sign = p.x > 0 ? 1 : -1;
        [wheelLocalY + 0.09, wheelLocalY - 0.06].forEach(function (yOff) {
            var arm = new THREE.Mesh(armGeo, accentMat);
            arm.position.set(sign * (0.35 + (Math.abs(p.x) - 0.35) / 2), yOff, p.z);
            arm.castShadow = true;
            car.add(arm);
        });
    });

    // Add Underglow Neon
    var underglow = new THREE.PointLight(colorHex, 1.5, 15);
    underglow.position.set(0, -0.5, 0);
    car.add(underglow);

    // Add actual exhaust pipes and glow
    var exhaustMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.8 });
    addMesh(car, new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8), exhaustMat, 0.15, 0.15, 1.85).rotation.x = Math.PI / 2;
    addMesh(car, new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8), exhaustMat, -0.15, 0.15, 1.85).rotation.x = Math.PI / 2;

    var exhaustGlow = new THREE.PointLight(0xffaa00, 0, 8);
    exhaustGlow.position.set(0, 0.15, 2.0);
    car.add(exhaustGlow);
    car.exhaustGlow = exhaustGlow;

    car.position.y = 0.42 * 9.5; 
    car.scale.set(9.5, 9.5, 9.5);
    
    // In our physics engine, +Z is forward and +X is right, 
    // but this car model was built with -Z being forward.
    car.rotation.y = Math.PI;

    return car;
}

// ---- Car class ----
class Car {
    constructor(x, z, angle, color, isPlayer) {
        this.x = x; this.y = z; // 2D y is mapped to 3D z
        this.angle = angle; this.heading = angle; 
        this.color = color; this.isPlayer = isPlayer;
        this.vx = 0; this.vy = 0; 
        this.drift = 0; this.nitro = 100; this.nitroActive = 0; this.nitroCooldown = 0;
        this.lap = 1; this.cpIndex = 1; this.finished = false;
        this.finishTime = null; this.driftTime = 0; this.slipAngle = 0;
        this.spinOutTimer = 0; this.draftBoost = 0;
        // Phase 5: Tire wear (1.0 = new, 0.0 = destroyed)
        this.tireWear = 1.0;
        // Phase 6: Drift scoring
        this.driftScore = 0;
        this.driftCombo = 1;
        this.driftComboTimer = 0;
        this.activeDriftPoints = 0;

        
        if (this.isPlayer) {
            this.speed = 0; 
            // Player F1 is balanced for better control
            this.maxSpeed = 20.5; 
            this.accel = 0.165; 
            this.turnSpeed = 0.085;
            this.strategy = 'player';
        } else {
            this.speed = 0;
            if (color === '#ff003c') { // Aggressive
                this.strategy = 'aggro';
                this.maxSpeed = 20.5; this.accel = 0.160; this.turnSpeed = 0.085;
            } else if (color === '#ffea00') { // Speedster
                this.strategy = 'speedster';
                this.maxSpeed = 21.5; this.accel = 0.150; this.turnSpeed = 0.080;
            } else if (color === '#9d00ff') { // Technical
                this.strategy = 'technical';
                this.maxSpeed = 20.0; this.accel = 0.170; this.turnSpeed = 0.095;
            } else {
                this.strategy = 'balanced';
                this.maxSpeed = 20.2; this.accel = 0.165; this.turnSpeed = 0.085;
            }
        }
        
        // 3D Mesh
        this.mesh = buildCarMesh(color);
        scene.add(this.mesh);

        // Headlights removed in favor of track street lights
    }

    update(input) {
        let accel = 0, steer = 0, brake = false, nitroKey = false;
        
        if (this.finished) {
            if (this.isPlayer && this.finishRank === 1) {
                // EPIC VICTORY DONUTS
                accel = 1;
                steer = -1.0; // Hard left steer for donuts
                brake = false;
            } else {
                brake = true;
                if (Math.abs(this.speed) < 0.5) {
                    this.speed = 0; this.vx = 0; this.vy = 0;
                    // Snap to assigned post-race grid slot to prevent overlapping
                    this.x = track.rx + (this.finishRank % 2 === 1 ? -40 : 40);
                    this.y = (this.finishRank <= 2 ? 150 : 60);
                    this.heading = Math.PI / 2;
                    this.angle = this.heading;
                }
            }
        } else if (this.spinOutTimer > 0) {
            this.spinOutTimer--;
            this.heading += 0.2; // Rapid spinning
            accel = 0;
            steer = 0;
            brake = true;
            this.speed *= 0.90; // Lose speed fast
        } else if (this.isPlayer) {
            accel = input.up ? 1 : (input.down ? -0.6 : 0);
            steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
            brake = input.brake;
            nitroKey = input.nitro && this.nitro > 0 && this.nitroCooldown <= 0;
        } else {
            // Competitive F1 AI - Optimal Racing Line
            const rawTarget = checkpoints[this.cpIndex];
            // Offset target towards the track center (0,0) to cut the corner
            const len = Math.hypot(rawTarget.x, rawTarget.y);
            const insideFactor = 0.35; // Cut inside by 35% of track width
            const targetX = rawTarget.x - (rawTarget.x / len) * (track.width * insideFactor);
            const targetY = rawTarget.y - (rawTarget.y / len) * (track.width * insideFactor);
            
            const dx = targetX - this.x, dy = targetY - this.y;
            const targetAngle = Math.atan2(dy, dx);
            let diff = targetAngle - this.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            
            // Overtaking & Blocking depending on strategy
            let avoidSteer = 0;
            for (let c of allCars) {
                if (c === this || c.finished) continue;
                let cdx = c.x - this.x;
                let cdy = c.y - this.y;
                let dist = Math.hypot(cdx, cdy);
                if (dist < 100) {
                    let angleToCar = Math.atan2(cdy, cdx);
                    let angleDiff = angleToCar - this.heading;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    
                    if (this.strategy === 'aggro') {
                        // Highly aggressive blocking and overtaking
                        if (Math.abs(angleDiff) < 0.8 && this.speed > c.speed) {
                            avoidSteer = angleDiff > 0 ? -1.0 : 1.0; 
                        } else if (Math.abs(angleDiff) > 2.0 && c.speed > this.speed) {
                            avoidSteer = angleDiff > 0 ? 0.6 : -0.6; 
                        }
                    } else if (this.strategy === 'speedster') {
                        // Only focuses on overtaking smoothly, doesn't try to block
                        if (Math.abs(angleDiff) < 0.5 && this.speed > c.speed) {
                            avoidSteer = angleDiff > 0 ? -0.5 : 0.5; 
                        }
                    } else if (this.strategy === 'technical') {
                        // Very clean overtakes, no erratic blocking
                        if (Math.abs(angleDiff) < 0.5 && this.speed > c.speed) {
                            avoidSteer = angleDiff > 0 ? -0.6 : 0.6; 
                        } else if (Math.abs(angleDiff) > 2.5 && c.speed > this.speed) {
                            avoidSteer = angleDiff > 0 ? 0.2 : -0.2; 
                        }
                    } else {
                        // Balanced
                        if (Math.abs(angleDiff) < 0.5 && this.speed > c.speed) {
                            avoidSteer = angleDiff > 0 ? -0.8 : 0.8;
                        } else if (Math.abs(angleDiff) > 2.5 && c.speed > this.speed) {
                            avoidSteer = angleDiff > 0 ? 0.4 : -0.4;
                        }
                    }
                }
            }
            
            let steerMult = this.strategy === 'technical' ? 3.0 : (this.strategy === 'aggro' ? 2.0 : 2.5);
            steer = Math.max(-1, Math.min(1, (diff * steerMult) + avoidSteer));
            accel = 1;

            // Rubber-banding: tough competition but player should win
            const player = allCars.find(c => c.isPlayer);
            if (player) {
                let myProg = this.lap * 1000 + this.cpIndex;
                let pProg = player.lap * 1000 + player.cpIndex;
                let progDiff = myProg - pProg;

                if (progDiff > 0) {
                    // AI is ahead
                    if (this.lap >= 3) {
                        accel = 0.85; // Final lap, let player catch up and win
                        this.maxSpeed = Math.min(this.maxSpeed, 19.5);
                    } else {
                        accel = 0.95; // Keep it close
                        this.maxSpeed = Math.min(this.maxSpeed, 20.2);
                    }
                } else if (progDiff < -5) {
                    // AI is far behind, speed them up!
                    accel = 1.15;
                    this.maxSpeed = Math.max(this.maxSpeed, 21.5);
                } else if (progDiff < 0) {
                    // Slightly behind
                    accel = 1.05;
                }
            }

            let brakeThreshold = this.strategy === 'speedster' ? 1.2 : (this.strategy === 'technical' ? 0.7 : 0.9);
            if (Math.abs(diff) > brakeThreshold) accel = 0.4;
        }

        if (this.currentSteer === undefined) this.currentSteer = 0;
        // Smooth out the steering input (lerp)
        this.currentSteer += (steer - this.currentSteer) * 0.15;
        steer = this.currentSteer;

        // Phase 5: Tire wear reduces effective grip
        const basegrip = surfaceGrip(this.x, this.y);
        const wearFactor = 0.7 + this.tireWear * 0.3; // goes from 70% to 100% grip
        const grip = basegrip * wearFactor;
        

        if (grip < 0.7 && Math.abs(this.speed) > 2 && Math.random() < 0.4) {
            addParticle3D(this.x, this.y, '#654321');
        }

        if (this.nitroCooldown > 0) {
            this.nitroCooldown--;
            if (this.nitroCooldown <= 0) this.nitro = 100;
        }

        if (nitroKey) { 
            this.nitro -= (100 / 420); 
            this.nitroActive = 6; 
            if (this.nitro <= 0) { 
                this.nitro = 0; 
                this.nitroCooldown = 600; 
            } 
        }
        const boost = (this.nitroActive > 0 ? 1.6 : 1) + (this.draftBoost > 0 ? 0.1 : 0);
        if (this.draftBoost > 0) this.draftBoost--;
        if (this.draftBoost > 0) this.draftBoost--;
        if (this.nitroActive > 0) {
            this.nitroActive--;
            addFlameParticle(this.x - Math.cos(this.heading)*25, this.y - Math.sin(this.heading)*25, this.heading);
            if (this.isPlayer) {
                if (!this.shockwaveFrame) this.shockwaveFrame = 0;
                this.shockwaveFrame++;
                if (this.shockwaveFrame % 5 === 0) addShockwaveParticle(this.x - Math.cos(this.heading)*22, this.y - Math.sin(this.heading)*22, this.heading);
            }
        }

        this.speed += accel * this.accel * boost;
        if (brake) {
            this.speed *= 0.95; // Handbrake slows car down but allows slide
        } else if (accel === 0) {
            this.speed *= 0.985; // Coasting
        }
        this.speed = Math.max(-this.maxSpeed * 0.5, Math.min(this.maxSpeed * boost, this.speed));

        const isDonut = this.finished && this.isPlayer && this.finishRank === 1;
        
        let currentTurnSpeed = this.turnSpeed;
        if (isDonut) {
            // Spin much faster and cap forward speed so we don't hit the wall!
            currentTurnSpeed *= 5; 
            if (this.speed > 6) this.speed *= 0.9;
        }
        
        const turnFactor = (Math.abs(this.speed) / this.maxSpeed) * currentTurnSpeed;
        this.heading += steer * turnFactor * Math.sign(this.speed || 1);

        if (Math.abs(steer) > 0.5) {
            this.speed *= 0.98;
        }

        const engineVx = Math.cos(this.heading) * this.speed;
        const engineVy = Math.sin(this.heading) * this.speed;

        const steerHard = (Math.abs(steer) > 0.5 || brake) && Math.abs(this.speed) > 4;
        
        // When steering hard, lower the grip so the car slides (drifts). 
        // For victory donuts, lower it even further for continuous spins.
        const gripMultiplier = isDonut ? 0.08 : (steerHard ? 0.15 : 0.60);
        const gripFactor = grip * gripMultiplier;
        
        this.vx += (engineVx - this.vx) * Math.min(1, gripFactor + 0.02);
        this.vy += (engineVy - this.vy) * Math.min(1, gripFactor + 0.02);
        this.vx *= 0.985; this.vy *= 0.985; // Air resistance and friction

        const velAngle = Math.atan2(this.vy, this.vx);
        let slip = velAngle - this.heading;
        while (slip > Math.PI) slip -= Math.PI * 2;
        while (slip < -Math.PI) slip += Math.PI * 2;
        this.slipAngle = slip;
        this.angle = this.heading;

        const drifting = (steerHard || isDonut) && grip > 0.5;
        if (drifting) { 
            this.driftTime++; 
            if (this.driftTime > 15 && this.isPlayer && this.nitroCooldown <= 0) this.nitro = Math.min(100, this.nitro + 0.6); 
            
            // Phase 5: Degrade tire wear faster when drifting
            this.tireWear = Math.max(0, this.tireWear - 0.00012);

            // Phase 6: Drift scoring (player only)
            if (this.isPlayer && this.driftTime > 5) {
                const pts = Math.abs(this.speed) * this.driftCombo * 0.15;
                this.activeDriftPoints += pts;
                this.driftComboTimer = 60; // reset 1s combo window
            }
            
            let pColor = 0x888888;
            if (currentWeather === 'rain') pColor = 0xdddddd; // Water spray
            if (currentWeather === 'snow') pColor = 0xffffff; // Snow spray
            
            // Smoke / spray particles
            addSmokeParticle(this.x - Math.cos(this.heading)*15, this.y - Math.sin(this.heading)*15, pColor);
            
            // Generate skid marks!
            // Only on track surface (where grip isn't exactly 0.5 from grass)
            if (surfaceGrip(this.x, this.y) > 0.5 && currentWeather === 'summer') {
                // We emit left and right rear tire skid marks
                let rightDirX = Math.cos(this.heading + Math.PI/2);
                let rightDirZ = Math.sin(this.heading + Math.PI/2);
                let backDist = 12;
                let sideDist = 5;
                
                let rearX = this.x - Math.cos(this.heading)*backDist;
                let rearZ = this.y - Math.sin(this.heading)*backDist;
                
                if (Math.random() > 0.3) {
                    addSkidMark(rearX + rightDirX*sideDist, rearZ + rightDirZ*sideDist, this.heading);
                    addSkidMark(rearX - rightDirX*sideDist, rearZ - rightDirZ*sideDist, this.heading);
                }
            }
        } else {
            this.driftTime = 0;
        }

        // Phase 5: Slow tire wear even while just driving (heat cycles)
        this.tireWear = Math.max(0, this.tireWear - 0.000015);

        // Phase 6: Decay drift combo timer and bank points when combo ends
        if (this.isPlayer && this.driftComboTimer > 0) {
            this.driftComboTimer--;
            if (this.driftComboTimer === 0) {
                if (this.activeDriftPoints > 15) {
                    this.driftScore += Math.round(this.activeDriftPoints);
                    this.driftCombo = Math.min(8, this.driftCombo + 0.5);
                    showDriftScorePopup(Math.round(this.activeDriftPoints), this.driftCombo);
                } else {
                    this.driftCombo = Math.max(1, this.driftCombo - 0.5);
                }
                this.activeDriftPoints = 0;
            }
        }

        if (!this.isPlayer && !nitroKey && Math.random() < 0.01 && this.nitro > 30) { this.nitroActive = 6; this.nitro -= 25; }
        if (!this.isPlayer) this.nitro = Math.min(100, this.nitro + 0.3);

        this.x += this.vx; this.y += this.vy;

        const theta = Math.atan2(this.y, this.x);
        const centerR = 1 / Math.sqrt(Math.pow(Math.cos(theta) / track.rx, 2) + Math.pow(Math.sin(theta) / track.ry, 2));

        if (isDonut) {
            // Pull to the inside edge of the track so AI cars can pass without clipping
            const targetR = centerR - track.width / 3;
            const targetX = Math.cos(theta) * targetR;
            const targetY = Math.sin(theta) * targetR;
            this.x += (targetX - this.x) * 0.03;
            this.y += (targetY - this.y) * 0.03;
        }
        const currentR = Math.hypot(this.x, this.y);
        const maxR = centerR + track.width / 2 - 12;
        const minR = centerR - track.width / 2 + 12;
        
        if (currentR > maxR) {
            this.x = Math.cos(theta) * maxR;
            this.y = Math.sin(theta) * maxR;
            const dot = this.vx * (-Math.cos(theta)) + this.vy * (-Math.sin(theta));
            if (dot < 0) {
                this.vx = this.vx - 2 * dot * (-Math.cos(theta));
                this.vy = this.vy - 2 * dot * (-Math.sin(theta));
                this.vx *= 0.6; this.vy *= 0.6;
                this.speed *= 0.6;
                if (Math.abs(this.speed) > 2) {
                    if (this.isPlayer) {
                        cameraShake = Math.min(20, cameraShake + Math.abs(this.speed));
                        if (typeof playThud === 'function') playThud(Math.min(1.0, Math.abs(this.speed) / 5));
                    }
                    if (typeof createSparks === 'function') createSparks(this.x, this.y);
                }
            }
        } else if (currentR < minR) {
            this.x = Math.cos(theta) * minR;
            this.y = Math.sin(theta) * minR;
            const dot = this.vx * Math.cos(theta) + this.vy * Math.sin(theta);
            if (dot < 0) {
                this.vx = this.vx - 2 * dot * Math.cos(theta);
                this.vy = this.vy - 2 * dot * Math.sin(theta);
                this.vx *= 0.6; this.vy *= 0.6;
                this.speed *= 0.6;
                if (Math.abs(this.speed) > 2) {
                    if (this.isPlayer) {
                        cameraShake = Math.min(20, cameraShake + Math.abs(this.speed));
                        if (typeof playThud === 'function') playThud(Math.min(1.0, Math.abs(this.speed) / 5));
                    }
                    if (typeof createSparks === 'function') createSparks(this.x, this.y);
                }
            }
        }

        // Update 3D Mesh
        // Gameplay: Advanced Physics & Terrain Grip - Suspension Bounce
        const baseHeight = 4.5;
        let bounce = 0;
        if (Math.abs(this.speed) > 1) {
            const t = Date.now() / 1000;
            const isOffTrack = surfaceGrip(this.x, this.y) < 0.5;
            const bounceFreq = isOffTrack ? 40 : 15;
            const bounceAmp = isOffTrack ? 0.4 : 0.08;
            bounce = Math.sin(t * bounceFreq) * bounceAmp * (Math.abs(this.speed) / this.maxSpeed);
        }
        this.mesh.position.set(this.x, baseHeight + bounce, this.y);
        
        // Dynamic pitch and roll for realism!
        const targetPitch = accel > 0 ? -0.04 : (brake ? 0.06 : 0);
        const targetRoll = steer * 0.12; 
        
        if (this.mesh.pitch === undefined) this.mesh.pitch = 0;
        if (this.mesh.roll === undefined) this.mesh.roll = 0;
        
        this.mesh.pitch += (targetPitch - this.mesh.pitch) * 0.15;
        this.mesh.roll += (targetRoll - this.mesh.roll) * 0.15;

        // Apply rotation (YXZ order)
        this.mesh.rotation.order = "YXZ";
        this.mesh.rotation.y = -this.angle - Math.PI / 2;
        this.mesh.rotation.x = this.mesh.pitch;
        this.mesh.rotation.z = this.mesh.roll;
        
        // Update dynamic exhaust glow
        if (this.mesh.exhaustGlow) {
            const boosting = this.nitroActive > 0;
            const targetIntensity = boosting ? 3.0 : (accel > 0 ? 1.0 : 0);
            this.mesh.exhaustGlow.intensity += (targetIntensity - this.mesh.exhaustGlow.intensity) * 0.2;
            this.mesh.exhaustGlow.color.setHex(boosting ? 0x00ffff : 0xffaa00);
        }
        
        // Steer front wheels
        if (this.mesh.wheels) {
            this.mesh.wheels.forEach(w => w.rotation.y = -Math.max(-0.5, Math.min(0.5, steer)));
        }

        // Spin all wheels
        let wheelSpin = this.speed * 0.25;
        if (this.mesh.allWheels) {
            this.mesh.allWheels.forEach(w => {
                w.children.forEach(child => {
                    if (!child.userData.fixed) child.rotation.x -= wheelSpin;
                });
            });
        }

        // Active aero flaps (X-mode on straights, Z-mode in corners)
        let xMode = Math.abs(this.speed) > this.maxSpeed * 0.65 && Math.abs(steer) < 0.15;
        let targetAngle = xMode ? 0.02 : 0.34;
        if (this.mesh.flapAngle !== undefined) {
            this.mesh.flapAngle += (targetAngle - this.mesh.flapAngle) * 0.08;
            if (this.mesh.frontFlapGroup) this.mesh.frontFlapGroup.rotation.x = -this.mesh.flapAngle;
            if (this.mesh.rearFlapGroup) this.mesh.rearFlapGroup.rotation.x = this.mesh.flapAngle;
        }

        const cp = checkpoints[this.cpIndex];
        const dist = Math.hypot(this.x - cp.x, this.y - cp.y);
        
        let checkpointHit = dist < 240;
        // For the finish line (checkpoint 0), require the car to actually cross the line (y >= 0)
        if (this.cpIndex === 0 && this.y < 0) {
            checkpointHit = false;
        }
        
        if (checkpointHit) {
            this.cpIndex = (this.cpIndex + 1) % CP_COUNT;
            if (this.cpIndex === 1) { 
                this.lap++; 
                if (this.lap > 3 && !this.finished) { 
                    this.finished = true; 
                    this.finishTime = Date.now(); 
                    this.finishRank = ++finishedCount;
                } 
            }
        }
    }
    progress() { 
        const nextCp = checkpoints[this.cpIndex];
        const distToNext = nextCp ? Math.hypot(this.x - nextCp.x, this.y - nextCp.y) : 0;
        return this.lap * CP_COUNT + this.cpIndex - (distToNext * 0.0001);
    }
    destroy() { scene.remove(this.mesh); }
}

const input = { up: false, down: false, left: false, right: false, brake: false, nitro: false };
window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'w') input.up = true;
    if (e.key === 'ArrowDown' || e.key === 's') input.down = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') input.right = true;
    if (e.key === ' ') input.brake = true;
    if (e.key === 'Shift') input.nitro = true;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
});
window.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' || e.key === 'w') input.up = false;
    if (e.key === 'ArrowDown' || e.key === 's') input.down = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') input.right = false;
    if (e.key === ' ') input.brake = false;
    if (e.key === 'Shift') input.nitro = false;
});

// ---- Particles 3D ----
const cache = { geo: {}, mat: {} };

const particlePool = {
    smoke: [], flame: [], shockwave: [], speedline: [], generic: [], skid: [], spark: []
};

function getPooledMesh(type, createFunc) {
    if (particlePool[type] && particlePool[type].length > 0) {
        const mesh = particlePool[type].pop();
        mesh.visible = true;
        mesh.scale.set(1, 1, 1);
        return mesh;
    }
    const mesh = createFunc();
    scene.add(mesh);
    return mesh;
}

function addParticle3D(x, z, colorHex) {
    if (!cache.geo.box4) cache.geo.box4 = new THREE.BoxGeometry(4, 4, 4);
    let key = 'p_' + colorHex;
    if (!cache.mat[key]) cache.mat[key] = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8 });
    
    const mesh = getPooledMesh('generic', () => new THREE.Mesh(cache.geo.box4, cache.mat[key]));
    mesh.material = cache.mat[key]; // ensure correct color
    mesh.material.opacity = 0.8;
    mesh.position.set(x + (Math.random()-0.5)*10, 2 + Math.random()*5, z + (Math.random()-0.5)*10);
    particles.push({ mesh, life: 20, type: 'generic' });
}

function addSmokeParticle(x, z, colorHex) {
    if (!cache.geo.smoke) cache.geo.smoke = new THREE.SphereGeometry(3, 4, 4);
    let key = 's_' + colorHex;
    if (!cache.mat[key]) cache.mat[key] = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.6, depthWrite: false });
    
    const mesh = getPooledMesh('smoke', () => new THREE.Mesh(cache.geo.smoke, cache.mat[key]));
    mesh.material = cache.mat[key];
    mesh.material.opacity = 0.6;
    mesh.position.set(x + (Math.random()-0.5)*8, 2, z + (Math.random()-0.5)*8);
    mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
    particles.push({ mesh, life: 30, type: 'smoke' });
}

function addFlameParticle(x, z, heading) {
    if (!cache.geo.flame) cache.geo.flame = new THREE.ConeGeometry(2, 6, 4);
    if (!cache.mat.flame1) cache.mat.flame1 = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 1.0, depthWrite: false, blending: THREE.AdditiveBlending });
    if (!cache.mat.flame2) cache.mat.flame2 = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 1.0, depthWrite: false, blending: THREE.AdditiveBlending });
    
    const mat = Math.random() > 0.5 ? cache.mat.flame1 : cache.mat.flame2;
    const mesh = getPooledMesh('flame', () => new THREE.Mesh(cache.geo.flame, mat));
    mesh.material = mat;
    mesh.material.opacity = 1.0;
    mesh.position.set(x, 4.5, z);
    mesh.rotation.y = -heading - Math.PI / 2;
    mesh.rotation.x = Math.PI / 2;
    particles.push({ mesh, life: 8, type: 'flame', heading: heading });
}

function addShockwaveParticle(x, z, heading) {
    if (!cache.geo.shockwave) {
        cache.geo.shockwave = new THREE.TorusGeometry(3, 0.3, 6, 20);
        cache.mat.shockwave = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    }
    
    const mesh = getPooledMesh('shockwave', () => new THREE.Mesh(cache.geo.shockwave, cache.mat.shockwave.clone()));
    mesh.material.opacity = 0.35;
    mesh.position.set(x, 3.5, z);
    mesh.rotation.y = -heading + Math.PI / 2;
    mesh.rotation.x = Math.PI / 2;
    particles.push({ mesh, life: 9, type: 'shockwave', heading: heading });
}

function createSpeedLines(cam) {
    if(Math.random() > 0.4) return;
    if (!cache.geo.speed) cache.geo.speed = new THREE.BoxGeometry(0.5, 0.5, 50);
    if (!cache.mat.speed) cache.mat.speed = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    
    const mesh = getPooledMesh('speedline', () => new THREE.Mesh(cache.geo.speed, cache.mat.speed));
    mesh.material.opacity = 0.5;
    let dist = 100 + Math.random() * 50;
    let offset = new THREE.Vector3((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 100, -dist);
    mesh.position.copy(cam.position).add(offset.applyQuaternion(cam.quaternion));
    mesh.quaternion.copy(cam.quaternion);
    particles.push({ mesh, life: 5, type: 'speedline' });
}

function addSkidMark(x, z, angle) {
    if (!cache.geo.skid) cache.geo.skid = new THREE.PlaneGeometry(8, 4);
    if (!cache.mat.skid) cache.mat.skid = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.5 });
    
    const mesh = getPooledMesh('skid', () => new THREE.Mesh(cache.geo.skid, cache.mat.skid));
    mesh.material.opacity = 0.5;
    mesh.position.set(x, 1.1, z);
    mesh.rotation.set(-Math.PI / 2, 0, -angle);
    skidMarks.push({ mesh, life: 300 });
}

function createSparks(x, z) {
    if (!cache.geo.spark) cache.geo.spark = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    if (!cache.mat.spark1) cache.mat.spark1 = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1.0 });
    if (!cache.mat.spark2) cache.mat.spark2 = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1.0 });
    if (!cache.mat.spark3) cache.mat.spark3 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });

    for (let i = 0; i < 15; i++) {
        const mat = Math.random() > 0.5 ? cache.mat.spark1 : (Math.random() > 0.5 ? cache.mat.spark2 : cache.mat.spark3);
        const mesh = getPooledMesh('spark', () => new THREE.Mesh(cache.geo.spark, mat));
        mesh.material = mat;
        mesh.material.opacity = 1.0;
        mesh.position.set(x, 4, z);
        sparkParticles.push({
            mesh: mesh,
            life: 15 + Math.random() * 15,
            vx: (Math.random() - 0.5) * 6,
            vy: Math.random() * 6,
            vz: (Math.random() - 0.5) * 6
        });
    }
}

function loop() {
    if (!player) return;

    if (window.instancedAudience && window.audienceData) {
        const t = Date.now() / 1000;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < window.audienceData.length; i++) {
            const data = window.audienceData[i];
            dummy.position.set(data.x, data.baseY + Math.abs(Math.sin(t * data.bounceSpeed + data.bounceOffset)) * 3, data.z);
            dummy.updateMatrix();
            window.instancedAudience.setMatrixAt(i, dummy.matrix);
        }
        window.instancedAudience.instanceMatrix.needsUpdate = true;
    }

    if (raceStarted && !isPaused && !isResuming) {
        allCars.forEach(c => c.update(c.isPlayer ? input : {}));
        
        for (let i = 0; i < allCars.length; i++) {
            for (let j = i + 1; j < allCars.length; j++) {
                let c1 = allCars[i], c2 = allCars[j];
                if (c1.finished || c2.finished) continue; // No collision for finished cars
                let dx = c2.x - c1.x, dy = c2.y - c1.y;
                let dist = Math.hypot(dx, dy);
                if (dist < 34 && dist > 0) { 
                    let push = (34 - dist) / 2;
                    let nx = (dx / dist) * push;
                    let ny = (dy / dist) * push;
                    c1.x -= nx; c1.y -= ny;
                    c2.x += nx; c2.y += ny;
                    
                    let relSpeed = Math.hypot(c1.vx - c2.vx, c1.vy - c2.vy);
                    if (relSpeed > 5) {
                        if (c1.isPlayer || c2.isPlayer) {
                            cameraShake = Math.min(20, cameraShake + relSpeed);
                            if (typeof playThud === 'function') playThud(Math.min(1.0, relSpeed / 8));
                        }
                        createSparks(c1.x + dx/2, c1.y + dy/2);
                        // Spin out logic
                        if (Math.random() < 0.6) {
                            if (c1.speed < c2.speed) c1.spinOutTimer = 45;
                            else c2.spinOutTimer = 45;
                        }
                    } else if (Math.random() < 0.3) {
                        addParticle3D(c1.x + dx/2, c1.y + dy/2, '#ffaa00');
                    }
                    
                    let bounceMult = relSpeed > 5 ? 0.4 : 0.15;
                    c1.vx -= nx * bounceMult; c1.vy -= ny * bounceMult;
                    c2.vx += nx * bounceMult; c2.vy += ny * bounceMult;
                    c1.speed *= (relSpeed > 5 ? 0.8 : 0.98); 
                    c2.speed *= (relSpeed > 5 ? 0.8 : 0.98);
                } else if (dist < 150 && dist > 34) { // Slipstream zone
                    let dxDir = dx / dist, dyDir = dy / dist;
                    let dot1 = Math.cos(c1.heading) * dxDir + Math.sin(c1.heading) * dyDir; 
                    if (dot1 > 0.95 && c1.speed > 5) {
                        c1.draftBoost = 5;
                        if (c1.isPlayer && Math.random() < 0.1) createSpeedLines(camera);
                    }
                    let dot2 = Math.cos(c2.heading) * (-dxDir) + Math.sin(c2.heading) * (-dyDir);
                    if (dot2 > 0.95 && c2.speed > 5) {
                        c2.draftBoost = 5;
                        if (c2.isPlayer && Math.random() < 0.1) createSpeedLines(camera);
                    }
                }
            }
        }
    }

    if (!isPaused && !isResuming) {
        particles.forEach(p => {
            if (p.type === 'smoke') {
                p.mesh.scale.multiplyScalar(1.08); 
                p.mesh.position.y += 0.2;
                p.mesh.material.opacity -= 0.02;
            } else if (p.type === 'flame') {
                p.mesh.scale.multiplyScalar(0.8);
                p.mesh.position.x -= Math.cos(p.heading) * 2;
                p.mesh.position.z -= Math.sin(p.heading) * 2;
                p.mesh.material.opacity -= 0.12;
            } else if (p.type === 'shockwave') {
                p.mesh.scale.x += 0.4;
                p.mesh.scale.y += 0.4;
                p.mesh.scale.z += 0.4;
                p.mesh.position.x -= Math.cos(p.heading) * 2;
                p.mesh.position.z -= Math.sin(p.heading) * 2;
                if (p.mesh.material) p.mesh.material.opacity -= (0.35 / 9);
            } else if (p.type === 'speedline') {
                let backward = new THREE.Vector3(0, 0, 80).applyQuaternion(camera.quaternion);
                p.mesh.position.add(backward);
                p.mesh.material.opacity -= 0.1;
            } else {
                p.mesh.scale.multiplyScalar(0.9);
                p.mesh.position.y += 0.5;
                p.mesh.material.opacity -= 0.04;
            }
            p.life--;
        });
        particles = particles.filter(p => {
            if (p.life <= 0) { 
                p.mesh.visible = false; 
                particlePool[p.type].push(p.mesh); 
                return false; 
            }
            return true;
        });

        skidMarks.forEach(s => {
            s.life--;
            if (s.life < 100) s.mesh.material.opacity = s.life / 200; // fade out slowly
        });
        skidMarks = skidMarks.filter(s => {
            if (s.life <= 0) { 
                s.mesh.visible = false; 
                particlePool.skid.push(s.mesh); 
                return false; 
            }
            return true;
        });

        sparkParticles.forEach(p => {
            p.mesh.position.x += p.vx;
            p.mesh.position.y += p.vy;
            p.mesh.position.z += p.vz;
            p.vy -= 0.5; // gravity
            if (p.mesh.position.y < 1) p.mesh.position.y = 1; // hit floor
            p.mesh.material.opacity -= 0.05;
            p.life--;
        });
        sparkParticles = sparkParticles.filter(p => {
            if (p.life <= 0) { 
                p.mesh.visible = false; 
                particlePool.spark.push(p.mesh); 
                return false; 
            }
            return true;
        });
    }

    if (raceStarted && !gameOver && !isPaused) updateDynamicWeather();
    else updateWeather();

    allCars.sort((a, b) => {
        if (a.finished && b.finished) {
            return a.finishRank - b.finishRank;
        }
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.progress() - a.progress();
    });
    const rank = allCars.indexOf(player) + 1;

    // Camera Logic
    if (cameraMode === 'CINEMATIC') {
        player.mesh.visible = true;
        let helmet = player.mesh.getObjectByName('helmet');
        if (helmet) helmet.visible = true;
        let upperTub = player.mesh.getObjectByName('upperTub');
        if (upperTub) upperTub.visible = true;
        let upperStripe = player.mesh.getObjectByName('upperStripe');
        if (upperStripe) upperStripe.visible = true;
        let halo = player.mesh.getObjectByName('halo');
        if (halo) halo.visible = true;
        let haloPylon = player.mesh.getObjectByName('haloPylon');
        if (haloPylon) haloPylon.visible = true;

        const elapsed = Date.now() - cinematicStartTime;
        // Total time = 4000ms. Progress from 0 to 1
        const p = Math.min(elapsed / 4000, 1);
        // Easing function for smooth transition (easeInOutCubic)
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        
        // Start camera at front of the car, sweep to the back seamlessly to match 3RD_PERSON
        const angle = player.heading + (Math.PI * ease); 
        const radius = 15 + ease * (40 - 15); // End at the new 3rd person offsetDist (40)
        const height = 3 + ease * (22 - 3);   // End at the new 3rd person offsetHeight (22)
        
        const camX = player.x + Math.cos(angle) * radius;
        const camZ = player.y + Math.sin(angle) * radius;
        
        camera.position.lerp(new THREE.Vector3(camX, height, camZ), 0.1);
        camera.lookAt(new THREE.Vector3(player.x, 3 + ease * 2, player.y));

    } else if (player.finished) {
        // Ensure the full car is visible in orbit view (like 3rd person)
        player.mesh.visible = true;
        let helmet = player.mesh.getObjectByName('helmet');
        if (helmet) helmet.visible = true;
        let upperTub = player.mesh.getObjectByName('upperTub');
        if (upperTub) upperTub.visible = true;
        let upperStripe = player.mesh.getObjectByName('upperStripe');
        if (upperStripe) upperStripe.visible = true;
        let halo = player.mesh.getObjectByName('halo');
        if (halo) halo.visible = true;
        let haloPylon = player.mesh.getObjectByName('haloPylon');
        if (haloPylon) haloPylon.visible = true;

        // Rivals remain visible so they can finish the race

        const elapsed = Date.now() - player.finishTime;
        const t = elapsed / 1000; 
        
        // EPIC MULTI-PHASE DIRECTOR MODE CINEMATIC
        
        // Phase 1 (0-3s): Bullet-time Sweep. Drop low, sweep rapidly around the side of the drifting car.
        // Phase 2 (3-6s): Drone Orbit. Tight, fast orbit around the donuts.
        // Phase 3 (6s+): Sky Pull-away. Spiral up majestically into the sky.
        
        let camX, camZ, height, lookHeight, lookX, lookZ;
        
        if (t < 3) {
            // Phase 1: Sweep from behind (3rd person) to side profile
            const p = t / 3;
            const ease = 1 - Math.pow(1 - p, 3);
            const angle = player.heading + Math.PI - ease * (Math.PI / 1.5);
            const radius = 120 - ease * 70; // Close in from 120 to 50
            height = 60 - ease * 50; // Dive from 60 to 10
            
            camX = player.x + Math.cos(angle) * radius;
            camZ = player.y + Math.sin(angle) * radius;
            lookHeight = 10;
            lookX = player.x;
            lookZ = player.y;
        } else if (t < 6) {
            // Phase 2: Drone Orbit
            const p = (t - 3) / 3;
            const orbitSpeed = t * 1.5;
            const angle = player.heading + Math.PI - (Math.PI / 1.5) - orbitSpeed;
            const radius = 50 + Math.sin(p * Math.PI) * 20; // Pulse in and out slightly
            height = 10 + p * 15; // Slowly rise to 25
            
            camX = player.x + Math.cos(angle) * radius;
            camZ = player.y + Math.sin(angle) * radius;
            lookHeight = 10;
            lookX = player.x;
            lookZ = player.y;
        } else {
            // Phase 3: Sky Pull-away
            const p = Math.min((t - 6) / 4, 1);
            const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            const orbitSpeed = 6 * 1.5 + (t - 6) * 0.5; // Slowing rotation
            const angle = player.heading + Math.PI - (Math.PI / 1.5) - orbitSpeed;
            
            const radius = 50 + ease * 250; // Pull way out
            height = 25 + ease * 200; // Pull way up
            
            camX = player.x + Math.cos(angle) * radius;
            camZ = player.y + Math.sin(angle) * radius;
            lookHeight = 10;
            lookX = player.x;
            lookZ = player.y;
        }
        camera.position.lerp(new THREE.Vector3(camX, height, camZ), 0.1);
        camera.lookAt(new THREE.Vector3(lookX, lookHeight, lookZ));
        
        // Handle input immediately after finishing to skip to menu (optional, kept from previous)
    } else if (cameraMode === '3RD_PERSON') {
        player.mesh.visible = true;
        let helmet = player.mesh.getObjectByName('helmet');
        if (helmet) helmet.visible = true;
        let upperTub = player.mesh.getObjectByName('upperTub');
        if (upperTub) upperTub.visible = true;
        let upperStripe = player.mesh.getObjectByName('upperStripe');
        if (upperStripe) upperStripe.visible = true;
        let halo = player.mesh.getObjectByName('halo');
        if (halo) halo.visible = true;
        let haloPylon = player.mesh.getObjectByName('haloPylon');
        if (haloPylon) haloPylon.visible = true;
        
        const offsetDist = 40;
        const offsetHeight = 22;
        
        // Track the velocity vector so the car visibly yaws (drifts) on screen!
        let camHeading = player.heading;
        const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        if (speed > 5) {
            camHeading = Math.atan2(player.vy, player.vx);
        }
        
        const targetX = player.x - Math.cos(camHeading) * offsetDist;
        const targetZ = player.y - Math.sin(camHeading) * offsetDist;
        
        camera.position.lerp(new THREE.Vector3(targetX, offsetHeight, targetZ), 0.1);
        const lookTargetX = player.x + Math.cos(camHeading) * 20;
        const lookTargetZ = player.y + Math.sin(camHeading) * 20;
        const lookTarget = new THREE.Vector3(lookTargetX, 4, lookTargetZ);
        camera.lookAt(lookTarget);
    } else if (cameraMode === '1ST_PERSON') {
        player.mesh.visible = true; // Show body in 1st person
        let helmet = player.mesh.getObjectByName('helmet');
        if (helmet) helmet.visible = false; // Hide helmet to not clip
        let upperTub = player.mesh.getObjectByName('upperTub');
        if (upperTub) upperTub.visible = false; // Hide top of the tub to open the cockpit
        let upperStripe = player.mesh.getObjectByName('upperStripe');
        if (upperStripe) upperStripe.visible = false;
        let halo = player.mesh.getObjectByName('halo');
        if (halo) halo.visible = false;
        let haloPylon = player.mesh.getObjectByName('haloPylon');
        if (haloPylon) haloPylon.visible = false;
        
        const headDist = 5.0; // Moved slightly forward inside the cockpit (approx 0.55 * 9.5)
        const eyeHeight = 11.0; // Raised to clear the halo and give a good view of the road
        
        // Exact position of the driver's head in world space
        camera.position.set(player.x + Math.cos(player.heading) * headDist, eyeHeight, player.y + Math.sin(player.heading) * headDist);
        
        // Look far ahead and slightly down over the nose
        const lookTarget = new THREE.Vector3(player.x + Math.cos(player.heading) * 100, eyeHeight - 4, player.y + Math.sin(player.heading) * 100);
        camera.lookAt(lookTarget);
    }
    
    // Dynamic FOV & Speed Lines based on speed
    if (camera) {
        let speedRatio = Math.abs(player.speed) / player.maxSpeed;
        if (player.nitroActive > 0) speedRatio *= 1.25;
        let targetFov = 55 + (speedRatio * 30); // 55 up to 85 for intense speed feel
        camera.fov += (targetFov - camera.fov) * 0.1;
        camera.updateProjectionMatrix();

        if (speedRatio > 0.8 && !isPaused && !isResuming && raceStarted) {
            createSpeedLines(camera);
        }
        
        
        if (cameraShake > 0.1) {
            camera.position.x += (Math.random() - 0.5) * cameraShake;
            camera.position.y += (Math.random() - 0.5) * cameraShake;
            camera.position.z += (Math.random() - 0.5) * cameraShake;
            cameraShake *= 0.85; 
        }
    }

    // Dynamic Shadow Map Optimization
    if (typeof mainLight !== 'undefined' && mainLight && player) {
        mainLight.position.set(player.x + 300, 600, player.y - 400);
        mainLight.target.position.set(player.x, 0, player.y);
    }

    if (typeof composer !== 'undefined' && composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }

    // UI Updates
    // Performance: Smart UI Updates (DOM Throttling)
    if (typeof window.lastUIState === 'undefined') {
        window.lastUIState = { lap: -1, pos: -1, speed: -1, gear: -1, revPct: -1, nitro: -1, isNitroFull: null, tireColor: '', driftScore: -1 };
    }

    const curLap = Math.min(player.lap, 3);
    if (window.lastUIState.lap !== curLap) {
        document.getElementById('lap').innerHTML = `${curLap}<span class="timing-sub">/3</span>`;
        window.lastUIState.lap = curLap;
    }
    
    if (window.lastUIState.pos !== rank) {
        document.getElementById('pos').innerHTML = `${rank}<span class="timing-sub">/4</span>`;
        window.lastUIState.pos = rank;
    }
    
    // Telemetry Update
    let speedRatio = Math.abs(player.speed) / player.maxSpeed;
    let displaySpeed = Math.round(speedRatio * 280);
    if (window.lastUIState.speed !== displaySpeed) {
        document.getElementById('speed').textContent = displaySpeed;
        window.lastUIState.speed = displaySpeed;
    }

    // Simulate Gear (1-6) and RPM (1000-8500)
    let gearFloat = speedRatio * 6;
    let gear = Math.min(6, Math.max(1, Math.ceil(gearFloat)));
    if (window.lastUIState.gear !== gear) {
        document.getElementById('gearText').textContent = gear;
        window.lastUIState.gear = gear;
    }

    let rpmFraction = (speedRatio === 0) ? 0 : (gearFloat - (gear - 1));
    let rpm = 1000 + (rpmFraction * 7500);
    
    // Rev bar width %
    let revPct = Math.round(Math.min(100, (rpm / 8500) * 100));
    if (Math.abs(window.lastUIState.revPct - revPct) >= 1) {
        document.getElementById('revFill').style.width = revPct + '%';
        window.lastUIState.revPct = revPct;
    }
    
    // Horizontal Nitro Bar
    let roundedNitro = Math.round(player.nitro);
    if (Math.abs(window.lastUIState.nitro - roundedNitro) >= 1) {
        const nitroFill = document.getElementById('nitroFill');
        if (nitroFill) {
            nitroFill.style.width = roundedNitro + '%';
            window.lastUIState.nitro = roundedNitro;
            
            const isNitroFull = (roundedNitro >= 100);
            if (window.lastUIState.isNitroFull !== isNitroFull) {
                if (isNitroFull) nitroFill.parentElement.classList.add('warning');
                else nitroFill.parentElement.classList.remove('warning');
                window.lastUIState.isNitroFull = isNitroFull;
            }
        }
    }

    // Phase 5: Tire wear indicator
    const getTireColor = (w) => {
        if (w > 0.65) return 'var(--green)';
        if (w > 0.35) return 'var(--yellow)';
        return 'var(--red)';
    };
    const currentTireColor = getTireColor(player.tireWear);
    if (window.lastUIState.tireColor !== currentTireColor) {
        ['tire_fl','tire_fr','tire_rl','tire_rr'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.background = currentTireColor;
        });
        window.lastUIState.tireColor = currentTireColor;
    }

    // Phase 6: Drift score total
    if (window.lastUIState.driftScore !== player.driftScore) {
        const dtEl = document.getElementById('driftTotal');
        if (dtEl) dtEl.textContent = player.driftScore.toLocaleString();
        window.lastUIState.driftScore = player.driftScore;
    }

    if (raceStarted && !player.finished && !isPaused && !isResuming) {
        const elapsed = Date.now() - raceStartTime;
        document.getElementById('time').textContent = formatTime(elapsed);
    }

    if (player.finished) {
        // Hide HUD immediately when finished so cinematic is clear
        document.getElementById('hud').style.display = 'none';
    }

    if (player.finished && (Date.now() - player.finishTime > 5000) && document.getElementById('postRaceModal').style.display === 'none') {
        let prm = document.getElementById('postRaceModal');
        prm.style.display = 'flex';
        prm.classList.remove('anim-modal-drop');
        void prm.offsetWidth;
        prm.classList.add('anim-modal-drop');

        // Update rank banner
        let rankText = rank + (rank === 1 ? 'ST' : rank === 2 ? 'ND' : rank === 3 ? 'RD' : 'TH');
        if (rank === 1) {
            document.getElementById('finalPosText').textContent = 'VICTORY';
            document.getElementById('finalPosText').classList.add('victory-anim');
            document.getElementById('victorySubText').style.display = 'none';
        } else {
            document.getElementById('finalPosText').textContent = rankText;
            document.getElementById('finalPosText').classList.remove('victory-anim');
            document.getElementById('victorySubText').style.display = 'block';
        }
        
        const list = document.getElementById('scoreboardBody');
        list.innerHTML = '';
        const driverNames = { '#00f3ff': 'Cyan Cruiser', '#ff003c': 'Ruby Racer', '#ffea00': 'Golden Glider', '#9d00ff': 'Violet Viper' };
        const driverFlags = { '#00f3ff': '🇯🇵', '#ff003c': '🇧🇷', '#ffea00': '🇩🇪', '#9d00ff': '🇫🇷' };
        const playerColor = player ? player.color : null;
        
        allCars.forEach((c, idx) => {
            let row = document.createElement('div');
            row.className = 'result-row' + (idx === 0 ? ' winner' : '');
            row.style.animationDelay = (1.5 + idx * 0.2) + 's';
            let timeStr = c.finishTime ? formatTime(c.finishTime - raceStartTime) : "DNF";
            const isPlayerCar = c.color === playerColor;
            const nameDisplay = isPlayerCar ? '🎮 YOU' : (driverNames[c.color] || 'Driver');
            const flag = driverFlags[c.color] || '🏁';
            
            row.innerHTML = `
                <div class="result-pos">P${idx + 1}</div>
                <div class="result-driver">
                    <div class="driver-color-box" style="background:${c.color};"></div>
                    <span class="driver-flag">${flag}</span>
                    ${nameDisplay}
                </div>
                <div class="result-time">${timeStr}</div>
            `;
            list.appendChild(row);
        });

        // Phase 2: Check personal best
        if (player.finishTime) {
            const raceTime = player.finishTime - raceStartTime;
            const isNewBest = checkPersonalBest(raceTime);
            const pbBanner = document.getElementById('personalBestBanner');
            if (pbBanner) pbBanner.style.display = isNewBest ? 'block' : 'none';
        }
    }

    if (audioListener) {
        if (!isPaused && raceStarted && !player.finished) {
            let speedRatio = Math.abs(player.speed) / player.maxSpeed;
            if (sounds.engine.buffer) {
                // Pitch shift the engine gently, keep volume soft and subtle
                sounds.engine.setPlaybackRate(0.5 + speedRatio * 1.5);
                sounds.engine.setVolume((0.05 + speedRatio * 0.15) * sfxMasterVolume);
            }

            // Keep song playback rate constant at 1.0 (normal speed)
            const bgm = document.getElementById('bgm');
            if (bgm) {
                bgm.playbackRate = 1.0;
            }

            // Crowd roar near start/finish straight
            if (typeof checkpoints !== 'undefined' && checkpoints.length > 0) {
                const sfX = checkpoints[0].x, sfZ = checkpoints[0].y;
                const distToSF = Math.hypot(player.x - sfX, player.y - sfZ);
                const crowdVol = Math.max(0, 1 - distToSF / 600) * sfxMasterVolume * 0.3;
                if (crowdVol > 0.03 && typeof sounds.crowd !== 'undefined' && sounds.crowd && sounds.crowd.buffer) {
                    if (!sounds.crowd.isPlaying) sounds.crowd.setVolume(crowdVol), sounds.crowd.play();
                    else sounds.crowd.setVolume(crowdVol);
                } else if (typeof sounds.crowd !== 'undefined' && sounds.crowd && sounds.crowd.isPlaying && crowdVol <= 0.03) {
                    sounds.crowd.stop();
                }
            }
            
            // Soft tire screech
            if (player.driftTime > 5 && surfaceGrip(player.x, player.y) > 0.5) {
                if (sounds.screech.buffer && !sounds.screech.isPlaying) {
                    sounds.screech.setVolume(0.15 * sfxMasterVolume);
                    sounds.screech.play();
                }
            } else {
                if (sounds.screech.isPlaying) sounds.screech.stop();
            }
            
            // Soft nitro burst sound
            if (player.nitroActive > 0) {
                if (sounds.nitro.buffer && !sounds.nitro.isPlaying) {
                    sounds.nitro.setVolume(0.25 * sfxMasterVolume);
                    sounds.nitro.play();
                }
            } else {
                if (sounds.nitro.isPlaying) sounds.nitro.stop();
            }
        } else {
            if (sounds.engine.isPlaying) sounds.engine.setVolume(0);
            if (sounds.screech.isPlaying) sounds.screech.stop();
            if (sounds.nitro.isPlaying) sounds.nitro.stop();
        }
    }

    drawMinimap();

    animationFrameId = requestAnimationFrame(loop);
}

function addAudience() {
    if (scene.getObjectByName("audience")) {
        scene.remove(scene.getObjectByName("audience"));
    }
    const audienceGroup = new THREE.Group();
    audienceGroup.name = "audience";
    
    // Outer bleacher near start line
    const bleacherGeo = new THREE.BoxGeometry(30, 10, 150);
    const bleacherMat = new THREE.MeshLambertMaterial({ color: 0x666677 });
    const bleacherMesh = new THREE.Mesh(bleacherGeo, bleacherMat);
    bleacherMesh.position.set(track.rx + track.width/2 + 40, 5, 0);
    bleacherMesh.castShadow = true;
    bleacherMesh.receiveShadow = true;
    audienceGroup.add(bleacherMesh);

    // Inner bleacher near start line
    const bleacherMeshIn = new THREE.Mesh(bleacherGeo, bleacherMat);
    bleacherMeshIn.position.set(track.rx - track.width/2 - 40, 5, 0);
    bleacherMeshIn.castShadow = true;
    bleacherMeshIn.receiveShadow = true;
    audienceGroup.add(bleacherMeshIn);

    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff, 0xff8800];
    const personGeo = new THREE.BoxGeometry(2, 4, 2);
    
    // Create an InstancedMesh for massive performance gain! (1000 people instead of 160)
    const personCount = 1000;
    const personMat = new THREE.MeshLambertMaterial(); 
    const instancedAudience = new THREE.InstancedMesh(personGeo, personMat, personCount);
    instancedAudience.castShadow = true;
    instancedAudience.receiveShadow = true;
    
    window.audienceData = [];
    let idx = 0;
    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();
    
    [bleacherMesh, bleacherMeshIn].forEach(b => {
        for (let i = 0; i < personCount/2; i++) {
            const px = b.position.x + (Math.random() - 0.5) * 25;
            const pz = b.position.z + (Math.random() - 0.5) * 140;
            const py = 10 + Math.random() * 2;
            
            dummy.position.set(px, py, pz);
            dummy.updateMatrix();
            instancedAudience.setMatrixAt(idx, dummy.matrix);
            
            tempColor.setHex(colors[Math.floor(Math.random() * colors.length)]);
            instancedAudience.setColorAt(idx, tempColor);
            
            window.audienceData.push({
                x: px, baseY: py, z: pz,
                bounceSpeed: 6 + Math.random() * 10,
                bounceOffset: Math.random() * Math.PI * 2
            });
            idx++;
        }
    });
    instancedAudience.instanceMatrix.needsUpdate = true;
    if (instancedAudience.instanceColor) instancedAudience.instanceColor.needsUpdate = true;
    
    audienceGroup.add(instancedAudience);
    window.instancedAudience = instancedAudience;
    
    scene.add(audienceGroup);
}

function startGame() {
    if (!audioListener) initAudio();
    if (audioListener && audioListener.context.state === 'suspended') {
        audioListener.context.resume();
    }
    
    // Do not rebuild track or cars. They are already on the grid from setupStartingGrid.
    cameraMode = defaultCameraMode; 
    
    particles.forEach(p => scene.remove(p.mesh));
    particles = [];
    skidMarks.forEach(s => scene.remove(s.mesh));
    skidMarks = [];
    sparkParticles.forEach(p => scene.remove(p.mesh));
    sparkParticles = [];
    
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('postRaceModal').style.display = 'none';
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    
    // reset UI
    document.getElementById('lap').innerHTML = `1<span class="timing-sub">/3</span>`;
    document.getElementById('pos').innerHTML = `1<span class="timing-sub">/4</span>`;
    document.getElementById('speed').textContent = "0";
    document.getElementById('gearText').textContent = "1";
    document.getElementById('revFill').style.width = "0%";
    document.getElementById('nitroFill').style.width = "0%";
    document.getElementById('time').textContent = "00:00.0";
    
    // Boot sequence animation
    let bootLogLines = [
        "INITIALIZING KERNEL...",
        "LOADING CHASSIS DYNAMICS...",
        "CALIBRATING SUSPENSION...",
        "SPOOLING TURBOCHARGER...",
        "ENGAGING NITROUS INJECTION...",
        "ESTABLISHING TELEMETRY LINK...",
        "WARMING UP TIRES...",
        "ALL SYSTEMS GO."
    ];
    let bootLogDiv = document.getElementById('bootLog');
    let bootProgressBar = document.getElementById('bootProgressBar');
    let bootProgressText = document.getElementById('bootProgressText');
    
    if (bootLogDiv && bootProgressBar && bootProgressText) {
        bootLogDiv.innerHTML = "";
        bootProgressBar.style.width = "0%";
        bootProgressText.textContent = "0%";
        
        let bootStartTime = Date.now();
        let bootDuration = 10000;
        
        let bootInterval = setInterval(() => {
            let elapsed = Date.now() - bootStartTime;
            let p = Math.min(elapsed / bootDuration, 1);
            
            bootProgressBar.style.width = (p * 100) + "%";
            bootProgressText.textContent = Math.floor(p * 100) + "%";
            
            let lineIndex = Math.floor((elapsed / bootDuration) * bootLogLines.length);
            let html = "";
            for (let i = 0; i <= lineIndex && i < bootLogLines.length; i++) {
                html += `<div>> ${bootLogLines[i]} <span style="color: #fff">[OK]</span></div>`;
            }
            bootLogDiv.innerHTML = html;
            
            if (p >= 1) clearInterval(bootInterval);
        }, 50);
    }
    
    // Show loading screen for 5 seconds
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
        let hud = document.getElementById('hud');
        hud.style.display = 'flex';
        hud.classList.remove('anim-scale-in');
        void hud.offsetWidth;
        hud.classList.add('anim-scale-in');
        
        // Initial camera snap to player so the cinematic lerps in from afar
        cameraMode = 'CINEMATIC';
        cinematicStartTime = Date.now();
        camera.position.set(player.x + 300, 200, player.y + 100);
        camera.lookAt(player.x, 0, player.y);

        raceStarted = false;
        
        const startText = document.getElementById('startText');
        const goText = document.getElementById('goText');
        const startLights = document.getElementById('startLights');
        
        startText.style.display = 'block';
        startText.style.opacity = '1';
        goText.style.display = 'none';
        goText.style.opacity = '1';
        startLights.style.display = 'none';
        startLights.style.opacity = '1';
        
        const r = document.getElementById('lightRed');
        const y = document.getElementById('lightYellow');
        const g = document.getElementById('lightGreen');
        
        r.className = 'light'; y.className = 'light'; g.className = 'light';

        let phase = 0;
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = setInterval(() => {
            phase++;
            if (phase === 2) {
                startText.style.display = 'none';
                startLights.style.display = 'block';
                r.className = 'light red-on';
            } else if (phase === 3) {
                y.className = 'light yellow-on';
            } else if (phase === 4) {
                r.className = 'light'; 
                y.className = 'light'; 
                g.className = 'light green-on';
                raceStarted = true;
                raceStartTime = Date.now();
                cameraMode = '3RD_PERSON';
                goText.style.display = 'block';
                setTimeout(() => { startLights.style.opacity = '0'; goText.style.opacity = '0'; }, 1000);
                setTimeout(() => { startLights.style.display = 'none'; goText.style.display = 'none'; }, 1500);
                clearInterval(countdownTimer);
            }
        }, 1000);
    }, 10000);
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    loop();
}

function returnToMenu() {
    document.getElementById('postRaceModal').style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    raceStarted = false;
    isPaused = false;
    isResuming = false;
    cameraMode = 'CINEMATIC';
    
    updateBestTimeOnMenu();
    setupStartingGrid();
    menuLoop();
}

function setupStartingGrid() {
    finishedCount = 0;
    checkpoints = [];
    const layout = TRACK_LAYOUTS[currentTrackLayout] || TRACK_LAYOUTS.grand_prix;
    const curve = new THREE.CatmullRomCurve3(layout.controlPoints, true, 'centripetal', 0.5);
    const pts = curve.getSpacedPoints(CP_COUNT);
    for (let i = 0; i < CP_COUNT; i++) {
        const pt = pts[i];
        const nextPt = pts[(i + 1) % CP_COUNT];
        const angle = Math.atan2(nextPt.z - pt.z, nextPt.x - pt.x);
        checkpoints.push({ x: pt.x, y: pt.z, a: angle });
    }
    buildTrack3D();

    if (player && player.destroy) player.destroy();
    if (allCars.length > 0) allCars.forEach(c => c.destroy());

    const carStats = CAR_CLASSES[currentCarClass] || CAR_CLASSES.hypercar;
    const startCp = checkpoints[0];
    const perpA = startCp.a + Math.PI / 2;

    player = new Car(startCp.x - Math.cos(perpA) * 40, startCp.y - Math.sin(perpA) * 40, startCp.a, customColor, true);
    player.maxSpeed = carStats.maxSpeed;
    player.accel = carStats.accel;
    player.turnSpeed = carStats.handling;

    rivals = [
        new Car(startCp.x + Math.cos(perpA) * 40, startCp.y + Math.sin(perpA) * 40, startCp.a, '#ff003c', false),
        new Car(startCp.x - Math.cos(perpA) * 40 - Math.cos(startCp.a) * 80, startCp.y - Math.sin(perpA) * 40 - Math.sin(startCp.a) * 80, startCp.a, '#ffea00', false),
        new Car(startCp.x + Math.cos(perpA) * 40 - Math.cos(startCp.a) * 80, startCp.y + Math.sin(perpA) * 40 - Math.sin(startCp.a) * 80, startCp.a, '#9d00ff', false),
    ];
    allCars = [player, ...rivals];
    applyDifficultyToRivals();

    allCars.forEach(c => {
        c.mesh.position.set(c.x, 4.5, c.y);
        c.mesh.rotation.y = -c.angle - Math.PI / 2;
    });
}

// ---- Phase 3: Difficulty System ----
let currentDifficulty = 'medium';
function setDifficulty(val) {
    currentDifficulty = val;
}
function applyDifficultyToRivals() {
    const mult = { easy: 0.78, medium: 1.0, hard: 1.18 };
    const m = mult[currentDifficulty] || 1.0;
    rivals.forEach(r => {
        r.maxSpeed *= m;
        r.accel *= m;
        if (currentDifficulty === 'hard') {
            r.turnSpeed = (r.turnSpeed || 0.055) * 1.1;
        } else if (currentDifficulty === 'easy') {
            r.turnSpeed = (r.turnSpeed || 0.055) * 0.85;
        }
    });
}

function selectCarClass(val) {
    currentCarClass = val;
    const stats = CAR_CLASSES[val];
    if (stats && player) {
        player.maxSpeed = stats.maxSpeed;
        player.accel = stats.accel;
        player.turnSpeed = stats.handling;
    }
    // Update UI Stat Bars
    if (stats) {
        const speedBar = document.getElementById('statSpeed');
        const accelBar = document.getElementById('statAccel');
        const handlingBar = document.getElementById('statHandling');
        if (speedBar) speedBar.style.width = Math.min(100, (stats.maxSpeed / 20) * 100) + '%';
        if (accelBar) accelBar.style.width = Math.min(100, (stats.accel / 0.5) * 100) + '%';
        if (handlingBar) handlingBar.style.width = Math.min(100, (stats.handling / 0.1) * 100) + '%';
    }
    updatePlayerColor(customColor);
}

function switchGarageTab(tabId) {
    document.querySelectorAll('.garage-tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.garage-tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetContent = document.getElementById('tab-' + tabId);
    if (targetContent) targetContent.classList.add('active');
    
    const targetBtn = document.getElementById(tabId === 'showroom' ? 'tabBtnShowroom' : 'tabBtnTracks');
    if (targetBtn) targetBtn.classList.add('active');
}

function selectTrackCard(layoutKey) {
    document.querySelectorAll('.track-card').forEach(el => el.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    selectTrackLayout(layoutKey);
}

function selectTrackLayout(val) {
    currentTrackLayout = val;
    setupStartingGrid();
}

function selectUnderglow(val) {
    currentUnderglow = val;
    updatePlayerColor(customColor);
}

let menuAngle = 0;
let menuTimer = 0;
let currentWeather = 'summer';
let customColor = '#ff2a2a';
let groundMesh = null;

function initMenu() {
    setupStartingGrid();
    menuLoop();
}

function menuLoop() {
    if (raceStarted || cameraMode === 'CINEMATIC') return;
    
    menuTimer += 0.016; 
    
    const angle = menuTimer * 0.2; 
    const dist = 65 + Math.sin(menuTimer * 0.5) * 15;
    
    const camX = player.x + Math.sin(angle) * dist;
    const camY = 12 + Math.cos(menuTimer * 0.3) * 6;
    const camZ = player.y + Math.cos(angle) * dist;
    
    camera.position.set(camX, camY, camZ);
    camera.lookAt(player.x - 15, 4.5, player.y);
    
    updateWeather();
    
    renderer.render(scene, camera);
    if (!raceStarted) {
        animationFrameId = requestAnimationFrame(menuLoop);
    }
}

function updatePlayerColor(colorHex) {
    customColor = colorHex;
    if (player) {
        scene.remove(player.mesh);
        player.mesh = buildCarMesh(colorHex);
        scene.add(player.mesh);
        player.mesh.position.set(player.x, 4.5, player.y);
        player.mesh.rotation.y = -player.angle - Math.PI / 2;
        player.color = colorHex;
    }
}

function toggleWeather(type) {
    currentWeather = type;
    buildTrack3D(); 
    if (groundMesh) {
        groundMesh.material.map = createGrassTexture();
        groundMesh.material.needsUpdate = true;
    }
    if (scene) {
        const skyMat = new THREE.MeshBasicMaterial({ map: createSkyTexture(), side: THREE.BackSide, fog: false });
        scene.children.forEach(c => {
            if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.position.y === 200) {
                c.material = skyMat;
            }
        });
    }
}

// Start in the menu
init3D();
initMenu();

// Expose functions globally on window for inline HTML event handlers (ES Module compatibility)
window.startGame = startGame;
window.returnToMenu = returnToMenu;
window.togglePause = togglePause;
window.updatePlayerColor = updatePlayerColor;
window.toggleWeather = toggleWeather;
window.setDifficulty = setDifficulty;
window.selectCarClass = selectCarClass;
window.selectTrackLayout = selectTrackLayout;
window.selectUnderglow = selectUnderglow;
window.switchGarageTab = switchGarageTab;
window.selectTrackCard = selectTrackCard;
window.toggleFS = toggleFS;
window.toggleCamera = toggleCamera;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.setMusicVolume = setMusicVolume;
window.setSfxVolume = setSfxVolume;
window.setDefaultCamera = setDefaultCamera;
window.setShakeIntensity = setShakeIntensity;
window.updateBestTimeOnMenu = updateBestTimeOnMenu;
window.shareLapTime = shareLapTime;
window.checkPersonalBest = checkPersonalBest;
window.formatTime = formatTime;

