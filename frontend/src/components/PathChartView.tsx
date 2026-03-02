import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,} from 'recharts';
import {Box, useTheme} from '@mui/material';
import type {PathPoint} from '../types';

interface Props {
    points: PathPoint[];
}

export function PathChartView({points}: Props) {
    const theme = useTheme();
    const maxValue = points.reduce((acc, point) => Math.max(acc, Math.abs(point.value)), 0);
    const yAxisWidth = Math.min(96, Math.max(40, 34 + String(Math.floor(maxValue)).length * 7));
    return (
        <Box
            sx={{
                borderRadius: 1,
                overflow: 'visible',
                bgcolor: 'rgba(11, 14, 30, 0.6)',
            }}
        >
            <ResponsiveContainer width='100%' height={280}>
                <LineChart data={points} margin={{top: 10, right: 16, left: 6, bottom: 10}}>
                    <CartesianGrid strokeDasharray='4 4' stroke='rgba(130,140,170,0.32)'/>
                    <XAxis dataKey='step' stroke='rgba(220,228,255,0.68)'/>
                    <YAxis stroke='rgba(220,228,255,0.68)' width={yAxisWidth}/>
                    <Tooltip
                        labelFormatter={(value) => `Step: ${value}`}
                        formatter={(value) => [value, 'Value']}
                        contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: '10px',
                            color: theme.palette.text.primary,
                        }}
                    />
                    <Line
                        type='monotone'
                        dataKey='value'
                        stroke='#f59e0b'
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive
                    />
                </LineChart>
            </ResponsiveContainer>
        </Box>
    );
}
