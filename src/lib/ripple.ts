/*
  Pointer-origin specular ripple — "sun play".

  The light response is a property of the MATERIAL, not of the element: every
  brushed-metal surface reflects alike, every moulded-plastic one alike. The
  shader takes a small BRDF-ish parameter set and each material declares it
  once (see the material-* mixins), rather than each element hand-tuning an
  opacity.

  A single WebGL canvas is shared across every surface that uses the effect.
  Only one element can be hovered at a time and the ripple fires once from the
  entry point rather than tracking the pointer, so one canvas (and therefore one
  GL context) is enough for the whole page. It is re-parented into whichever
  element was just entered, which also means the host's existing
  `overflow: hidden` clips it for free.
*/

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y; // match DOM coordinates, y down
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;

varying vec2 vUv;

uniform vec2  uResolution;
uniform vec2  uOrigin;   // where the pointer entered
uniform float uProgress; // 0 -> 1
uniform vec3  uTint;     // colour of the light this material returns

// ---- material ----
uniform float uAniso; // smear along the grain; 1 = isotropic
uniform float uSharp; // tightness of the lobe; low = broad, high = concentrated
uniform float uGain;

// ---- geometry ----
uniform float uRadius;      // corner radius of the true silhouette, px
uniform vec2  uShapeCenter; // centre of that silhouette, in host pixels
uniform vec2  uShapeHalf;   // its half-extents
uniform float uBevel;  // how far in from the edge the surface keeps curving
uniform float uDome;   // how hard the highlight dies as the normal turns away
uniform float uBend;   // how far the tilting normal drags the reflection
uniform float uRim;    // catch of light where a curved edge rolls over
uniform float uDrag;   // how hard the boundary arrests the travelling highlight

float roundedRectSDF(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 fragPx = vUv * uResolution;

  /*
    The sun catches the surface where the pointer entered and slides across,
    away from that edge. A single travelling highlight, not concentric rings:
    on a 14:1 row a ring's radius outgrows the short side almost immediately,
    so all that survives of it is a vertical slice — a band pretending to be a
    ripple. One well-shaped lobe reads correctly at any aspect ratio.
  */
  float dir = uOrigin.x < uResolution.x * 0.5 ? 1.0 : -1.0;
  float travel = uResolution.x + uResolution.y * 2.0;

  /*
    The highlight does not slide at a constant rate. Under viscous drag a
    velocity decays exponentially, so the position approaches its limit rather
    than arriving at it — the light runs out across the open middle and then
    settles as the far boundary closes in, instead of sailing through the edge
    still at full speed.

    Normalised so the sweep still completes exactly at uProgress = 1 whatever
    the drag; uDrag = 0 collapses back to the linear travel.
  */
  float k = max(uDrag, 0.001);
  float eased = (1.0 - exp(-k * uProgress)) / (1.0 - exp(-k));
  vec2 lightPos = vec2(uOrigin.x + dir * eased * travel, uOrigin.y);

  /*
    ---- Shape ----

    The surface is not a flat plate. Distance in from the host's own
    rounded-rect outline gives t: 0 at the silhouette, 1 once the surface has
    finished curving. uBevel sets how far in that curving continues — a moulded
    pill is domed across most of its height, a metal plate only chamfers at the
    very edge.

    nz is the normal's z on a circular dome profile: it falls to 0 exactly at
    the rim, where the surface has turned edge-on to the viewer.
  */
  /*
    The silhouette is not always the element the canvas sits in. A nav segment
    is a square slice of a pill: shading it against its own box gives the light
    a flat rectangle to run along, so it never rolls over the rounded ends that
    are actually there. Shading against the shape the surface belongs to lets
    one plate read as one plate — and for a button, where the two coincide,
    this is exactly what it was before.
  */
  float shapeH = uShapeHalf.y * 2.0;
  float inside = -roundedRectSDF(fragPx - uShapeCenter, uShapeHalf, uRadius);
  float bevelW = max(shapeH * uBevel, 1.0);
  float t = clamp(inside / bevelW, 0.0, 1.0);
  float nz = sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));

  /*
    Because the normal tilts outward as the surface rolls over, the reflection
    it returns is dragged with it. Displacing the sample point along that
    outward tilt makes the highlight BEND around the contour near the edge
    instead of sliding across as if the surface were flat.
  */
  vec2 outward = normalize((fragPx - uShapeCenter) + vec2(0.0001));
  vec2 bent = fragPx + outward * (1.0 - t) * uBend * shapeH;

  /*
    Anisotropy: a brushed surface drags its reflection along the grain, so the
    lobe stretches horizontally. A moulded one stays round.
  */
  vec2 d = (bent - lightPos) / vec2(uAniso, 1.0);
  float dist = length(d) / max(uResolution.y, 1.0);

  // Specular falloff. The exponent is the material: metal scatters it wide and
  // soft, plastic holds it tight with a defined edge.
  float spec = exp(-dist * dist * uSharp);

  /*
    And it has to go out at the rim. Raising nz to a power lets a domed surface
    extinguish its highlight completely as the normal turns away, rather than
    merely dimming it — light cannot survive where the surface no longer faces
    you.
  */
  float dome = pow(nz, uDome * 4.0 + 0.2);
  float rim = pow(1.0 - t, 3.0) * uRim * spec * nz;

  float a = clamp((spec * dome + rim) * uGain * sin(uProgress * 3.14159), 0.0, 1.0);
  gl_FragColor = vec4(uTint * a, a); // premultiplied, light only
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // Without this a compile failure is indistinguishable from "no WebGL" —
    // the page just quietly serves the CSS fallback and looks like an old build.
    console.warn("[ripple] shader failed to compile:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export interface RippleRunner {
  trigger(host: HTMLElement, x: number, y: number): void;
  destroy(): void;
}

