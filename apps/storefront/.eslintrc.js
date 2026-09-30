module.exports = {
  extends: ["next/core-web-vitals"],
  overrides: [
    {
      // NIMBUS-173: warn on new hardcoded JSX text so untranslated copy shows
      // up in review. Warn-level on purpose — never fails the build.
      files: ["src/app/**/*.tsx", "src/modules/**/*.tsx"],
      excludedFiles: ["src/__tests__/**", "**/*.test.tsx"],
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
  ],
}
