// sketch.js

let basicShader;
let basicShader2;
let shaderTexture, shaderTexture2;
let alp1 = 255,
    alp2 = 255;
let maxAlp = 80,
    minAlp = 30;

let fmSynth, filter, filter2, lfo, lfoResonance; // Tone.js components
let fmSynthPlaying = false;
let noiseSynth;
let autoFilter;

let textGraphics;

let state = "main"; // "main" or "overlay"

let overlayParticlesGraphics;
let particles = [];

function preload() {
    basicShader = loadShader('shader.vert', 'shader.frag');
    basicShader2 = loadShader('shader.vert', 'shader2.frag');
}

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
    canvas.parent('p5-container'); // Attach canvas to the container

    // Random seed
    let seed = random() * 999999;
    randomSeed(seed);
    noiseSeed(seed);

    shaderTexture = createGraphics(windowWidth, windowHeight, WEBGL);
    shaderTexture.noStroke();
    shaderTexture.pixelDensity(1);

    shaderTexture2 = createGraphics(windowWidth, windowHeight, WEBGL);
    shaderTexture2.noStroke();
    shaderTexture2.pixelDensity(1);

    textGraphics = createGraphics(windowWidth, windowHeight);
    textGraphics.pixelDensity(1);

    // Initialize the overlay particles buffer
    overlayParticlesGraphics = createGraphics(windowWidth, windowHeight);
    overlayParticlesGraphics.pixelDensity(1);
    overlayParticlesGraphics.clear();

    // If WebGL context is lost
    canvas.elt.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        noLoop();
        console.log('WebGL context lost!');
    }, false);
    canvas.elt.addEventListener('webglcontextrestored', (e) => {
        console.log('WebGL context restored!');
        loop();
    }, false);

    // Position the overlay particles canvas
    let overlayCanvas = overlayParticlesGraphics.canvas;
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.zIndex = '11';
    overlayCanvas.style.pointerEvents = 'none';
    document.body.appendChild(overlayCanvas);

    pixelDensity(1);
    noCursor();

    // Initialize Tone
    setupToneJS();

    // --- MOBILE-FRIENDLY: Tab Visibility (pause audio) ---
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            // Page hidden
            if (Tone.Transport.state === 'started') {
                Tone.Transport.pause();
            }
            if (fmSynthPlaying) {
                fmSynth.triggerRelease();
                fmSynthPlaying = false;
            }
            if (noiseSynth && noiseSynth.state === "started") {
                noiseSynth.stop();
            }
        } else {
            // Page visible again
            if (state === "main") {
                if (Tone.Transport.state !== 'started') {
                    Tone.Transport.start();
                }
                // Optionally re-trigger fmSynth
                if (!fmSynthPlaying) {
                    fmSynth.triggerAttack("D2");
                    fmSynthPlaying = true;
                }
                if (noiseSynth && noiseSynth.state !== "started") {
                    noiseSynth.start();
                }
            }
        }
    });

    // Back button
    document.getElementById('back-button').addEventListener('click', () => {
        state = "main";
        document.getElementById('overlay').style.display = 'none';
        overlayParticlesGraphics.canvas.style.display = 'none';

        // Resume
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
        if (!fmSynthPlaying) {
            let note = "D2";
            fmSynth.triggerAttack(note);
            fmSynthPlaying = true;
        }
        if (!noiseSynth.started) {
            noiseSynth.start();
        }
    });
}

function draw() {
    background(0);

    if (state === "main") {
        // main state
        let mx = mouseX - width / 2;
        let my = mouseY - height / 2;
        let d = dist(mx, my, 0, 0);

        // Show pointer if inside center circle
        if (d <= 50) {
            cursor('pointer');
        } else {
            noCursor();
        }

        // Update uniforms
        basicShader.setUniform('u_pixelDensity', pixelDensity());
        basicShader.setUniform("uTexture0", shaderTexture);
        basicShader.setUniform('u_resolution', [width, height]);
        basicShader.setUniform('u_time', millis() / 1000.0);
        basicShader.setUniform('u_speed', 1.0);
        basicShader.setUniform('u_windSpeed', 1.0);
        basicShader.setUniform('u_mouse', [mouseX, height - mouseY]);
        basicShader.setUniform('u_middle', [width, height]);

        basicShader2.setUniform('u_pixelDensity', pixelDensity());
        basicShader2.setUniform("uTexture0", shaderTexture);
        basicShader2.setUniform('u_resolution', [width, height]);
        basicShader2.setUniform('u_time', millis() / 1000.0);
        basicShader2.setUniform('u_speed', 1.0);
        basicShader2.setUniform('u_windSpeed', 1.0);
        basicShader2.setUniform('u_mouse', [mouseX, height - mouseY]);
        basicShader2.setUniform('u_middle', [width, height]);

        shaderTexture.shader(basicShader);
        shaderTexture.rect(0, 0, width, height);

        shaderTexture2.shader(basicShader2);
        shaderTexture2.rect(0, 0, width, height);

        translate(-width / 2, -height / 2);

        // dist for alpha
        let d2 = dist(mx, my, 0, 0);
        if (d2 > maxAlp) {
            alp1 = 255;
            alp2 = 0;
        } else if (d2 < maxAlp && d2 > minAlp) {
            alp1 = map(d2, maxAlp, minAlp, 255, 0);
            alp2 = map(d2, maxAlp, minAlp, 0, 255);
        } else {
            alp1 = 0;
            alp2 = 255;
        }

        tint(255, alp1);
        image(shaderTexture, 0, 0);

        tint(255, alp2);
        image(shaderTexture2, 0, 0);

        let textOpacity;
        if (d <= 50) {
            textOpacity = map(d, 50, 0, 0, 255);
        } else {
            textOpacity = 0;
        }

        textGraphics.clear();
        textGraphics.fill(255, textOpacity);
        textGraphics.textFont('monospace');
        textGraphics.textAlign(CENTER, CENTER);
        textGraphics.textSize(15);

        // textGraphics.text('Enter', textGraphics.width / 2, textGraphics.height / 2);
        image(textGraphics, 0, 0);

        // Hide overlay particles
        overlayParticlesGraphics.canvas.style.display = 'none';

        // Update audio
        updateLFOResonance();

    } else if (state === "overlay") {
        // overlay
        overlayParticlesGraphics.canvas.style.display = 'block';
        updateOverlayGraphics();
    }
}

