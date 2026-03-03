import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Button, Paper, Typography, useTheme} from '@mui/material';
import ForceGraph2D from 'react-force-graph-2d';
import type {TreeData} from '../types';

interface Props {
    data: TreeData;
}

interface GraphNode {
    id: string;
    name: string;
    hits: number;
    steps_to_1: number;
    val: number;
}

interface GraphLink {
    source: string;
    target: string;
    value: number;
    key: string;
}

export function NetworkChartView({data}: Props) {
    const theme = useTheme();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState({width: 960, height: 460});
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [mousePoint, setMousePoint] = useState({x: 0, y: 0});
    const [visibleLinks, setVisibleLinks] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            const width = Math.max(300, Math.floor(entry.contentRect.width));
            const isMobile = width < 760;
            setSize({width, height: isMobile ? 360 : 460});
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const preparedData = useMemo(() => {
        const nodes: GraphNode[] = data.nodes.map((node) => ({
            id: node.id,
            name: node.value.toString(),
            hits: node.hits,
            steps_to_1: node.steps_to_1,
            val: Math.max(1.8, Math.log10(node.hits + 1) * 4),
        }));
        const links: GraphLink[] = data.edges.map((edge) => ({
            source: edge.source,
            target: edge.target,
            value: Math.max(1, Math.log10(edge.weight + 1)),
            key: `${edge.source}:${edge.target}`,
        }));

        const degreeById = new Map<string, number>();
        for (const link of links) {
            degreeById.set(link.source, (degreeById.get(link.source) ?? 0) + 1);
            degreeById.set(link.target, (degreeById.get(link.target) ?? 0) + 1);
        }

        const outgoingBySource = new Map<string, GraphLink>();
        const incomingCount = new Map<string, number>();
        for (const link of links) {
            if (!outgoingBySource.has(link.source)) {
                outgoingBySource.set(link.source, link);
            }
            incomingCount.set(link.target, (incomingCount.get(link.target) ?? 0) + 1);
        }

        const startNodes = [...nodes]
            .filter((node) => (incomingCount.get(node.id) ?? 0) === 0 && outgoingBySource.has(node.id))
            .sort((left, right) => {
                if (left.steps_to_1 !== right.steps_to_1) {
                    return right.steps_to_1 - left.steps_to_1;
                }
                return Number(left.name) - Number(right.name);
            });

        const fallbackStarts = [...nodes]
            .filter((node) => outgoingBySource.has(node.id))
            .sort((left, right) => {
                if (left.steps_to_1 !== right.steps_to_1) {
                    return right.steps_to_1 - left.steps_to_1;
                }
                return Number(left.name) - Number(right.name);
            });

        const animationStartNodes = startNodes.length > 0 ? startNodes : fallbackStarts;
        const revealedKeys = new Set<string>();
        const revealSequence: string[] = [];
        const guardLimit = nodes.length + 8;

        for (const startNode of animationStartNodes) {
            let current = startNode.id;
            let guard = 0;
            while (guard < guardLimit) {
                const nextLink = outgoingBySource.get(current);
                if (!nextLink) {
                    break;
                }
                if (!revealedKeys.has(nextLink.key)) {
                    revealedKeys.add(nextLink.key);
                    revealSequence.push(nextLink.key);
                }
                current = nextLink.target;
                guard += 1;
            }
        }

        for (const link of links) {
            if (revealedKeys.has(link.key)) {
                continue;
            }
            revealedKeys.add(link.key);
            revealSequence.push(link.key);
        }

        const revealOrder = new Map<string, number>();
        for (let index = 0; index < revealSequence.length; index += 1) {
            revealOrder.set(revealSequence[index], index);
        }

        return {
            nodes,
            links,
            degreeById,
            revealOrder,
            revealCount: revealSequence.length,
        };
    }, [data.edges, data.nodes]);

    useEffect(() => {
        setVisibleLinks(preparedData.revealCount);
        setIsAnimating(false);
    }, [preparedData.revealCount]);

    useEffect(() => {
        if (!isAnimating) {
            return;
        }

        const linkCount = preparedData.revealCount;
        const tickMs = linkCount > 5000 ? 3 : linkCount > 2200 ? 4 : 7;
        const timerId = window.setInterval(() => {
            setVisibleLinks((current) => {
                if (current >= linkCount) {
                    setIsAnimating(false);
                    return current;
                }
                return current + 1;
            });
        }, tickMs);

        return () => window.clearInterval(timerId);
    }, [isAnimating, preparedData.revealCount]);

    const graphData = useMemo(
        () => ({
            nodes: preparedData.nodes,
            links: preparedData.links,
        }),
        [preparedData.links, preparedData.nodes],
    );

    function getLinkKey(link: { source: unknown; target: unknown }): string {
        const sourceId = typeof link.source === 'string'
            ? link.source
            : String((link.source as { id?: string }).id ?? '');
        const targetId = typeof link.target === 'string'
            ? link.target
            : String((link.target as { id?: string }).id ?? '');
        return `${sourceId}:${targetId}`;
    }

    function onStart() {
        setHoveredNode(null);
        setVisibleLinks(0);
        setIsAnimating(true);
    }

    function onStop() {
        setIsAnimating(false);
    }

    return (
        <Box
            ref={containerRef}
            onMouseMove={(event) => setMousePoint({x: event.clientX, y: event.clientY})}
            onMouseLeave={() => setHoveredNode(null)}
            sx={{
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'transparent',
                position: 'relative',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                '& *:focus, & *:focus-visible': {
                    outline: 'none !important',
                },
            }}
        >
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
                onMouseDown={(event) => {
                    event.stopPropagation();
                }}
                onClick={(event) => {
                    event.stopPropagation();
                }}
            >
                <Button
                    size='small'
                    variant='outlined'
                    onClick={onStart}
                    disabled={preparedData.revealCount === 0}
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
                    onClick={onStop}
                    disabled={!isAnimating}
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

            <ForceGraph2D
                graphData={graphData}
                width={size.width}
                height={size.height}
                backgroundColor='rgba(8, 10, 24, 0)'
                enableNodeDrag={false}
                cooldownTicks={80}
                warmupTicks={20}
                d3AlphaDecay={0.09}
                d3VelocityDecay={0.45}
                linkDirectionalArrowLength={2.6}
                linkDirectionalArrowRelPos={1}
                linkVisibility={(link) => {
                    const order = preparedData.revealOrder.get(getLinkKey(link as {
                        source: unknown;
                        target: unknown
                    }));
                    if (order === undefined) {
                        return false;
                    }
                    return order < visibleLinks;
                }}
                linkWidth={(link) => (link.value as number) * 0.45}
                linkColor={() => theme.palette.primary.dark}
                onNodeHover={(node) => setHoveredNode((node as GraphNode | null) ?? null)}
                nodeCanvasObject={(node, ctx, globalScale) => {
                    const label = node.name as string;
                    const hits = Number((node as GraphNode).hits ?? 1);
                    const fontSize = 10 / globalScale;
                    const radius = Math.max(2, Math.log10(hits + 1) * 2.4);
                    ctx.font = `${fontSize}px Trebuchet MS, sans-serif`;
                    ctx.fillStyle = theme.palette.secondary.main;
                    ctx.beginPath();
                    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false);
                    ctx.fill();
                    if (globalScale > 3.2) {
                        ctx.fillStyle = theme.palette.text.primary;
                        ctx.fillText(label, (node.x ?? 0) + 3, (node.y ?? 0) + 3);
                    }
                }}
            />

            {hoveredNode ? (
                <Paper
                    elevation={6}
                    sx={{
                        position: 'fixed',
                        left: mousePoint.x + 14,
                        top: mousePoint.y + 14,
                        px: 1.2,
                        py: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        pointerEvents: 'none',
                        minWidth: 190,
                        zIndex: 30,
                        boxShadow: '0 12px 30px rgba(8,10,24,0.55)',
                    }}
                >
                    <Typography variant='body2' sx={{fontWeight: 700}}>
                        Value {hoveredNode.name}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' sx={{display: 'block'}}>
                        Steps to 1: {hoveredNode.steps_to_1}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' sx={{display: 'block'}}>
                        Hits across starts: {hoveredNode.hits}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' sx={{display: 'block'}}>
                        Degree: {preparedData.degreeById.get(hoveredNode.id) ?? 0}
                    </Typography>
                </Paper>
            ) : null}

            <Box sx={{px: 1.2, py: 0.8}}>
                <Typography variant='caption' color='text.secondary'>
                    This view uses force-directed layout to show the full transition network n -&gt; f(n).
                    Nearby nodes share many transitions. Start/Stop animate trajectories path-by-path.
                </Typography>
            </Box>
        </Box>
    );
}
