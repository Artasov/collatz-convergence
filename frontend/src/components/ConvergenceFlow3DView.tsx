import type {PointerEvent} from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Button, Paper, Typography} from '@mui/material';
import {buildTreeGradient, toGradientColor} from './treeGradient';

interface Props {
    sampleCount: number;
    maxStart: number;
    colorEnabled: boolean;
    colorSeed: number;
    tailVisibility: number;
}

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

interface Node3D {
    value: number;
    depth: number;
    hits: number;
    position: Vec3;
}

interface Segment3D {
    source: Vec3;
    target: Vec3;
    depth: number;
    hits: number;
    curve: number;
}

interface ModelData {
    nodes: Node3D[];
    segments: Segment3D[];
    maxDepth: number;
    maxLogHit: number;
    renderHitThreshold: number;
    uniqueEdgeCount: number;
    uniqueNodeCount: number;
    bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
    };
    center: Vec3;
}

interface DragState {
    pointerX: number;
    pointerY: number;
    mode: 'rotate' | 'pan';
    panX: number;
    panY: number;
    rotationX: number;
    rotationY: number;
}

interface ProjectedPoint {
    x: number;
    y: number;
    depth: number;
}

interface HoverNodeState {
    localX: number;
    localY: number;
    value: number;
    depth: number;
    hits: number;
}

interface ProjectedNode {
    x: number;
    y: number;
    depth: number;
    radius: number;
    value: number;
    depthFromRoot: number;
    hits: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function toRad(value: number): number {
    return (value * Math.PI) / 180;
}

function nextCollatz(value: number): number {
    return value % 2 === 0 ? value / 2 : value * 3 + 1;
}

function hashUnit(value: number): number {
    let x = value | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const normalized = (x >>> 0) / 4294967295;
    return Number.isFinite(normalized) ? normalized : 0.5;
}

function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function rotateY(point: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: point.x * cos - point.z * sin,
        y: point.y,
        z: point.x * sin + point.z * cos,
    };
}

function rotateX(point: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: point.x,
        y: point.y * cos - point.z * sin,
        z: point.y * sin + point.z * cos,
    };
}

function rotatePoint(point: Vec3, rotationX: number, rotationY: number): Vec3 {
    return rotateX(rotateY(point, rotationY), rotationX);
}

function normalizeVector(value: Vec3): Vec3 {
    const length = Math.hypot(value.x, value.y, value.z);
    if (length < 1e-7) {
        return {x: 0, y: 1, z: 0};
    }
    return {x: value.x / length, y: value.y / length, z: value.z / length};
}

function directionFromAngles(yaw: number, pitch: number): Vec3 {
    const cosPitch = Math.cos(pitch);
    return normalizeVector({
        x: Math.cos(yaw) * cosPitch,
        y: Math.sin(pitch),
        z: Math.sin(yaw) * cosPitch,
    });
}

function projectRaw(
    point: Vec3,
    rotationX: number,
    rotationY: number,
    cameraDistance: number,
    focal: number,
    center: Vec3,
): ProjectedPoint | null {
    const local = {
        x: point.x - center.x,
        y: point.y - center.y,
        z: point.z - center.z,
    };
    const rotatedLocal = rotatePoint(local, rotationX, rotationY);
    const depth = cameraDistance + rotatedLocal.z;
    if (depth <= 0.1) {
        return null;
    }
    return {
        x: (rotatedLocal.x * focal) / depth,
        y: (-rotatedLocal.y * focal) / depth,
        depth,
    };
}

function quadraticPoint(start: { x: number; y: number }, control: { x: number; y: number }, end: {
    x: number;
    y: number
}, t: number): { x: number; y: number } {
    const oneMinusT = 1 - t;
    const x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x;
    const y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y;
    return {x, y};
}

