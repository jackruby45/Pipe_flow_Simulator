
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- Type Definitions ---
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; alpha: number;
  color: string;
}
type FlowPreset = 'laminar' | 'partially-turbulent' | 'fully-turbulent';
type Equation = 'colebrook' | 'igt' | 'aga';
type ViewMode = 'full' | 'boundary' | 'wall';
interface FrictionResult {
    name: string;
    value: number;
    color: string;
}

// --- DOM Element Selection ---
const appContainer = document.getElementById('app') as HTMLDivElement;
const canvas = document.getElementById('pipelineCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const velocityCanvas = document.getElementById('velocityProfileCanvas') as HTMLCanvasElement;
const vCtx = velocityCanvas.getContext('2d')!;
const explainBtn = document.getElementById('explain-btn') as HTMLButtonElement;
const boundaryDetailBtn = document.getElementById('boundaryDetailBtn') as HTMLButtonElement;
const pipeWallDetailBtn = document.getElementById('pipeWallDetailBtn') as HTMLButtonElement;

const laminarBtn = document.getElementById('laminarBtn') as HTMLButtonElement;
const partiallyTurbulentBtn = document.getElementById('partiallyTurbulentBtn') as HTMLButtonElement;
const fullyTurbulentBtn = document.getElementById('fullyTurbulentBtn') as HTMLButtonElement;
const flowTitle = document.getElementById('flow-title') as HTMLHeadingElement;
const flowText = document.getElementById('flow-text') as HTMLParagraphElement;
const indicatorContainer = document.getElementById('indicator-container') as HTMLDivElement;

const reynoldsSlider = document.getElementById('reynolds-slider') as HTMLInputElement;
const reynoldsInput = document.getElementById('reynolds-input') as HTMLInputElement;

const pipeDiameterSelect = document.getElementById('pipe-diameter-select') as HTMLSelectElement;
const pipeDiameterValue = document.getElementById('pipe-diameter-value') as HTMLSpanElement;
const absRoughnessSlider = document.getElementById('abs-roughness-slider') as HTMLInputElement;
const absRoughnessInput = document.getElementById('abs-roughness-input') as HTMLInputElement;
const relRoughnessInput = document.getElementById('rel-roughness-input') as HTMLInputElement;

const colebrookToggle = document.getElementById('colebrook-toggle') as HTMLInputElement;
const igtToggle = document.getElementById('igt-toggle') as HTMLInputElement;
const agaToggle = document.getElementById('aga-toggle') as HTMLInputElement;
const colebrookExplanation = document.getElementById('colebrook-explanation') as HTMLParagraphElement;
const igtExplanation = document.getElementById('igt-explanation') as HTMLParagraphElement;
const agaExplanation = document.getElementById('aga-explanation') as HTMLParagraphElement;


const metricState = document.getElementById('metric-state') as HTMLSpanElement;
const metricRe = document.getElementById('metric-re') as HTMLSpanElement;
const metricDiameter = document.getElementById('metric-diameter') as HTMLSpanElement;
const metricRoughness = document.getElementById('metric-roughness') as HTMLSpanElement;
const metricRelRoughness = document.getElementById('metric-rel-roughness') as HTMLSpanElement;
const frictionFactorMetrics = document.getElementById('friction-factor-metrics') as HTMLDivElement;

const mainContainer = document.querySelector('main') as HTMLElement;
const resizer = document.getElementById('resizer') as HTMLDivElement;
const vizColumn = document.getElementById('viz-column') as HTMLDivElement;
const sidebarColumn = document.getElementById('sidebar-column') as HTMLDivElement;
const verticalResizer = document.getElementById('vertical-resizer') as HTMLDivElement;
const pipeContainer = document.querySelector('.pipe-container') as HTMLDivElement;
const velocityContainer = document.querySelector('.velocity-container') as HTMLDivElement;

const moodyDiagramContainer = document.getElementById('moody-diagram-container') as HTMLDivElement;
const moodyTitle = document.getElementById('moody-title') as HTMLHeadingElement;

// Tab elements
const diagramTabBtn = document.getElementById('diagram-tab-btn') as HTMLButtonElement;
const aboutTabBtn = document.getElementById('about-tab-btn') as HTMLButtonElement;
const presentationTabBtn = document.getElementById('presentation-tab-btn') as HTMLButtonElement;
const diagramTabContent = document.getElementById('diagram-tab-content') as HTMLDivElement;
const aboutTabContent = document.getElementById('about-tab-content') as HTMLDivElement;
const presentationTabContent = document.getElementById('presentation-tab-content') as HTMLDivElement;


// --- Constants & State ---
const PARTICLE_COUNT = 300;
const WALL_BUFFER = 5;
const LERP_FACTOR = 0.05; // Smoothing factor for transitions
const RE_MAX = 30000000;

const ROUGHNESS_LEVELS = [
    { id: 'curve-0_05', value: 0.05, label: '0.05000' }, { id: 'curve-0_04', value: 0.04, label: '0.04000' },
    { id: 'curve-0_03', value: 0.03, label: '0.03000' }, { id: 'curve-0_02', value: 0.02, label: '0.02000' },
    { id: 'curve-0_015', value: 0.015, label: '0.01500' }, { id: 'curve-0_01', value: 0.01, label: '0.01000' },
    { id: 'curve-0_005', value: 0.005, label: '0.00500' }, { id: 'curve-0_002', value: 0.002, label: '0.00200' },
    { id: 'curve-0_001', value: 0.001, label: '0.00100' }, { id: 'curve-0_0005', value: 5e-4, label: '0.00050' },
    { id: 'curve-0_0002', value: 2e-4, label: '0.00020' }, { id: 'curve-0_0001', value: 1e-4, label: '0.00010' },
    { id: 'curve-smooth', value: 0, label: 'Smooth' },
];

const PIPE_SCHEDULE_40_IDS_IN = new Map([
  ['2"', 2.067], ['3"', 3.068], ['4"', 4.026], ['6"', 6.065], ['8"', 7.981], ['10"', 10.020],
  ['12"', 11.938], ['14"', 13.124], ['16"', 15.000], ['18"', 16.876], ['20"', 18.812], ['24"', 22.624],
]);

let particles: Particle[] = [];
let animationFrameId: number;
let currentProfile: number[] = [];
let showExplanation = false;
let explanationAnimationStartTimestamp: number | null = null;
let roughnessProfile: number[] = [];
let minRoughnessValue = 1.0;

// --- Dynamic State ---
let currentViewMode: ViewMode = 'full';
let currentRe = 2000;
let targetRe = 2000;
let currentF = 0; // Primary friction factor for physics (Colebrook)
let currentPipeDiameterIN = 4.026; // Default to 4"
let absoluteRoughnessIN = 0.0018; // Default for new commercial steel in inches

let activeEquations = {
    colebrook: true,
    igt: false,
    aga: false
};

// --- State for Draggable Annotations ---
const annotationOffsets: Map<string, {x: number, y: number}> = new Map();
let currentFrameHitboxes: {id: string, rect: {x: number, y: number, width: number, height: number}}[] = [];
let draggedAnnotationId: string | null = null;
let isDragging = false;
let dragStartPos = { x: 0, y: 0 };
let dragStartOffset = { x: 0, y: 0 };


const flowDescriptions = {
    laminar: { title: 'Laminar Flow', text: 'In laminar flow (Re < 2300), gas molecules move in smooth, parallel layers. Friction is governed by viscosity and is independent of pipe roughness.' },
    transition: { title: 'Transition Flow', text: 'In the transition zone (2300 < Re < 4000), flow begins to lose its stability. It is an unpredictable mixture of laminar and turbulent characteristics.'},
    turbulent: { title: 'Partially Turbulent Flow', text: 'The friction factor depends on both Reynolds number and pipe roughness. This corresponds to the sloped portion of the curves, as described by the full Colebrook-White equation.' },
    'fully-turbulent': { title: 'Complete Turbulence', text: 'At very high Reynolds numbers, friction becomes independent of Re and is only a function of the pipe\'s roughness. This corresponds to the flat, horizontal portion of the curves.'}
};

const presetReValues: Record<FlowPreset, number> = {
    laminar: 2000,
    'partially-turbulent': 20000,
    'fully-turbulent': 15000000,
};

// --- Physics Calculations ---
function calculateSwameeJain(re: number, roughness: number): number {
     const logTerm = Math.log10((roughness / 3.7) + (5.74 / Math.pow(re, 0.9)));
     return 0.0625 / Math.pow(logTerm, 2);
}

function calculateAgaFriction(roughness: number): number {
    if (roughness <= 0) return NaN; // Avoid log error for smooth pipe
    // This is the von Karman equation for fully rough pipes (Fanning friction factor)
    return 1 / Math.pow(4 * Math.log10(3.7 / roughness), 2);
}

/**
 * Provides a single source of truth for flow properties, returning both the friction
 * factor and the flow state to ensure UI and physics are always synchronized.
 */
function getFlowProperties(re: number, roughness: number): { friction: number, state: keyof typeof flowDescriptions } {
    if (re <= 2300) {
        return { friction: 16 / re, state: 'laminar' };
    }
    if (re > 2300 && re < 4000) {
        const laminarF = 16 / re;
        const turbulentF = calculateSwameeJain(4000, roughness);
        const blend = (re - 2300) / (4000 - 2300);
        const friction = laminarF * (1 - blend) + turbulentF * blend;
        return { friction, state: 'transition' };
    }

    // Turbulent Flow (Re >= 4000)
    const f_approx = calculateSwameeJain(re, roughness);

    // Check for Complete Turbulence (fully rough flow)
    if (roughness > 0) {
        const viscousTerm = 2.51 / (re * Math.sqrt(f_approx));
        const roughnessTerm = roughness / 3.7;
        // If the viscous term is less than 2% of the roughness term, it's negligible.
        if (viscousTerm < 0.02 * roughnessTerm) {
            const friction = calculateAgaFriction(roughness);
            return { friction, state: 'fully-turbulent' };
        }
    }
    
    // Otherwise, it's partially turbulent.
    return { friction: f_approx, state: 'turbulent' };
}


function calculateIgtFriction(re: number): number {
    // The IGT model represents turbulent flow in a perfectly smooth pipe.
    return getFlowProperties(re, 0).friction;
}

function calculateFrictionContribution(re: number, relativeRoughness: number): { viscosity: number, roughness: number } {
    if (re <= 4000 || relativeRoughness <= 0) {
        // In laminar, transition, or for a perfectly smooth pipe, friction is 100% due to viscosity.
        return { viscosity: 100, roughness: 0 };
    }

    // These terms are from the Swamee-Jain approximation, representing the two
    // main drivers of friction in the Colebrook equation.
    const roughnessTerm = relativeRoughness / 3.7;
    const viscousTerm = 5.74 / Math.pow(re, 0.9);

    const totalContribution = roughnessTerm + viscousTerm;
    if (totalContribution === 0) {
        return { viscosity: 100, roughness: 0 };
    }

    const viscosityPercent = (viscousTerm / totalContribution) * 100;
    const roughnessPercent = (roughnessTerm / totalContribution) * 100;

    return { viscosity: viscosityPercent, roughness: roughnessPercent };
}


function mapLog(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
    if (value <= fromMin) return toMin;
    if (value >= fromMax) return toMax;
    const logValue = Math.log10(value);
    const logMin = Math.log10(fromMin);
    const logMax = Math.log10(fromMax);
    const percent = (logValue - logMin) / (logMax - logMin);
    return toMin + percent * (toMax - toMin);
}

function calculateIndicatorPosition(re: number, f: number) {
    const svgWidth = 500;
    const svgHeight = 360; // Use the SVG's viewBox height

    const x = mapReToX(re);
    const y = mapFToY(f);
    
    if (y < mapFToY(0.025) || y > mapFToY(0.002)) {
         return null;
    }

    const left = (x / svgWidth) * 100;
    const top = (y / svgHeight) * 100;
    
    return { top: `${top}%`, left: `${left}%` };
}

// --- Visual Helpers ---
function getColorForVelocity(velocity: number, maxVelocity: number): string {
    const ratio = Math.min(1, Math.max(0, velocity / maxVelocity));
    const hue = 40 + (1 - ratio) * 180; // Interpolate from yellow (60) to blue (220)
    return `hsl(${hue}, 90%, 65%)`;
}

// --- Moody Diagram Generation ---
function mapReToX(re: number): number {
    const reMin = 1000, reMax = RE_MAX;
    const xMin = 60, xMax = 480;
    return mapLog(re, reMin, reMax, xMin, xMax);
}

function mapFToY(f: number): number {
    const fMin = 0.002, fMax = 0.025; // Fanning scale
    const yMin = 307, yMax = 88; // Calibrated to SVG grid lines
    return mapLog(f, fMin, fMax, yMin, yMax);
}

function renderMoodyDiagramPaths() {
    const moodyCurvesGroup = document.querySelector('.moody-curves');
    if (!moodyCurvesGroup) return;

    moodyCurvesGroup.innerHTML = ''; // Clear old paths

    const pointCount = 400;
    const plotReValues = Array.from({ length: pointCount }, (_, i) =>
        Math.pow(10, Math.log10(2300) + i * (Math.log10(RE_MAX) - Math.log10(2300)) / (pointCount - 1))
    );

    ROUGHNESS_LEVELS.forEach(level => {
        const pathPoints = [];
        if (level.value === 0) {
            for (const re of plotReValues) {
                 const f = getFlowProperties(re, level.value).friction;
                 pathPoints.push(`${mapReToX(re).toFixed(2)},${mapFToY(f).toFixed(2)}`);
            }
        } else {
             for (const re of plotReValues) {
                const f = getFlowProperties(re, level.value).friction;
                if (f < 0.002 || f > 0.025) continue;
                pathPoints.push(`${mapReToX(re).toFixed(2)},${mapFToY(f).toFixed(2)}`);
            }
        }

        if (pathPoints.length > 1) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'moody-curve');
            path.setAttribute('id', level.id);
            path.setAttribute('d', `M ${pathPoints.join(' L ')}`);
            moodyCurvesGroup.appendChild(path);

            if (level.value > 0) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                const lastPoint = pathPoints[pathPoints.length - 1].split(',');
                const lastY = parseFloat(lastPoint[1]);
                text.setAttribute('class', 'label');
                text.setAttribute('text-anchor', 'end');
                text.setAttribute('x', '498');
                text.setAttribute('y', lastY.toFixed(2));
                text.setAttribute('dy', '0.3em');
                text.textContent = level.label;
                moodyCurvesGroup.appendChild(text);
            }
        }
    });

    const laminarPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    laminarPath.setAttribute('class', 'moody-curve');
    laminarPath.setAttribute('id', 'laminar-flow');
    laminarPath.setAttribute('stroke-width', '2');
    const x1 = mapReToX(1000), y1 = mapFToY(getFlowProperties(1000, 0).friction);
    const x2 = mapReToX(2300), y2 = mapFToY(getFlowProperties(2300, 0).friction);
    laminarPath.setAttribute('d', `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`);
    moodyCurvesGroup.appendChild(laminarPath);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'region-label');
    const smoothCurve = ROUGHNESS_LEVELS.find(l => l.value === 0)!;
    const smoothF = getFlowProperties(RE_MAX * 0.5, 0).friction;
    text.setAttribute('x', mapReToX(RE_MAX * 0.5).toFixed(2));
    text.setAttribute('y', (mapFToY(smoothF) + 10).toFixed(2));
    text.setAttribute('text-anchor', 'end');
    text.textContent = 'Smooth Pipe';
    moodyCurvesGroup.appendChild(text);
}


