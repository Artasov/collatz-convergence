import {
    Box,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
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
    pathStartInput: string;
    setPathStartInput: (value: string) => void;
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

function FieldInfoLabel(props: FieldInfoLabelProps) {
    return (
        <Box sx={{display: 'inline-flex', alignItems: 'center', gap: 0.4}}>
            <Typography component='span' sx={{fontSize: 'inherit', lineHeight: 1}}>
                {props.label}
            </Typography>
            <Tooltip title={props.description} arrow>
                <IconButton
                    size='small'
                    sx={{p: 0, color: 'text.secondary'}}
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
                    <InputLabel id='chart-type-label'>Chart type</InputLabel>
                    <Select
                        labelId='chart-type-label'
                        value={props.chartType}
                        label='Chart type'
                        onChange={(event) => props.setChartType(event.target.value as ChartType)}
                        inputProps={{'aria-label': 'Chart type'}}
                    >
                        <MenuItem value='xy'>XY line</MenuItem>
                        <MenuItem value='tree'>Convergence tree</MenuItem>
                        <MenuItem value='tree3d'>3D tree (coral)</MenuItem>
                        <MenuItem value='path'>Single number trace</MenuItem>
                        <MenuItem value='network'>Transition network (hairball)</MenuItem>
                    </Select>
                </FormControl>
                <Tooltip title='Choose visual mode. Each mode has its own settings below.' arrow>
                    <IconButton
                        size='small'
                        sx={{p: 0, color: 'text.secondary', alignSelf: 'center'}}
                        aria-label='Chart type info'
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
                                        ? 'Depth of reverse Collatz tree used as source for 3D coral-like line rendering.'
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
                                sx={{p: 0, color: 'text.secondary'}}
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
