/* =========================================
   01. IMPORTS
========================================= */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js";

import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.3.15/+esm";

/* =========================================
   00. LENIS SMOOTH SCROLL
========================================= */

const lenis = new Lenis({
    duration: 1.2,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1,
    anchors: true,
});

/* CONNECT LENIS TO GSAP TICKER */

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

/* =========================================
   01. FIXED HEADER SCROLL STATE
========================================= */

const header = document.querySelector(".header");

lenis.on("scroll", ({ scroll }) => {
    header?.classList.toggle("is-scrolled", scroll > 20);
});

/* =========================================
   02. DOM
========================================= */

const canvas = document.querySelector("#webgl");

/* =========================================
   03. SCENE & CAMERA
========================================= */

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

camera.position.z = 1;

/* =========================================
   04. RENDERER
========================================= */

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setClearColor(0x050609);

/* =========================================
   05. MOUSE STATE
========================================= */

const mouse = new THREE.Vector2(-2, -2);

const targetMouse = new THREE.Vector2(-2, -2);

const velocity = new THREE.Vector2(0, 0);

const targetVelocity = new THREE.Vector2(0, 0);

let mouseActive = 0;

/* =========================================
   06. POINTER EVENTS
========================================= */

window.addEventListener("pointermove", (event) => {
    const nextX = event.clientX / window.innerWidth;

    const nextY = 1 - event.clientY / window.innerHeight;

    // Calculate mouse movement speed
    const dx = nextX - targetMouse.x;
    const dy = nextY - targetMouse.y;

    targetVelocity.set(dx * 60, dy * 60);

    // Limit velocity
    if (targetVelocity.length() > 1.5) {
        targetVelocity.setLength(1.5);
    }

    targetMouse.set(nextX, nextY);

    mouseActive = 1;
});

window.addEventListener("pointerleave", () => {
    mouseActive = 0;

    targetVelocity.set(0, 0);
});

/* =========================================
   07. RENDER TARGETS
========================================= */

const renderTargetOptions = {
    minFilter: THREE.LinearFilter,

    magFilter: THREE.LinearFilter,

    format: THREE.RGBAFormat,

    type: THREE.HalfFloatType,

    depthBuffer: false,

    stencilBuffer: false,
};

let bufferA = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    renderTargetOptions,
);

let bufferB = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    renderTargetOptions,
);

/* =========================================
   08. FLUID SIMULATION SCENE
========================================= */

const fluidScene = new THREE.Scene();

const fluidCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

fluidCamera.position.z = 1;

/* =========================================
   09. FLUID UNIFORMS
========================================= */

const fluidUniforms = {
    uPrevTexture: {
        value: null,
    },

    uMouse: {
        value: mouse,
    },

    uVelocity: {
        value: velocity,
    },

    uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },

    uActive: {
        value: 0,
    },
};

/* =========================================
   10. FLUID VERTEX SHADER
========================================= */

const fluidVertexShader = `

    varying vec2 vUv;

    void main() {

        vUv = uv;

        gl_Position = projectionMatrix
            * modelViewMatrix
            * vec4(position, 1.0);

    }

`;

/* =========================================
   11. FLUID FRAGMENT SHADER
========================================= */

const fluidFragmentShader = `

    uniform sampler2D uPrevTexture;

    uniform vec2 uMouse;

    uniform vec2 uVelocity;

    uniform vec2 uResolution;

    uniform float uActive;

    varying vec2 vUv;


    void main() {

        vec2 uv = vUv;

        // ASPECT RATIO
        vec2 aspect = vec2(
            uResolution.x / uResolution.y,
            1.0
        );


        // ADVECT PREVIOUS FRAME
        vec2 velocityOffset = uVelocity * 0.0015;

        vec2 previousUv = uv - velocityOffset;


        // PREVIOUS FLUID DATA
        float center = texture2D(
            uPrevTexture,
            previousUv
        ).r;


        // SOFT BLUR
        vec2 pixel = 1.0 / uResolution;

        float blur = 0.0;

        blur += texture2D(
            uPrevTexture,
            previousUv + vec2(pixel.x, 0.0)
        ).r;

        blur += texture2D(
            uPrevTexture,
            previousUv - vec2(pixel.x, 0.0)
        ).r;

        blur += texture2D(
            uPrevTexture,
            previousUv + vec2(0.0, pixel.y)
        ).r;

        blur += texture2D(
            uPrevTexture,
            previousUv - vec2(0.0, pixel.y)
        ).r;

        blur *= 0.25;


        // PERSISTENT TRAIL
        float trail = max(center, blur * 0.97);

        trail *= 0.985;


        // MOUSE DISTANCE
        vec2 delta = (uv - uMouse) * aspect;

        float distanceToMouse = length(delta);


        // MOUSE BRUSH
        float brush = exp(
            -distanceToMouse * distanceToMouse * 650.0
        );


        // MOVEMENT ENERGY
        float speed = length(uVelocity);

        float energy = 0.13 + speed * 0.10;


        // ADD NEW MOUSE INPUT
        trail += brush * energy * uActive;


        // KEEP VALUES STABLE
        trail = clamp(trail, 0.0, 1.0);


        // OUTPUT
        gl_FragColor = vec4(
            trail,
            trail,
            trail,
            1.0
        );

    }

`;

