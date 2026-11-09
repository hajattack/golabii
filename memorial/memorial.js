
/* ---------------------------------------------------------------------------
   The page works without this script: the names are static markup and hover
   still reddens them. The script adds three things:
     1. passing across a name (or tapping it) marks it, and marks persist;
     2. the stain: a small GPU simulation of liquid wicking through stone;
     3. the tally.
   --------------------------------------------------------------------------- */
(function(){
'use strict';
var doc = document;
var sec = doc.querySelector('#memorial');
if(!sec) return;
var root = sec, field = sec.querySelector('.field'), tallyEl = sec.querySelector('.tally');
var sectionVisible = false;
if(!sec || !field) return;
root.classList.add('js');

var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var marked = [], firstEl = null, bleed = null;

/* ---------------------------------------------------------------- marks */

var tallyT = 0;
function tally(){
  /* One announcement after a sweep, rather than speaking every crossed name. */
  clearTimeout(tallyT);
  tallyT = setTimeout(function(){
    var n = marked.length;
    tallyEl.textContent = 'You have touched ' + n.toLocaleString('en-US') + (n === 1 ? ' name' : ' names');
    tallyEl.setAttribute('data-on', '');
  }, 180);
}

function mark(el){
  if(!el || el.hasAttribute('data-m')) return;
  var first = !firstEl;
  if(first){ firstEl = el; el.setAttribute('data-first', ''); root.classList.add('touched'); }
  marked.push(el);
  if(reduce){
    el.setAttribute('data-m', '2');
  } else {
    el.setAttribute('data-m', '1');
    var f = el.cloneNode(true);
    f.className = 'fill';
    f.removeAttribute('data-m'); f.removeAttribute('data-first');
    ['role','tabindex','data-record','title'].forEach(function(k){ f.removeAttribute(k); });
    f.setAttribute('aria-hidden', 'true');
    el.appendChild(f);
    setTimeout(function(){
      el.setAttribute('data-m', '2');
      if(f.parentNode) f.parentNode.removeChild(f);
    }, first ? 300 : 240);
  }
  setTimeout(function(){ el.setAttribute('data-dry', ''); }, reduce ? 0 : (first ? 9000 : 6500));
  tally();
  if(bleed) bleed.seed(el, first, false);
}

/* No dwell: a passing pointer leaves blood in every name it crosses.
   Sample between events as well, so quick sweeps do not skip names. */
var previousPointer = null;
function nameOf(t){ return t && t.closest ? t.closest('.n') : null; }
function isHoverPointer(e){ return !e.pointerType || e.pointerType === 'mouse' || e.pointerType === 'pen'; }
function resetPointer(){ previousPointer = null; }

field.addEventListener('pointerover', function(e){
  if(isHoverPointer(e)) mark(nameOf(e.target));
});
field.addEventListener('pointermove', function(e){
  if(!isHoverPointer(e)) return;
  var points = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  if(!points.length) points = [e];
  points.forEach(function(p){
    if(previousPointer){
      var dx = p.clientX - previousPointer.x, dy = p.clientY - previousPointer.y;
      var steps = Math.min(240, Math.ceil(Math.hypot(dx, dy)/8));
      for(var i = 1; i <= steps; i++){
        var hit = nameOf(doc.elementFromPoint(previousPointer.x + dx*i/steps, previousPointer.y + dy*i/steps));
        if(hit && field.contains(hit)) mark(hit);
      }
    }
    previousPointer = { x:p.clientX, y:p.clientY };
  });
  mark(nameOf(e.target));
});
field.addEventListener('pointerleave', resetPointer);
field.addEventListener('pointercancel', resetPointer);
window.addEventListener('scroll', resetPointer, { passive:true });
window.addEventListener('blur', resetPointer);
window.addEventListener('resize', resetPointer);
/* a tap, or a deliberate click. click (not pointerdown) so that a scroll
   that happens to start on a name does not mark it */
field.addEventListener('click', function(e){ var n=nameOf(e.target);mark(n);if(n)showRecord(n); });
field.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){var n=nameOf(e.target);if(n){e.preventDefault();mark(n);showRecord(n);}}});

