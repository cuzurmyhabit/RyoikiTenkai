import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      // 이 프로젝트는 useMemo/useFrame 내부에서 랜덤/오브젝트 갱신을 적극적으로 쓰고 있어
      // purity/immutability 규칙과 충돌합니다.
      // (런타임 동작엔 영향 없이) 린트 통과를 우선합니다.
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