/* =========================================
   12. FLUID MATERIAL
========================================= */

const fluidMaterial = new THREE.ShaderMaterial({
    uniforms: fluidUniforms,

    vertexShader: fluidVertexShader,

    fragmentShader: fluidFragmentShader,
});

/* =========================================
   13. FLUID PLANE
========================================= */

const fluidPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),

    fluidMaterial,
);

fluidScene.add(fluidPlane);

/* =========================================
   14. BACKGROUND UNIFORMS
========================================= */

const backgroundUniforms = {
    uTime: {
        value: 0,
    },

    uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },

    uMouse: {
        value: mouse,
    },

    uActive: {
        value: 0,
    },

    uTrailTexture: {
        value: bufferA.texture,
    },
};

/* =========================================
   15. BACKGROUND VERTEX SHADER
========================================= */

const backgroundVertexShader = `

    varying vec2 vUv;

    void main() {

        vUv = uv;

        gl_Position = projectionMatrix
            * modelViewMatrix
            * vec4(position, 1.0);

    }

`;

/* =========================================
   16. BACKGROUND FRAGMENT SHADER
========================================= */

const backgroundFragmentShader = `

    uniform float uTime;

    uniform vec2 uResolution;

    uniform vec2 uMouse;

    uniform float uActive;

    uniform sampler2D uTrailTexture;

    varying vec2 vUv;


    // RANDOM
    float random(vec2 st) {

        return fract(
            sin(dot(st, vec2(12.9898, 78.233)))
            * 43758.5453
        );

    }


    void main() {

        vec2 uv = vUv;

        vec2 aspect = vec2(
            uResolution.x / uResolution.y,
            1.0
        );

        vec2 p = (uv - 0.5) * aspect;


        // FLUID TRAIL SAMPLES
        vec2 pixel = 1.0 / uResolution;

        float trail = texture2D(
            uTrailTexture,
            uv
        ).r;

        float left = texture2D(
            uTrailTexture,
            uv - vec2(pixel.x * 3.0, 0.0)
        ).r;

        float right = texture2D(
            uTrailTexture,
            uv + vec2(pixel.x * 3.0, 0.0)
        ).r;

        float top = texture2D(
            uTrailTexture,
            uv + vec2(0.0, pixel.y * 3.0)
        ).r;

        float bottom = texture2D(
            uTrailTexture,
            uv - vec2(0.0, pixel.y * 3.0)
        ).r;


        // FLUID GRADIENT
        vec2 fluidGradient = vec2(
            right - left,
            top - bottom
        );


        // DISPLACE UV
        vec2 distortedUv = uv + fluidGradient * 0.12;

        vec2 distortedP = (distortedUv - 0.5) * aspect;


        // ANIMATED FLOW
        float time = uTime * 0.3;

        float wave1 = sin(
            distortedP.x * 4.0
            + sin(distortedP.y * 3.0 + time)
            + time
        );

        float wave2 = cos(
            distortedP.y * 4.0
            - sin(distortedP.x * 3.0 - time)
        );

        float wave = wave1 * wave2;


        // RIPPLE AROUND CURRENT MOUSE
        vec2 mousePosition = (uMouse - 0.5) * aspect;

        float mouseDistance = distance(
            p,
            mousePosition
        );

        float ripple = sin(
            mouseDistance * 65.0 - uTime * 4.0
        );

        ripple *= exp(-mouseDistance * 8.0);

        ripple *= uActive;


        // COLOR PALETTE
        vec3 baseColor = vec3(
            0.008,
            0.012,
            0.025
        );

        vec3 cyan = vec3(
            0.0,
            0.75,
            1.0
        );

        vec3 purple = vec3(
            0.38,
            0.08,
            0.85
        );

        vec3 pink = vec3(
            1.0,
            0.04,
            0.35
        );


        // WAVE COLORS
        float flow = smoothstep(
            -0.8,
            0.9,
            wave
        );

        vec3 color = mix(
            baseColor,
            purple,
            flow * 0.23
        );

        color += cyan * max(wave, 0.0) * 0.10;


        // PERSISTENT TRAIL GLOW
        color += cyan * trail * 0.65;

        color += pink * trail * trail * 0.22;


        // FLUID EDGE LIGHT
        color += cyan
            * length(fluidGradient)
            * 4.0;


        // RIPPLE HIGHLIGHTS
        color += cyan
            * max(ripple, 0.0)
            * 0.12;

        color += pink
            * max(-ripple, 0.0)
            * 0.08;


        // CYBER GRID
        vec2 gridUv = distortedP * 24.0;

        vec2 gridCell = abs(
            fract(gridUv) - 0.5
        );

        float gridLine = 1.0 - smoothstep(
            0.475,
            0.495,
            max(gridCell.x, gridCell.y)
        );

        color += cyan * gridLine * 0.035;


        // VIGNETTE
        float vignette = 1.0 - smoothstep(
            0.35,
            1.1,
            length(p)
        );

        color *= 0.55 + vignette * 0.45;


        // GRAIN
        float grain = random(
            uv * uResolution + uTime
        );

        color += (grain - 0.5) * 0.018;


        // OUTPUT
        gl_FragColor = vec4(color, 1.0);

    }

`;

