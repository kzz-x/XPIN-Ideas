import * as T from 'three';

// Adapted from the supplied D02 horn-dissolve-r05 surface-sampling effect.
// The accepted model is untouched. Timing, ground and world scale belong to
// this host; there is deliberately no dependency on the previous film's cuts.
const sat = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = sat(x); return x * x * (3 - 2 * x); };
const random = (id, salt) => { const x = Math.sin(id * 127.1 + salt * 311.7) * 43758.5453123; return x - Math.floor(x); };

export function createTimedHornDissolve(scene, horn, {
  matrixAt, start, duration = 1.5, count = 512, floorY = 0, worldScale = 1,
} = {}) {
  if (typeof matrixAt !== 'function' || !Number.isFinite(start)) throw Error('Timed horn dissolve needs matrixAt and an absolute start');
  horn.updateWorldMatrix(true, true);
  const inv = horn.matrixWorld.clone().invert(), parts = [], triangles = [];
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), p = new T.Vector3(), cross = new T.Vector3();
  let totalArea = 0, minX = Infinity, maxX = -Infinity;
  horn.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    const toHorn = inv.clone().multiply(mesh.matrixWorld), attr = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const vertices = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i++) {
      p.fromBufferAttribute(attr, i).applyMatrix4(toHorn); vertices.set(p.toArray(), i * 3);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    }
    for (let k = 0; k < (index?.count ?? attr.count) - 2; k += 3) {
      const ia = index ? index.getX(k) : k, ib = index ? index.getX(k + 1) : k + 1, ic = index ? index.getX(k + 2) : k + 2;
      a.fromArray(vertices, ia * 3); b.fromArray(vertices, ib * 3); c.fromArray(vertices, ic * 3);
      cross.crossVectors(b.clone().sub(a), c.clone().sub(a));
      const area = cross.length() * .5;
      if (area > 1e-10) { totalArea += area; triangles.push({ a: a.toArray(), b: b.toArray(), c: c.toArray(), normal: cross.normalize().toArray(), limit: totalArea }); }
    }
    parts.push({ mesh, toHorn });
  });
  if (!(totalArea > 0 && maxX - minX > .001)) throw Error('Accepted horn surface missing');

  const span = maxX - minX, cut = { value: 0 }, ownedMaterials = [], originals = [];
  function patch(material, toHorn) {
    const prior = material.onBeforeCompile, priorKey = material.customProgramCacheKey;
    material.onBeforeCompile = function(shader, renderer) {
      prior.call(this, shader, renderer);
      Object.assign(shader.uniforms, { uHornProgress: cut, uHornToLocal: { value: toHorn }, uHornMin: { value: minX }, uHornSpan: { value: span } });
      shader.vertexShader = 'uniform mat4 uHornToLocal; varying vec3 vHornLocal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', 'vHornLocal=(uHornToLocal*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
      shader.fragmentShader = 'uniform float uHornProgress,uHornMin,uHornSpan; varying vec3 vHornLocal;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float hornAxis=clamp((vHornLocal.x-uHornMin)/uHornSpan,0.,1.);
float hornNoise=fract(sin(dot(vHornLocal,vec3(91.7,137.2,173.1)))*43758.5453);
float hornThreshold=clamp(.08+.84*(1.-hornAxis)+.09*(hornNoise-.5),.025,.975);
if(uHornProgress>=hornThreshold)discard;`);
    };
    material.customProgramCacheKey = () => 'linggan-d02-horn-surface/' + priorKey.call(material);
    material.needsUpdate = true; ownedMaterials.push(material); return material;
  }
  function clonePatch(source, toHorn) {
    const clone = source.clone(); clone.onBeforeCompile = source.onBeforeCompile; clone.customProgramCacheKey = source.customProgramCacheKey;
    return patch(clone, toHorn);
  }
  for (const { mesh, toHorn } of parts) {
    originals.push({ mesh, material: mesh.material, depth: mesh.customDepthMaterial, distance: mesh.customDistanceMaterial });
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => clonePatch(m, toHorn)) : clonePatch(mesh.material, toHorn);
    mesh.customDepthMaterial = mesh.customDepthMaterial ? clonePatch(mesh.customDepthMaterial, toHorn) : patch(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }), toHorn);
    mesh.customDistanceMaterial = mesh.customDistanceMaterial ? clonePatch(mesh.customDistanceMaterial, toHorn) : patch(new T.MeshDistanceMaterial(), toHorn);
  }
  const seeds = [], matrices = new Map();
  for (let id = 0; id < count; id++) {
    const at = random(id, 1) * totalArea; let lo = 0, hi = triangles.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (triangles[mid].limit < at) lo = mid + 1; else hi = mid; }
    const tri = triangles[lo], r = Math.sqrt(random(id, 2)), v = random(id, 3), weights = [1 - r, r * (1 - v), r * v];
    const point = [0, 1, 2].map(k => tri.a[k] * weights[0] + tri.b[k] * weights[1] + tri.c[k] * weights[2]);
    const axis = sat((point[0] - minX) / span), n = Math.sin(point[0] * 91.7 + point[1] * 137.2 + point[2] * 173.1) * 43758.5453;
    const threshold = Math.max(.025, Math.min(.975, .08 + .84 * (1 - axis) + .09 * (n - Math.floor(n) - .5)));
    let low = 0, high = 1;
    for (let j = 0; j < 20; j++) { const mid = (low + high) / 2; if (smooth(mid) < threshold) low = mid; else high = mid; }
    const birth = start + duration * (low + high) / 2, key = Math.round(birth * 90);
    let matrix = matrices.get(key); if (!matrix) { matrix = matrixAt(key / 90); matrices.set(key, matrix); }
    p.fromArray(point).applyMatrix4(matrix);
    const normal = new T.Vector3(...tri.normal).transformDirection(matrix);
    seeds.push({ id, birth, threshold, sourceHornLocal: point, origin: p.clone(), velocity: normal.multiplyScalar((.2 + random(id, 5) * .35) * worldScale).add(new T.Vector3(.07, .45 + random(id, 6) * .4, 0).multiplyScalar(worldScale)),
      spin: [4 + random(id, 7) * 10, 4 + random(id, 8) * 9, random(id, 9) * 12], size: (.006 + random(id, 10) * .010) * worldScale, life: .75 + random(id, 11) * .5 });
  }
  const firstBirth = Math.min(...seeds.map(s => s.birth)), lastDeath = Math.max(...seeds.map(s => s.birth + s.life));
  const material = new T.MeshStandardMaterial({ color: '#bd8d2c', metalness: .8, roughness: .31, emissive: '#6d400b', emissiveIntensity: .12, transparent: true, depthWrite: false });
  const particles = new T.InstancedMesh(new T.OctahedronGeometry(1, 0), material, count);
  const alpha = new T.InstancedBufferAttribute(new Float32Array(count), 1), dummy = new T.Object3D();
  particles.name = 'Dot / actual trumpet surface grains'; particles.geometry.setAttribute('aHornLife', alpha); particles.instanceMatrix.setUsage(T.DynamicDrawUsage); particles.frustumCulled = false; particles.visible = false; scene.add(particles);
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float aHornLife;varying float vHornLife;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHornLife=aHornLife;');
    shader.fragmentShader = 'varying float vHornLife;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vHornLife;');
  };
  material.customProgramCacheKey = () => 'linggan-d02-horn-grains';
  let disposed = false, active = 0;
  function update(time) {
    cut.value = smooth((time - start) / duration); active = 0;
    particles.visible = time >= firstBirth && time <= lastDeath;
    if (particles.visible) {
      for (const seed of seeds) {
        const age = time - seed.birth, alive = age >= 0 && age <= seed.life;
        const drag = 1.45, q = (1 - Math.exp(-drag * Math.max(0, age))) / drag;
        const y = seed.origin.y + (seed.velocity.y + 2.8 * worldScale / drag) * q - 2.8 * worldScale * Math.max(0, age) / drag;
        const opacity = alive && y > floorY + .012 ? smooth(age / .028) * (1 - smooth((age - seed.life * .65) / (seed.life * .35))) : 0;
        if (opacity > .001) {
          active++; dummy.position.set(seed.origin.x + seed.velocity.x * q, y, seed.origin.z + seed.velocity.z * q);
          dummy.rotation.set(seed.spin[0] * age, seed.spin[1] * age, seed.spin[2] * age); dummy.scale.setScalar(seed.size);
        } else { dummy.position.set(0, floorY - 50, 0); dummy.scale.setScalar(0); }
        alpha.setX(seed.id, opacity); dummy.updateMatrix(); particles.setMatrixAt(seed.id, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true; alpha.needsUpdate = true;
    }
    return { progress: cut.value, active, start, duration, lastDeath, source: 'D02 real triangle surfaces', surfaceMeshes: parts.length, triangles: triangles.length, globalOpacityFade: false };
  }
  return { particles, start, duration, lastDeath, update, reset: () => update(-1),
    dispose() {
      if (disposed) return; disposed = true; particles.removeFromParent(); particles.dispose(); particles.geometry.dispose(); material.dispose();
      for (const o of originals) { o.mesh.material = o.material; o.mesh.customDepthMaterial = o.depth; o.mesh.customDistanceMaterial = o.distance; }
      for (const m of ownedMaterials) m.dispose();
    },
  };
}
