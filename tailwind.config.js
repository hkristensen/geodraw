/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
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
            }
        },
    },
    plugins: [],
}
