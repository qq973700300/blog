/* 开机屏背景：Neon Tunnel（three.js shader 隧道）
   来源：followtheway/tunnel-demo.html，适配为博客开机背景：
   - 不注册键盘/鼠标交互（避免与开机彩蛋冲突）
   - 监听 blog:ready（boot.js 进站事件）→ 淡出并销毁 WebGL 资源
   - 开机动画被跳过时完全不渲染 */
import * as THREE from '/js/vendor/three.module.js';

(function initTunnelBg() {
  'use strict';

  const holder = document.getElementById('tunnel-bg');
  if (!holder) return;
  if (document.body.classList.contains('boot-done')) return;

  /* ---------- 基础 ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  } catch (err) {
    return; // WebGL 不可用：开机屏保持原样
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

  /* ---------- 隧道参数（与原版一致） ---------- */
  const TUNNEL_LEN = 800;
  const TUNNEL_R = 22;
  const PERIOD = 40;
  const LOOP = 160;
  const WAVE_F1 = Math.PI * 2 / PERIOD;
  const CHUE = Math.PI * 2 / LOOP;
  const SPEED = 34;

  const CURVE = { kx: 0.0, ky: 0.00085 };
  function curveY(d) { return CURVE.ky * d * d; }

  const MODE = 4; // 极光波纹（固定，不响应键盘）

  const mobile = window.innerWidth < 700;
  const tunnelGeo = new THREE.CylinderGeometry(TUNNEL_R, TUNNEL_R, TUNNEL_LEN, mobile ? 64 : 96, mobile ? 160 : 320, true);
  tunnelGeo.rotateX(-Math.PI / 2);
  tunnelGeo.translate(0, 0, -TUNNEL_LEN / 2);

  const tunnelUniforms = { uTravel: { value: 0 }, uMode: { value: MODE } };

  const tunnelMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: tunnelUniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying float vDist;

      const float KX = ${CURVE.kx.toFixed(6)};
      const float KY = ${CURVE.ky.toFixed(6)};

      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float d = -wp.z;
        vDist = d;
        wp.x += KX * d * d;
        wp.y += KY * d * d;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTravel;
      uniform float uMode;
      varying vec2 vUv;
      varying float vDist;

      const float TAU = 6.28318530718;
      const float PI  = 3.14159265359;
      const float R    = ${TUNNEL_R.toFixed(1)};
      const float WAVE1  = ${WAVE_F1.toFixed(8)};
      const float CHUEF  = ${CHUE.toFixed(8)};
      const float FW5    = ${(Math.PI * 2 * 5 / LOOP).toFixed(8)};

      vec3 pal(float t) {
        vec3 c0 = vec3(1.00, 0.88, 0.10);
        vec3 c1 = vec3(1.00, 0.45, 0.02);
        vec3 c2 = vec3(0.96, 0.05, 0.50);
        vec3 c3 = vec3(0.60, 0.05, 0.90);
        float x = fract(t) * 4.0;
        vec3 col = mix(c0, c1, smoothstep(0.0, 1.0, x));
        col = mix(col, c2, smoothstep(1.0, 2.0, x));
        col = mix(col, c3, smoothstep(2.0, 3.0, x));
        col = mix(col, c0, smoothstep(3.0, 4.0, x));
        return col;
      }

      void main() {
        float theta = vUv.x * TAU;
        float z     = vUv.y * ${TUNNEL_LEN.toFixed(1)} + uTravel;
        float mask  = 0.0;
        vec3  col   = vec3(0.0);

        /* 极光波纹 */
        float m = 0.5 + 0.5 * sin(z * FW5 + sin(theta * 3.0 + z * WAVE1 * 0.25) * 1.5);
        mask = smoothstep(0.30, 0.70, m);
        col = pal(0.5 + 0.5 * sin(z * CHUEF * 2.0 + theta));

        float fade = 1.0 - smoothstep(320.0, 520.0, vDist);
        gl_FragColor = vec4(col * mask * fade, 1.0);
      }
    `
  });

  const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
  scene.add(tunnel);

  /* ---------- 主循环 ---------- */
  const clock = new THREE.Clock();
  let travel = 0;
  let disposed = false;

  function tearDown() {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    tunnelGeo.dispose();
    tunnelMat.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    holder.classList.add('hide');
  }

  document.addEventListener('blog:ready', tearDown, { once: true });
  window.addEventListener('resize', () => {
    if (disposed) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    // 兜底：boot.js 因 sessionStorage 直接跳过开机时也会给 body 加 boot-done
    if (document.body.classList.contains('boot-done')) { tearDown(); return; }

    if (!holder.classList.contains('on')) holder.classList.add('on'); // 首帧后淡入

    const dt = Math.min(clock.getDelta(), 0.05);
    travel = (travel + SPEED * dt) % LOOP;
    tunnelUniforms.uTravel.value = travel;

    const lookD = 60;
    camera.position.set(0, 0, 0);
    camera.lookAt(0, curveY(lookD) * 0.6 - 1, -lookD);
    camera.rotateX(0.08);

    renderer.render(scene, camera);
  });
})();
