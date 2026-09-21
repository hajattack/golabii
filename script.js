/**
 * GOLABII — Interactions V4
 * Loader, scroll reveal, video playback, rose explosion
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. PAGE LOADER + 3D MODEL PRELOAD
  // ==========================================
  // ==========================================
  // 2. SCROLL REVEAL ANIMATIONS
  // ==========================================
  const revealElements = document.querySelectorAll('.reveal-up');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ==========================================
  // 3. VIDEO PROXIMITY PLAYBACK (One at a time)
  // ==========================================
  const allVideos = document.querySelectorAll('.section-video');
  let currentlyPlaying = null;

  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
        if (currentlyPlaying && currentlyPlaying !== video) {
          currentlyPlaying.pause();
        }

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            currentlyPlaying = video;
          }).catch(() => {});
        }
      } else if (!entry.isIntersecting && video === currentlyPlaying) {
        video.pause();
        currentlyPlaying = null;
      }
    });
  }, {
    threshold: [0, 0.4, 0.8],
    rootMargin: '-5% 0px -5% 0px'
  });

  allVideos.forEach(video => {
    video.load();
    videoObserver.observe(video);
  });

  // ==========================================
  // 4. SMOOTH SCROLL FOR ANCHORS
  // ==========================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '#top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const navHeight = document.querySelector('.main-nav')?.offsetHeight || 60;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });

  // ==========================================
  // 5. SPATIAL GARDEN WAITLIST CTA
  // ==========================================
  const spatialHero = document.getElementById('connect');
  const spatialCanvas = document.getElementById('spatialCanvas');

  if (spatialHero && spatialCanvas) {
    const motionToggle = document.getElementById('motionToggle');
    const spatialHint = document.getElementById('spatialHint');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const gl = spatialCanvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });

    if (!gl) {
      spatialHero.classList.add('is-fallback');
    } else {
      const settings = {
        imageAspect: 928 / 1120,
        strength: 0.034,
        focus: 0.48,
        zoom: 1.075,
        sheen: 0.045,
        shading: 0.075,
        sharpen: 0.18,
        blur: 0.055,
        response: 4.6,
        gyroRange: 18,
        idleDelay: 3200,
        idleAmount: 0.19,
        scrollAmount: 0.22
      };

      const vertexShaderSource = `
        attribute vec2 p;
        varying vec2 vUv;
        void main() {
          vUv = p * 0.5 + 0.5;
          gl_Position = vec4(p, 0.0, 1.0);
        }
      `;

      const fragmentShaderSource = `
        precision highp float;
        varying vec2 vUv;

        uniform sampler2D uTex;
        uniform sampler2D uDep;
        uniform vec2 uPar;
        uniform vec2 uCover;
        uniform vec2 uTexelC;
        uniform vec2 uTexelD;
        uniform float uStrength;
        uniform float uFocus;
        uniform float uZoom;
        uniform float uSheen;
        uniform float uShading;
        uniform float uSharp;
        uniform float uBlur;

        const float LAYERS = 28.0;

        float depthAt(vec2 uv) {
          return texture2D(uDep, clamp(uv, vec2(0.001), vec2(0.999))).r;
        }

        vec2 marchDepth(vec2 uv, vec3 view) {
          float stepSize = 1.0 / LAYERS;
          vec2 ray = view.xy / max(view.z, 0.24) * uStrength;
          vec2 stepUv = ray * stepSize;
          float layer = 0.0;
          vec2 currentUv = uv;
          vec2 previousUv = uv;
          float currentDepth = 1.0 - depthAt(currentUv);
          float previousDepth = currentDepth;

          for (int i = 0; i < 28; i++) {
            if (layer >= currentDepth) break;
            previousUv = currentUv;
            previousDepth = currentDepth;
            currentUv -= stepUv;
            currentDepth = 1.0 - depthAt(currentUv);
            layer += stepSize;
          }

          float after = currentDepth - layer;
          float before = previousDepth - layer + stepSize;
          float weight = after / max(after - before, 0.0001);
          return mix(currentUv, previousUv, clamp(weight, 0.0, 1.0));
        }

        vec3 surfaceNormal(vec2 uv) {
          vec2 e = uTexelD * 3.25;
          float leftDepth = depthAt(uv - vec2(e.x, 0.0));
          float rightDepth = depthAt(uv + vec2(e.x, 0.0));
          float downDepth = depthAt(uv - vec2(0.0, e.y));
          float upDepth = depthAt(uv + vec2(0.0, e.y));
          return normalize(vec3((leftDepth - rightDepth) * 5.2, (downDepth - upDepth) * 5.2, 1.0));
        }

        void main() {
          vec2 uv = (vUv - 0.5) * uCover / uZoom + 0.5;
          vec3 view = normalize(vec3(uPar * 0.78, 1.0));
          vec2 baseUv = uv + uPar * uStrength * uFocus;
          vec2 displacedUv = marchDepth(baseUv, view);
          vec2 safeUv = clamp(displacedUv, vec2(0.003), vec2(0.997));
          float depth = depthAt(safeUv);

          vec3 sharp = texture2D(uTex, safeUv).rgb;
          float coc = abs(depth - uFocus) * uBlur;
          vec3 color = sharp;

          if (coc > 0.0035) {
            vec2 radius = uTexelC * (coc * 22.0);
            vec3 soft = sharp * 0.40;
            soft += texture2D(uTex, safeUv + vec2(radius.x, 0.0)).rgb * 0.15;
            soft += texture2D(uTex, safeUv - vec2(radius.x, 0.0)).rgb * 0.15;
            soft += texture2D(uTex, safeUv + vec2(0.0, radius.y)).rgb * 0.15;
            soft += texture2D(uTex, safeUv - vec2(0.0, radius.y)).rgb * 0.15;
            color = mix(sharp, soft, clamp(coc * 2.6, 0.0, 1.0));
          }

          if (uSharp > 0.001) {
            vec2 sampleStep = uTexelC * 1.12;
            vec3 low = texture2D(uTex, safeUv + vec2(sampleStep.x, 0.0)).rgb
                     + texture2D(uTex, safeUv - vec2(sampleStep.x, 0.0)).rgb
                     + texture2D(uTex, safeUv + vec2(0.0, sampleStep.y)).rgb
                     + texture2D(uTex, safeUv - vec2(0.0, sampleStep.y)).rgb;
            color += (color - low * 0.25) * uSharp;
          }

          vec3 normal = surfaceNormal(safeUv);
          vec3 light = normalize(vec3(-uPar.x * 0.85 + 0.18, -uPar.y * 0.85 + 0.34, 1.2));
          vec3 halfVector = normalize(light + vec3(0.0, 0.0, 1.0));
          float sheen = pow(max(dot(normal, halfVector), 0.0), 4.5);
          sheen *= smoothstep(0.16, 0.52, depth);
          float wrappedLight = dot(normal, light) * 0.5 + 0.5;

          color *= 1.0 - uShading * 0.45 + uShading * wrappedLight;
          color += vec3(1.0, 0.87, 0.66) * sheen * uSheen;
          color *= mix(0.92, 1.0, smoothstep(0.0, 0.55, depth));
          gl_FragColor = vec4(color, 1.0);
        }
      `;

      function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || 'Spatial shader failed to compile');
        }
        return shader;
      }

      let program;
      try {
        program = gl.createProgram();
        gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
        gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program) || 'Spatial program failed to link');
        }
        gl.useProgram(program);
      } catch (error) {
        console.error('[Golabii spatial waitlist]', error);
        spatialHero.classList.add('is-fallback');
        program = null;
      }

      if (program) {
        const triangle = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const positionAttribute = gl.getAttribLocation(program, 'p');
        gl.enableVertexAttribArray(positionAttribute);
        gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

        const uniforms = {};
        [
          'uTex', 'uDep', 'uPar', 'uCover', 'uTexelC', 'uTexelD', 'uStrength',
          'uFocus', 'uZoom', 'uSheen', 'uShading', 'uSharp', 'uBlur'
        ].forEach((name) => {
          uniforms[name] = gl.getUniformLocation(program, name);
        });

        let colorImage;
        let depthImage;
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        let scrollPush = 0;
        let gyroInput = null;
        let isDragging = false;
        let dragStart = null;
        let lastInputAt = performance.now();
        let previousFrameAt = performance.now();
        let heroVisible = false;
        let running = false;
        let destroyed = false;
        let texturesStarted = false;
        let texturesReady = false;

        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

        function loadImage(source) {
          return new Promise((resolve, reject) => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Could not load ${source}`));
            image.src = source;
          });
        }

        function uploadTexture(image, unit) {
          const texture = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

          const isPowerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;
          if (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
          } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          }
        }

        function resizeSpatialCanvas() {
          const dprLimit = coarsePointer ? 1.5 : 2;
          const dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
          const width = Math.max(1, Math.round(spatialCanvas.clientWidth * dpr));
          const height = Math.max(1, Math.round(spatialCanvas.clientHeight * dpr));
          if (spatialCanvas.width !== width || spatialCanvas.height !== height) {
            spatialCanvas.width = width;
            spatialCanvas.height = height;
            gl.viewport(0, 0, width, height);
          }

          const viewportAspect = width / height;
          const coverX = viewportAspect > settings.imageAspect ? 1 : viewportAspect / settings.imageAspect;
          const coverY = viewportAspect > settings.imageAspect ? settings.imageAspect / viewportAspect : 1;
          gl.uniform2f(uniforms.uCover, coverX, coverY);
        }

        function setStaticUniforms() {
          gl.uniform1i(uniforms.uTex, 0);
          gl.uniform1i(uniforms.uDep, 1);
          gl.uniform2f(uniforms.uTexelC, 1 / colorImage.width, 1 / colorImage.height);
          gl.uniform2f(uniforms.uTexelD, 1 / depthImage.width, 1 / depthImage.height);
          gl.uniform1f(uniforms.uFocus, settings.focus);
          gl.uniform1f(uniforms.uZoom, settings.zoom);
          gl.uniform1f(uniforms.uSheen, settings.sheen);
          gl.uniform1f(uniforms.uShading, settings.shading);
          gl.uniform1f(uniforms.uSharp, settings.sharpen);
          gl.uniform1f(uniforms.uBlur, settings.blur);
        }

        function updatePointer(event) {
          const bounds = spatialCanvas.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;

          if (isDragging && dragStart) {
            targetX = clamp(dragStart.x + (event.clientX - dragStart.pointerX) / (bounds.width * 0.48), -1, 1);
            targetY = clamp(dragStart.y + (event.clientY - dragStart.pointerY) / (bounds.height * 0.48), -1, 1);
          } else if (!coarsePointer) {
            targetX = clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
            targetY = clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
          }

          lastInputAt = performance.now();
          spatialHero.classList.add('has-input');
        }

        spatialCanvas.addEventListener('pointerdown', (event) => {
          isDragging = true;
          dragStart = {
            x: targetX,
            y: targetY,
            pointerX: event.clientX,
            pointerY: event.clientY
          };
          spatialCanvas.setPointerCapture(event.pointerId);
          updatePointer(event);
        });

        spatialCanvas.addEventListener('pointermove', updatePointer, { passive: true });

        spatialCanvas.addEventListener('pointerup', (event) => {
          isDragging = false;
          dragStart = null;
          if (spatialCanvas.hasPointerCapture(event.pointerId)) {
            spatialCanvas.releasePointerCapture(event.pointerId);
          }
        });

        spatialCanvas.addEventListener('pointercancel', () => {
          isDragging = false;
          dragStart = null;
        });

        spatialCanvas.addEventListener('pointerleave', () => {
          if (isDragging || coarsePointer || gyroInput) return;
          targetX = 0;
          targetY = 0;
        });

        function updateSpatialScroll() {
          const bounds = spatialHero.getBoundingClientRect();
          scrollPush = clamp((-bounds.top / Math.max(bounds.height, 1)) * 1.2, -1, 1);
        }

        window.addEventListener('scroll', updateSpatialScroll, { passive: true });

        function attachPhoneMotion() {
          let zero = null;
          window.addEventListener('deviceorientation', (event) => {
            if (event.beta == null && event.gamma == null) return;
            if (!zero) zero = { beta: event.beta || 0, gamma: event.gamma || 0 };
            gyroInput = {
              x: clamp(((event.gamma || 0) - zero.gamma) / settings.gyroRange, -1, 1),
              y: clamp(((event.beta || 0) - zero.beta) / settings.gyroRange, -1, 1)
            };
            lastInputAt = performance.now();
            spatialHero.classList.add('has-input');
          }, { passive: true });
          motionToggle.textContent = 'Phone motion on';
          motionToggle.disabled = true;
        }

        function configurePhoneMotion() {
          if (!motionToggle || !coarsePointer || reducedMotion || typeof DeviceOrientationEvent === 'undefined') return;

          if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            motionToggle.style.display = 'inline-block';
            motionToggle.addEventListener('click', async () => {
              motionToggle.textContent = 'Requesting…';
              try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                  attachPhoneMotion();
                } else {
                  motionToggle.textContent = 'Drag to explore';
                  motionToggle.disabled = true;
                }
              } catch (error) {
                console.warn('[Golabii spatial waitlist] Phone motion unavailable', error);
                motionToggle.textContent = 'Drag to explore';
                motionToggle.disabled = true;
              }
            }, { once: true });
          } else {
            attachPhoneMotion();
          }
        }

        function drawSpatialFrame(now) {
          if (destroyed) {
            running = false;
            return;
          }
          running = true;

          const deltaSeconds = clamp((now - previousFrameAt) / 1000, 0, 0.05);
          previousFrameAt = now;
          const idleMix = reducedMotion
            ? 0
            : clamp((now - lastInputAt - settings.idleDelay) / 2400, 0, 1);
          const time = now / 1000;
          const idleX = Math.sin(time * 0.24) * settings.idleAmount;
          const idleY = Math.cos(time * 0.19) * settings.idleAmount * 0.68;
          const inputX = gyroInput ? gyroInput.x : targetX;
          const inputY = gyroInput ? gyroInput.y : targetY;
          const destinationX = inputX * (1 - idleMix) + idleX * idleMix;
          const destinationY = inputY * (1 - idleMix) + idleY * idleMix + scrollPush * settings.scrollAmount;
          const interpolation = 1 - Math.exp(-settings.response * deltaSeconds);

          currentX += (destinationX - currentX) * interpolation;
          currentY += (destinationY - currentY) * interpolation;

          gl.uniform2f(uniforms.uPar, currentX, -currentY);
          gl.uniform1f(uniforms.uStrength, reducedMotion ? 0 : settings.strength);
          gl.drawArrays(gl.TRIANGLES, 0, 3);

          if (heroVisible && !document.hidden) {
            requestAnimationFrame(drawSpatialFrame);
          } else {
            running = false;
          }
        }

        const visibilityObserver = new IntersectionObserver(([entry]) => {
          heroVisible = entry.isIntersecting;
          if (heroVisible && texturesReady && !running && !document.hidden) {
            previousFrameAt = performance.now();
            requestAnimationFrame(drawSpatialFrame);
          }
        }, { threshold: 0.01 });
        visibilityObserver.observe(spatialHero);

        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && heroVisible && texturesReady && !running) {
            previousFrameAt = performance.now();
            requestAnimationFrame(drawSpatialFrame);
          }
        });

        spatialCanvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          destroyed = true;
          spatialHero.classList.remove('is-ready');
          spatialHero.classList.add('is-fallback');
        });

        function startSpatialTextures() {
          if (texturesStarted) return;
          texturesStarted = true;

          Promise.all([loadImage('garden.png'), loadImage('spatial-depth.png')])
            .then(([loadedArtwork, loadedDepth]) => {
              colorImage = loadedArtwork;
              depthImage = loadedDepth;
              uploadTexture(colorImage, 0);
              uploadTexture(depthImage, 1);
              setStaticUniforms();
              resizeSpatialCanvas();
              updateSpatialScroll();
              configurePhoneMotion();

              gl.uniform2f(uniforms.uPar, 0, 0);
              gl.uniform1f(uniforms.uStrength, reducedMotion ? 0 : settings.strength);
              gl.drawArrays(gl.TRIANGLES, 0, 3);
              texturesReady = true;
              spatialHero.classList.add('is-ready');
              if (heroVisible) requestAnimationFrame(drawSpatialFrame);
            })
            .catch((error) => {
              console.error('[Golabii spatial waitlist]', error);
              spatialHero.classList.add('is-fallback');
              if (spatialHint) spatialHint.textContent = 'Static garden';
            });
        }

        const loadObserver = new IntersectionObserver(([entry], observer) => {
          if (!entry.isIntersecting) return;
          startSpatialTextures();
          observer.disconnect();
        }, { rootMargin: '600px 0px' });
        loadObserver.observe(spatialHero);

        const resizeObserver = new ResizeObserver(() => {
          if (texturesStarted && colorImage && depthImage) resizeSpatialCanvas();
        });
        resizeObserver.observe(spatialCanvas);
      }
    }
  }

});
