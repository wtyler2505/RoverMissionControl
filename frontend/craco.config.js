const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Code splitting optimization for production builds
      if (env === 'production') {
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          
          // Enable aggressive tree shaking
          usedExports: true,
          sideEffects: false,
          concatenateModules: true,
          
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // Vendor chunk for third-party libraries
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                priority: 10,
                reuseExistingChunk: true,
              },
              
              // React-specific libraries
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router|@react)[\\/]/,
                name: 'react-vendor',
                chunks: 'all',
                priority: 20,
                reuseExistingChunk: true,
              },
              
              // Three.js and 3D libraries
              threejs: {
                test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
                name: 'threejs-vendor',
                chunks: 'all',
                priority: 15,
                reuseExistingChunk: true,
              },
              
              // Chart.js and visualization libraries
              charts: {
                test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2|d3)[\\/]/,
                name: 'charts-vendor',
                chunks: 'all',
                priority: 15,
                reuseExistingChunk: true,
              },
              
              // Monaco Editor (large code editor)
              monaco: {
                test: /[\\/]node_modules[\\/](@monaco-editor|monaco-editor)[\\/]/,
                name: 'monaco-vendor',
                chunks: 'all',
                priority: 15,
                reuseExistingChunk: true,
              },
              
              // Shared components chunk
              shared: {
                test: /[\\/]src[\\/]components[\\/]shared[\\/]/,
                name: 'shared-components',
                chunks: 'all',
                priority: 5,
                minChunks: 2,
                reuseExistingChunk: true,
              },
              
              // UI components chunk
              ui: {
                test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
                name: 'ui-components',
                chunks: 'all',
                priority: 5,
                minChunks: 2,
                reuseExistingChunk: true,
              },
              
              // Utils and services chunk
              utils: {
                test: /[\\/]src[\\/](utils|services|hooks)[\\/]/,
                name: 'utils-services',
                chunks: 'all',
                priority: 5,
                minChunks: 2,
                reuseExistingChunk: true,
              },
            },
          },
          
          // Runtime chunk for better caching
          runtimeChunk: {
            name: 'webpack-runtime',
          },
        };

        // Optimize chunk naming for better caching
        webpackConfig.output = {
          ...webpackConfig.output,
          filename: 'static/js/[name].[contenthash:8].js',
          chunkFilename: 'static/js/[name].[contenthash:8].chunk.js',
        };
      }

      // Bundle analyzer plugin for analysis builds
      if (process.env.ANALYZE) {
        const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
        webpackConfig.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: path.resolve(__dirname, 'bundle-analysis.html'),
          })
        );
      }

      // Asset optimization plugins
      webpackConfig.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.resolve(__dirname, 'src/assets/images/optimized'),
              to: path.resolve(__dirname, 'build/static/images'),
              noErrorOnMissing: true,
            },
            {
              from: path.resolve(__dirname, 'src/assets/fonts'),
              to: path.resolve(__dirname, 'build/static/fonts'),
              noErrorOnMissing: true,
            }
          ],
        })
      );

      // Image optimization for production
      if (env === 'production') {
        // Add image optimization loader
        const imageRule = {
          test: /\.(png|jpe?g|gif|svg|webp|avif)$/i,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: 'static/images/[name].[contenthash:8].[ext]',
                publicPath: '/',
              },
            },
            {
              loader: 'image-webpack-loader',
              options: {
                disable: env !== 'production',
                mozjpeg: {
                  progressive: true,
                  quality: 85,
                },
                optipng: {
                  enabled: false,
                },
                pngquant: {
                  quality: [0.6, 0.8],
                },
                gifsicle: {
                  interlaced: false,
                },
                webp: {
                  quality: 80,
                },
                svgo: {
                  plugins: [
                    { name: 'removeViewBox', active: false },
                    { name: 'cleanupIDs', active: false }
                  ],
                },
              },
            },
          ],
        };

        // Add the rule to existing rules
        const oneOfRule = webpackConfig.module.rules.find(rule => rule.oneOf);
        if (oneOfRule) {
          oneOfRule.oneOf.unshift(imageRule);
        }
      }

      // Path aliases for cleaner imports
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@modules': path.resolve(__dirname, 'src/components/modules'),
        '@shared': path.resolve(__dirname, 'src/components/shared'),
        '@loading': path.resolve(__dirname, 'src/components/loading'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
      };

      return webpackConfig;
    },
  },
  
  // Babel configuration for optimization
  babel: {
    plugins: [
      // Transform runtime for smaller bundles
      ['@babel/plugin-transform-runtime', {
        helpers: true,
        regenerator: true,
        useESModules: true,
      }],
      
      // Remove PropTypes in production
      ...(process.env.NODE_ENV === 'production' ? ['babel-plugin-transform-react-remove-prop-types'] : []),
    ],
  },
  
  // ESLint configuration
  eslint: {
    enable: true,
    mode: 'extends',
  },
  
  // Development server configuration
  devServer: {
    port: 3000,
    hot: true,
    compress: true,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  
  // Style configuration
  style: {
    css: {
      loaderOptions: {
        // PostCSS configuration for optimization
        postcss: {
          plugins: [
            require('autoprefixer'),
            ...(process.env.NODE_ENV === 'production' 
              ? [require('cssnano')({ preset: 'default' })] 
              : []
            ),
          ],
        },
      },
    },
  },
};