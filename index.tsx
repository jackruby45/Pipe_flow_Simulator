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
interface FrictionResult {
    name: string;
    value: number;
    color: string;
}

// --- DOM Element Selection ---
const canvas = document.getElementById('pipelineCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const velocityCanvas = document.getElementById('velocityProfileCanvas') as HTMLCanvasElement;
const vCtx = velocityCanvas.getContext('2d')!;

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

const resizer = document.getElementById('resizer') as HTMLDivElement;
const resizableContainer = document.getElementById('resizable-container') as HTMLDivElement;
const vizColumn = document.getElementById('viz-column') as HTMLDivElement;
const infoColumn = document.getElementById('info-column') as HTMLDivElement;
const verticalResizer = document.getElementById('vertical-resizer') as HTMLDivElement;
const pipeContainer = document.querySelector('.pipe-container') as HTMLDivElement;
const velocityContainer = document.querySelector('.velocity-container') as HTMLDivElement;

// --- Constants & State ---
const PARTICLE_COUNT = 300;
const WALL_BUFFER = 5;
const LERP_FACTOR = 0.05; // Smoothing factor for transitions

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

// --- Dynamic State ---
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
    const reMin = 1000, reMax = 20000000;
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
        Math.pow(10, Math.log10(2300) + i * (Math.log10(2e7) - Math.log10(2300)) / (pointCount - 1))
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
    const smoothF = getFlowProperties(1.5e7, 0).friction;
    text.setAttribute('x', mapReToX(1.5e7).toFixed(2));
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
    return {
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        vx: 0, vy: 0,
        radius: Math.random() * 1.5 + 1,
        alpha: Math.random() * 0.5 + 0.3,
        color: '#a7c5eb'
    };
}

function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle());
    }
}

// --- Flow Logic (influenced by currentRe) ---
function updateParticle(p: Particle, re: number, f: number) {
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

    if (p.x > canvas.clientWidth + p.radius) {
        p.x = -p.radius;
        p.y = Math.random() * canvas.clientHeight;
    }
     if (p.y < WALL_BUFFER || p.y > canvas.clientHeight - WALL_BUFFER) {
        p.y = Math.max(WALL_BUFFER, Math.min(canvas.clientHeight - WALL_BUFFER, p.y));
        p.vy *= -0.5;
    }
    p.color = getColorForVelocity(p.vx, 12);
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
}

// --- Animation Loop ---
function animate() {
    currentRe += (targetRe - currentRe) * LERP_FACTOR;
    const trueRelativeRoughness = absoluteRoughnessIN / currentPipeDiameterIN;

    // Determine snapped roughness for UI consistency (dot on line)
    const closestRoughnessLevel = ROUGHNESS_LEVELS.reduce((prev, curr) =>
        (Math.abs(curr.value - trueRelativeRoughness) < Math.abs(prev.value - trueRelativeRoughness) ? curr : prev)
    );
    const snappedRelativeRoughness = closestRoughnessLevel.value;
    const activeCurveId = closestRoughnessLevel.id;

    // Get physics properties using the true roughness for the simulation
    const physicsProps = getFlowProperties(currentRe, trueRelativeRoughness);
    currentF = physicsProps.friction;
    
    // Get UI properties using the snapped roughness for the diagram
    const uiProps = getFlowProperties(currentRe, snappedRelativeRoughness);
    
    // --- Update all UI elements from the synchronized data ---
    metricRe.textContent = Math.round(currentRe).toLocaleString();
    
    // Update main description and metrics panel with the current flow state
    const { title, text } = flowDescriptions[uiProps.state];
    flowTitle.textContent = title;
    flowText.textContent = text;
    metricState.textContent = title;
    
    // Pass all necessary info to the dashboard/indicator updater
    updateIndicatorsAndDashboard(currentRe, absoluteRoughnessIN, currentPipeDiameterIN, 
                                 snappedRelativeRoughness, activeCurveId, uiProps.friction);
    
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    drawPipe3D();
    particles.forEach(p => {
        updateParticle(p, currentRe, currentF);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

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
function handleCanvasResize() {
    cancelAnimationFrame(animationFrameId);
    setupCanvas(canvas);
    setupCanvas(velocityCanvas);
    initParticles();
    // Recalculate the profile based on the new canvas height.
    currentProfile = calculateProfile(currentRe, currentF, velocityCanvas.clientHeight);
    animate();
}

function updateActiveButton(activeBtnId?: string) {
    [laminarBtn, partiallyTurbulentBtn, fullyTurbulentBtn].forEach(btn => {
        if (btn.id === activeBtnId) {
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        }
    });
}

function setPreset(flowType: FlowPreset) {
    targetRe = presetReValues[flowType];
    reynoldsSlider.value = Math.log10(targetRe).toString();
    reynoldsInput.value = Math.round(targetRe).toString();
    updateActiveButton(`${flowType}Btn`);
}

function updateRelativeRoughnessInput() {
    const relRough = currentPipeDiameterIN > 0 ? absoluteRoughnessIN / currentPipeDiameterIN : 0;
    relRoughnessInput.value = relRough.toPrecision(6);
}

function initHorizontalResizer() {
    let isResizing = false;
    let startX: number, startVizWidth: number, startInfoWidth: number;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startVizWidth = vizColumn.getBoundingClientRect().width;
        startInfoWidth = infoColumn.getBoundingClientRect().width;

        document.body.classList.add('is-resizing');
        resizer.classList.add('is-resizing');

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e: MouseEvent) {
        if (!isResizing) return;

        const dx = e.clientX - startX;
        const newVizWidth = startVizWidth + dx;
        const newInfoWidth = startInfoWidth - dx;

        const minVizWidth = 200; 
        const minInfoWidth = 450; 

        if (newVizWidth >= minVizWidth && newInfoWidth >= minInfoWidth) {
            resizableContainer.style.gridTemplateColumns = `${newVizWidth}px ${resizer.offsetWidth}px ${newInfoWidth}px`;
        }
    }

    function onMouseUp() {
        isResizing = false;
        document.body.classList.remove('is-resizing');
        resizer.classList.remove('is-resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        const totalWidth = vizColumn.offsetWidth + infoColumn.offsetWidth;
        if (totalWidth > 0) {
            const vizFr = vizColumn.offsetWidth / totalWidth;
            const infoFr = infoColumn.offsetWidth / totalWidth;
            resizableContainer.style.gridTemplateColumns = `${vizFr}fr ${resizer.offsetWidth}px ${infoFr}fr`;
        }
        handleCanvasResize();
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
        requestAnimationFrame(handleCanvasResize);
    }
}

reynoldsSlider.addEventListener('input', (e) => {
    const logVal = parseFloat((e.target as HTMLInputElement).value);
    targetRe = Math.pow(10, logVal);
    reynoldsInput.value = Math.round(targetRe).toString();
    updateActiveButton();
});

reynoldsInput.addEventListener('change', (e) => {
    let val = parseInt((e.target as HTMLInputElement).value, 10);
    if (isNaN(val)) {
        reynoldsInput.value = Math.round(targetRe).toString();
        return;
    }
    val = Math.max(1000, Math.min(20000000, val));
    
    targetRe = val;
    reynoldsInput.value = targetRe.toString();
    reynoldsSlider.value = Math.log10(targetRe).toString();
    updateActiveButton();
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
    updateRelativeRoughnessInput();
    setPreset('laminar');

    animate();

    window.addEventListener('resize', handleCanvasResize);
}

main();