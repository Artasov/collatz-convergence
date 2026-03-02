import {useMemo} from 'react';
import {Bar, BarChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,} from 'recharts';
import {Box, Typography, useTheme} from '@mui/material';
import type {ValueHistogramPoint} from '../types';

interface Props {
    points: ValueHistogramPoint[];
}

interface HistogramBar {
    value: number;
    label: string;
    hits: number;
}

export function ValueHistogramView({points}: Props) {
    const theme = useTheme();
    const bars = useMemo<HistogramBar[]>(
        () =>
            points.map((point) => ({
                value: point.value,
                label: `${point.value}`,
                hits: point.hits,
            })),
        [points],
    );

    const initialEndIndex = Math.max(0, Math.min(220, bars.length - 1));

    return (
        <Box
            sx={{
                borderRadius: 1,
                overflow: 'visible',
                bgcolor: 'rgba(11, 14, 30, 0.6)',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                '& *:focus, & *:focus-visible': {
                    outline: 'none !important',
                },
                '& .recharts-brush .recharts-brush-traveller': {
                    fill: 'rgba(122, 133, 165, 0.7)',
                    stroke: 'rgba(181, 191, 224, 0.65)',
                    rx: '3px',
                    ry: '3px',
                },
                '& .recharts-brush .recharts-brush-slide': {
                    fill: 'rgba(122, 133, 165, 0.18)',
                    stroke: 'rgba(122, 133, 165, 0.5)',
                },
                '& .recharts-brush .recharts-layer:focus': {
                    outline: 'none',
                },
            }}
        >
            <Box sx={{p: 1}}>
                <ResponsiveContainer width='100%' height={300}>
                    <BarChart data={bars}>
                        <CartesianGrid strokeDasharray='4 4' stroke='rgba(130,140,170,0.26)'/>
                        <XAxis dataKey='label' hide/>
                        <YAxis stroke='rgba(220,228,255,0.68)'/>
                        <Tooltip
                            labelFormatter={(_label, payload) => {
                                const bar = payload?.[0]?.payload as HistogramBar | undefined;
                                return bar ? `Value ${bar.value}` : 'Value';
                            }}
                            formatter={(value) => [value, 'Occurrences']}
                            contentStyle={{
                                backgroundColor: theme.palette.background.paper,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: '10px',
                                color: theme.palette.text.primary,
                            }}
                        />
                        <Brush
                            dataKey='label'
                            height={26}
                            startIndex={0}
                            endIndex={initialEndIndex}
                            fill='rgba(19, 23, 43, 0.95)'
                            stroke='rgba(122, 133, 165, 0.6)'
                            travellerWidth={11}
                        />
                        <Bar dataKey='hits' fill={theme.palette.secondary.main}/>
                    </BarChart>
                </ResponsiveContainer>
            </Box>
            <Box sx={{px: 1.2, py: 0.8}}>
                <Typography variant='caption' color='text.secondary'>
                    Occurrence histogram: exact per-value counts. Use the bottom range slider to navigate across all
                    values.
                </Typography>
            </Box>
        </Box>
    );
}