// --- Canvas & Particle Initialization ---
function setupCanvas(canvasEl: HTMLCanvasElement): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasEl.getBoundingClientRect();
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;
    const context = canvasEl.getContext('2d')!;
    context.scale(dpr, dpr);
}

function createParticle(): Particle {
    const common = {
        vx: 0, vy: 0,
        radius: Math.random() * 1.5 + 1,
        alpha: Math.random() * 0.5 + 0.3,
        color: '#a7c5eb'
    };
    switch (currentViewMode) {
        case 'boundary':
            return {
                ...common,
                x: Math.random() * canvas.clientWidth,
                y: Math.random() * (canvas.clientHeight * 0.7), // Start in upper 70%
            };
        case 'wall':
             return {
                ...common,
                x: Math.random() * canvas.clientWidth,
                y: Math.random() * canvas.clientHeight,
                radius: Math.random() * 2 + 1, // slightly bigger particles to see
            };
        case 'full':
        default:
            return {
                ...common,
                x: Math.random() * canvas.clientWidth,
                y: Math.random() * canvas.clientHeight,
            };
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle());
    }
     // Create a random profile for the bumpy wall in the detail view
    roughnessProfile = [];
    minRoughnessValue = 1.0;
    const width = Math.max(1, canvas.clientWidth); // Ensure width is at least 1
    for (let i = 0; i < width; i++) {
        const r = Math.random();
        roughnessProfile.push(r);
        if (r < minRoughnessValue) {
            minRoughnessValue = r;
        }
    }
}

