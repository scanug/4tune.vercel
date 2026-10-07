// Icone pixel art 16x16. Ogni riga è una stringa di 16 caratteri:
// '.' è trasparente, le altre lettere sono colori della palette.
export const PALETTE = {
  K: '#120b2e', // contorno
  W: '#ffffff',
  L: '#c9c3e6',
  D: '#2b2156',
  Y: '#ffd23f',
  O: '#ff8c1a',
  R: '#ff3b5c',
  P: '#ff4fd8',
  C: '#3ee8ff',
  B: '#4d6bff',
  G: '#39ff88',
  S: '#ffcf9e',
  N: '#9a5b2e',
};

export const ICONS = {
  note: [
    '................',
    '.....KKKKKKKKKK.',
    '.....KPPPPPPPPK.',
    '.....KPPPPPPPPK.',
    '.....KPKKKKKKPK.',
    '.....KPK....KPK.',
    '.....KPK....KPK.',
    '.....KPK....KPK.',
    '.....KPK....KPK.',
    '..KKKKPK..KKKPK.',
    '.KPPPPPK.KPPPPK.',
    'KPWPPPPKKPWPPPK.',
    'KPPPPPPKKPPPPPK.',
    '.KPPPPK..KPPPK..',
    '..KKKK....KKK...',
    '................',
  ],
  hourglass: [
    '..KKKKKKKKKKKK..',
    '..KNNNNNNNNNNK..',
    '..KKKKKKKKKKKK..',
    '...KYYYYYYYYK...',
    '...KWYYYYYYYK...',
    '....KYYYYYYK....',
    '.....KYYYYK.....',
    '......KYYK......',
    '......KCYK......',
    '.....KCCYCK.....',
    '....KWCCYCCK....',
    '...KCCCYYYCCK...',
    '...KYYYYYYYYK...',
    '..KKKKKKKKKKKK..',
    '..KNNNNNNNNNNK..',
    '..KKKKKKKKKKKK..',
  ],
  calendar: [
    '....KK....KK....',
    '..KKLKKKKKKLKK..',
    '..KRRKRRRRKRRK..',
    '..KRRRRRRRRRRK..',
    '..KKKKKKKKKKKK..',
    '..KWWWWWWWWWWK..',
    '..KWWWWBBWWWWK..',
    '..KWWWBBBWWWWK..',
    '..KWWWWBBWWWWK..',
    '..KWWWWBBWWWWK..',
    '..KWWWWBBWWWWK..',
    '..KWWWBBBBWWWK..',
    '..KWWWWWWWWWWK..',
    '..KKKKKKKKKKKK..',
    '...KLLLLLLLLLLK.',
    '....KKKKKKKKKKK.',
  ],
  spy: [
    '................',
    '.....KKKKKK.....',
    '....KDDDDDDK....',
    '....KDDDDDDK....',
    '....KRRRRRRK....',
    '..KKKKKKKKKKKK..',
    '..KDDDDDDDDDDK..',
    '...KSSSSSSSSK...',
    '...KKKKKKKKKK...',
    '...KKCKSSKCKK...',
    '...KSSSSSSSSK...',
    '...KSSKKKKSSK...',
    '....KSSSSSSK....',
    '.....KKKKKK.....',
    '....KDDDDDDK....',
    '...KDDDDDDDDK...',
  ],
  bomb: [
    '............Y...',
    '...........YOY..',
    '............Y...',
    '...........N....',
    '..........N.....',
    '.........N......',
    '......KKKKKK....',
    '....KKDDDDDDKK..',
    '...KDDWWDDDDDDK.',
    '..KDDWDDDDDDDDDK',
    '..KDDWDDDDDDDDDK',
    '..KDDDDDDDDDDDDK',
    '..KDDDDDDDDDDDDK',
    '...KDDDDDDDDDDK.',
    '....KKDDDDDDKK..',
    '......KKKKKK....',
  ],
  trophy: [
    '................',
    '...KKKKKKKKKK...',
    '.KKKYYYYYYWYKKK.',
    'K..KYYYYYYWYK..K',
    'K..KYYYYYYWYK..K',
    '.K.KOYYYYYYOK.K.',
    '..KKOYYYYYYOKK..',
    '....KOYYYYOK....',
    '.....KOYYOK.....',
    '......KYYK......',
    '......KYYK......',
    '.....KKOOKK.....',
    '....KOOOOOOK....',
    '...KNNNNNNNNK...',
    '...KNNNNNNNNK...',
    '...KKKKKKKKKK...',
  ],
};

// Trasforma la griglia in rettangoli, unendo i pixel uguali sulla stessa riga.
function toRuns(rows) {
  const runs = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c !== '.') runs.push({ x, y, w: end - x, fill: PALETTE[c] });
      x = end;
    }
  });
  return runs;
}

const RUNS = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, toRuns(v)]));

export default function PixelIcon({ name, size = 48, title, className, style }) {
  const runs = RUNS[name];
  if (!runs) return null;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