/* a hook for testing and for the host page */
window.memorialWall = {
  mark: function(i){ mark(field.children[i]); },
  count: function(){ return marked.length; }
};

var dialog=sec.querySelector('dialog'), title=dialog.querySelector('.record-title'), body=dialog.querySelector('.record-body'), dataPromise, recordRequest=0;
dialog.querySelector('.record-close').addEventListener('click',function(){dialog.close();});
dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
function records(){if(!dataPromise)dataPromise=Promise.resolve().then(function(){var embedded=doc.getElementById('memorial-records');return embedded?JSON.parse(embedded.textContent):fetch(sec.dataset.recordsUrl).then(function(r){if(!r.ok)throw Error('load');return r.json();});}).then(function(d){return new Map(d.records.map(function(r){return[r.id,r];}));}).catch(function(e){dataPromise=null;throw e;});return dataPromise;}
function para(text,cls){var p=doc.createElement('p');p.textContent=text;if(cls)p.className=cls;body.appendChild(p);return p;}
function showRecord(el){var request=++recordRequest;title.textContent=el.dataset.name;body.replaceChildren();para('Loading source record…');if(!dialog.open){var y=window.scrollY;dialog.showModal();window.scrollTo({top:y,left:0,behavior:'instant'});}records().then(function(map){if(request!==recordRequest)return;var r=map.get(el.dataset.record);if(!r)throw Error('record');body.replaceChildren();title.textContent=r.name_en||r.name_fa;if(r.name_fa&&r.name_en){var fa=para(r.name_fa,'record-fa');fa.lang='fa';fa.dir='rtl';}if(r.age!==null)para('Age '+r.age);else if(r.age_conflict)para('Age omitted because the documenting sources disagree.');if(r.date)para('Reported date: '+r.date);if(r.location)para('Reported location: '+r.location);if(r.partial_name)para('The source publishes a partial identity.');para('Documenting sources');var ul=doc.createElement('ul');r.sources.forEach(function(s){var li=doc.createElement('li'),a=doc.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=s.publisher+(s.source_id?' · '+s.source_id:'');li.appendChild(a);ul.appendChild(li);});body.appendChild(ul);para('These are source-based memorial records, not an independently verified death toll.');}).catch(function(){if(request===recordRequest){body.replaceChildren();para('The source record could not load. Please retry, or use the downloadable list below.');}});}
/* ---------------------------------------------------------------- stone */

var GLSL_NOISE = [
'uint ih(uvec2 v){',
'  v = v*1664525u + 1013904223u;',
'  v.x += v.y*1664525u; v.y += v.x*1664525u; v ^= v>>16u;',
'  v.x += v.y*1664525u; v.y += v.x*1664525u; v ^= v>>16u;',
'  return v.x ^ v.y; }',
'vec2 gr(ivec2 i){ float a = float(ih(uvec2(i + 65536)))*(6.2831853/4294967296.0); return vec2(cos(a), sin(a)); }',
'float gn(vec2 p){',
'  ivec2 i = ivec2(floor(p)); vec2 f = fract(p);',
'  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);',
'  float a = dot(gr(i), f);',
'  float b = dot(gr(i+ivec2(1,0)), f-vec2(1,0));',
'  float c = dot(gr(i+ivec2(0,1)), f-vec2(0,1));',
'  float d = dot(gr(i+ivec2(1,1)), f-vec2(1,1));',
'  return 1.45*mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }',
'float fbm(vec2 p, int o){',
'  float s = 0.0, a = 0.5; mat2 R = mat2(0.8,0.6,-0.6,0.8);',
'  for(int i=0;i<6;i++){ if(i>=o) break; s += a*gn(p); p = R*p*2.03 + 11.7; a *= 0.5; }',
'  return s; }',
/* how readily a point in the stone takes up liquid: pores, strata, veins */
'float perm(vec2 P){',
'  float k = 0.16 + 0.84*smoothstep(-0.4, 0.45, fbm(P*0.045, 4));',
'  k *= 0.7 + 0.3*smoothstep(-0.45, 0.55, gn(P*vec2(0.012, 0.05) + 7.0));',
'  k *= 0.82 + 0.18*gn(P*0.22 + 3.0);',
'  return clamp(k, 0.08, 1.0); }'
].join('\n');

