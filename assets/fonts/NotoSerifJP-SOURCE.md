# Noto Serif JP

- Official source family and license: https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoserifjp
- License: OFL-NotoSerifJP.txt (SIL Open Font License1.1, full copyright notice included).
- The production layout retains Noto Serif JP at weights400 and700, swap and its existing CSS variable.
- Google-hosted WOFF2 files were copied byte-for-byte from the public CSS response in NotoSerifJP-subsets.json. The original248 unicode-range faces use124 unique files; no glyph subsetting or font conversion was performed on the shipped files.
- Only the latin file is preloaded. Japanese subsets remain on demand; a single full6MB font is not forced onto mobile startup.
- The fallback uses the same Times New Roman metrics provided by the installed Next15 Google font loader. CSS and file hashes are checked offline.
- This removes the build-time dependency on the format of Google font URLs. Native/public rendering and the hosted build are separate verification steps.