/* =========================================
   17. BACKGROUND MATERIAL
========================================= */

const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms: backgroundUniforms,

    vertexShader: backgroundVertexShader,

    fragmentShader: backgroundFragmentShader,
});

/* =========================================
   18. BACKGROUND PLANE
========================================= */

const backgroundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),

    backgroundMaterial,
);

scene.add(backgroundPlane);

/* =========================================
   19. RESIZE
========================================= */

function resize() {
    const width = window.innerWidth;

    const height = window.innerHeight;

    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    renderer.setSize(width, height);

    renderer.setPixelRatio(pixelRatio);

    const bufferWidth = Math.floor(width * pixelRatio);

    const bufferHeight = Math.floor(height * pixelRatio);

    // RESIZE BOTH FLUID BUFFERS
    bufferA.setSize(bufferWidth, bufferHeight);

    bufferB.setSize(bufferWidth, bufferHeight);

    // UPDATE RESOLUTION UNIFORMS
    fluidUniforms.uResolution.value.set(bufferWidth, bufferHeight);

    backgroundUniforms.uResolution.value.set(bufferWidth, bufferHeight);
}

window.addEventListener("resize", resize);

/* =========================================
   22. EXPERIMENT CARD SYSTEM
========================================= */

const experimentCards = document.querySelectorAll(".experiment-card");

/* =========================================
   23. CARD SHADER SCENE
========================================= */

const cardScenes = [];

/* =========================================
   24. CARD SHADER
========================================= */

const cardVertexShader = `

    varying vec2 vUv;

    void main() {

        vUv = uv;

        gl_Position = projectionMatrix
            * modelViewMatrix
            * vec4(position, 1.0);

    }

`;

