# Original-art floral opening

The homepage now progressively enhances one original floral composition. It no longer requests the procedural `scenes/floral.html` iframe. The historic standalone experiment remains available by direct URL.

`floral-spatial.js` renders five relief meshes using the original artwork, depth estimated offline, and color extended into occluded margins. This is a layered photo scene, not a complete reconstructed 3D garden. It preserves the wordmark plane and bounds camera travel to avoid exposing unsupported views.

The opening has a fixed 5.2-second first-visit timeline and an immediate Enter button. Replay stays open until Enter or Escape. The next rug scene begins loading after 1.8 seconds, remains paused behind the opening, and resumes after exit. Opening GPU resources are released after the fade. Reduced motion uses the original still and exits after 1.3 seconds.

Mouse movement, touch dragging, and opt-in orientation input drive the view. Desktop rendering is capped at 60fps/1.8 million pixels; mobile at 30fps/1 million pixels. These are ceilings, not measured device guarantees. The two image sets total approximately 603KiB desktop or 392KiB mobile for color layers, plus the depth maps and 327KiB original poster. No browser AI model or third-party rendering library is required.

Validation on 2026-11-17: local Chromium desktop and emulated phone rendering; pointer and touch parallax; tilt-permission denial; reduced motion without layer requests; failed WebGL and context loss; fixed automatic exit; skip/replay/Escape; keyboard focus return; scroll lock; GPU disposal; no old floral iframe requests; actual rug ready after automatic opening exit; zero uncaught JavaScript errors. Physical-device motion and Safari were not tested.
