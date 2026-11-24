export default {
  framework: '@storybook/html-vite',
  stories: ['../stories/*.stories.js'],
  staticDirs: [{ from: '../../../scripts/vendor/tabler', to: '/tabler' }],
  core: { disableTelemetry: true }
};