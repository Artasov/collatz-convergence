import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import type { ConvergenceTreeData } from '../types';

interface Props {
  data: ConvergenceTreeData;
  turnDeg: number;
}

interface NodePoint {
  id: string;
  value: number;
  hits: number;
  depth: number;
  x: number;
  y: number;
}

interface EdgePoint {
  source: NodePoint;
  target: NodePoint;
}

interface Layout2D {
  nodes: NodePoint[];
  edges: EdgePoint[];
  nodeRadius: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

interface HoverState {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

interface DragState {
  pointerX: number;
  pointerY: number;
  panX: number;
  panY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function buildLayout(data: ConvergenceTreeData, turnDeg: number, containerHeight: number): Layout2D {
  const safeMaxDepth = Math.max(0, toFinite(data.max_depth, 0));
  const layerCount = safeMaxDepth + 1;

  const nodesByDepth = new Map<number, NodePoint[]>();
  let maxNodesInLayer = 1;
  for (const rawNode of data.nodes) {
    const depth = clamp(toFinite(rawNode.depth, 0), 0, safeMaxDepth);
    const node: NodePoint = {
      id: rawNode.id,
      value: toFinite(rawNode.value, 0),
      hits: Math.max(0, toFinite(rawNode.hits, 0)),
      depth,
      x: clamp(toFinite(rawNode.x, 0.5), 0, 1),
      y: 0,
    };
    const layer = nodesByDepth.get(depth) ?? [];
    layer.push(node);
    nodesByDepth.set(depth, layer);
    maxNodesInLayer = Math.max(maxNodesInLayer, layer.length);
  }

  const rowHeight = clamp((containerHeight - 132) / Math.max(1, layerCount - 1), 34, 56);
  const nodeRadius = clamp(10.6 - Math.log2(maxNodesInLayer + 1), 3.2, 9.2);
  const minGap = Math.max(nodeRadius * 2.15, 9.4);
  const baseLayerWidth = Math.max(260, maxNodesInLayer * minGap * 0.94);
  const turnSign = Math.sign(turnDeg);
  const turnAbs = Math.abs(turnDeg);

  const transformedById = new Map<string, NodePoint>();
  for (let depth = 0; depth <= safeMaxDepth; depth += 1) {
    const sourceLayer = nodesByDepth.get(depth) ?? [];
    if (!sourceLayer.length) {
      continue;
    }

    const progress = safeMaxDepth === 0 ? 0 : depth / safeMaxDepth;
    const spread = 1 + progress * 0.2;
    const bendX =
      turnSign
      * turnAbs
      * Math.pow(progress, 1.35)
      * (safeMaxDepth + 4)
      * 0.33;
    const bendY = turnSign * turnAbs * Math.pow(progress, 1.25) * rowHeight * 0.018;

    const layer = sourceLayer
      .map((node) => ({
        ...node,
        x: (node.x - 0.5) * baseLayerWidth * spread + bendX,
        y: -depth * rowHeight + bendY,
      }))
      .sort((left, right) => left.x - right.x);

    for (let index = 1; index < layer.length; index += 1) {
      const prev = layer[index - 1];
      const current = layer[index];
      const nextX = prev.x + minGap;
      if (current.x < nextX) {
        current.x = nextX;
      }
    }

    for (const node of layer) {
      transformedById.set(node.id, node);
    }
  }

  const rootNode = transformedById.get(data.root)
    ?? [...transformedById.values()].find((node) => node.value === 1)
    ?? [...transformedById.values()][0];
  const rootShiftX = rootNode ? -rootNode.x : 0;
  const rootShiftY = rootNode ? -rootNode.y : 0;

  const nodes = [...transformedById.values()].map((node) => ({
    ...node,
    x: node.x + rootShiftX,
    y: node.y + rootShiftY,
  }));

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = data.edges
    .map((edge) => ({
      source: nodeById.get(edge.source),
      target: nodeById.get(edge.target),
    }))
    .filter((edge): edge is EdgePoint => edge.source !== undefined && edge.target !== undefined);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }

  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minY = -1;
    maxY = 1;
  }