// --- EVENT: Window Resized ---
function windowResized() {
    noLoop();

    setTimeout(() => {
        resizeCanvas(windowWidth, windowHeight, WEBGL);
        shaderTexture.resizeCanvas(windowWidth, windowHeight, WEBGL);
        shaderTexture2.resizeCanvas(windowWidth, windowHeight, WEBGL);
        textGraphics.resizeCanvas(windowWidth, windowHeight);
        overlayParticlesGraphics.resizeCanvas(windowWidth, windowHeight);

        loop();
    }, 100);
}

// Key pressed
function keyPressed() {
    if (key == 's') {
        saveCanvas('LucidDream_DistCollective', 'png');
    }
}

// --- MOBILE-FRIENDLY: Add a touchStarted() that duplicates mousePressed logic ---
function touchStarted() {
    mousePressed();
}

// --- Overlay Graphics ---
function updateOverlayGraphics() {
    overlayParticlesGraphics.clear();
   
    updateParticles();
    drawBlurredCircle();
}

function drawBlurredCircle() {
    let pg = overlayParticlesGraphics;
    let centerX = windowWidth / 2;
    let centerY = windowHeight / 2;
    let maxRadius = 30;
    let maxI = 20;
    for (let i = 0; i <= maxI; i++) {
        let radius = map(i, 0, maxI, maxRadius, 0);
        let alpha = map(i, 0, maxI, 0, 255);
        pg.noStroke();
        pg.fill(255, 0, 0, alpha);
        pg.ellipse(centerX, centerY, radius * 2, radius * 2);
    }
}

// --- Particle System ---
class Particle {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D();
        this.speed = random(1, 3);
        this.vel.mult(this.speed);
        this.acc = createVector(0, 0);
        this.lifespan = 120;
    }

    update() {
        // flow field
        let angle = noise(this.pos.x * 0.008, this.pos.y * 0.008) * TWO_PI * 4;
        let flow = p5.Vector.fromAngle(angle);
        flow.mult(0.05);
        this.acc.add(flow);

        // repulsion from mouse
        let mouse = createVector(mouseX, mouseY);
        let dir = p5.Vector.sub(mouse, this.pos);
        let distance = dir.mag();
        dir.normalize();

        let maxDistance = 30;
        let force = 2;
        let forceMagnitude = map(distance, 0, maxDistance, force, 0);
        forceMagnitude = constrain(forceMagnitude, 0, force);

        let attractorStrength = -1; // negative => repel
        dir.mult(forceMagnitude * attractorStrength);
        this.acc.add(dir);

        this.vel.add(this.acc);
        this.pos.add(this.vel);
        this.acc.mult(0);

        this.lifespan -= 0.5;
    }

    display(pg) {
        pg.noStroke();
        pg.fill(255,0,0, this.lifespan);
        pg.ellipse(this.pos.x, this.pos.y, 4);
    }

    isDead() {
        return this.lifespan <= 0;
    }
}

function updateParticles() {
    // add new
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(windowWidth / 2, windowHeight / 2));
    }
    // update + remove dead
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.update();
        p.display(overlayParticlesGraphics);
        if (p.isDead() ||
            p.pos.x < 0 || p.pos.x > windowWidth ||
            p.pos.y < 0 || p.pos.y > windowHeight) {
            particles.splice(i, 1);
        }
    }
}

