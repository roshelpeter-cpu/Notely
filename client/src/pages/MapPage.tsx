import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { GraphData } from '../api/types'
import { PageHead } from '../components/scenery'
import { useWorkspace } from '../context/WorkspaceContext'
import { layoutGraph } from '../lib/layout'

const KIND_LABEL = {
  link: 'Direct link',
  notebook: 'Same notebook',
  tag: 'Shared tag',
} as const

export default function MapPage() {
  const { workspaceId } = useWorkspace()
  const navigate = useNavigate()
  const graph = useQuery({ queryKey: ['graph', workspaceId], queryFn: () => api.graph(workspaceId) })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const width = 960
  const height = 620
  const graphData = graph.data
  const nodes = graphData?.nodes || []
  const edges = graphData?.edges || []
  const laid = useMemo(() => {
    const current = graphData?.nodes || []
    const links = graphData?.edges || []
    const clusters = Object.fromEntries(current.map((node) => [node.id, node.notebookId]))
    return layoutGraph(current.map((node) => node.id), links, width, height, clusters)
  }, [graphData])
  const positions = new Map(laid.map((node) => [node.id, node]))
  const needle = query.trim().toLowerCase()
  const visible = nodes.filter((node) => !needle || node.title.toLowerCase().includes(needle))
  const visibleIds = new Set(visible.map((node) => node.id))
  const active = nodes.find((node) => node.id === selected) || null
  const activeEdges = edges.filter((edge) => edge.source === selected || edge.target === selected)

  function relatedTitle(id: number) {
    return nodes.find((node) => node.id === id)?.title || 'Note'
  }

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
      <div className="map-tools">
        <button className="btn btn-small btn-ghost" type="button" onClick={() => setScale((value) => Math.min(1.8, value + 0.15))}>Zoom in</button>
        <button className="btn btn-small btn-ghost" type="button" onClick={() => setScale((value) => Math.max(0.7, value - 0.15))}>Zoom out</button>
        <button className="btn btn-small btn-ghost" type="button" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }}>Reset view</button>
        <span className="map-legend"><i className="is-link" /> Direct link</span>
        <span className="map-legend"><i className="is-notebook" /> Same notebook</span>
        <span className="map-legend"><i className="is-tag" /> Shared tag</span>
      </div>
      <div
        className="panel map-stage"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('.map-node')) return
          drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          setPan({
            x: drag.current.panX + event.clientX - drag.current.x,
            y: drag.current.panY + event.clientY - drag.current.y,
          })
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerLeave={() => { drag.current = null }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Notes connected by links and shared shelves">
          <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
            {edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map((edge) => {
              const a = positions.get(edge.source)
              const b = positions.get(edge.target)
              if (!a || !b) return null
              const hot = selected === edge.source || selected === edge.target
              return (
                <path
                  key={`${edge.kind}-${edge.source}-${edge.target}`}
                  className={`map-edge is-${edge.kind || 'link'} ${hot ? 'is-hot' : ''} ${selected && !hot ? 'is-dim' : ''}`}
                  d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                />
              )
            })}
            {visible.map((node) => {
              const point = positions.get(node.id)
              if (!point) return null
              const linked = selected != null && activeEdges.some((edge) => edge.source === node.id || edge.target === node.id)
              return (
                <g
                  key={node.id}
                  className={`map-node ${selected === node.id ? 'is-selected' : ''} ${linked ? 'is-linked' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.title}. ${node.linkCount} direct links.`}
                  onClick={() => setSelected(node.id)}
                  onDoubleClick={() => navigate(`/app/notes/${node.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') navigate(`/app/notes/${node.id}`)
                    if (event.key === ' ') {
                      event.preventDefault()
                      setSelected(node.id)
                    }
                  }}
                >
                  <title>{`${node.title}${node.notebookName ? ` · ${node.notebookName}` : ''}. ${node.linkCount} direct links.`}</title>
                  <circle cx={point.x} cy={point.y} r={18 + Math.min(node.linkCount, 6) * 2} />
                  <text x={point.x} y={point.y + 36} textAnchor="middle">{node.title.length > 28 ? `${node.title.slice(0, 26)}…` : node.title}</text>
                </g>
              )
            })}
          </g>
        </svg>
        {nodes.length === 0 && <p className="muted map-empty">Link two notes, or keep two in the same notebook, and a path will appear.</p>}
        {nodes.length > 0 && edges.length === 0 && <p className="muted map-empty">These notes are not connected yet. Link them, or place two in one notebook.</p>}
      </div>
      {active && <MapDetail node={active} edges={activeEdges} relatedTitle={relatedTitle} onOpen={() => navigate(`/app/notes/${active.id}`)} />}
    </div>
  )
}

function MapDetail({
  node,
  edges,
  relatedTitle,
  onOpen,
}: {
  node: GraphData['nodes'][number]
  edges: GraphData['edges']
  relatedTitle: (id: number) => string
  onOpen: () => void
}) {
  return (
    <section className="panel map-detail">
      <div className="spread">
        <div>
          <p className="eyebrow">{node.notebookName || 'Loose note'}</p>
          <h2>{node.title}</h2>
        </div>
        <button className="btn btn-primary btn-small" type="button" onClick={onOpen}>Open note</button>
      </div>
      <p className="muted">{node.linkCount} direct {node.linkCount === 1 ? 'link' : 'links'}. Double-click a node to open it.</p>
      {edges.length === 0 && <p>This note has no drawn paths yet.</p>}
      <ul className="activity-list">
        {edges.map((edge) => {
          const other = edge.source === node.id ? edge.target : edge.source
          return (
            <li key={`${edge.kind}-${other}`}>
              <span>{relatedTitle(other)}</span>
              <small>{KIND_LABEL[edge.kind || 'link']}</small>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
