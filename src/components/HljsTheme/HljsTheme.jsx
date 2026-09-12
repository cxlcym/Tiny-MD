import hljsDark from 'highlight.js/styles/github-dark.css?raw'
import hljsLight from 'highlight.js/styles/github.css?raw'

// Bundled highlight.js theme (no CDN dependency, works offline)
function HljsTheme({ theme }) {
  return <style>{theme === 'dark' ? hljsDark : hljsLight}</style>
}

export default HljsTheme