var VS = '#version 300 es\nvoid main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }';

var FS_PERM = '#version 300 es\nprecision highp float; precision highp int;\n' + GLSL_NOISE + '\n' +
'uniform vec3 uSim; out vec4 o;\n' +
'void main(){ vec2 P = uSim.xy + gl_FragCoord.xy*uSim.z; o = vec4(perm(P), 0.0, 0.0, 1.0); }';

/* one step of the soak: water moves to drier, more porous neighbours above a
   capillary threshold (so the front pins instead of fading forever), a little
   more readily downward, is drawn into the stone as it goes, and leaves its
   pigment behind where it is absorbed. state = (water, pigment carried,
   pigment deposited, oxidation 0..1) */
var FS_STEP = '#version 300 es\nprecision highp float; precision highp int;\n' + GLSL_NOISE + '\n' +
'uniform sampler2D uS; uniform sampler2D uK; uniform ivec2 uSize;\n' +
'uniform float uDt; uniform float uOx;\n' +
'uniform vec4 uSeed[32]; uniform float uAmt[32]; uniform int uN;\n' +
'out vec4 o;\n' +
'const float D = 0.205; const float G = 0.05;\n' +
'float phi(float w){ return w*smoothstep(0.028, 0.095, w); }\n' +
'vec4 S(ivec2 p){ return texelFetch(uS, clamp(p, ivec2(0), uSize-1), 0); }\n' +
'float K(ivec2 p){ return texelFetch(uK, clamp(p, ivec2(0), uSize-1), 0).r; }\n' +
'void main(){\n' +
'  ivec2 p = ivec2(gl_FragCoord.xy);\n' +
'  vec4 c = S(p); float kc = K(p);\n' +
'  vec2 q = vec2(p) + 0.5; float inj = 0.0;\n' +
'  for(int i=0;i<32;i++){ if(i>=uN) break; vec4 r = uSeed[i];\n' +
'    vec2 e = min(q - r.xy, r.zw - q);\n' +
'    inj += uAmt[i]*smoothstep(-0.5, 1.6, min(e.x, e.y))*(0.25 + 1.5*smoothstep(-0.5, 0.6, gn(q*0.18 + r.xy*0.731))); }\n' +
'  inj *= 0.45 + 0.75*kc;\n' +
'  float pc = phi(c.r), qc = c.g/max(c.r, 1e-4);\n' +
'  float fw = 0.0, fp = 0.0;\n' +
'  ivec2 nb[4] = ivec2[4](ivec2(1,0), ivec2(-1,0), ivec2(0,1), ivec2(0,-1));\n' +
'  for(int i=0;i<4;i++){ ivec2 pn = p + nb[i]; vec4 s = S(pn);\n' +
'    float F = D*min(kc, K(pn))*(phi(s.r) - pc);\n' +
'    fw += F; fp += F*(F > 0.0 ? s.g/max(s.r, 1e-4) : qc); }\n' +
'  ivec2 pu = p + ivec2(0,-1), pd = p + ivec2(0,1); vec4 su = S(pu);\n' +
'  float Fu = G*min(kc, K(pu))*phi(su.r), Fd = G*min(kc, K(pd))*pc;\n' +
'  fw += Fu - Fd; fp += Fu*(su.g/max(su.r, 1e-4)) - Fd*qc;\n' +
'  float w = max(c.r + fw + inj, 0.0), pg = max(c.g + fp + inj, 0.0);\n' +
'  float w2 = max(w - (w*0.0026*(0.6 + 0.6*kc) + 0.0006), 0.0);\n' +
'  float dep = w > 1e-5 ? pg*clamp((w - w2)/w + 0.003, 0.0, 1.0) : pg;\n' +
'  if(w2 < 1e-4){ w2 = 0.0; dep = pg; }\n' +
'  float d = c.b + dep; pg -= dep;\n' +
'  float a = c.a;\n' +
'  if(d > 0.002) a = min(1.0, a + uDt*uOx*(w2 < 0.015 ? 1.0 : 0.22));\n' +
'  o = vec4(w2, pg, d, a);\n' +
'}';

