// CAD files in the browser: 2D drawings (DXF) to SVG / PNG / PDF, and 3D models (STL, OBJ, STEP, IGES) to STL / OBJ / PNG.
import { baseName, ext, canvasToBlob, makeCanvas, loadScript } from './util.js';

const DRAWING_EXT = ['dxf', 'dwg'];

export const isDrawing = (name) => DRAWING_EXT.includes(ext(name));

// ---------- 2D drawings ----------

// DWG is AutoCAD's closed format; LibreDWG (compiled to WebAssembly) rewrites it as a DXF that the rest can draw.
async function dwgToDxfBytes(file, progress) {
  progress?.('Starting the DWG reader…');
  const { LibreDwg } = await import('../vendor/libredwg/dist/libredwg-web.js');
  const lib = await LibreDwg.create(new URL('../vendor/libredwg/wasm', import.meta.url).href);
  progress?.('Reading the DWG file…', 0.2);
  let bytes = null;
  try {
    bytes = lib.dwg_write_dxf(await file.arrayBuffer());
  } catch { /* handled below */ }
  if (!bytes?.length) throw new Error("Couldn't read this DWG file. It may be damaged, or saved by a newer version of AutoCAD than this reader supports.");
  return bytes;
}

async function dxfToSvg(text, progress) {
  progress?.('Reading the drawing…', 0.3);
  const { Helper } = await import('../vendor/dxf.mjs');
  let svg;
  try {
    svg = new Helper(text).toSVG();
  } catch {
    throw new Error("Couldn't read this DXF file. It may be damaged or use an unsupported variant.");
  }
  return svg;
}

// Frames the picture on the geometry that is actually there (the file's own size header is often wrong or huge)
// and swaps white lines (CAD default on black) for black so they show on white paper.
function prepareSvg(svg) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of svg.matchAll(/\sd="([^"]+)"/g)) {
    for (const pt of path[1].matchAll(/(-?[\d.]+(?:e[+-]?\d+)?),(-?[\d.]+(?:e[+-]?\d+)?)/gi)) {
      const x = +pt[1], y = -pt[2]; // the drawing group is flipped vertically
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!(maxX >= minX)) throw new Error('This drawing has no visible shapes.');
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const pad = size * 0.03;
  const x = minX - pad, y = minY - pad;
  const w = maxX - minX + 2 * pad, h = maxY - minY + 2 * pad;
  const fixed = svg
    .replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${w} ${h}"`)
    .replace(/stroke="(#fff(?:fff)?|rgb\(255,\s*255,\s*255\))"/gi, 'stroke="#000000"')
    .replace(/width="100%" height="100%"/, 'width="100%" height="100%" style="background:#fff"');
  return { svg: fixed, w, h, x, y };
}

