/* Escenas 3D de Temporada (three.js r147, global THREE, sin red).
 *
 *   Escenas.agua(host)                 mar translúcido con peces, tortugas y mantarraya
 *   Escenas.playa(host)                maqueta de playa; .setGente(0..1) .setVentanas(0..1) .setSargazo(nivel)
 *   Escenas.ola(host, datos, alElegir, alPasar)  las olas del año; .setElegido(periodo) .setDestacado(id)
 *
 * Cada escena se pausa fuera de pantalla y respeta prefers-reduced-motion.
 * Si están cargados EffectComposer y UnrealBloomPass (vendor/post), la ola brilla.
 */
(function () {
  "use strict";
  const REDUCIDO = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  function base(host, op = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !op.fondo, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, op.pixelRatio || 2));
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    renderer.setClearColor(op.fondo || 0x000000, op.fondo ? 1 : 0);
    if (op.srgb) renderer.outputEncoding = THREE.sRGBEncoding;
    host.appendChild(renderer.domElement);
    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(op.fov || 40, (host.clientWidth || 1) / (host.clientHeight || 1), 0.1, 500);
    const cuadros = [];
    let visible = false, raf = 0, vivo = true, composer = null;
    const t0 = performance.now();
    function cuadro(t) {
      raf = 0;
      if (!vivo || !visible) return;
      const s = (t - t0) / 1000;
      for (const f of cuadros) f(s);
      if (composer) composer.render(); else renderer.render(escena, camara);
      if (!REDUCIDO) raf = requestAnimationFrame(cuadro);
    }
    const pedir = () => { if (!raf && vivo) raf = requestAnimationFrame(cuadro); };
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) pedir(); }, { rootMargin: "150px" });
    io.observe(host);
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
      pedir();
    });
    ro.observe(host);
    return {
      renderer, escena, camara, pedir,
      cadaCuadro: (f) => cuadros.push(f),
      conBrillo(fuerza, radio, umbral) {
        if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.UnrealBloomPass) return;
        if (window.innerWidth < 900 || (navigator.deviceMemory && navigator.deviceMemory < 4)) return;
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(escena, camara));
        composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), fuerza, radio, umbral));
      },
      destruir() { vivo = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); },
    };
  }

  function azar(semilla) {
    return function () {
      semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
      let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function unir(geos) {
    const pos = [], nor = [];
    for (let g of geos) {
      if (g.index) g = g.toNonIndexed();
      if (!g.attributes.normal) g.computeVertexNormals();
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    }
    const r = new THREE.BufferGeometry();
    r.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    r.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    return r;
  }
  function triangulo(a, b, c) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    g.computeVertexNormals();
    return g;
  }
  function texturaPunto() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // =================================================================== agua
  const VERT_AGUA = `
    uniform float uT; uniform vec2 uRaton; uniform float uFuerza;
    varying vec3 vP; varying vec3 vN;
    float ola(vec2 p) {
      float h = sin(p.x * 0.32 + uT * 0.55) * 0.20;
      h += sin(p.y * 0.48 - uT * 0.85 + p.x * 0.18) * 0.13;
      h += sin((p.x + p.y) * 1.05 + uT * 1.35) * 0.05;
      h += sin((p.x * 0.7 - p.y * 1.3) * 1.8 - uT * 1.9) * 0.025;
      float d = distance(p, uRaton);
      h += sin(d * 2.6 - uT * 4.5) * 0.16 * exp(-d * 0.38) * uFuerza;
      return h;
    }
    void main() {
      vec3 p = position;
      float h = ola(p.xz);
      float e = 0.06;
      vN = normalize(vec3(h - ola(p.xz + vec2(e, 0.0)), e, h - ola(p.xz + vec2(0.0, e))));
      p.y += h;
      vec4 w = modelMatrix * vec4(p, 1.0);
      vP = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const FRAG_AGUA = `
    uniform float uT; uniform vec3 uCam; uniform vec3 uSol;
    varying vec3 vP; varying vec3 vN;
    void main() {
      float b = smoothstep(3.0, -46.0, vP.z) + 0.035 * sin(vP.x * 0.35 + uT * 0.2);
      vec3 col = mix(vec3(0.62, 0.95, 0.90), vec3(0.36, 0.86, 0.84), smoothstep(0.0, 0.12, b));
      col = mix(col, vec3(0.16, 0.70, 0.74), smoothstep(0.10, 0.30, b));
      col = mix(col, vec3(0.08, 0.50, 0.60), smoothstep(0.28, 0.52, b));
      col = mix(col, vec3(0.04, 0.30, 0.42), smoothstep(0.50, 0.85, b));
      vec3 V = normalize(uCam - vP);
      vec3 N = normalize(vN);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      col = mix(col, vec3(0.90, 0.96, 0.96), fres * 0.55);
      vec3 H = normalize(normalize(uSol) + V);
      float brillo = pow(max(dot(N, H), 0.0), 220.0) * 1.8;
      col += vec3(1.0, 0.95, 0.82) * brillo;
      col = mix(col, vec3(0.953, 0.933, 0.890), smoothstep(-20.0, -52.0, vP.z));
      float alfa = mix(0.30, 1.0, smoothstep(0.04, 0.42, b)) + brillo;
      gl_FragColor = vec4(col, clamp(alfa + fres * 0.3, 0.0, 1.0));
    }`;
  const FRAG_FONDO = `
    uniform float uT; varying vec3 vP;
    void main() {
      vec2 q = vP.xz * 0.9;
      float c1 = sin(q.x * 2.1 + uT * 0.9 + sin(q.y * 1.7 + uT * 0.6) * 1.4);
      float c2 = sin(q.y * 2.4 - uT * 0.7 + sin(q.x * 1.3 - uT * 0.5) * 1.2);
      float caus = pow(max(0.0, 1.0 - abs(c1 + c2) * 0.8), 6.0);
      float d = smoothstep(2.0, -24.0, vP.z);
      vec3 col = mix(vec3(0.88, 0.92, 0.80), vec3(0.16, 0.58, 0.64), d);
      col += 0.035 * sin(vP.x * 3.0 + vP.z * 1.3);
      col += caus * 0.6 * (1.0 - d);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function geoPez() {
    const cuerpo = new THREE.SphereGeometry(0.5, 12, 8);
    cuerpo.scale(1, 0.42, 0.2);
    const g = unir([cuerpo,
      triangulo([-0.42, 0, 0], [-0.82, 0.26, 0], [-0.82, -0.26, 0]),
      triangulo([0.08, 0.18, 0], [-0.22, 0.36, 0], [-0.24, 0.16, 0])]);
    g.scale(0.5, 0.5, 0.5);
    return g;
  }

  function tortuga() {
    const g = new THREE.Group();
    const piel = new THREE.MeshLambertMaterial({ color: 0x9fb784, emissive: 0x1d2a18 });
    const caparazon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshLambertMaterial({ color: 0x5f7f3a, emissive: 0x1a2a0e, flatShading: true }));
    caparazon.scale.set(1, 0.36, 0.8);
    g.add(caparazon);
    const panza = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 8), new THREE.MeshLambertMaterial({ color: 0xe6d6a0 }));
    panza.scale.set(0.95, 0.16, 0.74);
    panza.position.y = -0.07;
    g.add(panza);
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), piel);
    cabeza.position.set(0.66, 0.03, 0);
    cabeza.scale.set(1.25, 0.85, 0.9);
    g.add(cabeza);
    const aletas = [];
    for (const [x, z, largo] of [[0.28, 1, 0.62], [0.28, -1, 0.62], [-0.36, 1, 0.3], [-0.36, -1, 0.3]]) {
      const pivote = new THREE.Group();
      pivote.position.set(x, 0, 0.3 * z);
      const aleta = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, largo), piel);
      aleta.position.z = (largo / 2) * z;
      aleta.rotation.y = -0.35 * z;
      pivote.add(aleta);
      g.add(pivote);
      aletas.push(pivote);
    }
    g.userData.aletas = aletas;
    return g;
  }

  function agua(host) {
    const b = base(host, { fov: 42, pixelRatio: 1.5 });
    const { escena, camara } = b;
    const rnd = azar(11);
    escena.add(new THREE.HemisphereLight(0xffffff, 0x2a8a90, 1.05));
    const luz = new THREE.DirectionalLight(0xfff4e0, 0.5);
    luz.position.set(4, 10, 3);
    escena.add(luz);

    const u = {
      uT: { value: 0 }, uRaton: { value: new THREE.Vector2(0, -5) }, uFuerza: { value: 0 },
      uCam: { value: new THREE.Vector3() }, uSol: { value: new THREE.Vector3(0.45, 0.35, -1) },
    };
    const gFondo = new THREE.PlaneGeometry(90, 60);
    gFondo.rotateX(-Math.PI / 2);
    gFondo.translate(0, -2.3, -20);
    escena.add(new THREE.Mesh(gFondo, new THREE.ShaderMaterial({ uniforms: { uT: u.uT }, vertexShader: "varying vec3 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }", fragmentShader: FRAG_FONDO })));

    // peces en cardúmenes
    // cardúmenes pequeños repartidos por todo el mar visible
    const COLORES = [0xffc93c, 0x3fb8ff, 0xff7a45, 0xfff1b0, 0x2ee6c5, 0xff5e8a, 0x9b7bff];
    const CARDUMENES = [];
    for (let k = 0; k < 16; k++) {
      const fila = k % 4;
      CARDUMENES.push({
        cx: -12 + ((k * 7) % 16) * 1.55 + rnd() * 1.2, cz: -2.4 - fila * 2.3 - rnd() * 1.2,
        ax: 1.6 + rnd() * 2.6, az: 0.6 + rnd() * 1.1, w: (0.12 + rnd() * 0.14) * (k % 2 ? -1 : 1),
        y: -0.55 - fila * 0.25 - rnd() * 0.3, color: COLORES[k % COLORES.length], f: rnd() * TAU,
      });
    }
    const POR = 4, N = CARDUMENES.length * POR;
    const peces = new THREE.InstancedMesh(geoPez(), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: 0x0d3035 }), N);
    const datosPez = [];
    for (let i = 0; i < N; i++) {
      const c = CARDUMENES[Math.floor(i / POR)];
      datosPez.push({ c, ox: (rnd() - 0.5) * 1.6, oy: (rnd() - 0.5) * 0.3, oz: (rnd() - 0.5) * 1.0, f: c.f + rnd() * 0.5, e: 0.9 + rnd() * 0.5, hx: 0, hz: 0 });
      peces.setColorAt(i, new THREE.Color(c.color).offsetHSL((rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.12));
    }
    escena.add(peces);

    const tortugas = [
      { g: tortuga(), cx: 5, cz: -5.5, ax: 4, az: 2.2, w: 0.06, f: 0 },
      { g: tortuga(), cx: -3, cz: -6, ax: 4.5, az: 1.8, w: -0.085, f: 2.4 },
    ];
    tortugas.forEach((t) => { t.g.scale.setScalar(1.15); escena.add(t.g); });

    const forma = new THREE.Shape();
    forma.moveTo(0.95, 0); forma.quadraticCurveTo(0.1, 0.95, -0.55, 0.05); forma.lineTo(-0.55, -0.05); forma.quadraticCurveTo(0.1, -0.95, 0.95, 0);
    const gRaya = new THREE.ShapeGeometry(forma, 8);
    gRaya.rotateX(-Math.PI / 2);
    const raya = new THREE.Group();
    raya.add(new THREE.Mesh(gRaya, new THREE.MeshLambertMaterial({ color: 0x3e5566, side: THREE.DoubleSide })));
    const colaRaya = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.02, 0.03), new THREE.MeshLambertMaterial({ color: 0x2f4150 }));
    colaRaya.position.x = -1.15;
    raya.add(colaRaya);
    escena.add(raya);

    const velero = new THREE.Group();
    const casco = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.45), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    velero.add(casco);
    const vela = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.15), new THREE.Vector2(0, 2.2), new THREE.Vector2(1.1, 0.15)])), new THREE.MeshLambertMaterial({ color: 0xfff7ea, side: THREE.DoubleSide }));
    vela.position.x = -0.4;
    velero.add(vela);
    velero.position.set(0, 0.1, -36);
    escena.add(velero);

    const aguaMat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_AGUA, fragmentShader: FRAG_AGUA, transparent: true, depthWrite: false });
    const gAgua = new THREE.PlaneGeometry(110, 70, 260, 180);
    gAgua.rotateX(-Math.PI / 2);
    gAgua.translate(0, 0, -26);
    const mallaAgua = new THREE.Mesh(gAgua, aguaMat);
    mallaAgua.renderOrder = 2;
    escena.add(mallaAgua);

    let progreso = 0, fuerza = 0;
    const raton = new THREE.Vector2(0, -5), ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
    const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), punto = new THREE.Vector3();
    function mover(e) {
      const r = host.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camara);
      if (ray.ray.intersectPlane(plano, punto)) { raton.set(punto.x, punto.z); fuerza = 1; b.pedir(); }
    }
    window.addEventListener("pointermove", mover, { passive: true });

    const d = new THREE.Object3D();
    b.cadaCuadro((s) => {
      u.uT.value = s;
      u.uRaton.value.lerp(raton, 0.07);
      fuerza *= 0.99;
      u.uFuerza.value += (fuerza - u.uFuerza.value) * 0.04;
      const rx = u.uRaton.value.x, rz = u.uRaton.value.y, miedo = u.uFuerza.value;

      datosPez.forEach((p, i) => {
        const c = p.c, tt = s * c.w + p.f;
        const x = c.cx + c.ax * Math.sin(tt) + p.ox + Math.sin(s * 1.3 + p.f) * 0.15;
        const z = c.cz + c.az * Math.sin(tt * 2) * 0.5 + p.oz;
        const dx = c.ax * Math.cos(tt) * c.w, dz = c.az * Math.cos(tt * 2) * c.w;
        const vx = x + p.hx - rx, vz = z + p.hz - rz, dist = Math.hypot(vx, vz) || 1;
        const empuje = dist < 3.2 ? (3.2 - dist) * 1.1 * miedo : 0;
        p.hx += ((vx / dist) * empuje - p.hx) * 0.06;
        p.hz += ((vz / dist) * empuje - p.hz) * 0.06;
        d.position.set(x + p.hx, c.y + p.oy + Math.sin(s * 2 + p.f) * 0.05, z + p.hz);
        d.rotation.set(0, Math.atan2(-dz, dx) + Math.sin(s * 9 + p.f) * 0.14, 0);
        d.scale.setScalar(p.e);
        d.updateMatrix();
        peces.setMatrixAt(i, d.matrix);
      });
      peces.instanceMatrix.needsUpdate = true;

      tortugas.forEach((t) => {
        const tt = s * t.w + t.f;
        const x = t.cx + t.ax * Math.cos(tt), z = t.cz + t.az * Math.sin(tt);
        const dx = -t.ax * Math.sin(tt) * t.w, dz = t.az * Math.cos(tt) * t.w;
        const sube = Math.pow(Math.max(0, Math.sin(s * 0.18 + t.f)), 8);
        t.g.position.set(x, -1.35 + sube * 1.15, z);
        t.g.rotation.set(0, Math.atan2(-dz, dx), sube > 0.05 ? Math.cos(s * 0.18 + t.f) * 0.5 : 0, "YXZ");
        const [a, b2, c, e] = t.g.userData.aletas;
        const bat = Math.sin(s * 2.2 + t.f);
        a.rotation.x = bat * 0.6; b2.rotation.x = -bat * 0.6;
        c.rotation.x = Math.sin(s * 2.2 + t.f + 1) * 0.3; e.rotation.x = -Math.sin(s * 2.2 + t.f + 1) * 0.3;
      });

      const tr = s * 0.05;
      raya.position.set(Math.sin(tr) * 7, -2.05, -5 + Math.cos(tr * 1.7) * 2.5);
      raya.rotation.set(Math.sin(s * 1.6) * 0.12, Math.atan2(Math.sin(tr * 1.7) * 1.7 * 2.5, Math.cos(tr) * 7), 0, "YXZ");
      raya.scale.set(1, 1, 1 + Math.sin(s * 1.6) * 0.08);

      velero.position.x = ((s * 0.35) % 70) - 35;
      velero.position.y = 0.1 + Math.sin(s * 0.8) * 0.05;

      camara.position.set(Math.sin(s * 0.11) * 0.7, 2.4 - progreso * 1.3 + Math.sin(s * 0.23) * 0.07, 7 - progreso * 3);
      camara.lookAt(Math.sin(s * 0.07) * 0.4, 0.2 - progreso * 0.9, -14);
      u.uCam.value.copy(camara.position);
    });
    b.pedir();
    return { setProgreso(p) { progreso = p; b.pedir(); }, destruir() { window.removeEventListener("pointermove", mover); b.destruir(); } };
  }

  // ================================================================== playa
  const R = 10;
  const orilla = (x) => 2.0 + Math.sin(x * 0.5 + 0.6) * 0.55 + Math.sin(x * 1.3) * 0.12;

  function planoCircular(segmentos) {
    const g = new THREE.PlaneGeometry(2 * R, 2 * R, segmentos, segmentos);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r > R) { p.setX(i, (x / r) * R); p.setZ(i, (z / r) * R); }
    }
    return g;
  }

  function palmera(escena, x, z, alto, giro) {
    const tronco = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 });
    const hojaMat = new THREE.MeshStandardMaterial({ color: 0x2f8a55, roughness: 0.7, side: THREE.DoubleSide });
    const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + giro * 2, alto * 0.6, z), new THREE.Vector3(x + giro * 3, alto, z + 0.2));
    const t = new THREE.Mesh(new THREE.TubeGeometry(curva, 16, 0.09, 8), tronco);
    t.castShadow = true;
    escena.add(t);
    const copa = curva.getPoint(1);
    for (let k = 0; k < 8; k++) {
      const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2, 4, 1, true), hojaMat);
      hoja.geometry.translate(0, 1, 0);
      hoja.position.copy(copa);
      hoja.rotation.set(1.95, (k / 8) * TAU, 0, "YXZ");
      hoja.scale.set(1, 1, 0.25);
      hoja.castShadow = true;
      escena.add(hoja);
    }
  }

  function playa(host) {
    const b = base(host, { fov: 30, srgb: true });
    const { escena, camara, renderer } = b;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const rnd = azar(7);

    escena.add(new THREE.HemisphereLight(0xffffff, 0xd8c3a0, 0.85));
    const sol = new THREE.DirectionalLight(0xfff1dc, 1.35);
    sol.position.set(-8, 16, 6);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
    sol.shadow.bias = -0.0006;
    escena.add(sol);

    // arena
    const gArena = planoCircular(110);
    const pa = gArena.attributes.position, colores = [];
    const seca = new THREE.Color(0xf6ead0), mojada = new THREE.Color(0xd2b88c);
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i), o = orilla(x);
      pa.setY(i, 0.09 * Math.sin(x * 0.8) * Math.cos(z * 0.6) - 0.5 * THREE.MathUtils.smoothstep(z, o - 0.2, o + 2.5));
      const c = seca.clone().lerp(mojada, THREE.MathUtils.smoothstep(z, o - 1.4, o));
      colores.push(c.r, c.g, c.b);
    }
    gArena.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
    gArena.computeVertexNormals();
    const arena = new THREE.Mesh(gArena, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    arena.receiveShadow = true;
    escena.add(arena);

    // agua
    const uAgua = { uT: { value: 0 } };
    const agua = new THREE.Mesh(planoCircular(90), new THREE.ShaderMaterial({
      uniforms: uAgua, transparent: true,
      vertexShader: `uniform float uT; varying vec3 vP; void main(){ vec3 p = position; p.y = 0.02 + sin(p.x*1.2+uT*1.4)*0.025 + sin(p.z*1.7-uT*1.1)*0.02; vP = p; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `uniform float uT; varying vec3 vP;
        float orilla(float x){ return 2.0 + sin(x*0.5+0.6)*0.55 + sin(x*1.3)*0.12; }
        void main(){
          float d = vP.z - orilla(vP.x);
          if (d < -0.02) discard;
          vec3 c = mix(vec3(0.62,0.93,0.87), vec3(0.14,0.66,0.71), smoothstep(0.0, 3.5, d));
          c = mix(c, vec3(0.05,0.40,0.50), smoothstep(3.5, 8.0, d));
          float espuma = 1.0 - smoothstep(0.0, 0.28 + 0.1*sin(vP.x*2.0 + uT*1.6), d);
          float linea = smoothstep(0.05, 0.0, abs(d - 0.7 - 0.25*sin(uT*0.9 + vP.x*0.8))) * 0.55;
          c = mix(c, vec3(1.0), clamp(espuma + linea, 0.0, 1.0));
          c += pow(max(sin(vP.x*3.1+uT*2.0)*sin(vP.z*2.7-uT*1.3), 0.0), 12.0) * 0.25;
          gl_FragColor = vec4(c, 0.94);
        }`,
    }));
    escena.add(agua);

    const lado = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.94, 1.8, 160, 1, true), new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: "varying vec3 vP; varying vec2 vUv; void main(){ vP = position; vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: `varying vec3 vP; varying vec2 vUv;
        float orilla(float x){ return 2.0 + sin(x*0.5+0.6)*0.55 + sin(x*1.3)*0.12; }
        void main(){
          float mar = step(orilla(vP.x), vP.z);
          vec3 arriba = mix(vec3(0.93,0.86,0.72), vec3(0.20,0.70,0.74), mar);
          vec3 abajo = mix(vec3(0.62,0.50,0.36), vec3(0.03,0.22,0.30), mar);
          vec3 c = mix(abajo, arriba, smoothstep(0.0, 1.0, vUv.y));
          c *= 0.92 + 0.08 * step(0.5, fract(vUv.y * 6.0));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    lado.position.y = -0.9;
    escena.add(lado);
    const fondo = new THREE.Mesh(new THREE.CircleGeometry(R * 0.94, 96), new THREE.MeshBasicMaterial({ color: 0x0b3440 }));
    fondo.rotation.x = Math.PI / 2;
    fondo.position.y = -1.8;
    escena.add(fondo);

    palmera(escena, -8.3, -2.4, 3.3, 0.25);
    palmera(escena, -7.2, -5.2, 2.7, -0.2);
    palmera(escena, 8.1, -3.2, 3.0, -0.25);

    // hoteles: ventanas encendidas = cuartos ocupados
    const HOTELES = [[-5.4, -7.1, 2.0, 3.4], [-2.6, -8.5, 2.3, 4.4], [0.6, -8.7, 2.2, 3.8], [3.6, -7.9, 2.1, 4.2], [6.1, -6.3, 1.9, 2.9]];
    const matHotel = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.8 });
    const matTecho = new THREE.MeshStandardMaterial({ color: 0x1fa4ae, roughness: 0.5 });
    const posVentanas = [];
    const padre = new THREE.Object3D(), hijo = new THREE.Object3D();
    padre.add(hijo);
    for (const [x, z, w, h] of HOTELES) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(-x, -z);
      const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), matHotel);
      cuerpo.position.y = h / 2;
      cuerpo.castShadow = cuerpo.receiveShadow = true;
      g.add(cuerpo);
      const techo = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, 1.3), matTecho);
      techo.position.y = h + 0.06;
      g.add(techo);
      escena.add(g);
      padre.position.copy(g.position);
      padre.rotation.copy(g.rotation);
      const cols = Math.floor((w - 0.2) / 0.36), filas = Math.floor((h - 0.5) / 0.42);
      for (let f = 0; f < filas; f++) {
        for (let c = 0; c < cols; c++) {
          hijo.position.set(-w / 2 + 0.28 + c * ((w - 0.56) / Math.max(1, cols - 1)), 0.45 + f * 0.42, 0.61);
          padre.updateMatrixWorld(true);
          posVentanas.push(hijo.matrixWorld.clone());
        }
      }
    }
    const ventanas = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshBasicMaterial({ toneMapped: false }), posVentanas.length);
    const APAGADA = new THREE.Color(0x3b5a63), ENCENDIDA = new THREE.Color(0xffc861);
    const ordenV = posVentanas.map((m, i) => i).sort(() => rnd() - 0.5);
    posVentanas.forEach((m, i) => { ventanas.setMatrixAt(i, m); ventanas.setColorAt(i, APAGADA); });
    escena.add(ventanas);
    let ventanasMeta = 0, ventanasAhora = 0;

    // salvavidas y lanchas
    const torre = new THREE.Group();
    const madera = new THREE.MeshStandardMaterial({ color: 0xf2f2f2 });
    for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), madera);
      pata.position.set(lx, 0.55, lz);
      torre.add(pata);
    }
    const caseta = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0xe5472d }));
    caseta.position.y = 1.35;
    caseta.castShadow = true;
    torre.add(caseta);
    torre.position.set(0.8, 0, orilla(0.8) - 1.4);
    escena.add(torre);
    const lanchas = [[-3.2, 5.6, 0xf2a541], [3.6, 6.1, 0x1fa4ae]].map(([x, z, color]) => {
      const g = new THREE.Group();
      const casco = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.24, 0.46), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      const franja = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 0.48), new THREE.MeshStandardMaterial({ color }));
      franja.position.y = 0.04;
      const toldo = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.5), new THREE.MeshStandardMaterial({ color }));
      toldo.position.set(-0.1, 0.55, 0);
      g.add(casco, franja, toldo);
      g.position.set(x, 0.1, z);
      g.rotation.y = rnd() * TAU;
      escena.add(g);
      return g;
    });

    // gente, palapas, sombrillas, toallas, sargazo
    const PALETA = [0xe5472d, 0xf2a541, 0x1fa4ae, 0x0c5a68, 0xffffff, 0x8be3d8, 0xd9674e, 0x2f4858, 0xf6d8b0, 0x6c5ce7];
    const PIEL = [0xf1c7a1, 0xd9a47c, 0xa8744f, 0x7a4f35];
    const MAX = 560, MAXP = 36, MAXU = 40, MAXS = 130;
    const gCuerpo = new THREE.CapsuleGeometry(0.1, 0.24, 3, 8); gCuerpo.translate(0, 0.22, 0);
    const gCabeza = new THREE.SphereGeometry(0.085, 10, 8); gCabeza.translate(0, 0.53, 0);
    const cuerpos = new THREE.InstancedMesh(gCuerpo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAX);
    const cabezas = new THREE.InstancedMesh(gCabeza, new THREE.MeshStandardMaterial({ roughness: 0.7 }), MAX);
    const gPalapa = new THREE.ConeGeometry(0.78, 0.55, 9); gPalapa.translate(0, 1.15, 0);
    const gSomb = new THREE.ConeGeometry(0.6, 0.28, 14); gSomb.translate(0, 1.08, 0);
    const gPalo = new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6); gPalo.translate(0, 0.52, 0);
    const gToalla = new THREE.BoxGeometry(0.34, 0.02, 0.66); gToalla.translate(0.45, 0.02, 0.25);
    const palapas = new THREE.InstancedMesh(gPalapa, new THREE.MeshStandardMaterial({ color: 0xb8894b, roughness: 1, flatShading: true }), MAXP);
    const palosP = new THREE.InstancedMesh(gPalo, new THREE.MeshStandardMaterial({ color: 0x8a6a45 }), MAXP);
    const sombrillas = new THREE.InstancedMesh(gSomb, new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAXU);
    const palosU = new THREE.InstancedMesh(gPalo, new THREE.MeshStandardMaterial({ color: 0xf1f3ef }), MAXU);
    const toallas = new THREE.InstancedMesh(gToalla, new THREE.MeshStandardMaterial({ roughness: 1 }), MAXU);
    const gAlga = new THREE.SphereGeometry(0.16, 7, 5); gAlga.scale(1.6, 0.25, 0.8);
    const algas = new THREE.InstancedMesh(gAlga, new THREE.MeshStandardMaterial({ color: 0x6b4d22, roughness: 1 }), MAXS);
    for (const m of [cuerpos, cabezas, palapas, palosP, sombrillas, palosU, toallas]) { m.castShadow = true; m.receiveShadow = true; escena.add(m); }
    escena.add(algas);

    const personas = [];
    while (personas.length < MAX) {
      const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R, o = orilla(x);
      if (Math.hypot(x, z) > R - 0.5 || z > o + 1.8 || z < -5.8) continue;
      if (rnd() > Math.exp(-(o - z) / 5)) continue;
      personas.push({ x, z, agua: z > o + 0.1, rot: rnd() * TAU, fase: rnd() * TAU, vel: 0.05 + rnd() * 0.08, e: 0 });
    }
    personas.forEach((p, i) => {
      cuerpos.setColorAt(i, new THREE.Color(PALETA[i % PALETA.length]));
      cabezas.setColorAt(i, new THREE.Color(PIEL[i % PIEL.length]));
    });
    function sombras(n, lista) {
      while (lista.length < n) {
        const x = (rnd() * 2 - 1) * (R - 1.5), o = orilla(x), z = o - 1 - rnd() * 4.5;
        if (Math.hypot(x, z) > R - 1 || z < -5.5) continue;
        lista.push({ x, z, rot: rnd() * TAU, vel: 0.04 + rnd() * 0.06, e: 0 });
      }
      return lista;
    }
    const listaP = sombras(MAXP, []), listaU = sombras(MAXU, []);
    listaU.forEach((s, i) => {
      sombrillas.setColorAt(i, new THREE.Color(PALETA[(i * 3) % PALETA.length]));
      toallas.setColorAt(i, new THREE.Color(PALETA[(i * 7 + 2) % PALETA.length]));
    });
    const alga = [];
    while (alga.length < MAXS) {
      const x = (rnd() * 2 - 1) * (R - 0.8), z = orilla(x) - 0.1 + (rnd() - 0.5) * 0.5;
      if (Math.hypot(x, z) > R - 0.6) continue;
      alga.push({ x, z, rot: rnd() * TAU, e: 0 });
    }

    let objetivo = 0, objetivoS = 0;
    const d = new THREE.Object3D();
    const escalar = (lista, meta, inst, malla, extra) => {
      lista.forEach((u, i) => {
        const m = i < meta ? 1 : 0;
        u.e = inst ? m : u.e + (m - u.e) * (u.vel || 0.06);
        d.position.set(u.x, 0, u.z);
        d.rotation.set(0, u.rot, 0);
        d.scale.setScalar(Math.max(u.e, 0.0001));
        d.updateMatrix();
        malla.forEach((mm) => mm.setMatrixAt(i, d.matrix));
      });
      malla.forEach((mm) => { mm.instanceMatrix.needsUpdate = true; });
    };
    const _escalar = escalar;
    function escalarPalapas(meta, inst) { _escalar(listaP, meta, inst, [palapas, palosP]); }

    b.cadaCuadro((s) => {
      uAgua.uT.value = s;
      const a = 0.55 + Math.sin(s * 0.09) * 0.28;
      camara.position.set(Math.sin(a) * 23, 15.5, Math.cos(a) * 23);
      camara.lookAt(0, -0.2, 0.2);
      lanchas.forEach((l, i) => { l.position.y = 0.08 + Math.sin(s * 1.3 + i) * 0.05; l.rotation.z = Math.sin(s * 1.1 + i) * 0.05; });
      personas.length && actualizarTodo(s, REDUCIDO);
    });
    function actualizarTodo(s, inst) {
      const k = objetivo / MAX;
      personas.forEach((p, i) => {
        const meta = i < objetivo ? 1 : 0;
        p.e = inst ? meta : p.e + (meta - p.e) * p.vel;
        const salto = Math.max(0, Math.sin(p.e * Math.PI)) * 0.5 * (1 - p.e);
        d.position.set(p.x, (p.agua ? -0.16 + Math.sin(s * 1.6 + p.fase) * 0.04 : 0) + salto, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.setScalar(Math.max(p.e, 0.0001));
        d.updateMatrix();
        cuerpos.setMatrixAt(i, d.matrix);
        cabezas.setMatrixAt(i, d.matrix);
      });
      cuerpos.instanceMatrix.needsUpdate = cabezas.instanceMatrix.needsUpdate = true;
      escalarPalapas(Math.round(Math.min(1, k * 1.5) * MAXP), inst);
      _escalar(listaU, Math.round(Math.max(0, k * 1.4 - 0.2) * MAXU), inst, [sombrillas, palosU, toallas]);
      _escalar(alga, objetivoS, inst, [algas]);
      if (ventanasAhora !== ventanasMeta) {
        const paso = inst ? Math.abs(ventanasMeta - ventanasAhora) : Math.max(1, Math.round(posVentanas.length / 50));
        for (let n = 0; n < paso && ventanasAhora !== ventanasMeta; n++) {
          if (ventanasAhora < ventanasMeta) ventanas.setColorAt(ordenV[ventanasAhora++], ENCENDIDA);
          else ventanas.setColorAt(ordenV[--ventanasAhora], APAGADA);
        }
        ventanas.instanceColor.needsUpdate = true;
      }
    }
    actualizarTodo(0, true);
    return {
      setGente(k) { objetivo = Math.round(Math.max(0, Math.min(1, k)) * MAX); b.pedir(); },
      setVentanas(k) { ventanasMeta = Math.round(Math.max(0, Math.min(1, k)) * posVentanas.length); b.pedir(); },
      setSargazo(nivel) { objetivoS = nivel === "alto" ? MAXS : nivel === "medio" ? 45 : 0; b.pedir(); },
      destruir: b.destruir,
    };
  }

  // ==================================================================== ola
  // Cada destino es una ola de mar: su altura en cada mes es la gente esperada.
  // Encima: boyas de color por mes, bandera en el mes elegido, un surfista que
  // recorre la ola del destino elegido, delfines que saltan y gaviotas.
  const VERT_OLA = `
    uniform float uT; uniform float uAlto;
    attribute float aCresta; attribute vec3 aColor;
    varying float vV; varying float vCresta; varying vec3 vN; varying vec3 vW; varying vec3 vCol;
    void main() {
      vec3 p = position;
      float r = sin(p.x * 2.4 + uT * 1.6) * 0.035 + sin(p.x * 5.3 - uT * 2.3 + p.z * 3.0) * 0.018;
      p.y += r * (0.4 + aCresta);
      p.z += sin(p.x * 0.9 + uT * 0.8) * 0.06 * aCresta;
      vV = clamp(p.y / uAlto, 0.0, 1.0);
      vCresta = aCresta;
      vCol = aColor;
      vec4 w = modelMatrix * vec4(p, 1.0);
      vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const FRAG_OLA = `
    uniform float uT; uniform float uAtenuar; uniform vec3 uCam;
    varying float vV; varying float vCresta; varying vec3 vN; varying vec3 vW; varying vec3 vCol;
    float ruido(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float suave(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(ruido(i), ruido(i + vec2(1, 0)), f.x), mix(ruido(i + vec2(0, 1)), ruido(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
      vec3 N = normalize(vN);
      if (!gl_FrontFacing) N = -N;
      vec3 V = normalize(uCam - vW);
      vec3 L = normalize(vec3(-0.3, 0.8, 0.6));
      vec3 hondo = vec3(0.03, 0.33, 0.42), medio = vec3(0.07, 0.62, 0.68), claro = vec3(0.48, 0.90, 0.86);
      vec3 col = mix(hondo, medio, smoothstep(0.0, 0.45, vV));
      col = mix(col, claro, smoothstep(0.35, 0.95, vV) * (0.5 + 0.5 * vCresta));
      float dif = 0.62 + 0.38 * max(dot(N, L), 0.0);
      col *= dif;
      float trans = pow(max(dot(-L, V), 0.0), 3.0) * smoothstep(0.3, 1.0, vV) * 0.35;
      col += vec3(0.4, 1.0, 0.85) * trans;
      float fres = pow(1.0 - abs(dot(N, V)), 3.0);
      col = mix(col, vec3(0.85, 0.97, 0.97), fres * 0.35);
      vec3 H = normalize(L + V);
      col += vec3(1.0) * pow(max(dot(N, H), 0.0), 60.0) * 0.35;
      float n = suave(vec2(vW.x * 5.0 - uT * 0.6, vW.z * 5.0 + uT * 0.3)) * 0.6 + suave(vec2(vW.x * 13.0 + uT, vW.y * 11.0)) * 0.4;
      float espuma = smoothstep(0.78, 0.98, vCresta + n * 0.25) * smoothstep(0.15, 0.4, vV);
      col = mix(col, vec3(0.98, 1.0, 1.0), espuma * 0.9);
      float linea = smoothstep(0.9, 1.0, vCresta) * smoothstep(0.1, 0.3, vV);
      col = mix(col, vCol, linea * 0.55);
      col = mix(vec3(0.72, 0.82, 0.84), col, uAtenuar);
      gl_FragColor = vec4(col, 1.0);
    }`;
  const FRAG_MAR = `
    uniform float uT; varying vec3 vW;
    void main() {
      float d = length(vW.xz * vec2(0.8, 1.0));
      vec3 cerca = vec3(0.06, 0.52, 0.60), lejos = vec3(0.62, 0.86, 0.88);
      vec3 col = mix(cerca, lejos, smoothstep(6.0, 28.0, d));
      float o = sin(vW.x * 1.7 + uT * 1.1 + sin(vW.z * 1.3 + uT * 0.7)) * sin(vW.z * 2.3 - uT * 0.9);
      col += vec3(0.8, 1.0, 1.0) * pow(max(o, 0.0), 8.0) * 0.28 * (1.0 - smoothstep(4.0, 20.0, d));
      float alfa = 1.0 - smoothstep(18.0, 30.0, d);
      gl_FragColor = vec4(col, alfa);
    }`;

  function spline(valores) {
    const n = valores.length;
    return (t) => {
      const i = Math.max(0, Math.min(n - 1.0001, t)), k = Math.floor(i), f = i - k;
      const p0 = valores[Math.max(0, k - 1)], p1 = valores[k], p2 = valores[Math.min(n - 1, k + 1)], p3 = valores[Math.min(n - 1, k + 2)];
      return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
    };
  }
  // perfil transversal de una ola: sube por detrás, cresta y cara empinada al frente
  const PROF = 3.0, CRESTA_U = 0.62;
  function perfil(u) {
    if (u <= CRESTA_U) { const a = u / CRESTA_U; return a * a * (3 - 2 * a); }
    const b = (u - CRESTA_U) / (1 - CRESTA_U);
    return Math.max(0, 1 - Math.pow(b, 0.7));
  }
  function colorNivel(v) {
    const tr = [[45, 0x2bc4b3], [62, 0x1fa4ae], [76, 0xf2a541], [86, 0xe5472d]];
    let c = new THREE.Color(tr[0][1]);
    for (let i = 1; i < tr.length; i++) if (v > tr[i - 1][0]) c = new THREE.Color(tr[i - 1][1]).lerp(new THREE.Color(tr[i][1]), Math.min(1, (v - tr[i - 1][0]) / (tr[i][0] - tr[i - 1][0])));
    return c;
  }

  function surfista() {
    const g = new THREE.Group();
    const tabla = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8), new THREE.MeshStandardMaterial({ color: 0xff7a45, roughness: 0.4 }));
    tabla.scale.set(1, 0.07, 0.24);
    g.add(tabla);
    const franja = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    franja.position.y = 0.035;
    g.add(franja);
    const piel = new THREE.MeshStandardMaterial({ color: 0xc98b5e, roughness: 0.7 });
    const traje = new THREE.MeshStandardMaterial({ color: 0x0b3440, roughness: 0.6 });
    const cuerpo = new THREE.Group();
    cuerpo.position.y = 0.05;
    const piernaA = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 3, 6), traje);
    piernaA.position.set(-0.12, 0.14, 0); piernaA.rotation.z = 0.35;
    const piernaB = piernaA.clone(); piernaB.position.x = 0.12; piernaB.rotation.z = -0.35;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 3, 8), traje);
    torso.position.set(0.02, 0.43, 0); torso.rotation.z = -0.25;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), piel);
    cabeza.position.set(0.1, 0.65, 0);
    const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 6, 0, TAU, 0, 1.4), new THREE.MeshStandardMaterial({ color: 0x3a2412 }));
    pelo.position.copy(cabeza.position);
    const brazoA = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.26, 3, 6), piel);
    brazoA.position.set(-0.2, 0.5, 0); brazoA.rotation.z = 1.25;
    const brazoB = brazoA.clone(); brazoB.position.x = 0.24; brazoB.rotation.z = -1.1;
    cuerpo.add(piernaA, piernaB, torso, cabeza, pelo, brazoA, brazoB);
    g.add(cuerpo);
    g.userData.cuerpo = cuerpo;
    return g;
  }

  function delfin() {
    const g = new THREE.Group();
    const piel = new THREE.MeshStandardMaterial({ color: 0x6f8fa3, roughness: 0.45 });
    const panza = new THREE.MeshStandardMaterial({ color: 0xe6eef0, roughness: 0.5 });
    const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 10), piel);
    cuerpo.scale.set(1.6, 0.42, 0.42);
    const vientre = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8), panza);
    vientre.scale.set(1.4, 0.3, 0.36); vientre.position.y = -0.05;
    const hocico = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 8), piel);
    hocico.rotation.z = -Math.PI / 2; hocico.position.x = 0.64;
    const aleta = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 4), piel);
    aleta.position.set(-0.05, 0.2, 0); aleta.rotation.z = 0.5;
    const cola = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.42), piel);
    cola.position.set(-0.62, 0, 0);
    g.add(cuerpo, vientre, hocico, aleta, cola);
    return g;
  }

  function gaviota() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const ala = (s) => {
      const piv = new THREE.Group();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), mat);
      m.position.x = 0.25 * s;
      piv.add(m);
      piv.rotation.x = -Math.PI / 2;
      g.add(piv);
      return piv;
    };
    g.userData.alas = [ala(1), ala(-1)];
    const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    cuerpo.scale.set(1, 0.8, 2.2);
    g.add(cuerpo);
    return g;
  }

  function ola(host, datos, alElegir, alPasar) {
    const b = base(host, { fov: 30, pixelRatio: 1.5 });
    const { escena, camara } = b;
    const { series, periodos } = datos;
    const N = periodos.length, S = series.length;
    const ANCHO = 17, dx = ANCHO / (N - 1), x0 = -ANCHO / 2, SEP = 3.3, ALTO = 3.8;
    const altura = (v) => 0.25 + Math.max(0, v - 30) / 55 * (ALTO - 0.25);
    const uT = { value: 0 }, uCam = { value: new THREE.Vector3() };

    escena.add(new THREE.HemisphereLight(0xffffff, 0x2a8a90, 0.9));
    const sol = new THREE.DirectionalLight(0xfff1dc, 0.9);
    sol.position.set(-4, 10, 8);
    escena.add(sol);

    const gMar = new THREE.PlaneGeometry(80, 60, 1, 1);
    gMar.rotateX(-Math.PI / 2);
    const mar = new THREE.Mesh(gMar, new THREE.ShaderMaterial({
      uniforms: { uT }, transparent: true, depthWrite: false,
      vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }",
      fragmentShader: FRAG_MAR,
    }));
    mar.position.y = 0.01;
    mar.renderOrder = -1;
    escena.add(mar);

    const SEGX = N * 10, SEGZ = 28;
    const olas = series.map((serie, j) => {
      const zc = (j - (S - 1) / 2) * -SEP;
      const h = spline(serie.valores.map(altura));
      const cv = spline(serie.valores);
      const pos = [], cresta = [], color = [], idx = [];
      for (let iz = 0; iz <= SEGZ; iz++) {
        const u = iz / SEGZ;
        for (let ix = 0; ix <= SEGX; ix++) {
          const t = (ix / SEGX) * (N - 1);
          const x = x0 - 0.8 + (ix / SEGX) * (ANCHO + 1.6);
          const tt = ((x - x0) / dx);
          const borde = Math.min(1, Math.max(0, Math.min(tt + 0.8, N - 1 + 0.8 - tt) / 0.8));
          const alto = h(Math.max(0, Math.min(N - 1, tt))) * (0.2 + 0.8 * borde);
          const pr = perfil(u);
          const lip = u > CRESTA_U ? Math.sin((u - CRESTA_U) / (1 - CRESTA_U) * Math.PI) * 0.22 * (alto / ALTO) : 0;
          pos.push(x, alto * pr, zc - PROF / 2 + u * PROF + lip);
          cresta.push(pr);
          const c = colorNivel(cv(Math.max(0, Math.min(N - 1, tt))));
          color.push(c.r, c.g, c.b);
        }
      }
      const fila = SEGX + 1;
      for (let iz = 0; iz < SEGZ; iz++) for (let ix = 0; ix < SEGX; ix++) {
        const a = iz * fila + ix, b2 = a + 1, c = a + fila, d = c + 1;
        idx.push(a, c, b2, b2, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("aCresta", new THREE.Float32BufferAttribute(cresta, 1));
      g.setAttribute("aColor", new THREE.Float32BufferAttribute(color, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const u = { uT, uCam, uAlto: { value: ALTO }, uAtenuar: { value: 1 } };
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_OLA, fragmentShader: FRAG_OLA, side: THREE.DoubleSide }));
      m.scale.y = 0.001;
      escena.add(m);
      const yEn = (x, uu) => h(Math.max(0, Math.min(N - 1, (x - x0) / dx))) * perfil(uu);
      return { m, u, id: serie.id, zc, yEn, cv, altoFin: h(N - 1) };
    });

    // boyas por mes
    const gBoya = new THREE.SphereGeometry(0.11, 12, 10);
    const boyas = new THREE.InstancedMesh(gBoya, new THREE.MeshStandardMaterial({ roughness: 0.35 }), N * S);
    const infoBoya = [];
    olas.forEach((o, j) => {
      for (let i = 0; i < N; i++) {
        infoBoya.push({ j, i, x: x0 + i * dx });
        boyas.setColorAt(j * N + i, colorNivel(series[j].valores[i]));
      }
    });
    escena.add(boyas);

    // bandera del mes elegido
    const bandera = new THREE.Group();
    const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0xf3eee3 }));
    asta.position.y = 0.55;
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32, 8, 1), new THREE.MeshStandardMaterial({ color: 0xe5472d, side: THREE.DoubleSide }));
    tela.position.set(0.28, 0.92, 0);
    bandera.add(asta, tela);
    bandera.visible = false;
    escena.add(bandera);
    const telaBase = tela.geometry.attributes.position.array.slice();
    let iElegido = -1, iHover = -1, destacado = null;

    const tabla = surfista();
    tabla.scale.setScalar(0.9);
    escena.add(tabla);
    const delfines = [0, 1, 2].map((k) => ({ g: delfin(), x0: -6 + k * 5.5, fase: k * 1.7, z: (S - 1) / 2 * SEP + 2.2 + k * 0.5 }));
    delfines.forEach((d) => escena.add(d.g));
    const aros = delfines.map(() => {
      const a = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      a.rotation.x = -Math.PI / 2;
      a.position.y = 0.03;
      escena.add(a);
      return a;
    });
    const gaviotas = [0, 1, 2, 3].map((k) => ({ g: gaviota(), f: k * 1.9, r: 5 + k * 1.3, y: 5.2 + k * 0.35 }));
    gaviotas.forEach((q) => escena.add(q.g));

    // etiquetas HTML
    const capa = document.createElement("div");
    capa.className = "ola-capa";
    host.appendChild(capa);
    const etMeses = periodos.map((p) => {
      const e = document.createElement("span");
      e.className = "ola-mes" + (+p.slice(5) === 1 ? " anio" : "");
      e.dataset.periodo = p;
      capa.appendChild(e);
      return e;
    });
    const etDest = series.map((s) => {
      const e = document.createElement("span");
      e.className = "ola-destino";
      e.textContent = s.nombre;
      capa.appendChild(e);
      return e;
    });

    let inicio = null;
    const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), punto = new THREE.Vector3();
    const tmp = new THREE.Vector3(), raton = { x: 0, y: 0 }, d3 = new THREE.Object3D();
    function indice(e) {
      const r = host.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raton.x = ndc.x; raton.y = ndc.y;
      ray.setFromCamera(ndc, camara);
      if (!ray.ray.intersectPlane(plano, punto)) return -1;
      const i = Math.round((punto.x - x0) / dx);
      return i >= 0 && i < N && punto.y > -2 && punto.y < 7 ? i : -1;
    }
    host.addEventListener("pointermove", (e) => {
      iHover = indice(e);
      host.style.cursor = iHover >= 0 ? "pointer" : "default";
      const r = host.getBoundingClientRect();
      alPasar && alPasar(iHover >= 0 ? periodos[iHover] : null, e.clientX - r.left, e.clientY - r.top);
      b.pedir();
    });
    host.addEventListener("pointerleave", () => { iHover = -1; alPasar && alPasar(null); });
    host.addEventListener("click", (e) => { const i = indice(e); if (i >= 0) alElegir(periodos[i]); });

    const lane = () => olas.find((o) => o.id === destacado) || olas[0];

    b.cadaCuadro((s) => {
      uT.value = s;
      if (inicio === null) inicio = s;
      const crece = (j) => (REDUCIDO ? 1 : Math.min(1, Math.max(0, (s - inicio - j * 0.25) / 1.6)));
      olas.forEach((o, j) => {
        const k = crece(j);
        o.m.scale.y = Math.max(0.001, 1 - Math.pow(1 - k, 3)) * (1 + Math.sin(s * 0.9 + j) * 0.02);
        const meta = destacado === null || destacado === o.id ? 1 : 0.55;
        o.u.uAtenuar.value += (meta - o.u.uAtenuar.value) * 0.08;
      });

      infoBoya.forEach((q, n) => {
        const o = olas[q.j], esc = o.m.scale.y;
        const grande = q.i === iHover ? 1.9 : q.i === iElegido && o === lane() ? 1.5 : 1;
        d3.position.set(q.x, o.yEn(q.x, CRESTA_U) * esc + 0.1 + Math.sin(s * 2 + q.i) * 0.03, o.zc - PROF / 2 + CRESTA_U * PROF);
        d3.rotation.set(0, 0, 0);
        d3.scale.setScalar(grande * Math.min(1, esc * 1.4));
        d3.updateMatrix();
        boyas.setMatrixAt(n, d3.matrix);
      });
      boyas.instanceMatrix.needsUpdate = true;

      const L = lane();
      if (iElegido >= 0) {
        const x = x0 + iElegido * dx;
        bandera.visible = true;
        bandera.position.set(x, L.yEn(x, CRESTA_U) * L.m.scale.y + 0.08, L.zc - PROF / 2 + CRESTA_U * PROF);
        const pa = tela.geometry.attributes.position;
        for (let v = 0; v < pa.count; v++) {
          const bx = telaBase[v * 3];
          pa.setZ(v, Math.sin(bx * 9 - s * 6) * 0.05 * (bx + 0.28));
        }
        pa.needsUpdate = true;
      }

      // surfista sobre la cara de la ola elegida
      const vuelta = REDUCIDO ? 0.3 : ((s * 0.035) % 1);
      const xs = x0 + 0.3 + vuelta * (ANCHO - 0.6);
      const us = 0.74;
      const ys = L.yEn(xs, us) * L.m.scale.y;
      const pend = (L.yEn(xs + 0.1, us) - L.yEn(xs - 0.1, us)) * L.m.scale.y / 0.2;
      tabla.position.set(xs, ys + 0.05, L.zc - PROF / 2 + us * PROF + 0.05);
      tabla.rotation.set(-0.55 + Math.sin(s * 2.2) * 0.05, Math.sin(s * 0.9) * 0.25, Math.atan(pend) * 0.8, "YXZ");
      tabla.userData.cuerpo.rotation.z = Math.sin(s * 1.7) * 0.12;
      tabla.visible = L.m.scale.y > 0.5;

      delfines.forEach((d, k) => {
        const T = 5.5, c = ((s + d.fase * 2) % T) / T;
        const salto = Math.max(0, Math.min(1, (c - 0.1) / 0.35));
        const x = x0 + ((d.x0 + 9 + s * 0.4 + k * 3) % (ANCHO + 2)) - 1;
        const y = Math.sin(salto * Math.PI) * 1.3 - 0.3;
        d.g.visible = salto > 0 && salto < 1;
        d.g.position.set(x + salto * 1.8, y, d.z);
        d.g.rotation.set(0, 0, Math.cos(salto * Math.PI) * 0.9);
        const a = aros[k], fin = Math.max(0, Math.min(1, (c - 0.45) / 0.35));
        a.visible = fin > 0 && fin < 1;
        a.position.x = x + 1.8;
        a.position.z = d.z;
        a.scale.setScalar(1 + fin * 3);
        a.material.opacity = 0.8 * (1 - fin);
      });

      gaviotas.forEach((q) => {
        const a = s * 0.12 + q.f;
        q.g.position.set(Math.cos(a) * q.r, q.y + Math.sin(s * 0.7 + q.f) * 0.2, Math.sin(a) * q.r * 0.4 - 2);
        q.g.rotation.y = -a;
        const bat = Math.sin(s * 7 + q.f) * 0.5;
        q.g.userData.alas[0].rotation.z = bat;
        q.g.userData.alas[1].rotation.z = -bat;
      });

      const lejos = Math.max(1, 1.3 / camara.aspect);
      camara.position.x += ((raton.x * 1.4 + Math.sin(s * 0.12) * 0.6) - camara.position.x) * 0.04;
      camara.position.y += ((6.6 * lejos + raton.y * 0.7) - camara.position.y) * 0.04;
      camara.position.z = 18 * lejos;
      camara.lookAt(0, 1.2, 0);
      uCam.value.copy(camara.position);

      const w = host.clientWidth, hh = host.clientHeight;
      etMeses.forEach((e, i) => {
        tmp.set(x0 + i * dx, 0, (S - 1) / 2 * SEP + PROF / 2 + 0.5).project(camara);
        e.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * hh}px) translate(-50%, 0)`;
        e.classList.toggle("hover", i === iHover);
      });
      olas.forEach((o, j) => {
        tmp.set(x0 + 0.4, o.yEn(x0 + 0.4, CRESTA_U) * o.m.scale.y + 0.45, o.zc - PROF / 2 + CRESTA_U * PROF).project(camara);
        etDest[j].style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * hh}px) translate(0, -100%)`;
        etDest[j].classList.toggle("atenuado", destacado !== null && destacado !== o.id);
      });
    });
    b.pedir();

    return {
      setEtiquetasMes(f) { etMeses.forEach((e) => { e.innerHTML = f(e.dataset.periodo); }); },
      setElegido(periodo) {
        iElegido = periodos.indexOf(periodo);
        bandera.visible = iElegido >= 0;
        etMeses.forEach((e, k) => e.classList.toggle("elegido", k === iElegido));
        b.pedir();
      },
      setDestacado(id) { destacado = id; b.pedir(); },
      destruir() { capa.remove(); b.destruir(); },
    };
  }

  window.Escenas = { agua, playa, ola };
})();
