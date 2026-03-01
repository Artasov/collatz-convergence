import { createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3f8cff',
      light: '#80b5ff',
      dark: '#235fba',
    },
    secondary: {
      main: '#a78bfa',
      light: '#c4b5fd',
      dark: '#7c5ce6',
    },
    background: {
      default: '#070a14',
      paper: '#11172a',
    },
    text: {
      primary: '#f2f6ff',
      secondary: '#a6b2cc',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: 'Trebuchet MS, "Segoe UI", sans-serif',
    h4: {
      fontWeight: 800,
      letterSpacing: '0.01em',
    },
    h6: {
      fontWeight: 700,
    },
  },
  components: {
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiFormControl: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiButton: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});
