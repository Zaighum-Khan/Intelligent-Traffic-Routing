import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Navigation, History, Settings, Zap, GitBranch, AlertCircle, Download, Upload, X } from 'lucide-react';

// Types
interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
}

interface Edge {
  from: string;
  to: string;
  distance: number;
  traffic: number;
}

interface PathStep {
  current: string;
  visited: string[];
  distances: { [key: string]: number };
  previous: { [key: string]: string };
}

interface RouteHistory {
  timestamp: string;
  from: string;
  to: string;
  path: string[];
  algorithm: string;
  totalDistance: number;
  totalTraffic: number;
}

interface PathResponse {
  path: string[];
  steps: PathStep[];
  totalDistance: number;
  totalTraffic: number;
  success: boolean;
  message?: string;
}

const API_BASE = 'http://localhost:8000';

const TrafficRoutingSystem = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [mode, setMode] = useState<'node' | 'edge' | 'route'>('node');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [startNode, setStartNode] = useState<string | null>(null);
  const [endNode, setEndNode] = useState<string | null>(null);
  const [algorithm, setAlgorithm] = useState<'dijkstra' | 'astar'>('dijkstra');
  const [weightType, setWeightType] = useState<'distance' | 'traffic' | 'combined'>('combined');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSteps, setAnimationSteps] = useState<PathStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [routeHistory, setRouteHistory] = useState<RouteHistory[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<{from: string, to: string} | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [trafficIncrease, setTrafficIncrease] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Check backend status and load history on mount
  useEffect(() => {
    checkBackendStatus();
    loadHistoryFromBackend();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, { method: 'GET' });
      if (response.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch (err) {
      setBackendStatus('offline');
    }
  };

  // Load history from backend
  const loadHistoryFromBackend = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`);
      if (response.ok) {
        const data = await response.json();
        setRouteHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Export history to JSON file
  const exportHistory = () => {
    const dataStr = JSON.stringify(routeHistory, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `traffic-history-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import history from JSON file
  const importHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        setRouteHistory(imported);
        // Optionally sync back to backend
      } catch (err) {
        setError('Failed to import history file');
      }
    };
    reader.readAsText(file);
  };

  // Enhanced canvas drawing with beautiful nodes and undirected edges
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get actual canvas dimensions
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate label positions to avoid overlap
    const labelPositions: {x: number, y: number, edge: Edge}[] = [];
    
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
      const midX = (fromNode.x + toNode.x) / 2;
      const midY = (fromNode.y + toNode.y) / 2;
      
      // Calculate offset for label to avoid overlap
      let offsetX = 22 * Math.sin(angle);
      let offsetY = -22 * Math.cos(angle);
      
      // Check for nearby labels and adjust
      let adjusted = false;
      for (const pos of labelPositions) {
        const dist = Math.sqrt((pos.x - (midX + offsetX)) ** 2 + (pos.y - (midY + offsetY)) ** 2);
        if (dist < 80) {
          // Too close, flip to other side
          offsetX = -offsetX;
          offsetY = -offsetY;
          adjusted = true;
          break;
        }
      }
      
      labelPositions.push({x: midX + offsetX, y: midY + offsetY, edge});
    });

    // Draw edges (roads) - UNDIRECTED, NO ARROWS
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      const isSelected = selectedEdge?.from === edge.from && selectedEdge?.to === edge.to;
      const isInPath = currentPath.includes(edge.from) && currentPath.includes(edge.to) &&
        Math.abs(currentPath.indexOf(edge.from) - currentPath.indexOf(edge.to)) === 1;

      // Draw road line (simple undirected)
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      
      if (isInPath) {
        const gradient = ctx.createLinearGradient(fromNode.x, fromNode.y, toNode.x, toNode.y);
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(0.5, '#059669');
        gradient.addColorStop(1, '#047857');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
      } else if (isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
      } else {
        const gradient = ctx.createLinearGradient(fromNode.x, fromNode.y, toNode.x, toNode.y);
        gradient.addColorStop(0, '#d1d5db');
        gradient.addColorStop(1, '#9ca3af');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
      }
      
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw weight labels with adjusted positions
      const labelPos = labelPositions.find(p => p.edge === edge);
      if (!labelPos) return;

      const textWidth = 70;
      const textHeight = 22;
      const labelX = labelPos.x - textWidth/2;
      const labelY = labelPos.y - textHeight/2;
      const radius = 6;

      // Enhanced background for text
      ctx.fillStyle = isInPath ? 'rgba(16, 185, 129, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      
      // Rounded rectangle for label
      ctx.beginPath();
      ctx.moveTo(labelX + radius, labelY);
      ctx.lineTo(labelX + textWidth - radius, labelY);
      ctx.quadraticCurveTo(labelX + textWidth, labelY, labelX + textWidth, labelY + radius);
      ctx.lineTo(labelX + textWidth, labelY + textHeight - radius);
      ctx.quadraticCurveTo(labelX + textWidth, labelY + textHeight, labelX + textWidth - radius, labelY + textHeight);
      ctx.lineTo(labelX + radius, labelY + textHeight);
      ctx.quadraticCurveTo(labelX, labelY + textHeight, labelX, labelY + textHeight - radius);
      ctx.lineTo(labelX, labelY + radius);
      ctx.quadraticCurveTo(labelX, labelY, labelX + radius, labelY);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = isInPath ? '#059669' : '#e5e7eb';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Text
      ctx.fillStyle = isInPath ? '#ffffff' : '#374151';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`D:${edge.distance} T:${edge.traffic}`, labelPos.x, labelPos.y);
    });

    // Draw nodes with ENHANCED beautiful styling
    nodes.forEach(node => {
      const isStart = node.id === startNode;
      const isEnd = node.id === endNode;
      const isInPath = currentPath.includes(node.id);
      const isVisited = isAnimating && currentStep < animationSteps.length &&
        animationSteps[currentStep].visited.includes(node.id);
      const isCurrent = isAnimating && currentStep < animationSteps.length &&
        animationSteps[currentStep].current === node.id;

      // Outer glow ring
      if (isStart || isEnd || isInPath || isCurrent) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 32, 0, Math.PI * 2);
        const glowGradient = ctx.createRadialGradient(node.x, node.y, 20, node.x, node.y, 32);
        if (isCurrent) {
          glowGradient.addColorStop(0, 'rgba(245, 158, 11, 0.3)');
          glowGradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
        } else if (isStart) {
          glowGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
          glowGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else if (isEnd) {
          glowGradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
          glowGradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        } else {
          glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
          glowGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        }
        ctx.fillStyle = glowGradient;
        ctx.fill();
      }

      // Main circle with enhanced 3D gradient
      ctx.beginPath();
      ctx.arc(node.x, node.y, 24, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(node.x - 7, node.y - 7, 3, node.x, node.y, 24);
      if (isCurrent) {
        gradient.addColorStop(0, '#fcd34d');
        gradient.addColorStop(0.6, '#fbbf24');
        gradient.addColorStop(1, '#f59e0b');
      } else if (isStart) {
        gradient.addColorStop(0, '#6ee7b7');
        gradient.addColorStop(0.6, '#34d399');
        gradient.addColorStop(1, '#10b981');
      } else if (isEnd) {
        gradient.addColorStop(0, '#fca5a5');
        gradient.addColorStop(0.6, '#f87171');
        gradient.addColorStop(1, '#ef4444');
      } else if (isInPath) {
        gradient.addColorStop(0, '#93c5fd');
        gradient.addColorStop(0.6, '#60a5fa');
        gradient.addColorStop(1, '#3b82f6');
      } else if (isVisited) {
        gradient.addColorStop(0, '#f9fafb');
        gradient.addColorStop(0.6, '#f3f4f6');
        gradient.addColorStop(1, '#e5e7eb');
      } else {
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.6, '#f9fafb');
        gradient.addColorStop(1, '#f3f4f6');
      }
      
      ctx.fillStyle = gradient;
      ctx.fill();

      // Enhanced border with double ring effect
      ctx.strokeStyle = isCurrent ? '#f59e0b' :
                        isStart ? '#10b981' :
                        isEnd ? '#ef4444' :
                        isInPath ? '#3b82f6' :
                        '#9ca3af';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner highlight ring for depth
      ctx.beginPath();
      ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Subtle shadow for 3D effect
      ctx.beginPath();
      ctx.arc(node.x, node.y + 1, 22, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label with shadow
      ctx.fillStyle = (isStart || isEnd || isInPath || isCurrent) ? '#ffffff' : '#1f2937';
      ctx.font = 'bold 17px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (isStart || isEnd || isInPath || isCurrent) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;
      }
      
      ctx.fillText(node.label, node.x, node.y);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    });
  }, [nodes, edges, currentPath, startNode, endNode, selectedEdge, isAnimating, currentStep, animationSteps]);

  // Canvas click handler with FIXED coordinate mapping
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get actual canvas coordinates
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const clickedNode = nodes.find(n => 
      Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2) < 24
    );

    // Check if clicked on edge label for selecting edge
    if (mode === 'edge' && !clickedNode) {
      for (const edge of edges) {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) continue;

        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        const midX = (fromNode.x + toNode.x) / 2;
        const midY = (fromNode.y + toNode.y) / 2;
        let offsetX = 22 * Math.sin(angle);
        let offsetY = -22 * Math.cos(angle);

        if (Math.sqrt((midX + offsetX - x) ** 2 + (midY + offsetY - y) ** 2) < 40) {
          setSelectedEdge({from: edge.from, to: edge.to});
          return;
        }
      }
      // If clicked somewhere else, deselect edge
      setSelectedEdge(null);
    }

    if (mode === 'node') {
      if (!clickedNode) {
        const newNode: Node = {
          id: `N${nodes.length + 1}`,
          x,
          y,
          label: `${nodes.length + 1}`
        };
        setNodes([...nodes, newNode]);
      }
    } else if (mode === 'edge') {
      if (clickedNode) {
        if (!selectedNode) {
          setSelectedNode(clickedNode.id);
        } else if (selectedNode !== clickedNode.id) {
          const edgeExists = edges.some(e => 
            (e.from === selectedNode && e.to === clickedNode.id) ||
            (e.from === clickedNode.id && e.to === selectedNode)
          );
          
          if (!edgeExists) {
            const fromNode = nodes.find(n => n.id === selectedNode)!;
            const toNode = clickedNode;
            
            // Auto-calculate based on distance
            const distance = Math.round(
              Math.sqrt((toNode.x - fromNode.x) ** 2 + (toNode.y - fromNode.y) ** 2) / 10
            );
            const traffic = 1;
            
            const newEdge: Edge = {
              from: selectedNode,
              to: clickedNode.id,
              distance,
              traffic
            };
            setEdges([...edges, newEdge]);
          }
          setSelectedNode(null);
        }
      }
    } else if (mode === 'route') {
      if (clickedNode) {
        if (!startNode) {
          setStartNode(clickedNode.id);
        } else if (!endNode && clickedNode.id !== startNode) {
          setEndNode(clickedNode.id);
        } else {
          setStartNode(clickedNode.id);
          setEndNode(null);
        }
      }
    }
  };

  // Calculate route via backend
  const calculateRoute = async () => {
    if (!startNode || !endNode) return;
    if (backendStatus === 'offline') {
      setError('Backend server is offline. Please start the Python server.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nodePositions: { [key: string]: { x: number, y: number } } = {};
      nodes.forEach(n => {
        nodePositions[n.id] = { x: n.x, y: n.y };
      });

      const response = await fetch(`${API_BASE}/calculate-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map(n => n.id),
          edges: edges,
          start: startNode,
          end: endNode,
          algorithm: algorithm,
          weightType: weightType,
          nodePositions: nodePositions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to calculate route');
      }

      const data: PathResponse = await response.json();

      if (data.success && data.path.length > 0) {
        setCurrentPath(data.path);
        setAnimationSteps(data.steps);
        setCurrentStep(0);

        // Update edges with increased traffic
        const updatedEdges = edges.map(edge => {
          const isInPath = data.path.some((nodeId, i) => {
            if (i === data.path.length - 1) return false;
            return (edge.from === nodeId && edge.to === data.path[i + 1]) ||
                   (edge.to === nodeId && edge.from === data.path[i + 1]);
          });
          return isInPath ? {...edge, traffic: edge.traffic + trafficIncrease} : edge;
        });
        setEdges(updatedEdges);

        // Add to history via backend
        const newRoute: RouteHistory = {
          timestamp: new Date().toLocaleString(),
          from: startNode,
          to: endNode,
          path: data.path,
          algorithm: algorithm,
          totalDistance: data.totalDistance,
          totalTraffic: data.totalTraffic
        };
        
        await fetch(`${API_BASE}/add-route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRoute)
        });
        
        // Reload history from backend
        await loadHistoryFromBackend();
      } else {
        setError(data.message || 'No path found');
      }
    } catch (err) {
      setError('Failed to connect to backend. Make sure Python server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Animation control
  useEffect(() => {
    if (!isAnimating) return;
    
    const timer = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= animationSteps.length - 1) {
          setIsAnimating(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [isAnimating, animationSteps]);

  const handleReset = () => {
    setNodes([]);
    setEdges([]);
    setCurrentPath([]);
    setStartNode(null);
    setEndNode(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setIsAnimating(false);
    setAnimationSteps([]);
    setCurrentStep(0);
    setError(null);
  };

  const clearRoute = () => {
    setCurrentPath([]);
    setStartNode(null);
    setEndNode(null);
    setIsAnimating(false);
    setAnimationSteps([]);
    setCurrentStep(0);
    setError(null);
  };

  const clearHistory = async () => {
    try {
      await fetch(`${API_BASE}/history`, { method: 'DELETE' });
      await loadHistoryFromBackend();
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const updateEdgeWeight = (from: string, to: string, field: 'distance' | 'traffic', value: number) => {
    setEdges(edges.map(e => 
      (e.from === from && e.to === to) || (e.from === to && e.to === from)
        ? {...e, [field]: Math.max(1, value)}
        : e
    ));
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-2xl p-6 overflow-y-auto border-r border-gray-200">
        <h1 className="text-2xl font-bold mb-1 text-gray-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Traffic Routing System</h1>
        <p className="text-xs text-gray-500 mb-4 font-medium">Python Backend + React Frontend</p>

        {/* Backend Status */}
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm ${
          backendStatus === 'online' ? 'bg-green-50 text-green-800 border border-green-200' :
          backendStatus === 'offline' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-yellow-50 text-yellow-800 border border-yellow-200'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
            backendStatus === 'online' ? 'bg-green-500' :
            backendStatus === 'offline' ? 'bg-red-500' :
            'bg-yellow-500'
          }`}></div>
          Backend: {backendStatus === 'online' ? 'Connected ✓' : backendStatus === 'offline' ? 'Offline ✗' : 'Checking...'}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 shadow-sm">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}
        
        {/* Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Mode</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {setMode('node'); setSelectedNode(null); setSelectedEdge(null);}}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'node' ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Add Nodes
            </button>
            <button
              onClick={() => {setMode('edge'); setSelectedNode(null);}}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'edge' ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Add Roads
            </button>
            <button
              onClick={() => {setMode('route'); setSelectedNode(null); setSelectedEdge(null);}}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'route' ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Plan Route
            </button>
          </div>
        </div>

        {/* Edge Selection Tip */}
        {mode === 'edge' && (
          <div className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 shadow-sm">
            <p className="text-xs font-semibold text-indigo-700 mb-2">💡 Tip:</p>
            <p className="text-xs text-gray-600">Click on edge labels to select and edit their weights below!</p>
          </div>
        )}

        {/* Algorithm Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Algorithm</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAlgorithm('dijkstra')}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${algorithm === 'dijkstra' ? 'bg-purple-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <GitBranch size={16} />
              Dijkstra
            </button>
            <button
              onClick={() => setAlgorithm('astar')}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${algorithm === 'astar' ? 'bg-purple-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Zap size={16} />
              A*
            </button>
          </div>
        </div>

        {/* Weight Type */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Weight Priority</label>
          <select
            value={weightType}
            onChange={(e) => setWeightType(e.target.value as any)}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          >
            <option value="distance">Distance Only</option>
            <option value="traffic">Traffic Only</option>
            <option value="combined">Combined (D + 2T)</option>
          </select>
        </div>

        {/* Traffic Increase */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Traffic Increase per Route: <span className="text-blue-600">{trafficIncrease}</span></label>
          <input
            type="range"
            min="1"
            max="20"
            value={trafficIncrease}
            onChange={(e) => setTrafficIncrease(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Route Planning */}
        {mode === 'route' && (
          <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 shadow-sm">
            <div className="text-sm text-gray-700 mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-md"></div>
                <span className="font-medium">Start: {startNode || 'Click a node'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-md"></div>
                <span className="font-medium">End: {endNode || 'Click a node'}</span>
              </div>
            </div>
            <button
              onClick={calculateRoute}
              disabled={!startNode || !endNode || loading || backendStatus === 'offline'}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              <Navigation size={16} />
              {loading ? 'Calculating...' : 'Calculate Route'}
            </button>
          </div>
        )}

        {/* Animation Controls */}
        {currentPath.length > 0 && animationSteps.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Step-by-Step Visualization</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setIsAnimating(!isAnimating)}
                className="flex-1 px-3 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                {isAnimating ? <Pause size={16} /> : <Play size={16} />}
                {isAnimating ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={() => {setCurrentStep(0); setIsAnimating(false);}}
                className="px-3 py-2.5 bg-gray-500 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <div className="text-xs font-semibold text-gray-600 bg-white/70 p-2 rounded">
              Step {currentStep + 1} / {animationSteps.length}
            </div>
          </div>
        )}

        {/* Edge Weight Editor - NOW DYNAMIC! */}
        {selectedEdge && (
          <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Edit Road Weights</h3>
              <button
                onClick={() => setSelectedEdge(null)}
                className="p-1 hover:bg-white/50 rounded transition-all"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Distance</label>
                <input
                  type="number"
                  min="1"
                  value={edges.find(e => 
                    (e.from === selectedEdge.from && e.to === selectedEdge.to) ||
                    (e.from === selectedEdge.to && e.to === selectedEdge.from)
                  )?.distance || 1}
                  onChange={(e) => updateEdgeWeight(selectedEdge.from, selectedEdge.to, 'distance', Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg text-sm font-medium focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Traffic</label>
                <input
                  type="number"
                  min="1"
                  value={edges.find(e => 
                    (e.from === selectedEdge.from && e.to === selectedEdge.to) ||
                    (e.from === selectedEdge.to && e.to === selectedEdge.from)
                  )?.traffic || 1}
                  onChange={(e) => updateEdgeWeight(selectedEdge.from, selectedEdge.to, 'traffic', Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg text-sm font-medium focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                />
              </div>
              <p className="text-xs text-gray-500 bg-white/50 p-2 rounded">Click on edge labels to select different roads</p>
            </div>
          </div>
        )}

        {/* History Button */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full mb-4 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <History size={16} />
          {showHistory ? 'Hide History' : 'Show History'} ({routeHistory.length})
        </button>

        {/* Control Buttons */}
        <div className="space-y-2">
          <button
            onClick={clearRoute}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
          >
            Clear Route
          </button>
          <button
            onClick={handleReset}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6">
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            onClick={handleCanvasClick}
            className="w-full h-full bg-white rounded-2xl shadow-2xl cursor-crosshair border-2 border-gray-200"
          />
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Route History</h2>
                <p className="text-sm text-gray-500 mt-1">{routeHistory.length} routes saved (Backend)</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportHistory}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-green-600 transition-all"
                >
                  <Download size={16} />
                  Export
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={importHistory}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-all"
                >
                  <Upload size={16} />
                  Import
                </button>
                <button
                  onClick={clearHistory}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowHistory(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {routeHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No routes in history yet</p>
                  <p className="text-sm mt-2">Calculate some routes to see them here!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {routeHistory.map((route, idx) => (
                    <div key={idx} className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">{route.timestamp}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${route.algorithm === 'dijkstra' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {route.algorithm.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {route.from} → {route.to}
                      </div>
                      <div className="text-xs text-gray-600 mb-2 font-mono">
                        Path: {route.path.join(' → ')}
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="font-semibold text-blue-600">Distance: {route.totalDistance}</span>
                        <span className="font-semibold text-orange-600">Traffic: {route.totalTraffic}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficRoutingSystem;