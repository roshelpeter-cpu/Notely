export interface LaidNode {
  id: number
  x: number
  y: number
}

export function layoutGraph(
  ids: number[],
  edges: { source: number; target: number }[],
  width: number,
  height: number,
): LaidNode[] {
  const points = new Map<number, { x: number; y: number }>()
  ids.forEach((id, index) => {
    const angle = (index / Math.max(ids.length, 1)) * Math.PI * 2
    const radius = Math.min(width, height) * 0.28
    points.set(id, {
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius * 0.72,
    })
  })
  const list = ids.map((id) => points.get(id)!)
  for (let iteration = 0; iteration < 160; iteration += 1) {
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = list[i]
        const b = list[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let distance = Math.hypot(dx, dy) || 0.1
        const force = Math.min(22, 14000 / (distance * distance))
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
      const dx = b.x - a.x
      const dy = b.y - a.y
      a.x += dx * 0.02
      a.y += dy * 0.02
      b.x -= dx * 0.02
      b.y -= dy * 0.02
    }
    for (const point of list) {
      point.x += (width / 2 - point.x) * 0.004
      point.y += (height / 2 - point.y) * 0.004
      point.x = Math.min(width - 110, Math.max(110, point.x))
      point.y = Math.min(height - 48, Math.max(48, point.y))
    }
  }
  return ids.map((id) => ({ id, ...points.get(id)! }))
}
