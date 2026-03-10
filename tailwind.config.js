import { fontFamily } from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                serif: ['Playfair Display', ...fontFamily.serif],
                sans: ['Inter', ...fontFamily.sans]
            },
            colors: {
                ink: {
                    50: '#faf9f7',
                    100: '#f5f3ef',
                    200: '#e8e4dd',
                    300: '#d4cfc5',
                    400: '#a8a193',
                    500: '#7c7568',
                    600: '#565048',
                    700: '#3d3831',
                    800: '#2a2520',
                    900: '#1a1614'
                },
                accent: {
                    50: '#fef7f0',
                    100: '#fdebd4',
                    200: '#fbd3a8',
                    300: '#f7b571',
                    400: '#f29038',
                    500: '#e87a16',
                    600: '#d4620e',
                    700: '#af4a0e',
                    800: '#8c3b13',
                    900: '#733313'
                },
                sage: {
                    50: '#f4f7f4',
                    100: '#e3ebe3',
                    200: '#c8d8c8',
                    300: '#a1bda1',
                    400: '#769c76',
                    500: '#567d56',
                    600: '#436443',
                    700: '#375037',
                    800: '#2e412e',
                    900: '#273627'
                }
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.5s ease-out',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite'
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' }
                }
            }
        }
    },
    plugins: []
}
