import * as T from 'three';
import { loadSharedDot, CONTRACT, ACCEPTED_ID, sampleMotion } from '../assets/dot/index.mjs';
import { createTimedHornDissolve } from './dot-horn-dissolve.mjs';

const sat = x => Math.max(0, Math.min(1, x));
const ease = x => { x = sat(x); return x * x * x * (10 + x * (-15 + 6 * x)); };
const windowEase = (a, b, t) => ease((t - a) / (b - a));
const vec = (p, fallback) => p?.isVector3 ? p : Array.isArray(p) ? new T.Vector3(...p) : fallback;

// The stage and the scroll share the host scene. There is exactly one accepted
// character; its world root remains the same through performance and departure.
export async function createDotStage({ scene, camera, stageOrigin = new T.Vector3(0, 0, -15) } = {}) {
  if (!scene || !camera) throw Error('Dot stage requires the host scene and camera');
  stageOrigin = vec(stageOrigin, new T.Vector3(0, 0, -15)).clone();
  const stageGroup = new T.Group(); stageGroup.name = 'Linggan / white-screen stage'; stageGroup.position.copy(stageOrigin); scene.add(stageGroup);
  const architecture = new T.Group(); architecture.name = 'Stage / fluted architecture'; stageGroup.add(architecture);
  const stageMaterials = [], stageGeometries = [], screenWidth = 14.2, screenHeight = screenWidth * 9 / 16;
  function material(parameters) { const m = new T.MeshStandardMaterial(parameters); stageMaterials.push(m); return m; }
  const charcoal = material({ color: '#171d28', metalness: .38, roughness: .52 });
  const finsMat = material({ color: '#36414f', metalness: .7, roughness: .39 });
  const silver = material({ color: '#77808b', metalness: .8, roughness: .3 });
  const floorMat = material({ color: '#333c4c', metalness: .12, roughness: .64 });
  const white = new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }); stageMaterials.push(white);
  const warm = new T.MeshBasicMaterial({ color: '#f4e4c3', toneMapped: false }); stageMaterials.push(warm);
  function mesh(geometry, mat, name, position = [0, 0, 0], parent = architecture) {
    stageGeometries.push(geometry); const m = new T.Mesh(geometry, mat); m.name = name; m.position.set(...position); m.receiveShadow = true; parent.add(m); return m;
  }
  const floor = mesh(new T.PlaneGeometry(25.6, 24), floorMat, 'Stage / continuous reflective deck', [0, .008, 10.0], stageGroup);
  floor.rotation.x = -Math.PI / 2;
  const apron = mesh(new T.BoxGeometry(25.6, .24, 24), charcoal, 'Stage / shallow apron', [0, -.14, 10.0]);
  mesh(new T.BoxGeometry(25.6, .025, .035), silver, 'Stage / thin front edge', [0, -.015, 22.0]);
  for (let i = 0; i < 2; i++) mesh(new T.BoxGeometry(25.6 + (i + 1) * .38, .13, .65), charcoal, 'Stage / front step ' + i, [0, -.28 - i * .13, 22.3 + i * .6]);
  const screen = mesh(new T.PlaneGeometry(screenWidth, screenHeight), white, 'Stage / uninterrupted white 16:9 screen', [0, 4.35, .04]);
  screen.castShadow = false;
  mesh(new T.BoxGeometry(screenWidth + .5, screenHeight + .45, .22), charcoal, 'Stage / screen deep bezel', [0, 4.35, -.13]);
  mesh(new T.BoxGeometry(22.3, 10.1, .4), charcoal, 'Stage / recessed rear wall', [0, 4.8, -.45]);
  const trim = mesh(new T.BoxGeometry(screenWidth + .05, .025, .035), warm, 'Stage / upper warm cove', [0, 8.66, .15]);
  const sideGroups = [];
  for (const side of [-1, 1]) {
    const wing = new T.Group(); wing.name = 'Stage / side wing ' + side; architecture.add(wing); sideGroups.push({ wing, side });
    mesh(new T.BoxGeometry(.34, 10.1, 19.5), charcoal, 'Stage / side enclosure', [side * 11.1, 4.8, 9.2], wing);
    const geometry = new T.BoxGeometry(.064, 9.2, .23), count = 20; stageGeometries.push(geometry);
    const fins = new T.InstancedMesh(geometry, finsMat, count); fins.name = 'Stage / finely spaced metal flutes';
    const matrix = new T.Matrix4();
    for (let i = 0; i < count; i++) fins.setMatrixAt(i, matrix.makeTranslation(side * (7.42 + i * .17), 4.55, .17));
    wing.add(fins);
    for (let i = 0; i < 4; i++) mesh(new T.BoxGeometry(.025, 8.7, .035), warm, 'Stage / recessed side strip', [side * 10.88, 4.55, 2.5 + i * 4.3], wing);
  }
  const ringPoints = [];
  for (let i = 0; i <= 64; i++) { const x = i / 64 * 22 - 11; ringPoints.push(new T.Vector3(x, 9 + .45 * (1 - x * x / 121), .4)); }
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(ringPoints), 64, .028, 6, false), silver, 'Stage / shallow proscenium curve');

  const hemisphere = new T.HemisphereLight('#dce8ff', '#10131d', .3); stageGroup.add(hemisphere);
  const key = new T.DirectionalLight('#edf3ff', 1.35); key.position.set(3.7, 6.8, 10); key.target.position.set(0, 1.8, 4.5); stageGroup.add(key, key.target);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .5, far: 25 }); key.shadow.bias = -.00015; key.shadow.normalBias = .02;
  const rim = new T.DirectionalLight('#d3e5ff', 1.8); rim.position.set(-3, 5, -1); rim.target.position.set(0, 2, 4.5); stageGroup.add(rim, rim.target);
  const fixtures = [], beams = [], spots = [];
  const beamGeometry = new T.ConeGeometry(1, 1, 20, 1, true); beamGeometry.translate(0, -.5, 0); beamGeometry.rotateX(Math.PI); stageGeometries.push(beamGeometry);
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), fixture = new T.Group();
    fixture.position.set(side * (9.1 - row * .4), 7.5 - row * 1.1, 1.6 + row * 4.6); fixture.name = 'Stage / real moving light'; stageGroup.add(fixture);
    const housing = mesh(new T.CylinderGeometry(.19, .23, .46, 16), charcoal, 'Stage / moving-head barrel', [0, 0, 0], fixture); housing.rotation.x = Math.PI / 2;
    mesh(new T.CircleGeometry(.14, 24), warm, 'Stage / lamp lens', [0, 0, .24], fixture);
    for (const sign of [-1, 1]) mesh(new T.BoxGeometry(.055, .44, .29), finsMat, 'Stage / head yoke', [sign * .27, .04, -.02], fixture);
    const beamMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
      uniforms: { gain: { value: 0 }, tint: { value: new T.Color('#c9deff') } },
      vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 v;uniform float gain;uniform vec3 tint;void main(){float a=pow(sin(v.x*3.14159265),2.)*pow(1.-v.y,1.2)*smoothstep(0.,.16,v.y);gl_FragColor=vec4(tint,a*gain);}',
    }); stageMaterials.push(beamMat);
    const beam = new T.Mesh(beamGeometry, beamMat); beam.name = 'Stage / bounded haze beam'; beam.frustumCulled = false; stageGroup.add(beam);
    fixtures.push(fixture); beams.push(beam);
    const spot = i < 2 ? new T.SpotLight('#eaf1ff', 22, 30, .22, .8, 2) : null;
    if (spot) { spot.position.copy(fixture.position); stageGroup.add(spot, spot.target); spots.push(spot); }
  }

  // Small real ribbon pieces retain the inherited stage's final celebration,
  // with deterministic, absolute-time motion that also obeys media seeking.
  const confettiGeometry = new T.PlaneGeometry(.085, .23); stageGeometries.push(confettiGeometry);
  const confettiMaterial = material({ color: '#e3d2ad', metalness: .32, roughness: .54, side: T.DoubleSide, transparent: true, opacity: 0 });
  const confetti = new T.InstancedMesh(confettiGeometry, confettiMaterial, 96); confetti.name = 'Stage / restrained falling ribbon celebration'; confetti.frustumCulled = false; confetti.instanceMatrix.setUsage(T.DynamicDrawUsage); stageGroup.add(confetti);
  const ribbonDummy = new T.Object3D(), ribbonSeeds = [];
  const random = (i, salt) => { const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453123; return v - Math.floor(v); };
  for (let i = 0; i < 96; i++) {
    const side = i % 2 ? -1 : 1;
    ribbonSeeds.push({ x: side * (4.8 + random(i, 1) * 3.1), z: 4 + random(i, 2) * 7, side, birth: .71 + random(i, 3) * .22, height: 4.7 + random(i, 4) * 2.8, speed: .4 + random(i, 5) * .7 });
    confetti.setColorAt(i, new T.Color(i % 3 === 0 ? '#c2d4ef' : i % 3 === 1 ? '#cdb887' : '#e6e8e4'));
  }

  const rig = await loadSharedDot({ camera, scene, coordinates: 'normalized', context: 'stage', state: 'trumpet', instrument: true });
  const root = rig.root; root.name = 'Dot / D02 accepted / ONE continuous actor'; root.scale.setScalar(.9); scene.add(root);
  const stageActor = stageOrigin.clone().add(new T.Vector3(0, 1.55, 4.5)); root.position.copy(stageActor);
  const actorWorldPos = new T.Vector3(), actorBodyCentre = rig.native.body.geometry.boundingBox.getCenter(new T.Vector3());
  const eyeBase = rig.model.eyeAdapter.frontTargets.map(p => [...p]), gaze = new T.Vector2(), gazeTarget = new T.Vector2();
  const velocity = new T.Vector3(), target = new T.Vector3(), attentionPoint = new T.Vector3();
  const viewForward = new T.Vector3(), viewDelta = new T.Vector3();
  let previousCompanionZ = null, cameraDepth = 0;
  let attentionActive = false, attentionStart = -100, lastTime = 0, lastMode = 'hidden', duration = 0, retirement = null, disposed = false;
  let departureEnd = null, sideStart = 0, sideEnd = 0, sideStartTime = -10, lastSnapshot = null, lastStageTime = 0, lastDeparture = 0;
  const guidanceGeometry = new T.BufferGeometry(); guidanceGeometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(65 * 3), 3));
  const guidanceMaterial = new T.LineBasicMaterial({ color: '#e8cf8b', transparent: true, opacity: 0, depthWrite: false });
  const guidance = new T.Line(guidanceGeometry, guidanceMaterial); guidance.name = 'Dot / eye-led continuous guidance'; guidance.frustumCulled = false; scene.add(guidance);
  const contactMaterial = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { opacity: { value: .23 } },
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 v;uniform float opacity;void main(){vec2 p=(v-.5)*2.;gl_FragColor=vec4(.006,.01,.018,exp(-dot(p,p)*4.5)*(1.-smoothstep(.7,1.,length(p)))*opacity);}',
  });
  const contact = new T.Mesh(new T.PlaneGeometry(3.6, 3.2), contactMaterial); contact.name = 'Dot / soft contact in shared world'; contact.rotation.x = -Math.PI / 2; contact.renderOrder = 3; scene.add(contact);

  // A real mirror view of the current scene, softly filtered in the floor's
  // physical shader. Host calls beforeRender(renderer), then its normal render.
  const reflectionTarget = new T.WebGLRenderTarget(384, 216, { depthBuffer: true });
  reflectionTarget.texture.colorSpace = T.NoColorSpace;
  const mirror = new T.PerspectiveCamera(), reflectionMatrix = new T.Matrix4(), reflectedLook = new T.Vector3(), cameraDirection = new T.Vector3();
  const bias = new T.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1), reflectionGain = { value: .13 };
  const originalCompile = floorMat.onBeforeCompile;
  floorMat.onBeforeCompile = function(shader, renderer) {
    originalCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, { stageReflection: { value: reflectionTarget.texture }, stageReflectionMatrix: { value: reflectionMatrix }, stageReflectionGain: reflectionGain });
    shader.vertexShader = 'uniform mat4 stageReflectionMatrix;varying vec4 vStageReflection;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvStageReflection=stageReflectionMatrix*modelMatrix*vec4(transformed,1.);');
    shader.fragmentShader = 'uniform sampler2D stageReflection;uniform float stageReflectionGain;varying vec4 vStageReflection;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `vec2 suv=vStageReflection.xy/vStageReflection.w;
