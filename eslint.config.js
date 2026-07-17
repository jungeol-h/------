import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // docs/에는 보관된 과거 레포(빌드 산출물 포함)가 있어 lint 대상에서 제외한다.
  globalIgnores(['dist', 'docs']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // 대문자 시작 = React 컴포넌트. eslint-plugin-react(jsx-uses-vars) 없이는
      // JSX에서만 쓰인 식별자를 core 룰이 미사용으로 오탐하므로 vars/args 모두 예외.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Vite 설정은 Node 환경에서 실행된다 (process.env 사용).
    files: ['vite.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Context Provider + useXxx 훅을 한 파일에 두는 패턴은 의도적 (HMR 시 전체
    // 리로드 감수). react-refresh 경고를 이 파일들에서만 끈다.
    files: [
      'src/platform/context/AuthContext.jsx',
      'src/platform/context/DataContext.jsx',
      'src/platform/booking/BookingContext.jsx',
      'src/platform/components/FeedbackProvider.jsx',
      'src/platform/components/common/ToastProvider.jsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
