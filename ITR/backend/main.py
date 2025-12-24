from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import heapq
import math
from datetime import datetime

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class Edge(BaseModel):
    from_: str = Field(..., alias="from")
    to: str = None
    distance: float
    traffic: float
    
    class Config:
        fields = {'from_': 'from'}

class NodePosition(BaseModel):
    x: float
    y: float

class RouteRequest(BaseModel):
    nodes: List[str]
    edges: List[Edge]
    start: str
    end: str
    algorithm: str
    weightType: str
    nodePositions: Dict[str, NodePosition]

class PathStep(BaseModel):
    current: str
    visited: List[str]
    distances: Dict[str, float]
    previous: Dict[str, str]

class RouteHistoryItem(BaseModel):
    timestamp: str
    from_: str = None
    to: str
    path: List[str]
    algorithm: str
    totalDistance: float
    totalTraffic: float
    
    class Config:
        fields = {'from_': 'from'}

# In-memory storage for route history
route_history: List[Dict] = []

# Graph class
class Graph:
    def __init__(self, nodes: List[str], edges: List[Edge], weight_type: str):
        self.nodes = nodes
        self.edges = edges
        self.weight_type = weight_type
        self.adj_list = self._build_adjacency_list()
    
    def _build_adjacency_list(self):
        adj = {node: [] for node in self.nodes}
        for edge in self.edges:
            weight = self._get_weight(edge)
            adj[edge.from_].append((edge.to, weight, edge))
            adj[edge.to].append((edge.from_, weight, edge))
        return adj
    
    def _get_weight(self, edge: Edge) -> float:
        if self.weight_type == 'distance':
            return edge.distance
        elif self.weight_type == 'traffic':
            return edge.traffic
        else:  # combined
            return edge.distance + (edge.traffic * 2)
    
    def dijkstra(self, start: str, end: str) -> tuple:
        """Dijkstra's algorithm with step tracking"""
        distances = {node: float('inf') for node in self.nodes}
        previous = {}
        visited = set()
        steps = []
        
        distances[start] = 0
        pq = [(0, start)]
        
        while pq:
            current_dist, current = heapq.heappop(pq)
            
            if current in visited:
                continue
            
            visited.add(current)
            
            # Record step
            steps.append({
                'current': current,
                'visited': list(visited),
                'distances': {k: v if v != float('inf') else 999999 for k, v in distances.items()},
                'previous': dict(previous)
            })
            
            if current == end:
                break
            
            for neighbor, weight, edge in self.adj_list[current]:
                if neighbor in visited:
                    continue
                
                new_dist = distances[current] + weight
                if new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = current
                    heapq.heappush(pq, (new_dist, neighbor))
        
        # Reconstruct path
        path = []
        if end in previous or start == end:
            current = end
            while current:
                path.insert(0, current)
                current = previous.get(current)
        
        return path, steps
    
    def astar(self, start: str, end: str, node_positions: Dict[str, NodePosition]) -> tuple:
        """A* algorithm with step tracking"""
        def heuristic(node_id: str) -> float:
            node_pos = node_positions[node_id]
            end_pos = node_positions[end]
            return math.sqrt((end_pos.x - node_pos.x)**2 + (end_pos.y - node_pos.y)**2) / 10
        
        distances = {node: float('inf') for node in self.nodes}
        previous = {}
        visited = set()
        steps = []
        
        distances[start] = 0
        pq = [(heuristic(start), 0, start)]
        
        while pq:
            _, current_dist, current = heapq.heappop(pq)
            
            if current in visited:
                continue
            
            visited.add(current)
            
            # Record step
            steps.append({
                'current': current,
                'visited': list(visited),
                'distances': {k: v if v != float('inf') else 999999 for k, v in distances.items()},
                'previous': dict(previous)
            })
            
            if current == end:
                break
            
            for neighbor, weight, edge in self.adj_list[current]:
                if neighbor in visited:
                    continue
                
                new_dist = distances[current] + weight
                if new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = current
                    f_score = new_dist + heuristic(neighbor)
                    heapq.heappush(pq, (f_score, new_dist, neighbor))
        
        # Reconstruct path
        path = []
        if end in previous or start == end:
            current = end
            while current:
                path.insert(0, current)
                current = previous.get(current)
        
        return path, steps

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Python backend is running"}

@app.post("/calculate-route")
async def calculate_route(request: RouteRequest):
    """Calculate optimal route using specified algorithm"""
    try:
        # Build graph
        graph = Graph(request.nodes, request.edges, request.weightType)
        
        # Run algorithm
        if request.algorithm == 'dijkstra':
            path, steps = graph.dijkstra(request.start, request.end)
        elif request.algorithm == 'astar':
            path, steps = graph.astar(request.start, request.end, request.nodePositions)
        else:
            raise HTTPException(status_code=400, detail="Invalid algorithm")
        
        if not path:
            return {
                "success": False,
                "message": "No path found between selected nodes",
                "path": [],
                "steps": [],
                "totalDistance": 0,
                "totalTraffic": 0
            }
        
        # Calculate totals
        total_distance = 0
        total_traffic = 0
        
        for i in range(len(path) - 1):
            for edge in request.edges:
                if (edge.from_ == path[i] and edge.to == path[i + 1]) or \
                   (edge.to == path[i] and edge.from_ == path[i + 1]):
                    total_distance += edge.distance
                    total_traffic += edge.traffic
                    break
        
        return {
            "success": True,
            "path": path,
            "steps": steps,
            "totalDistance": round(total_distance, 2),
            "totalTraffic": round(total_traffic, 2)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add-route")
async def add_route(route: RouteHistoryItem):
    """Add route to history"""
    route_dict = route.dict()
    route_dict['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    route_history.insert(0, route_dict)
    
    # Keep only last 50 routes
    if len(route_history) > 50:
        route_history.pop()
    
    return {"success": True, "message": "Route added to history"}

@app.get("/history")
async def get_history():
    """Get route history"""
    return {"history": route_history}

@app.delete("/history")
async def clear_history():
    """Clear route history"""
    route_history.clear()
    return {"success": True, "message": "History cleared"}

@app.get("/")
async def root():
    return {"message": "Welcome! Python backend is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)