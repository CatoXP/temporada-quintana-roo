/* Escenas 3D de Temporada (three.js r147, global THREE, sin red).
 *
 *   Escenas.agua(host)                 laguna animada de la portada; reacciona al ratón
 *   Escenas.playa(host)                maqueta de playa; .setGente(0..1) .setSargazo(nivel)
 *   Escenas.ola(host, datos, alElegir, alPasar)  cordillera del año; .setElegido(periodo) .setDestacado(id)
 *
 * Cada escena se pausa fuera de pantalla y respeta prefers-reduced-motion.
 */
(function () {
  "use strict";
  const REDUCIDO = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function base(host, op = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, op.pixelRatio || 2));
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    renderer.setClearColor(0x000000, 0);
    if (op.srgb) renderer.outputEncoding = THREE.sRGBEncoding;
    host.appendChild(renderer.domElement);
    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(op.fov || 40, (host.clientWidth || 1) / (host.clientHeight || 1), 0.1, 500);
    const cuadros = [];
    let visible = false, raf = 0, vivo = true;
    const t0 = performance.now();
    function cuadro(t) {
      raf = 0;
      if (!vivo || !visible) return;
      const s = (t - t0) / 1000;
      for (const f of cuadros) f(s);
      renderer.render(escena, camara);
      if (!REDUCIDO) raf = requestAnimationFrame(cuadro);
    }
    const pedir = () => { if (!raf && vivo) raf = requestAnimationFrame(cuadro); };
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) pedir(); }, { rootMargin: "150px" });
    io.observe(host);
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
      pedir();
    });
    ro.observe(host);
    return {
      renderer, escena, camara, pedir,
      cadaCuadro: (f) => cuadros.push(f),
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
      vec3 col = mix(vec3(0.80, 0.97, 0.92), vec3(0.45, 0.88, 0.84), smoothstep(0.0, 0.12, b));
      col = mix(col, vec3(0.18, 0.72, 0.74), smoothstep(0.10, 0.30, b));
      col = mix(col, vec3(0.08, 0.50, 0.60), smoothstep(0.28, 0.52, b));
      col = mix(col, vec3(0.04, 0.30, 0.42), smoothstep(0.50, 0.85, b));
      vec2 q = vP.xz * 1.5;
      float ca = sin(q.x + uT * 0.8 + sin(q.y * 1.3 + uT)) * sin(q.y * 1.1 - uT * 0.6 + sin(q.x * 0.9));
      col += vec3(0.95, 1.0, 0.95) * pow(max(ca, 0.0), 5.0) * 0.30 * (1.0 - smoothstep(0.0, 0.32, b));
      vec3 V = normalize(uCam - vP);
      vec3 N = normalize(vN);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      col = mix(col, vec3(0.90, 0.96, 0.96), fres * 0.5);
      vec3 H = normalize(normalize(uSol) + V);
      col += vec3(1.0, 0.95, 0.82) * pow(max(dot(N, H), 0.0), 220.0) * 1.8;
      col = mix(col, vec3(0.953, 0.933, 0.890), smoothstep(-20.0, -52.0, vP.z));
      gl_FragColor = vec4(col, 1.0);
    }`;

  function agua(host) {
    const b = base(host, { fov: 42, pixelRatio: 1.5 });
    const { escena, camara } = b;
    const geo = new THREE.PlaneGeometry(110, 70, 280, 190);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -26);
    const u = {
      uT: { value: 0 }, uRaton: { value: new THREE.Vector2(0, -5) }, uFuerza: { value: 0 },
      uCam: { value: new THREE.Vector3() }, uSol: { value: new THREE.Vector3(0.45, 0.35, -1) },
    };
    const malla = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_AGUA, fragmentShader: FRAG_AGUA }));
    escena.add(malla);

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
    b.cadaCuadro((s) => {
      u.uT.value = s;
      u.uRaton.value.lerp(raton, 0.07);
      fuerza *= 0.99;
      u.uFuerza.value += (fuerza - u.uFuerza.value) * 0.04;
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

  function playa(host) {
    const b = base(host, { fov: 30, srgb: true });
    const { escena, camara, renderer } = b;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const rnd = azar(7);

    escena.add(new THREE.HemisphereLight(0xffffff, 0xd8c3a0, 0.9));
    const sol = new THREE.DirectionalLight(0xfff1dc, 1.3);
    sol.position.set(-8, 16, 5);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
    sol.shadow.bias = -0.0006;
    escena.add(sol);

    // arena con dunas suaves que se hunde bajo el agua
    const gArena = planoCircular(110);
    const pa = gArena.attributes.position, colores = [];
    const seca = new THREE.Color(0xf3e6c8), mojada = new THREE.Color(0xcfb68a);
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i), o = orilla(x);
      const y = 0.09 * Math.sin(x * 0.8) * Math.cos(z * 0.6) - 0.5 * THREE.MathUtils.smoothstep(z, o - 0.2, o + 2.5);
      pa.setY(i, y);
      const c = seca.clone().lerp(mojada, THREE.MathUtils.smoothstep(z, o - 1.4, o));
      colores.push(c.r, c.g, c.b);
    }
    gArena.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
    gArena.computeVertexNormals();
    const arena = new THREE.Mesh(gArena, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    arena.receiveShadow = true;
    escena.add(arena);

    // agua con espuma en la orilla
    const uAgua = { uT: { value: 0 } };
    const gAgua = planoCircular(90);
    const agua = new THREE.Mesh(gAgua, new THREE.ShaderMaterial({
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
          float brillo = pow(max(sin(vP.x*3.1+uT*2.0)*sin(vP.z*2.7-uT*1.3), 0.0), 12.0);
          c += brillo * 0.25;
          gl_FragColor = vec4(c, 0.94);
        }`,
    }));
    escena.add(agua);

    // costado de la maqueta: estratos de arena y agua
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

    // palmeras
    const matTronco = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 });
    const matHoja = new THREE.MeshStandardMaterial({ color: 0x2f7a4f, roughness: 0.7, side: THREE.DoubleSide });
    for (const [x, z, alto, giro] of [[-6.2, -5.4, 3.4, 0.3], [-4.6, -6.8, 2.8, -0.2], [5.4, -6.2, 3.1, 0.15]]) {
      const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + giro * 2, alto * 0.6, z), new THREE.Vector3(x + giro * 3, alto, z + 0.2));
      const tronco = new THREE.Mesh(new THREE.TubeGeometry(curva, 16, 0.09, 8), matTronco);
      tronco.castShadow = true;
      escena.add(tronco);
      const copa = curva.getPoint(1);
      for (let k = 0; k < 7; k++) {
        const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.9, 4, 1, true), matHoja);
        hoja.geometry.translate(0, 0.95, 0);
        hoja.position.copy(copa);
        hoja.rotation.set(1.9, (k / 7) * Math.PI * 2, 0, "YXZ");
        hoja.scale.set(1, 1, 0.25);
        hoja.castShadow = true;
        escena.add(hoja);
      }
    }

    // gente, sombrillas, toallas y sargazo (instanciados)
    const PALETA = [0xe5472d, 0xf2a541, 0x1fa4ae, 0x0c5a68, 0xffffff, 0x8be3d8, 0xd9674e, 0x2f4858, 0xf6d8b0];
    const MAX = 460, MAXU = 64, MAXS = 130;
    const gGente = new THREE.CapsuleGeometry(0.1, 0.24, 3, 8); gGente.translate(0, 0.22, 0);
    const gente = new THREE.InstancedMesh(gGente, new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAX);
    const gSomb = new THREE.ConeGeometry(0.62, 0.3, 14); gSomb.translate(0, 1.08, 0);
    const gPalo = new THREE.CylinderGeometry(0.02, 0.02, 1.05, 6); gPalo.translate(0, 0.52, 0);
    const gToalla = new THREE.BoxGeometry(0.34, 0.02, 0.66); gToalla.translate(0.45, 0.02, 0.25);
    const sombrillas = new THREE.InstancedMesh(gSomb, new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAXU);
    const palos = new THREE.InstancedMesh(gPalo, new THREE.MeshStandardMaterial({ color: 0xf1f3ef }), MAXU);
    const toallas = new THREE.InstancedMesh(gToalla, new THREE.MeshStandardMaterial({ roughness: 1 }), MAXU);
    const gAlga = new THREE.SphereGeometry(0.16, 7, 5); gAlga.scale(1.6, 0.25, 0.8);
    const algas = new THREE.InstancedMesh(gAlga, new THREE.MeshStandardMaterial({ color: 0x6b4d22, roughness: 1 }), MAXS);
    for (const m of [gente, sombrillas, palos, toallas]) { m.castShadow = true; m.receiveShadow = true; escena.add(m); }
    escena.add(algas);

    const personas = [];
    while (personas.length < MAX) {
      const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R, o = orilla(x);
      if (Math.hypot(x, z) > R - 0.5 || z > o + 1.8) continue;
      if (rnd() > Math.exp(-(o - z) / 5)) continue;
      personas.push({ x, z, agua: z > o + 0.1, rot: rnd() * 6.28, fase: rnd() * 6.28, vel: 0.05 + rnd() * 0.08, e: 0 });
    }
    personas.forEach((p, i) => gente.setColorAt(i, new THREE.Color(PALETA[i % PALETA.length])));
    const somb = [];
    while (somb.length < MAXU) {
      const x = (rnd() * 2 - 1) * (R - 1.5), o = orilla(x), z = o - 1 - rnd() * 5;
      if (Math.hypot(x, z) > R - 1) continue;
      somb.push({ x, z, rot: rnd() * 6.28, vel: 0.04 + rnd() * 0.06, e: 0 });
    }
    somb.forEach((s, i) => {
      sombrillas.setColorAt(i, new THREE.Color(PALETA[(i * 3) % PALETA.length]));
      toallas.setColorAt(i, new THREE.Color(PALETA[(i * 5 + 2) % PALETA.length]));
    });
    const alga = [];
    while (alga.length < MAXS) {
      const x = (rnd() * 2 - 1) * (R - 0.8), z = orilla(x) - 0.1 + (rnd() - 0.5) * 0.5;
      if (Math.hypot(x, z) > R - 0.6) continue;
      alga.push({ x, z, rot: rnd() * 6.28, e: 0 });
    }

    let objetivo = 0, objetivoS = 0;
    const d = new THREE.Object3D();
    function actualizar(s, instantaneo) {
      const nu = Math.round((objetivo / MAX) * MAXU);
      personas.forEach((p, i) => {
        const meta = i < objetivo ? 1 : 0;
        p.e = instantaneo ? meta : p.e + (meta - p.e) * p.vel;
        const salto = Math.max(0, Math.sin(p.e * Math.PI)) * 0.5 * (1 - p.e);
        d.position.set(p.x, (p.agua ? -0.16 + Math.sin(s * 1.6 + p.fase) * 0.04 : 0) + salto, p.z);
        d.rotation.set(0, p.rot, 0);
        d.scale.setScalar(Math.max(p.e, 0.0001));
        d.updateMatrix();
        gente.setMatrixAt(i, d.matrix);
      });
      somb.forEach((u, i) => {
        const meta = i < nu ? 1 : 0;
        u.e = instantaneo ? meta : u.e + (meta - u.e) * u.vel;
        d.position.set(u.x, 0, u.z);
        d.rotation.set(0, u.rot, 0.05);
        d.scale.set(Math.max(u.e, 0.0001), Math.max(u.e, 0.0001), Math.max(u.e, 0.0001));
        d.updateMatrix();
        sombrillas.setMatrixAt(i, d.matrix);
        palos.setMatrixAt(i, d.matrix);
        toallas.setMatrixAt(i, d.matrix);
      });
      alga.forEach((a, i) => {
        const meta = i < objetivoS ? 1 : 0;
        a.e = instantaneo ? meta : a.e + (meta - a.e) * 0.06;
        d.position.set(a.x, 0.02, a.z);
        d.rotation.set(0, a.rot, 0);
        d.scale.setScalar(Math.max(a.e, 0.0001));
        d.updateMatrix();
        algas.setMatrixAt(i, d.matrix);
      });
      for (const m of [gente, sombrillas, palos, toallas, algas]) m.instanceMatrix.needsUpdate = true;
    }

    b.cadaCuadro((s) => {
      uAgua.uT.value = s;
      const a = 0.55 + Math.sin(s * 0.09) * 0.28;
      camara.position.set(Math.sin(a) * 23, 15.5, Math.cos(a) * 23);
      camara.lookAt(0, -0.6, 0.6);
      actualizar(s, REDUCIDO);
    });
    actualizar(0, true);
    return {
      setGente(k) { objetivo = Math.round(Math.max(0, Math.min(1, k)) * MAX); b.pedir(); },
      setSargazo(nivel) { objetivoS = nivel === "alto" ? MAXS : nivel === "medio" ? 45 : 0; b.pedir(); },
      destruir: b.destruir,
    };
  }

  // ==================================================================== ola
  const TRAMOS = [[40, 0x8be3d8], [60, 0x2bb3bd], [76, 0xf2a541], [88, 0xe5472d]];
  function colorOcupacion(v) {
    if (v <= TRAMOS[0][0]) return new THREE.Color(TRAMOS[0][1]);
    for (let i = 1; i < TRAMOS.length; i++) {
      if (v <= TRAMOS[i][0]) {
        const k = (v - TRAMOS[i - 1][0]) / (TRAMOS[i][0] - TRAMOS[i - 1][0]);
        return new THREE.Color(TRAMOS[i - 1][1]).lerp(new THREE.Color(TRAMOS[i][1]), k);
      }
    }
    return new THREE.Color(TRAMOS[TRAMOS.length - 1][1]);
  }

  function ola(host, datos, alElegir, alPasar) {
    const b = base(host, { fov: 30, srgb: true });
    const { escena, camara } = b;
    const { series, periodos } = datos;
    const N = periodos.length, S = series.length;
    const ANCHO = 17, dx = ANCHO / (N - 1), x0 = -ANCHO / 2, SEP = 3.1;
    const altura = (v) => 0.2 + Math.max(0, v - 30) / 55 * 4.4;
    const ocup = (y) => 30 + (y - 0.2) / 4.4 * 55;

    escena.add(new THREE.HemisphereLight(0xffffff, 0x0b3440, 0.75));
    const luz = new THREE.DirectionalLight(0xffffff, 0.8);
    luz.position.set(-6, 10, 12);
    escena.add(luz);

    const crestas = [];
    series.forEach((serie, j) => {
      const z = (j - (S - 1) / 2) * -SEP;
      const pts = serie.valores.map((v, i) => new THREE.Vector2(x0 + i * dx, altura(v)));
      const curva = new THREE.SplineCurve(pts);
      const forma = new THREE.Shape();
      forma.moveTo(x0, 0);
      curva.getPoints(N * 12).forEach((p) => forma.lineTo(p.x, p.y));
      forma.lineTo(x0 + ANCHO, 0);
      forma.lineTo(x0, 0);
      const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 });
      geo.translate(0, 0, -0.275);
      const p = geo.attributes.position, col = [];
      for (let i = 0; i < p.count; i++) {
        const c = colorOcupacion(ocup(p.getY(i))).convertSRGBToLinear();
        col.push(c.r, c.g, c.b);
      }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.0 });
      const m = new THREE.Mesh(geo, mat);
      m.position.z = z;
      m.scale.y = 0.001;
      escena.add(m);
      crestas.push({ m, mat, z, id: serie.id, alto0: altura(serie.valores[0]) });
    });

    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO + 4, SEP * S + 3), new THREE.MeshBasicMaterial({ color: 0x0a3039 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = -0.02;
    escena.add(suelo);

    const cajaGeo = new THREE.BoxGeometry(dx * 0.9, 5, SEP * S + 0.8);
    cajaGeo.translate(0, 2.5, 0);
    const hover = new THREE.Mesh(cajaGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false }));
    const hoverBorde = new THREE.LineSegments(new THREE.EdgesGeometry(cajaGeo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    hover.add(hoverBorde);
    hover.visible = false;
    escena.add(hover);
    const elegido = new THREE.LineSegments(new THREE.EdgesGeometry(cajaGeo), new THREE.LineBasicMaterial({ color: 0xff7a5c }));
    elegido.visible = false;
    escena.add(elegido);

    // etiquetas HTML
    const capa = document.createElement("div");
    capa.className = "ola-capa";
    host.appendChild(capa);
    const MES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const etMeses = periodos.map((p) => {
      const e = document.createElement("span");
      const m = +p.slice(5);
      e.className = "ola-mes" + (m === 1 ? " anio" : "");
      e.innerHTML = m === 1 ? `ene<br><b>${p.slice(0, 4)}</b>` : MES_C[m - 1];
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

    let inicio = null, iHover = -1, destacado = null;
    const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), punto = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const raton = { x: 0, y: 0 };
    function indice(e) {
      const r = host.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raton.x = ndc.x; raton.y = ndc.y;
      ray.setFromCamera(ndc, camara);
      if (!ray.ray.intersectPlane(plano, punto)) return -1;
      const i = Math.round((punto.x - x0) / dx);
      return i >= 0 && i < N && punto.y > -1 && punto.y < 6 ? i : -1;
    }
    host.addEventListener("pointermove", (e) => {
      const i = indice(e);
      if (i !== iHover) { iHover = i; hover.visible = i >= 0; if (i >= 0) hover.position.x = x0 + i * dx; }
      host.style.cursor = i >= 0 ? "pointer" : "default";
      alPasar && alPasar(i >= 0 ? periodos[i] : null, e.clientX - host.getBoundingClientRect().left, e.clientY - host.getBoundingClientRect().top);
      b.pedir();
    });
    host.addEventListener("pointerleave", () => { iHover = -1; hover.visible = false; alPasar && alPasar(null); b.pedir(); });
    host.addEventListener("click", (e) => { const i = indice(e); if (i >= 0) alElegir(periodos[i]); });

    b.cadaCuadro((s) => {
      if (inicio === null) inicio = s;
      crestas.forEach((c, j) => {
        const k = REDUCIDO ? 1 : Math.min(1, Math.max(0, (s - inicio - j * 0.2) / 1.6));
        c.m.scale.y = Math.max(0.001, 1 - Math.pow(1 - k, 3));
        const meta = destacado === null || destacado === c.id ? 1 : 0.38;
        c.mat.color.r += (meta - c.mat.color.r) * 0.1;
        c.mat.color.g = c.mat.color.b = c.mat.color.r;
      });
      const cx = raton.x * 1.2, cy = raton.y * 0.6;
      camara.position.x += ((cx + Math.sin(s * 0.15) * 0.5) - camara.position.x) * 0.05;
      const lejos = Math.max(1, 1.3 / camara.aspect);
      camara.position.y += ((10.5 * lejos + cy) - camara.position.y) * 0.05;
      camara.position.z = 19.5 * lejos;
      camara.lookAt(0, 0.9, 0);
      const w = host.clientWidth, h = host.clientHeight;
      etMeses.forEach((e, i) => {
        tmp.set(x0 + i * dx, 0, (S - 1) / 2 * SEP + 1.1).project(camara);
        e.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, 0)`;
      });
      crestas.forEach((c, j) => {
        tmp.set(x0 - 0.35, c.alto0 * c.m.scale.y + 0.15, c.z).project(camara);
        etDest[j].style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-100%, -50%)`;
        etDest[j].classList.toggle("atenuado", destacado !== null && destacado !== c.id);
      });
    });
    b.pedir();

    return {
      setElegido(periodo) {
        const i = periodos.indexOf(periodo);
        elegido.visible = i >= 0;
        if (i >= 0) elegido.position.x = x0 + i * dx;
        etMeses.forEach((e, k) => e.classList.toggle("elegido", k === i));
        b.pedir();
      },
      setDestacado(id) { destacado = id; b.pedir(); },
      destruir() { capa.remove(); b.destruir(); },
    };
  }

  window.Escenas = { agua, playa, ola };
})();
