import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import type { ConvergenceTreeData } from '../types';

interface Props {
  data: ConvergenceTreeData;
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

export function ConvergenceTreeView({ data }: Props) {
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

      const rect = container.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const nextZoom = clamp(currentZoom * zoomFactor, 0.2, 7);

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

  const layout = useMemo(() => {
    const paddingX = 60;
    const paddingTop = 28;
    const paddingBottom = 58;
    const safeMaxDepth = Math.max(0, toFinite(data.max_depth, 0));
    const levelCount = safeMaxDepth + 1;
    const rowHeight = 48;
    const countByDepth = new Map<number, number>();
    for (const node of data.nodes) {
      const depth = Math.max(0, Math.min(safeMaxDepth, toFinite(node.depth, 0)));
      countByDepth.set(depth, (countByDepth.get(depth) ?? 0) + 1);
    }
    const maxNodesInLayer = Math.max(1, ...countByDepth.values());
    const adaptiveNodeGap = maxNodesInLayer <= 80 ? 32 : maxNodesInLayer <= 160 ? 24 : 18;

    const width = Math.max(
      1100,
      containerSize.width * 1.1,
      paddingX * 2 + maxNodesInLayer * adaptiveNodeGap,
    );
    const height = Math.max(
      containerSize.height,
      paddingTop + paddingBottom + Math.max(1, levelCount - 1) * rowHeight + 50,
    );
    const innerWidth = Math.max(1, width - paddingX * 2);

    const nodes: NodePoint[] = data.nodes.map((node) => {
      const depth = Math.max(0, Math.min(safeMaxDepth, toFinite(node.depth, 0)));
      const normalizedX = clamp(toFinite(node.x, 0.5), 0, 1);
      return {
        id: node.id,
        value: toFinite(node.value, 0),
        hits: Math.max(0, toFinite(node.hits, 0)),
        depth,
        x: paddingX + normalizedX * innerWidth,
        y: height - paddingBottom - depth * rowHeight,
      };
    });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges: EdgePoint[] = data.edges
      .map((edge) => ({
        source: nodeById.get(edge.source),
        target: nodeById.get(edge.target),
      }))
      .filter(
        (edge): edge is EdgePoint => edge.source !== undefined && edge.target !== undefined,
      );

    return {
      width,
      height,
      maxNodesInLayer,
      nodes,
      edges,
    };
  }, [containerSize.height, containerSize.width, data.edges, data.max_depth, data.nodes]);

  useEffect(() => {
    const fitY = containerSize.height / layout.height;
    const initialZoom = clamp(fitY * 0.96, 0.32, 1.2);
    const root = layout.nodes.find((node) => node.value === 1) ?? layout.nodes[0];
    const focusX = root?.x ?? layout.width / 2;
    const focusY = root?.y ?? layout.height / 2;
    setZoom(initialZoom);
    setPan({
      x: containerSize.width / 2 - focusX * initialZoom,
      y: containerSize.height * 0.88 - focusY * initialZoom,
    });
  }, [containerSize.height, containerSize.width, layout.height, layout.nodes, layout.width]);

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

  function onPointerLeave() {
    setDrag(null);
    setHover(null);
  }

  return (
    <Box
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
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
          <marker
            id='cycle-arrow'
            markerWidth='7'
            markerHeight='7'
            refX='5'
            refY='3.5'
            orient='auto'
          >
            <path d='M 0 0 L 7 3.5 L 0 7 z' fill='rgba(220,230,255,0.9)' />
          </marker>
        </defs>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {layout.edges.map((edge, index) => {
            const isCycleEdge = edge.source.value === 1 && edge.target.value === 4;
            if (isCycleEdge) {
              const midY = (edge.source.y + edge.target.y) / 2;
              const bendX = edge.source.x + 52;
              return (
                <path
                  key={`curve-${edge.source.id}-${edge.target.id}-${index}`}
                  d={`M ${edge.source.x} ${edge.source.y} Q ${bendX} ${midY} ${edge.target.x} ${edge.target.y}`}
                  fill='none'
                  stroke='rgba(220,230,255,0.84)'
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

          {layout.nodes.map((node) => (
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
                  lines: [
                    `Steps to 1: ${node.depth}`,
                    `Hits across starts: ${node.hits}`,
                  ],
                });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={Math.max(3, Math.min(9, 14 - Math.log2(layout.maxNodesInLayer + 1)))}
                fill='#2d3543'
                stroke='rgba(171,183,208,0.82)'
                strokeWidth='0.9'
              />
              {zoom >= 0.78 ? (
                <text
                  x={node.x}
                  y={node.y + 2.9}
                  textAnchor='middle'
                  fontSize='8.2'
                  fill={theme.palette.text.primary}
                  style={{ pointerEvents: 'none' }}
                >
                  {node.value}
                </text>
              ) : null}
            </g>
          ))}
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
          Layered directed graph: nodes on one horizontal line have the same distance to 1.
        </Typography>
      </Box>
    </Box>
  );
}