// --- Flow Logic (influenced by currentRe) ---
function updateParticleInFullView(p: Particle, re: number, f: number) {
    const normalizedY = p.y / canvas.clientHeight;
    const distFromCenter = Math.abs(normalizedY - 0.5) * 2; // 0 at center, 1 at wall

    if (re <= 2300) { // Exaggerated Laminar Flow
        const velocityFactor = 1 - Math.pow(distFromCenter, 2);
        p.vx = (Math.pow(velocityFactor, 2) * 8) + 0.1;
        p.vy = 0;
    } else { // Exaggerated Turbulent Flow
        const exponent = (2 * Math.sqrt(f)) / 2.2;
        const baseVelocityFactor = Math.pow(1 - distFromCenter, exponent);
        const turbulenceFactor = Math.max(0, Math.log10(re / 2000)) * 2;
        const baseVx = baseVelocityFactor * 6 + 1;
        p.vx = baseVx + (Math.random() - 0.5) * turbulenceFactor * 6;
        p.vy = (Math.random() - 0.5) * turbulenceFactor * 8;
    }

    p.x += p.vx;
    p.y += p.vy;

    // --- Collision Logic ---
    const boundaryLayerThickness = (re > 2300) ? mapLog(re, 2301, RE_MAX, 30, 5) : 0;
    // For laminar, collide with the wall. For turbulent, collide with the boundary layer.
    const topCollisionY = WALL_BUFFER + (re > 2300 ? boundaryLayerThickness : 0);
    const bottomCollisionY = canvas.clientHeight - WALL_BUFFER - (re > 2300 ? boundaryLayerThickness : 0);
    
    if (p.y - p.radius < topCollisionY) {
        p.y = topCollisionY + p.radius;
        p.vy *= -0.5;
    }
    if (p.y + p.radius > bottomCollisionY) {
        p.y = bottomCollisionY - p.radius;
        p.vy *= -0.5;
    }
    
    if (p.x > canvas.clientWidth + p.radius) {
        p.x = -p.radius;
        p.y = Math.random() * canvas.clientHeight;
    }
    p.color = getColorForVelocity(p.vx, 12);
}

function updateParticleInDetailView(p: Particle, re: number, roughnessHeight: number, sublayerThickness: number) {
    const wallBaseY = canvas.clientHeight * 0.8;
    const roughnessXIndex = Math.max(0, Math.min(Math.floor(p.x), roughnessProfile.length - 1));
    const physicalWallY = wallBaseY - roughnessProfile[roughnessXIndex] * roughnessHeight;
    const sublayerTopY = wallBaseY - sublayerThickness;
    
    // The particle collides with the highest surface: either the sublayer or a roughness peak.
    const collisionSurfaceY = Math.min(physicalWallY, sublayerTopY);

    // Base velocity in the free stream
    let baseVx = mapLog(re, 2301, RE_MAX, 4, 15);
    let turbulenceFactor = Math.max(0, Math.log10(re / 2000)) * 2;

    p.vy += (Math.random() - 0.5) * turbulenceFactor * 0.2; // Gravity/settling effect
    p.vx = baseVx + (Math.random() - 0.5) * turbulenceFactor;

    if (p.y > sublayerTopY) { // Inside boundary/sublayer
        const depthRatio = (p.y - sublayerTopY) / (wallBaseY - sublayerTopY);
        p.vx *= (1 - depthRatio * 0.9); // Slow down significantly near wall
        p.vy *= 0.5; // Dampen vertical motion
    }

    p.x += p.vx;
    p.y += p.vy;

    // Collision with the effective wall (sublayer or roughness peak)
    if (p.y + p.radius > collisionSurfaceY) {
        p.y = collisionSurfaceY - p.radius;
        p.vx *= 0.8;
        p.vy *= -0.4; // Bounce off
        
        // Create an eddy only if it hits the rough physical wall
        if (collisionSurfaceY === physicalWallY) {
             p.vy += (Math.random() - 0.8) * 4;
             p.vx += (Math.random() - 0.5) * 4;
        }
    }
    
    // Reset particle
    if (p.x > canvas.clientWidth + p.radius) {
        p.x = -p.radius;
        p.y = Math.random() * (canvas.clientHeight * 0.7);
    }
    if (p.y < -p.radius) { // If it flies off the top
        p.y = 0;
    }
    p.color = getColorForVelocity(p.vx, 16);
}

function updateParticleInWallDetailView(p: Particle, re: number, roughnessHeight: number, sublayerThickness: number) {
    const wallBaseY = canvas.clientHeight * 0.75;
    const sublayerTopY = wallBaseY - sublayerThickness;

    // Ensure index is within bounds, handling wrapping
    const roughnessXIndex = Math.floor(p.x + canvas.clientWidth) % canvas.clientWidth;
    const physicalWallY = wallBaseY - roughnessProfile[roughnessXIndex] * roughnessHeight;
    const collisionSurfaceY = Math.min(physicalWallY, sublayerTopY);

    // 1. Update velocities based on current position
    if (p.y > sublayerTopY) { // Inside sublayer or between peaks
        p.vx += (Math.random() - 0.5) * 1.5 - (p.vx * 0.1);
        p.vy += (Math.random() - 0.5) * 1.5 - (p.vy * 0.1);
    } else { // Free stream
        p.vx = 1 + Math.random();
        p.vy += (Math.random() - 0.5) * 0.5;
    }
    
    // 2. Update position
    p.x += p.vx;
    p.y += p.vy;

    // 3. Handle collisions with the effective wall
    if (p.y + p.radius > collisionSurfaceY) {
        p.y = collisionSurfaceY - p.radius;
        p.vx *= -0.3;
        p.vy *= -0.5;
    }

    // 4. Handle particle reset if it goes offscreen
    if (p.x > canvas.clientWidth + p.radius) {
        p.x = -p.radius;
        p.y = Math.random() * (sublayerTopY - 20); // Respawn above sublayer
    } else if (p.x < -p.radius) {
        p.x = canvas.clientWidth + p.radius;
        p.y = Math.random() * (sublayerTopY - 20); // Respawn above sublayer
    }
    if (p.y < -p.radius) {
        p.y = 0;
        p.x = Math.random() * canvas.clientWidth;
    }
    
    p.color = getColorForVelocity(Math.hypot(p.vx, p.vy), 4);
}


// --- Velocity Profile Logic ---
function calculateProfile(re: number, f: number, height: number): number[] {
    const profile: number[] = [];
    const points = Math.floor(height);
    let exponent;

    if (re <= 2300) { // Laminar
        exponent = 0.5;
    } else { // Turbulent Power Law Approximation
        exponent = (2 * Math.sqrt(f)) / 2.2;
    }

    for (let i = 0; i <= points; i++) {
        const y_norm = i / points;
        const r_norm = (y_norm - 0.5) * 2;
        let velocity = Math.pow(1 - Math.abs(r_norm), exponent);
        profile.push(velocity);
    }
    return profile;
}

function drawVelocityProfile(profile: number[]) {
    vCtx.clearRect(0, 0, velocityCanvas.clientWidth, velocityCanvas.clientHeight);
    if (profile.length === 0) return;
    
    const padding = 10;
    const graphWidth = velocityCanvas.clientWidth - padding;

    const gradient = vCtx.createLinearGradient(0, 0, 0, velocityCanvas.clientHeight);
    gradient.addColorStop(0, '#4a90e2');
    gradient.addColorStop(0.5, '#f5a623');
    gradient.addColorStop(1, '#4a90e2');

    vCtx.beginPath();
    vCtx.moveTo(padding, 0);
    profile.forEach((velocity, i) => {
        const x = padding + velocity * (graphWidth - padding);
        const y = i * (velocityCanvas.clientHeight / profile.length);
        vCtx.lineTo(x, y);
    });
    vCtx.lineTo(padding, velocityCanvas.clientHeight);
    vCtx.closePath();

    vCtx.fillStyle = gradient;
    vCtx.globalAlpha = 0.6;
    vCtx.fill();
    vCtx.globalAlpha = 1.0;

    vCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    vCtx.lineWidth = 2;
    vCtx.stroke();
}

function drawPipe3D() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    const pipeTopY = WALL_BUFFER;
    const pipeBottomY = height - WALL_BUFFER;

    // Draw the pipe walls
    ctx.fillStyle = '#4a5568'; // A dark gray for the pipe material
    // Top wall
    ctx.fillRect(0, 0, width, pipeTopY);
    // Bottom wall
    ctx.fillRect(0, pipeBottomY, width, height);

    // Add a highlight to the top inner edge for a 3D feel
    const topHighlightGradient = ctx.createLinearGradient(0, pipeTopY, 0, pipeTopY + 5);
    topHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    topHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = topHighlightGradient;
    ctx.fillRect(0, pipeTopY, width, 5);
    
    // Add a shadow to the bottom inner edge
    const bottomShadowGradient = ctx.createLinearGradient(0, pipeBottomY - 5, 0, pipeBottomY);
    bottomShadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomShadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = bottomShadowGradient;
    ctx.fillRect(0, pipeBottomY - 5, width, 5);
}

/**
 * Draws a visual, animated representation of the boundary layer.
 * This layer is only shown for turbulent flow, is more prominent, and has a
 * subtle shimmer effect to make it feel more dynamic.
 */
