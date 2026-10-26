<script lang="ts">
  // The CrystalLens mark: a unit cell seen along its body diagonal, inside a lens.
  let { size = 40 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" class="logo">
  <defs>
    <linearGradient id="cl-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1" />
      <stop offset="1" stop-color="#0ea5a4" />
    </linearGradient>
    <radialGradient id="cl-atom" cx="0.35" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="1" stop-color="#c7d2fe" />
    </radialGradient>
  </defs>
  <rect width="48" height="48" rx="12" fill="url(#cl-bg)" />
  <circle
    cx="24"
    cy="24"
    r="18.5"
    fill="none"
    stroke="#fff"
    stroke-opacity="0.28"
    stroke-width="1.5"
  />
  <g stroke="#fff" stroke-opacity="0.9" stroke-width="1.6" fill="none" stroke-linejoin="round">
    <path d="M24 9.5 36.5 16.75v14.5L24 38.5 11.5 31.25v-14.5z" />
    <path d="M24 24 11.5 16.75M24 24l12.5-7.25M24 24v14.5" stroke-opacity="0.55" />
  </g>
  <circle cx="24" cy="24" r="4" fill="#fde68a" />
  <g fill="url(#cl-atom)">
    <circle cx="24" cy="9.5" r="2.6" />
    <circle cx="36.5" cy="16.75" r="2.6" />
    <circle cx="36.5" cy="31.25" r="2.6" />
    <circle cx="24" cy="38.5" r="2.6" />
    <circle cx="11.5" cy="31.25" r="2.6" />
    <circle cx="11.5" cy="16.75" r="2.6" />
  </g>
</svg>

<style>
  .logo {
    display: block;
    flex: none;
    filter: drop-shadow(0 2px 6px rgba(79, 70, 229, 0.25));
  }
</style>
