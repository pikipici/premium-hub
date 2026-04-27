const vitestConfig = {
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['vendor/**', 'node_modules/**', '.next/**'],
  },
}

export default vitestConfig
