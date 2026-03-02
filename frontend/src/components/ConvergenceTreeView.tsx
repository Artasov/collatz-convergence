import type {PointerEvent} from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Paper, Typography, useTheme} from '@mui/material';
import type {ConvergenceTreeData} from '../types';

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

function toRad(value: number): number {
    return (value * Math.PI) / 180;
}

function buildLayout(data: ConvergenceTreeData, turnDeg: number, containerHeight: number): Layout2D {
    const safeMaxDepth = Math.max(0, toFinite(data.max_depth, 0));
    const layerCount = safeMaxDepth + 1;

    const layers = new Map<number, NodePoint[]>();
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
        const layer = layers.get(depth) ?? [];
        layer.push(node);
        layers.set(depth, layer);
        maxNodesInLayer = Math.max(maxNodesInLayer, layer.length);
    }

    const rowHeight = clamp((containerHeight - 130) / Math.max(1, layerCount - 1), 34, 56);
    const nodeRadius = clamp(10.8 - Math.log2(maxNodesInLayer + 1), 3.2, 9.2);
    const minGap = Math.max(nodeRadius * 2.2, 9.2);
    const baseLayerWidth = Math.max(260, maxNodesInLayer * minGap * 0.94);

    const basePoints = new Map<string, NodePoint>();
    for (let depth = 0; depth <= safeMaxDepth; depth += 1) {
        const sourceLayer = [...(layers.get(depth) ?? [])].sort((left, right) => left.x - right.x);
        if (!sourceLayer.length) {
            continue;
        }

        const progress = safeMaxDepth === 0 ? 0 : depth / safeMaxDepth;
        const spread = 1 + progress * 0.2;
        const layer = sourceLayer.map((node) => ({
            ...node,
            x: (node.x - 0.5) * baseLayerWidth * spread,
            y: -depth * rowHeight,
        }));

        for (let index = 1; index < layer.length; index += 1) {
            const prev = layer[index - 1];
            const current = layer[index];
            const nextX = prev.x + minGap;
            if (current.x < nextX) {
                current.x = nextX;
            }
        }

        const meanX = layer.reduce((acc, node) => acc + node.x, 0) / layer.length;
        for (const node of layer) {
            basePoints.set(node.id, {
                ...node,
                x: node.x - meanX,
            });
        }
    }

    const turnRad = toRad(turnDeg);
    const transformedPoints = [...basePoints.values()].map((node) => {
        if (node.depth === 0 || turnDeg === 0) {
            return {...node};
        }
        const depthAngle = node.depth * turnRad;
        const cos = Math.cos(depthAngle);
        const sin = Math.sin(depthAngle);
        const radiusBoost = clamp(1 + Math.abs(turnRad) * node.depth * 0.045, 1, 4.2);
        const rx = node.x * radiusBoost;
        const ry = node.y * radiusBoost;
        return {
            ...node,
            x: rx * cos - ry * sin,
            y: rx * sin + ry * cos,
        };
    });

    const rootNode = transformedPoints.find((node) => node.id === data.root)
        ?? transformedPoints.find((node) => node.value === 1)
        ?? transformedPoints[0];
    const shiftX = rootNode ? -rootNode.x : 0;
    const shiftY = rootNode ? -rootNode.y : 0;

    const nodes = transformedPoints.map((node) => ({
        ...node,
        x: node.x + shiftX,
        y: node.y + shiftY,
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

export function ConvergenceTreeView({data, turnDeg}: Props) {
    const theme = useTheme();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const zoomRef = useRef(1);
    const panRef = useRef({x: 0, y: 0});
    const hoverNodeIdRef = useRef<string | null>(null);

    const [containerSize, setContainerSize] = useState({width: 1100, height: 620});
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({x: 0, y: 0});
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
            setContainerSize({width, height});
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
            const nextZoom = clamp(currentZoom * zoomFactor, 0.00005, 7.2);

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

        container.addEventListener('wheel', onWheel, {passive: false});
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    const layout = useMemo(
        () => buildLayout(data, turnDeg, containerSize.height),
        [containerSize.height, data, turnDeg],
    );
    const showLabels = zoom >= 0.55 && layout.nodes.length <= 2600;

    const edgeElements = useMemo(
        () => layout.edges.map((edge, index) => {
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
        }),
        [layout.edges],
    );

    const nodeElements = useMemo(
        () => layout.nodes.map((node) => {
            const digits = String(Math.abs(node.value)).length;
            const fontSize = clamp(
                layout.nodeRadius * (digits >= 6 ? 0.54 : digits >= 4 ? 0.62 : 0.72),
                4.5,
                8.5,
            );
            return (
                <g key={node.id}>
                    <circle
                        cx={node.x}
                        cy={node.y}
                        r={layout.nodeRadius}
                        fill='#2d3543'
                        stroke='rgba(171,183,208,0.82)'
                        strokeWidth='0.9'
                    />
                    {showLabels ? (
                        <text
                            x={node.x}
                            y={node.y + fontSize * 0.32}
                            textAnchor='middle'
                            fontSize={fontSize}
                            fill={theme.palette.text.primary}
                            style={{pointerEvents: 'none'}}
                        >
                            {node.value}
                        </text>
                    ) : null}
                </g>
            );
        }),
        [layout.nodeRadius, layout.nodes, showLabels, theme.palette.text.primary],
    );

    useEffect(() => {
        const spanX = Math.max(1, layout.bounds.maxX - layout.bounds.minX);
        const spanY = Math.max(1, layout.bounds.maxY - layout.bounds.minY);
        const fitZoom = clamp(
            Math.min((containerSize.width * 0.9) / spanX, (containerSize.height * 0.8) / spanY),
            0.00005,
            2.5,
        );
        const anchorY = data.max_depth > 28 ? 0.44 : 0.86;
        const nextPan = {
            x: containerSize.width / 2,
            y: containerSize.height * anchorY,
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
        data.max_depth,
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
        hoverNodeIdRef.current = null;
        setHover(null);
    }

    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        if (!drag) {
            const currentZoom = zoomRef.current;
            const currentPan = panRef.current;
            const rect = event.currentTarget.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;
            const worldX = (localX - currentPan.x) / currentZoom;
            const worldY = (localY - currentPan.y) / currentZoom;
            const hitRadius = layout.nodeRadius * 1.35;
            const hitRadiusSq = hitRadius * hitRadius;

            let hoveredNode: NodePoint | null = null;
            let bestDistSq = Number.POSITIVE_INFINITY;
            for (const node of layout.nodes) {
                const dx = worldX - node.x;
                const dy = worldY - node.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > hitRadiusSq || distSq >= bestDistSq) {
                    continue;
                }
                hoveredNode = node;
                bestDistSq = distSq;
            }

            if (!hoveredNode) {
                if (hoverNodeIdRef.current !== null) {
                    hoverNodeIdRef.current = null;
                    setHover(null);
                }
                return;
            }
            if (
                hoverNodeIdRef.current === hoveredNode.id
            ) {
                return;
            }
            hoverNodeIdRef.current = hoveredNode.id;
            setHover({
                x: event.clientX,
                y: event.clientY,
                title: `Value ${hoveredNode.value}`,
                lines: [`Steps to 1: ${hoveredNode.depth}`, `Hits across starts: ${hoveredNode.hits}`],
            });
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
                hoverNodeIdRef.current = null;
                setHover(null);
            }}
            sx={{
                borderRadius: 1,
                bgcolor: 'rgba(8, 10, 24, 0.78)',
                overflow: 'visible',
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
            <svg width={containerSize.width} height={containerSize.height}>
                <defs>
                    <marker id='cycle-arrow' markerWidth='7' markerHeight='7' refX='5' refY='3.5' orient='auto'>
                        <path d='M 0 0 L 7 3.5 L 0 7 z' fill='rgba(220,230,255,0.9)'/>
                    </marker>
                </defs>

                <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                    {edgeElements}
                    {nodeElements}
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
                    <Typography variant='body2' sx={{fontWeight: 700}}>
                        {hover.title}
                    </Typography>
                    {hover.lines.map((line) => (
                        <Typography key={line} variant='caption' color='text.secondary' sx={{display: 'block'}}>
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
