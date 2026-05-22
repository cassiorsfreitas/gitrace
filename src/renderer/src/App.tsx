function App(): JSX.Element {
  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="app-title">Gitrace</span>
        </div>
        <div className="sidebar-body" />
      </div>
      <div className="main-content">
        <div className="empty-state">
          <p>Add a repository to get started.</p>
        </div>
      </div>
    </div>
  )
}

export default App
