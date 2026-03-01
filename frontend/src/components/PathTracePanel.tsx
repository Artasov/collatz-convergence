import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface Props {
  startN: number;
  setStartN: (value: number) => void;
  onTrace: () => void;
  loading: boolean;
  layout?: 'inline' | 'sidebar';
}

export function PathTracePanel(props: Props) {
  const isSidebar = props.layout === 'sidebar';

  return (
    <Stack
      direction={isSidebar ? 'column' : { xs: 'column', md: 'row' }}
      spacing={1.5}
      alignItems={isSidebar ? 'stretch' : { xs: 'stretch', md: 'center' }}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
        <Typography variant='body2' sx={{ fontWeight: 600 }}>
          Trace specific number
        </Typography>
        <Tooltip
          title='Builds one Collatz trajectory for selected n and stops at 1.'
          arrow
        >
          <IconButton size='small' sx={{ p: 0, color: 'text.secondary' }}>
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <TextField
        label='Start n'
        type='number'
        size='small'
        slotProps={{ htmlInput: { min: 1, max: 10_000_000 } }}
        value={props.startN}
        onChange={(event) => props.setStartN(Number(event.target.value))}
        sx={isSidebar ? undefined : { minWidth: { xs: '100%', md: 190 } }}
      />

      <Button
        variant='outlined'
        size='small'
        onClick={props.onTrace}
        disabled={props.loading || props.startN <= 0}
        fullWidth={isSidebar}
      >
        {props.loading ? 'Tracing...' : 'Trace path'}
      </Button>
    </Stack>
  );
}