function drawBoundaryLayer(ctx: CanvasRenderingContext2D, re: number, time: number) {
    if (re <= 2300) return; // Only show for transition/turbulent flow

    const width = ctx.canvas.clientWidth;
    const height = ctx.canvas.clientHeight;
    const pipeTopY = WALL_BUFFER;
    const pipeBottomY = height - WALL_BUFFER;

    // The boundary layer gets thinner as Re increases.
    const thickness = mapLog(re, 2301, RE_MAX, 30, 5);

    // --- Use a contrasting, theme-aligned color ---
    const baseColor = '233, 69, 96'; // App's secondary color (red-pink)

    // Top Layer Gradient
    const topGradient = ctx.createLinearGradient(0, pipeTopY, 0, pipeTopY + thickness);
    topGradient.addColorStop(0, `rgba(${baseColor}, 0.35)`); // More opaque at the wall
    topGradient.addColorStop(1, `rgba(${baseColor}, 0)`);    // Fades to transparent
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, pipeTopY, width, thickness);

    // Bottom Layer Gradient
    const bottomGradient = ctx.createLinearGradient(0, pipeBottomY - thickness, 0, pipeBottomY);
    bottomGradient.addColorStop(0, `rgba(${baseColor}, 0)`);
    bottomGradient.addColorStop(1, `rgba(${baseColor}, 0.35)`);
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, pipeBottomY - thickness, width, thickness);

    // --- Animated Shimmering Edge ---
    const waveAmplitude = 1.5;
    const waveFrequency = 0.005;
    const waveSpeed = 0.0005;

    ctx.beginPath();
    ctx.moveTo(0, pipeTopY + thickness);
    for (let x = 0; x < width; x++) {
        const yOffset = Math.sin(x * waveFrequency + time * waveSpeed) * waveAmplitude;
        ctx.lineTo(x, pipeTopY + thickness + yOffset);
    }
    ctx.strokeStyle = `rgba(${baseColor}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pipeBottomY - thickness);
    for (let x = 0; x < width; x++) {
        const yOffset = Math.sin(x * waveFrequency + time * waveSpeed) * waveAmplitude;
        ctx.lineTo(x, pipeBottomY - thickness - yOffset);
    }
    ctx.strokeStyle = `rgba(${baseColor}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.stroke();
}


// --- Helper Functions for Drawing ---
const drawTextWithBackground = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    textAlign: CanvasTextAlign = 'center',
    id?: string
) => {
    let finalX = x;
    let finalY = y;
    if (id) {
        const offset = annotationOffsets.get(id) || { x: 0, y: 0 };
        finalX += offset.x;
        finalY += offset.y;
    }

    ctx.font = 'bold 14px "Roboto", sans-serif';
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(text);
    const hPadding = 15; // Increased horizontal padding
    const vPadding = 12; // Increased vertical padding
    const textHeight = (textMetrics.actualBoundingBoxAscent || 14) + (textMetrics.actualBoundingBoxDescent || 2);
    const rectHeight = textHeight + vPadding * 2;
    const rectWidth = textMetrics.width + hPadding * 2;
    
    let rectX;
    if (textAlign === 'left') rectX = finalX - hPadding;
    else if (textAlign === 'right') rectX = finalX - rectWidth + hPadding;
    else rectX = finalX - rectWidth / 2;
    
    const rectY = finalY - rectHeight / 2;

    ctx.fillStyle = 'rgba(22, 33, 62, 0.85)';
    ctx.strokeStyle = '#e94560'; // Red border for consistency
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rectX, rectY, rectWidth, rectHeight, 6);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = 'white';
    ctx.fillText(text, finalX, finalY);
    
    const hitbox = { x: rectX, y: rectY, width: rectWidth, height: rectHeight };
    if (id) {
        currentFrameHitboxes.push({ id, rect: hitbox });
    }
    return hitbox;
};

const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, progress = 1.0, headLength = 8) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const currentToX = fromX + dx * progress;
    const currentToY = fromY + dy * progress;
    const angle = Math.atan2(dy, dx);
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(currentToX, currentToY);
    
    if (progress === 1.0) {
        ctx.moveTo(currentToX, currentToY);
        ctx.lineTo(currentToX - headLength * Math.cos(angle - Math.PI / 6), currentToY - headLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(currentToX, currentToY);
        ctx.lineTo(currentToX - headLength * Math.cos(angle + Math.PI / 6), currentToY - headLength * Math.sin(angle + Math.PI / 6));
    }
    ctx.stroke();
};

const drawFormattedText = (ctx: CanvasRenderingContext2D, lines: string[], startX: number, startY: number, lineHeight: number) => {
    ctx.textBaseline = 'top';
    let currentY = startY;

    lines.forEach(line => {
        let textToDraw = line;
        let isBold = line.startsWith('<b>');
        if (isBold) {
            ctx.font = 'bold 12px "Roboto", sans-serif';
            textToDraw = line.replace(/<b>|<\/b>/g, '');
        } else {
            ctx.font = '12px "Roboto", sans-serif';
        }
        
        ctx.fillStyle = 'white';
        ctx.fillText(textToDraw, startX, currentY);
        currentY += lineHeight;
    });
}

const drawInfoBox = (
    ctx: CanvasRenderingContext2D,
    title: string,
    lines: string[],
    easeOutProgress = 1.0,
    id?: string
) => {
    let offsetX = 0;
    let offsetY = 0;
    let easeOffset = (1 - easeOutProgress) * -50;

    if (id) {
        const offset = annotationOffsets.get(id) || { x: 0, y: 0 };
        offsetX = offset.x;
        offsetY = offset.y;
        // Stop animating if it has been dragged
        if (annotationOffsets.has(id)) {
            easeOffset = 0;
        }
    }

    const lineHeight = 18;
    const padding = 15; // Generous padding
    const titleHeight = 22;

    // --- DYNAMIC WIDTH CALCULATION ---
    let maxWidth = 0;
    // Measure title width
    ctx.font = 'bold 13px "Roboto", sans-serif';
    maxWidth = Math.max(maxWidth, ctx.measureText(title).width);
    // Measure content lines width
    lines.forEach(line => {
        const isBold = line.startsWith('<b>');
        ctx.font = isBold ? 'bold 12px "Roboto", sans-serif' : '12px "Roboto", sans-serif';
        const textToMeasure = line.replace(/<b>|<\/b>/g, '');
        maxWidth = Math.max(maxWidth, ctx.measureText(textToMeasure).width);
    });
    const boxWidth = maxWidth + padding * 2;
    // --- END DYNAMIC WIDTH CALCULATION ---

    const boxHeight = padding * 2 + titleHeight + (lines.length * lineHeight);
    const boxX = 15 + easeOffset;
    const boxY = ctx.canvas.clientHeight - boxHeight - 15;

    const finalX = boxX + offsetX;
    const finalY = boxY + offsetY;


    ctx.fillStyle = 'rgba(22, 33, 62, 0.85)';
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(finalX, finalY, boxWidth, boxHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 13px "Roboto", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, finalX + padding, finalY + padding);
    
    drawFormattedText(ctx, lines, finalX + padding, finalY + padding + titleHeight, lineHeight);

    const hitbox = { x: finalX, y: finalY, width: boxWidth, height: boxHeight };
    if (id) {
        currentFrameHitboxes.push({ id, rect: hitbox });
    }
    return hitbox;
};


/**
 * Draws the "Explain" overlay for the full pipe view.
 */
