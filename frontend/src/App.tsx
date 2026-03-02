import {useEffect, useMemo, useRef, useState} from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Link,
    Paper,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {fetchNetworkChart, fetchPath, fetchTreeChart, fetchXYChart} from './api';
import {ConvergenceFlow3DView} from './components/ConvergenceFlow3DView';
import {ConvergenceTree3DView} from './components/ConvergenceTree3DView';
import {ConvergenceTreeView} from './components/ConvergenceTreeView';
import {ControlPanel} from './components/ControlPanel';
import {LineChartView} from './components/LineChartView';
import {NetworkChartView} from './components/NetworkChartView';
import {PathChartView} from './components/PathChartView';
import {ValueHistogramView} from './components/ValueHistogramView';
import type {
    ChartType,
    ConvergenceTreeData,
    Metric,
    PathResponse,
    Summary,
    TreeData,
    ValueHistogramPoint,
    XYData,
} from './types';

interface Insight {
    label: string;
    value: string;
    hint: string;
}

const TREE_WARNING_THRESHOLD = 32;
const TREE_WARNING_SKIP_KEY = 'lothar_collatz_skip_tree_warning';
const DEFAULT_TREE_COLOR_SEED = 137;

function InsightCard(props: Insight) {
    return (
        <Paper sx={{p: 1.5}}>
            <Typography variant='caption' color='text.secondary'>
                {props.label}
            </Typography>
            <Typography variant='body1' sx={{fontWeight: 700, mt: 0.35}}>
                {props.value}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
                {props.hint}
            </Typography>
        </Paper>
    );
}

function ChartLoadingState() {
    return (
        <Stack spacing={1.2}>
            <Box
                sx={{
                    height: {xs: 280, md: 460},
                    borderRadius: 1,
                    bgcolor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <Skeleton
                    variant='rectangular'
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(255,255,255,0.04)',
                    }}
                />
                <CircularProgress size={34} thickness={4.4}/>
            </Box>
            <Stack direction={{xs: 'column', md: 'row'}} spacing={1}>
                <Skeleton variant='rounded' height={58} sx={{flex: 1, bgcolor: 'rgba(255,255,255,0.06)'}}/>
                <Skeleton variant='rounded' height={58} sx={{flex: 1, bgcolor: 'rgba(255,255,255,0.06)'}}/>
                <Skeleton variant='rounded' height={58} sx={{flex: 1, bgcolor: 'rgba(255,255,255,0.06)'}}/>
            </Stack>
        </Stack>
    );
}

function PathLoadingState() {
    return (
        <Stack spacing={1}>
            <Skeleton variant='rounded' height={220} sx={{bgcolor: 'rgba(255,255,255,0.06)'}}/>
            <Stack direction={{xs: 'column', md: 'row'}} spacing={1}>
                <Skeleton variant='rounded' height={58} sx={{flex: 1, bgcolor: 'rgba(255,255,255,0.06)'}}/>
                <Skeleton variant='rounded' height={58} sx={{flex: 1, bgcolor: 'rgba(255,255,255,0.06)'}}/>
                <Skeleton variant='rounded' height={58} sx={{flex: 1, bgcolor: 'rgba(255,255,255,0.06)'}}/>
            </Stack>
        </Stack>
    );
}

function getMainInsights(summary: Summary, chartType: ChartType): Insight[] {
    if (chartType === 'tree' || chartType === 'tree3d') {
        return [
            {
                label: 'Rendered layers',
                value: `${summary.limit}`,
                hint: 'Depth of reverse Collatz tree from root value 1.',
            },
            {
                label: 'Largest value in layers',
                value: `${summary.highest_peak_value}`,
                hint: 'Maximum number present inside rendered layers.',
            },
            {
                label: 'Tree shape',
                value: `nodes=${summary.unique_node_count}, edges=${summary.unique_edge_count}`,
                hint: 'Unique nodes and directed edges in current layered tree.',
            },
        ];
    }

    const base: Insight[] = [
        {
            label: 'Longest trajectory in range',
            value: `n=${summary.longest_chain_start}, steps=${summary.longest_chain_length}`,
            hint: 'Start value with maximum number of transitions to reach 1.',
        },
        {
            label: 'Highest value reached',
            value: `n=${summary.highest_peak_start}, peak=${summary.highest_peak_value}`,
            hint: 'Start value that reaches the largest number along its path.',
        },
    ];

    if (chartType === 'xy') {
        return [
            ...base,
            {
                label: 'Unique values in all paths',
                value: `${summary.unique_node_count}`,
                hint: 'How many distinct numbers appear in trajectories from 1..X.',
            },
        ];
    }

    return [
        ...base,
        {
            label: 'Transition graph shape',
            value: `nodes=${summary.unique_node_count}, edges=${summary.unique_edge_count}`,
            hint: 'Distinct numbers (nodes) and directed transitions (edges).',
        },
    ];
}