const cardFragmentShader = `

    uniform float uTime;
    uniform float uHover;
    uniform float uMode;
    uniform float uIntensity;

    uniform vec2 uMouse;
    uniform vec2 uResolution;
    

    varying vec2 vUv;


    // =====================================
    // 01. NOISE
    // =====================================

    float random(vec2 p) {

        return fract(
            sin(dot(p, vec2(127.1, 311.7)))
            * 43758.5453
        );

    }


    float noise(vec2 p) {

        vec2 i = floor(p);
        vec2 f = fract(p);

        f = f * f * (3.0 - 2.0 * f);

        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));

        return mix(
            mix(a, b, f.x),
            mix(c, d, f.x),
            f.y
        );

    }


    // =====================================
    // 02. COLOR PALETTE
    // =====================================

    vec3 palette(float t) {

        vec3 a = vec3(0.5, 0.5, 0.5);

        vec3 b = vec3(0.5, 0.5, 0.5);

        vec3 c = vec3(1.0, 1.0, 1.0);

        vec3 d = vec3(0.00, 0.10, 0.20);

        return a + b * cos(
            6.28318 * (c * t + d)
        );

    }


    // =====================================
    // 03. MAIN
    // =====================================

    void main() {

        vec2 uv = vUv;

        vec2 aspect = vec2(
            uResolution.x / uResolution.y,
            1.0
        );

        vec2 p = (uv - 0.5) * aspect;

        vec2 mouse = (uMouse - 0.5) * aspect;

        float time = uTime;

        float distanceToMouse = distance(p, mouse);

        float influence = exp(
            -distanceToMouse * 5.0
        ) * uHover;


        vec3 color = vec3(
            0.006,
            0.012,
            0.028
        );

        vec3 cyan = vec3(0.0, 0.85, 1.0);

        vec3 purple = vec3(0.48, 0.12, 1.0);

        vec3 pink = vec3(1.0, 0.04, 0.4);


        // =================================
        // MODE 01: LIQUID VISION
        // =================================

        if (uMode < 0.5) {

            vec2 liquidUv = p;

            float liquidTime = time * 0.45;

            // CURSOR DISTORTION
            liquidUv += normalize(
                p - mouse + 0.0001
            ) * influence * 0.16;

            // ORGANIC WAVES
            float wave1 = sin(
                liquidUv.x * 5.0
                + sin(liquidUv.y * 7.0 + liquidTime)
                + liquidTime
            );

            float wave2 = cos(
                liquidUv.y * 6.0
                + sin(liquidUv.x * 4.0 - liquidTime)
            );

            float wave3 = sin(
                length(liquidUv) * 11.0
                - liquidTime * 1.4
            );

            float field = wave1 + wave2 * 0.7 + wave3 * 0.4;

            // CENTRAL GLASS FORM
            float radius = length(
                liquidUv * vec2(1.0, 1.15)
            );

            float sphere = exp(
                -radius * radius * 5.5
            );

            // IRIDESCENT COLOR
            float colorShift = field * 0.18
                + radius * 0.65
                + liquidTime * 0.08;

            vec3 iridescence = palette(colorShift);

            iridescence = mix(
                iridescence,
                cyan,
                0.25
            );

            color += iridescence * sphere * 0.85;

            // GLASS RIM
            float rim = exp(
                -abs(radius - 0.31) * 32.0
            );

            color += cyan * rim * 0.75;

            color += pink
                * rim
                * sin(field * 3.0 + time)
                * 0.25;

            // FLUID HIGHLIGHTS
            float highlight = smoothstep(
                0.7,
                1.8,
                field
            );

            color += purple * highlight * 0.3;

            // MOVING LIQUID RIPPLES
            float ripple = sin(
                distanceToMouse * 35.0
                - time * 4.0
            );

            color += cyan
                * ripple
                * influence
                * 0.22;

            // SPECULAR REFLECTION
            float specular = exp(
                -length(
                    liquidUv - vec2(-0.15, 0.2)
                ) * 18.0
            );

            color += vec3(0.8, 0.95, 1.0)
                * specular
                * (0.2 + uHover * 0.5);

        }


        // =================================
        // MODE 02: CHROMATIC SHIFT
        // =================================

        else if (uMode < 1.5) {

            float glitchTime = time * 0.8;

            // GLITCH BANDS
            float band = floor(
                uv.y * 24.0
            );

            float bandNoise = random(
                vec2(band, floor(glitchTime * 5.0))
            );

            float glitchStrength = uHover * 0.06;

            float glitchOffset = (
                bandNoise - 0.5
            ) * glitchStrength;

            vec2 glitchUv = uv;

            glitchUv.x += glitchOffset;

            // RGB CHANNELS
            float red = sin(
                glitchUv.x * 14.0
                + glitchUv.y * 9.0
                + glitchTime
            );

            float green = cos(
                glitchUv.y * 18.0
                - glitchUv.x * 6.0
                - glitchTime
            );

            float blue = sin(
                length(p) * 24.0
                - glitchTime * 2.0
            );

            // CHROMATIC SEPARATION
            float separation = 0.025 + influence * 0.14;

            color.r += max(
                red + separation,
                0.0
            ) * 0.5;

            color.g += max(
                green,
                0.0
            ) * 0.35;

            color.b += max(
                blue - separation,
                0.0
            ) * 0.65;

            // HORIZONTAL INTERFERENCE
            float scan = sin(
                uv.y * uResolution.y * 0.65
            );

            color += cyan
                * abs(scan)
                * 0.045;

            // GLITCH FLASH
            float flash = step(
                0.96,
                random(vec2(band, floor(time * 8.0)))
            );

            color += pink
                * flash
                * influence
                * 0.5;

            // DIGITAL HORIZONTAL LINES
            float lines = sin(
                glitchUv.y * 95.0
                + glitchTime * 3.0
            );

            color += purple
                * abs(lines)
                * 0.05;

            // CURSOR INTERFERENCE
            color += cyan
                * influence
                * 0.35;

        }


        // =================================
        // MODE 03: ENERGY FIELD
        // =================================

        else {

            float energyTime = time * 0.5;

            vec2 energyUv = p;

            // MAGNETIC ROTATION
            float angle = atan(
                energyUv.y,
                energyUv.x
            );

            float radius = length(energyUv);

            angle += sin(
                radius * 5.0 - energyTime
            ) * 0.18;

            // ORBITAL FIELD
            float orbit = sin(
                angle * 8.0
                + radius * 18.0
                - energyTime * 3.0
            );

            float orbit2 = cos(
                angle * 5.0
                - radius * 14.0
                + energyTime * 2.0
            );

            float field = orbit + orbit2 * 0.5;

            // ENERGY WAVES
            float wave = smoothstep(
                -0.3,
                1.2,
                field
            );

            color += cyan * wave * 0.4;

            color += purple
                * abs(orbit2)
                * 0.35;

            // ORBITAL RINGS
            float ring1 = exp(
                -abs(radius - 0.19) * 55.0
            );

            float ring2 = exp(
                -abs(radius - 0.35) * 65.0
            );

            float ring3 = exp(
                -abs(radius - 0.48) * 75.0
            );

            color += cyan * ring1 * 0.8;

            color += purple * ring2 * 0.65;

            color += pink * ring3 * 0.45;

            // MAGNETIC CURSOR FIELD
            float magnetic = exp(
                -distanceToMouse * 4.0
            );

            color += pink
                * magnetic
                * uHover
                * 0.5;

            // PARTICLES
            for (int i = 0; i < 32; i++) {

                float fi = float(i);

                float particleAngle =
                    fi * 2.39996 + energyTime * 0.35;

                float particleRadius =
                    0.08 + random(vec2(fi, 2.0)) * 0.42;

                vec2 particlePosition = vec2(
                    cos(particleAngle),
                    sin(particleAngle)
                ) * particleRadius;

                float particle = exp(
                    -distance(
                        p,
                        particlePosition
                    ) * 180.0
                );

                color += cyan * particle * 0.65;

            }

            // ENERGY CORE
            float core = exp(
                -radius * radius * 32.0
            );

            color += vec3(0.2, 0.65, 1.0)
                * core
                * 0.8;

            // MAGNETIC DISTORTION
            color += pink
                * influence
                * abs(sin(radius * 40.0 - time * 3.0))
                * 0.2;

        }


        // =================================
        // SHARED HOVER RESPONSE
        // =================================

        float cursorGlow = exp(
            -distanceToMouse * 3.5
        ) * uHover;

        color += cyan * cursorGlow * 0.16;


        // =================================
        // EDGE VIGNETTE
        // =================================

        float vignette = 1.0 - smoothstep(
            0.3,
            0.95,
            length(p)
        );

        color *= 0.65 + vignette * 0.35;


        // =================================
        // FILM GRAIN
        // =================================

        float grain = noise(
            uv * uResolution + time * 0.1
        );

        color += (grain - 0.5) * 0.025;


        color *= uIntensity;

        gl_FragColor = vec4(color, 1.0);

    }

`;