vec3 mirrorC=texture2D(stageReflection,suv).rgb*.24;
mirrorC+=(texture2D(stageReflection,suv+vec2(.003,0.)).rgb+texture2D(stageReflection,suv-vec2(.003,0.)).rgb)*.19;
mirrorC+=(texture2D(stageReflection,suv+vec2(0.,.005)).rgb+texture2D(stageReflection,suv-vec2(0.,.005)).rgb)*.19;
float within=step(0.,suv.x)*step(suv.x,1.)*step(0.,suv.y)*step(suv.y,1.);
outgoingLight+=mirrorC/(vec3(1.)+mirrorC*.8)*stageReflectionGain*within;
#include <opaque_fragment>`);
  };
  floorMat.customProgramCacheKey = () => 'linggan-continuous-stage-floor';
  let reflectionBusy = false, reflectionEnabled = true;
  function beforeRender(renderer) {
    if (!reflectionEnabled || reflectionBusy || !stageGroup.visible || !floor.visible || lastDeparture > .85 || !renderer) return;
    reflectionBusy = true;
    const savedTarget = renderer.getRenderTarget(), shadow = renderer.shadowMap.autoUpdate, savedXr = renderer.xr.enabled;
    const savedFloor = floor.visible, savedApron = apron.visible, savedContact = contact.visible, clipping = renderer.clippingPlanes;
    try {
      camera.updateMatrixWorld(); mirror.copy(camera, false); mirror.position.copy(camera.position); mirror.position.y = 2 * (stageOrigin.y + .008) - camera.position.y;
      camera.getWorldDirection(cameraDirection); reflectedLook.copy(camera.position).add(cameraDirection); reflectedLook.y = 2 * (stageOrigin.y + .008) - reflectedLook.y;
      mirror.up.set(0, -1, 0); mirror.lookAt(reflectedLook); mirror.updateMatrixWorld();
      reflectionMatrix.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
      floor.visible = false; apron.visible = false; contact.visible = false;
      // On the first stage frame its lights have never been rendered. Allocate
      // their actual depth maps before a mirror pass asks for shadow samplers;
      // an uninitialized fallback texture is invalid for sampler2DShadow.
      let uninitializedShadow = false;
      scene.traverseVisible(o => { if (o.isLight && o.castShadow && o.shadow && !o.shadow.map) uninitializedShadow = true; });
      renderer.shadowMap.autoUpdate = shadow && uninitializedShadow; renderer.xr.enabled = false;
      renderer.clippingPlanes = [new T.Plane(new T.Vector3(0, 1, 0), -stageOrigin.y - .012)];
      renderer.setRenderTarget(reflectionTarget); renderer.clear(); renderer.render(scene, mirror);
    } finally {
      renderer.setRenderTarget(savedTarget); renderer.shadowMap.autoUpdate = shadow; renderer.xr.enabled = savedXr; renderer.clippingPlanes = clipping;
      floor.visible = savedFloor; apron.visible = savedApron; contact.visible = savedContact; reflectionBusy = false;
    }
  }

  function sampleStage(time, performanceDuration) {
    // Retiming a source action is distinct from choosing a media cut point.
    // The caller provides the measured/configured current performance duration.
    const sourceT = sat(time / Math.max(.1, performanceDuration)) * CONTRACT.musicEnd;
    const after = Math.max(0, time - performanceDuration);
    const frame = rig.captureSequence(sourceT + Math.min(after, .7));
    frame.frontMix = windowEase(performanceDuration + .65, performanceDuration + 2.3, time);
    frame.hornAlpha = time < performanceDuration + 2.6 ? 1 : 0;
    frame.bodyRoll *= .22; frame.hatLift = 0;
    if (after > 0) { frame.closed = false; frame.blinkOpen = 1; }
    rig.setState('trumpet'); rig.setInstrumentVisible(true); rig.applyFrame(frame, { camera, scene, bindEyes: false });
    return frame;
  }
  function ensureRetirement(performanceDuration) {
    if (duration === performanceDuration && retirement) return;
    retirement?.dispose(); duration = performanceDuration;
    const savePosition = root.position.clone(), saveScale = root.scale.x;
    root.position.copy(stageActor); root.scale.setScalar(.9);
    sampleStage(duration + 1, duration); rig.faceCamera(camera); rig.finalizeEyes();
    retirement = createTimedHornDissolve(scene, rig.native.horn, { start: duration + 1, duration: 1.5, floorY: stageOrigin.y, worldScale: .9, count: 512,
      matrixAt(t) {
        sampleStage(t, duration); root.position.copy(stageActor); root.scale.setScalar(.9); rig.faceCamera(camera); root.updateWorldMatrix(true, true);
        return rig.native.horn.matrixWorld.clone();
      },
    });
    root.position.copy(savePosition); root.scale.setScalar(saveScale);
  }
  function idleFrame(time, attention) {
    const motion = sampleMotion('idle', time * .82), f = rig.capturePose('idle', 0);
    f.p.driftX = motion.position[0] * rig.model.actionUnit * .18;
    f.p.driftY = motion.position[1] * rig.model.actionUnit * .28;
    f.p.driftZ = motion.position[2] * rig.model.actionUnit * .15;
    f.bodyRoll = motion.rotation[2] * .6 - gaze.x * .075 * attention;
    f.p.sx = f.p.sy = f.p.sz = 1 + Math.sin(time * .9) * .004;
    f.closed = motion.eye === 'closed'; f.blinkOpen = 1; f.frontMix = 1;
    rig.setState('idle'); rig.setInstrumentVisible(false); rig.applyFrame(f, { camera, scene, bindEyes: false });
  }
  function spring(position, desired, dt) {
    const w = 5.2, decay = Math.exp(-w * dt);
    for (const key of ['x', 'y', 'z']) {
      const x = position[key] - desired[key], v = velocity[key], c = v + w * x;
      position[key] = desired[key] + (x + c * dt) * decay; velocity[key] = (v - w * c * dt) * decay;
    }
  }
  function keepAheadOfView(position, minimumDepth = 4) {
    // A world-space follower may lag behind a fast navigation camera, or the
    // reading camera may swing in front of its resting point. Keep the same
    // actor in a valid front half-space before binding its accepted eyes.
    // The constraint engages continuously at the boundary; it is not a catch
    // that freezes old eye matrices after a projection exception.
    camera.getWorldDirection(viewForward);
    const depth = viewDelta.copy(position).sub(camera.position).dot(viewForward);
    if (depth < minimumDepth) {
      position.addScaledVector(viewForward, minimumDepth - depth);
      const backwards = velocity.dot(viewForward);
      if (backwards < 0) velocity.addScaledVector(viewForward, -backwards);
    }
    return Math.max(depth, minimumDepth);
  }
  function update({ time = 0, mode = 'hidden', stageTime = 0, performanceDuration = 12, departureProgress = 0, companionTarget = new T.Vector3(8, 2.1, 0), dt = 1 / 60 } = {}) {
    if (disposed) return null; dt = Math.max(0, Math.min(.08, dt)); lastTime = time; lastStageTime = stageTime;
    const visible = mode !== 'hidden'; root.visible = visible; contact.visible = visible; guidance.visible = visible && attentionActive;
    if (!visible) { stageGroup.visible = false; retirement?.reset(); previousCompanionZ = null; lastMode = mode; return { acceptedId: ACCEPTED_ID, mode, actorWorldPos }; }
    target.copy(vec(companionTarget, target));
    const depart = mode === 'departure' ? ease(departureProgress) : mode === 'scroll' ? 1 : 0; lastDeparture = depart;
    stageGroup.visible = mode === 'stage' || (mode === 'departure' && departureProgress < 1);
    if (mode === 'stage') {
      ensureRetirement(Math.max(.1, performanceDuration));
      sampleStage(stageTime, performanceDuration); root.position.copy(stageActor); root.scale.setScalar(.9); rig.setContextMix(0);
      lastSnapshot = retirement.update(stageTime); rig.native.horn.visible = stageTime < duration + 2.6;
      velocity.set(0, 0, 0); departureEnd = null;
      previousCompanionZ = null;
    } else if (mode === 'departure') {
      if (!departureEnd || lastMode !== 'departure') departureEnd = target.clone();
      const end = departureEnd, side = Math.sign(end.x - stageActor.x) || 1;
      const b = stageActor.clone().add(new T.Vector3(side * .7, 1.35, 7.2));
      const c = end.clone().add(new T.Vector3(-side * 3.2, 1.25, -5.0));
      const q = 1 - depart;
      root.position.copy(stageActor).multiplyScalar(q * q * q).addScaledVector(b, 3 * q * q * depart).addScaledVector(c, 3 * q * depart * depart).addScaledVector(end, depart * depart * depart);
      root.scale.setScalar(T.MathUtils.lerp(.9, .55, depart)); idleFrame(stageTime, .5); rig.setContextMix(depart);
      retirement?.update(stageTime); rig.native.horn.visible = false; velocity.set(0, 0, 0);
      previousCompanionZ = null;
    } else {
      if (lastMode === 'hidden') { root.position.copy(target); velocity.set(0, 0, 0); sideStart = sideEnd = target.x; }
      if (lastMode !== 'scroll') { sideStart = root.position.x; sideEnd = target.x; sideStartTime = time; }
      // Carry the stage/scroll translation forward before the spring. Only a
      // small relative lag remains, even during a multi-chapter navigation;
      // lateral changes continue to use the independent curved side motion.
      if (lastMode === 'scroll' && previousCompanionZ !== null) root.position.z += (target.z - previousCompanionZ) * .92;
      previousCompanionZ = target.z;
      if (Math.sign(target.x) !== Math.sign(sideEnd) && Math.abs(target.x - sideEnd) > 1) { sideStart = root.position.x; sideEnd = target.x; sideStartTime = time; }
      else { sideEnd = target.x; } // Follow viewport-safe destinations as the scroll camera zooms.
      const sideP = ease((time - sideStartTime) / 2.6);
      target.x = T.MathUtils.lerp(sideStart, sideEnd, sideP); target.y += .48 * Math.sin(sideP * Math.PI);
      keepAheadOfView(target, 4.25);
      spring(root.position, target, dt); cameraDepth = keepAheadOfView(root.position, 4);
      root.scale.setScalar(.55); idleFrame(time, 1); rig.setContextMix(1); retirement?.reset();
    }
    // Eyes begin responding before the body and the growing guidance curve.
    gazeTarget.set(0, 0);
    if (attentionActive) {
      const from = root.position.clone().project(camera), to = attentionPoint.clone().project(camera);
      gazeTarget.set(Math.max(-1, Math.min(1, (to.x - from.x) * 1.5)), Math.max(-.65, Math.min(.65, (to.y - from.y) * 1.4)));
    }
    gaze.lerp(gazeTarget, 1 - Math.exp(-dt * 9));
    for (let i = 0; i < eyeBase.length; i++) {
      rig.model.eyeAdapter.frontTargets[i][0] = eyeBase[i][0] + gaze.x * .055 * rig.model.actionUnit;
      rig.model.eyeAdapter.frontTargets[i][1] = eyeBase[i][1] + gaze.y * .04 * rig.model.actionUnit;
    }
    rig.faceCamera(camera); rig.finalizeEyes(); root.updateWorldMatrix(true, true);
    actorWorldPos.copy(actorBodyCentre).applyMatrix4(rig.native.body.matrixWorld);
    contact.position.set(actorWorldPos.x, .035, actorWorldPos.z); contact.scale.setScalar(mode === 'stage' ? .95 : .63);
    contactMaterial.uniforms.opacity.value = .22 * Math.exp(-Math.max(0, actorWorldPos.y - 1.4) * .3);
    if (attentionActive) {
      const age = time - attentionStart, growth = windowEase(.22, 1.15, age), fade = 1 - windowEase(3.2, 4.5, age);
      const a = actorWorldPos.clone(), d = attentionPoint.clone(), b = a.clone().lerp(d, .32).add(new T.Vector3(0, .8, .8)), c = a.clone().lerp(d, .7).add(new T.Vector3(0, .6, .3));
      const positions = guidanceGeometry.attributes.position;
      for (let i = 0; i < 65; i++) { const u = i / 64, q = 1 - u; positions.setXYZ(i, q*q*q*a.x+3*q*q*u*b.x+3*q*u*u*c.x+u*u*u*d.x, q*q*q*a.y+3*q*q*u*b.y+3*q*u*u*c.y+u*u*u*d.y, q*q*q*a.z+3*q*q*u*b.z+3*q*u*u*c.z+u*u*u*d.z); }
      positions.needsUpdate = true; guidanceGeometry.setDrawRange(0, Math.max(2, Math.floor(growth * 65))); guidanceMaterial.opacity = .7 * fade * growth;
      if (age > 4.5) attentionActive = false;
    }
    if (stageGroup.visible) {
      const stageFade = 1 - windowEase(.13, .87, depart), lightFade = 1 - windowEase(.05, .7, depart);
      for (const { wing, side } of sideGroups) { wing.position.x = side * 8 * ease(depart); wing.position.z = -16 * ease(depart); }
      architecture.position.z = -18 * ease(depart); architecture.position.y = -.25 * depart;
      for (const m of stageMaterials) if (m !== floorMat && m !== confettiMaterial) { const transparent = stageFade < .999; if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; } m.opacity = stageFade; }
      floorMat.color.copy(new T.Color('#333c4c')).lerp(new T.Color('#164cff'), windowEase(.05, .8, depart));
      floor.scale.x = T.MathUtils.lerp(1, 22 / 25.6, depart); floor.scale.y = 1 + depart * 1.3; floor.position.z = 10 + depart * 11;
      floor.visible = depart < .985; reflectionGain.value = .13 * (1 - depart);
      hemisphere.intensity = .3 * lightFade; key.intensity = 1.35 * lightFade; rim.intensity = 1.8 * lightFade;
      const performanceGain = (1 - windowEase(performanceDuration, performanceDuration + 1.5, stageTime)) * lightFade;
      confetti.visible = stageTime > performanceDuration * .7 && stageTime < performanceDuration + 1.1;
      confettiMaterial.opacity = .7 * stageFade * (1 - windowEase(performanceDuration + .1, performanceDuration + 1.1, stageTime));
      if (confetti.visible) {
        for (let i = 0; i < ribbonSeeds.length; i++) {
          const seed = ribbonSeeds[i], age = stageTime - seed.birth * performanceDuration;
          const visible = age >= 0 && age < 4.2;
          ribbonDummy.position.set(seed.x - seed.side * age * seed.speed * .32 + Math.sin(age * 2.3 + i) * .18, seed.height + age * .55 - age * age * .24, seed.z + Math.sin(age * 1.4 + i) * .27);
          ribbonDummy.rotation.set(age * 1.6 + i, age * 2.1 + i * .7, age * 1.1);
          ribbonDummy.scale.setScalar(visible ? windowEase(0, .3, age) * (1 - windowEase(3.5, 4.2, age)) : 0);
          ribbonDummy.updateMatrix(); confetti.setMatrixAt(i, ribbonDummy.matrix);
        }
        confetti.instanceMatrix.needsUpdate = true;
      }
      for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i], beam = beams[i], dest = new T.Vector3(Math.sin(stageTime * .25 + i) * 4.4, .025, 8.5 + Math.sin(stageTime * .18 + i * 1.8) * 5.2);
        fixture.lookAt(stageOrigin.clone().add(dest));
        const direction = dest.clone().sub(fixture.position), length = direction.length();
        beam.position.copy(fixture.position); beam.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()); beam.scale.set(1.5, length, 1.5);
        beam.material.uniforms.gain.value = performanceGain * .042 * windowEase(.3, 1.6, stageTime);
        if (i < spots.length) { spots[i].target.position.copy(dest); spots[i].intensity = performanceGain * 22; }
      }
    }
    lastMode = mode;
    return { acceptedId: ACCEPTED_ID, mode, actorWorldPos, stageTime, performanceDuration, departureProgress, retirement: lastSnapshot, characterCount: 1 };
  }
  update({ mode: 'hidden' });
  return {
    root, stageGroup, rig, actorWorldPos, screen, floor, guidance, beforeRender,
    preparePerformance(performanceDuration) {
      if (!Number.isFinite(performanceDuration) || performanceDuration <= 0) throw Error('Measured performance duration required');
      ensureRetirement(performanceDuration); retirement.reset();
      return { duration, dissolveStart: duration + 1, dissolveEnd: duration + 2.5, lastParticle: retirement.lastDeath };
    },
    setAttention(point) { if (!point) { attentionActive = false; guidance.visible = false; return; } attentionPoint.copy(vec(point, attentionPoint)); attentionActive = true; attentionStart = lastTime; },
    setReflectionEnabled(enabled) { reflectionEnabled = !!enabled; },
    snapshot() { return { acceptedId: ACCEPTED_ID, characterCount: 1, mode: lastMode, stageTime: lastStageTime, departure: lastDeparture, actorWorldPos: actorWorldPos.toArray(), cameraDepth, duration, retirement: lastSnapshot, rig: rig.snapshot() }; },
    update,
    dispose() {
      if (disposed) return; disposed = true; retirement?.dispose(); rig.dispose(); stageGroup.removeFromParent(); guidance.removeFromParent(); contact.removeFromParent();
      for (const g of new Set(stageGeometries)) g.dispose(); for (const m of new Set(stageMaterials)) m.dispose();
      confetti.dispose();
      guidanceGeometry.dispose(); guidanceMaterial.dispose(); contact.geometry.dispose(); contactMaterial.dispose(); reflectionTarget.dispose();
      key.shadow.map?.dispose();
    },
  };
}
