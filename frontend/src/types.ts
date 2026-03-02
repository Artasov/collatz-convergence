export type Metric = 'steps' | 'max_value';
export type ChartType = 'xy' | 'network' | 'tree' | 'tree3d' | 'path';

export interface Summary {
    limit: number;
    longest_chain_start: number;
    longest_chain_length: number;
    highest_peak_start: number;
    highest_peak_value: number;
    unique_node_count: number;
    unique_edge_count: number;
}

export interface XYPoint {
    x: number;
    y: number;
    steps: number;
    max_value: number;
}

export interface XYData {
    metric: Metric;
    x_label: string;
    y_label: string;
    points: XYPoint[];
    value_histogram?: ValueHistogramPoint[];
}

export interface TreeNode {
    id: string;
    value: number;
    hits: number;
    steps_to_1: number;
}

export interface TreeEdge {
    source: string;
    target: string;
    weight: number;
}

export interface TreeData {
    root: string;
    nodes: TreeNode[];
    edges: TreeEdge[];
    value_histogram?: ValueHistogramPoint[];
}

export interface ConvergenceTreeNode {
    id: string;
    value: number;
    hits: number;
    depth: number;
    x: number;
    kind: 'root' | 'trunk' | 'branch';
}

export interface ConvergenceTreeData {
    root: string;
    layers?: number;
    max_depth: number;
    nodes: ConvergenceTreeNode[];
    edges: TreeEdge[];
    value_histogram?: ValueHistogramPoint[];
}

export interface ChartResponse<T> {
    chart_type: ChartType;
    limit: number;
    summary: Summary;
    data: T;
}

export interface PathPoint {
    step: number;
    value: number;
}

export interface ValueHistogramPoint {
    value: number;
    hits: number;
}

export interface PathResponse {
    start_n: number;
    steps: number;
    peak_value: number;
    path: number[];
    points: PathPoint[];
}