/* =========================================
   25. CREATE CARD MATERIALS
========================================= */

experimentCards.forEach((card, index) => {
    const mode = index;

    const uniforms = {
        uTime: {
            value: 0,
        },

        uHover: {
            value: 0,
        },

        uMode: {
            value: mode,
        },

        uMouse: {
            value: new THREE.Vector2(-1, -1),
        },

        uResolution: {
            value: new THREE.Vector2(1, 1),
        },

        uIntensity: { value: 1.0 },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,

        vertexShader: cardVertexShader,

        fragmentShader: cardFragmentShader,
    });

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

    camera.position.z = 1;

    const geometry = new THREE.PlaneGeometry(2, 2);

    const mesh = new THREE.Mesh(geometry, material);

    scene.add(mesh);

    cardScenes.push({
        element: card,

        visual: card.querySelector(".card-visual"),

        scene,

        camera,

        uniforms,

        targetHover: 0,
    });
});

/* =========================================
   20. WORKSPACE SHADER
========================================= */

const workspaceElement = document.querySelector("#experiment-workspace");
const workspaceVisual = document.querySelector("#workspace-visual");

const workspaceTitle = document.querySelector("#workspace-title");
const workspaceId = document.querySelector("#workspace-id");
const workspaceDescription = document.querySelector("#workspace-description");