var FS_COPY = '#version 300 es\nprecision highp float; uniform sampler2D uS; out vec4 o;\n' +
'void main(){ o = texelFetch(uS, ivec2(gl_FragCoord.xy), 0); }';

/* the wall itself, and whatever has soaked into it */
var FS_RENDER = '#version 300 es\nprecision highp float; precision highp int;\n' + GLSL_NOISE + '\n' +
'uniform vec2 uOrigin; uniform float uScale; uniform float uCanvasH;\n' +
'uniform vec3 uSim; uniform vec2 uSimSize; uniform sampler2D uS; uniform float uHasSim;\n' +
'out vec4 o;\n' +
'void main(){\n' +
'  vec2 P = uOrigin + vec2(gl_FragCoord.x, uCanvasH - gl_FragCoord.y)/uScale;\n' +
/* limestone, close to travertine: a warm slab tone that drifts over metres,
   mottling, tooth, faint strata, and small elongated pits along the strata */
'  float broad = fbm(P*0.0009, 4);\n' +
'  float mott  = fbm(P*0.0055 + 17.0, 4);\n' +
'  float tooth = gn(P*0.62)*0.55 + gn(P*1.45 + 3.0)*0.45;\n' +
'  float warp  = fbm(P*vec2(0.0013, 0.0042) + 3.0, 3);\n' +
'  float strata = 0.5 + 0.5*sin(P.y*0.0105 + warp*7.0);\n' +
'  float pitN = gn(P*vec2(0.05, 0.19) + 40.0);\n' +
'  float pitZ = smoothstep(-0.1, 0.7, fbm(P*0.0045 + 9.0, 2));\n' +
'  float pit = smoothstep(0.52, 0.78, pitN)*pitZ;\n' +
'  float pitLip = smoothstep(0.52, 0.78, gn((P + vec2(0.0, -1.2))*vec2(0.05, 0.19) + 40.0))*pitZ;\n' +
'  vec3 cool = vec3(0.952, 0.940, 0.918);\n' +
'  vec3 warm = vec3(0.945, 0.927, 0.893);\n' +
'  vec3 col = mix(cool, warm, smoothstep(-0.45, 0.5, broad));\n' +
'  col *= 1.0 + mott*0.02 + tooth*0.013 - strata*0.012;\n' +
'  col = mix(col, col*vec3(0.86, 0.84, 0.81), pit*0.55);\n' +
'  col += max(pitLip - pit, 0.0)*0.025;\n' +
'  if(uHasSim > 0.5){\n' +
'    vec2 sc = (P - uSim.xy)/uSim.z; vec2 uv = sc/uSimSize;\n' +
'    if(uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0){\n' +
'      vec2 t = 1.0/uSimSize;\n' +
'      vec4 s  = texture(uS, uv);\n' +
'      vec4 sl = texture(uS, uv - vec2(t.x, 0.0)), sr = texture(uS, uv + vec2(t.x, 0.0));\n' +
'      vec4 su = texture(uS, uv - vec2(0.0, t.y)), sd = texture(uS, uv + vec2(0.0, t.y));\n' +
'      float dens = s.b + s.g*0.85;\n' +
'      if(dens > 0.0004){\n' +
'        float k = perm(P);\n' +
'        float rough = gn(P*0.31 + 5.0)*0.5 + gn(P*0.9)*0.25;\n' +
/* a defined boundary with the stone's own roughness, not a blur */
'        float dr = dens*(1.0 + 0.5*rough);\n' +
'        float cover = smoothstep(0.010, 0.017, dr);\n' +
/* the tide line: where the liquid stopped, it left more behind */
'        float tide = smoothstep(0.010, 0.02, dr)*(1.0 - smoothstep(0.02, 0.075, dr));\n' +
'        float edge = clamp(length(vec2(sr.b - sl.b, sd.b - su.b))*2.0, 0.0, 1.0);\n' +
'        float amt = 1.0 - exp(-dens*2.6);\n' +
'        amt = (amt*(0.5 + 0.65*k)*(1.0 + 0.2*rough)*(1.0 + 0.6*edge) + tide*0.2)*(1.0 + pit*0.4)*cover;\n' +
'        float ox = smoothstep(0.0, 1.0, s.a);\n' +
'        vec3 sigF = vec3(0.60, 2.80, 2.50);\n' +
'        vec3 sigD = vec3(0.85, 1.60, 1.85);\n' +
'        col *= exp(-mix(sigF, sigD, ox)*amt);\n' +
/* while it is still wet: darker, with a faint sheen from above */
'        float wet = smoothstep(0.02, 0.14, s.r);\n' +
'        vec3 nrm = normalize(vec3(-(sr.r - sl.r)*5.0, -(sd.r - su.r)*5.0, 1.0));\n' +
'        vec3 Hh = normalize(normalize(vec3(-0.35, -0.6, 0.72)) + vec3(0.0, 0.0, 1.0));\n' +
'        float spec = pow(max(dot(nrm, Hh), 0.0), 46.0)*wet;\n' +
'        col *= 1.0 - wet*0.16;\n' +
'        col += spec*0.16*vec3(1.0, 0.94, 0.92);\n' +
'      }\n' +
'    }\n' +
'  }\n' +
'  o = vec4(col, 1.0);\n' +
'}';

