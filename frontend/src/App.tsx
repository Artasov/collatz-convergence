import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  CircularProgress,
  Chip,
  Container,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { fetchNetworkChart, fetchPath, fetchTreeChart, fetchXYChart } from './api';
import { ConvergenceTreeView } from './components/ConvergenceTreeView';
import { ControlPanel } from './components/ControlPanel';
import { LineChartView } from './components/LineChartView';
import { NetworkChartView } from './components/NetworkChartView';
import { PathChartView } from './components/PathChartView';
import { PathTracePanel } from './components/PathTracePanel';
import { ValueHistogramView } from './components/ValueHistogramView';
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

function InsightCard(props: Insight) {
  return (
    <Paper
      variant='outlined'
      sx={{
        p: 1.5,
        borderColor: 'divider',
        background: 'linear-gradient(180deg, rgba(28,33,57,0.9), rgba(18,21,37,0.95))',
      }}
    >
      <Typography variant='caption' color='text.secondary'>
        {props.label}
      </Typography>
      <Typography variant='body1' sx={{ fontWeight: 700, mt: 0.35 }}>
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
          height: { xs: 280, md: 460 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'rgba(8, 10, 24, 0.72)',
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
        <CircularProgress size={34} thickness={4.4} />
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <Skeleton variant='rounded' height={58} sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Skeleton variant='rounded' height={58} sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Skeleton variant='rounded' height={58} sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
      </Stack>
    </Stack>
  );
}

function PathLoadingState() {
  return (
    <Stack spacing={1}>
      <Skeleton variant='rounded' height={220} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
        <Skeleton variant='rounded' height={58} sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Skeleton variant='rounded' height={58} sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Skeleton variant='rounded' height={58} sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
      </Stack>
    </Stack>
  );
}

function getMainInsights(summary: Summary, chartType: ChartType): Insight[] {
  if (chartType === 'tree') {
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

export default function App() {
  const [xyLimitInput, setXyLimitInput] = useState('500');
  const [networkLimitInput, setNetworkLimitInput] = useState('500');
  const [treeLayersInput, setTreeLayersInput] = useState('12');
  const [treeEvenTurnInput, setTreeEvenTurnInput] = useState('20');
  const [treeOddTurnInput, setTreeOddTurnInput] = useState('-8');
  const [debouncedXyLimit, setDebouncedXyLimit] = useState(500);
  const [debouncedNetworkLimit, setDebouncedNetworkLimit] = useState(500);
  const [debouncedTreeLayers, setDebouncedTreeLayers] = useState(12);
  const [chartType, setChartType] = useState<ChartType>('xy');
  const [metric, setMetric] = useState<Metric>('steps');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [xyData, setXYData] = useState<XYData | null>(null);
  const [networkData, setNetworkData] = useState<TreeData | null>(null);
  const [treeData, setTreeData] = useState<ConvergenceTreeData | null>(null);
  const [histogramData, setHistogramData] = useState<ValueHistogramPoint[]>([]);

  const [pathStartN, setPathStartN] = useState(27);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [pathData, setPathData] = useState<PathResponse | null>(null);
  const chartRequestRef = useRef(0);

  const chartTitle = useMemo(() => {
    if (chartType === 'xy') {
      return metric === 'steps'
        ? 'XY line: steps to reach 1 for each start value'
        : 'XY line: peak value reached by each start value';
    }
    if (chartType === 'network') {
      return 'Transition network (hairball) for range 1..X';
    }
    return `Directed convergence graph (reverse tree, ${debouncedTreeLayers} layers)`;
  }, [chartType, metric, debouncedTreeLayers]);

  const chartDescription = useMemo(() => {
    if (chartType === 'xy') {
      return metric === 'steps'
        ? 'Each point is one start n. Y value = number of transitions until reaching 1.'
        : 'Each point is one start n. Y value = maximum number observed on that trajectory.';
    }
    if (chartType === 'network') {
      return 'Dense directed graph of all observed transitions n -> f(n) in the selected range.';
    }
    const evenTurnText = treeEvenTurnInput || '20';
    const oddTurnText = treeOddTurnInput || '-8';
    return `Reverse Collatz tree from 1, expanded to ${debouncedTreeLayers} layers. Even turn: ${evenTurnText} deg, odd turn: ${oddTurnText} deg.`;
  }, [chartType, metric, debouncedTreeLayers, treeEvenTurnInput, treeOddTurnInput]);

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

  const treeEvenTurnDeg = useMemo(
    () => parseSignedInteger(treeEvenTurnInput, 20),
    [treeEvenTurnInput],
  );
  const treeOddTurnDeg = useMemo(
    () => parseSignedInteger(treeOddTurnInput, -8),
    [treeOddTurnInput],
  );

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

  async function tracePath() {
    setPathLoading(true);
    setPathError(null);
    try {
      const response = await fetchPath(pathStartN);
      setPathData(response);
    } catch (requestError) {
      setPathError(requestError instanceof Error ? requestError.message : 'Unknown error.');
      setPathData(null);
    } finally {
      setPathLoading(false);
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
    if (chartType === 'xy') {
      void buildXY(debouncedXyLimit);
      return;
    }
    if (chartType === 'network') {
      void buildNetwork(debouncedNetworkLimit);
      return;
    }
    void buildTree(debouncedTreeLayers);
  }, [chartType, metric, debouncedXyLimit, debouncedNetworkLimit, debouncedTreeLayers]);

  useEffect(() => {
    void tracePath();
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 2, md: 3 },
        background:
          'radial-gradient(80% 60% at 15% 5%, rgba(52,92,255,0.24), transparent 65%), radial-gradient(90% 70% at 90% 90%, rgba(167,139,250,0.22), transparent 70%), #090b15',
      }}
    >
      <Container maxWidth='xl'>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems='flex-start'>
          <Box sx={{ width: { xs: '100%', lg: 360 }, flexShrink: 0 }}>
            <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
              <Paper variant='outlined' sx={{ p: 1.5, borderColor: 'divider' }}>
                <Typography variant='subtitle2' sx={{ mb: 1, fontWeight: 700 }}>
                  Chart settings
                </Typography>
                <ControlPanel
                  xyLimitInput={xyLimitInput}
                  setXyLimitInput={(value) => onNumericInputChange(value, setXyLimitInput)}
                  networkLimitInput={networkLimitInput}
                  setNetworkLimitInput={(value) =>
                    onNumericInputChange(value, setNetworkLimitInput)
                  }
                  treeLayersInput={treeLayersInput}
                  setTreeLayersInput={(value) => onNumericInputChange(value, setTreeLayersInput)}
                  chartType={chartType}
                  setChartType={setChartType}
                  metric={metric}
                  setMetric={setMetric}
                  layout='sidebar'
                />
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1.1 }}>
                  Chart updates automatically when parameters change.
                </Typography>
              </Paper>

              <Paper variant='outlined' sx={{ p: 1.5, borderColor: 'divider' }}>
                <Typography variant='subtitle2' sx={{ mb: 1, fontWeight: 700 }}>
                  Single number trace
                </Typography>
                <PathTracePanel
                  startN={pathStartN}
                  setStartN={setPathStartN}
                  onTrace={() => void tracePath()}
                  loading={pathLoading}
                  layout='sidebar'
                />
              </Paper>

              {summary ? (
                <Paper variant='outlined' sx={{ p: 1.4, borderColor: 'divider' }}>
                  <Typography variant='subtitle2' sx={{ mb: 0.9, fontWeight: 700 }}>
                    Quick summary
                  </Typography>
                  <Stack spacing={0.7}>
                    {chartType === 'tree' ? (
                      <>
                        <Typography variant='caption' color='text.secondary'>
                          Layers: {summary.limit}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          Max value in tree: {summary.highest_peak_value}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          Shape: nodes={summary.unique_node_count}, edges={summary.unique_edge_count}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Typography variant='caption' color='text.secondary'>
                          Longest chain: n={summary.longest_chain_start}, steps={summary.longest_chain_length}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          Highest peak: n={summary.highest_peak_start}, peak={summary.highest_peak_value}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          Shape: nodes={summary.unique_node_count}, edges={summary.unique_edge_count}
                        </Typography>
                      </>
                    )}
                  </Stack>
                </Paper>
              ) : null}
            </Stack>
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack spacing={2}>
              <Paper
                variant='outlined'
                sx={{
                  p: { xs: 2, md: 2.4 },
                  borderColor: 'divider',
                  background:
                    'linear-gradient(135deg, rgba(32,39,75,0.92), rgba(14,17,31,0.96))',
                }}
              >
                <Stack spacing={1.2}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.2}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant='h4' sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                        LotharCollatz Visualizer
                      </Typography>
                      <Typography variant='body2' color='text.secondary' sx={{ mt: 0.7 }}>
                        Explore 3n + 1 trajectories with several complementary views.
                      </Typography>
                    </Box>
                    <Chip label='MUI Dark' color='primary' size='small' />
                  </Stack>

                  <Accordion
                    disableGutters
                    sx={{
                      bgcolor: 'rgba(9, 12, 28, 0.55)',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '10px !important',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        What is 3n + 1 (Collatz conjecture)?
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant='body2' color='text.secondary'>
                        For positive n: if n is even, next value is n / 2; if n is odd, next
                        value is 3n + 1. The conjecture says every trajectory eventually reaches
                        the cycle 4 -&gt; 2 -&gt; 1. This app stops trajectories at 1 as a terminal
                        point and visualizes transitions n -&gt; f(n).
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </Paper>

              <Paper variant='outlined' sx={{ p: 1.6, borderColor: 'divider' }}>
                <Typography variant='h6' sx={{ mb: 0.6, fontWeight: 700 }}>
                  {chartTitle}
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 1.2 }}>
                  {chartDescription}
                </Typography>
                {loading ? <ChartLoadingState /> : null}
                {!loading && error ? <Alert severity='error'>{error}</Alert> : null}
                {!loading && chartType === 'xy' && xyData ? <LineChartView data={xyData} /> : null}
                {!loading && chartType === 'network' && networkData ? (
                  <NetworkChartView data={networkData} />
                ) : null}
                {!loading && chartType === 'tree' && treeData ? (
                  <ConvergenceTreeView data={treeData} />
                ) : null}
              </Paper>

              {histogramData.length > 0 ? (
                <Paper variant='outlined' sx={{ p: 1.6, borderColor: 'divider' }}>
                  <Typography variant='h6' sx={{ mb: 0.6, fontWeight: 700 }}>
                    Value occurrence histogram (1..X)
                  </Typography>
                  <Typography variant='body2' color='text.secondary' sx={{ mb: 1.2 }}>
                    Shows how often each numeric value appears when all trajectories from 1..X are
                    expanded until 1.
                  </Typography>
                  <ValueHistogramView points={histogramData} />
                </Paper>
              ) : null}

              {mainInsights.length > 0 ? (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4}>
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

              <Paper variant='outlined' sx={{ p: 1.6, borderColor: 'divider' }}>
                <Typography variant='h6' sx={{ mb: 0.6, fontWeight: 700 }}>
                  Path for specific n
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 1.2 }}>
                  Trajectory of one chosen start value until reaching 1.
                </Typography>
                {!pathLoading && pathError ? <Alert severity='error'>{pathError}</Alert> : null}
                {pathLoading ? <PathLoadingState /> : null}
                {!pathLoading && pathData ? (
                  <Stack spacing={1.2}>
                    <PathChartView points={pathData.points} />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
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
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
