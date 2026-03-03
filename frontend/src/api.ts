import {collatzClientService} from './services/collatzClient';
import type {ClientCacheStats} from './services/clientCache';
import type {ChartResponse, ConvergenceTreeData, Metric, PathResponse, TreeData, XYData} from './types';

export async function fetchXYChart(
    limit: number,
    metric: Metric
): Promise<ChartResponse<XYData>> {
    return collatzClientService.fetchXYChart(limit, metric);
}

export async function fetchNetworkChart(
    limit: number
): Promise<ChartResponse<TreeData>> {
    return collatzClientService.fetchNetworkChart(limit);
}

export async function fetchTreeChart(
    layers: number
): Promise<ChartResponse<ConvergenceTreeData>> {
    return collatzClientService.fetchTreeChart(layers);
}

export async function fetchPath(startN: number): Promise<PathResponse> {
    return collatzClientService.fetchPath(startN);
}

export async function fetchClientCacheStats(): Promise<ClientCacheStats> {
    return collatzClientService.getCacheStats();
}

export async function clearClientCache(): Promise<void> {
    await collatzClientService.clearCache();
}