function drawExplanationOverlay(
    ctx: CanvasRenderingContext2D,
    re: number,
    uiFlowState: keyof typeof flowDescriptions,
    physicsFlowState: keyof typeof flowDescriptions,
    time: number
) {
    if (!showExplanation) return;

    const ANIMATION_DURATION = 500; // ms
    const elapsed = time - explanationAnimationStartTimestamp!;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1.0);
    const easeOutProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic for smooth appearance

    const width = ctx.canvas.clientWidth;
    const height = ctx.canvas.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.save();
    ctx.globalAlpha = easeOutProgress;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;

    if (uiFlowState === 'laminar' || uiFlowState === 'transition') {
        const text1 = drawTextWithBackground(ctx, 'Smooth, parallel layers', 100, 40, 'center', 'explain-laminar-1');
        drawArrow(ctx, text1.x + text1.width/2, text1.y + text1.height, 100, 85, progress);

        const text2 = drawTextWithBackground(ctx, 'Max Velocity at Center', centerX, centerY - 40, 'center', 'explain-laminar-2');
        drawArrow(ctx, text2.x + text2.width/2, text2.y + text2.height, centerX, centerY, progress);

        const text3 = drawTextWithBackground(ctx, 'Velocity ≈ 0 at Wall', width - 100, WALL_BUFFER + 25, 'center', 'explain-laminar-3');
        drawArrow(ctx, text3.x + text3.width/2, text3.y + text3.height, width - 100, WALL_BUFFER + 5, progress);

        drawInfoBox(ctx, 'Laminar Flow Impact', [
            '<b>Friction Driver:</b> Fluid Viscosity',
            '<b>Pressure Drop:</b> Minimal & Predictable',
            'Flow is stable and predictable, with',
            'low energy loss.',
            ' ',
            '∙ Note: Darcy f_D = 4 x Fanning f'
        ], easeOutProgress, 'explain-laminar-infobox');

    } else { // Turbulent states
        const eddyX = centerX + 80;
        const eddyY = centerY + 30;
        const eddyRadius = 20;

        const text1 = drawTextWithBackground(ctx, 'Chaotic Eddies & Mixing', eddyX, eddyY - eddyRadius - 25, 'center', 'explain-turb-1');
        drawArrow(ctx, text1.x + text1.width/2, text1.y + text1.height, eddyX, eddyY - eddyRadius, progress);
        ctx.beginPath();
        ctx.arc(eddyX, eddyY, eddyRadius * progress, 0, Math.PI * 2);
        ctx.stroke();
        
        drawTextWithBackground(ctx, 'Flatter Velocity Profile', centerX, height - 40, 'center', 'explain-turb-2');
        ctx.beginPath();
        const arrowStart = centerX - 70;
        ctx.moveTo(arrowStart, height - 25);
        ctx.lineTo(arrowStart + 140 * progress, height - 25);
        ctx.stroke();

        const boundaryLayerThickness = mapLog(re, 2301, RE_MAX, 30, 5);
        const boundaryLayerYTop = WALL_BUFFER + boundaryLayerThickness;

        if (physicsFlowState === 'fully-turbulent') {
            const text3 = drawTextWithBackground(ctx, 'Thin Boundary Layer', 100, boundaryLayerYTop + 20, 'center', 'explain-turb-3');
            drawArrow(ctx, text3.x + text3.width/2, text3.y, 100, boundaryLayerYTop - 5, progress);
            drawInfoBox(ctx, 'Complete Turbulence Impact', [
                '<b>Friction Driver:</b> Pipe Roughness',
                '<b>Pressure Drop:</b> Maximum',
                'Friction is now independent of Re.',
                'Further increases in velocity do not',
                'make the flow "smoother".',
                '∙ Note: Darcy f_D = 4 x Fanning f'
            ], easeOutProgress, 'explain-fullyturb-infobox');
        } else { // Partially turbulent
            const text3 = drawTextWithBackground(ctx, 'Thicker Boundary Layer', 100, boundaryLayerYTop + 20, 'center', 'explain-turb-3');
            drawArrow(ctx, text3.x + text3.width/2, text3.y, 100, boundaryLayerYTop - 5, progress);
            drawInfoBox(ctx, 'Partial Turbulence Impact', [
                '<b>Friction Driver:</b> Re & Roughness',
                '<b>Pressure Drop:</b> High',
                'The boundary layer partially shields',
                'the main flow from the pipe wall,',
                'but mixing still causes high energy loss.',
                '∙ Note: Darcy f_D = 4 x Fanning f'
            ], easeOutProgress, 'explain-partturb-infobox');
        }
    }
    ctx.restore();
}

/**
 * Draws the specialized close-up view of the boundary layer.
 */
function drawBoundaryDetailView(ctx: CanvasRenderingContext2D, re: number, absRoughness: number) {
    const width = ctx.canvas.clientWidth;
    const height = ctx.canvas.clientHeight;

    const wallBaseY = height * 0.8;
    const zoomFactor = 2000; // Exaggerate roughness for visibility
    const roughnessHeight = absRoughness * zoomFactor;

    // The viscous sublayer gets thinner as Re increases.
    const sublayerThickness = mapLog(re, 2301, RE_MAX, 80, 5);
    const sublayerTopY = wallBaseY - sublayerThickness;
    
    // --- Draw Wall & Sublayer ---
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, wallBaseY);
    for (let x = 0; x < width; x++) {
        ctx.lineTo(x, wallBaseY - roughnessProfile[x] * roughnessHeight);
    }
    ctx.lineTo(width, wallBaseY);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    
    // Draw viscous sublayer
    const sublayerGradient = ctx.createLinearGradient(0, sublayerTopY, 0, wallBaseY);
    sublayerGradient.addColorStop(0, 'rgba(74, 144, 226, 0)');
    sublayerGradient.addColorStop(1, 'rgba(74, 144, 226, 0.5)');
    ctx.fillStyle = sublayerGradient;
    ctx.fillRect(0, sublayerTopY, width, sublayerThickness);
    
    // --- Draw Annotations ---
    ctx.save();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;

    const isSmooth = sublayerThickness > roughnessHeight;

    if (isSmooth) {
        drawInfoBox(ctx, 'Hydraulically Smooth Flow', [
            'The viscous sublayer is thicker than the',
            'roughness elements, effectively "hiding"',
            'them from the main flow.',
            '<b>Friction Driver:</b> Fluid Viscosity (Re)',
            'Particles flow smoothly over the buffered surface.'
        ], 1.0, 'boundary-infobox');

        const textRect = drawTextWithBackground(ctx, 'Roughness elements buried in sublayer', width / 2, wallBaseY - roughnessHeight - 20, 'center', 'boundary-text-1');
        drawArrow(ctx, textRect.x + textRect.width / 2, textRect.y + textRect.height, textRect.x + textRect.width / 2, wallBaseY - roughnessHeight);
    } else {
        drawInfoBox(ctx, 'Rough Flow', [
            'Roughness elements pierce the viscous sublayer,',
            'entering the faster-moving turbulent flow.',
            '<b>Friction Driver:</b> Pipe Roughness (ε)',
            'Collisions create eddies, causing significant',
            'energy loss.'
        ], 1.0, 'boundary-infobox');
        const textRect = drawTextWithBackground(ctx, 'Roughness pierces sublayer', width / 2 + 50, wallBaseY - roughnessHeight - 40, 'center', 'boundary-text-1');
        drawArrow(ctx, textRect.x + textRect.width / 2, textRect.y + textRect.height, width / 2 + 5, wallBaseY - roughnessHeight + 5);
    }
    
    // Label sublayer
    const sublayerRect = drawTextWithBackground(ctx, 'Viscous Sublayer', 150, sublayerTopY + sublayerThickness / 2, 'center', 'boundary-sublayer-label');
    const arrowFromX = sublayerRect.x + sublayerRect.width / 2;
    const arrowY = sublayerRect.y; // Y is middle, so draw from here
    drawArrow(ctx, arrowFromX, arrowY - sublayerRect.height / 2, arrowFromX, sublayerTopY);
    drawArrow(ctx, arrowFromX, arrowY + sublayerRect.height / 2, arrowFromX, wallBaseY);

    ctx.restore();
}

/**
 * Draws the extreme close-up view of the pipe wall.
 */
function drawPipeWallDetailView(ctx: CanvasRenderingContext2D, re: number, absRoughness: number) {
    const width = ctx.canvas.clientWidth;
    const height = ctx.canvas.clientHeight;

    const zoomFactor = 10000; // Extreme zoom on roughness
    const roughnessHeight = absRoughness * zoomFactor;
    const wallBaseY = height * 0.75; // Wall takes up most of the view

    const sublayerThickness = mapLog(re, 2301, RE_MAX, 150, 10); // Thicker on screen for visibility
    const sublayerTopY = wallBaseY - sublayerThickness;

    // --- Draw Wall & Sublayer ---
    ctx.fillStyle = '#3b4453'; // Slightly lighter wall color for detail
    ctx.fillRect(0, wallBaseY, width, height - wallBaseY);
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, wallBaseY);
    for (let x = 0; x < width; x++) {
        ctx.lineTo(x, wallBaseY - roughnessProfile[x] * roughnessHeight);
    }
    ctx.lineTo(width, wallBaseY);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Draw viscous sublayer
    const sublayerGradient = ctx.createLinearGradient(0, sublayerTopY, 0, wallBaseY);
    sublayerGradient.addColorStop(0, 'rgba(74, 144, 226, 0)');
    sublayerGradient.addColorStop(1, 'rgba(74, 144, 226, 0.5)');
    ctx.fillStyle = sublayerGradient;
    ctx.fillRect(0, sublayerTopY, width, height - sublayerTopY);

    // --- Draw Annotations ---
    ctx.save();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;

    const isSmooth = sublayerThickness > roughnessHeight;
    const roughnessPeakX = width / 2;
    const roughnessPeakY = wallBaseY - roughnessProfile[Math.floor(roughnessPeakX)] * roughnessHeight;

    if (isSmooth) {
        drawInfoBox(ctx, 'Wall View: Hydraulically Smooth', [
            '<b>Condition:</b> Viscous Sublayer > Roughness (ε)',
            'The sublayer engulfs the wall texture, creating',
            'a "smooth" buffer. The main flow does not',
            'interact with the wall. Friction is driven by',
            'fluid viscosity.',
            '∙ Particles glide smoothly over the buffered zone.'
        ], 1.0, 'wall-infobox');
        
        const peakRect = drawTextWithBackground(ctx, 'Roughness Peak (ε)', roughnessPeakX, roughnessPeakY - 20, 'center', 'wall-peak-label');
        drawArrow(ctx, peakRect.x + peakRect.width / 2, peakRect.y + peakRect.height, roughnessPeakX, roughnessPeakY);
        
        const sublayerRect = drawTextWithBackground(ctx, 'Sublayer completely covers peaks', 180, sublayerTopY - 20, 'center', 'wall-sublayer-label');
        drawArrow(ctx, sublayerRect.x + sublayerRect.width / 2, sublayerRect.y + sublayerRect.height, 180, sublayerTopY);
    } else {
        drawInfoBox(ctx, 'Wall View: Rough Flow', [
            '<b>Condition:</b> Roughness (ε) > Viscous Sublayer',
            'Peaks protrude into the flow, creating form drag',
            'and chaotic eddies. This significantly increases',
            'energy loss.',
            '∙ Friction is dominated by physical obstructions.',
            '∙ Particles can be trapped, dissipating energy.'
        ], 1.0, 'wall-infobox');
        
        const peakRect = drawTextWithBackground(ctx, 'Exposed Peak creates drag', roughnessPeakX, roughnessPeakY - 20, 'center', 'wall-peak-label');
        drawArrow(ctx, peakRect.x + peakRect.width / 2, peakRect.y + peakRect.height, roughnessPeakX, roughnessPeakY);

        const sublayerRect = drawTextWithBackground(ctx, 'Thin sublayer fails to cover wall', 150, wallBaseY - sublayerThickness - 20, 'center', 'wall-sublayer-label');
        drawArrow(ctx, sublayerRect.x + sublayerRect.width / 2, sublayerRect.y + sublayerRect.height, 150, wallBaseY - sublayerThickness);
    }
    ctx.restore();
}



