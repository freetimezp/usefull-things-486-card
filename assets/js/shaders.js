/* =========================================
   FLUID VERTEX SHADER
========================================= */

export const fluidVertexShader = `

    varying vec2 vUv;

    void main() {

        vUv = uv;

        gl_Position = projectionMatrix
            * modelViewMatrix
            * vec4(position, 1.0);

    }

`;

/* =========================================
   FLUID FRAGMENT SHADER
========================================= */

export const fluidFragmentShader = `

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
   BACKGROUND VERTEX SHADER
========================================= */

export const backgroundVertexShader = `

    varying vec2 vUv;

    void main() {

        vUv = uv;

        gl_Position = projectionMatrix
            * modelViewMatrix
            * vec4(position, 1.0);

    }

`;

/* =========================================
   BACKGROUND FRAGMENT SHADER
========================================= */

export const backgroundFragmentShader = `

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
   CARD SHADER
========================================= */

export const cardVertexShader = `

    varying vec2 vUv;

    void main() {

        vUv = uv;

        gl_Position = projectionMatrix
            * modelViewMatrix
            * vec4(position, 1.0);

    }

`;

export const cardFragmentShader = `

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

export const workspaceVertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;

        gl_Position = projectionMatrix *
                      modelViewMatrix *
                      vec4(position, 1.0);
    }
`;
