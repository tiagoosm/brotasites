# Third-party licenses

Notices for third-party work that the BrotaSites platform uses or draws on. npm dependencies keep their own license files in `node_modules`; this file covers what is not installed as a package.

## React Bits

React Bits (https://reactbits.dev, https://github.com/DavidHDev/react-bits) is used on the BrotaSites platform in two ways.

Files adapted from React Bits (their code, ported to TypeScript and changed), each with a header comment naming the component:

- `apps/platform/src/components/site/side-rays.tsx`: SideRays (the light rays behind the home page hero).
- `apps/platform/src/components/site/vine-trail.tsx`: the stems come from Ribbons (the vine that follows the cursor).

Effects designed after React Bits components, written from scratch in CSS and our own components, with no React Bits code and no added dependency: SplitText, AnimatedContent, ScrollExpand, SpecularButton, BorderGlow and StaggeredMenu (the home page animations).

When React Bits code is copied or adapted, list the file above and keep this notice with it.

Rules for this project:

- React Bits code may only be used on the BrotaSites platform itself (marketing site, form, dashboard). Never in `packages/templates`, `packages/generator`, the generated sites or the static export delivered to clients, because the license forbids redistributing the components.
- Do not install GSAP to run React Bits components without checking its license first: GSAP is not MIT. Its "Standard No Charge" license (https://gsap.com/standard-license) restricts use in no-code tools that compete with Webflow.

License of React Bits, as published in its repository (`LICENSE.md`):

```
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

The same restriction covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the sounds in the sound library. **You may not sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools or a substantially similar copy of them as a hosted service-whether alone, in a bundle, or as a ported version.**

What you make with the tools is yours to use. You can use exported code, images, videos, and audio files in any personal or commercial application, website, or product, including paid ones. **You may not sell or redistribute the exports on their own, either individually or as the product itself, such as a sound, texture, background, or template pack.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fonts of client sites

Client sites use these font families, hosted with each site as woff2 files (Latin subset). All are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org), which allows using, embedding and redistributing them, including commercially, as long as the fonts are not sold by themselves and the license goes with them. Each family's license text is in `packages/catalog/fonts/<id>/OFL.txt` and must be copied into every site and every static export next to the font files (the generator does this from E5 on).

Licenses checked on 2026-10-27 in the Google Fonts repository (`github.com/google/fonts`, `ofl/<family>/METADATA.pb`: `license: "OFL"`). Files taken from the Fontsource npm packages 5.3.0 (`@fontsource-variable/<id>` or `@fontsource/<id>`), which repackage the Google Fonts binaries and ship the same OFL text.

| Family | Source repository | Copyright |
| --- | --- | --- |
| Fraunces | https://github.com/undercasetype/Fraunces | 2020 The Fraunces Project Authors |
| Instrument Serif | https://github.com/Instrument/instrument-serif | 2022 The Instrument Serif Project Authors |
| DM Serif Display | https://github.com/googlefonts/dm-fonts | 2014-2017 Adobe Systems Incorporated, with Reserved Font Name "Source"; 2019 Google LLC |
| Cormorant Garamond | https://github.com/CatharsisFonts/Cormorant | 2015 The Cormorant Project Authors |
| Young Serif | https://github.com/noirblancrouge/YoungSerif | 2023 The Young Serif Project Authors |
| Bricolage Grotesque | https://github.com/ateliertriay/bricolage | 2022 The Bricolage Grotesque Project Authors |
| Space Grotesk | https://github.com/floriankarsten/space-grotesk | 2020 The Space Grotesk Project Authors |
| Manrope | https://github.com/googlefonts/manrope | 2019 The Manrope Project Authors |
| DM Sans | https://github.com/googlefonts/dm-fonts | 2014 The DM Sans Project Authors |
| Fredoka | https://github.com/hafontia-zz/Fredoka-One | 2016 The Fredoka Project Authors |
| Baloo 2 | https://github.com/yanone/Baloo2-Variable | 2019 The Baloo 2 Project Authors |
| Caveat | https://github.com/googlefonts/caveat | 2014 The Caveat Project Authors |
| Kalam | https://github.com/itfoundry/kalam | 2014 Indian Type Foundry |

Rules for this project:

- Keep `OFL.txt` next to the font files wherever they are shipped (sites and exports).
- Do not add fonts whose Reserved Font Name is their own name (Playfair Display, for example): the OFL treats a subset as a modified version, and a modified version may not use a reserved name. DM Serif Display reserves only "Source", which it does not use.
- Never sell the fonts by themselves.