/** Reads a space-separated "R G B" custom property into 0..1 floats. */
function readTint(host: HTMLElement): [number, number, number] {
  const raw = getComputedStyle(host).getPropertyValue("--fx-light").trim();
  const parts = raw.split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return [1, 1, 1];
  return [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255];
}

function readNumber(host: HTMLElement, prop: string, fallback: number): number {
  const raw = getComputedStyle(host).getPropertyValue(prop).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function createRippleRunner(): RippleRunner | null {
  const canvas = document.createElement("canvas");
  canvas.className = "fx-ripple-canvas";
  canvas.setAttribute("aria-hidden", "true");

  const gl =
    (canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false }) as
      | WebGLRenderingContext
      | null) ?? null;
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(prog, "uResolution");
  const uOrigin = gl.getUniformLocation(prog, "uOrigin");
  const uProgress = gl.getUniformLocation(prog, "uProgress");
  const uTint = gl.getUniformLocation(prog, "uTint");
  const uAniso = gl.getUniformLocation(prog, "uAniso");
  const uSharp = gl.getUniformLocation(prog, "uSharp");
  const uGain = gl.getUniformLocation(prog, "uGain");
  const uRadius = gl.getUniformLocation(prog, "uRadius");
  const uShapeCenter = gl.getUniformLocation(prog, "uShapeCenter");
  const uShapeHalf = gl.getUniformLocation(prog, "uShapeHalf");
  const uDome = gl.getUniformLocation(prog, "uDome");
  const uRim = gl.getUniformLocation(prog, "uRim");
  const uBevel = gl.getUniformLocation(prog, "uBevel");
  const uBend = gl.getUniformLocation(prog, "uBend");
  const uDrag = gl.getUniformLocation(prog, "uDrag");

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let raf = 0;
  let currentHost: HTMLElement | null = null;

  function detach() {
    raf = 0;
    canvas.remove();
    currentHost = null;
  }

  function trigger(host: HTMLElement, x: number, y: number) {
    if (raf) cancelAnimationFrame(raf);

    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    if (currentHost !== host) {
      host.appendChild(canvas);
      currentHost = host;
    }

    const duration = readNumber(host, "--fx-ripple-duration", 900);
    // The material declares its own light response; see @mixin material-* .
    const aniso = readNumber(host, "--fx-aniso", 1);
    const sharp = readNumber(host, "--fx-sharp", 3);
    const gain = readNumber(host, "--fx-gain", 0.7);
    const dome = readNumber(host, "--fx-dome", 0);
    const rim = readNumber(host, "--fx-rim", 0);
    const bevel = readNumber(host, "--fx-bevel", 0.1);
    const bend = readNumber(host, "--fx-bend", 0);
    // 0 keeps the original constant-speed sweep for any surface that is silent
    // about it, so adding drag to one material cannot disturb the others.
    const drag = readNumber(host, "--fx-drag", 0);
    /*
      A surface may be a slice of a larger shape — a nav segment is part of a
      pill and carries no radius of its own. [data-fx-surface] on the ancestor
      names the silhouette the light should actually curve around; without it
      the element is its own shape, which is the case for a button.
    */
    const shapeEl = host.closest<HTMLElement>("[data-fx-surface]") ?? host;
    const hostRect = host.getBoundingClientRect();
    const shapeRect = shapeEl.getBoundingClientRect();
    const shapeCenter: [number, number] = [
      shapeRect.left - hostRect.left + shapeRect.width / 2,
      shapeRect.top - hostRect.top + shapeRect.height / 2,
    ];
    // A pill reports a huge radius, which caps at half the short side.
    const cs = getComputedStyle(shapeEl);
    const radius = Math.min(
      parseFloat(cs.borderTopLeftRadius) || 0,
      Math.min(shapeRect.width, shapeRect.height) / 2
    );
    const tint = readTint(host);

    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(uResolution, w, h);
    gl!.uniform2f(uOrigin, x, y);
    gl!.uniform3f(uTint, tint[0], tint[1], tint[2]);
    gl!.uniform1f(uAniso, aniso);
    gl!.uniform1f(uSharp, sharp);
    gl!.uniform1f(uGain, gain);
    gl!.uniform1f(uRadius, radius);
    gl!.uniform2f(uShapeCenter, shapeCenter[0], shapeCenter[1]);
    gl!.uniform2f(uShapeHalf, shapeRect.width / 2, shapeRect.height / 2);
    gl!.uniform1f(uDome, dome);
    gl!.uniform1f(uRim, rim);
    gl!.uniform1f(uBevel, bevel);
    gl!.uniform1f(uBend, bend);
    gl!.uniform1f(uDrag, drag);

    const start = performance.now();

    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      gl!.uniform1f(uProgress, p);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      // Detach when finished so no GL work or stray canvas is left behind.
      raf = p < 1 ? requestAnimationFrame(frame) : 0;
      if (!raf) detach();
    };

    raf = requestAnimationFrame(frame);
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    detach();
  }

  return { trigger, destroy };
}