function formatPathPreview(path: number[]): string {
    const maxItems = 42;
    if (path.length <= maxItems) {
        return path.join(' -> ');
    }
    const left = path.slice(0, 20).join(' -> ');
    const right = path.slice(-20).join(' -> ');
    return `${left} -> ... -> ${right}`;
}

function getInitialSearchParams(): URLSearchParams {
    if (typeof window === 'undefined') {
        return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
}

function getInitialChartType(searchParams: URLSearchParams): ChartType {
    const value = searchParams.get('chart');
    if (value === 'xy' || value === 'network' || value === 'tree' || value === 'tree3d' || value === 'flow3d' || value === 'path') {
        return value;
    }
    return 'xy';
}

function getInitialMetric(searchParams: URLSearchParams): Metric {
    const value = searchParams.get('metric');
    if (value === 'steps' || value === 'max_value') {
        return value;
    }
    return 'steps';
}

function getInitialNumericString(
    searchParams: URLSearchParams,
    key: string,
    fallback: string,
): string {
    const value = searchParams.get(key);
    if (!value) {
        return fallback;
    }
    const normalized = value.replace(/\D+/g, '');
    return normalized || fallback;
}

function getInitialSignedNumericString(
    searchParams: URLSearchParams,
    key: string,
    fallback: string,
): string {
    const value = searchParams.get(key);
    if (!value) {
        return fallback;
    }
    let normalized = value.replace(/[^\d-]+/g, '');
    if (normalized.includes('-')) {
        const sign = normalized.startsWith('-') ? '-' : '';
        normalized = `${sign}${normalized.replace(/-/g, '')}`;
    }
    return normalized && normalized !== '-' ? normalized : fallback;
}

function getInitialColorEnabled(searchParams: URLSearchParams): boolean {
    const value = searchParams.get('color');
    return value === '1' || value === 'true';
}

function getInitialColorSeed(searchParams: URLSearchParams): number {
    const raw = searchParams.get('color_seed');
    if (!raw) {
        return DEFAULT_TREE_COLOR_SEED;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_TREE_COLOR_SEED;
    }
    return Math.max(0, Math.floor(parsed));
}

function parsePositiveValue(value: string, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.floor(parsed);
}

export default function App() {
    const initialParams = useMemo(() => getInitialSearchParams(), []);

    const [xyLimitInput, setXyLimitInput] = useState(() =>
        getInitialNumericString(initialParams, 'xy_limit', '500'),
    );
    const [networkLimitInput, setNetworkLimitInput] = useState(() =>
        getInitialNumericString(initialParams, 'network_limit', '500'),
    );
    const [treeLayersInput, setTreeLayersInput] = useState(() =>
        getInitialNumericString(initialParams, 'layers', '12'),
    );
    const [treeTurnInput, setTreeTurnInput] = useState(() =>
        getInitialSignedNumericString(initialParams, 'turn', '20'),
    );
    const [pathStartInput, setPathStartInput] = useState(() =>
        getInitialNumericString(initialParams, 'start_n', '27'),
    );
    const [flowSamplesInput, setFlowSamplesInput] = useState(() =>
        getInitialNumericString(initialParams, 'flow_samples', '5000'),
    );
    const [treeColorEnabled, setTreeColorEnabled] = useState(() => getInitialColorEnabled(initialParams));
    const [treeColorSeed, setTreeColorSeed] = useState(() => getInitialColorSeed(initialParams));
    const [debouncedXyLimit, setDebouncedXyLimit] = useState(() =>
        parsePositiveValue(getInitialNumericString(initialParams, 'xy_limit', '500'), 500),
    );
    const [debouncedNetworkLimit, setDebouncedNetworkLimit] = useState(() =>
        parsePositiveValue(getInitialNumericString(initialParams, 'network_limit', '500'), 500),
    );
    const [debouncedTreeLayers, setDebouncedTreeLayers] = useState(() =>
        parsePositiveValue(getInitialNumericString(initialParams, 'layers', '12'), 12),
    );
    const [appliedTreeLayers, setAppliedTreeLayers] = useState(() =>
        parsePositiveValue(getInitialNumericString(initialParams, 'layers', '12'), 12),
    );
    const [chartType, setChartType] = useState<ChartType>(() => getInitialChartType(initialParams));
    const [metric, setMetric] = useState<Metric>(() => getInitialMetric(initialParams));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [xyData, setXYData] = useState<XYData | null>(null);
    const [networkData, setNetworkData] = useState<TreeData | null>(null);
    const [treeData, setTreeData] = useState<ConvergenceTreeData | null>(null);
    const [histogramData, setHistogramData] = useState<ValueHistogramPoint[]>([]);
    const [treeWarningOpen, setTreeWarningOpen] = useState(false);
    const [treeWarningPendingLayers, setTreeWarningPendingLayers] = useState<number | null>(null);
    const [treeWarningConfirmedLayers, setTreeWarningConfirmedLayers] = useState<number | null>(null);
    const [treeWarningDismissedLayers, setTreeWarningDismissedLayers] = useState<number | null>(null);
    const [treeWarningDontShowAgain, setTreeWarningDontShowAgain] = useState(false);
    const [skipTreeWarning, setSkipTreeWarning] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        return window.localStorage.getItem(TREE_WARNING_SKIP_KEY) === '1';
    });

    const [debouncedPathStartN, setDebouncedPathStartN] = useState(() =>
        parsePositiveValue(getInitialNumericString(initialParams, 'start_n', '27'), 27),
    );
    const [debouncedFlowSamples, setDebouncedFlowSamples] = useState(() =>
        parsePositiveValue(getInitialNumericString(initialParams, 'flow_samples', '5000'), 5000),
    );
    const [pathLoading, setPathLoading] = useState(false);
    const [pathError, setPathError] = useState<string | null>(null);
    const [pathData, setPathData] = useState<PathResponse | null>(null);
    const chartRequestRef = useRef(0);
    const pathRequestRef = useRef(0);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (skipTreeWarning) {
            window.localStorage.setItem(TREE_WARNING_SKIP_KEY, '1');
            return;
        }
        window.localStorage.removeItem(TREE_WARNING_SKIP_KEY);
    }, [skipTreeWarning]);

    function parseSignedInteger(value: string, fallback: number): number {
        if (!value || value === '-') {
            return fallback;
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }
        return Math.floor(parsed);
    }

    function parsePositiveInteger(value: string, fallback: number): number {
        return parsePositiveValue(value, fallback);
    }

    const treeTurnDeg = useMemo(
        () => parseSignedInteger(treeTurnInput, 0),
        [treeTurnInput],
    );
    const pathStartN = useMemo(
        () => parsePositiveInteger(pathStartInput, 27),
        [pathStartInput],
    );

    const chartTitle = useMemo(() => {
        if (chartType === 'xy') {
            return metric === 'steps'
                ? 'XY line: steps to reach 1 for each start value'
                : 'XY line: peak value reached by each start value';
        }
        if (chartType === 'network') {
            return 'Transition network for range 1..X';
        }
        if (chartType === 'path') {
            return `Single trajectory for n=${pathStartN}`;
        }
        if (chartType === 'flow3d') {
            return `3D Collatz trajectory flow (${debouncedFlowSamples} random starts)`;
        }
        if (chartType === 'tree3d') {
            return `3D tree (reverse Collatz, ${debouncedTreeLayers} layers)`;
        }
        return `Directed convergence graph (reverse tree, ${debouncedTreeLayers} layers)`;
    }, [chartType, metric, debouncedFlowSamples, debouncedTreeLayers, pathStartN]);

    const chartDescription = useMemo(() => {
        if (chartType === 'xy') {
            return metric === 'steps'
                ? 'Each point is one start n. Y value = number of transitions until reaching 1.'
                : 'Each point is one start n. Y value = maximum number observed on that trajectory.';
        }
        if (chartType === 'network') {
            return 'Dense directed graph of all observed transitions n -> f(n) in the selected range.';
        }
        if (chartType === 'path') {
            return 'Trajectory for one start value until reaching 1, with step-by-step values and peak.';
        }
        if (chartType === 'flow3d') {
            return 'Sampled trajectories from random starts below 1,000,000. Edges bend by parity rule and are styled by log1p traversal frequency.';
        }
        const turnText = treeTurnInput || '0';
        if (chartType === 'tree') {
            return `Reverse Collatz tree from 1, expanded to ${debouncedTreeLayers} layers. Turn: ${turnText} deg per layer.`;
        }
        return `3D line-only rendering of reverse Collatz tree from 1. Layers: ${debouncedTreeLayers}, turn: ${turnText} deg per layer.`;
    }, [chartType, metric, debouncedTreeLayers, treeTurnInput]);

    const mainInsights = useMemo(
        () => (summary ? getMainInsights(summary, chartType) : []),
        [chartType, summary],
    );

    function onUnsignedNumericInputChange(rawValue: string, setter: (value: string) => void) {
        const normalized = rawValue.replace(/\D+/g, '');
        setter(normalized);
    }

    function onSignedNumericInputChange(rawValue: string, setter: (value: string) => void) {
        let normalized = rawValue.replace(/[^\d-]+/g, '');
        if (normalized.includes('-')) {
            const sign = normalized.startsWith('-') ? '-' : '';
            normalized = `${sign}${normalized.replace(/-/g, '')}`;
        }
        setter(normalized);
    }

    async function buildXY(limit: number) {
        const requestId = chartRequestRef.current + 1;
        chartRequestRef.current = requestId;
        setLoading(true);
        setError(null);
        try {
            const response = await fetchXYChart(limit, metric);
            if (chartRequestRef.current !== requestId) {
                return;
            }
            setSummary(response.summary);
            setXYData(response.data);
            setNetworkData(null);
            setTreeData(null);
            setHistogramData(response.data.value_histogram ?? []);
        } catch (requestError) {
            if (chartRequestRef.current !== requestId) {
                return;
            }
            setError(requestError instanceof Error ? requestError.message : 'Unknown error.');
            setHistogramData([]);
        } finally {
            if (chartRequestRef.current === requestId) {
                setLoading(false);
            }
        }
    }

    async function buildNetwork(limit: number) {
        const requestId = chartRequestRef.current + 1;
        chartRequestRef.current = requestId;
        setLoading(true);
        setError(null);
        try {
            const response = await fetchNetworkChart(limit);
            if (chartRequestRef.current !== requestId) {
                return;
            }
            setSummary(response.summary);
            setNetworkData(response.data);
            setXYData(null);
            setTreeData(null);
            setHistogramData(response.data.value_histogram ?? []);
        } catch (requestError) {
            if (chartRequestRef.current !== requestId) {
                return;
            }
            setError(requestError instanceof Error ? requestError.message : 'Unknown error.');
            setHistogramData([]);
        } finally {
            if (chartRequestRef.current === requestId) {
                setLoading(false);
            }
        }
    }

    async function buildTree(layers: number) {
        const requestId = chartRequestRef.current + 1;
        chartRequestRef.current = requestId;
        setLoading(true);
        setError(null);
        try {
            const response = await fetchTreeChart(layers);
            if (chartRequestRef.current !== requestId) {
                return;
            }
            setSummary(response.summary);
            setTreeData(response.data);
            setAppliedTreeLayers(layers);
            setXYData(null);
            setNetworkData(null);
            setHistogramData([]);
        } catch (requestError) {
            if (chartRequestRef.current !== requestId) {
                return;
            }
            setError(requestError instanceof Error ? requestError.message : 'Unknown error.');
            setHistogramData([]);
        } finally {
            if (chartRequestRef.current === requestId) {
                setLoading(false);
            }
        }
    }

    async function tracePath(startN: number) {
        if (startN <= 0) {
            return;
        }
        const requestId = pathRequestRef.current + 1;
        pathRequestRef.current = requestId;
        setPathLoading(true);
        setPathError(null);
        try {
            const response = await fetchPath(startN);
            if (pathRequestRef.current !== requestId) {
                return;
            }
            setPathData(response);
        } catch (requestError) {
            if (pathRequestRef.current !== requestId) {
                return;
            }
            setPathError(requestError instanceof Error ? requestError.message : 'Unknown error.');
            setPathData(null);
        } finally {
            if (pathRequestRef.current === requestId) {
                setPathLoading(false);
            }
        }
    }

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            if (!xyLimitInput) {
                return;
            }
            const parsed = Number(xyLimitInput);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return;
            }
            setDebouncedXyLimit(Math.floor(parsed));
        }, 500);
        return () => window.clearTimeout(timerId);
    }, [xyLimitInput]);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            if (!networkLimitInput) {
                return;
            }
            const parsed = Number(networkLimitInput);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return;
            }
            setDebouncedNetworkLimit(Math.floor(parsed));
        }, 500);
        return () => window.clearTimeout(timerId);
    }, [networkLimitInput]);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            if (!treeLayersInput) {
                return;
            }
            const parsed = Number(treeLayersInput);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return;
            }
            setDebouncedTreeLayers(Math.floor(parsed));
        }, 500);
        return () => window.clearTimeout(timerId);
    }, [treeLayersInput]);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            if (!pathStartInput) {
                return;
            }
            const parsed = Number(pathStartInput);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return;
            }
            setDebouncedPathStartN(Math.floor(parsed));
        }, 500);
        return () => window.clearTimeout(timerId);
    }, [pathStartInput]);

    useEffect(() => {
        const timerId = window.setTimeout(() => {
            if (!flowSamplesInput) {
                return;
            }
            const parsed = Number(flowSamplesInput);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return;
            }
            setDebouncedFlowSamples(Math.floor(parsed));
        }, 500);
        return () => window.clearTimeout(timerId);
    }, [flowSamplesInput]);

    useEffect(() => {
        if (chartType !== 'path') {
            pathRequestRef.current += 1;
            setPathLoading(false);
        }
        if (chartType === 'xy') {
            void buildXY(debouncedXyLimit);
            return;
        }
        if (chartType === 'network') {
            void buildNetwork(debouncedNetworkLimit);
            return;
        }
        if (chartType === 'path') {
            chartRequestRef.current += 1;
            setLoading(false);
            setError(null);
            setSummary(null);
            setHistogramData([]);
            setXYData(null);
            setNetworkData(null);
            setTreeData(null);
            void tracePath(debouncedPathStartN);
            return;
        }
        if (chartType === 'flow3d') {
            chartRequestRef.current += 1;
            setLoading(false);
            setError(null);
            setSummary(null);
            setHistogramData([]);
            setXYData(null);
            setNetworkData(null);
            setTreeData(null);
            setTreeWarningOpen(false);
            setTreeWarningPendingLayers(null);
            return;
        }
        const isLayeredTree = chartType === 'tree' || chartType === 'tree3d';
        if (!isLayeredTree) {
            return;
        }
        const needsTreeConfirmation =
            debouncedTreeLayers > TREE_WARNING_THRESHOLD
            && !skipTreeWarning
            && treeWarningConfirmedLayers !== debouncedTreeLayers;
        if (needsTreeConfirmation) {
            if (treeWarningDismissedLayers !== debouncedTreeLayers) {
                setTreeWarningPendingLayers(debouncedTreeLayers);
                setTreeWarningDontShowAgain(false);
                setTreeWarningOpen(true);
            }
            return;
        }
        void buildTree(debouncedTreeLayers);
    }, [
        chartType,
        metric,
        debouncedPathStartN,
        debouncedFlowSamples,
        debouncedXyLimit,
        debouncedNetworkLimit,
        debouncedTreeLayers,
        skipTreeWarning,
        treeWarningConfirmedLayers,
        treeWarningDismissedLayers,
    ]);

    function onCloseTreeWarning() {
        const dismissedValue = treeWarningPendingLayers ?? debouncedTreeLayers;
        setTreeWarningDismissedLayers(dismissedValue);
        const fallbackLayers = Math.max(1, appliedTreeLayers);
        setTreeLayersInput(`${fallbackLayers}`);
        setDebouncedTreeLayers(fallbackLayers);
        setTreeWarningPendingLayers(null);
        setTreeWarningOpen(false);
    }

    function onConfirmTreeWarning() {
        if (treeWarningDontShowAgain) {
            setSkipTreeWarning(true);
        }
        setTreeWarningDismissedLayers(null);
        setTreeWarningConfirmedLayers(treeWarningPendingLayers ?? debouncedTreeLayers);
        setTreeWarningPendingLayers(null);
        setTreeWarningOpen(false);
    }

    function onRandomizeTreeColors() {
        const seed = Math.floor(Math.random() * 1000000000);
        setTreeColorEnabled(true);
        setTreeColorSeed(seed);
    }

    useEffect(() => {
        const params = new URLSearchParams();
        params.set('chart', chartType);
        params.set('metric', metric);
        params.set('xy_limit', xyLimitInput || '500');
        params.set('network_limit', networkLimitInput || '500');
        params.set('layers', treeLayersInput || '12');
        params.set('turn', treeTurnInput || '0');
        params.set('color', treeColorEnabled ? '1' : '0');
        params.set('color_seed', `${treeColorSeed}`);
        params.set('start_n', pathStartInput || '27');
        params.set('flow_samples', flowSamplesInput || '5000');
        const nextUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, '', nextUrl);
    }, [
        chartType,
        flowSamplesInput,
        metric,
        networkLimitInput,
        pathStartInput,
        treeColorEnabled,
        treeColorSeed,
        treeLayersInput,
        treeTurnInput,
        xyLimitInput,
    ]);

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                py: {xs: 2, md: 3},
                background:
                    'radial-gradient(80% 60% at 15% 5%, rgba(52,92,255,0.24), transparent 65%), radial-gradient(90% 70% at 90% 90%, rgba(167,139,250,0.22), transparent 70%), #090b15',
            }}
        >
            <Container maxWidth='xl' sx={{pb: 2, flex: 1}}>
                <Stack direction={{xs: 'column', lg: 'row'}} spacing={2} alignItems='flex-start'>
                    <Box sx={{width: {xs: '100%', lg: 360}, flexShrink: 0}}>
                        <Stack spacing={2} sx={{position: {lg: 'sticky'}, top: {lg: 16}}}>
                            <Paper sx={{p: 1.5}}>
                                <Stack spacing={1.1}>
                                    <Typography variant='h5' sx={{fontWeight: 800, lineHeight: 1.15}}>
                                        LotharCollatz Visualizer
                                    </Typography>
                                    <Typography variant='body2' color='text.secondary'>
                                        Explore 3n + 1 trajectories with several complementary views.
                                    </Typography>
                                    <Accordion
                                        disableGutters
                                        sx={{
                                            '&&': {
                                                mt: '10px !important',
                                                mb: 0,
                                            },
                                            bgcolor: 'rgba(255, 255, 255, 0.01)',
                                            backdropFilter: 'blur(16px)',
                                            WebkitBackdropFilter: 'blur(16px)',
                                            borderRadius: '10px !important',
                                            overflow: 'hidden',
                                            '&&.Mui-expanded': {
                                                mt: '10px !important',
                                                mb: 0,
                                            },
                                            '&:before': {display: 'none'},
                                        }}
                                    >
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon/>}
                                            sx={{
                                                minHeight: 40,
                                                '&.Mui-expanded': {
                                                    minHeight: 40,
                                                },
                                                '& .MuiAccordionSummary-content': {
                                                    my: '8px !important',
                                                },
                                                '& .MuiAccordionSummary-content.Mui-expanded': {
                                                    my: '8px !important',
                                                },
                                            }}
                                        >
                                            <Typography variant='body2' sx={{fontWeight: 600}}>
                                                What is 3n + 1 (Collatz conjecture)?
                                            </Typography>
                                        </AccordionSummary>
                                        <AccordionDetails sx={{pt: 0.2}}>
                                            <Typography variant='body2' color='text.secondary'>
                                                For positive n: if n is even, next value is n / 2; if n is odd, next
                                                value is 3n + 1. The conjecture says every trajectory eventually reaches
                                                the cycle 4 -&gt; 2 -&gt; 1.
                                            </Typography>
                                            <Typography variant='body2' color='text.secondary' sx={{mt: 0.8}}>
                                                Why this is interesting: tiny rule, surprisingly complex behavior. The
                                                app
                                                compares several projections of the same process: single paths, XY
                                                metrics,
                        dense transition network, reverse convergence tree, and 3D tree view.
                                            </Typography>
                                            <Typography variant='body2' color='text.secondary' sx={{mt: 0.8}}>
                                                Important detail in this UI: trajectories stop at 1 as terminal point
                                                (instead of drawing 1 -&gt; 4 -&gt; 2 -&gt; 1 forever), while the
                                                reverse tree
                                                is expanded by layers from root 1.
                                            </Typography>
                                            <Typography variant='body2' color='text.secondary' sx={{mt: 0.8}}>
                                                Read more:{' '}
                                                <Link
                                                    href='https://en.wikipedia.org/wiki/Collatz_conjecture'
                                                    target='_blank'
                                                    rel='noreferrer'
                                                    underline='hover'
                                                    color='primary.light'
                                                >
                                                    Wikipedia article
                                                </Link>
                                            </Typography>
                                        </AccordionDetails>
                                    </Accordion>
                                </Stack>
                            </Paper>

                            <Paper sx={{p: 1.5}}>
                                <ControlPanel
                                    xyLimitInput={xyLimitInput}
                                    setXyLimitInput={(value) => onUnsignedNumericInputChange(value, setXyLimitInput)}
                                    networkLimitInput={networkLimitInput}
                                    setNetworkLimitInput={(value) =>
                                        onUnsignedNumericInputChange(value, setNetworkLimitInput)
                                    }
                                    treeLayersInput={treeLayersInput}
                                    setTreeLayersInput={(value) =>
                                        onUnsignedNumericInputChange(value, setTreeLayersInput)
                                    }
                                    treeTurnInput={treeTurnInput}
                                    setTreeTurnInput={(value) =>
                                        onSignedNumericInputChange(value, (nextValue) => {
                                            setTreeTurnInput(nextValue === '' ? '0' : nextValue);
                                        })
                                    }
                                    treeColorEnabled={treeColorEnabled}
                                    setTreeColorEnabled={setTreeColorEnabled}
                                    onRandomizeTreeColors={onRandomizeTreeColors}
                                    pathStartInput={pathStartInput}
                                    setPathStartInput={(value) =>
                                        onUnsignedNumericInputChange(value, setPathStartInput)
                                    }
                                    flowSamplesInput={flowSamplesInput}
                                    setFlowSamplesInput={(value) =>
                                        onUnsignedNumericInputChange(value, setFlowSamplesInput)
                                    }
                                    chartType={chartType}
                                    setChartType={setChartType}
                                    metric={metric}
                                    setMetric={setMetric}
                                    layout='sidebar'
                                />
                            </Paper>

                            {summary && chartType !== 'path' ? (
                                <Paper sx={{p: 1.4}}>
                                    <Typography variant='subtitle2' sx={{mb: 0.55, fontWeight: 700}}>
                                        Quick summary
                                    </Typography>
                                    <Stack spacing={0.35}>
                                        {chartType === 'tree' || chartType === 'tree3d' ? (
                                            <>
                                                <Typography variant='caption' color='text.secondary'>
                                                    Layers: {summary.limit}
                                                </Typography>
                                                <Typography variant='caption' color='text.secondary'>
                                                    Max value in tree: {summary.highest_peak_value}
                                                </Typography>
                                                <Typography variant='caption' color='text.secondary'>
                                                    Shape: nodes={summary.unique_node_count},
                                                    edges={summary.unique_edge_count}
                                                </Typography>
                                            </>
                                        ) : (
                                            <>
                                                <Typography variant='caption' color='text.secondary'>
                                                    Longest chain: n={summary.longest_chain_start},
                                                    steps={summary.longest_chain_length}
                                                </Typography>
                                                <Typography variant='caption' color='text.secondary'>
                                                    Highest peak: n={summary.highest_peak_start},
                                                    peak={summary.highest_peak_value}
                                                </Typography>
                                                <Typography variant='caption' color='text.secondary'>
                                                    Shape: nodes={summary.unique_node_count},
                                                    edges={summary.unique_edge_count}
                                                </Typography>
                                            </>
                                        )}
                                    </Stack>
                                </Paper>
                            ) : null}
                        </Stack>
                    </Box>

                    <Box sx={{minWidth: 0, flex: 1}}>
                        <Stack spacing={2}>
                            <Paper sx={{p: 1.6, borderRadius: 1}}>
                                <Typography variant='h6' sx={{mb: 0.6, fontWeight: 700}}>
                                    {chartTitle}
                                </Typography>
                                <Typography variant='body2' color='text.secondary' sx={{mb: 1.2}}>
                                    {chartDescription}
                                </Typography>
                                {chartType !== 'path' && loading ? <ChartLoadingState/> : null}
                                {chartType !== 'path' && !loading && error ?
                                    <Alert severity='error'>{error}</Alert> : null}
                                {chartType === 'path' && pathLoading ? <PathLoadingState/> : null}
                                {chartType === 'path' && !pathLoading && pathError ?
                                    <Alert severity='error'>{pathError}</Alert> : null}
                                {!loading && chartType === 'xy' && xyData ? <LineChartView data={xyData}/> : null}
                                {!loading && chartType === 'network' && networkData ? (
                                    <NetworkChartView data={networkData}/>
                                ) : null}
                                {!loading && chartType === 'tree' && treeData ? (
                                    <ConvergenceTreeView
                                        data={treeData}
                                        turnDeg={treeTurnDeg}
                                        colorEnabled={treeColorEnabled}
                                        colorSeed={treeColorSeed}
                                    />
                                ) : null}
                                {!loading && chartType === 'tree3d' && treeData ? (
                                    <ConvergenceTree3DView
                                        data={treeData}
                                        turnDeg={treeTurnDeg}
                                        colorEnabled={treeColorEnabled}
                                        colorSeed={treeColorSeed}
                                    />
                                ) : null}
                                {chartType === 'flow3d' ? (
                                    <ConvergenceFlow3DView
                                        sampleCount={debouncedFlowSamples}
                                        maxStart={1000000}
                                        colorEnabled={treeColorEnabled}
                                        colorSeed={treeColorSeed}
                                    />
                                ) : null}
                                {chartType === 'path' && !pathLoading && pathData ? (
                                    <Stack spacing={1.2}>
                                        <PathChartView points={pathData.points}/>
                                        <Stack direction={{xs: 'column', md: 'row'}} spacing={1.2}>
                                            <InsightCard
                                                label='Start value'
                                                value={`${pathData.start_n}`}
                                                hint='The selected starting number.'
                                            />
                                            <InsightCard
                                                label='Steps to 1'
                                                value={`${pathData.steps}`}
                                                hint='Number of transitions until 1.'
                                            />
                                            <InsightCard
                                                label='Peak value on path'
                                                value={`${pathData.peak_value}`}
                                                hint='Maximum value reached on this trajectory.'
                                            />
                                        </Stack>
                                        <Typography variant='body2' color='text.secondary'>
                                            Path: {formatPathPreview(pathData.path)}
                                        </Typography>
                                    </Stack>
                                ) : null}
                            </Paper>

                            {histogramData.length > 0 ? (
                                <Paper sx={{p: 1.6, borderRadius: 1}}>
                                    <Typography variant='h6' sx={{mb: 0.6, fontWeight: 700}}>
                                        Value occurrence histogram (1..X)
                                    </Typography>
                                    <Typography variant='body2' color='text.secondary' sx={{mb: 1.2}}>
                                        Shows how often each numeric value appears when all trajectories from 1..X are
                                        expanded until 1.
                                    </Typography>
                                    <ValueHistogramView points={histogramData}/>
                                </Paper>
                            ) : null}

                            {mainInsights.length > 0 ? (
                                <Stack direction={{xs: 'column', md: 'row'}} spacing={1.4}>
                                    {mainInsights.map((insight) => (
                                        <InsightCard
                                            key={insight.label}
                                            label={insight.label}
                                            value={insight.value}
                                            hint={insight.hint}
                                        />
                                    ))}
                                </Stack>
                            ) : null}

                        </Stack>
                    </Box>
                </Stack>

            </Container>
            <Box component='footer' sx={{mt: 'auto', py: 1.2}}>
                <Container maxWidth='xl'>
                    <Stack direction={{xs: 'column', md: 'row'}} spacing={1.2}
                           alignItems={{xs: 'flex-start', md: 'center'}}>
                        <Typography variant='caption' color='text.secondary'>
                            LotharCollatz Visualizer
                        </Typography>
                        <Link href='https://xlartas.com/' target='_blank' rel='noreferrer' underline='hover'
                              variant='caption' color='primary.light'>
                            Website
                        </Link>
                        <Link href='https://t.me/artasov' target='_blank' rel='noreferrer' underline='hover'
                              variant='caption' color='primary.light'>
                            Telegram: @artasov
                        </Link>
                        <Link href='https://github.com/Artasov' target='_blank' rel='noreferrer' underline='hover'
                              variant='caption' color='primary.light'>
                            GitHub: Artasov
                        </Link>
                        <Link href='https://github.com/Artasov/Lothar-Collatz' target='_blank' rel='noreferrer'
                              underline='hover' variant='caption' color='primary.light'>
                            Repository
                        </Link>
                        <Link href='https://x.com/xlartasov' target='_blank' rel='noreferrer' underline='hover'
                              variant='caption' color='primary.light'>
                            X: @xlartasov
                        </Link>
                    </Stack>
                </Container>
            </Box>

            <Dialog open={treeWarningOpen} onClose={onCloseTreeWarning} maxWidth='sm' fullWidth>
                <DialogTitle>Heavy tree generation warning</DialogTitle>
                <DialogContent>
                    <Typography variant='body2' color='text.secondary'>
                        Tree layers above 28 can load CPU heavily and may take a long time. Values above 52
                        are extremely heavy. If you continue, be ready to wait for processing.
                    </Typography>
                    <Typography variant='body2' color='text.secondary' sx={{mt: 0.8}}>
                        Requested layers: {treeWarningPendingLayers ?? debouncedTreeLayers}
                    </Typography>
                    <FormControlLabel
                        sx={{mt: 0.9}}
                        control={(
                            <Checkbox
                                checked={treeWarningDontShowAgain}
                                onChange={(event) => setTreeWarningDontShowAgain(event.target.checked)}
                            />
                        )}
                        label='Do not show again'
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCloseTreeWarning} color='inherit'>
                        Cancel
                    </Button>
                    <Button onClick={onConfirmTreeWarning} variant='contained'>
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
