# Niva mascot additions

## Transparent artwork correction

The three `public/assets/niva-*-cutout.webp` assets were edited with the built-in image generation tool and optimized to a maximum 640px while preserving alpha. Prompt: preserve the exact reference character, pose, props, materials and lighting; remove the entire pale-blue studio backdrop and floor; provide the full uncropped subject on true transparency, without a colored rectangle, floor, cast shadow, vignette or baked checkerboard.

The step images now share one CSS frame using the current theme's canvas color and a subtle blue radial glow. Transparent pixels expose the same continuous background across each frame, so square source images no longer produce differently colored vertical side bands. The closing wave also uses transparency. Original source images remain unchanged.

Generated with the built-in image generation tool, using `public/assets/niva-hero.webp` as the character identity reference. Optimized to 640px WebP assets. No external stock art was used.

- `public/assets/niva-wave.webp`: preserve Niva's rounded light-blue body, navy glossy face, smiling crescent eyes, blue hands and feet and iridescent ear discs; full-body wave, pale blue studio backdrop, premium soft 3D render, no document, text, logo or watermark.
- `public/assets/niva-search.webp`: same character identity, holding a magnifying glass beside a floating white opportunity card with a blue star; centered full-body pose, pale blue backdrop and lavender contact shadow, no words, numbers, logo or watermark.

The original mascot remains in the hero and the final step. The wave appears in the first step and closing invitation; the search pose appears in the second step. Decorative images have empty alt text beside explanatory headings. Additional images are lazy-loaded with reserved dimensions.

Entrance, greeting and sparkle animations finish within 4.15 seconds. Hover movement uses short transitions. All new motion requires `prefers-reduced-motion: no-preference`; static content remains visible otherwise.
