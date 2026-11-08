import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { PageHead } from '../components/scenery'
import { useWorkspace } from '../context/WorkspaceContext'

export default function InsightsPage() {
  const { workspaceId } = useWorkspace()
  const stats = useQuery({ queryKey: ['stats', workspaceId], queryFn: () => api.stats(workspaceId) })
  const suggestions = useQuery({ queryKey: ['suggestions', workspaceId], queryFn: () => api.suggestions(workspaceId) })
  const data = stats.data

  return (
    <div className="page page-insights">
      <PageHead eyebrow="From the records" title="Insights" scene="village" crop="left" />
      {stats.isLoading && <p>Counting the pages…</p>}
      {stats.isError && <p className="save-bad">The records could not be read.</p>}
      {data && (
        <>
          <section className="grid-4">
            <article className="card stat"><span>Notes</span><strong>{data.totals.notes}</strong></article>
            <article className="card stat"><span>Words</span><strong>{data.totals.words}</strong></article>
            <article className="card stat"><span>Tasks completed</span><strong>{data.totals.completedTasks}</strong></article>
            <article className="card stat"><span>Active days</span><strong>{data.streak.activeDays}</strong><small className="muted">Current streak {data.streak.current}</small></article>
          </section>
          <div className="grid-2" style={{ marginTop: 16 }}>
            <section className="panel">
              <h2>Notes over time</h2>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.notesByWeek}>
                    <XAxis dataKey="weekStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <Tooltip />
                    <Area dataKey="count" stroke="var(--forest-2)" fill="var(--sage)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <h2>Words by weekday</h2>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weekdays}>
                    <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--gold)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <div className="grid-2" style={{ marginTop: 16 }}>
            <section className="panel">
              <h2>Most-used tags</h2>
              {(data.topTags || []).length === 0 && <p className="muted">Tags will appear after notes are labelled.</p>}
              <ul className="activity-list">
                {data.topTags.map((tag) => <li key={tag.name}><span>{tag.name}</span><strong>{tag.count}</strong></li>)}
              </ul>
            </section>
            <section className="panel">
              <h2>Notebooks</h2>
              <ul className="activity-list">
                {data.notebooks.map((notebook) => <li key={notebook.name}><span>{notebook.name}</span><strong>{notebook.count}</strong></li>)}
              </ul>
            </section>
          </div>
        </>
      )}
      <section className="panel">
        <h2>Organisation suggestions</h2>
        <p className="muted">{suggestions.data?.method || 'Keyword matching on this device. No model is involved.'}</p>
        <h3>Without a notebook</h3>
        <ul>{(suggestions.data?.unassigned || []).map((item) => <li key={item.id}>{item.title}</li>)}</ul>
        <h3>Possible duplicate titles</h3>
        <ul>{(suggestions.data?.duplicateTitles || []).map((item) => <li key={item.title}>{item.title}</li>)}</ul>
        {(suggestions.data?.unassigned.length === 0 && suggestions.data?.duplicateTitles.length === 0) && <p className="muted">Nothing to tidy right now.</p>}
      </section>
    </div>
  )
}
