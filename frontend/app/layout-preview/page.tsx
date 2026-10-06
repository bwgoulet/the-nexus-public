const layouts = [
  {
    title: 'Main Scoreboard',
    description: 'In-game overlay with team scores, active players, and crew character slots.',
    href: '/layout-static-preview/main-scoreboard.html'
  },
  {
    title: 'Summary Scoreboard',
    description: 'Match summary overlay with team lists, standby rows, and series score diamonds.',
    href: '/layout-static-preview/summary-scoreboard.html'
  }
];

export default function LayoutPreviewPage() {
  return (
    <main className="layout-preview-page">
      <section className="layout-preview-hero" aria-labelledby="layout-preview-title">
        <p className="layout-preview-kicker">Broadcast assets</p>
        <h1 id="layout-preview-title">Layout Preview</h1>
        <p>
          These previews render design-only static copies of the broadcast overlays. They load the original layout CSS, but skip
          all overlay JavaScript, websocket connections, and live data logic.
        </p>
      </section>

      <div className="layout-preview-grid">
        {layouts.map((layout) => (
          <article className="layout-preview-card" key={layout.href}>
            <div className="layout-preview-card-header">
              <div>
                <h2>{layout.title}</h2>
                <p>{layout.description}</p>
              </div>
              <a href={layout.href} target="_blank" rel="noreferrer">
                Open full page
              </a>
            </div>
            <div className="layout-preview-frame-wrap">
              <iframe title={`${layout.title} preview`} src={layout.href} className="layout-preview-frame" />
            </div>
            <code className="layout-preview-path">{layout.href}</code>
          </article>
        ))}
      </div>
    </main>
  );
}
