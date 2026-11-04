import * as T from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x * x * x * (10 + x * (-15 + 6 * x)); };
const between = (a, b, t) => ease((t - a) / (b - a));
const rnd = (i, s = 1) => { const q = Math.sin(i * 127.1 + s * 311.7) * 43758.5453123; return q - Math.floor(q); };
const TITLE = '想法先行', COUNT_PER_GLYPH = 360, ASCII = '01{}[]<>/+=:;ABCDEFGHJKLXYZ23456789';

// Every letter is an extruded outline from the supplied Chinese glyph paths.
// The same triangle surface supplies the later ASCII cloud. The host owns the
// RAF and phase clock, so waiting, cancellation and the black interval stay in
// one timeline with its DOM portal and media transport.
export async function createOpening({ canvas } = {}) {
  if (!canvas) throw Error('Opening requires the host canvas for pointer coordinates');
  const scene = new T.Scene(); scene.background = new T.Color('#081641');
  const camera = new T.PerspectiveCamera(38, 16 / 9, .1, 100); camera.position.set(0, .4, 22); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const data = await fetch(new URL('../assets/type/title-glyphs.json', import.meta.url)).then(r => { if (!r.ok) throw Error('Chinese title paths unavailable'); return r.json(); });
  const group = new T.Group(); group.name = '想法先行 / original extruded engineering title'; group.rotation.set(.055, -.08, 0); scene.add(group);
  const ambient = new T.HemisphereLight('#e1eeff', '#0b2056', 2.2); scene.add(ambient);
  const key = new T.DirectionalLight('#fffaf1', 3.1); key.position.set(-3.5, 5.5, 9); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 6, bottom: -6, near: .5, far: 25 }); key.shadow.normalBias = .025; key.shadow.bias = -.0002; scene.add(key);
  const rim = new T.DirectionalLight('#7db5ff', 2.0); rim.position.set(6, 1, -4); scene.add(rim);
  const shadowMat = new T.ShadowMaterial({ color: '#00040f', opacity: .18 });
  const shadow = new T.Mesh(new T.PlaneGeometry(32, 16), shadowMat); shadow.position.z = -1.5; shadow.receiveShadow = true; scene.add(shadow);
  const glyphs = [], meshes = [], paths = new SVGLoader(), geometries = [], materials = [shadowMat];
  let width = 1280, height = 720, phase = 'intro', previousPhase = '', lastTime = 0, hovered = -1, disposed = false;

  function lineShader() {
    const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { reveal: { value: 0 }, opacity: { value: 1 }, hold: { value: 0 }, tint: { value: new T.Color('#b3d9ff') } },
      vertexShader: 'attribute float aAlong;varying float vAlong;void main(){vAlong=aAlong;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying float vAlong;uniform float reveal,opacity,hold;uniform vec3 tint;void main(){if(vAlong>reveal)discard;float tip=1.-smoothstep(.0,.045,abs(reveal-vAlong));vec3 c=mix(tint,vec3(1.),tip*.7+hold*.25);gl_FragColor=vec4(c,opacity*(.72+tip*.28));}',
    }); materials.push(mat); return mat;
  }
  function makeContours(shapes, bbox, scale, depth) {
    const segments = [], weights = []; let totalLength = 0;
    // Face and back paths progress in the same stroke direction; side edges
    // appear between them, so thickness is revealed as a physical structure.
    for (const sh of shapes) for (const curve of [sh, ...sh.holes]) {
      const points = curve.getPoints(2);
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1], length = a.distanceTo(b);
        if (length < 1e-5) continue;
        segments.push([(a.x - 50) * scale, (a.y + 70) * scale, depth * .5 + .012, (b.x - 50) * scale, (b.y + 70) * scale, depth * .5 + .012]);
        weights.push(totalLength, totalLength + length); totalLength += length;
      }
    }
    const frontLength = totalLength;
    const frontSegments = [...segments];
    for (let i = 0; i < frontSegments.length; i++) {
      const s = frontSegments[i]; segments.push([s[0], s[1], -depth * .5, s[3], s[4], -depth * .5]);
      weights.push(frontLength + weights[i * 2] * .72, frontLength + weights[i * 2 + 1] * .72);
      if (i % 4 === 0) { segments.push([s[0], s[1], -depth * .5, s[0], s[1], depth * .5]); weights.push(frontLength * .5 + weights[i * 2], frontLength * .5 + weights[i * 2] + depth / scale); }
    }
    const maxWeight = Math.max(...weights), g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(segments.flat(), 3)); g.setAttribute('aAlong', new T.Float32BufferAttribute(weights.map(w => w / maxWeight), 1)); geometries.push(g); return g;
  }
  const particles = [], surface = new T.Vector3(), n1 = new T.Vector3(), n2 = new T.Vector3(), n3 = new T.Vector3();
  for (let index = 0; index < TITLE.length; index++) {
    const char = TITLE[index], record = data[char]; if (!record?.path) throw Error('Missing Chinese outline: ' + char);
    const fillRule = /^F0/.test(record.path) ? 'evenodd' : 'nonzero';
    const outline = record.path.replace(/^F[01]\s*/, '');
    const parsed = paths.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path fill="#ffffff" fill-rule="${fillRule}" transform="scale(1,-1)" d="${outline}"/></svg>`);
    const shapes = parsed.paths.flatMap(p => p.toShapes());
    if (!shapes.length) throw Error('Could not triangulate Chinese outline: ' + char);
    const scale = .0328, depthUnits = 16.5, depth = depthUnits * scale;
    const geometry = new T.ExtrudeGeometry(shapes, { depth: depthUnits, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .65, bevelThickness: .65, curveSegments: 2 });
    geometry.translate(-50, 70, -depthUnits / 2); geometry.scale(scale, scale, scale); geometry.computeBoundingBox(); geometries.push(geometry);
    const cap = new T.MeshStandardMaterial({ color: '#f4f5ec', metalness: .18, roughness: .31, transparent: true, opacity: 0 });
    const side = new T.MeshStandardMaterial({ color: '#7286a9', metalness: .43, roughness: .36, transparent: true, opacity: 0 }); materials.push(cap, side);
    const placement = new T.Group(); placement.name = 'Title character / ' + char; placement.position.set((index - 1.5) * 3.52, .68, 0); group.add(placement);
    const mesh = new T.Mesh(geometry, [cap, side]); mesh.name = char + ' / actual closed extrusion'; mesh.userData.glyphIndex = index; mesh.castShadow = false; mesh.receiveShadow = true; placement.add(mesh); meshes.push(mesh);
    const contour = new T.LineSegments(makeContours(shapes, geometry.boundingBox, scale, depth), lineShader()); contour.name = char + ' / continuously drawn front and depth contours'; placement.add(contour);
    glyphs.push({ placement, mesh, cap, side, contour, index, rotationStart: -100, rotationFrom: 0, rotationTo: 0 });
    const pos = geometry.attributes.position, idx = geometry.index, triangles = []; let area = 0;
    for (let i = 0; i < (idx?.count ?? pos.count); i += 3) {
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      n1.fromBufferAttribute(pos, ia); n2.fromBufferAttribute(pos, ib); n3.fromBufferAttribute(pos, ic);
      const normal = n2.clone().sub(n1).cross(n3.clone().sub(n1)), weight = normal.length() * .5 * (normal.z < -.0001 ? .28 : 1);
      if (weight < 1e-10) continue; area += weight; triangles.push({ a: n1.clone(), b: n2.clone(), c: n3.clone(), limit: area, depth: normal.z < 0 ? .64 : 1 });
    }
    for (let j = 0; j < COUNT_PER_GLYPH; j++) {
      const id = index * COUNT_PER_GLYPH + j, at = rnd(id, 2) * area; let lo = 0, hi = triangles.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (triangles[mid].limit < at) lo = mid + 1; else hi = mid; }
      const tri = triangles[lo], u = Math.sqrt(rnd(id, 3)), v = rnd(id, 4);
      surface.copy(tri.a).multiplyScalar(1 - u).addScaledVector(tri.b, u * (1 - v)).addScaledVector(tri.c, u * v);
      particles.push({ id, glyph: index, source: surface.clone(), start: new T.Vector3(), destination: new T.Vector3(), c1: new T.Vector3(), c2: new T.Vector3(), depth: tri.depth, size: .147 + rnd(id, 5) * .062, delay: index * .085 + rnd(id, 6) * .15 });
    }
  }
  // Atlas glyphs stay stable for each particle: no per-frame random flicker.
  const atlas = document.createElement('canvas'); atlas.width = ASCII.length * 48; atlas.height = 64;
  const ctx = atlas.getContext('2d'); ctx.clearRect(0, 0, atlas.width, atlas.height); ctx.fillStyle = '#ffffff'; ctx.font = '500 38px Consolas, "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < ASCII.length; i++) ctx.fillText(ASCII[i], i * 48 + 24, 32);
  const texture = new T.CanvasTexture(atlas); texture.colorSpace = T.SRGBColorSpace; texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
  const particleGeometry = new T.PlaneGeometry(1, 1.25), glyphIndex = new T.InstancedBufferAttribute(new Float32Array(particles.length), 1), alpha = new T.InstancedBufferAttribute(new Float32Array(particles.length), 1);
  particleGeometry.setAttribute('aGlyph', glyphIndex); particleGeometry.setAttribute('aAlpha', alpha); geometries.push(particleGeometry);
  const particleMaterial = new T.MeshBasicMaterial({ color: '#bcdcff', map: texture, transparent: true, depthWrite: false, side: T.DoubleSide }); materials.push(particleMaterial);
  particleMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aGlyph;attribute float aAlpha;varying float vAsciiAlpha;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv.x=(vMapUv.x+aGlyph)/${ASCII.length.toFixed(1)};vAsciiAlpha=aAlpha;`);
    shader.fragmentShader = 'varying float vAsciiAlpha;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vAsciiAlpha;');
  };
  particleMaterial.customProgramCacheKey = () => 'linggan-title-surface-ascii-v1';
  const ascii = new T.InstancedMesh(particleGeometry, particleMaterial, particles.length); ascii.name = 'Title surfaces becoming the same chat frame / ASCII'; ascii.instanceMatrix.setUsage(T.DynamicDrawUsage); ascii.frustumCulled = false; ascii.visible = false; scene.add(ascii);
  for (const particle of particles) glyphIndex.setX(particle.id, Math.floor(rnd(particle.id, 7) * ASCII.length));
  const dummy = new T.Object3D(), current = new T.Vector3(), raycaster = new T.Raycaster(), pointer = new T.Vector2(99, 99);
  let lastPointer = null, morphBaked = false;
  function dimensions(expand = 0) {
    const worldHeight = 2 * Math.tan(camera.fov * Math.PI / 360) * 22;
    const chatW = width <= 700 ? width * .92 : Math.min(width * .74, 700), chatH = width <= 700 ? 330 : 360, filmW = Math.min(width * .86, 1280);
    return { w: T.MathUtils.lerp(chatW, filmW, expand) / width * worldHeight * camera.aspect, h: T.MathUtils.lerp(chatH, filmW * 9 / 16, expand) / height * worldHeight };
  }
  function destination(particle, expand = 0) {
    const d = dimensions(expand), id = particle.id, u = rnd(id, 8), section = id % 10;
    let w = d.w * .5, h = d.h * .5, x = 0, y = 0;
    if (section < 7) {
      const edge = id % 4;
      if (edge < 2) { x = (u * 2 - 1) * w; y = edge ? -h : h; }
      else { x = edge === 2 ? -w : w; y = (u * 2 - 1) * h; }
    } else if (section < 9) { x = (u * 2 - 1) * w * .85; y = -h * .37; }
    else { x = w * .78; y = -h * .37 + (u * 2 - 1) * h * .24; }
    particle.destination.set(x, y, .04 + (rnd(id, 9) - .5) * .09);
  }
  function bakeMorph() {
    group.updateMatrixWorld(true);
    for (const p of particles) {
      p.start.copy(p.source).applyMatrix4(glyphs[p.glyph].mesh.matrixWorld); destination(p);
      const sign = Math.sign(p.start.x) || (p.id % 2 ? 1 : -1);
      p.c1.copy(p.start).add(new T.Vector3(sign * (.6 + rnd(p.id, 10) * .9), .4 + rnd(p.id, 11) * 1.0, 2.0 + rnd(p.id, 12) * 1.4));
      p.c2.copy(p.destination).add(new T.Vector3(sign * (.35 + rnd(p.id, 13) * .8), .2 + (rnd(p.id, 14) - .5) * 1.1, .8 + rnd(p.id, 15) * 1.3));
    }
    morphBaked = true;
  }
  function movePointer(event) {
    if (event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientY < rect.top || event.clientX > rect.right || event.clientY > rect.bottom) { pointer.set(99, 99); lastPointer = null; return; }
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); lastPointer = event;
  }
  const ownerWindow = canvas.ownerDocument.defaultView || window;
  ownerWindow.addEventListener('pointermove', movePointer, { passive: true });

  function update({ time = 0, dt = 1 / 60, phase: nextPhase = 'intro', phaseTime = time, holdProgress = 0 } = {}) {
    if (disposed) return; phase = nextPhase; lastTime = time;
    if (phase !== previousPhase) {
      if (phase === 'morph') bakeMorph();
      if (phase === 'intro') { morphBaked = false; for (const g of glyphs) { g.rotationStart = -100; g.rotationFrom = g.rotationTo = 0; g.placement.rotation.set(0, 0, 0); } }
      previousPhase = phase;
    }
    const intro = phase === 'intro', morph = phase === 'morph', chat = phase === 'chat', launch = phase === 'launch', black = phase === 'black';
    if (intro && phaseTime > 1.4 && holdProgress < .1) {
      scene.updateMatrixWorld(true); raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObjects(meshes, false), next = hits[0]?.object.userData.glyphIndex ?? -1;
      if (next !== hovered && next >= 0) { const glyph = glyphs[next]; if (time - glyph.rotationStart > 2.5) { glyph.rotationStart = time; glyph.rotationFrom = glyph.placement.rotation.y; glyph.rotationTo = Math.ceil(glyph.rotationFrom / (Math.PI * 2) + .99) * Math.PI * 2; } }
      hovered = next;
    }
    let titleOpacity = intro ? 1 : morph ? 1 - between(.25, 1.65, phaseTime) : 0;
    group.visible = titleOpacity > .0001; shadow.visible = group.visible;
    for (const glyph of glyphs) {
      const elapsed = intro ? phaseTime : 4, fill = between(.75 + glyph.index * .16, 2.65 + glyph.index * .12, elapsed) * titleOpacity;
      const thickness = .018 + .982 * between(.35 + glyph.index * .12, 2.75 + glyph.index * .12, elapsed);
      glyph.mesh.scale.z = glyph.contour.scale.z = thickness;
      glyph.cap.opacity = fill; glyph.side.opacity = fill; glyph.mesh.castShadow = fill > .15;
      const stroke = glyph.contour.material.uniforms;
      stroke.reveal.value = between(glyph.index * .17, 2.1 + glyph.index * .13, elapsed);
      stroke.opacity.value = (1 - fill * .48) * titleOpacity; stroke.hold.value = holdProgress;
      glyph.cap.emissive.set('#9fc4ff'); glyph.cap.emissiveIntensity = holdProgress * .12;
      if (intro && glyph.rotationStart > -50) {
        const u = ease((time - glyph.rotationStart) / 3.7); glyph.placement.rotation.y = T.MathUtils.lerp(glyph.rotationFrom, glyph.rotationTo, u);
        glyph.placement.rotation.z = Math.sin(u * Math.PI * 2) * .018;
        if (u === 1) { glyph.placement.rotation.y = 0; glyph.rotationFrom = glyph.rotationTo = 0; glyph.rotationStart = -100; }
      }
    }
    const heldAscii = between(.73, 1, holdProgress), launchExpand = launch ? between(0, 2, phaseTime) : 0;
    ascii.visible = !black && (morph || chat || launch || heldAscii > .001);
    if (ascii.visible) {
      if ((morph || chat || launch) && !morphBaked) bakeMorph();
      group.updateMatrixWorld(true);
      for (const p of particles) {
        let opacity = 0;
        if (intro) {
          current.copy(p.source).applyMatrix4(glyphs[p.glyph].mesh.matrixWorld); current.z += .03;
          opacity = heldAscii * (rnd(p.id, 18) < .28 ? .9 : .08) * p.depth;
        } else if (morph) {
          const u = ease((phaseTime - p.delay) / 3.12), q = 1 - u;
          current.copy(p.start).multiplyScalar(q*q*q).addScaledVector(p.c1,3*q*q*u).addScaledVector(p.c2,3*q*u*u).addScaledVector(p.destination,u*u*u);
          opacity = between(p.delay - .1, p.delay + .38, phaseTime) * (1 - .86 * between(2.45, 3.6, phaseTime)) * p.depth;
        } else {
          destination(p, launchExpand); current.copy(p.destination);
          opacity = (chat ? .12 : .12 * (1 - between(.15, 1.15, phaseTime))) * p.depth;
        }
        dummy.position.copy(current); dummy.quaternion.copy(camera.quaternion);
        const rotate = morph ? Math.sin(clamp((phaseTime - p.delay) / 3.12) * Math.PI) * (rnd(p.id, 19) - .5) * .3 : 0;
        dummy.rotateZ(rotate); dummy.scale.setScalar(p.size * (intro ? .9 : 1)); dummy.updateMatrix(); ascii.setMatrixAt(p.id, dummy.matrix); alpha.setX(p.id, opacity);
      }
      ascii.instanceMatrix.needsUpdate = true; alpha.needsUpdate = true;
    }
    const darkness = black ? 1 : launch ? between(2.65, 4.35, phaseTime) : 0;
    scene.background.set('#081641').lerp(new T.Color('#000000'), darkness);
    ambient.intensity = 2.2 * (1 - darkness); key.intensity = 3.1 * (1 - darkness); rim.intensity = 2 * (1 - darkness);
    shadowMat.opacity = .18 * titleOpacity;
    return { phase, glyphCount: glyphs.length, particles: particles.length, source: 'provided Chinese outline extrusions', morphBaked, hovered };
  }
  function resize(w, h) {
    width = Math.max(1, w); height = Math.max(1, h); camera.aspect = width / height;
    // Preserve the four-character composition on narrower canvases.
    camera.fov = camera.aspect < 1.35 ? T.MathUtils.radToDeg(2 * Math.atan(8.2 / (22 * camera.aspect))) : 38;
    camera.updateProjectionMatrix();
    if (morphBaked && phase !== 'morph') for (const p of particles) destination(p);
  }
  resize(canvas.clientWidth || 1280, canvas.clientHeight || 720); update({ phase: 'intro', phaseTime: 0 });
  return {
    scene, camera, update, resize, glyphs, ascii,
    dispose() {
      if (disposed) return; disposed = true; ownerWindow.removeEventListener('pointermove', movePointer);
      for (const g of new Set(geometries)) g.dispose(); for (const m of new Set(materials)) m.dispose();
      texture.dispose(); shadow.geometry.dispose(); ascii.dispose(); key.shadow.map?.dispose(); scene.clear();
    },
  };
}
