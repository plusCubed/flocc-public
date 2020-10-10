module.exports = {
  future: {
    removeDeprecatedGapUtilities: true,
    purgeLayersByDefault: true,
  },
  purge: ['./src/**/*.html', './src/**/*.css', './src/**/*.js'],
  theme: {
    extend: {},
  },
  variants: {
    opacity: ['disabled'],
  },
  plugins: [],
};
