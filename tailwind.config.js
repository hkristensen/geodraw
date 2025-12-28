/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                'xs': '375px', // Small phones
            },
            colors: {
                'territory': {
                    'dark': '#0f172a',
                    'darker': '#020617',
                    'accent': '#f97316',
                    'accent-light': '#fdba74',
                }
            },
            backdropBlur: {
                'xs': '2px',
            },
            spacing: {
                'safe-top': 'var(--safe-area-top)',
                'safe-bottom': 'var(--safe-area-bottom)',
                'nav': 'var(--mobile-nav-height)',
            },
            animation: {
                'slideUp': 'slideUp 0.3s ease-out forwards',
                'slideDown': 'slideDown 0.3s ease-out forwards',
            },
            minHeight: {
                'touch': '44px',
            },
            minWidth: {
                'touch': '44px',
            }
        },
    },
    plugins: [],
}