  return {
    nodes,
    edges,
    nodeRadius,
    bounds: {
      minX: minX - nodeRadius * 2,
      maxX: maxX + nodeRadius * 2,
      minY: minY - nodeRadius * 2,
      maxY: maxY + nodeRadius * 2,
    },
  };
}

export function ConvergenceTreeView({ data, turnDeg }: Props) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const [containerSize, setContainerSize] = useState({ width: 1100, height: 620 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = Math.max(760, Math.floor(entry.contentRect.width));
      const height = Math.max(420, Math.floor(entry.contentRect.height));
      setContainerSize({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

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

      const rect = container.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const zoomFactor = event.deltaY < 0 ? 1.13 : 0.89;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const nextZoom = clamp(currentZoom * zoomFactor, 0.16, 7.2);

      const worldX = (cursorX - currentPan.x) / currentZoom;
      const worldY = (cursorY - currentPan.y) / currentZoom;
      const nextPan = {
        x: cursorX - worldX * nextZoom,
        y: cursorY - worldY * nextZoom,
      };

      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    }

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  const layout = useMemo(
    () => buildLayout(data, turnDeg, containerSize.height),
    [containerSize.height, data, turnDeg],
  );

  useEffect(() => {
    const spanX = Math.max(1, layout.bounds.maxX - layout.bounds.minX);
    const spanY = Math.max(1, layout.bounds.maxY - layout.bounds.minY);
    const fitZoom = clamp(
      Math.min((containerSize.width * 0.9) / spanX, (containerSize.height * 0.8) / spanY),
      0.2,
      2.4,
    );
    const nextPan = {
      x: containerSize.width / 2,
      y: containerSize.height * 0.86,
    };
    setZoom(fitZoom);
    setPan(nextPan);
    zoomRef.current = fitZoom;
    panRef.current = nextPan;
  }, [
    containerSize.height,
    containerSize.width,
    layout.bounds.maxX,
    layout.bounds.maxY,
    layout.bounds.minX,
    layout.bounds.minY,
  ]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      pointerX: event.clientX,
      pointerY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    });
    setHover(null);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag) {
      return;
    }
    const offsetX = event.clientX - drag.pointerX;
    const offsetY = event.clientY - drag.pointerY;
    setPan({
      x: drag.panX + offsetX,
      y: drag.panY + offsetY,
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
      onPointerLeave={() => {
        setDrag(null);
        setHover(null);
      }}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'rgba(8, 10, 24, 0.78)',
        overflow: 'hidden',
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
      <svg width={containerSize.width} height={containerSize.height}>
        <defs>
          <marker id='cycle-arrow' markerWidth='7' markerHeight='7' refX='5' refY='3.5' orient='auto'>
            <path d='M 0 0 L 7 3.5 L 0 7 z' fill='rgba(220,230,255,0.9)' />
          </marker>
        </defs>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {layout.edges.map((edge, index) => {
            const isCycle = edge.source.value === 1 && edge.target.value === 4;
            if (isCycle) {
              const dx = edge.target.x - edge.source.x;
              const dy = edge.target.y - edge.source.y;
              const length = Math.max(1, Math.hypot(dx, dy));
              const nx = -dy / length;
              const ny = dx / length;
              const bend = Math.min(46, length * 0.72);
              const controlX = (edge.source.x + edge.target.x) / 2 + nx * bend;
              const controlY = (edge.source.y + edge.target.y) / 2 + ny * bend;
              return (
                <path
                  key={`cycle-${edge.source.id}-${edge.target.id}-${index}`}
                  d={`M ${edge.source.x} ${edge.source.y} Q ${controlX} ${controlY} ${edge.target.x} ${edge.target.y}`}
                  fill='none'
                  stroke='rgba(220,230,255,0.86)'
                  strokeWidth='1.35'
                  markerEnd='url(#cycle-arrow)'
                />
              );
            }
            return (
              <line
                key={`${edge.source.id}-${edge.target.id}-${index}`}
                x1={edge.source.x}
                y1={edge.source.y}
                x2={edge.target.x}
                y2={edge.target.y}
                stroke='rgba(220,230,255,0.84)'
                strokeWidth='1.1'
              />
            );
          })}

          {layout.nodes.map((node) => {
            const digits = String(Math.abs(node.value)).length;
            const fontSize = clamp(
              layout.nodeRadius * (digits >= 6 ? 0.54 : digits >= 4 ? 0.62 : 0.72),
              4.5,
              8.5,
            );
            return (
              <g
                key={node.id}
                onMouseMove={(event) => {
                  if (drag) {
                    return;
                  }
                  setHover({
                    x: event.clientX,
                    y: event.clientY,
                    title: `Value ${node.value}`,
                    lines: [`Steps to 1: ${node.depth}`, `Hits across starts: ${node.hits}`],
                  });
                }}
                onMouseLeave={() => setHover(null)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={layout.nodeRadius}
                  fill='#2d3543'
                  stroke='rgba(171,183,208,0.82)'
                  strokeWidth='0.9'
                />
                <text
                  x={node.x}
                  y={node.y + fontSize * 0.32}
                  textAnchor='middle'
                  fontSize={fontSize}
                  fill={theme.palette.text.primary}
                  style={{ pointerEvents: 'none' }}
                >
                  {node.value}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hover ? (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            left: hover.x + 14,
            top: hover.y + 14,
            px: 1.2,
            py: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(16, 21, 40, 0.97)',
            pointerEvents: 'none',
            minWidth: 190,
            zIndex: 25,
            boxShadow: '0 12px 30px rgba(8,10,24,0.55)',
          }}
        >
          <Typography variant='body2' sx={{ fontWeight: 700 }}>
            {hover.title}
          </Typography>
          {hover.lines.map((line) => (
            <Typography key={line} variant='caption' color='text.secondary' sx={{ display: 'block' }}>
              {line}
            </Typography>
          ))}
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
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(8,10,24,0.72)',
        }}
      >
        <Typography variant='caption' color='text.secondary'>
          Directed reverse tree by layers. Drag to pan, wheel to zoom. Turn={turnDeg} deg.
        </Typography>
      </Box>
    </Box>
  );
}
