import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

const size = 32;
const destination = new URL('../public/toybox/starter-v2/', import.meta.url);
const ink = '#1a233b';
const clear = '#00000000';

function sprite(draw) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const set = (x, y, color) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const rgba = color.length === 7 ? color + 'ff' : color;
    pixels.set(Buffer.from(rgba.slice(1), 'hex'), y * (size * 4 + 1) + 1 + x * 4);
  };
  const box = (color, x, y, w, h) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, color);
  };
  const fill = (color, points) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[i], [bx, by] = points[j];
        if ((ay > y + .5) !== (by > y + .5) && x + .5 < (bx - ax) * (y + .5 - ay) / (by - ay) + ax) inside = !inside;
      }
      if (inside) set(x, y, color);
    }
  };
  draw(fill, box);
  return pixels;
}

function fire(frame) {
  const rise = [0, -1, 0, 1][frame];
  return sprite((fill, box) => {
    fill(ink, [[6,24],[6,18],[9,13],[11,17],[13,14],[15,9],[15,5+rise],[20,8+rise],[23,12],[24,15],[23,18],[26,16],[28,20],[28,25],[25,28],[21,30],[12,30],[8,28]]);
    fill('#b43b43', [[7,20],[9,16],[11,20],[15,15],[17,9+rise],[20,11],[22,15],[21,20],[25,19],[27,21],[27,24],[24,27],[20,29],[13,29],[9,27]]);
    fill('#ed5b35', [[8,20],[10,18],[12,21],[17,15],[18,10+rise],[21,14],[20,20],[23,22],[25,20],[26,22],[24,26],[20,27],[13,28],[9,26]]);
    fill('#ff9a3f', [[10,22],[12,24],[14,19],[18,17],[18,14+rise],[20,17],[18,22],[20,24],[23,22],[24,25],[20,28],[14,28],[11,26]]);
    fill('#ffd56c', [[12,25],[14,24],[16,20],[18,19],[17,24],[19,26],[22,25],[19,28],[14,28]]);
    box('#fff1ad', 15, 25, 3, 2);
    box('#ed7440', 9, 9 - rise, 2, 2);
    box('#ffca70', 9, 9 - rise, 1, 1);
  });
}

function water(frame) {
  return sprite((fill, box) => {
    fill(ink, [[13,4],[16,4],[17,8],[21,13],[25,17],[27,21],[27,25],[25,28],[21,30],[12,30],[8,28],[5,25],[5,20],[8,15],[12,10],[14,6]]);
    fill('#185da1', [[15,6],[17,10],[20,14],[24,18],[26,21],[26,25],[23,28],[20,29],[12,29],[8,27],[6,24],[6,20],[9,16],[13,11]]);
    fill('#238fc5', [[15,8],[17,12],[22,17],[24,21],[24,24],[21,27],[17,28],[11,27],[8,25],[7,22],[9,17],[13,12]]);
    fill('#45c5dc', [[14,10],[16,13],[19,17],[21,21],[20,24],[16,26],[11,25],[8,23],[9,20],[11,16]]);
    fill('#b5f9ed', [[12,14],[14,13],[14,16],[11,20],[10,23],[9,22],[10,18]]);
    box('#f6fff2', 11, 17, 2, 2);
    const wave = [0, -1, -2, -1][frame];
    fill('#62d6e4', [[12,26+wave],[16,27+wave],[20,26+wave],[22,24+wave],[22,26+wave],[18,28+wave],[13,28+wave]]);
    box('#a3f4f1', 19 + frame % 2, 23, 2, 1);
  });
}

function wind(frame) {
  return sprite((fill, box) => {
    // The open counter in the spiral keeps Wind readable on a dark room floor.
    fill(ink, [[4,17],[8,14],[15,14],[16,10],[19,7],[24,7],[28,10],[29,14],[27,19],[24,21],[19,22],[10,21],[6,22],[3,21],[2,19]]);
    fill('#247584', [[4,18],[8,15],[16,15],[17,10],[20,8],[24,8],[27,10],[28,14],[26,18],[23,20],[19,21],[10,20],[6,21],[4,21],[3,19]]);
    fill('#4ab6b3', [[4,18],[8,16],[16,16],[18,15],[17,13],[18,10],[20,9],[24,9],[27,11],[27,14],[25,17],[22,19],[18,20],[11,19],[7,20],[4,20]]);
    fill('#a2eee1', [[5,18],[9,16],[15,16],[19,17],[22,16],[24,14],[24,12],[22,11],[20,12],[20,14],[22,14],[21,16],[18,15],[18,12],[20,9],[24,9],[26,11],[26,14],[24,17],[20,19],[14,18],[9,18],[6,19]]);
    fill(clear, [[20,12],[22,11],[24,12],[24,14],[22,16],[21,15],[22,14],[20,14]]);
    box('#dbfff0', 20, 9, 4, 1);
    const tail = [0, 1, 2, 1][frame];
    fill(ink, [[7,25],[11+tail,22],[17+tail,23],[22+tail,22],[25+tail,23],[24+tail,25],[20+tail,27],[13+tail,26],[10,27],[7,27]]);
    fill('#51b5b4', [[8,25],[11+tail,23],[17+tail,24],[22+tail,23],[24+tail,23],[23+tail,25],[19+tail,26],[13+tail,25],[10,26],[8,26]]);
    box('#b9f7e7', 11 + tail, 24, 5, 1);
  });
}