function updateIndicatorsAndDashboard(re: number, absRoughness: number, diameter: number, 
                                      snappedRelativeRoughness: number, activeCurveId: string,
                                      colebrookFriction: number) {
    const relativeRoughness = diameter > 0 ? absRoughness / diameter : 0;

    // Highlight the active curve
    document.querySelectorAll('.moody-curve').forEach(c => c.classList.remove('active'));
    const activeCurveEl = document.getElementById(activeCurveId);
    if (activeCurveEl) {
        activeCurveEl.classList.add('active');
    }
    
    metricDiameter.textContent = `${diameter.toFixed(3)} in`;
    metricRoughness.textContent = `${absRoughness.toFixed(4)} in`;
    metricRelRoughness.textContent = relativeRoughness.toPrecision(6); // Display the true value
    
    const results: FrictionResult[] = [];
    const isTurbulent = re > 4000;

    if (activeEquations.colebrook) {
        // Use the pre-calculated friction value for perfect synchronization
        results.push({ name: 'Colebrook', value: colebrookFriction, color: '#e94560' });
    }
    if (activeEquations.igt && isTurbulent) {
        const f = calculateIgtFriction(re);
        results.push({ name: 'IGT', value: f, color: '#4a90e2' });
    }
    if (activeEquations.aga && isTurbulent) {
        // Use the SNAPPED roughness to align the AGA dot with the Colebrook dot in the fully turbulent zone.
        const f = calculateAgaFriction(snappedRelativeRoughness);
        results.push({ name: 'AGA', value: f, color: '#50e3c2' });
    }

    indicatorContainer.innerHTML = '';
    frictionFactorMetrics.innerHTML = '';

    results.forEach(res => {
        if (isNaN(res.value)) return;
        
        const metricDiv = document.createElement('div');
        metricDiv.className = 'metric friction-metric';
        const darcyValue = res.value * 4;
        metricDiv.innerHTML = `
            <span class="metric-label" style="color: ${res.color};">${res.name}</span>
            <div class="friction-values">
                <span>f: ${res.value.toFixed(5)}</span>
                <span>f_D: ${darcyValue.toFixed(5)}</span>
            </div>
        `;
        frictionFactorMetrics.appendChild(metricDiv);

        const pos = calculateIndicatorPosition(re, res.value);
        if (pos) {
            const indicator = document.createElement('div');
            indicator.className = 'flow-indicator';
            indicator.style.top = pos.top;
            indicator.style.left = pos.left;
            indicator.style.backgroundColor = res.color;
            indicator.style.boxShadow = `0 0 10px ${res.color}, 0 0 20px ${res.color}`;
            indicatorContainer.appendChild(indicator);
        }
    });

    // Update Friction Contribution Meter
    const contribution = calculateFrictionContribution(re, relativeRoughness);

    const viscosityBar = document.getElementById('viscosity-bar') as HTMLDivElement;
    const roughnessBar = document.getElementById('roughness-bar') as HTMLDivElement;
    const viscosityLabel = document.getElementById('viscosity-percent-label') as HTMLSpanElement;
    const roughnessLabel = document.getElementById('roughness-percent-label') as HTMLSpanElement;

    if (viscosityBar && roughnessBar && viscosityLabel && roughnessLabel) {
        viscosityBar.style.width = `${contribution.viscosity}%`;
        roughnessBar.style.width = `${contribution.roughness}%`;
        
        viscosityLabel.textContent = `${contribution.viscosity.toFixed(0)}%`;
        roughnessLabel.textContent = `${contribution.roughness.toFixed(0)}%`;
        
        viscosityBar.classList.toggle('label-hidden', contribution.viscosity < 20);
        roughnessBar.classList.toggle('label-hidden', contribution.roughness < 20);
    }
}

// --- Animation Loop Handlers ---
function animateFullPipeView(time: number) {
     currentFrameHitboxes = [];
     const trueRelativeRoughness = absoluteRoughnessIN / currentPipeDiameterIN;
     const physicsProps = getFlowProperties(currentRe, trueRelativeRoughness);
     currentF = physicsProps.friction;

     ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
     drawPipe3D();
     drawBoundaryLayer(ctx, currentRe, time);

     particles.forEach(p => {
         updateParticleInFullView(p, currentRe, currentF);
         ctx.beginPath();
         ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
         ctx.fillStyle = p.color;
         ctx.globalAlpha = p.alpha;
         ctx.fill();
     });
     ctx.globalAlpha = 1.0;

     drawExplanationOverlay(ctx, currentRe, physicsProps.state, physicsProps.state, time);
}

