document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("helmetContainer");
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 5;

    // Renderer setup (transparent background)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-5, -5, -5);
    scene.add(backLight);

    // Load 3D Model
    let loadedModel = null;
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        'assets/helmet.glb',
        function (gltf) {
            loadedModel = gltf.scene;
            
            // Auto-scale and center the model
            const box = new THREE.Box3().setFromObject(loadedModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3.5 / maxDim; // Adjust 3.5 to change size
            loadedModel.scale.set(scale, scale, scale);
            
            loadedModel.position.sub(center.multiplyScalar(scale));
            
            scene.add(loadedModel);
            console.log("Helmet model loaded successfully!");
        },
        undefined,
        function (error) {
            console.warn("Could not load assets/helmet.glb. Please add your 3D model to the assets folder.", error);
        }
    );

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);

        // Only render if the container is visible (not display: none)
        if (container.offsetParent !== null) {
            if (loadedModel) {
                loadedModel.rotation.y += 0.005; // Slow rotation
            }
            renderer.render(scene, camera);
        }
    }

    animate();

    // Handle window resize
    window.addEventListener("resize", () => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
});