function earth(frame) {
  return sprite((fill, box) => {
    fill(ink, [[4,16],[7,13],[15,10],[23,12],[28,16],[28,24],[24,28],[18,30],[10,29],[5,26],[4,23]]);
    fill('#6a463a', [[5,17],[8,14],[15,11],[23,13],[27,16],[27,24],[23,27],[18,29],[11,28],[6,25]]);
    fill('#a96343', [[6,17],[10,15],[17,14],[23,16],[24,21],[22,24],[17,27],[10,26],[7,24]]);
    fill('#cd8b53', [[6,17],[9,16],[15,17],[16,21],[13,23],[9,22],[7,22]]);
    fill('#386347', [[5,16],[8,14],[15,11],[22,13],[27,16],[25,19],[21,20],[19,22],[15,20],[11,21],[10,19],[7,19]]);
    fill('#68a953', [[6,16],[9,14],[15,12],[22,14],[26,16],[24,18],[20,19],[16,19],[13,18],[10,19]]);
    fill('#a9cf69', [[8,15],[14,12],[17,13],[19,14],[14,16],[10,17],[7,17]]);
    box('#d5ad68', 7, 22, 3, 2);
    box('#bc9465', 19, 23, 3, 2);
    box('#513c3b', 22, 25, 2, 1);
    const lean = [0, -1, 0, 1][frame];
    box('#254e43', 15, 8, 2, 6);
    fill('#3a7450', [[16,11],[12+lean,10],[10+lean,7],[11+lean,6],[14+lean,7],[16,10],[17,7],[20+lean,5],[22+lean,5],[22+lean,7],[19+lean,10]]);
    fill('#a4ce68', [[11+lean,7],[14+lean,7],[16,10],[13+lean,9]]);
    fill('#bddf7a', [[17,9],[19+lean,6],[22+lean,5],[20+lean,8]]);
  });
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value;
});
function chunk(name, bytes = Buffer.alloc(0)) {
  const data = Buffer.concat([Buffer.from(name), bytes]);
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, data, checksum]);
}
function png(frames, timings) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header)];
  if (timings) {
    const control = Buffer.alloc(8);
    control.writeUInt32BE(frames.length);
    chunks.push(chunk('acTL', control));
  }
  let sequence = 0;
  frames.forEach((frame, index) => {
    if (timings) {
      const control = Buffer.alloc(26);
      control.writeUInt32BE(sequence++, 0);
      control.writeUInt32BE(size, 4);
      control.writeUInt32BE(size, 8);
      control.writeUInt16BE(timings[index], 20);
      control.writeUInt16BE(1000, 22);
      chunks.push(chunk('fcTL', control));
    }
    const compressed = deflateSync(frame);
    if (index === 0) chunks.push(chunk('IDAT', compressed));
    else {
      const number = Buffer.alloc(4);
      number.writeUInt32BE(sequence++);
      chunks.push(chunk('fdAT', Buffer.concat([number, compressed])));
    }
  });
  chunks.push(chunk('IEND'));
  return Buffer.concat(chunks);
}

await mkdir(destination, { recursive: true });
for (const [name, draw, timings] of [
  ['fire', fire, [250, 135, 195, 160]],
  ['water', water, [560, 145, 175, 170]],
  ['wind', wind, [580, 160, 190, 150]],
  ['earth', earth, [1250, 180, 240, 180]],
]) {
  const frames = [0, 1, 2, 3].map(draw);
  await writeFile(new URL(name + '.png', destination), png([frames[0]]));
  await writeFile(new URL(name + '-motion.png', destination), png(frames, timings));
}