const workspaceCanvas = document.querySelector("#workspace-canvas");

const workspaceScene = new THREE.Scene();

const workspaceCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

workspaceCamera.position.z = 1;

let previousFocusElement = null;

/* DEDICATED WORKSPACE RENDERER */

const workspaceRenderer = new THREE.WebGLRenderer({
    canvas: workspaceCanvas,
    antialias: true,
    alpha: true,
});

workspaceRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

workspaceRenderer.setClearColor(0x000000, 0);

let workspaceWidth = 0;
let workspaceHeight = 0;

function resizeWorkspaceRenderer() {
    const rect = workspaceVisual.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    workspaceWidth = rect.width;
    workspaceHeight = rect.height;

    workspaceRenderer.setSize(workspaceWidth, workspaceHeight, false);

    workspaceUniforms.uResolution.value.set(
        workspaceWidth * workspaceRenderer.getPixelRatio(),
        workspaceHeight * workspaceRenderer.getPixelRatio(),
    );
}

window.addEventListener("resize", resizeWorkspaceRenderer);

const workspaceUniforms = {
    uTime: { value: 0 },
    uHover: { value: 0 },
    uMode: { value: 0 },
    uMouse: { value: new THREE.Vector2(-1, -1) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uIntensity: { value: 1.0 },
};

const workspaceVertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;

        gl_Position = projectionMatrix *
                      modelViewMatrix *
                      vec4(position, 1.0);
    }
`;

const workspaceMaterial = new THREE.ShaderMaterial({
    uniforms: workspaceUniforms,
    vertexShader: workspaceVertexShader,
    fragmentShader: cardFragmentShader,
    depthTest: false,
    depthWrite: false,
});

const workspacePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    workspaceMaterial,
);

workspaceScene.add(workspacePlane);

let workspaceOpen = false;
let workspacePaused = false;
let workspacePausedAt = 0;
let workspaceTimeOffset = 0;
let activeWorkspaceCard = null;

/* =========================================
   26. CARD POINTER INTERACTION
========================================= */

cardScenes.forEach((card) => {
    const element = card.element;

    const visual = card.visual;

    // GSAP QUICK CONTROLS
    const rotateX = gsap.quickTo(element, "rotationX", {
        duration: 0.5,
        ease: "power3.out",
    });

    const rotateY = gsap.quickTo(element, "rotationY", {
        duration: 0.5,
        ease: "power3.out",
    });

    const moveY = gsap.quickTo(element, "y", {
        duration: 0.5,
        ease: "power3.out",
    });

    // POINTER ENTER
    visual.addEventListener("pointerenter", () => {
        card.targetHover = 1;

        gsap.to(element, {
            scale: 1.015,
            duration: 0.4,
            ease: "power2.out",
        });
    });

    // POINTER MOVE
    visual.addEventListener("pointermove", (event) => {
        const rect = visual.getBoundingClientRect();

        const x = (event.clientX - rect.left) / rect.width;

        const y = (event.clientY - rect.top) / rect.height;

        // SHADER COORDINATES
        card.uniforms.uMouse.value.set(x, 1 - y);

        // NORMALIZED TILT
        const tiltX = (0.5 - y) * 7;

        const tiltY = (x - 0.5) * 7;

        rotateX(tiltX);

        rotateY(tiltY);

        moveY(-5);
    });

    // POINTER LEAVE
    visual.addEventListener("pointerleave", () => {
        card.targetHover = 0;

        card.uniforms.uMouse.value.set(-1, -1);

        rotateX(0);

        rotateY(0);

        moveY(0);

        gsap.to(element, {
            scale: 1,
            duration: 0.5,
            ease: "power3.out",
        });
    });
});

/* =========================================
   21. WORKSPACE INTERACTIONS
========================================= */

const pauseButton = document.querySelector("#workspace-pause");
const resetButton = document.querySelector("#workspace-reset");
const closeButton = document.querySelector("#workspace-close");

const intensityInput = document.querySelector("#workspace-intensity");
const intensityValue = document.querySelector("#intensity-value");
const monitorIntensity = document.querySelector("#monitor-intensity");

const workspaceStatus = document.querySelector("#workspace-status");
const workspaceMonitor = document.querySelector("#workspace-monitor");
const workspaceResolution = document.querySelector("#workspace-resolution");

function openWorkspace(card) {
    previousFocusElement = card.element;

    // Make the card available for focus restoration
    previousFocusElement.setAttribute("tabindex", "-1");

    activeWorkspaceCard = card;
    workspaceOpen = true;
    workspacePaused = false;

    lenis.stop();

    // Enable workspace interaction
    workspaceElement.inert = false;

    gsap.set(workspaceElement, {
        display: "flex",
    });

    workspaceTimeOffset = performance.now() * 0.001;
    workspacePausedAt = 0;

    const title = card.element.querySelector("h3");
    const description = card.element.querySelector("p");

    const index = cardScenes.indexOf(card) + 1;

    workspaceTitle.textContent = title
        ? title.textContent.trim()
        : "UNKNOWN EXPERIMENT.";

    workspaceDescription.textContent = description
        ? description.textContent.trim()
        : "REALTIME PROCEDURAL SHADER EXPERIMENT.";

    workspaceId.textContent = `EXPERIMENT // ${String(index).padStart(3, "0")}`;

    workspaceUniforms.uMode.value = card.uniforms.uMode.value;
    workspaceUniforms.uIntensity.value = 1.0;
    workspaceUniforms.uHover.value = 1.0;
    workspaceUniforms.uMouse.value.set(-1, -1);

    intensityInput.value = 1;
    intensityValue.textContent = "1.00";
    monitorIntensity.textContent = "100%";

    pauseButton.innerHTML = `
        <span class="control-icon">Ⅱ</span>
        <span>PAUSE SYSTEM</span>
    `;

    workspaceStatus.innerHTML = "<span></span> SYSTEM ACTIVE";
    workspaceMonitor.textContent = "RENDERING ACTIVE";

    gsap.set(workspaceElement, {
        display: "flex",
    });

    requestAnimationFrame(() => {
        resizeWorkspaceRenderer();

        closeButton?.focus({ preventScroll: true });
    });

    gsap.fromTo(
        ".workspace-backdrop",
        { opacity: 0 },
        { opacity: 1, duration: 0.45, ease: "power2.out" },
    );

    gsap.fromTo(
        ".workspace-panel",
        {
            opacity: 0,
            scale: 0.96,
            y: 25,
        },
        {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.65,
            ease: "power3.out",
        },
    );
}

