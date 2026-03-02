import type {PointerEvent} from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Paper, Typography} from '@mui/material';
import type {ConvergenceTreeData} from '../types';
import {buildTreeGradient, toGradientColor} from './treeGradient';

interface Props {
    data: ConvergenceTreeData;
    turnDeg: number;
    colorEnabled: boolean;
    colorSeed: number;
}

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

interface Node3D {
    id: string;
    value: number;
    hits: number;
    depth: number;
    position: Vec3;
}

interface Segment3D {
    source: Vec3;
    target: Vec3;
    depth: number;
}

interface Layout3D {
    nodes: Node3D[];
    segments: Segment3D[];
    maxDepth: number;
    modelCenter: Vec3;
    bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
    };
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
    layer: number;
    hits: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function toFinite(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}

function toRad(value: number): number {
    return (value * Math.PI) / 180;
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

function addVec(left: Vec3, right: Vec3): Vec3 {
    return {x: left.x + right.x, y: left.y + right.y, z: left.z + right.z};
}

function scaleVec(value: Vec3, factor: number): Vec3 {
    return {x: value.x * factor, y: value.y * factor, z: value.z * factor};
}

function lengthVec(value: Vec3): number {
    return Math.hypot(value.x, value.y, value.z);
}

function normalizeVec(value: Vec3, fallback: Vec3): Vec3 {
  const length = lengthVec(value);
  if (length < 1e-9) {
    return fallback;
  }
  return scaleVec(value, 1 / length);
}

function bendPointByDepth(point: Vec3, depth: number, turnRad: number): Vec3 {
  if (depth <= 0 || turnRad === 0) {
    return point;
  }

  const bendAngle = depth * turnRad;
  const bendCos = Math.cos(bendAngle);
  const bendSin = Math.sin(bendAngle);
  const bentX = point.x * bendCos - point.y * bendSin;
  const bentY = point.x * bendSin + point.y * bendCos;

  const twistAngle = depth * turnRad * 0.28;
  const twistCos = Math.cos(twistAngle);
  const twistSin = Math.sin(twistAngle);

  return {
    x: bentX * twistCos - point.z * twistSin,
    y: bentY,
    z: bentX * twistSin + point.z * twistCos,
  };
}

function getRootId(data: ConvergenceTreeData, rawNodeById: Map<string, (typeof data.nodes)[number]>): string {
  if (data.root && rawNodeById.has(data.root)) {
    return data.root;
  }
    const byValue = data.nodes.find((node) => toFinite(node.value, 0) === 1);
    if (byValue) {
        return byValue.id;
    }
    return data.nodes[0]?.id ?? '1';
}

function buildGeometry(data: ConvergenceTreeData, turnDeg: number): Layout3D {
    const safeMaxDepth = Math.max(0, toFinite(data.max_depth, 0));
    const turnRad = toRad(turnDeg);
    const rawNodeById = new Map(data.nodes.map((node) => [node.id, node]));
    const rootId = getRootId(data, rawNodeById);

    const depthByNodeId = new Map<string, number>();
    const nodesByDepth = new Map<number, string[]>();
    for (const node of data.nodes) {
        const depth = clamp(toFinite(node.depth, 0), 0, safeMaxDepth);
        depthByNodeId.set(node.id, depth);
        const layer = nodesByDepth.get(depth) ?? [];
        layer.push(node.id);
        nodesByDepth.set(depth, layer);
    }

    const parentByNode = new Map<string, string>();
    const childrenByParent = new Map<string, string[]>();
    for (const edge of data.edges) {
        const source = rawNodeById.get(edge.source);
        const target = rawNodeById.get(edge.target);
        if (!source || !target) {
            continue;
        }
        const sourceDepth = clamp(toFinite(source.depth, 0), 0, safeMaxDepth);
        const targetDepth = clamp(toFinite(target.depth, 0), 0, safeMaxDepth);

        if (sourceDepth > targetDepth) {
            if (!parentByNode.has(source.id)) {
                parentByNode.set(source.id, target.id);
            }
            continue;
        }
        if (targetDepth > sourceDepth) {
            if (!parentByNode.has(target.id)) {
                parentByNode.set(target.id, source.id);
            }
            continue;
        }
    }

    for (const [nodeId, parentId] of parentByNode.entries()) {
        const children = childrenByParent.get(parentId) ?? [];
        children.push(nodeId);
        childrenByParent.set(parentId, children);
    }
    for (const [parentId, children] of childrenByParent.entries()) {
        children.sort((leftId, rightId) => {
            const leftNode = rawNodeById.get(leftId);
            const rightNode = rawNodeById.get(rightId);
            const leftX = leftNode ? clamp(toFinite(leftNode.x, 0.5), 0, 1) : 0.5;
            const rightX = rightNode ? clamp(toFinite(rightNode.x, 0.5), 0, 1) : 0.5;
            if (leftX !== rightX) {
                return leftX - rightX;
            }
            const leftValue = leftNode ? toFinite(leftNode.value, 0) : 0;
            const rightValue = rightNode ? toFinite(rightNode.value, 0) : 0;
            return leftValue - rightValue;
        });
        childrenByParent.set(parentId, children);
    }

    const positionById = new Map<string, Vec3>();
    const directionById = new Map<string, Vec3>();
    const phaseById = new Map<string, number>();

    positionById.set(rootId, {x: 0, y: 0, z: 0});
    directionById.set(rootId, {x: 0, y: 1, z: 0});
    phaseById.set(rootId, 0);

    for (let depth = 1; depth <= safeMaxDepth; depth += 1) {
        const layerIds = nodesByDepth.get(depth) ?? [];
        for (const nodeId of layerIds) {
            const parentId = parentByNode.get(nodeId);
            if (!parentId) {
                continue;
            }
            const parentPosition = positionById.get(parentId);
            const parentDirection = directionById.get(parentId);
            if (!parentPosition || !parentDirection) {
                continue;
            }

            const siblings = childrenByParent.get(parentId) ?? [nodeId];
            const siblingIndex = Math.max(0, siblings.indexOf(nodeId));
            const siblingCount = siblings.length;
            const centered = siblingCount <= 1
                ? 0
                : (siblingIndex / (siblingCount - 1)) * 2 - 1;

            const depthRatio = safeMaxDepth === 0 ? 0 : depth / safeMaxDepth;
            const parentPhase = phaseById.get(parentId) ?? 0;
      const sourceNode = rawNodeById.get(nodeId);
      const value = sourceNode ? Math.abs(toFinite(sourceNode.value, 0)) : 0;
      const hashUnit = ((value * 92821 + depth * 6899 + siblingIndex * 97) % 1000) / 1000;
      const fan = Math.PI * (0.34 + depthRatio * 0.22);
      const phase =
        parentPhase
        + centered * fan
        + (hashUnit - 0.5) * (0.26 + depthRatio * 0.18);

            const lateral = normalizeVec(
                {
                    x: Math.cos(phase),
                    y: 0,
                    z: Math.sin(phase),
                },
                {x: 1, y: 0, z: 0},
            );
      const siblingSpread = siblingCount <= 1 ? 0.95 : 1 + Math.abs(centered) * 0.58;
      const radialStep = (0.17 + depthRatio * 0.44) * siblingSpread;
      const verticalStep = 0.62 + depthRatio * 0.09;
            const candidatePosition = addVec(
                parentPosition,
                {
                    x: lateral.x * radialStep,
                    y: verticalStep,
                    z: lateral.z * radialStep,
                },
            );
            const nodePosition = {
                x: candidatePosition.x,
                y: Math.max(candidatePosition.y, parentPosition.y + verticalStep * 0.42),
                z: candidatePosition.z,
            };
            const branchDirection = normalizeVec(
                {
                    x: lateral.x * 0.72 + parentDirection.x * 0.16,
                    y: 1,
                    z: lateral.z * 0.72 + parentDirection.z * 0.16,
                },
                {x: 0, y: 1, z: 0},
            );

            positionById.set(nodeId, nodePosition);
            directionById.set(nodeId, branchDirection);
            phaseById.set(nodeId, phase);
        }
    }

    for (let depth = 0; depth <= safeMaxDepth; depth += 1) {
        const layerIds = nodesByDepth.get(depth) ?? [];
        const count = layerIds.length;
        for (let index = 0; index < count; index += 1) {
            const nodeId = layerIds[index];
      if (positionById.has(nodeId)) {
        continue;
      }
      const ratio = count <= 1 ? 0.5 : index / (count - 1);
      const angle = -Math.PI + ratio * Math.PI * 2;
      const radius = 0.2 + depth * 0.11;
      const y = depth * 0.9;
      const position = {
        x: Math.cos(angle) * radius,
        y,
                z: Math.sin(angle) * radius,
            };
            positionById.set(nodeId, position);
            directionById.set(nodeId, normalizeVec({x: position.x, y: 1, z: position.z}, {x: 0, y: 1, z: 0}));
            phaseById.set(nodeId, angle);
        }
    }

  const nodes: Node3D[] = data.nodes
    .map((node) => {
      const basePosition = positionById.get(node.id);
      if (!basePosition) {
        return null;
      }
      const depth = depthByNodeId.get(node.id) ?? 0;
      const position = bendPointByDepth(basePosition, depth, turnRad);
      return {
        id: node.id,
        value: toFinite(node.value, 0),
          hits: Math.max(0, toFinite(node.hits, 0)),
        depth,
        position,
      };
    })
        .filter((node): node is Node3D => node !== null);

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const segments: Segment3D[] = [];
    for (const edge of data.edges) {
        const sourceRaw = rawNodeById.get(edge.source);
        const targetRaw = rawNodeById.get(edge.target);
        if (!sourceRaw || !targetRaw) {
            continue;
        }
        if (toFinite(sourceRaw.value, 0) === 1 && toFinite(targetRaw.value, 0) === 4) {
            continue;
        }
        if (toFinite(sourceRaw.depth, 0) <= toFinite(targetRaw.depth, 0)) {
            continue;
        }
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) {
            continue;
        }
        segments.push({
            source: source.position,
            target: target.position,
            depth: Math.max(source.depth, target.depth),
        });
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const node of nodes) {
        minX = Math.min(minX, node.position.x);
        maxX = Math.max(maxX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxY = Math.max(maxY, node.position.y);
        minZ = Math.min(minZ, node.position.z);
        maxZ = Math.max(maxZ, node.position.z);
    }

    if (!Number.isFinite(minX)) {
        minX = -1;
        maxX = 1;
        minY = -1;
        maxY = 1;
        minZ = -1;
        maxZ = 1;
    }

    const modelCenter = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
    };

    return {
        nodes,
        segments,
        maxDepth: Math.max(1, safeMaxDepth),
        modelCenter,
        bounds: {minX, maxX, minY, maxY, minZ, maxZ},
    };
}

