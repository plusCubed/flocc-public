module.exports = {
  future: {
    removeDeprecatedGapUtilities: true,
    purgeLayersByDefault: true,
  },
  purge: ['./src/**/*.html', './src/**/*.css', './src/**/*.js'],
  theme: {
    extend: {},
  },
  variants: [
    'responsive',
    'group-hover',
    'disabled',
    'hover',
    'focus',
    'active',
  ],
  plugins: [],
};
