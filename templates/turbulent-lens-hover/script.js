import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { vertexShader, fragmentShader } from "./shaders.js";

const config = {
  maskRadius: 0.15,
  maskSpeed: 0.75,
  lerpFactor: 0.05,
  radiusLerpSpeed: 0.1,
  turbulenceIntensity: 0.075,
};

document.querySelectorAll(".inversion-lens").forEach((container) => {
  initHoverEffect(container);
});

function initHoverEffect(container) {
  let scene, camera, renderer, uniforms;

  const targetMouse = new THREE.Vector2(0.5, 0.5);
  const lerpedMouse = new THREE.Vector2(0.5, 0.5);
  let targetRadius = 0.0;

  let isInView = false;
  let isMouseInsideContainer = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  const img = container.querySelector("img");
  const loader = new THREE.TextureLoader();

  loader.load(img.src, (texture) => {
    setupScene(texture);
    setupDebugger();
    setupEventListeners();
    animate();
  });

  const setupScene = (texture) => {
    const imageAspect = texture.image.width / texture.image.height;

    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 16;

    scene = new THREE.Scene();
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    uniforms = {
      u_texture: { value: texture },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_radius: { value: 0.0 },
      u_speed: { value: config.maskSpeed },
      u_imageAspect: { value: imageAspect },
      u_turbulenceIntensity: { value: config.turbulenceIntensity },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.capabilities.anisotropy = 16;

    container.appendChild(renderer.domElement);
  };

  const setupDebugger = () => {
    const gui = new GUI();
    gui.domElement.style.position = "absolute";
    gui.domElement.style.top = "10px";
    gui.domElement.style.right = "10px";

    gui.add(config, "maskRadius", 0.05, 1.0, 0.01).name("Mask Radius");

    gui
      .add(config, "turbulenceIntensity", 0, 1.0, 0.001)
      .name("Turbulence")
      .onChange((value) => {
        if (uniforms) {
          uniforms.u_turbulenceIntensity.value = value;
        }
      });
  };

  const setupEventListeners = () => {
    document.addEventListener("mousemove", (e) => {
      updateCursorState(e.clientX, e.clientY);
    });

    window.addEventListener("scroll", () => {
      updateCursorState(lastMouseX, lastMouseY);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isInView = entry.isIntersecting;
          if (!isInView) {
            targetRadius = 0.0;
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
  };

  const updateCursorState = (x, y) => {
    lastMouseX = x;
    lastMouseY = y;

    const rect = container.getBoundingClientRect();
    const inside =
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

    isMouseInsideContainer = inside;

    if (inside) {
      targetMouse.x = (x - rect.left) / rect.width;
      targetMouse.y = 1.0 - (y - rect.top) / rect.height;
      targetRadius = config.maskRadius;
    } else {
      targetRadius = 0.0;
    }
  };

  const animate = () => {
    requestAnimationFrame(animate);

    lerpedMouse.lerp(targetMouse, config.lerpFactor);

    if (uniforms) {
      uniforms.u_mouse.value.copy(lerpedMouse);
      uniforms.u_time.value += 0.01;
      uniforms.u_radius.value +=
        (targetRadius - uniforms.u_radius.value) * config.radiusLerpSpeed;
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  };
}