function projectRaw(
    point: Vec3,
    rotationX: number,
    rotationY: number,
    cameraDistance: number,
    focal: number,
    modelCenter: Vec3,
): ProjectedPoint | null {
    const local = {
        x: point.x - modelCenter.x,
        y: point.y - modelCenter.y,
        z: point.z - modelCenter.z,
    };
    const rotatedLocal = rotatePoint(local, rotationX, rotationY);
    const rotated = addVec(rotatedLocal, modelCenter);
    const depth = cameraDistance + rotated.z;
    if (depth <= 0.1) {
        return null;
    }
    return {
        x: (rotated.x * focal) / depth,
        y: (-rotated.y * focal) / depth,
        depth,
    };
}

export function ConvergenceTree3DView({data, turnDeg, colorEnabled, colorSeed}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const projectedNodesRef = useRef<ProjectedNode[]>([]);
    const wheelTimerRef = useRef<number | null>(null);

    const [containerSize, setContainerSize] = useState({width: 980, height: 620});
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState({x: 0.18, y: 0.64});
    const [pan, setPan] = useState({x: 0, y: 0});
    const [drag, setDrag] = useState<DragState | null>(null);
    const [hoverNode, setHoverNode] = useState<HoverNodeState | null>(null);
    const [isWheeling, setIsWheeling] = useState(false);

    const geometry = useMemo(() => buildGeometry(data, turnDeg), [data, turnDeg]);
    const gradient = useMemo(() => buildTreeGradient(colorSeed), [colorSeed]);

    const cameraDistance = useMemo(() => {
        const spanX = Math.max(1, geometry.bounds.maxX - geometry.bounds.minX);
        const spanY = Math.max(1, geometry.bounds.maxY - geometry.bounds.minY);
        const spanZ = Math.max(1, geometry.bounds.maxZ - geometry.bounds.minZ);
        const span = Math.max(spanX, spanY, spanZ);
        return Math.max(10, span * 2.4);
    }, [
        geometry.bounds.maxX,
        geometry.bounds.maxY,
        geometry.bounds.maxZ,
        geometry.bounds.minX,
        geometry.bounds.minY,
        geometry.bounds.minZ,
    ]);

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
        const baseRotation = {x: 0.18, y: 0.64};
        setRotation(baseRotation);
        const focal = Math.min(containerSize.width, containerSize.height) * 0.84;

        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const node of geometry.nodes) {
            const projected = projectRaw(
                node.position,
                baseRotation.x,
                baseRotation.y,
                cameraDistance,
                focal,
                geometry.modelCenter,
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
        const centerProjected = projectRaw(
            geometry.modelCenter,
            baseRotation.x,
            baseRotation.y,
            cameraDistance,
            focal,
            geometry.modelCenter,
        ) ?? {x: 0, y: 0, depth: cameraDistance};

        setZoom(fitZoom);
        setPan({
            x: containerSize.width / 2 - centerProjected.x * fitZoom,
            y: containerSize.height / 2 - centerProjected.y * fitZoom,
        });
    }, [cameraDistance, containerSize.height, containerSize.width, geometry.nodes, geometry.modelCenter]);

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

        const focal = Math.min(containerSize.width, containerSize.height) * 0.84 * zoom;
        const centerX = pan.x;
        const centerY = pan.y;

        function project(point: Vec3): ProjectedPoint | null {
            const raw = projectRaw(point, rotation.x, rotation.y, cameraDistance, focal, geometry.modelCenter);
            if (!raw) {
                return null;
            }
            return {
                x: centerX + raw.x,
                y: centerY + raw.y,
                depth: raw.depth,
            };
        }

        const projectedSegments = geometry.segments
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
                    layer: segment.depth,
                };
            })
            .filter((segment): segment is NonNullable<typeof segment> => segment !== null);
        projectedSegments.sort((left, right) => right.depth - left.depth);

        for (const segment of projectedSegments) {
            const layerRatio = 1 - clamp(segment.layer / geometry.maxDepth, 0, 1);
            const perspective = clamp(28 / segment.depth, 0.36, 1.52);
            const alpha = clamp(0.24 + layerRatio * 0.5, 0.18, 0.86);
            const zoomBoost = clamp(Math.pow(Math.max(zoom, 0.25), 0.3), 0.75, 2.2);
            const width = clamp((0.95 + layerRatio * 1.45) * perspective * zoomBoost, 0.7, 3.8);
            context.strokeStyle = colorEnabled
                ? toGradientColor(gradient, layerRatio, alpha)
                : `rgba(196, 212, 245, ${alpha})`;
            context.lineWidth = width;
            context.beginPath();
            context.moveTo(segment.sourceX, segment.sourceY);
            context.lineTo(segment.targetX, segment.targetY);
            context.stroke();
        }

        const projectedNodes = geometry.nodes
            .map((node) => {
                const point = project(node.position);
                if (!point) {
                    return null;
                }
                const layerRatio = 1 - clamp(node.depth / geometry.maxDepth, 0, 1);
                const perspective = clamp(26 / point.depth, 0.38, 1.7);
                const radius = clamp((1.28 + layerRatio * 1.85) * perspective, 1.2, 5.1);
                return {
                    x: point.x,
                    y: point.y,
                    depth: point.depth,
                    radius,
                    value: node.value,
                    layer: node.depth,
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
        geometry.maxDepth,
        geometry.modelCenter,
        geometry.segments,
        pan.x,
        pan.y,
        rotation.x,
        rotation.y,
        zoom,
        drag,
        isWheeling,
        geometry.nodes,
        colorEnabled,
        gradient,
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
            const radius = node.radius + 3.2;
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
            depth: hit.layer,
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
                        Hits across starts: {hoverNode.hits}
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
                    3D tree: drag to orbit, wheel to zoom, Ctrl+drag to pan. Turn={turnDeg} deg.
                </Typography>
            </Box>
        </Box>
    );
}