function Bleed(){
  var cv = doc.createElement('canvas');
  var g = cv.getContext('webgl2', { alpha:false, depth:false, stencil:false, antialias:false,
                                    premultipliedAlpha:false, preserveDrawingBuffer:false });
  if(!g) throw new Error('no webgl2');
  if(!(g.getExtension('EXT_color_buffer_float') || g.getExtension('EXT_color_buffer_half_float')))
    throw new Error('no float targets');

  function prog(fs){
    var p = g.createProgram();
    [[g.VERTEX_SHADER, VS], [g.FRAGMENT_SHADER, fs]].forEach(function(s){
      var sh = g.createShader(s[0]); g.shaderSource(sh, s[1]); g.compileShader(sh);
      if(!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh));
      g.attachShader(p, sh);
    });
    g.linkProgram(p);
    if(!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
    var u = {}, n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
    for(var i = 0; i < n; i++){ var nm = g.getActiveUniform(p, i).name.replace('[0]', ''); u[nm] = g.getUniformLocation(p, nm); }
    return { p:p, u:u };
  }
  var P_PERM = prog(FS_PERM), P_STEP = prog(FS_STEP), P_COPY = prog(FS_COPY), P_RENDER = prog(FS_RENDER);
  g.bindVertexArray(g.createVertexArray());
  g.disable(g.DEPTH_TEST); g.disable(g.BLEND);

  function tex(w, h, ifmt, fmt, type, filt){
    var t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
    g.texImage2D(g.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filt);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filt);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    var f = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, f);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
    if(g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw new Error('fbo');
    return { t:t, f:f };
  }

  var SPS = 90;                       /* simulation steps per second       */
  var CH = 640;                       /* css px per stone band             */
  var maxTex = Math.min(g.getParameter(g.MAX_TEXTURE_SIZE), 8192);
  var L = null;                       /* layout: sizes, textures, bands    */
  var seeds = [], bands = [], chunks = [], cur = 0, simT = 0, acc = 0, raf = 0, last = 0, frameNo = 0;
  var io = null;

  function free(){
    if(!L) return;
    [L.A, L.B, L.K].forEach(function(x){ g.deleteTexture(x.t); g.deleteFramebuffer(x.f); });
    if(io) io.disconnect();
    chunks.forEach(function(c){ if(c.el.parentNode) c.el.parentNode.removeChild(c.el); });
    chunks = []; seeds = []; bands = []; L = null;
  }

  function layout(){
    free();
    var sr = sec.getBoundingClientRect(), fr = field.getBoundingClientRect();
    var W = sec.clientWidth, H = sec.scrollHeight, M = 80;
    var sx = fr.left - sr.left - M, sy = fr.top - sr.top - M;
    var sw = fr.width + 2*M, sh = fr.height + 2*M;
    var cell = Math.max(2, Math.ceil(sh/(maxTex - 4)), Math.ceil(sw/(maxTex - 4)));
    var cols = Math.ceil(sw/cell), rows = Math.ceil(sh/cell);
    var scale = Math.min(window.devicePixelRatio || 1, W > 1600 ? 1.25 : 1.5);
    L = { W:W, H:H, sx:sx, sy:sy, cell:cell, cols:cols, rows:rows, scale:scale,
          pw:Math.round(W*scale), ph:Math.round(CH*scale) };
    L.A = tex(cols, rows, g.RGBA16F, g.RGBA, g.HALF_FLOAT, g.LINEAR);
    L.B = tex(cols, rows, g.RGBA16F, g.RGBA, g.HALF_FLOAT, g.LINEAR);
    L.K = tex(cols, rows, g.R8, g.RED, g.UNSIGNED_BYTE, g.NEAREST);
    cur = 0;

    g.bindFramebuffer(g.FRAMEBUFFER, L.K.f); g.viewport(0, 0, cols, rows);
    g.disable(g.SCISSOR_TEST);
    g.useProgram(P_PERM.p); g.uniform3f(P_PERM.u.uSim, sx, sy, cell);
    g.drawArrays(g.TRIANGLES, 0, 3);

    cv.width = L.pw; cv.height = L.ph;

    var layer = sec.querySelector('.stone');
    var n = Math.ceil(H/CH);
    io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var c = chunks[+e.target.dataset.i];
        if(e.isIntersecting){ if(!c.live){ c.live = true; c.el.width = L.pw; c.el.height = c.ph; paint(c, 0, c.y, L.W, c.h); } }
        else if(c.live){ c.live = false; c.el.width = 0; c.el.height = 0; }
      });
    }, { rootMargin:'700px 0px' });
    for(var i = 0; i < n; i++){
      var h = Math.min(CH, H - i*CH);
      var el = doc.createElement('canvas');
      el.dataset.i = i; el.width = 0; el.height = 0;
      el.style.top = (i*CH) + 'px'; el.style.height = h + 'px';
      layer.appendChild(el);
      var c = { el:el, ctx:el.getContext('2d', { alpha:false }), y:i*CH, h:h, ph:Math.round(h*L.scale), live:false };
      chunks.push(c); io.observe(el);
    }
  }

  /* render a rectangle of the wall (section css px) into one band's canvas */
  function paint(c, x, y, w, h){
    var s = L.scale;
    var x0 = Math.max(0, Math.floor(x*s)), y0 = Math.max(0, Math.floor((y - c.y)*s));
    var x1 = Math.min(L.pw, Math.ceil((x + w)*s)), y1 = Math.min(c.ph, Math.ceil((y + h - c.y)*s));
    if(x1 <= x0 || y1 <= y0) return;
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, L.ph - c.ph, L.pw, c.ph);
    g.enable(g.SCISSOR_TEST);
    g.scissor(x0, L.ph - y1, x1 - x0, y1 - y0);
    var u = P_RENDER.u; g.useProgram(P_RENDER.p);
    g.uniform2f(u.uOrigin, 0, c.y);
    g.uniform1f(u.uScale, s);
    g.uniform1f(u.uCanvasH, L.ph);
    g.uniform3f(u.uSim, L.sx, L.sy, L.cell);
    g.uniform2f(u.uSimSize, L.cols, L.rows);
    g.uniform1f(u.uHasSim, 1);
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, (cur ? L.B : L.A).t);
    g.uniform1i(u.uS, 0);
    g.drawArrays(g.TRIANGLES, 0, 3);
    c.ctx.drawImage(cv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  }

  var seedRect = new Float32Array(128), seedAmt = new Float32Array(32);
  function ease(u){ u = Math.min(Math.max(u, 0), 1); return 1 - Math.pow(1 - u, 2.3); }

  function step(ox){
    var dt = 1/SPS; simT += dt;
    var n = 0, keep = [];
    for(var i = 0; i < seeds.length; i++){
      var sd = seeds[i], target = sd.q*ease((simT - sd.t0)/sd.dur), a = target - sd.sent;
      /* Keep unsent pigment if a fast sweep exceeds this shader batch. */
      if(a > 0 && n < 32){ seedRect.set(sd.r, n*4); seedAmt[n] = a; n++; sd.sent = target; }
      if(simT - sd.t0 < sd.dur || sd.sent < sd.q - 1e-7) keep.push(sd);
    }
    seeds = keep;
    var src = cur ? L.B : L.A, dst = cur ? L.A : L.B;
    g.bindFramebuffer(g.FRAMEBUFFER, dst.f);
    g.viewport(0, 0, L.cols, L.rows);
    g.enable(g.SCISSOR_TEST);
    var u = P_STEP.u; g.useProgram(P_STEP.p);
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, src.t); g.uniform1i(u.uS, 0);
    g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, L.K.t); g.uniform1i(u.uK, 1);
    g.uniform2i(u.uSize, L.cols, L.rows);
    g.uniform1f(u.uDt, dt); g.uniform1f(u.uOx, ox || 1/22);
    g.uniform4fv(u.uSeed, seedRect); g.uniform1fv(u.uAmt, seedAmt); g.uniform1i(u.uN, n);
    for(var b = 0; b < bands.length; b++){ var r = bands[b].c; g.scissor(r[0], r[1], r[2], r[3]); g.drawArrays(g.TRIANGLES, 0, 3); }
    cur = 1 - cur;
  }

  /* a band has finished changing: make both buffers agree there, so the
     ping-pong never resurrects an older frame */
  function settle(bd){
    var src = cur ? L.B : L.A, dst = cur ? L.A : L.B, r = bd.c;
    g.bindFramebuffer(g.FRAMEBUFFER, dst.f); g.viewport(0, 0, L.cols, L.rows);
    g.enable(g.SCISSOR_TEST); g.scissor(r[0], r[1], r[2], r[3]);
    g.useProgram(P_COPY.p);
    g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, src.t); g.uniform1i(P_COPY.u.uS, 0);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  function frame(ts){
    raf = 0;
    if(!L || !sectionVisible || document.hidden){ last=0; return; }
    var dt = last ? Math.min((ts - last)/1000, 0.05) : 1/60; last = ts; frameNo++;
    acc = Math.min(acc + dt*SPS, 4);
    var k = Math.floor(acc); acc -= k;
    for(var i = 0; i < k; i++) step();
    var live = [];
    for(var b = 0; b < bands.length; b++){
      var bd = bands[b];
      if(simT > bd.end){ settle(bd); bd.done = true; }
      else live.push(bd);
    }
    var fresh = bands.filter(function(bd){ return simT - bd.t0 < 11; }).length > 0;
    if(fresh || frameNo % 5 === 0){
      bands.forEach(function(bd){
        chunks.forEach(function(c){
          if(c.live && bd.y + bd.h > c.y && bd.y < c.y + c.h) paint(c, bd.x, bd.y, bd.w, bd.h);
        });
      });
    }
    bands = live;
    if(bands.length) raf = requestAnimationFrame(frame); else last = 0;
  }

  /* Neighbouring names share one simulation/paint area. A sweep must not
     redraw the same patch once for every name it touched. */
  function addBand(bd){
    for(var i = 0; i < bands.length; i++){
      var a = bands[i].c, b = bd.c;
      if(a[0] > b[0] + b[2] || b[0] > a[0] + a[2] ||
         a[1] > b[1] + b[3] || b[1] > a[1] + a[3]) continue;
      var x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
      bd.c = [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x,
                    Math.max(a[1] + a[3], b[1] + b[3]) - y];
      bd.t0 = Math.max(bd.t0, bands[i].t0);
      bd.end = Math.max(bd.end, bands[i].end);
      bands.splice(i, 1); i = -1;
    }
    bd.x = L.sx + bd.c[0]*L.cell; bd.y = L.sy + bd.c[1]*L.cell;
    bd.w = bd.c[2]*L.cell; bd.h = bd.c[3]*L.cell;
    bands.push(bd);
  }

  function seed(el, first, quick){
    if(!L) return;
    var sr = sec.getBoundingClientRect(), r = el.getBoundingClientRect(), C = L.cell;
    var z = (parseFloat(getComputedStyle(field).fontSize) || 14.5)/14.5;
    var x0 = (r.left - sr.left - L.sx)/C, y0 = (r.top - sr.top - L.sy)/C;
    var x1 = (r.right - sr.left - L.sx)/C, y1 = (r.bottom - sr.top - L.sy)/C;
    /* inject into the band of the letters, not the line box */
    var hh = y1 - y0; y0 += hh*0.16; y1 -= hh*0.12;
    /* The first name still wells wider, but no longer asks for a pause. */
    if(first){ x0 -= 7*z/C; x1 += 7*z/C; y0 -= 3*z/C; y1 += 7*z/C; }
    var q = (first ? 2.3 : 0.85)*(2/C)*(2/C)*z*z;
    seeds.push({ r:[x0, y0, x1, y1], q:q, sent:0, t0:simT, dur:quick ? 0.12 : (first ? 0.28 : 0.18) });
    var mx = (first ? 120 : 66)*z/C, up = (first ? 96 : 54)*z/C, dn = (first ? 190 : 118)*z/C;
    var bx = Math.max(0, Math.floor(x0 - mx)), by = Math.max(0, Math.floor(y0 - up));
    var bx1 = Math.min(L.cols, Math.ceil(x1 + mx)), by1 = Math.min(L.rows, Math.ceil(y1 + dn));
    var bd = { c:[bx, by, bx1 - bx, by1 - by], t0:simT, end:simT + 52,
               x:L.sx + bx*C, y:L.sy + by*C, w:(bx1 - bx)*C, h:(by1 - by)*C };
    addBand(bd);
    if(quick) return;
    if(!raf) raf = requestAnimationFrame(frame);
  }

  function restore(){
    /* Rebuild all persistent marks together after reflow, not 800 steps
       separately for each name in a long sweep. */
    marked.forEach(function(el){ seed(el, el === firstEl, true); });
    if(!bands.length) return;
    for(var i = 0; i < 800; i++) step(1/4);
    bands.forEach(function(bd){
      settle(bd);
      chunks.forEach(function(c){
        if(c.live && bd.y + bd.h > c.y && bd.y < c.y + c.h) paint(c, bd.x, bd.y, bd.w, bd.h);
      });
    });
    bands = []; seeds = []; last = 0;
  }

  var lastW = 0, lastH = 0, rz = 0;
  function relayout(){
    lastW = sec.clientWidth; lastH = sec.scrollHeight;
    layout();
    /* reflowed names: the stains are re-formed under them, already dry */
    restore();
  }
  window.addEventListener('resize', function(){
    clearTimeout(rz);
    rz = setTimeout(function(){
      if(sec.clientWidth !== lastW || Math.abs(sec.scrollHeight - lastH) > 2) relayout();
    }, 220);
  });
  cv.addEventListener('webglcontextlost', function(e){ e.preventDefault(); free(); bleed = null; root.classList.add('no-gl'); });

  lastW = sec.clientWidth; lastH = sec.scrollHeight;
  layout();
  return { seed:seed, relayout:relayout, restore:restore, resume:function(){ if(bands.length&&!raf)raf=requestAnimationFrame(frame); } };
}

function start(){
  /* Static stains for reduced motion; avoid running a soak per crossed name. */
  if(reduce){ root.classList.add('no-gl'); return; }
  try { bleed = Bleed(); }
  catch(err){ root.classList.add('no-gl'); bleed = null; if(window.console) console.warn('memorial: no WebGL stain', err); return; }
  /* anything marked before the GPU was ready */
  bleed.restore();
}
var didStart=false;
function visible(on){sectionVisible=on;tallyEl.classList.toggle('is-away',!on);if(on){if(!didStart){didStart=true;if(doc.fonts&&doc.fonts.ready)doc.fonts.ready.then(start,start);else start();}else if(bleed)bleed.resume();}}
if('IntersectionObserver' in window)new IntersectionObserver(function(es){visible(es[0].isIntersecting);},{rootMargin:'300px 0px'}).observe(sec);else visible(true);
doc.addEventListener('visibilitychange',function(){if(!doc.hidden&&sectionVisible&&bleed)bleed.resume();});
})();