function closeWorkspace() {
    if (!workspaceOpen) return;

    workspacePaused = false;
    activeWorkspaceCard = null;

    lenis.start();

    gsap.to(".workspace-panel", {
        opacity: 0,
        scale: 0.97,
        y: 20,
        duration: 0.35,
        ease: "power2.in",

        onComplete: () => {
            // 01. MOVE FOCUS OUT OF THE WORKSPACE
            if (previousFocusElement?.isConnected) {
                previousFocusElement.focus({
                    preventScroll: true,
                });
            }

            // 02. DISABLE WORKSPACE INTERACTION
            workspaceElement.inert = true;

            // 03. HIDE WORKSPACE
            workspaceElement.style.display = "none";

            // 04. RESET STATE
            workspaceOpen = false;
            previousFocusElement = null;
        },
    });

    gsap.to(".workspace-backdrop", {
        opacity: 0,
        duration: 0.4,
        ease: "power2.in",
    });
}

/* OPEN FROM CARDS */

cardScenes.forEach((card) => {
    card.element.addEventListener("click", () => {
        openWorkspace(card);
    });
});

/* CLOSE */

closeButton.addEventListener("click", closeWorkspace);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && workspaceOpen) {
        closeWorkspace();
    }
});

/* PAUSE / RESUME */

pauseButton.addEventListener("click", () => {
    if (!workspacePaused) {
        workspacePausedAt = workspaceUniforms.uTime.value;
        workspacePaused = true;

        pauseButton.innerHTML = `
            <span class="control-icon">▶</span>
            <span>RESUME SYSTEM</span>
        `;

        workspaceStatus.innerHTML = "<span></span> SYSTEM PAUSED";
        workspaceMonitor.textContent = "RENDERING PAUSED";
    } else {
        workspaceTimeOffset = performance.now() * 0.001 - workspacePausedAt;

        workspacePaused = false;

        pauseButton.innerHTML = `
            <span class="control-icon">Ⅱ</span>
            <span>PAUSE SYSTEM</span>
        `;

        workspaceStatus.innerHTML = "<span></span> SYSTEM ACTIVE";
        workspaceMonitor.textContent = "RENDERING ACTIVE";
    }
});

