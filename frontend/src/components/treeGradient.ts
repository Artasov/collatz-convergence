export interface GradientColor {
    stop: number;
    r: number;
    g: number;
    b: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function seededUnit(seed: number, salt: number): number {
    const raw = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453123;
    return raw - Math.floor(raw);
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hue = ((h % 360) + 360) % 360;
    const sat = clamp(s, 0, 100) / 100;
    const light = clamp(l, 0, 100) / 100;
    const chroma = (1 - Math.abs(2 * light - 1)) * sat;
    const sector = hue / 60;
    const x = chroma * (1 - Math.abs((sector % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (sector >= 0 && sector < 1) {
        r1 = chroma;
        g1 = x;
    } else if (sector >= 1 && sector < 2) {
        r1 = x;
        g1 = chroma;
    } else if (sector >= 2 && sector < 3) {
        g1 = chroma;
        b1 = x;
    } else if (sector >= 3 && sector < 4) {
        g1 = x;
        b1 = chroma;
    } else if (sector >= 4 && sector < 5) {
        r1 = x;
        b1 = chroma;
    } else {
        r1 = chroma;
        b1 = x;
    }

    const m = light - chroma / 2;
    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255),
    };
}

export function buildTreeGradient(seed: number): GradientColor[] {
    const baseHue = Math.floor(seededUnit(seed, 1) * 360);
    const satA = 50 + Math.floor(seededUnit(seed, 2) * 24);
    const satB = 52 + Math.floor(seededUnit(seed, 3) * 26);
    const satC = 56 + Math.floor(seededUnit(seed, 4) * 22);
    const satD = 58 + Math.floor(seededUnit(seed, 5) * 24);
    const satE = 46 + Math.floor(seededUnit(seed, 6) * 18);
    const spanA = 26 + Math.floor(seededUnit(seed, 7) * 28);
    const spanB = 18 + Math.floor(seededUnit(seed, 8) * 22);
    const spanC = 24 + Math.floor(seededUnit(seed, 9) * 32);
    const spanD = 32 + Math.floor(seededUnit(seed, 10) * 40);

    const c0 = hslToRgb(baseHue, satA, 24);
    const c1 = hslToRgb(baseHue + spanA, satB, 35);
    const c2 = hslToRgb(baseHue + spanA + spanB, satC, 47);
    const c3 = hslToRgb(baseHue + spanA + spanB + spanC, satD, 58);
    const c4 = hslToRgb(baseHue + spanA + spanB + spanC + spanD, satE, 68);

    return [
        {stop: 0, ...c0},
        {stop: 0.25, ...c1},
        {stop: 0.5, ...c2},
        {stop: 0.75, ...c3},
        {stop: 1, ...c4},
    ];
}

export function toGradientColor(gradient: GradientColor[], ratio: number, alpha: number): string {
    const t = clamp(ratio, 0, 1);
    for (let index = 1; index < gradient.length; index += 1) {
        const left = gradient[index - 1];
        const right = gradient[index];
        if (t > right.stop) {
            continue;
        }
        const span = Math.max(0.0001, right.stop - left.stop);
        const local = (t - left.stop) / span;
        const r = Math.round(left.r + (right.r - left.r) * local);
        const g = Math.round(left.g + (right.g - left.g) * local);
        const b = Math.round(left.b + (right.b - left.b) * local);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    const fallback = gradient[gradient.length - 1];
    return `rgba(${fallback.r}, ${fallback.g}, ${fallback.b}, ${alpha})`;
}
