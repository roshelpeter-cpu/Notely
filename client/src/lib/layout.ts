export interface LaidNode {
  id: number
  x: number
  y: number
}

export function layoutGraph(
  ids: number[],
  edges: { source: number; target: number; kind?: string }[],
  width: number,
  height: number,
  clusters: Record<number, number | null> = {},
): LaidNode[] {
  const points = new Map<number, { x: number; y: number }>()
  const groups = [...new Set(ids.map((id) => clusters[id] ?? id))]
  ids.forEach((id, index) => {
    const group = clusters[id] ?? id
    const slot = Math.max(0, groups.indexOf(group))
    const angle = (slot / Math.max(groups.length, 1)) * Math.PI * 2
    const radius = Math.min(width, height) * 0.3
    const local = index % 4
    points.set(id, {
      x: width / 2 + Math.cos(angle) * radius + (local - 1.5) * 28,
      y: height / 2 + Math.sin(angle) * radius * 0.72 + ((index % 3) - 1) * 22,
    })
  })
  const list = ids.map((id) => points.get(id)!)
  const pull = (kind?: string) => (kind === 'link' ? 0.04 : kind === 'notebook' ? 0.022 : 0.012)
  for (let iteration = 0; iteration < 160; iteration += 1) {
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = list[i]
        const b = list[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        const distance = Math.hypot(dx, dy) || 0.1
        const force = Math.min(34, 32000 / (distance * distance))
        dx = (dx / distance) * force
        dy = (dy / distance) * force
        a.x += dx
        a.y += dy
        b.x -= dx
        b.y -= dy
      }
    }
    for (const edge of edges) {
      const a = points.get(edge.source)
      const b = points.get(edge.target)
      if (!a || !b) continue
      const strength = pull(edge.kind)
      const dx = b.x - a.x
      const dy = b.y - a.y
      a.x += dx * strength
      a.y += dy * strength
      b.x -= dx * strength
      b.y -= dy * strength
    }
    for (const point of list) {
      point.x += (width / 2 - point.x) * 0.004
      point.y += (height / 2 - point.y) * 0.004
      point.x = Math.min(width - 120, Math.max(120, point.x))
      point.y = Math.min(height - 56, Math.max(56, point.y))
    }
  }
  return ids.map((id) => ({ id, ...points.get(id)! }))
}
