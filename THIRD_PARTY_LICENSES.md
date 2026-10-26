# Third-party licenses

Notices for third-party work that the BrotaSites platform uses or draws on. npm dependencies keep their own license files in `node_modules`; this file covers what is not installed as a package.

## React Bits

The animations on the BrotaSites marketing site (home page) were designed after these React Bits components: SplitText, AnimatedContent, ScrollExpand, SpecularButton, BorderGlow and StaggeredMenu (https://reactbits.dev, https://github.com/DavidHDev/react-bits).

No React Bits source code is copied into this repository: each effect is written from scratch in CSS and in our own components, and none of them adds a dependency. If React Bits code is ever copied or adapted here, list the file below and keep this notice with it.

Files adapted from React Bits: none.

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
