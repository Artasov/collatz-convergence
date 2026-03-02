import {useEffect, useMemo, useRef, useState} from 'react';
import {CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis,} from 'recharts';
import {Box, Typography, useTheme} from '@mui/material';
import {flushSync} from 'react-dom';
import type {XYData} from '../types';

interface Props {
    data: XYData;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function LineChartView({data}: Props) {
    const theme = useTheme();
    const frameRef = useRef<HTMLDivElement | null>(null);
    const zoomRef = useRef(1);
    const chartWidthRef = useRef(920);
    const [frameWidth, setFrameWidth] = useState(920);
    const [zoomX, setZoomX] = useState(1);

    useEffect(() => {
        if (!frameRef.current) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            setFrameWidth(Math.max(340, Math.floor(entry.contentRect.width)));
        });
        observer.observe(frameRef.current);
        return () => observer.disconnect();
    }, []);

    const chartWidth = useMemo(
        () => Math.max(frameWidth, Math.floor(frameWidth * zoomX)),
        [frameWidth, zoomX],
    );
    const yAxisWidth = useMemo(() => {
        const maxY = data.points.reduce((acc, point) => Math.max(acc, Math.abs(point.y)), 0);
        const digits = String(Math.floor(maxY)).length;
        return clamp(34 + digits * 7, 40, 96);
    }, [data.points]);

    useEffect(() => {
        zoomRef.current = zoomX;
    }, [zoomX]);

    useEffect(() => {
        chartWidthRef.current = chartWidth;
    }, [chartWidth]);

    useEffect(() => {
        const scroller = frameRef.current;
        if (!scroller) {
            return;
        }

        const onNativeWheel = (event: WheelEvent) => {
            if (event.cancelable) {
                event.preventDefault();
            }
            event.stopPropagation();

            if (!event.shiftKey) {
                const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
                scroller.scrollLeft += horizontalDelta;
                return;
            }

            const oldWidth = chartWidthRef.current;
            const delta = event.deltaY < 0 ? 0.18 : -0.18;
            const nextZoom = clamp(zoomRef.current + delta, 1, 10);
            const newWidth = Math.max(frameWidth, Math.floor(frameWidth * nextZoom));
            if (newWidth === oldWidth) {
                return;
            }

            const rect = scroller.getBoundingClientRect();
            const cursorViewportX = event.clientX - rect.left;
            const cursorContentX = scroller.scrollLeft + cursorViewportX;
            const ratio = newWidth / oldWidth;
            const nextScrollLeft = cursorContentX * ratio - cursorViewportX;

            flushSync(() => {
                setZoomX(nextZoom);
            });

            const maxLeft = Math.max(0, newWidth - scroller.clientWidth);
            scroller.scrollLeft = clamp(nextScrollLeft, 0, maxLeft);
        };

        scroller.addEventListener('wheel', onNativeWheel, {passive: false});
        return () => scroller.removeEventListener('wheel', onNativeWheel);
    }, [frameWidth]);

    return (
        <Box
            sx={{
                borderRadius: 1,
                overflow: 'visible',
                bgcolor: 'transparent',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                '& *:focus, & *:focus-visible': {
                    outline: 'none !important',
                },
            }}
        >
            <Box
                ref={frameRef}
                sx={{
                    px: 1,
                    pt: 1,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    cursor: 'crosshair',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(112,118,140,0.45) rgba(11,14,30,0.25)',
                    '&::-webkit-scrollbar': {
                        height: 7,
                    },
                    '&::-webkit-scrollbar-track': {
                        backgroundColor: 'rgba(11,14,30,0.22)',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        borderRadius: '999px',
                        backgroundColor: 'rgba(112,118,140,0.45)',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                        backgroundColor: 'rgba(138,145,170,0.62)',
                    },
                }}
            >
                <LineChart
                    width={chartWidth}
                    height={430}
                    data={data.points}
                    margin={{top: 10, right: 16, left: 6, bottom: 10}}
                >
                    <CartesianGrid strokeDasharray='4 4' stroke='rgba(130,140,170,0.32)'/>
                    <XAxis dataKey='x' stroke='rgba(220,228,255,0.68)'/>
                    <YAxis stroke='rgba(220,228,255,0.68)' width={yAxisWidth}/>
                    <Tooltip
                        content={({active, payload}) => {
                            if (!active || !payload?.length) {
                                return null;
                            }

                            const point = payload[0].payload as {
                                x: number;
                                y: number;
                                steps: number;
                                max_value: number;
                            };

                            return (
                                <Box
                                    sx={{
                                        bgcolor: 'background.paper',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: '10px',
                                        px: 1.2,
                                        py: 0.9,
                                    }}
                                >
                                    <Typography variant='caption' color='text.secondary'>
                                        Start n: {point.x}
                                    </Typography>
                                    <Typography variant='body2'>Y ({data.y_label}): {point.y}</Typography>
                                    <Typography variant='body2'>Steps to 1: {point.steps}</Typography>
                                    <Typography variant='body2'>Max value: {point.max_value}</Typography>
                                </Box>
                            );
                        }}
                    />
                    <Line
                        type='monotone'
                        dataKey='y'
                        stroke={theme.palette.primary.light}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive
                    />
                </LineChart>
            </Box>
            <Box sx={{px: 1.2, py: 0.8}}>
                <Typography variant='caption' color='text.secondary'>
                    Wheel scroll moves chart horizontally. Hold Shift + wheel to zoom X-axis around cursor.
                </Typography>
            </Box>
        </Box>
    );
}
