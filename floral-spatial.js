/* Golabii — the original painting as five layered relief surfaces.
 * Depth and occluded-color margins are prepared offline. No model, tracker,
 * third-party script, alternate artwork, or second opening runs in the browser.
 */
(() => {
  'use strict';
  const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  async function mount(container) {
    if (!container) throw new Error('The floral scene needs its opening container.');
    const canvas = container.querySelector('#floralCanvas');
    const hint = container.querySelector('#openingHint');
    const tilt = container.querySelector('#tiltOpening');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
    const suffix = mobile ? '-mobile' : '';
    if (tilt) tilt.hidden = !mobile || !window.DeviceOrientationEvent || !window.isSecureContext || reduced.matches;
    const listeners = [], meshes = [], shaders = [], programs = [], buffers = [], textures = [];
    let active = !container.classList.contains('loaded'), disposed = false, failed = false, ready = false;
    let visible = true, gl = null, raf = 0, lastFrame = 0, elapsed = 0, frames = 0;
    let x = 0, y = 0, targetX = 0, targetY = 0, pointerActive = false, sensor = false, neutral = null;
    let width = 1, height = 1, dpr = 1, lastInteraction = 0, observer, intersection, indices, indexCount;
    let artworkProgram, atmosphereProgram, dustBuffer, artUniforms, dustUniforms;
    let brightness = 0, activePointer = null, initializing = false;
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };
    const status = text => { if (hint && hint.textContent !== text) hint.textContent = text; };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; lastFrame = 0; };
    const canDraw = () => ready && active && visible && !document.hidden && !disposed && !failed && !reduced.matches;
    const schedule = () => { if (canDraw() && !raf) raf = requestAnimationFrame(draw); };
    function fallback(message) {
      stop(); container.dataset.spatialState = 'fallback';
      if (tilt) { tilt.disabled = true; tilt.setAttribute('aria-pressed', 'false'); }
      status(message || 'A garden in bloom.');
    }
    function aim(a, b) {
      targetX = clamp(Number(a) || 0); targetY = clamp(Number(b) || 0);
      lastInteraction = performance.now(); schedule();
    }
    function pause() {
      active = false; stop();
      if (ready && !failed) container.dataset.spatialState = 'paused';
    }
    function resume() {
      if (disposed) return;
      active = true;
      if (failed || reduced.matches) return fallback();
      elapsed = 0; brightness = 0; x = y = targetX = targetY = 0; neutral = null;
      lastFrame = 0;
      if (ready) { resize(); render(0, 0, 0); container.dataset.spatialState = 'ready'; schedule(); }
      else initialize();
    }
    function dispose() {
      if (disposed) return;
      disposed = true; active = false; stop(); listeners.forEach(remove => remove());
      observer?.disconnect(); intersection?.disconnect();
      if (gl && !gl.isContextLost()) {
        textures.forEach(texture => gl.deleteTexture(texture));
        buffers.forEach(buffer => gl.deleteBuffer(buffer));
        programs.forEach(program => gl.deleteProgram(program));
        shaders.forEach(shader => gl.deleteShader(shader));
      }
      meshes.length = 0; container.dataset.spatialState = 'paused';
    }
    async function enableTilt() {
      if (disposed || reduced.matches || failed) return false;
      if (sensor) {
        sensor = false; neutral = null; aim(0, 0);
        if (tilt) { tilt.textContent = 'Enable tilt'; tilt.setAttribute('aria-pressed', 'false'); }
        status(mobile ? 'Drag to explore the flowers' : 'Move your cursor through the garden');
        return false;
      }
      if (!window.DeviceOrientationEvent || !window.isSecureContext) {
        status('Drag to explore — tilt is unavailable here.'); return false;
      }
      try {
        const permission = typeof DeviceOrientationEvent.requestPermission === 'function'
          ? await DeviceOrientationEvent.requestPermission() : 'granted';
        if (permission !== 'granted') { status('Drag to explore — motion permission was not enabled.'); return false; }
        if (disposed || !active) return false;
        sensor = true; neutral = null;
        if (tilt) { tilt.textContent = 'Tilt enabled'; tilt.setAttribute('aria-pressed', 'true'); }
        status('Gently tilt your phone to look into the garden'); schedule(); return true;
      } catch (_) { status('Drag to explore the flowers'); return false; }
    }
    const controller = {
      resume, pause, dispose, aim, enableTilt,
      get state() { return { ready, active, disposed, failed, visible, reducedMotion: reduced.matches, sensor,
        layerCount: meshes.length, x, y, targetX, targetY, elapsed, frames,
        drawingPixels: canvas ? canvas.width * canvas.height : 0, pixelRatio: dpr,
        frameCap: mobile ? 30 : 60, state: container.dataset.spatialState }; }
    };
    container.spatial = controller;

    function compile(type, source) {
      const shader = gl.createShader(type); shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    function program(vertex, fragment, attributes) {
      const value = gl.createProgram(); programs.push(value);
      gl.attachShader(value, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(value, compile(gl.FRAGMENT_SHADER, fragment));
      attributes.forEach((name, i) => gl.bindAttribLocation(value, i, name));
      gl.linkProgram(value);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(value));
      return value;
    }
    function buffer(data, type = gl.ARRAY_BUFFER) {
      const value = gl.createBuffer(); buffers.push(value); gl.bindBuffer(type, value); gl.bufferData(type, data, gl.STATIC_DRAW); return value;
    }
    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image(); image.decoding = 'async';
        const timeout = setTimeout(() => { image.onload = image.onerror = null; reject(new Error('Image request timed out')); }, 10000);
        image.onload = () => { clearTimeout(timeout); resolve(image); };
        image.onerror = () => { clearTimeout(timeout); reject(new Error('Could not load floral texture')); };
        image.src = url;
      });
    }
    function resize() {
      if (!gl || disposed || failed) return;
      width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
      dpr = Math.min(devicePixelRatio || 1, mobile ? 1.65 : 1.8, Math.sqrt((mobile ? 1000000 : 1800000) / (width * height)));
      const cw = Math.round(width * dpr), ch = Math.round(height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      gl.viewport(0, 0, cw, ch);
      const overscan = clamp(parseFloat(getComputedStyle(container).getPropertyValue('--floral-overscan')) || 1.10, 1.08, 1.2);
      gl.useProgram(artworkProgram);
      gl.uniform2f(artUniforms.cover, Math.max(1, height / width) * overscan, Math.max(1, width / height) * overscan);
      schedule();
    }
    function render(cx, cy, time) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(artworkProgram);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
      gl.uniform2f(artUniforms.camera, cx * .145, -cy * .112);
      gl.uniform2f(artUniforms.light, cx * .75 + Math.sin(time * .22) * .28, -cy * .6 + Math.sin(time * .19) * .22);
      gl.uniform1f(artUniforms.time, time); gl.uniform1f(artUniforms.energy, brightness);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
      for (const mesh of meshes) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mesh.texture);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      }
      gl.disableVertexAttribArray(1);
      if (brightness > .01) {
        gl.useProgram(atmosphereProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, dustBuffer); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
        gl.uniform1f(dustUniforms.time, time); gl.uniform1f(dustUniforms.ratio, dpr);
        gl.uniform1f(dustUniforms.energy, brightness); gl.uniform2f(dustUniforms.camera, cx, cy);
        gl.drawArrays(gl.POINTS, 0, mobile ? 18 : 26);
      }
      frames++;
    }
    function draw(now) {
      raf = 0; if (!canDraw() || gl.isContextLost()) return;
      const interval = 1000 / (mobile ? 30 : 60);
      if (lastFrame && now - lastFrame < interval - 1) return schedule();
      const dt = Math.min((now - (lastFrame || now - interval)) / 1000, .07); lastFrame = now; elapsed += dt;
      brightness = ease(.12, 1.7, elapsed);
      const interacting = pointerActive || sensor || now - lastInteraction < 2200;
      const driftAmount = interacting ? .065 : .45;
      const entrance = ease(0, 2.4, elapsed);
      const driftX = Math.sin(elapsed * .41) * driftAmount * entrance;
      const driftY = Math.sin(elapsed * .29) * driftAmount * .55 * entrance;
      const tx = clamp(targetX * .92 + driftX), ty = clamp(targetY * .92 + driftY);
      const smoothing = 1 - Math.exp(-dt * 5.8);
      x += (tx - x) * smoothing; y += (ty - y) * smoothing;
      render(x, y, elapsed); schedule();
    }
    async function initialize() {
      if (initializing || ready || failed || disposed || reduced.matches) return;
      initializing = true; container.dataset.spatialState = 'loading';
      try {
        if (!canvas) throw new Error('Missing floral canvas');
        gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
        if (!gl) throw new Error('WebGL unavailable');
        artworkProgram = program(`
          precision highp float;
          attribute vec3 aSurface;
          attribute vec2 aNormal;
          uniform vec2 uCover, uCamera;
          uniform float uTime;
          uniform mediump float uEnergy;
          varying mediump vec2 vUV, vNormal;
          varying mediump float vProtection;
          void main() {
            vUV = aSurface.xy; vNormal = aNormal;
            vec2 relative = abs(aSurface.xy - vec2(.5, .498));
            float protection = (1. - smoothstep(.12, .18, relative.x)) * (1. - smoothstep(.025, .065, relative.y));
            vProtection = protection;
            float depth = aSurface.z;
            float distance = 1. - depth * .27;
            vec2 p = (aSurface.xy - .5) * 2. * uCover * distance;
            p.y = -p.y;
            p += uCamera * (depth - .59);
            float foliage = smoothstep(.28, .9, depth) * (1. - protection);
            float breeze = sin(uTime * .55 + aSurface.y * 5. + aSurface.x * 3.) * sin(uTime * .32);
            p.x += breeze * .0024 * foliage * uEnergy;
            p.y += sin(uTime * .44 + aSurface.x * 6.) * sin(uTime * .27) * .0014 * foliage * uEnergy;
            gl_Position = vec4(p, 0., distance);
          }`, `
          precision mediump float;
          uniform sampler2D uColor;
          uniform vec2 uLight;
          uniform mediump float uEnergy;
          varying mediump vec2 vUV, vNormal;
          varying mediump float vProtection;
          void main() {
            vec4 color = texture2D(uColor, vUV);
            if (color.a < .003) discard;
            float light = clamp(dot(vNormal, uLight), -.8, .8) * .065 * uEnergy * (1. - vProtection);
            color.rgb *= 1. + light;
            color.rgb += vec3(1., .72, .44) * max(light, 0.) * .07;
            gl_FragColor = color;
          }`, ['aSurface', 'aNormal']);
        artUniforms = {};
        for (const [key, name] of Object.entries({ cover:'uCover', camera:'uCamera', time:'uTime', light:'uLight', energy:'uEnergy' })) artUniforms[key] = gl.getUniformLocation(artworkProgram, name);
        gl.useProgram(artworkProgram); gl.uniform1i(gl.getUniformLocation(artworkProgram, 'uColor'), 0);
        atmosphereProgram = program(`
          precision highp float;
          attribute vec4 aSeed;
          uniform float uTime, uRatio;
          uniform vec2 uCamera;
          varying mediump float vAlpha;
          void main() {
            float z = aSeed.z;
            vec2 p = aSeed.xy;
            p.y = mod(p.y + 1. + uTime * (.006 + z * .008), 2.) - 1.;
            p.x += sin(uTime * .18 + aSeed.w * 11.) * .045;
            p += vec2(uCamera.x, -uCamera.y) * (.025 + z * .025);
            float brandGap = smoothstep(.07, .25, abs(p.y));
            vAlpha = (.08 + .11 * z) * (.65 + .35 * sin(uTime * .7 + aSeed.w * 17.)) * brandGap;
            gl_PointSize = (2. + z * z * 7.) * uRatio;
            gl_Position = vec4(p, 0., 1.);
          }`, `
          precision mediump float;
          uniform mediump float uEnergy;
          varying mediump float vAlpha;
          void main() {
            float r = length(gl_PointCoord - .5) * 2.;
            if(r > 1.) discard;
            float a = exp(-r * r * 5.) * (1. - smoothstep(.65, 1., r));
            gl_FragColor = vec4(1., .86, .64, a * vAlpha * uEnergy);
          }`, ['aSeed']);
        dustUniforms = {};
        for (const [key, name] of Object.entries({time:'uTime', ratio:'uRatio', energy:'uEnergy', camera:'uCamera'})) dustUniforms[key] = gl.getUniformLocation(atmosphereProgram, name);
        const dust = new Float32Array(26 * 4);
        for (let i = 0; i < 26; i++) dust.set([((i * .61803398875) % 1) * 2 - 1, ((i * .41421356 + .2) % 1) * 2 - 1, (i * .7320508 + .1) % 1, (i * .2360679) % 1], i * 4);
        dustBuffer = buffer(dust);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(.72, .45, .61, 1);
        const images = await Promise.all(Array.from({length:5}, (_, i) => Promise.all([
          loadImage(`assets/floral-spatial/layer-${i}${suffix}.webp`),
          loadImage(`assets/floral-spatial/depth-${i}${suffix}.png`)
        ])));
        if (disposed || failed) return;
        const segments = mobile ? 112 : 160, side = segments + 1;
        const order = new Uint16Array(segments * segments * 6); let k = 0;
        for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) {
          const n = j * side + i; order.set([n, n + side, n + 1, n + 1, n + side, n + side + 1], k); k += 6;
        }
        indices = buffer(order, gl.ELEMENT_ARRAY_BUFFER); indexCount = order.length;
        const sampler = document.createElement('canvas'); sampler.width = sampler.height = side;
        const context = sampler.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Depth sampling is unavailable');
        for (const [color, depth] of images) {
          context.drawImage(depth, 0, 0, side, side);
          const pixels = context.getImageData(0, 0, side, side).data;
          const at = (i,j) => pixels[(clamp(j,0,segments)*side + clamp(i,0,segments))*4]/255;
          const vertices = new Float32Array(side * side * 5);
          for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
            vertices.set([i/segments, j/segments, at(i,j), clamp((at(i-1,j)-at(i+1,j))*8), clamp((at(i,j-1)-at(i,j+1))*8)], (j*side+i)*5);
          }
          const geometry = buffer(vertices), texture = gl.createTexture(); textures.push(texture);
          gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, color);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          meshes.push({ buffer:geometry, texture });
        }
        ready = true; initializing = false; resize(); render(0, 0, 0);
        if (reduced.matches) { fallback(); return; }
        if (tilt) tilt.disabled = false;
        container.dataset.spatialState = active && !reduced.matches ? 'ready' : 'paused';
        status(mobile ? 'Drag to explore the flowers' : 'Move your cursor through the garden');
        schedule();
      } catch (error) {
        if (disposed) return;
        failed = true; initializing = false; fallback();
        console.warn('Golabii floral scene uses its original still:', error.message);
      }
    }

    const point = event => {
      const rect = container.getBoundingClientRect();
      aim((event.clientX - rect.left) / Math.max(1,rect.width) * 2 - 1, (event.clientY - rect.top) / Math.max(1,rect.height) * 2 - 1);
    };
    listen(container, 'pointerdown', event => {
      if (!active || event.target.closest('button,a') || sensor) return;
      pointerActive = true; activePointer = event.pointerId; point(event);
      if (event.pointerType !== 'mouse') { try { canvas?.setPointerCapture?.(event.pointerId); } catch (_) {} }
    });
    listen(container, 'pointermove', event => {
      if (!active || sensor || event.target.closest('button,a')) return;
      if (event.pointerType === 'mouse' || event.pointerId === activePointer) { pointerActive = true; point(event); }
    }, {passive:true});
    const releasePointer = () => { activePointer = null; pointerActive = false; if (!sensor) aim(0,0); };
    listen(container, 'pointerup', releasePointer);
    listen(container, 'pointercancel', releasePointer);
    listen(container, 'pointerleave', () => { if (activePointer === null) releasePointer(); });
    listen(container, 'keydown', event => {
      if (!active || !/^Arrow/.test(event.key) || event.target.closest('button,a')) return;
      event.preventDefault(); aim(targetX + (event.key === 'ArrowRight' ? .25 : event.key === 'ArrowLeft' ? -.25 : 0), targetY + (event.key === 'ArrowDown' ? .25 : event.key === 'ArrowUp' ? -.25 : 0));
    });
    listen(window, 'deviceorientation', event => {
      if (!active || !sensor || event.beta == null || event.gamma == null) return;
      if (!neutral) neutral = {beta:event.beta,gamma:event.gamma};
      const angle = (screen.orientation?.angle || window.orientation || 0) * Math.PI / 180;
      const a = (event.gamma-neutral.gamma)/17, b = (event.beta-neutral.beta)/17;
      aim(a*Math.cos(angle)+b*Math.sin(angle), b*Math.cos(angle)-a*Math.sin(angle));
    }, {passive:true});
    listen(window, 'orientationchange', () => { neutral = null; aim(0,0); });
    listen(document, 'visibilitychange', () => { if(document.hidden) stop(); else { lastFrame=0; schedule(); } });
    if (canvas) listen(canvas, 'webglcontextlost', event => { event.preventDefault(); failed=true; fallback(); });
    if (tilt) listen(tilt, 'click', enableTilt);
    listen(reduced, 'change', () => {
      if (tilt) tilt.hidden = !mobile || !window.DeviceOrientationEvent || !window.isSecureContext || reduced.matches;
      if (reduced.matches) { sensor=false; fallback(); }
      else if (ready && !failed) { if(tilt) tilt.disabled=false; if(active) resume(); }
      else if (!failed) initialize();
    });
    observer = new ResizeObserver(resize); observer.observe(container);
    intersection = new IntersectionObserver(([entry]) => { visible=entry.isIntersecting; if(visible) schedule(); else stop(); }); intersection.observe(container);
    if (reduced.matches) fallback(); else await initialize();
    return controller;
  }
  window.GolabiiFloralScene = {mount};
})();