/* INTENSITY */

intensityInput.addEventListener("input", (event) => {
    const value = Number(event.target.value);

    workspaceUniforms.uIntensity.value = value;

    intensityValue.textContent = value.toFixed(2);
    monitorIntensity.textContent = `${Math.round(value * 100)}%`;
});

/* RESET */

resetButton.addEventListener("click", () => {
    workspaceUniforms.uTime.value = 0;
    workspaceUniforms.uHover.value = 1;
    workspaceUniforms.uMouse.value.set(-1, -1);

    workspaceUniforms.uIntensity.value = 1;

    intensityInput.value = 1;
    intensityValue.textContent = "1.00";
    monitorIntensity.textContent = "100%";

    workspaceTimeOffset = performance.now() * 0.001;
    workspacePausedAt = 0;

    workspacePaused = false;

    pauseButton.innerHTML = `
        <span class="control-icon">Ⅱ</span>
        <span>PAUSE SYSTEM</span>
    `;

    workspaceStatus.innerHTML = "<span></span> SYSTEM ACTIVE";
    workspaceMonitor.textContent = "RENDERING ACTIVE";
});

/* WORKSPACE MOUSE */

workspaceVisual.addEventListener("pointermove", (event) => {
    const rect = workspaceVisual.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    workspaceUniforms.uMouse.value.set(x, 1 - y);
    workspaceUniforms.uHover.value = 1;
});

workspaceVisual.addEventListener("pointerleave", () => {
    workspaceUniforms.uMouse.value.set(-1, -1);
    workspaceUniforms.uHover.value = 0;
});

/* =========================================
   27. ANIMATION LOOP
========================================= */

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // ---------------------------------
    // UPDATE GLOBAL MOUSE
    // ---------------------------------

    mouse.lerp(targetMouse, 0.075);

    velocity.lerp(targetVelocity, 0.12);

    targetVelocity.multiplyScalar(0.92);

    // ---------------------------------
    // UPDATE FLUID SIMULATION
    // ---------------------------------

    fluidUniforms.uMouse.value.copy(mouse);

    fluidUniforms.uVelocity.value.copy(velocity);

    fluidUniforms.uActive.value = mouseActive;

    fluidUniforms.uPrevTexture.value = bufferA.texture;

    renderer.setRenderTarget(bufferB);

    renderer.render(fluidScene, fluidCamera);

    // SWAP BUFFERS
    const temp = bufferA;

    bufferA = bufferB;

    bufferB = temp;

    // ---------------------------------
    // UPDATE BACKGROUND
    // ---------------------------------

    backgroundUniforms.uTime.value = elapsedTime;

    backgroundUniforms.uMouse.value.copy(mouse);

    backgroundUniforms.uActive.value = mouseActive;

    backgroundUniforms.uTrailTexture.value = bufferA.texture;

    renderer.setRenderTarget(null);

    renderer.setScissorTest(false);

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);

    renderer.render(scene, camera);

    // ---------------------------------
    // RENDER EXPERIMENT CARDS
    // ---------------------------------

    renderer.setScissorTest(true);

    cardScenes.forEach((card) => {
        const rect = card.visual.getBoundingClientRect();

        // Skip cards outside the viewport
        if (
            rect.bottom <= 0 ||
            rect.top >= window.innerHeight ||
            rect.right <= 0 ||
            rect.left >= window.innerWidth
        ) {
            return;
        }

        // CARD POSITION
        const x = rect.left;

        const y = window.innerHeight - rect.bottom;

        const width = rect.width;

        const height = rect.height;

        // CARD VIEWPORT
        renderer.setViewport(x, y, width, height);

        renderer.setScissor(x, y, width, height);

        // UPDATE CARD SHADER
        card.uniforms.uTime.value = elapsedTime;

        card.uniforms.uHover.value +=
            (card.targetHover - card.uniforms.uHover.value) * 0.08;

        card.uniforms.uResolution.value.set(width, height);

        // RENDER CARD
        renderer.render(card.scene, card.camera);
    });

    /* =========================================
    WORKSPACE RENDER
    ========================================= */

    if (workspaceOpen) {
        const now = performance.now() * 0.001;

        if (!workspacePaused) {
            workspaceUniforms.uTime.value = now - workspaceTimeOffset;
        }

        workspaceRenderer.render(workspaceScene, workspaceCamera);
    }

    // RESTORE SCISSOR
    renderer.setScissorTest(false);
}

animate();

resize();
