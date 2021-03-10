const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  purge: ['./src/**/*.html', './src/**/*.css', './src/**/*.js'],
  theme: {
    fontFamily: {
      sans: ['Open Sans', ...defaultTheme.fontFamily.sans],
      mono: ['Roboto Mono', ...defaultTheme.fontFamily.mono],
    },
    colors: {
      white: '#FFFFFF',
      black: '#000000',
      transparent: 'rgba(0,0,0,0)',
      gray: colors.gray,
      red: colors.red,
      amber: colors.amber,
      green: colors.green,
      teal: colors.teal,
      blue: colors.blue,
      indigo: colors.indigo,
      purple: colors.purple,
      pink: colors.pink,
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
  ],
};