// --- Tone.js Setup ---
function setupToneJS() {
    fmSynth = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 20,
        oscillator: {
            type: "sine"
        },
        modulation: {
            type: "sawtooth"
        },
        envelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.6,
            release: 0.8,
        },
        modulationEnvelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.7,
            release: 0.5,
        },
    });

    const distortion = new Tone.Distortion(2.8);

    // Filters
    filter = new Tone.Filter({
        type: "lowpass",
        frequency: 400,
        rolloff: -24,
        Q: 10,
    });

    filter2 = new Tone.Filter({
        type: "lowpass",
        frequency: 1000,
        rolloff: -24,
        Q: 5,
    });

    const cheby = new Tone.Chebyshev(101);
    const crusher = new Tone.BitCrusher(2);

    fmSynth.connect(distortion);
    distortion.connect(crusher);
    crusher.connect(cheby);
    cheby.connect(filter);
    filter.toDestination();

    // LFO
    lfo = new Tone.LFO({
        frequency: "0.1n",
        min: 100,
        max: 1000,
    }).start();
    lfo.connect(filter.frequency);

    // LFO for filter Q
    lfoResonance = new Tone.LFO({
        frequency: "1n",
        min: 0.5,
        max: 8,
    }).start();
    lfoResonance.connect(filter.Q);

    // noise
    noiseSynth = new Tone.Noise("white");
    noiseSynth.volume.value = -12;
    fmSynth.volume.value = -12;

    // autoFilter
    autoFilter = new Tone.AutoFilter({
        frequency: "4n",
        baseFrequency: 200,
        resonance: 0,
        octaves: 2,
    });
    autoFilter.toDestination();
    noiseSynth.connect(autoFilter);
    autoFilter.start();
    autoFilter.connect(filter2);
    filter2.toDestination();

    Tone.Transport.start();
}

// --- Mouse Pressed => user clicks or touches ---
function mousePressed() {
    if (state === "main") {
        // convert coords
        let mx = mouseX - width / 2;
        let my = mouseY - height / 2;
        let d = dist(mx, my, 0, 0);

        if (d <= 50) {
            // overlay
            state = "overlay";
            document.getElementById('overlay').style.display = 'block';
            particles = [];

            if (Tone.Transport.state === 'started') {
                Tone.Transport.stop();
            }
            if (fmSynthPlaying) {
                fmSynth.triggerRelease();
                fmSynthPlaying = false;
            }
            if (noiseSynth && noiseSynth.state === "started") {
                noiseSynth.stop();
            }
            overlayParticlesGraphics.canvas.style.display = 'block';
        } else {
            // start fmSynth if not playing
            if (!fmSynthPlaying) {
                let note = "D2";
                fmSynth.triggerAttack(note);
                fmSynthPlaying = true;
            }
            // start noise
            if (noiseSynth && noiseSynth.state !== "started") {
                noiseSynth.start();
            }
        }
    }
}

// --- Audio Param Updates ---
function updateLFOResonance() {
    // clamp + convert coords
    let cMX = constrain(mouseX, 0, width);
    let cMY = constrain(mouseY, 0, height);

    let mx = cMX - width / 2;
    let my = cMY - height / 2;

    let d = dist(mx, my, 0, 0);
    if (d < 0.001) {
        d = 0.001;
    }
    let maxDist = max(width, height);

    let minFre = 2000;
    let maxFre = 4000;

    let lfoFrequency = map(d, 0.001, maxDist, random(30, 50), 0.01);
    lfoFrequency = max(lfoFrequency, 0.0001);

    let filterFreq = map(d, 0.001, maxDist, maxFre, minFre);
    filterFreq = max(filterFreq, 0.0001);

    let lfoFrequency2 = map(d, maxDist, 0.001, 0.01, 20);
    lfoFrequency2 = max(lfoFrequency2, 0.0001);

    // assign
    lfoResonance.frequency.value = lfoFrequency;
    autoFilter.frequency.value = lfoFrequency2;
    filter2.frequency.value = filterFreq;

    // Q must be > 0
    let newQ = map(cMX, 0, width, 10, 0);
    newQ = max(newQ, 0.0001);
    filter2.Q.value = newQ;

    // harmonicity
    let newHarm = map(cMX, 0, width, 3, 3.1);
    newHarm = max(newHarm, 0.0001);
    fmSynth.harmonicity.value = newHarm;

    // modIndex
    let newModIndex = map(cMY, 0, height, 40, 0);
    newModIndex = max(newModIndex, 0.0001);
    fmSynth.modulationIndex.value = newModIndex;

    let nMax = 0;
    let modulatedVolSynth = constrain(map(sin(millis() / (d / 100)), -1, 1, -10, -5), -50, -10);
    fmSynth.volume.value = modulatedVolSynth;

    let modulatedVolNoise = map(noise(mx, my), 0, 1, random(-40, -10), nMax);
    noiseSynth.volume.value = modulatedVolNoise;

    // adjust LFO min/max if close
    if (d < 50) {
        lfo.min = map(d, 0.001, 60, 60, 30);
        lfo.max = 60;

        // clamp freq
        let tmpFreq = map(d, 0, 50, 100, 0);
        tmpFreq = max(tmpFreq, 0.0001);
        filter2.frequency.value = tmpFreq;

        noiseSynth.volume.value = map(d, 0.001, 50, -5, -100);
    } else {
        lfo.min = 120;
        lfo.max = map(d, 50, maxDist, 200, 2000);
    }
}