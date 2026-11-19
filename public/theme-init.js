// Pose le thème avant la première peinture pour éviter tout flash clair.
// Ce fichier est chargé de façon bloquante dans le <head> : il ne doit
// dépendre d'aucun autre script et rester le plus petit possible.
;(function () {
  try {
    var root = document.documentElement
    var saved = localStorage.getItem('bondev-theme')
    var theme =
      saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
    root.dataset.theme = theme
    root.style.colorScheme = theme
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#f7f9ff' : '#050816')
    }
  } catch (error) {
    // Le thème sombre reste le défaut si localStorage est indisponible.
  }
})()