async function rasterize({ svg, w, h }, maxSide) {
  const scale = maxSide / Math.max(w, h);
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const sized = svg.replace('width="100%" height="100%"', `width="${width}" height="${height}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToPdf(canvas) {
  const { jsPDF } = window.jspdf;
  const landscape = canvas.width > canvas.height;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: landscape ? 'l' : 'p', compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 24;
  const k = Math.min((pw - 2 * margin) / canvas.width, (ph - 2 * margin) / canvas.height);
  const w = canvas.width * k;
  const h = canvas.height * k;
  const png = new Uint8Array(await (await canvasToBlob(canvas, 'image/png')).arrayBuffer());
  doc.addImage(png, 'PNG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST');
  return doc.output('blob');
}

async function convertDrawing(file, to, progress) {
  const name = baseName(file.name);
  let text;
  const isDwg = ext(file.name) === 'dwg';
  const caveat = isDwg ? ' DWG files are read by an open-source reader, so a few shape types (some curves, text) can be missing.' : '';
  if (isDwg) {
    const bytes = await dwgToDxfBytes(file, progress);
    if (to === 'dxf') return { outputs: [{ blob: new Blob([bytes], { type: 'application/dxf' }), name: `${name}.dxf` }], note: 'Rewritten as a DXF with the shapes and layers kept. Anything the reader could not decode is left out.' };
    text = new TextDecoder().decode(bytes);
  } else {
    text = await file.text();
  }
  const svgText = await dxfToSvg(text, progress);
  const prepared = prepareSvg(svgText);
  if (to === 'svg') {
    const sized = prepared.svg.replace('width="100%" height="100%"', `width="${Math.round(prepared.w)}" height="${Math.round(prepared.h)}"`);
    return { outputs: [{ blob: new Blob([sized], { type: 'image/svg+xml' }), name: `${name}.svg` }], note: `Lines and shapes only. Text labels and fills are not drawn.${caveat}` };
  }
  progress?.('Drawing the picture…', 0.5);
  const canvas = await rasterize(prepared, 3000);
  if (to === 'png') {
    return { outputs: [{ blob: await canvasToBlob(canvas, 'image/png'), name: `${name}.png` }], note: `On a white background, up to 3000 px wide.${caveat}` };
  }
  progress?.('Making the PDF…', 0.8);
  return { outputs: [{ blob: await canvasToPdf(canvas), name: `${name}.pdf` }], note: `One page, scaled to fit A4. The drawing is a picture inside the PDF, not editable lines.${caveat}` };
}

// ---------- 3D models ----------

// A model is a Float32Array of triangle corners: x, y, z for each of three corners, per triangle.

function parseStl(buffer) {
  const dv = new DataView(buffer);
  if (buffer.byteLength >= 84) {
    const count = dv.getUint32(80, true);
    if (84 + count * 50 === buffer.byteLength) {
      const out = new Float32Array(count * 9);
      for (let i = 0; i < count; i++) {
        const base = 84 + i * 50 + 12; // skip the normal
        for (let j = 0; j < 9; j++) out[i * 9 + j] = dv.getFloat32(base + j * 4, true);
      }
      return out;
    }
  }
  const text = new TextDecoder().decode(buffer);
  const nums = [];
  for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) nums.push(+m[1], +m[2], +m[3]);
  if (!nums.length || nums.length % 9) throw new Error("Couldn't read this STL file.");
  return Float32Array.from(nums);
}

function parseObj(text) {
  const verts = [];
  const tris = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      verts.push([+x, +y, +z]);
    } else if (line.startsWith('f ')) {
      const idx = line.slice(2).trim().split(/\s+/).map((t) => {
        const n = parseInt(t.split('/')[0], 10);
        return n < 0 ? verts.length + n : n - 1;
      });
      for (let i = 1; i + 1 < idx.length; i++) {
        for (const k of [idx[0], idx[i], idx[i + 1]]) {
          const v = verts[k];
          if (!v) throw new Error("Couldn't read this OBJ file.");
          tris.push(v[0], v[1], v[2]);
        }
      }
    }
  }
  if (!tris.length) throw new Error('This OBJ file has no surfaces (faces) to convert.');
  return Float32Array.from(tris);
}

let occtReady;
function loadOcct() {
  occtReady ??= (async () => {
    const base = new URL('../vendor/occt/', import.meta.url).href;
    await loadScript(`${base}occt-import-js.js`);
    return window.occtimportjs({ locateFile: (f) => base + f });
  })();
  occtReady.catch(() => { occtReady = null; });
  return occtReady;
}

async function parseStepLike(file, progress) {
  progress?.('Starting the 3D reader…');
  const occt = await loadOcct();
  progress?.('Reading the model…', 0.3);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const e = ext(file.name);
  const read = e === 'brep' ? occt.ReadBrepFile : e === 'iges' || e === 'igs' ? occt.ReadIgesFile : occt.ReadStepFile;
  const result = read.call(occt, bytes, null);
  if (!result?.success || !result.meshes?.length) throw new Error("Couldn't read this model. It may be damaged, or not a solid shape.");
  const parts = [];
  let total = 0;
  for (const mesh of result.meshes) {
    const pos = mesh.attributes.position.array;
    const index = mesh.index.array;
    const out = new Float32Array(index.length * 3);
    for (let i = 0; i < index.length; i++) {
      out[i * 3] = pos[index[i] * 3];
      out[i * 3 + 1] = pos[index[i] * 3 + 1];
      out[i * 3 + 2] = pos[index[i] * 3 + 2];
    }
    parts.push(out);
    total += out.length;
  }
  const all = new Float32Array(total);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.length; }
  return all;
}

async function readModel(file, progress) {
  const e = ext(file.name);
  if (e === 'stl') return parseStl(await file.arrayBuffer());
  if (e === 'obj') return parseObj(await file.text());
  return parseStepLike(file, progress);
}

function writeStl(tris) {
  const count = tris.length / 9;
  const buf = new ArrayBuffer(84 + count * 50);
  const dv = new DataView(buf);
  new TextEncoder().encodeInto('Made with FileFit', new Uint8Array(buf, 0, 80));
  dv.setUint32(80, count, true);
  for (let i = 0; i < count; i++) {
    const o = i * 9;
    const ux = tris[o + 3] - tris[o], uy = tris[o + 4] - tris[o + 1], uz = tris[o + 5] - tris[o + 2];
    const vx = tris[o + 6] - tris[o], vy = tris[o + 7] - tris[o + 1], vz = tris[o + 8] - tris[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const base = 84 + i * 50;
    dv.setFloat32(base, nx, true); dv.setFloat32(base + 4, ny, true); dv.setFloat32(base + 8, nz, true);
    for (let j = 0; j < 9; j++) dv.setFloat32(base + 12 + j * 4, tris[o + j], true);
  }
  return new Blob([buf], { type: 'model/stl' });
}

function writeObj(tris, title) {
  const index = new Map();
  const lines = [`# ${title}`, '# Made with FileFit'];
  const faces = [];
  for (let i = 0; i < tris.length; i += 9) {
    const ids = [];
    for (let j = 0; j < 9; j += 3) {
      const x = tris[i + j], y = tris[i + j + 1], z = tris[i + j + 2];
      const key = `${x},${y},${z}`;
      let id = index.get(key);
      if (!id) { id = index.size + 1; index.set(key, id); lines.push(`v ${x} ${y} ${z}`); }
      ids.push(id);
    }
    faces.push(`f ${ids[0]} ${ids[1]} ${ids[2]}`);
  }
  return new Blob([lines.join('\n') + '\n' + faces.join('\n') + '\n'], { type: 'text/plain' });
}

// A flat-shaded picture of the model from a corner, drawn back to front.
function previewMesh(tris) {
  const n = tris.length / 9;
  const yaw = (-35 * Math.PI) / 180;
  const elev = (28 * Math.PI) / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ce = Math.cos(elev), se = Math.sin(elev);
  const view = (x, y, z) => {
    const x1 = x * cy - y * sy;
    const y1 = x * sy + y * cy;
    return [x1, z * ce + y1 * se, y1 * ce - z * se]; // screen x, screen up, depth (bigger is farther)
  };
  const pts = new Float32Array(n * 9);
  const depth = new Float32Array(n);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let j = 0; j < 3; j++) {
      const [sx, su, dz] = view(tris[i * 9 + j * 3], tris[i * 9 + j * 3 + 1], tris[i * 9 + j * 3 + 2]);
      pts[i * 9 + j * 3] = sx; pts[i * 9 + j * 3 + 1] = su; pts[i * 9 + j * 3 + 2] = dz;
      d += dz;
      if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
      if (su < minY) minY = su; if (su > maxY) maxY = su;
    }
    depth[i] = d;
  }
  const W = 1400, H = 1050, pad = 70;
  const k = Math.min((W - 2 * pad) / ((maxX - minX) || 1), (H - 2 * pad) / ((maxY - minY) || 1));
  const ox = (W - (maxX - minX) * k) / 2 - minX * k;
  const oy = (H + (maxY - minY) * k) / 2 + minY * k;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => depth[b] - depth[a]);
  for (const i of order) {
    const o = i * 9;
    // Surface direction in view space for shading.
    const ux = pts[o + 3] - pts[o], uy = pts[o + 4] - pts[o + 1], uz = pts[o + 5] - pts[o + 2];
    const vx = pts[o + 6] - pts[o], vy = pts[o + 7] - pts[o + 1], vz = pts[o + 8] - pts[o + 2];
    // pts are (screen x, screen up, depth); the camera direction in this space is (0, 0, -1).
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; } // turn the surface toward the viewer
    // One light from the upper left, plus a little light from everywhere.
    const lit = Math.max(0, (nx * -0.5 + ny * 0.6 + nz * -0.62) / len);
    const shade = 0.3 + 0.7 * lit;
    const r = Math.round(45 + 150 * shade), g = Math.round(95 + 125 * shade), b = Math.round(150 + 95 * shade);
    ctx.fillStyle = ctx.strokeStyle = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
    ctx.beginPath();
    ctx.moveTo(pts[o] * k + ox, oy - pts[o + 1] * k);
    ctx.lineTo(pts[o + 3] * k + ox, oy - pts[o + 4] * k);
    ctx.lineTo(pts[o + 6] * k + ox, oy - pts[o + 7] * k);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  return canvas;
}

async function convertModel(file, to, progress) {
  const name = baseName(file.name);
  const tris = await readModel(file, progress);
  const count = tris.length / 9;
  progress?.('Writing the new file…', 0.7);
  if (to === 'stl') return { outputs: [{ blob: writeStl(tris), name: `${name}.stl` }], note: `${count.toLocaleString()} triangles, binary STL. STEP/IGES shapes are turned into a triangle mesh, so curves become small flat pieces.` };
  if (to === 'obj') return { outputs: [{ blob: writeObj(tris, name), name: `${name}.obj` }], note: `${count.toLocaleString()} triangles. Shapes are meshes: no colors or materials are kept.` };
  if (to === 'png') {
    const canvas = previewMesh(tris);
    return { outputs: [{ blob: await canvasToBlob(canvas, 'image/png'), name: `${name}.png` }], note: 'A picture of the model from one corner, flat-shaded.' };
  }
  throw new Error(`Can't convert this model to ${to}.`);
}

export function convertCad(file, to, progress) {
  return isDrawing(file.name) ? convertDrawing(file, to, progress) : convertModel(file, to, progress);
}
