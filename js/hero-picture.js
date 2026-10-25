// The picture the home hero's gold dust gathers into: a polo shirt on a gold
// hanger (the hanger is the logo's). It is drawn procedurally onto a canvas as
// plain light and shade — brightness is all that matters, because js/hero-dust.js
// turns it into particles: the brighter a spot, the more dust lands there. So
// "folds" are darker lanes, the collar and buttons are bright, the hanger is the
// brightest line of all.
//
// To use a photo instead (a mannequin in your own clothes, your logo, anything on
// a dark background), put the image in /assets and set data-hero-image on the
// hero in index.html — see README.md. This drawing is only the default.

export const PIC_W = 360;
export const PIC_H = 480;

const mirror = (x) => PIC_W - x; // mirror about the vertical centre line

// a polygon with softened corners: the path starts at the middle of the last
// edge and rounds every vertex with arcTo
function roundedPoly(points, radius) {
  const p = new Path2D();
  const n = points.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[n - 1], points[0]);
  p.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const b = points[i];
    const m = mid(b, points[(i + 1) % n]);
    p.arcTo(b[0], b[1], m[0], m[1], radius);
  }
  p.closePath();
  return p;
}

// curve([x0, y0], [x, y] | [qx, qy, x, y] | [c1x, c1y, c2x, c2y, x, y], …) -> Path2D
function curve(...pts) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const s = pts[i];
    if (s.length === 6) p.bezierCurveTo(...s);
    else if (s.length === 4) p.quadraticCurveTo(...s);
    else p.lineTo(s[0], s[1]);
  }
  return p;
}

// A soft brush, the same in every browser: the shape is drawn far off the
// canvas and only its blurred shadow lands on it (shadow offsets ignore the
// transform). `paint` fills or strokes with any opaque colour; `color` is the
// shadow's — i.e. what actually shows up — and its alpha is the strength.
const FAR = 4000;
function soft(ctx, blur, color, paint) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = FAR;
  ctx.shadowOffsetY = 0;
  ctx.translate(-FAR, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  paint();
  ctx.restore();
}
const softLine = (ctx, path, width, blur, color) =>
  soft(ctx, blur, color, () => {
    ctx.lineWidth = width;
    ctx.strokeStyle = '#000';
    ctx.stroke(path);
  });
const softFill = (ctx, path, blur, color) =>
  soft(ctx, blur, color, () => {
    ctx.fillStyle = '#000';
    ctx.fill(path);
  });

