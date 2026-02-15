const path = require('path');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log'
  }
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: 'web',
  mode: 'none',
  entry: './src/editor/webview/codeEditorBundle.ts',
  output: {
    path: path.resolve(__dirname, 'media'),
    filename: 'codeEditor.js',
    library: {
      type: 'window'
    }
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  performance: {
    hints: false
  }
};

/** @type {import('webpack').Configuration} */
const mermaidConfig = {
  target: 'web',
  mode: 'none',
  entry: './src/editor/webview/mermaidBundle.ts',
  output: {
    path: path.resolve(__dirname, 'media'),
    filename: 'mermaid.js',
    library: {
      type: 'window'
    }
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      }
    ]
  },
  // Disable code splitting - bundle everything into a single file for webview
  optimization: {
    splitChunks: false,
  },
  plugins: [
    new (require('webpack').optimize.LimitChunkCountPlugin)({
      maxChunks: 1,
    }),
  ],
  devtool: 'nosources-source-map',
  performance: {
    hints: false
  }
};

module.exports = [extensionConfig, webviewConfig, mermaidConfig];
