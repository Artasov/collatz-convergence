import {createTheme} from '@mui/material/styles';

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
        borderRadius: 10,
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
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    backgroundImage: 'none',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: 'none',
                },
            },
        },
        MuiAccordion: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    margin: '0 !important',
                    '&.Mui-expanded': {
                        margin: '0 !important',
                    },
                    '&:before': {
                        display: 'none',
                    },
                    transition: 'none',
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    transition: 'background-color 220ms ease',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(147, 166, 209, 0.32)',
                        transition: 'border-color 220ms ease',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(166, 188, 236, 0.58)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#4c93ff',
                        borderWidth: '1px',
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    transition: 'color 220ms ease, transform 220ms ease',
                },
            },
        },
        MuiAccordionSummary: {
            styleOverrides: {
                root: {
                    minHeight: 40,
                    '&.Mui-expanded': {
                        minHeight: 40,
                    },
                },
                content: {
                    margin: '8px 0 !important',
                    transition: 'none',
                    '&.Mui-expanded': {
                        margin: '8px 0 !important',
                    },
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: 'rgba(14, 20, 36, 0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(182, 198, 232, 0.26)',
                    color: '#e7efff',
                    boxShadow: '0 10px 28px rgba(7, 10, 22, 0.45)',
                },
                arrow: {
                    color: 'rgba(14, 20, 36, 0.82)',
                },
            },
        },
    },
});