export function drawPicture(ctx) {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, PIC_W, PIC_H);

  /* ---- the shirt's outline ------------------------------------------------ */
  // (the sleeves hang against the body, so there is no armpit gap to cut in)
  const outline = [
    [158, 120], [80, 150], [46, 222], [106, 250], // left shoulder and sleeve
    [100, 398], [180, 414], [260, 398], // body and hem
    [mirror(106), 250], [mirror(46), 222], [mirror(80), 150], [mirror(158), 120]
  ];
  const body = roundedPoly(outline, 10);

  /* ---- the fabric: light from the upper left ------------------------------- */
  let g = ctx.createLinearGradient(60, 0, 300, 0);
  g.addColorStop(0, '#e2e2e2');
  g.addColorStop(0.3, '#bababa');
  g.addColorStop(0.58, '#868686');
  g.addColorStop(0.82, '#525252');
  g.addColorStop(1, '#383838');
  ctx.fillStyle = g;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);

  // lighter across the shoulders and chest, darker down toward the hem
  g = ctx.createLinearGradient(0, 118, 0, 414);
  g.addColorStop(0, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.1)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 100, PIC_W, 330);

  // chest highlight
  g = ctx.createRadialGradient(146, 226, 6, 146, 226, 150);
  g.addColorStop(0, 'rgba(255,255,255,0.36)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 100, PIC_W, 330);

  // sleeves: shadowed on the underside, a light edge along the top
  softLine(ctx, curve([70, 186], [82, 206, 90, 226, 94, 246]), 16, 14, 'rgba(0,0,0,0.42)');
  softLine(ctx, curve([mirror(70), 186], [mirror(82), 206, mirror(90), 226, mirror(94), 246]), 16, 14, 'rgba(0,0,0,0.58)');
  softLine(ctx, curve([86, 160], [70, 190, 60, 208, 54, 224]), 7, 6, 'rgba(255,255,255,0.28)');

  // armpit shadows
  for (const [x, a] of [[116, 0.4], [mirror(116), 0.56]]) {
    g = ctx.createRadialGradient(x, 218, 2, x, 218, 50);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 54, 170, 108, 100);
  }

  // folds: broad dark lanes drooping from the armholes and bunching toward the
  // hem, each with a lighter ridge beside it. Wide and blurred on purpose —
  // as dust they read as fabric, not as stripes.
  const folds = [
    [[122, 232], [128, 270, 118, 314, 126, 372], 0.34, 15, 16],
    [[146, 262], [150, 300, 142, 340, 150, 392], 0.22, 11, 12],
    [[210, 250], [206, 290, 216, 334, 208, 388], 0.36, 14, 15],
    [[236, 236], [234, 282, 246, 326, 240, 384], 0.5, 16, 16],
    [[256, 262], [258, 300, 254, 346, 258, 394], 0.42, 10, 12]
  ];
  for (const [from, to, alpha, w, blur] of folds) {
    softLine(ctx, curve(from, to), w, blur, `rgba(0,0,0,${alpha})`);
    const side = from[0] < 180 ? 1 : -1;
    const off = side * (w * 0.9 + 6);
    const ridge = curve([from[0] + off, from[1]], [to[0] + off, to[1], to[2] + off, to[3], to[4] + off, to[5]]);
    softLine(ctx, ridge, w * 0.55, blur * 0.7, `rgba(255,255,255,${alpha * 0.45})`);
  }
  // a shallow crease across the belly
  softLine(ctx, curve([112, 334], [150, 346, 214, 340, 256, 326]), 8, 12, 'rgba(0,0,0,0.2)');

  // the hem: a soft dark band above the bright edge
  softLine(ctx, curve([104, 388], [180, 404, 180, 404, 256, 388]), 12, 12, 'rgba(0,0,0,0.5)');

  // a faint rim light along the shadow-side edges so the silhouette stays closed
  softLine(ctx, curve([mirror(104), 256], [mirror(100), 398]), 7, 5, 'rgba(255,255,255,0.4)');
  softLine(ctx, curve([mirror(80), 150], [mirror(46), 222]), 7, 5, 'rgba(255,255,255,0.4)');
  ctx.restore();

  /* ---- sleeve cuffs and hem edge ------------------------------------------ */
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgb(220,220,220)';
  ctx.stroke(curve([50, 221], [96, 244]));
  ctx.strokeStyle = 'rgb(160,160,160)';
  ctx.stroke(curve([mirror(50), 221], [mirror(96), 244]));
  ctx.strokeStyle = 'rgb(210,210,210)';
  ctx.lineWidth = 3.5;
  ctx.stroke(curve([102, 397], [180, 413, 180, 413, 258, 397]));

  /* ---- collar, placket, buttons, pocket ------------------------------------- */
  // back of the collar rising behind the neck
  ctx.strokeStyle = 'rgb(176,176,176)';
  ctx.lineWidth = 5;
  ctx.stroke(curve([150, 115], [180, 97, mirror(150), 115]));

  // the neck opening: a soft dark V
  softFill(ctx, roundedPoly([[171, 120], [189, 120], [180, 162]], 2), 4, 'rgba(0,0,0,0.9)');

  for (const side of [1, -1]) {
    const x = (v) => (side === 1 ? v : mirror(v));
    const flap = roundedPoly([[x(178), 124], [x(148), 110], [x(122), 150], [x(166), 162]], 5);
    // the flap casts a soft shadow on the shirt below it
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = side === 1 ? '#c8c8c8' : '#9c9c9c';
    ctx.fill(flap);
    ctx.restore();
    const fg = ctx.createLinearGradient(x(150), 110, x(140), 162);
    fg.addColorStop(0, side === 1 ? '#ffffff' : '#d8d8d8');
    fg.addColorStop(1, side === 1 ? '#b0b0b0' : '#7c7c7c');
    ctx.fillStyle = fg;
    ctx.fill(flap);
  }

  // placket: a band with a dark seam down the middle
  ctx.fillStyle = 'rgb(168,168,168)';
  ctx.fillRect(173, 162, 14, 236);
  softLine(ctx, curve([180, 162], [180, 398]), 2, 1.5, 'rgba(0,0,0,0.9)');
  // buttons: a bright dot in a dark ring
  for (let y = 190; y <= 380; y += 38) {
    ctx.beginPath();
    ctx.arc(180, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(22,22,22)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(180, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.fill();
  }

  // chest pocket on the lit side: stitched outline, bright top edge
  const pocket = roundedPoly([[118, 240], [158, 240], [158, 282], [138, 294], [118, 282]], 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill(pocket);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.stroke(pocket);
  ctx.strokeStyle = 'rgb(240,240,240)';
  ctx.lineWidth = 2.5;
  ctx.stroke(curve([120, 241], [157, 241]));

  /* ---- the hanger ----------------------------------------------------------- */
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgb(255,255,255)';
  ctx.lineWidth = 4.2;
  ctx.stroke(curve([180, 118], [80, 150])); // arms along the shoulders
  ctx.stroke(curve([180, 118], [mirror(80), 150]));
  ctx.lineWidth = 5;
  ctx.stroke(curve([180, 120], [180, 98], [180, 82, 198, 78, 199, 64], [200, 48, 182, 36, 167, 46])); // neck and hook
  ctx.restore();
}

// The picture as a canvas, ready for sampling. The size is fixed so the dust
// always maps the same way.
export function makePictureCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = PIC_W;
  canvas.height = PIC_H;
  drawPicture(canvas.getContext('2d', { willReadFrequently: true }));
  return canvas;
}

// A user's own image, fitted into the same box (contain, centred) on black.
export function drawImageFitted(canvas, img) {
  canvas.width = PIC_W;
  canvas.height = PIC_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, PIC_W, PIC_H);
  const s = Math.min(PIC_W / img.naturalWidth, PIC_H / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, (PIC_W - w) / 2, (PIC_H - h) / 2, w, h);
  return canvas;
}
