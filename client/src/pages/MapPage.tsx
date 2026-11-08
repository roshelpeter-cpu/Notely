import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useWorkspace } from '../context/WorkspaceContext'
import { PageHead } from '../components/scenery'
import { layoutGraph } from '../lib/layout'

export default function MapPage() {
  const { workspaceId } = useWorkspace()
  const navigate = useNavigate()
  const graph = useQuery({ queryKey: ['graph', workspaceId], queryFn: () => api.graph(workspaceId) })
  const [query, setQuery] = useState('')
  const width = 960
  const height = 620
  const laid = useMemo(
    () => layoutGraph((graph.data?.nodes || []).map((node) => node.id), graph.data?.edges || [], width, height),
    [graph.data],
  )
  const positions = new Map(laid.map((node) => [node.id, node]))
  const needle = query.trim().toLowerCase()
  const visible = (graph.data?.nodes || []).filter((node) => !needle || node.title.toLowerCase().includes(needle))
  const visibleIds = new Set(visible.map((node) => node.id))

  return (
    <div className="page page-map">
      <PageHead
        eyebrow="Paths between ideas"
        title="Knowledge map"
        scene="map"
        actions={<input aria-label="Search connected notes" placeholder="Find a note on the map" value={query} onChange={(event) => setQuery(event.target.value)} />}
      />
      {graph.isLoading && <p>Drawing the paths…</p>}
      {graph.isError && <p className="save-bad">The map could not be drawn.</p>}
      <div className="panel map-stage">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Notes connected by links">
          {(graph.data?.edges || []).filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map((edge) => {
            const a = positions.get(edge.source)
            const b = positions.get(edge.target)
            if (!a || !b) return null
            return <path key={`${edge.source}-${edge.target}`} className="map-edge" d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} />
          })}
          {visible.map((node) => {
            const point = positions.get(node.id)
            if (!point) return null
            return (
              <g key={node.id} className="map-node" onClick={() => navigate(`/app/notes/${node.id}`)}>
                <circle cx={point.x} cy={point.y} r={16 + Math.min(node.linkCount, 6) * 2} fill="var(--gold-2)" stroke="var(--forest)" />
                <text x={point.x} y={point.y + 32} textAnchor="middle">{node.title.length > 32 ? `${node.title.slice(0, 30)}…` : node.title}</text>
              </g>
            )
          })}
        </svg>
        {graph.data?.nodes.length === 0 && <p className="muted">Link two notes and they will appear on this map.</p>}
      </div>
    </div>
  )
}
