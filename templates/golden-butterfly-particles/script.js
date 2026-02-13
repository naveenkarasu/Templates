(function () {
  'use strict';

  // ─── CONFIG ──────────────────────────────────────────────
  var SWARM_COUNT  = 4600;    // butterflies visible in free-flight
  var MAX_PARTICLES = 50000;  // buffer capacity (grows up to this when forming)
  var CAMERA_Z     = 82;
  var CAMERA_FOV   = 60;

  // ─── SCENE ───────────────────────────────────────────────
  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, 0.1, 1000);
  camera.position.z = CAMERA_Z;

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  document.body.appendChild(renderer.domElement);

  // ─── LIGHTS ──────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffefc8, 0.92));
  scene.add(new THREE.HemisphereLight(0xffe0a2, 0x2a1604, 0.62));

  var keyLight = new THREE.DirectionalLight(0xfff2cc, 1.2);
  keyLight.position.set(26, 36, 44);
  scene.add(keyLight);

  var fillLight = new THREE.DirectionalLight(0xffcc6e, 0.9);
  fillLight.position.set(-30, -22, 26);
  scene.add(fillLight);

  var rimLight = new THREE.DirectionalLight(0xfff0c4, 0.8);
  rimLight.position.set(0, 28, -38);
  scene.add(rimLight);

  var sparkle = new THREE.PointLight(0xffd270, 0.85, 180);
  sparkle.position.set(0, 0, 36);
  scene.add(sparkle);

  // ─── BUTTERFLY TEXTURE (Phosphor Icons, MIT) ─────────────
  var svgData = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="white">' +
    '<path d="M128,100.17a108.42,108.42,0,0,0-8-12.64V56a8,8,0,0,1,16,0V87.53A108.42,' +
    '108.42,0,0,0,128,100.17ZM232.7,50.48C229,45.7,221.84,40,209,40c-16.85,0-38.46,' +
    '11.28-57.81,30.16A140.07,140.07,0,0,0,136,87.53V180a8,8,0,0,1-16,0V87.53a140.07,' +
    '140.07,0,0,0-15.15-17.37C85.49,51.28,63.88,40,47,40,34.16,40,27,45.7,23.3,50.48c' +
    '-6.82,8.77-12.18,24.08-.21,71.2,6.05,23.83,19.51,33,30.63,36.42A44,44,0,0,0,128,' +
    '205.27a44,44,0,0,0,74.28-47.17c11.12-3.4,24.57-12.59,30.63-36.42C239.63,95.24,' +
    '244.85,66.1,232.7,50.48Z"/></svg>';

  var tex = new THREE.TextureLoader().load(
    'data:image/svg+xml;utf8,' + encodeURIComponent(svgData)
  );
  tex.encoding   = THREE.sRGBEncoding;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // ─── INSTANCED MESH ─────────────────────────────────────
  var N = MAX_PARTICLES;
  var GEO_SIZE = 1.8;
  var GOLD_MAT_COLOR = 0xffca55;
  var geo = new THREE.PlaneGeometry(GEO_SIZE, GEO_SIZE);
  var mat = new THREE.MeshPhysicalMaterial({
    map: tex, alphaMap: tex,
    transparent: true, alphaTest: 0.4,
    depthWrite: false, side: THREE.DoubleSide,
    color:     GOLD_MAT_COLOR,
    metalness: 0.68, roughness: 0.26,
    clearcoat: 0.82, clearcoatRoughness: 0.18,
    emissive: 0x301a02, emissiveIntensity: 0.34
  });
  var mesh = new THREE.InstancedMesh(geo, mat, N);
  scene.add(mesh);

  // ─── PER-PARTICLE ARRAYS (allocated for MAX capacity) ────
  var pos      = new Float32Array(N * 3);
  var home     = new Float32Array(N * 3);
  var tgt      = new Float32Array(N * 3);
  var vel      = new Float32Array(N * 3);
  var flapPh   = new Float32Array(N);
  var flapSpd  = new Float32Array(N);
  var bScale   = new Float32Array(N);
  var sparkOff = new Float32Array(N);
  var yawOff   = new Float32Array(N);
  var dummy    = new THREE.Object3D();

  // ─── MOUSE STATE ─────────────────────────────────────────
  var mouseNdc  = new THREE.Vector2(-999, -999);
  var raycaster = new THREE.Raycaster();
  var zPlane    = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var mWorld    = new THREE.Vector3(9999, 9999, 0);
  var mPrev     = new THREE.Vector3(9999, 9999, 0);
  var mVel      = new THREE.Vector3();

  // ─── FORMATION STATE ─────────────────────────────────────
  var isForming    = false;
  var formBflySize = 0.35;
  var lastImage    = null;   // stored for resize re-formation

  // ─── DOM REFS ────────────────────────────────────────────
  var uploadBtn = document.getElementById('uploadBtn');
  var fileInput = document.getElementById('imageUpload');
  var resetBtn  = document.getElementById('resetBtn');
  var statusEl  = document.getElementById('status');

  // ─── COLOR HELPERS ───────────────────────────────────────
  var tmpColor = new THREE.Color();

  function goldRandom(seed) {
    tmpColor.setHSL(0.115 + seed * 0.025, 0.88, 0.38 + seed * 0.20);
    return tmpColor;
  }

  function goldFromLuma(luma) {
    tmpColor.setHSL(0.12 + luma * 0.018, 0.90, 0.32 + luma * 0.30);
    return tmpColor;
  }

  function colorFromRGB(r, g, b) {
    tmpColor.setRGB(r / 255, g / 255, b / 255);
    tmpColor.convertSRGBToLinear();  // getImageData returns sRGB; Three.js works in linear
    return tmpColor;
  }

  // ─── VIEWPORT MATH ──────────────────────────────────────
  function getVisibleSize() {
    var dist = camera.position.z;
    var vH = 2 * Math.tan(camera.fov * Math.PI / 360) * dist;
    return { vW: vH * camera.aspect, vH: vH };
  }

  // ─── INIT SWARM PARTICLE ────────────────────────────────
  function initParticle(i) {
    var i3 = i * 3;
    var x = (Math.random() - 0.5) * 160;
    var y = (Math.random() - 0.5) * 100;
    var z = (Math.random() - 0.5) * 56;

    home[i3] = x; home[i3+1] = y; home[i3+2] = z;
    tgt[i3]  = x; tgt[i3+1]  = y; tgt[i3+2]  = z;
    pos[i3]  = x; pos[i3+1]  = y; pos[i3+2]  = z;
    vel[i3]  = 0; vel[i3+1]  = 0; vel[i3+2]  = 0;

    flapPh[i]   = Math.random() * Math.PI * 2;
    flapSpd[i]  = 10 + Math.random() * 18;
    bScale[i]   = 0.24 + Math.random() * 0.28;
    sparkOff[i] = Math.random() * Math.PI * 2;
    yawOff[i]   = (Math.random() - 0.5) * 0.65;

    mesh.setColorAt(i, goldRandom(Math.random()));
  }

  // Init ALL particles at full capacity so buffers are allocated at max size.
  // instanceColor is lazily created on first setColorAt() using mesh.count,
  // so we must init all N BEFORE reducing mesh.count.
  for (var i = 0; i < N; i++) initParticle(i);
  mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;

  // Now reduce visible count to swarm
  mesh.count = SWARM_COUNT;

  // ═══════════════════════════════════════════════════════════
  //  OBJECT BOUNDARY DETECTION
  //  Sobel edge detection + edge-aware flood fill from 8 seeds
  //  + morphological close cleanup
  // ═══════════════════════════════════════════════════════════

  function detectForeground(data, w, h) {
    var total = w * h;

    // --- Check for transparency first ---
    var transCount = 0;
    for (var a = 3; a < data.length; a += 4) {
      if (data[a] < 128) transCount++;
    }
    if (transCount > total * 0.05) {
      // Has meaningful transparency: use alpha as mask
      var alphaMask = new Uint8Array(total);
      for (var i = 0; i < total; i++) {
        alphaMask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
      }
      return alphaMask;
    }

    // --- Grayscale ---
    var gray = new Uint8Array(total);
    for (var i = 0; i < total; i++) {
      gray[i] = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
    }

    // --- Sobel edge detection ---
    var edges = new Uint8Array(total);
    var maxE = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var idx = y * w + x;
        var gx = -gray[idx-w-1] + gray[idx-w+1]
                 -2*gray[idx-1] + 2*gray[idx+1]
                 -gray[idx+w-1] + gray[idx+w+1];
        var gy = -gray[idx-w-1] - 2*gray[idx-w] - gray[idx-w+1]
                 +gray[idx+w-1] + 2*gray[idx+w] + gray[idx+w+1];
        var mag = Math.sqrt(gx * gx + gy * gy);
        if (mag > 255) mag = 255;
        edges[idx] = mag;
        if (mag > maxE) maxE = mag;
      }
    }
    // Normalize to 0-255
    if (maxE > 0) {
      var scale = 255 / maxE;
      for (var i = 0; i < total; i++) edges[i] = edges[i] * scale;
    }

    // --- Edge-aware flood fill from 8 seed points ---
    var EDGE_THRESH = 30;
    var COLOR_TOL_SQ = 60 * 60;
    var bg = new Uint8Array(total);  // 1 = background

    function floodFill(sx, sy) {
      var si = sy * w + sx;
      if (bg[si]) return;
      var sR = data[si*4], sG = data[si*4+1], sB = data[si*4+2];

      function ok(idx) {
        if (bg[idx]) return false;
        if (edges[idx] > EDGE_THRESH) return false;
        var o = idx * 4;
        var dr = data[o] - sR, dg = data[o+1] - sG, db = data[o+2] - sB;
        return dr*dr + dg*dg + db*db <= COLOR_TOL_SQ;
      }

      var stack = [[sx, sy]];
      while (stack.length) {
        var pt = stack.pop();
        var fx = pt[0], fy = pt[1];
        var pi = fy * w + fx;

        // Walk up
        while (fy >= 0 && ok(pi)) { fy--; pi -= w; }
        fy++; pi += w;

        var rL = false, rR = false;
        // Walk down, scan left/right
        while (fy < h && ok(pi)) {
          bg[pi] = 1;
          if (fx > 0) {
            if (ok(pi - 1)) { if (!rL) { stack.push([fx-1, fy]); rL = true; } }
            else rL = false;
          }
          if (fx < w - 1) {
            if (ok(pi + 1)) { if (!rR) { stack.push([fx+1, fy]); rR = true; } }
            else rR = false;
          }
          fy++; pi += w;
        }
      }
    }

    // 4 corners + 4 edge midpoints
    floodFill(0, 0);
    floodFill(w-1, 0);
    floodFill(0, h-1);
    floodFill(w-1, h-1);
    floodFill(w>>1, 0);
    floodFill(w>>1, h-1);
    floodFill(0, h>>1);
    floodFill(w-1, h>>1);

    // --- Invert: foreground = NOT background ---
    var mask = new Uint8Array(total);
    for (var i = 0; i < total; i++) mask[i] = bg[i] ? 0 : 1;

    // --- Morphological close (dilate then erode, radius=2) ---
    function dilate(m, r) {
      var out = new Uint8Array(total);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var idx = y * w + x;
          if (m[idx]) { out[idx] = 1; continue; }
          var found = false;
          for (var dy = -r; dy <= r && !found; dy++) {
            for (var dx = -r; dx <= r && !found; dx++) {
              var ny = y + dy, nx = x + dx;
              if (ny >= 0 && ny < h && nx >= 0 && nx < w && m[ny * w + nx]) found = true;
            }
          }
          if (found) out[idx] = 1;
        }
      }
      return out;
    }

    function erode(m, r) {
      var out = new Uint8Array(total);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var idx = y * w + x;
          if (!m[idx]) continue;
          var allSet = true;
          for (var dy = -r; dy <= r && allSet; dy++) {
            for (var dx = -r; dx <= r && allSet; dx++) {
              var ny = y + dy, nx = x + dx;
              if (ny < 0 || ny >= h || nx < 0 || nx >= w || !m[ny * w + nx]) allSet = false;
            }
          }
          if (allSet) out[idx] = 1;
        }
      }
      return out;
    }

    return erode(dilate(mask, 2), 2);
  }

  // ═══════════════════════════════════════════════════════════
  //  IMAGE SAMPLING + FORMATION
  // ═══════════════════════════════════════════════════════════

  function applyFormation(img) {
    statusEl.textContent = 'Processing...';
    lastImage = img;

    // 1. Compute sample resolution: total pixels ≈ MAX target count
    //    We want enough unique targets. Use a grid slightly larger
    //    than needed so after subsampling we still have N unique positions.
    var imgAspect = img.height / img.width;
    var targetPixels = Math.max(N, SWARM_COUNT * 2);
    var sW = Math.ceil(Math.sqrt(targetPixels / imgAspect));
    var sH = Math.ceil(sW * imgAspect);
    sW = Math.max(50, Math.min(sW, 500));
    sH = Math.max(50, Math.min(sH, 500));

    // 2. Draw and extract pixel data
    var cvs = document.createElement('canvas');
    cvs.width = sW; cvs.height = sH;
    var ctx = cvs.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sW, sH);
    var data = ctx.getImageData(0, 0, sW, sH).data;

    // 3. Detect object boundary
    var fgMask = detectForeground(data, sW, sH);

    // 4. Collect all pixel positions
    var pixels = [];
    for (var py = 0; py < sH; py++) {
      for (var px = 0; px < sW; px++) {
        var idx = (py * sW + px) * 4;
        pixels.push({
          x: px, y: py,
          r: data[idx], g: data[idx+1], b: data[idx+2],
          fg: fgMask[py * sW + px]
        });
      }
    }

    if (!pixels.length) {
      statusEl.textContent = 'No pixels found';
      return;
    }

    // 5. Determine how many particles we need
    //    Use all available pixels, capped at MAX_PARTICLES
    var neededCount = Math.min(pixels.length, N);

    // Shuffle pixels and truncate to needed count
    for (var i = pixels.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var tmp = pixels[i]; pixels[i] = pixels[j]; pixels[j] = tmp;
    }
    pixels.length = neededCount;

    // 6. Full-viewport mapping (image fills 100% of visible area)
    var vis = getVisibleSize();
    var imgPixelAspect = sW / sH;
    var viewAspect = vis.vW / vis.vH;
    var worldW, worldH;
    if (imgPixelAspect > viewAspect) {
      // Image wider than viewport: fit to width
      worldW = vis.vW;
      worldH = worldW / imgPixelAspect;
    } else {
      // Image taller: fit to height
      worldH = vis.vH;
      worldW = worldH * imgPixelAspect;
    }
    var scaleFactor = worldW / sW;

    // 7. Compute butterfly size for formation
    var areaPerParticle = (worldW * worldH) / neededCount;
    var spacing = Math.sqrt(areaPerParticle);
    formBflySize = (spacing * 1.35) / GEO_SIZE;
    formBflySize = Math.max(0.03, Math.min(formBflySize, 0.55));

    // 8. Grow mesh.count if needed; init new particles
    if (neededCount > mesh.count) {
      for (var i = mesh.count; i < neededCount; i++) {
        initParticle(i);
      }
    }
    mesh.count = neededCount;

    // 9. Switch material to white so image colors aren't gold-tinted
    mat.color.set(0xffffff);

    // 10. Assign targets + colors
    var fgCount = 0;
    for (var i = 0; i < neededCount; i++) {
      var p = pixels[i % pixels.length];
      var i3 = i * 3;

      // Center + Y-flip + scale = full-viewport world position
      tgt[i3]     = (p.x - sW * 0.5) * scaleFactor;
      tgt[i3 + 1] = (sH * 0.5 - p.y) * scaleFactor;
      tgt[i3 + 2] = (Math.random() - 0.5) * 1.2;

      // Kill velocity for fast convergence
      vel[i3] *= 0.06; vel[i3+1] *= 0.06; vel[i3+2] *= 0.06;

      // Color: foreground → actual image color, background → gold
      if (p.fg) {
        mesh.setColorAt(i, colorFromRGB(p.r, p.g, p.b));
        fgCount++;
      } else {
        var luma = (p.r * 0.2126 + p.g * 0.7152 + p.b * 0.0722) / 255;
        mesh.setColorAt(i, goldFromLuma(luma));
      }
    }

    mesh.instanceColor.needsUpdate = true;
    isForming = true;
    statusEl.textContent = 'Formed: ' + neededCount + ' butterflies (' + fgCount + ' colored)';
  }

  // ─── RESET ───────────────────────────────────────────────
  function resetSwarm() {
    isForming = false;
    lastImage = null;

    // Restore gold material color
    mat.color.set(GOLD_MAT_COLOR);

    // Shrink back to swarm count
    mesh.count = SWARM_COUNT;

    for (var i = 0; i < SWARM_COUNT; i++) {
      var i3 = i * 3;
      tgt[i3] = home[i3]; tgt[i3+1] = home[i3+1]; tgt[i3+2] = home[i3+2];
      vel[i3] *= 0.2; vel[i3+1] *= 0.2; vel[i3+2] *= 0.2;
      mesh.setColorAt(i, goldRandom(Math.random()));
    }
    mesh.instanceColor.needsUpdate = true;
    statusEl.textContent = 'Swarm reset (' + SWARM_COUNT + ' butterflies)';
  }

  // ─── UPLOAD HANDLING ─────────────────────────────────────
  uploadBtn.addEventListener('click', function () {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    statusEl.textContent = 'Loading...';

    var reader = new FileReader();
    reader.onerror = function () { statusEl.textContent = 'Read failed'; };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { statusEl.textContent = 'Decode failed'; };
      img.onload = function () { applyFormation(img); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  resetBtn.addEventListener('click', resetSwarm);
  addEventListener('keydown', function (e) {
    if (e.key === 'r' || e.key === 'R') resetSwarm();
  });

  // ─── MOUSE TRACKING ─────────────────────────────────────
  document.addEventListener('mousemove', function (e) {
    mouseNdc.x =  (e.clientX / innerWidth)  * 2 - 1;
    mouseNdc.y = -(e.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouseNdc, camera);
    if (raycaster.ray.intersectPlane(zPlane, mWorld)) {
      mVel.subVectors(mWorld, mPrev).multiplyScalar(0.62);
      var spd = mVel.length();
      if (spd > 4.5) mVel.multiplyScalar(4.5 / spd);
      mPrev.copy(mWorld);
      sparkle.position.set(mWorld.x, mWorld.y, 36);
    }
  });

  // ─── ANIMATION LOOP ─────────────────────────────────────
  var clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    var dt   = Math.min(clock.getDelta(), 0.035);
    var time = clock.elapsedTime;
    var activeCount = mesh.count;

    mVel.multiplyScalar(0.91);

    var spring, springZ, damp, mouseScale;
    if (isForming) {
      spring     = 0.075;
      springZ    = 0.06;
      damp       = 0.80;
      mouseScale = 0.08;
    } else {
      spring     = 0.042;
      springZ    = 0.035;
      damp       = 0.875;
      mouseScale = 1.0;
    }

    var mRadius = 22;

    for (var i = 0; i < activeCount; i++) {
      var i3 = i * 3;

      var px = pos[i3], py = pos[i3+1], pz = pos[i3+2];
      var vx = vel[i3], vy = vel[i3+1], vz = vel[i3+2];

      var ax = (tgt[i3]   - px) * spring;
      var ay = (tgt[i3+1] - py) * spring;
      var az = (tgt[i3+2] - pz) * springZ;

      var dx = px - mWorld.x;
      var dy = py - mWorld.y;
      var dz = pz - mWorld.z;
      var distSq = dx * dx + dy * dy + dz * dz + 0.001;

      if (distSq < mRadius * mRadius) {
        var dist    = Math.sqrt(distSq);
        var falloff = 1.0 - dist / mRadius;
        var invD    = 1.0 / dist;
        var push    = 1.3 * falloff * mouseScale;

        ax += dx * invD * push;
        ay += dy * invD * push;
        az += dz * invD * push * 0.45;

        ax += mVel.x * falloff * 0.75 * mouseScale;
        ay += mVel.y * falloff * 0.75 * mouseScale;

        ax += -mVel.y * falloff * 0.28 * mouseScale;
        ay +=  mVel.x * falloff * 0.28 * mouseScale;

        az += falloff * 0.5 * mouseScale;
      }

      vx = (vx + ax * dt * 60) * damp;
      vy = (vy + ay * dt * 60) * damp;
      vz = (vz + az * dt * 60) * damp;

      px += vx * dt * 5.0;
      py += vy * dt * 5.0;
      pz += vz * dt * 5.0;

      vel[i3] = vx; vel[i3+1] = vy; vel[i3+2] = vz;
      pos[i3] = px; pos[i3+1] = py; pos[i3+2] = pz;

      var flap    = 0.36 + 0.64 * Math.abs(Math.sin(time * flapSpd[i] + flapPh[i]));
      var flicker = 0.87 + 0.22 * Math.sin(time * (5.5 + flapSpd[i] * 0.04) + sparkOff[i]);
      var sz = isForming ? formBflySize : bScale[i];

      dummy.position.set(px, py, pz);
      dummy.quaternion.copy(camera.quaternion);
      dummy.rotateZ(Math.atan2(vy, vx) + yawOff[i] + Math.sin(time * 2.5 + flapPh[i]) * 0.18);
      dummy.rotateX(Math.sin(time * 4.5 + sparkOff[i]) * 0.07);
      dummy.scale.set(
        sz * (0.55 + flap * 0.80),
        sz * (0.80 + flap * 0.18) * flicker,
        sz
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    sparkle.intensity = 0.82 + Math.sin(time * 2.0) * 0.18;
    renderer.render(scene, camera);
  }

  animate();

  // ─── RESIZE: re-form image at new viewport size ─────────
  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);

    // Re-apply formation if we have an active image
    if (isForming && lastImage) {
      applyFormation(lastImage);
    }
  });

})();
