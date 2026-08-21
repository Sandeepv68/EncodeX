<template>
  <footer class="site-footer">
    <div class="sf-shell">
      <div class="sf-cols">
        <div class="sf-brand">
          <div class="sf-brand-row">
            <img src="/images/icon.webp" width="30" height="30" alt="" class="sf-logo">
            <span class="sf-name">EncodeX</span>
          </div>
          <p class="sf-tagline">
            The free, friendly way to convert videos, extract music, trim
            clips, and shrink photos.
          </p>
        </div>

        <nav class="sf-link-cols" aria-label="Footer">
          <div class="sf-col">
            <p class="sf-col-title">Product</p>
            <a href="/features">Features</a>
            <a href="/download">Download</a>
            <a href="/blog/">Blog</a>
          </div>
          <div class="sf-col">
            <p class="sf-col-title">Community</p>
            <a href="/contributing">Contributing</a>
            <a href="https://github.com/Sandeepv68/EncodeX" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/Sandeepv68/EncodeX/releases" target="_blank" rel="noopener noreferrer">Releases</a>
          </div>
          <div class="sf-col">
            <p class="sf-col-title">Support</p>
            <a href="/docs/architecture">Technical Docs</a>
            <a href="mailto:developer@encodex.in">Contact</a>
            <a href="/download#need-help">Get Help</a>
          </div>
        </nav>
      </div>

      <div class="sf-bottom">
        <p>&copy; {{ year }} EncodeX Contributors · Released under the MIT License</p>
        <p>Made with <span class="sf-heart">&#10084;&#65039;</span> by the community</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
const year = new Date().getFullYear()
</script>
