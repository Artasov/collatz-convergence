import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type {ChartType, Metric} from '../types';

interface Props {
    xyLimitInput: string;
    setXyLimitInput: (value: string) => void;
    networkLimitInput: string;
    setNetworkLimitInput: (value: string) => void;
    treeLayersInput: string;
    setTreeLayersInput: (value: string) => void;
    treeTurnInput: string;
    setTreeTurnInput: (value: string) => void;
    treeColorEnabled: boolean;
    setTreeColorEnabled: (value: boolean) => void;
    onRandomizeTreeColors: () => void;
    pathStartInput: string;
    setPathStartInput: (value: string) => void;
    flowSamplesInput: string;
    setFlowSamplesInput: (value: string) => void;
    flowTailVisibility: number;
    setFlowTailVisibility: (value: number) => void;
    chartType: ChartType;
    setChartType: (value: ChartType) => void;
    metric: Metric;
    setMetric: (value: Metric) => void;
    layout?: 'inline' | 'sidebar';
}

interface FieldInfoLabelProps {
    label: string;
    description: string;
}

const infoIconSx = {
    p: 0.2,
    color: 'text.secondary',
    borderRadius: 0.9,
    bgcolor: 'rgba(255, 255, 255, 0.02)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transition: 'background-color 180ms ease, color 180ms ease',
    '&:hover': {
        bgcolor: 'rgba(255, 255, 255, 0.08)',
        color: 'primary.light',
    },
};

function FieldInfoLabel(props: FieldInfoLabelProps) {
    return (
        <Box sx={{display: 'inline-flex', alignItems: 'center', gap: 0.4}}>
            <Typography component='span' sx={{fontSize: 'inherit', lineHeight: 1}}>
                {props.label}
            </Typography>
            <Tooltip title={props.description} arrow>
                <IconButton
                    size='small'
                    sx={infoIconSx}
                    aria-label={`${props.label} info`}
                >
                    <InfoOutlinedIcon sx={{fontSize: 16}}/>
                </IconButton>
            </Tooltip>
        </Box>
    );
}

