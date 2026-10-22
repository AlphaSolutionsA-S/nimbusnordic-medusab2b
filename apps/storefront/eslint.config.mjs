import { defineConfig } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"

export default defineConfig([
  ...nextVitals,
  {
    // NIMBUS-173: warn on new hardcoded JSX text so untranslated copy shows
    // up in review. Warn-level on purpose — never fails the build.
    files: ["src/app/**/*.tsx", "src/modules/**/*.tsx"],
    ignores: ["src/__tests__/**", "**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "warn",
        {
          noStrings: false,
          ignoreProps: true,
          // Punctuation and decorative glyphs used as raw JSX text.
          allowedStrings: [
            ",", ".", ":", "-", "—", "−", "+", "*", "%", "#", "&", "(", ")",
            "x", "×", "·", "•", "...", "…", ". . .", "0",
            "••••••••", "***************",
          ],
        },
      ],
    },
  },
])
