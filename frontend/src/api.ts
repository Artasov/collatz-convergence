import type {ChartResponse, ConvergenceTreeData, Metric, PathResponse, TreeData, XYData,} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function request<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
}

export async function fetchXYChart(
    limit: number,
    metric: Metric
): Promise<ChartResponse<XYData>> {
    return request<ChartResponse<XYData>>(
        `/api/charts/xy?limit=${limit}&metric=${metric}&source=auto`
    );
}

export async function fetchNetworkChart(
    limit: number
): Promise<ChartResponse<TreeData>> {
    return request<ChartResponse<TreeData>>(
        `/api/charts/network?limit=${limit}&source=auto`
    );
}

export async function fetchTreeChart(
    layers: number
): Promise<ChartResponse<ConvergenceTreeData>> {
    return request<ChartResponse<ConvergenceTreeData>>(
        `/api/charts/tree?layers=${layers}&source=auto`
    );
}

export async function fetchPath(startN: number): Promise<PathResponse> {
    return request<PathResponse>(`/api/path?start_n=${startN}`);
}