export function ControlPanel(props: Props) {
    const isSidebar = props.layout === 'sidebar';
    const numericHtmlProps = {inputMode: 'numeric', pattern: '[0-9]*', maxLength: 7};
    const signedNumericHtmlProps = {inputMode: 'decimal', pattern: '-?[0-9]*', maxLength: 6};

    return (
        <Stack
            direction={isSidebar ? 'column' : {xs: 'column', md: 'row'}}
            spacing={1.5}
            alignItems={isSidebar ? 'stretch' : {xs: 'stretch', md: 'center'}}
        >
            <Box sx={{display: 'flex', alignItems: 'center', gap: 0.55}}>
                <FormControl size='small' sx={isSidebar ? {flex: 1} : {minWidth: {xs: '100%', md: 290}}}>
                    <InputLabel id='chart-type-label'>Type</InputLabel>
                    <Select
                        labelId='chart-type-label'
                        value={props.chartType}
                        label='Type'
                        onChange={(event) => props.setChartType(event.target.value as ChartType)}
                        inputProps={{'aria-label': 'Type'}}
                    >
                        <MenuItem value='xy'>XY line</MenuItem>
                        <MenuItem value='tree'>Convergence tree</MenuItem>
                        <MenuItem value='tree3d'>3D tree</MenuItem>
                        <MenuItem value='flow3d'>3D flow arcs</MenuItem>
                        <MenuItem value='path'>Single number trace</MenuItem>
                        <MenuItem value='network'>Transition network</MenuItem>
                    </Select>
                </FormControl>
                <Tooltip title='Choose visual mode. Each mode has its own settings below.' arrow>
                    <IconButton
                        size='small'
                        sx={{...infoIconSx, alignSelf: 'center'}}
                        aria-label='Type info'
                    >
                        <InfoOutlinedIcon sx={{fontSize: 15}}/>
                    </IconButton>
                </Tooltip>
            </Box>

            {props.chartType === 'xy' ? (
                <TextField
                    label={
                        <FieldInfoLabel
                            label='Up to X (XY)'
                            description='Upper bound for start values. The XY chart computes trajectories for all n in range 1..X.'
                        />
                    }
                    type='text'
                    size='small'
                    slotProps={{htmlInput: numericHtmlProps}}
                    value={props.xyLimitInput}
                    onChange={(event) => props.setXyLimitInput(event.target.value)}
                    sx={isSidebar ? undefined : {minWidth: {xs: '100%', md: 190}}}
                />
            ) : null}

            {props.chartType === 'path' ? (
                <TextField
                    label={
                        <FieldInfoLabel
                            label='Start n (Trace)'
                            description='Builds one Collatz trajectory for the selected start value until it reaches 1.'
                        />
                    }
                    type='text'
                    size='small'
                    slotProps={{htmlInput: numericHtmlProps}}
                    value={props.pathStartInput}
                    onChange={(event) => props.setPathStartInput(event.target.value)}
                    sx={isSidebar ? undefined : {minWidth: {xs: '100%', md: 190}}}
                />
            ) : null}

            {props.chartType === 'flow3d' ? (
                <Stack spacing={1} sx={{width: '100%'}}>
                    <Stack direction={isSidebar ? 'column' : 'row'} spacing={1} sx={{width: '100%'}}>
                        <TextField
                            label={(
                                <FieldInfoLabel
                                    label='Random starts'
                                    description='How many random starting values are sampled below 1,000,000 to build the 3D trajectory flow.'
                                />
                            )}
                            type='text'
                            size='small'
                            slotProps={{htmlInput: {...numericHtmlProps, maxLength: 6}}}
                            value={props.flowSamplesInput}
                            onChange={(event) => props.setFlowSamplesInput(event.target.value)}
                            sx={isSidebar ? undefined : {minWidth: {xs: '100%', md: 190}}}
                        />
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.9,
                                ml: isSidebar ? 0 : 0.5,
                                mt: isSidebar ? 0 : 0.1,
                            }}
                        >
                            <FormControlLabel
                                sx={{
                                    m: 0,
                                    '& .MuiFormControlLabel-label': {
                                        fontSize: 13,
                                        color: 'text.secondary',
                                        ml: 0.6,
                                    },
                                    '& .MuiSwitch-root': {
                                        py: 0.4,
                                    },
                                }}
                                control={(
                                    <Switch
                                        size='small'
                                        checked={props.treeColorEnabled}
                                        onChange={(event) => props.setTreeColorEnabled(event.target.checked)}
                                    />
                                )}
                                label='Color'
                            />
                            <Button
                                size='small'
                                variant='outlined'
                                onClick={props.onRandomizeTreeColors}
                                sx={{
                                    minWidth: 56,
                                    px: 0.85,
                                    py: 0.1,
                                    borderColor: 'rgba(164, 178, 208, 0.28)',
                                    color: 'text.secondary',
                                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    letterSpacing: '0.02em',
                                    textTransform: 'none',
                                    '&:hover': {
                                        borderColor: 'rgba(164, 178, 208, 0.45)',
                                        bgcolor: 'rgba(255, 255, 255, 0.06)',
                                    },
                                }}
                            >
                                Random
                            </Button>
                        </Box>
                    </Stack>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <Typography variant='caption' color='text.secondary' sx={{minWidth: 88}}>
                            Tail visibility
                        </Typography>
                        <Slider
                            size='small'
                            min={1}
                            max={6}
                            step={0.1}
                            value={props.flowTailVisibility}
                            onChange={(_, value) =>
                                props.setFlowTailVisibility(Array.isArray(value) ? value[0] : value)
                            }
                            valueLabelDisplay='auto'
                            valueLabelFormat={(value) => `${value.toFixed(1)}x`}
                            aria-label='Tail visibility'
                            sx={{flex: 1}}
                        />
                        <Typography variant='caption' color='text.secondary' sx={{minWidth: 34, textAlign: 'right'}}>
                            {props.flowTailVisibility.toFixed(1)}x
                        </Typography>
                    </Box>
                </Stack>
            ) : null}

            {props.chartType === 'network' ? (
                <TextField
                    label={
                        <FieldInfoLabel
                            label='Up to X (Network)'
                            description='Upper bound for start values. The network view shows all transitions from trajectories 1..X.'
                        />
                    }
                    type='text'
                    size='small'
                    slotProps={{htmlInput: numericHtmlProps}}
                    value={props.networkLimitInput}
                    onChange={(event) => props.setNetworkLimitInput(event.target.value)}
                    sx={isSidebar ? undefined : {minWidth: {xs: '100%', md: 220}}}
                />
            ) : null}

            {props.chartType === 'tree' || props.chartType === 'tree3d' ? (
                <Stack direction={isSidebar ? 'column' : 'row'} spacing={1} sx={{width: '100%'}}>
                    <TextField
                        label={
                            <FieldInfoLabel
                                label={props.chartType === 'tree3d' ? 'Layers (3D tree)' : 'Layers (Tree)'}
                                description={
                                    props.chartType === 'tree3d'
                                        ? 'Depth of reverse Collatz tree used as source for 3D line rendering.'
                                        : 'Depth of reverse Collatz tree starting from 1. Layer 1 contains 1, layer 2 contains 2, layer 3 contains 4, and so on.'
                                }
                            />
                        }
                        type='text'
                        size='small'
                        slotProps={{htmlInput: {...numericHtmlProps, maxLength: 4}}}
                        value={props.treeLayersInput}
                        onChange={(event) => props.setTreeLayersInput(event.target.value)}
                        sx={isSidebar ? undefined : {minWidth: {xs: '100%', md: 170}}}
                    />
                    <TextField
                        label={
                            <FieldInfoLabel
                                label='Turn deg'
                                description='Single cumulative turn per layer. Positive bends one side, negative bends opposite side, 0 keeps neutral orientation.'
                            />
                        }
                        type='text'
                        size='small'
                        slotProps={{htmlInput: signedNumericHtmlProps}}
                        value={props.treeTurnInput}
                        onChange={(event) => props.setTreeTurnInput(event.target.value)}
                        onBlur={() => {
                            if (!props.treeTurnInput || props.treeTurnInput === '-') {
                                props.setTreeTurnInput('0');
                            }
                        }}
                        sx={isSidebar ? undefined : {minWidth: {xs: '100%', md: 160}}}
                    />
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.9,
                            ml: isSidebar ? 0 : 0.5,
                            mt: isSidebar ? 0 : 0.1,
                        }}
                    >
                        <FormControlLabel
                            sx={{
                                m: 0,
                                '& .MuiFormControlLabel-label': {
                                    fontSize: 13,
                                    color: 'text.secondary',
                                    ml: 0.6,
                                },
                                '& .MuiSwitch-root': {
                                    py: 0.4,
                                },
                            }}
                            control={(
                                <Switch
                                    size='small'
                                    checked={props.treeColorEnabled}
                                    onChange={(event) => props.setTreeColorEnabled(event.target.checked)}
                                />
                            )}
                            label='Color'
                        />
                        <Button
                            size='small'
                            variant='outlined'
                            onClick={props.onRandomizeTreeColors}
                            sx={{
                                minWidth: 56,
                                px: 0.85,
                                py: 0.1,
                                borderColor: 'rgba(164, 178, 208, 0.28)',
                                color: 'text.secondary',
                                bgcolor: 'rgba(255, 255, 255, 0.02)',
                                fontSize: 11,
                                fontWeight: 500,
                                letterSpacing: '0.02em',
                                textTransform: 'none',
                                '&:hover': {
                                    borderColor: 'rgba(164, 178, 208, 0.45)',
                                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                                },
                            }}
                        >
                            Random
                        </Button>
                    </Box>
                </Stack>
            ) : null}

            {props.chartType === 'xy' ? (
                <FormControl size='small' sx={isSidebar ? undefined : {minWidth: {xs: '100%', md: 230}}}>
                    <Box sx={{display: 'inline-flex', alignItems: 'center', gap: 0.45, mb: 0.55}}>
                        <Typography variant='caption' color='text.secondary'>
                            Y metric (XY)
                        </Typography>
                        <Tooltip
                            title='Steps to 1: number of transitions to reach 1. Peak value: maximum value seen in the trajectory.'
                            arrow
                        >
                            <IconButton
                                size='small'
                                sx={infoIconSx}
                                aria-label='Y metric info'
                            >
                                <InfoOutlinedIcon sx={{fontSize: 15}}/>
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Select
                        value={props.metric}
                        onChange={(event) => props.setMetric(event.target.value as Metric)}
                        inputProps={{'aria-label': 'Y metric'}}
                    >
                        <MenuItem value='steps'>Steps to 1 (trajectory length)</MenuItem>
                        <MenuItem value='max_value'>Peak value (max on path)</MenuItem>
                    </Select>
                </FormControl>
            ) : null}

            {isSidebar ? null : <Box sx={{flexGrow: 1}}/>}
        </Stack>
    );
}
