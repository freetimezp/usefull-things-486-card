/* =========================================
   IMPORTS
========================================= */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js";

import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.3.15/+esm";

import {
    fluidVertexShader,
    fluidFragmentShader,
    backgroundVertexShader,
    backgroundFragmentShader,
    cardVertexShader,
    cardFragmentShader,
    workspaceVertexShader,
} from "./shaders.js";

/* =========================================
   LENIS SMOOTH SCROLL
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
   FIXED HEADER SCROLL STATE
========================================= */

const header = document.querySelector(".header");

lenis.on("scroll", ({ scroll }) => {
    header?.classList.toggle("is-scrolled", scroll > 20);
});

/* =========================================
   DOM
========================================= */

const canvas = document.querySelector("#webgl");

/* =========================================
   SCENE & CAMERA
========================================= */

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

camera.position.z = 1;

/* =========================================
   RENDERER
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
   MOUSE STATE
========================================= */

const mouse = new THREE.Vector2(-2, -2);

const targetMouse = new THREE.Vector2(-2, -2);

const velocity = new THREE.Vector2(0, 0);

const targetVelocity = new THREE.Vector2(0, 0);

let mouseActive = 0;

/* =========================================
   POINTER EVENTS
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
   RENDER TARGETS
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
   FLUID SIMULATION SCENE
========================================= */

const fluidScene = new THREE.Scene();

const fluidCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

fluidCamera.position.z = 1;

/* =========================================
   FLUID UNIFORMS
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
   FLUID MATERIAL
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
   BACKGROUND MATERIAL
========================================= */

const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms: backgroundUniforms,

    vertexShader: backgroundVertexShader,

    fragmentShader: backgroundFragmentShader,
});

/* =========================================
   BACKGROUND PLANE
========================================= */

const backgroundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),

    backgroundMaterial,
);

scene.add(backgroundPlane);

/* =========================================
   RESIZE
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
   EXPERIMENT CARD SYSTEM
========================================= */

const experimentCards = document.querySelectorAll(".experiment-card");

/* =========================================
   CARD SHADER SCENE
========================================= */

const cardScenes = [];

/* =========================================
   CREATE CARD MATERIALS
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
   WORKSPACE SHADER
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
   CARD POINTER INTERACTION
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
   WORKSPACE INTERACTIONS
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
   ANIMATION LOOP
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