function buildModel(sampleCount: number, maxStart: number): ModelData {
    const safeSampleCount = clamp(Math.floor(sampleCount), 100, 30000);
    const safeMaxStart = clamp(Math.floor(maxStart), 10, 5000000);
    const root = 1;
    const rng = mulberry32((safeSampleCount * 7919 + safeMaxStart * 104729) >>> 0);
    const pathCache = new Map<number, number[]>();
    pathCache.set(root, [root]);

    function getPath(start: number): number[] {
        if (pathCache.has(start)) {
            return pathCache.get(start)!;
        }
        const trace: number[] = [];
        let current = start;
        let guard = 0;
        while (!pathCache.has(current) && guard < 12000) {
            trace.push(current);
            current = nextCollatz(current);
            guard += 1;
        }
        const tail = pathCache.get(current) ?? [root];
        const path = [...trace, ...tail];
        for (let index = 0; index < trace.length; index += 1) {
            pathCache.set(trace[index], path.slice(index));
        }
        return path;
    }

    const nodeHits = new Map<number, number>();
    const edgeHits = new Map<string, { source: number; target: number; hits: number }>();
    nodeHits.set(root, safeSampleCount);

    for (let index = 0; index < safeSampleCount; index += 1) {
        const start = 2 + Math.floor(rng() * (safeMaxStart - 1));
        const path = getPath(start);

        for (const value of path) {
            nodeHits.set(value, (nodeHits.get(value) ?? 0) + 1);
        }

        const outward = [...path].reverse();
        for (let step = 0; step < outward.length - 1; step += 1) {
            const source = outward[step];
            const target = outward[step + 1];
            const key = `${source}:${target}`;
            const previous = edgeHits.get(key);
            if (previous) {
                previous.hits += 1;
            } else {
                edgeHits.set(key, {source, target, hits: 1});
            }
        }
    }

    let renderHitThreshold = safeSampleCount >= 12000
        ? 4
        : safeSampleCount >= 4500
            ? 3
            : safeSampleCount >= 1800
                ? 2
                : 1;
    const childrenByParent = new Map<number, number[]>();
    const fillChildrenByThreshold = (threshold: number) => {
        childrenByParent.clear();
        for (const edge of edgeHits.values()) {
            if (edge.hits < threshold) {
                continue;
            }
            const children = childrenByParent.get(edge.source) ?? [];
            if (!children.includes(edge.target)) {
                children.push(edge.target);
                childrenByParent.set(edge.source, children);
            }
        }
    };
    fillChildrenByThreshold(renderHitThreshold);
    if ((childrenByParent.get(root) ?? []).length === 0 && renderHitThreshold > 1) {
        renderHitThreshold = 1;
        fillChildrenByThreshold(renderHitThreshold);
    }

    for (const [parent, children] of childrenByParent.entries()) {
        children.sort((left, right) => left - right);
        childrenByParent.set(parent, children);
    }

    const depthByValue = new Map<number, number>();
    depthByValue.set(root, 0);
    const queue: number[] = [root];
    let queueIndex = 0;
    while (queueIndex < queue.length) {
        const value = queue[queueIndex];
        queueIndex += 1;
        const depth = depthByValue.get(value) ?? 0;
        const children = childrenByParent.get(value) ?? [];
        for (const child of children) {
            if (depthByValue.has(child)) {
                continue;
            }
            depthByValue.set(child, depth + 1);
            queue.push(child);
        }
    }
    let maxDepth = 0;
    for (const depth of depthByValue.values()) {
        if (depth > maxDepth) {
            maxDepth = depth;
        }
    }

    const positionByValue = new Map<number, Vec3>();
    const orientationByValue = new Map<number, { yaw: number; pitch: number }>();
    positionByValue.set(root, {x: 0, y: 0, z: 0});
    orientationByValue.set(root, {yaw: 0.12, pitch: 1.0});

    const valuesByDepth = [...depthByValue.entries()]
        .sort((left, right) => left[1] - right[1]);

    for (const [value] of valuesByDepth) {
        const children = childrenByParent.get(value) ?? [];
        if (!children.length) {
            continue;
        }
        const parentPosition = positionByValue.get(value);
        const parentOrientation = orientationByValue.get(value);
        if (!parentPosition || !parentOrientation) {
            continue;
        }
        const parentDepth = depthByValue.get(value) ?? 0;
        const siblingCount = children.length;
        for (let index = 0; index < siblingCount; index += 1) {
            const child = children[index];
            if (positionByValue.has(child)) {
                continue;
            }
            const centered = siblingCount <= 1 ? 0 : (index / (siblingCount - 1)) * 2 - 1;
            const parityTurn = child % 2 === 0 ? toRad(8.65) : -toRad(16);
            const fan = toRad(7 + Math.min(14, parentDepth * 0.36));
            const yaw = parentOrientation.yaw + parityTurn + centered * fan;
            const pitch = clamp(parentOrientation.pitch * 0.92 + centered * toRad(3.2), toRad(10), toRad(84));
            const direction = directionFromAngles(yaw, pitch);
            const stepLength = (58 / Math.max(1.05, Math.log(child + 1))) * (1 + Math.min(0.24, (parentDepth + 1) * 0.01));

            positionByValue.set(child, {
                x: parentPosition.x + direction.x * stepLength,
                y: parentPosition.y + direction.y * stepLength,
                z: parentPosition.z + direction.z * stepLength,
            });
            orientationByValue.set(child, {yaw, pitch});
        }
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    const nodes: Node3D[] = [];
    for (const [value, position] of positionByValue.entries()) {
        minX = Math.min(minX, position.x);
        maxX = Math.max(maxX, position.x);
        minY = Math.min(minY, position.y);
        maxY = Math.max(maxY, position.y);
        minZ = Math.min(minZ, position.z);
        maxZ = Math.max(maxZ, position.z);
        nodes.push({
            value,
            depth: depthByValue.get(value) ?? 0,
            hits: nodeHits.get(value) ?? 0,
            position,
        });
    }

    if (!Number.isFinite(minX)) {
        minX = -1;
        maxX = 1;
        minY = -1;
        maxY = 1;
        minZ = -1;
        maxZ = 1;
    }

    const segments: Segment3D[] = [];
    let maxLogHit = 1;
    for (const edge of edgeHits.values()) {
        if (edge.hits < renderHitThreshold) {
            continue;
        }
        const source = positionByValue.get(edge.source);
        const target = positionByValue.get(edge.target);
        if (!source || !target) {
            continue;
        }
        const logHit = Math.log1p(edge.hits);
        if (logHit > maxLogHit) {
            maxLogHit = logHit;
        }
        segments.push({
            source,
            target,
            depth: depthByValue.get(edge.target) ?? 1,
            hits: edge.hits,
            curve: (edge.target % 2 === 0 ? 0.34 : -0.38) + (hashUnit(edge.source * 239017 + edge.target * 9137) - 0.5) * 0.16,
        });
    }

    const center = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
    };

    return {
        nodes,
        segments,
        maxDepth: Math.max(1, maxDepth),
        maxLogHit: Math.max(0.0001, maxLogHit),
        renderHitThreshold,
        uniqueEdgeCount: segments.length,
        uniqueNodeCount: nodes.length,
        bounds: {minX, maxX, minY, maxY, minZ, maxZ},
        center,
    };
}

