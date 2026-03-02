import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Box, Typography } from '@mui/material';
import type { ConvergenceTreeData } from '../types';

interface Props {
  data: ConvergenceTreeData;
  turnDeg: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Node3D {
  id: string;
  value: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
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

function buildLayout(data: ConvergenceTreeData, turnDeg: number): Layout3D {
  const safeMaxDepth = Math.max(0, toFinite(data.max_depth, 0));
  const nodesByDepth = new Map<number, Array<{ id: string; x: number; value: number; depth: number }>>();
  const sourceNodeById = new Map(data.nodes.map((node) => [node.id, node]));

  let maxNodesInLayer = 1;
  for (const node of data.nodes) {
    const depth = clamp(toFinite(node.depth, 0), 0, safeMaxDepth);
    const layer = nodesByDepth.get(depth) ?? [];
    layer.push({
      id: node.id,
      x: clamp(toFinite(node.x, 0.5), 0, 1),
      value: toFinite(node.value, 0),
      depth,
    });
    nodesByDepth.set(depth, layer);
    maxNodesInLayer = Math.max(maxNodesInLayer, layer.length);
  }

  const turnSign = Math.sign(turnDeg);
  const turnAbs = Math.abs(turnDeg);
  const baseWidth = Math.max(4.2, maxNodesInLayer * 0.12);
  const depthStep = 1.05;
  const positionedNodes = new Map<string, Node3D>();

  for (let depth = 0; depth <= safeMaxDepth; depth += 1) {
    const layer = [...(nodesByDepth.get(depth) ?? [])].sort((left, right) => left.x - right.x);
    if (!layer.length) {
      continue;
    }

    const progress = safeMaxDepth === 0 ? 0 : depth / safeMaxDepth;
    const spreadX = 1 + progress * 0.22;
    const spreadZ = 0.45 + progress * 1.85;
    const bendX = turnSign * turnAbs * Math.pow(progress, 1.34) * (safeMaxDepth + 5) * 0.078;
    const bendZ = turnSign * turnAbs * Math.pow(progress, 1.22) * (safeMaxDepth + 5) * 0.022;

    const meanX = layer.reduce((acc, node) => acc + node.x, 0) / layer.length;
    for (let index = 0; index < layer.length; index += 1) {
      const node = layer[index];
      const ratio = layer.length <= 1 ? 0.5 : index / (layer.length - 1);
      const centered = ratio * 2 - 1;
      const baseX = (node.x - meanX) * baseWidth * spreadX;

      positionedNodes.set(node.id, {
        id: node.id,
        value: node.value,
        depth: node.depth,
        position: {
          x: baseX + bendX,
          y: -depth * depthStep,
          z: centered * baseWidth * spreadZ * 0.72 + bendZ + baseX * (0.12 + progress * 0.07),
        },
      });
    }
  }

  const rootNode = positionedNodes.get(data.root)
    ?? [...positionedNodes.values()].find((node) => node.value === 1)
    ?? [...positionedNodes.values()][0];
  const shiftX = rootNode ? -rootNode.position.x : 0;
  const shiftY = rootNode ? -rootNode.position.y : 0;
  const shiftZ = rootNode ? -rootNode.position.z : 0;

  const nodes = [...positionedNodes.values()].map((node) => ({
    ...node,
    position: {
      x: node.position.x + shiftX,
      y: node.position.y + shiftY,
      z: node.position.z + shiftZ,
    },
  }));

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const segments: Segment3D[] = [];
  for (const edge of data.edges) {
    const sourceNode = sourceNodeById.get(edge.source);
    const targetNode = sourceNodeById.get(edge.target);
    if (!sourceNode || !targetNode) {
      continue;
    }
    if (toFinite(sourceNode.value, 0) === 1 && toFinite(targetNode.value, 0) === 4) {
      continue;
    }
    if (toFinite(sourceNode.depth, 0) <= toFinite(targetNode.depth, 0)) {
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

  return {
    nodes,
    segments,
    maxDepth: Math.max(1, safeMaxDepth),
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
  };
}

export function ConvergenceTree3DView({ data, turnDeg }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 980, height: 620 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState({ x: -0.54, y: 0.72 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);

  const geometry = useMemo(() => buildLayout(data, turnDeg), [data, turnDeg]);

  const cameraDistance = useMemo(() => {
    const spanX = Math.max(1, geometry.bounds.maxX - geometry.bounds.minX);
    const spanY = Math.max(1, geometry.bounds.maxY - geometry.bounds.minY);
    const spanZ = Math.max(1, geometry.bounds.maxZ - geometry.bounds.minZ);
    const span = Math.max(spanX, spanY, spanZ);
    return Math.max(12, span * 2.2);
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
      setContainerSize({ width, height });
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
      const factor = event.deltaY < 0 ? 1.14 : 0.88;
      setZoom((current) => clamp(current * factor, 0.04, 120));
    }
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const baseRotation = { x: -0.54, y: 0.72 };
    setRotation(baseRotation);

    const focal = Math.min(containerSize.width, containerSize.height) * 0.84;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of geometry.nodes) {
      const rotated = rotatePoint(node.position, baseRotation.x, baseRotation.y);
      const depth = cameraDistance + rotated.z;
      if (depth <= 0.1) {
        continue;
      }
      const px = (rotated.x * focal) / depth;
      const py = (-rotated.y * focal) / depth;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }

    if (!Number.isFinite(minX)) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const fitZoom = clamp(
      Math.min((containerSize.width * 0.82) / spanX, (containerSize.height * 0.82) / spanY),
      0.08,
      24,
    );
    setZoom(fitZoom);
    setPan({
      x: -((minX + maxX) / 2) * fitZoom,
      y: -((minY + maxY) / 2) * fitZoom,
    });
  }, [cameraDistance, containerSize.height, containerSize.width, geometry.nodes]);

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
    context.clearRect(0, 0, containerSize.width, containerSize.height);
    context.fillStyle = 'rgba(8, 10, 24, 0.78)';
    context.fillRect(0, 0, containerSize.width, containerSize.height);

    const focal = Math.min(containerSize.width, containerSize.height) * 0.84 * zoom;
    const centerX = containerSize.width / 2 + pan.x;
    const centerY = containerSize.height / 2 + pan.y;

    function project(point: Vec3): ProjectedPoint | null {
      const rotated = rotatePoint(point, rotation.x, rotation.y);
      const depth = cameraDistance + rotated.z;
      if (depth <= 0.1) {
        return null;
      }
      return {
        x: centerX + (rotated.x * focal) / depth,
        y: centerY - (rotated.y * focal) / depth,
        depth,
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
      .filter((segment): segment is NonNullable<typeof segment> => segment !== null)
      .sort((left, right) => right.depth - left.depth);

    for (const segment of projectedSegments) {
      const layerRatio = 1 - clamp(segment.layer / geometry.maxDepth, 0, 1);
      const alpha = clamp(0.3 + layerRatio * 0.52, 0.2, 0.86);
      const width = clamp(0.95 + layerRatio * 1.45, 0.9, 2.9);

      context.strokeStyle = `rgba(121, 145, 201, ${alpha * 0.5})`;
      context.lineWidth = width + 1.55;
      context.beginPath();
      context.moveTo(segment.sourceX, segment.sourceY);
      context.lineTo(segment.targetX, segment.targetY);
      context.stroke();

      context.strokeStyle = `rgba(220, 231, 255, ${alpha})`;
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(segment.sourceX, segment.sourceY);
      context.lineTo(segment.targetX, segment.targetY);
      context.stroke();
    }
  }, [
    cameraDistance,
    containerSize.height,
    containerSize.width,
    geometry.maxDepth,
    geometry.segments,
    pan.x,
    pan.y,
    rotation.x,
    rotation.y,
    zoom,
  ]);

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
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag) {
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
  }

  return (
    <Box
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setDrag(null)}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'rgba(8, 10, 24, 0.78)',
        height: { xs: 440, md: 620 },
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
          left: 0,
          right: 0,
          bottom: 0,
          px: 1.2,
          py: 0.75,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(8,10,24,0.72)',
        }}
      >
        <Typography variant='caption' color='text.secondary'>
          3D coral tree: drag to orbit, wheel to zoom, Ctrl+drag to pan. Turn={turnDeg} deg.
        </Typography>
      </Box>
    </Box>
  );
}