function animateDetailView(time: number) {
    currentFrameHitboxes = [];
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const zoomFactor = 2000;
    const roughnessHeight = absoluteRoughnessIN * zoomFactor;
    const sublayerThickness = mapLog(currentRe, 2301, RE_MAX, 80, 5);
    
    drawBoundaryDetailView(ctx, currentRe, absoluteRoughnessIN);

    particles.forEach(p => {
        updateParticleInDetailView(p, currentRe, roughnessHeight, sublayerThickness);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
}

function animatePipeWallDetailView(time: number) {
    currentFrameHitboxes = [];
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const zoomFactor = 10000;
    const roughnessHeight = absoluteRoughnessIN * zoomFactor;
    const sublayerThickness = mapLog(currentRe, 2301, RE_MAX, 150, 10);
    
    drawPipeWallDetailView(ctx, currentRe, absoluteRoughnessIN);

    particles.forEach(p => {
        updateParticleInWallDetailView(p, currentRe, roughnessHeight, sublayerThickness);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
}


function animate() {
    const time = performance.now();

    currentRe += (targetRe - currentRe) * LERP_FACTOR;
    const trueRelativeRoughness = absoluteRoughnessIN / currentPipeDiameterIN;

    const closestRoughnessLevel = ROUGHNESS_LEVELS.reduce((prev, curr) =>
        (Math.abs(curr.value - trueRelativeRoughness) < Math.abs(prev.value - trueRelativeRoughness) ? curr : prev)
    );
    const snappedRelativeRoughness = closestRoughnessLevel.value;
    const activeCurveId = closestRoughnessLevel.id;

    const uiProps = getFlowProperties(currentRe, snappedRelativeRoughness);
    
    metricRe.textContent = Math.round(currentRe).toLocaleString();
    const { title, text } = flowDescriptions[uiProps.state];
    flowTitle.textContent = title;
    flowText.textContent = text;
    metricState.textContent = title;
    
    updateIndicatorsAndDashboard(currentRe, absoluteRoughnessIN, currentPipeDiameterIN, 
                                 snappedRelativeRoughness, activeCurveId, uiProps.friction);
    
    switch(currentViewMode) {
        case 'wall':
            animatePipeWallDetailView(time);
            break;
        case 'boundary':
            animateDetailView(time);
            break;
        case 'full':
        default:
            animateFullPipeView(time);
            break;
    }

    let targetProfile = calculateProfile(currentRe, currentF, velocityCanvas.clientHeight);
    if (currentProfile.length !== targetProfile.length) {
        currentProfile = [...targetProfile];
    } else {
        for (let i = 0; i < currentProfile.length; i++) {
            currentProfile[i] += (targetProfile[i] - currentProfile[i]) * LERP_FACTOR;
        }
    }
    drawVelocityProfile(currentProfile);

    animationFrameId = requestAnimationFrame(animate);
}

// --- UI & Event Handling ---
function handleAppResize() {
    cancelAnimationFrame(animationFrameId);
    setupCanvas(canvas);
    setupCanvas(velocityCanvas);
    initParticles();
    currentProfile = calculateProfile(currentRe, currentF, velocityCanvas.clientHeight);
    
    // Ensure floating moody diagram stays within bounds
    if (moodyDiagramContainer.classList.contains('is-floating')) {
        const appRect = appContainer.getBoundingClientRect();
        const moodyRect = moodyDiagramContainer.getBoundingClientRect();

        let currentLeft = parseFloat(moodyDiagramContainer.style.left || '0');
        let currentTop = parseFloat(moodyDiagramContainer.style.top || '0');
        
        if (currentLeft + moodyRect.width > appRect.width) {
            moodyDiagramContainer.style.left = `${appRect.width - moodyRect.width}px`;
        }
        if (currentTop + moodyRect.height > appRect.height) {
            moodyDiagramContainer.style.top = `${appRect.height - moodyRect.height}px`;
        }
        if (currentLeft < 0) {
            moodyDiagramContainer.style.left = `0px`;
        }
        if (currentTop < 0) {
             moodyDiagramContainer.style.top = `0px`;
        }
    }
    
    animate();
}

function updateViewModeUI() {
    // Manage visibility of the Pipe Wall Detail button
    pipeWallDetailBtn.classList.toggle('hidden', currentViewMode === 'full');

    // Manage active states of all buttons
    const activePreset = (Object.keys(presetReValues) as FlowPreset[]).find(p => presetReValues[p] === targetRe);
    
    laminarBtn.classList.toggle('active', currentViewMode === 'full' && activePreset === 'laminar');
    partiallyTurbulentBtn.classList.toggle('active', currentViewMode === 'full' && activePreset === 'partially-turbulent');
    fullyTurbulentBtn.classList.toggle('active', currentViewMode === 'full' && activePreset === 'fully-turbulent');
    boundaryDetailBtn.classList.toggle('active', currentViewMode === 'boundary');
    pipeWallDetailBtn.classList.toggle('active', currentViewMode === 'wall');

    // Set aria-pressed for all buttons
    [laminarBtn, partiallyTurbulentBtn, fullyTurbulentBtn, boundaryDetailBtn, pipeWallDetailBtn].forEach(btn => {
        btn.setAttribute('aria-pressed', btn.classList.contains('active').toString());
    });

    // Manage explain button state
    explainBtn.disabled = currentViewMode !== 'full';
    if (explainBtn.disabled) {
        showExplanation = false;
        explainBtn.classList.remove('active');
        explainBtn.setAttribute('aria-checked', 'false');
        explanationAnimationStartTimestamp = null;
    }
}


function setPreset(flowType: FlowPreset) {
    targetRe = presetReValues[flowType];
    reynoldsSlider.value = Math.log10(targetRe).toString();
    reynoldsInput.value = Math.round(targetRe).toString();
    
    if (currentViewMode !== 'full') {
        currentViewMode = 'full';
        initParticles();
    }
    updateViewModeUI();
}

function updateRelativeRoughnessInput() {
    const relRough = currentPipeDiameterIN > 0 ? absoluteRoughnessIN / currentPipeDiameterIN : 0;
    relRoughnessInput.value = relRough.toPrecision(6);
}

function initHorizontalResizer() {
    let isResizing = false;
    let startX: number, startVizWidth: number, startSidebarWidth: number;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startVizWidth = vizColumn.getBoundingClientRect().width;
        startSidebarWidth = sidebarColumn.getBoundingClientRect().width;

        document.body.classList.add('is-resizing');
        resizer.classList.add('is-resizing');

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e: MouseEvent) {
        if (!isResizing) return;

        const dx = e.clientX - startX;
        const newVizWidth = startVizWidth + dx;
        const newSidebarWidth = startSidebarWidth - dx;

        const minVizWidth = 300; 
        const minSidebarWidth = 400; 

        if (newVizWidth >= minVizWidth && newSidebarWidth >= minSidebarWidth) {
            mainContainer.style.gridTemplateColumns = `${newVizWidth}px ${resizer.offsetWidth}px ${newSidebarWidth}px`;
        }
    }

    function onMouseUp() {
        isResizing = false;
        document.body.classList.remove('is-resizing');
        resizer.classList.remove('is-resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        const totalWidth = vizColumn.offsetWidth + sidebarColumn.offsetWidth;
        if (totalWidth > 0) {
            const vizFr = vizColumn.offsetWidth / totalWidth;
            const sidebarFr = sidebarColumn.offsetWidth / totalWidth;
            mainContainer.style.gridTemplateColumns = `${vizFr}fr ${resizer.offsetWidth}px ${sidebarFr}fr`;
        }
        handleAppResize();
    }
}

function initVerticalResizer() {
    let isResizing = false;
    let startY: number, startPipeHeight: number, startVelocityHeight: number;

    verticalResizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startY = e.clientY;
        startPipeHeight = pipeContainer.getBoundingClientRect().height;
        startVelocityHeight = velocityContainer.getBoundingClientRect().height;

        document.body.classList.add('is-resizing-v');
        verticalResizer.classList.add('is-resizing');

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e: MouseEvent) {
        if (!isResizing) return;

        const dy = e.clientY - startY;
        const newPipeHeight = startPipeHeight + dy;
        const newVelocityHeight = startVelocityHeight - dy;

        const minHeight = 100;

        if (newPipeHeight >= minHeight && newVelocityHeight >= minHeight) {
            vizColumn.style.gridTemplateRows = `${newPipeHeight}px ${verticalResizer.offsetHeight}px ${newVelocityHeight}px`;
        }
    }

    function onMouseUp() {
        if (!isResizing) return;
        isResizing = false;

        document.body.classList.remove('is-resizing-v');
        verticalResizer.classList.remove('is-resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const resizerHeight = verticalResizer.offsetHeight;
        const pipeHeight = pipeContainer.getBoundingClientRect().height;
        const veloHeight = velocityContainer.getBoundingClientRect().height;
        const totalHeight = pipeHeight + veloHeight;
        
        if (totalHeight > 0) {
            const pipeFr = pipeHeight / totalHeight;
            const veloFr = veloHeight / totalHeight;
            vizColumn.style.gridTemplateRows = `${pipeFr}fr ${resizerHeight}px ${veloFr}fr`;
        }

        // Use requestAnimationFrame to ensure the resize logic runs after the layout has settled.
        requestAnimationFrame(handleAppResize);
    }
}

function initInfoTabs() {
    const tabs = [diagramTabBtn, aboutTabBtn, presentationTabBtn];
    const panels = [diagramTabContent, aboutTabContent, presentationTabContent];

    const switchTab = (tabToActivate: HTMLButtonElement) => {
        const panelToActivate = document.getElementById(tabToActivate.getAttribute('aria-controls')!);

        tabs.forEach(tab => {
            const isMatch = tab === tabToActivate;
            tab.classList.toggle('active', isMatch);
            tab.setAttribute('aria-selected', isMatch.toString());
        });

        panels.forEach(panel => {
            const isMatch = panel === panelToActivate;
            panel.classList.toggle('hidden', !isMatch);
        });

        // If the moody diagram is floating, only show it when its tab is active.
        if (moodyDiagramContainer.classList.contains('is-floating')) {
            const isDiagramTabActive = tabToActivate === diagramTabBtn;
            moodyDiagramContainer.classList.toggle('hidden', !isDiagramTabActive);
        }
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab));
    });
}

function initDragHandler() {
    const onCanvasMouseDown = (e: MouseEvent) => {
        // Allow dragging in detail views, OR in full view ONLY if explain is on.
        if (currentViewMode === 'full' && !showExplanation) {
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.clientWidth / rect.width;
        const scaleY = canvas.clientHeight / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // Check for hit on draggable items, iterating backwards for Z-index
        for (let i = currentFrameHitboxes.length - 1; i >= 0; i--) {
            const item = currentFrameHitboxes[i];
            const isHit = mouseX >= item.rect.x && mouseX <= item.rect.x + item.rect.width &&
                          mouseY >= item.rect.y && mouseY <= item.rect.y + item.rect.height;
            
            if (isHit) {
                isDragging = true;
                draggedAnnotationId = item.id;
                dragStartPos = { x: mouseX, y: mouseY };
                dragStartOffset = annotationOffsets.get(item.id) || { x: 0, y: 0 };
                canvas.style.cursor = 'grabbing';
                e.preventDefault();
                return;
            }
        }
    };

    const onDocumentMouseMove = (e: MouseEvent) => {
        if (!isDragging || !draggedAnnotationId) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.clientWidth / rect.width;
        const scaleY = canvas.clientHeight / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        const deltaX = mouseX - dragStartPos.x;
        const deltaY = mouseY - dragStartPos.y;

        const newOffset = {
            x: dragStartOffset.x + deltaX,
            y: dragStartOffset.y + deltaY,
        };
        annotationOffsets.set(draggedAnnotationId, newOffset);
    };

    const onDocumentMouseUp = () => {
        isDragging = false;
        draggedAnnotationId = null;
        canvas.style.cursor = 'default';
    };

    const onCanvasMouseMove = (e: MouseEvent) => {
        // Same logic as onCanvasMouseDown for showing the grab cursor
        if (isDragging || (currentViewMode === 'full' && !showExplanation)) {
             canvas.style.cursor = 'default';
             return;
        }

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.clientWidth / rect.width;
        const scaleY = canvas.clientHeight / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        let hovering = false;
        for (const item of currentFrameHitboxes) {
            if (mouseX >= item.rect.x && mouseX <= item.rect.x + item.rect.width &&
                mouseY >= item.rect.y && mouseY <= item.rect.y + item.rect.height) {
                hovering = true;
                break;
            }
        }
        canvas.style.cursor = hovering ? 'grab' : 'default';
    };

    canvas.addEventListener('mousedown', onCanvasMouseDown);
    document.addEventListener('mousemove', onDocumentMouseMove);
    document.addEventListener('mouseup', onDocumentMouseUp);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
}

function initMoodyDiagramDrag() {
    let isDragging = false;
    let isFloating = false;
    let initialX = 0, initialY = 0;
    let offsetX = 0, offsetY = 0;

    const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        isDragging = true;
        
        const appRect = appContainer.getBoundingClientRect();

        if (!isFloating) {
            isFloating = true;
            const moodyRect = moodyDiagramContainer.getBoundingClientRect();
            
            // Set fixed size and position before making it absolute
            moodyDiagramContainer.style.width = `${moodyRect.width}px`;
            moodyDiagramContainer.style.height = `${moodyRect.height}px`;
            
            const initialLeft = moodyRect.left - appRect.left;
            const initialTop = moodyRect.top - appRect.top;
            
            moodyDiagramContainer.style.left = `${initialLeft}px`;
            moodyDiagramContainer.style.top = `${initialTop}px`;
            
            moodyDiagramContainer.classList.add('is-floating');
        }
        
        initialX = e.clientX;
        initialY = e.clientY;
        
        offsetX = e.clientX - moodyDiagramContainer.offsetLeft;
        offsetY = e.clientY - moodyDiagramContainer.offsetTop;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const appRect = appContainer.getBoundingClientRect();
        const moodyRect = moodyDiagramContainer.getBoundingClientRect();

        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;
        
        // Constrain within the app container
        const maxLeft = appRect.width - moodyRect.width;
        const maxTop = appRect.height - moodyRect.height;
        
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        
        moodyDiagramContainer.style.left = `${newLeft}px`;
        moodyDiagramContainer.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    moodyTitle.addEventListener('mousedown', onMouseDown);
}


reynoldsSlider.addEventListener('input', (e) => {
    const logVal = parseFloat((e.target as HTMLInputElement).value);
    targetRe = Math.pow(10, logVal);
    reynoldsInput.value = Math.round(targetRe).toString();
    if (currentViewMode === 'full') {
      updateViewModeUI();
    }
});

reynoldsInput.addEventListener('change', (e) => {
    let val = parseInt((e.target as HTMLInputElement).value, 10);
    if (isNaN(val)) {
        reynoldsInput.value = Math.round(targetRe).toString();
        return;
    }
    val = Math.max(1000, Math.min(RE_MAX, val));
    
    targetRe = val;
    reynoldsInput.value = targetRe.toString();
    reynoldsSlider.value = Math.log10(targetRe).toString();
    if (currentViewMode === 'full') {
      updateViewModeUI();
    }
});


pipeDiameterSelect.addEventListener('change', (e) => {
    const selectedDiameter = (e.target as HTMLSelectElement).value;
    currentPipeDiameterIN = PIPE_SCHEDULE_40_IDS_IN.get(selectedDiameter) || 4.026;
    pipeDiameterValue.textContent = `ID: ${currentPipeDiameterIN.toFixed(3)} in`;
    updateRelativeRoughnessInput();
});

absRoughnessSlider.addEventListener('input', (e) => {
    absoluteRoughnessIN = parseFloat((e.target as HTMLInputElement).value);
    absRoughnessInput.value = absoluteRoughnessIN.toFixed(4);
    updateRelativeRoughnessInput();
});

absRoughnessInput.addEventListener('change', (e) => {
    let val = parseFloat((e.target as HTMLInputElement).value);
    if (isNaN(val)) {
        absRoughnessInput.value = absoluteRoughnessIN.toFixed(4);
        return;
    }
    val = Math.max(0, Math.min(0.1, val));
    
    absoluteRoughnessIN = val;
    absRoughnessInput.value = absoluteRoughnessIN.toFixed(4);
    absRoughnessSlider.value = absoluteRoughnessIN.toString();
    updateRelativeRoughnessInput();
});

relRoughnessInput.addEventListener('change', (e) => {
    let relRough = parseFloat((e.target as HTMLInputElement).value);
    if (isNaN(relRough) || relRough < 0) {
        updateRelativeRoughnessInput(); // revert if invalid
        return;
    }
    
    const newAbsRoughness = relRough * currentPipeDiameterIN;
    absoluteRoughnessIN = Math.max(0, Math.min(0.1, newAbsRoughness));
    
    // Update all related UI to be consistent from the single source of truth
    absRoughnessInput.value = absoluteRoughnessIN.toFixed(4);
    absRoughnessSlider.value = absoluteRoughnessIN.toString();
    updateRelativeRoughnessInput(); // Recalculates and sets relRough input from the new (and possibly clamped) absolute roughness
});


laminarBtn.addEventListener('click', () => setPreset('laminar'));
partiallyTurbulentBtn.addEventListener('click', () => setPreset('partially-turbulent'));
fullyTurbulentBtn.addEventListener('click', () => setPreset('fully-turbulent'));

boundaryDetailBtn.addEventListener('click', () => {
    if (currentViewMode === 'full') {
        currentViewMode = 'boundary';
        // Bump Re if it's too low for a meaningful detail view
        if (targetRe < 2301) {
            targetRe = presetReValues['partially-turbulent'];
            reynoldsSlider.value = Math.log10(targetRe).toString();
            reynoldsInput.value = Math.round(targetRe).toString();
        }
    } else {
        currentViewMode = 'full';
    }
    annotationOffsets.clear();
    updateViewModeUI();
    initParticles();
});

pipeWallDetailBtn.addEventListener('click', () => {
    if (currentViewMode === 'boundary') {
        currentViewMode = 'wall';
    } else if (currentViewMode === 'wall') {
        currentViewMode = 'boundary';
    }
    annotationOffsets.clear();
    updateViewModeUI();
    initParticles();
});


explainBtn.addEventListener('click', () => {
    showExplanation = !showExplanation;
    explainBtn.classList.toggle('active', showExplanation);
    explainBtn.setAttribute('aria-checked', String(showExplanation));
    if (showExplanation) {
        annotationOffsets.clear();
        explanationAnimationStartTimestamp = performance.now();
    } else {
        explanationAnimationStartTimestamp = null;
    }
});

colebrookToggle.addEventListener('change', (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    activeEquations.colebrook = isChecked;
    colebrookExplanation.classList.toggle('hidden', !isChecked);
});

igtToggle.addEventListener('change', (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    activeEquations.igt = isChecked;
    const smoothCurve = document.getElementById('curve-smooth');
    
    igtExplanation.classList.toggle('hidden', !isChecked);
    
    if (smoothCurve) {
        smoothCurve.classList.toggle('highlight-igt', isChecked);
    }
});

agaToggle.addEventListener('change', (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    activeEquations.aga = isChecked;
    agaExplanation.classList.toggle('hidden', !isChecked);
});

// --- Initialization ---
function main() {
    setupCanvas(canvas);
    setupCanvas(velocityCanvas);
    renderMoodyDiagramPaths();
    
    // Populate pipe diameter dropdown
    PIPE_SCHEDULE_40_IDS_IN.forEach((_, key) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        pipeDiameterSelect.appendChild(option);
    });
    
    // Set initial values for new controls
    const initialPipeKey = '4"';
    pipeDiameterSelect.value = initialPipeKey;
    currentPipeDiameterIN = PIPE_SCHEDULE_40_IDS_IN.get(initialPipeKey)!;
    pipeDiameterValue.textContent = `ID: ${currentPipeDiameterIN.toFixed(3)} in`;
    
    absoluteRoughnessIN = parseFloat(absRoughnessSlider.value);
    absRoughnessInput.value = absoluteRoughnessIN.toFixed(4);
    
    initParticles();
    
    targetRe = Math.pow(10, parseFloat(reynoldsSlider.value));
    currentRe = targetRe;
    reynoldsInput.value = Math.round(targetRe).toString();
    
    initHorizontalResizer();
    initVerticalResizer();
    initInfoTabs();
    initDragHandler();
    initMoodyDiagramDrag();
    updateRelativeRoughnessInput();
    setPreset('laminar');

    animate();

    window.addEventListener('resize', handleAppResize);
}

main();