export function ConvergenceFlow3DView({sampleCount, maxStart, colorEnabled, colorSeed, tailVisibility}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const projectedNodesRef = useRef<ProjectedNode[]>([]);
    const wheelTimerRef = useRef<number | null>(null);

    const [containerSize, setContainerSize] = useState({width: 980, height: 620});
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState({x: 0.27, y: -0.42});
    const [pan, setPan] = useState({x: 0, y: 0});
    const [drag, setDrag] = useState<DragState | null>(null);
    const [hoverNode, setHoverNode] = useState<HoverNodeState | null>(null);
    const [isWheeling, setIsWheeling] = useState(false);
    const [isAnimatingGrowth, setIsAnimatingGrowth] = useState(false);
    const [animationProgress, setAnimationProgress] = useState(1);
    const animationBaseRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    const model = useMemo(() => buildModel(sampleCount, maxStart), [maxStart, sampleCount]);
    const gradient = useMemo(() => buildTreeGradient(colorSeed), [colorSeed]);
    const tailVisibilityLevel = useMemo(() => clamp(tailVisibility, 1, 6), [tailVisibility]);

    const cameraDistance = useMemo(() => {
        const spanX = Math.max(1, model.bounds.maxX - model.bounds.minX);
        const spanY = Math.max(1, model.bounds.maxY - model.bounds.minY);
        const spanZ = Math.max(1, model.bounds.maxZ - model.bounds.minZ);
        const span = Math.max(spanX, spanY, spanZ);
        return Math.max(12, span * 2.5);
    }, [
        model.bounds.maxX,
        model.bounds.maxY,
        model.bounds.maxZ,
        model.bounds.minX,
        model.bounds.minY,
        model.bounds.minZ,
    ]);

    const animationDurationMs = useMemo(
        () => clamp(model.maxDepth * 210, 3600, 22000),
        [model.maxDepth],
    );

    useEffect(() => {
        setIsAnimatingGrowth(false);
        setAnimationProgress(1);
        animationBaseRef.current = 1;
    }, [sampleCount, maxStart]);

    useEffect(() => {
        if (!isAnimatingGrowth) {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }
        const start = performance.now();
        const base = animationBaseRef.current;
        const remain = Math.max(0.0001, 1 - base);
        const duration = animationDurationMs * remain;
        const step = (now: number) => {
            const elapsed = now - start;
            const t = clamp(base + elapsed / duration, 0, 1);
            setAnimationProgress(t);
            if (t >= 1) {
                setIsAnimatingGrowth(false);
                animationFrameRef.current = null;
                animationBaseRef.current = 1;
                return;
            }
            animationFrameRef.current = window.requestAnimationFrame(step);
        };
        animationFrameRef.current = window.requestAnimationFrame(step);
        return () => {
            if (animationFrameRef.current !== null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [animationDurationMs, isAnimatingGrowth]);

    function onStartGrowth() {
        setAnimationProgress(0);
        animationBaseRef.current = 0;
        setIsAnimatingGrowth(true);
    }

    function onStopGrowth() {
        animationBaseRef.current = animationProgress;
        setIsAnimatingGrowth(false);
    }

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            const width = Math.max(340, Math.floor(entry.contentRect.width));
            const height = Math.max(420, Math.floor(entry.contentRect.height));
            setContainerSize({width, height});
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        function onWheel(event: WheelEvent) {
            if (event.cancelable) {
                event.preventDefault();
            }
            event.stopPropagation();
            setIsWheeling(true);
            if (wheelTimerRef.current !== null) {
                window.clearTimeout(wheelTimerRef.current);
            }
            wheelTimerRef.current = window.setTimeout(() => {
                setIsWheeling(false);
                wheelTimerRef.current = null;
            }, 130);
            const factor = event.deltaY < 0 ? 1.14 : 0.88;
            setZoom((current) => clamp(current * factor, 0.00008, 120));
        }

        container.addEventListener('wheel', onWheel, {passive: false});
        return () => {
            container.removeEventListener('wheel', onWheel);
            if (wheelTimerRef.current !== null) {
                window.clearTimeout(wheelTimerRef.current);
                wheelTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const baseRotation = {x: 0.27, y: -0.42};
        setRotation(baseRotation);
        const focal = Math.min(containerSize.width, containerSize.height) * 0.88;
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const node of model.nodes) {
            const projected = projectRaw(
                node.position,
                baseRotation.x,
                baseRotation.y,
                cameraDistance,
                focal,
                model.center,
            );
            if (!projected) {
                continue;
            }
            minX = Math.min(minX, projected.x);
            maxX = Math.max(maxX, projected.x);
            minY = Math.min(minY, projected.y);
            maxY = Math.max(maxY, projected.y);
        }

        if (!Number.isFinite(minX)) {
            setZoom(1);
            setPan({x: 0, y: 0});
            return;
        }

        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const fitZoom = clamp(
            Math.min((containerSize.width * 0.84) / spanX, (containerSize.height * 0.84) / spanY),
            0.0001,
            24,
        );
        setZoom(fitZoom);
        setPan({x: containerSize.width / 2, y: containerSize.height / 2});
    }, [cameraDistance, containerSize.height, containerSize.width, model.center, model.nodes]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.floor(containerSize.width * dpr));
        const pixelHeight = Math.max(1, Math.floor(containerSize.height * dpr));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }

        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.scale(dpr, dpr);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.clearRect(0, 0, containerSize.width, containerSize.height);

        const focal = Math.min(containerSize.width, containerSize.height) * 0.88 * zoom;
        const centerX = pan.x;
        const centerY = pan.y;

        function project(point: Vec3): ProjectedPoint | null {
            const raw = projectRaw(point, rotation.x, rotation.y, cameraDistance, focal, model.center);
            if (!raw) {
                return null;
            }
            return {
                x: centerX + raw.x,
                y: centerY + raw.y,
                depth: raw.depth,
            };
        }

        const projectedSegments = model.segments
            .map((segment) => {
                const source = project(segment.source);
                const target = project(segment.target);
                if (!source || !target) {
                    return null;
                }
                return {
                    sourceX: source.x,
                    sourceY: source.y,
                    targetX: target.x,
                    targetY: target.y,
                    depth: (source.depth + target.depth) / 2,
                    layerDepth: segment.depth,
                    hits: segment.hits,
                    curve: segment.curve,
                };
            })
            .filter((segment): segment is NonNullable<typeof segment> => segment !== null);
        projectedSegments.sort((left, right) => right.depth - left.depth);
        const faintLift = (tailVisibilityLevel - 1) / 5;
        const minHitRatio = 0.028 * (1 - faintLift * 0.8);

        for (const segment of projectedSegments) {
            const layerSpan = 1 / Math.max(1, model.maxDepth);
            const layerStart = Math.max(0, (segment.layerDepth - 1) * layerSpan);
            const localProgress = clamp((animationProgress - layerStart) / layerSpan, 0, 1);
            if (localProgress <= 0) {
                continue;
            }
            const hitRatio = clamp(Math.log1p(segment.hits) / model.maxLogHit, 0, 1);
            if (hitRatio < minHitRatio) {
                continue;
            }
            const widthFactor = Math.pow(hitRatio, 1.95);
            const alphaFactor = Math.pow(hitRatio, 1.35);
            const colorRatio = 1 - hitRatio;
            const perspective = clamp(28 / segment.depth, 0.3, 1.7);
            const alphaBase = 0.012 + alphaFactor * 0.9;
            const alphaBoost = faintLift * (0.16 + (1 - hitRatio) * 0.38);
            const alpha = clamp(alphaBase + alphaBoost, 0.012, 0.96);
            const zoomBoost = clamp(Math.pow(Math.max(zoom, 0.25), 0.23), 0.75, 2.4);
            const widthBase = (0.03 + widthFactor * 8.2) * perspective * zoomBoost;
            const widthBoost = faintLift * (0.85 + (1 - hitRatio) * 1.4) * perspective;
            const width = clamp(widthBase + widthBoost, 0.025, 9.2);
            context.strokeStyle = colorEnabled
                ? toGradientColor(gradient, colorRatio, alpha)
                : `rgba(206, 218, 244, ${alpha})`;
            context.lineWidth = width;

            const dx = segment.targetX - segment.sourceX;
            const dy = segment.targetY - segment.sourceY;
            const length = Math.max(1, Math.hypot(dx, dy));
            const nx = -dy / length;
            const ny = dx / length;
            const curvature = (0.55 + (1 - hitRatio) * 1.28) * segment.curve * perspective * 10.5;
            const controlX = (segment.sourceX + segment.targetX) / 2 + nx * curvature;
            const controlY = (segment.sourceY + segment.targetY) / 2 + ny * curvature;

            if (localProgress >= 0.999) {
                context.beginPath();
                context.moveTo(segment.sourceX, segment.sourceY);
                context.quadraticCurveTo(controlX, controlY, segment.targetX, segment.targetY);
                context.stroke();
                continue;
            }

            const start = {x: segment.sourceX, y: segment.sourceY};
            const control = {x: controlX, y: controlY};
            const end = {x: segment.targetX, y: segment.targetY};
            const samples = 6 + Math.floor(localProgress * 16);
            context.beginPath();
            context.moveTo(start.x, start.y);
            for (let step = 1; step <= samples; step += 1) {
                const t = (step / samples) * localProgress;
                const point = quadraticPoint(start, control, end, t);
                context.lineTo(point.x, point.y);
            }
            context.stroke();
        }

        const projectedNodes = model.nodes
            .map((node) => {
                const point = project(node.position);
                if (!point) {
                    return null;
                }
                const hitRatio = clamp(Math.log1p(node.hits) / model.maxLogHit, 0, 1);
                const perspective = clamp(25 / point.depth, 0.32, 1.65);
                const radius = clamp((0.6 + hitRatio * 1.6) * perspective, 0.8, 4.6);
                return {
                    x: point.x,
                    y: point.y,
                    depth: point.depth,
                    radius,
                    value: node.value,
                    depthFromRoot: node.depth,
                    hits: node.hits,
                };
            })
            .filter((node): node is ProjectedNode => node !== null)
            .sort((left, right) => right.depth - left.depth);
        projectedNodesRef.current = projectedNodes;
    }, [
        cameraDistance,
        containerSize.height,
        containerSize.width,
        drag,
        gradient,
        isWheeling,
        model.center,
        model.maxLogHit,
        model.nodes,
        model.segments,
        model.maxDepth,
        animationProgress,
        colorEnabled,
        tailVisibilityLevel,
        pan.x,
        pan.y,
        rotation.x,
        rotation.y,
        zoom,
    ]);

    function updateHover(clientX: number, clientY: number) {
        const container = containerRef.current;
        if (!container) {
            setHoverNode(null);
            return;
        }
        const rect = container.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        let hit: ProjectedNode | null = null;
        for (const node of projectedNodesRef.current) {
            const dx = localX - node.x;
            const dy = localY - node.y;
            const radius = node.radius + 3.4;
            if (dx * dx + dy * dy > radius * radius) {
                continue;
            }
            if (!hit || node.depth < hit.depth) {
                hit = node;
            }
        }
        if (!hit) {
            setHoverNode(null);
            return;
        }
        setHoverNode({
            localX: hit.x,
            localY: hit.y,
            value: hit.value,
            depth: hit.depthFromRoot,
            hits: hit.hits,
        });
    }

    function onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({
            pointerX: event.clientX,
            pointerY: event.clientY,
            mode: event.ctrlKey ? 'pan' : 'rotate',
            panX: pan.x,
            panY: pan.y,
            rotationX: rotation.x,
            rotationY: rotation.y,
        });
        setHoverNode(null);
    }

    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        if (!drag) {
            if (isWheeling) {
                setHoverNode(null);
                return;
            }
            updateHover(event.clientX, event.clientY);
            return;
        }
        const deltaX = event.clientX - drag.pointerX;
        const deltaY = event.clientY - drag.pointerY;
        if (drag.mode === 'pan') {
            setPan({
                x: drag.panX + deltaX,
                y: drag.panY + deltaY,
            });
            return;
        }
        setRotation({
            x: clamp(drag.rotationX + deltaY * 0.0062, -1.52, 1.52),
            y: drag.rotationY + deltaX * 0.0062,
        });
    }

    function onPointerUp(event: PointerEvent<HTMLDivElement>) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setDrag(null);
        updateHover(event.clientX, event.clientY);
    }

    return (
        <Box
            ref={containerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => {
                setDrag(null);
                setHoverNode(null);
            }}
            sx={{
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'transparent',
                height: {xs: 440, md: 620},
                position: 'relative',
                cursor: drag ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                overscrollBehavior: 'contain',
                '& *:focus, & *:focus-visible': {
                    outline: 'none !important',
                },
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                }}
            />
            <Box
                sx={{
                    position: 'absolute',
                    top: 8,
                    left: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.7,
                    zIndex: 20,
                }}
                onPointerDown={(event) => {
                    event.stopPropagation();
                }}
                onPointerMove={(event) => {
                    event.stopPropagation();
                }}
                onPointerUp={(event) => {
                    event.stopPropagation();
                }}
                onClick={(event) => {
                    event.stopPropagation();
                }}
            >
                <Button
                    size='small'
                    variant='outlined'
                    onClick={(event) => {
                        event.stopPropagation();
                        onStartGrowth();
                    }}
                    sx={{
                        minWidth: 58,
                        px: 0.95,
                        py: 0.2,
                        borderColor: 'rgba(164, 178, 208, 0.34)',
                        color: 'text.secondary',
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        fontSize: 11,
                        textTransform: 'none',
                        '&:hover': {
                            borderColor: 'rgba(164, 178, 208, 0.5)',
                            bgcolor: 'rgba(255, 255, 255, 0.06)',
                        },
                    }}
                >
                    Start
                </Button>
                <Button
                    size='small'
                    variant='outlined'
                    onClick={(event) => {
                        event.stopPropagation();
                        onStopGrowth();
                    }}
                    disabled={!isAnimatingGrowth}
                    sx={{
                        minWidth: 56,
                        px: 0.9,
                        py: 0.2,
                        borderColor: 'rgba(164, 178, 208, 0.28)',
                        color: 'text.secondary',
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        fontSize: 11,
                        textTransform: 'none',
                        '&:hover': {
                            borderColor: 'rgba(164, 178, 208, 0.45)',
                            bgcolor: 'rgba(255, 255, 255, 0.06)',
                        },
                    }}
                >
                    Stop
                </Button>
            </Box>
            {hoverNode ? (
                <Paper
                    elevation={6}
                    sx={{
                        position: 'absolute',
                        left: clamp(hoverNode.localX + 14, 8, containerSize.width - 208),
                        top: clamp(hoverNode.localY + 14, 8, containerSize.height - 92),
                        px: 1.2,
                        py: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        pointerEvents: 'none',
                        minWidth: 190,
                        zIndex: 25,
                        boxShadow: '0 12px 30px rgba(8,10,24,0.55)',
                        bgcolor: 'rgba(14, 20, 36, 0.72)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                    }}
                >
                    <Typography variant='body2' sx={{fontWeight: 700}}>
                        Value {hoverNode.value}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' sx={{display: 'block'}}>
                        Steps to 1: {hoverNode.depth}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' sx={{display: 'block'}}>
                        Traversals: {hoverNode.hits}
                    </Typography>
                </Paper>
            ) : null}
            <Box
                sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    px: 1.2,
                    py: 0.75,
                    bgcolor: 'transparent',
                }}
            >
                <Typography variant='caption' color='text.secondary'>
                    3D flow arcs: {sampleCount} random starts below {maxStart.toLocaleString('en-US')}, even turn +8.65
                    deg,
                    odd turn -16 deg, edge length~1/log(node), style~log1p(traversals), width~log1p(traversals),
                    tail visibility {tailVisibilityLevel.toFixed(1)}x. Drag to orbit, wheel to zoom.
                </Typography>
            </Box>
            <Box
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 10,
                    px: 0.9,
                    py: 0.45,
                    borderRadius: 1,
                    bgcolor: 'rgba(10, 16, 30, 0.62)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(180, 192, 224, 0.2)',
                }}
            >
                <Typography variant='caption' color='text.secondary'>
                    nodes={model.uniqueNodeCount}, edges={model.uniqueEdgeCount}, min_hits={model.renderHitThreshold}
                </Typography>
            </Box>
        </Box>
    );
}
