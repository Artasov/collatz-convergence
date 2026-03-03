import type {
    ChartResponse,
    ConvergenceTreeData,
    ConvergenceTreeNode,
    Metric,
    PathPoint,
    PathResponse,
    Summary,
    TreeData,
    TreeEdge,
    TreeNode,
    ValueHistogramPoint,
    XYData,
    XYPoint,
} from '../types';
import {
    clearClientCacheStore,
    type ClientCacheStats,
    getClientCacheStats,
    readClientCache,
    writeClientCache,
} from './clientCache';

interface GenerationAggregate {
    limit: number;
    summary: Summary;
    xy_points: XYPoint[];
    network_nodes: TreeNode[];
    network_edges: TreeEdge[];
    value_histogram: ValueHistogramPoint[];
}

interface TreeAggregate {
    limit: number;
    summary: Summary;
    data: ConvergenceTreeData;
}

const MAX_TREE_LAYERS = 60;

function nextValue(value: number): number {
    if (value <= 0) {
        throw new Error('Lothar-Collatz is defined for positive integers only.');
    }
    return value % 2 === 0 ? value / 2 : value * 3 + 1;
}

function generationCacheKey(limit: number): string {
    return `generation:v1:${limit}`;
}

function treeCacheKey(layers: number): string {
    return `tree:v1:${layers}`;
}

function pathCacheKey(startN: number): string {
    return `path:v1:${startN}`;
}

async function yieldToUi(current: number): Promise<void> {
    if (current % 250 !== 0) {
        return;
    }
    await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 0);
    });
}

class CollatzClientService {
    private lengthCache = new Map<number, number>([[1, 0]]);
    private peakCache = new Map<number, number>([[1, 1]]);
    private generationInFlight = new Map<number, Promise<GenerationAggregate>>();
    private treeInFlight = new Map<number, Promise<TreeAggregate>>();
    private pathInFlight = new Map<number, Promise<PathResponse>>();

    private computeStats(startN: number): { steps: number; peak: number } {
        const cachedSteps = this.lengthCache.get(startN);
        const cachedPeak = this.peakCache.get(startN);
        if (cachedSteps !== undefined && cachedPeak !== undefined) {
            return {steps: cachedSteps, peak: cachedPeak};
        }

        const chain: number[] = [];
        let value = startN;
        while (!this.lengthCache.has(value)) {
            chain.push(value);
            value = nextValue(value);
        }

        let knownLength = this.lengthCache.get(value) ?? 0;
        let knownPeak = this.peakCache.get(value) ?? value;

        for (let index = chain.length - 1; index >= 0; index -= 1) {
            const current = chain[index];
            knownLength += 1;
            knownPeak = Math.max(current, knownPeak);
            this.lengthCache.set(current, knownLength);
            this.peakCache.set(current, knownPeak);
        }

        return {
            steps: this.lengthCache.get(startN) ?? 0,
            peak: this.peakCache.get(startN) ?? startN,
        };
    }

    private sequence(startN: number): number[] {
        if (startN <= 0) {
            throw new Error('start_n must be positive.');
        }
        const path: number[] = [startN];
        let value = startN;
        while (value !== 1) {
            value = nextValue(value);
            path.push(value);
        }
        return path;
    }

    private async buildGeneration(limit: number): Promise<GenerationAggregate> {
        if (limit <= 0) {
            throw new Error('limit must be positive.');
        }

        const xyPoints: XYPoint[] = [];
        const nodeHits = new Map<number, number>();
        const stepsToOne = new Map<number, number>();
        const edgeCounter = new Map<string, TreeEdge>();
        const histogramCounter = new Map<number, number>();
        const nodeSet = new Set<number>();

        let longestChainStart = 1;
        let longestChainLength = 0;
        let highestPeakStart = 1;
        let highestPeakValue = 1;

        for (let number = 1; number <= limit; number += 1) {
            await yieldToUi(number);
            const stats = this.computeStats(number);
            const path = this.sequence(number);

            if (stats.steps > longestChainLength) {
                longestChainLength = stats.steps;
                longestChainStart = number;
            }
            if (stats.peak > highestPeakValue) {
                highestPeakValue = stats.peak;
                highestPeakStart = number;
            }

            xyPoints.push({
                x: number,
                y: stats.steps,
                steps: stats.steps,
                max_value: stats.peak,
            });

            for (let index = 0; index < path.length; index += 1) {
                const value = path[index];
                nodeSet.add(value);
                nodeHits.set(value, (nodeHits.get(value) ?? 0) + 1);
                histogramCounter.set(value, (histogramCounter.get(value) ?? 0) + 1);
                if (!stepsToOne.has(value)) {
                    stepsToOne.set(value, path.length - index - 1);
                }
                if (index === path.length - 1) {
                    continue;
                }
                const target = path[index + 1];
                const key = `${value}:${target}`;
                const previous = edgeCounter.get(key);
                if (previous) {
                    previous.weight += 1;
                    continue;
                }
                edgeCounter.set(key, {
                    source: `${value}`,
                    target: `${target}`,
                    weight: 1,
                });
            }
        }

        const sortedNodes = [...nodeSet].sort((left, right) => left - right);
        const networkNodes: TreeNode[] = sortedNodes.map((value) => ({
            id: `${value}`,
            value,
            hits: nodeHits.get(value) ?? 0,
            steps_to_1: stepsToOne.get(value) ?? 0,
        }));

        const networkEdges = [...edgeCounter.values()].sort((left, right) => {
            const sourceDiff = Number(left.source) - Number(right.source);
            if (sourceDiff !== 0) {
                return sourceDiff;
            }
            return Number(left.target) - Number(right.target);
        });

        const histogram = [...histogramCounter.entries()]
            .sort((left, right) => left[0] - right[0])
            .map(([value, hits]) => ({
                value,
                hits,
            }));

        const summary: Summary = {
            limit,
            longest_chain_start: longestChainStart,
            longest_chain_length: longestChainLength,
            highest_peak_start: highestPeakStart,
            highest_peak_value: highestPeakValue,
            unique_node_count: sortedNodes.length,
            unique_edge_count: networkEdges.length,
        };

        return {
            limit,
            summary,
            xy_points: xyPoints,
            network_nodes: networkNodes,
            network_edges: networkEdges,
            value_histogram: histogram,
        };
    }

    private async getGeneration(limit: number): Promise<GenerationAggregate> {
        const safeLimit = Math.floor(limit);
        const key = generationCacheKey(safeLimit);
        const cached = await readClientCache<GenerationAggregate>(key);
        if (cached) {
            return cached;
        }
        const inFlight = this.generationInFlight.get(safeLimit);
        if (inFlight) {
            return inFlight;
        }
        const job = this.buildGeneration(safeLimit).then(async (generation) => {
            await writeClientCache(key, generation);
            return generation;
        }).finally(() => {
            this.generationInFlight.delete(safeLimit);
        });
        this.generationInFlight.set(safeLimit, job);
        return job;
    }

    private predecessors(value: number): number[] {
        const predecessors = [value * 2];
        if (value > 1 && (value - 1) % 3 === 0) {
            const oddCandidate = (value - 1) / 3;
            if (oddCandidate > 0 && oddCandidate % 2 === 1) {
                predecessors.push(oddCandidate);
            }
        }
        return [...new Set(predecessors)].sort((left, right) => right - left);
    }

    private buildTrunk(nodeSet: Set<number>): Set<number> {
        const trunk = new Set<number>([1]);
        let value = 1;
        while (nodeSet.has(value * 2)) {
            value *= 2;
            trunk.add(value);
        }
        return trunk;
    }

    private async buildTree(layers: number): Promise<TreeAggregate> {
        if (layers <= 0) {
            throw new Error('layers must be positive.');
        }

        const nodeSet = new Set<number>([1]);
        const nodesByDepth = new Map<number, number[]>([[0, [1]]]);
        const depthByValue = new Map<number, number>([[1, 0]]);
        const parentByNode = new Map<number, number>();
        const edgeSet = new Set<string>();

        for (let depth = 1; depth < layers; depth += 1) {
            await yieldToUi(depth);
            const currentLayer: number[] = [];
            const previousLayer = nodesByDepth.get(depth - 1) ?? [];
            for (const target of previousLayer) {
                for (const source of this.predecessors(target)) {
                    edgeSet.add(`${source}:${target}`);
                    if (depthByValue.has(source)) {
                        continue;
                    }
                    depthByValue.set(source, depth);
                    parentByNode.set(source, target);
                    nodeSet.add(source);
                    currentLayer.push(source);
                }
            }
            const deduped: number[] = [];
            const seen = new Set<number>();
            for (const value of currentLayer) {
                if (seen.has(value)) {
                    continue;
                }
                seen.add(value);
                deduped.push(value);
            }
            nodesByDepth.set(depth, deduped);
        }

        let maxDepth = 0;
        for (const depth of depthByValue.values()) {
            if (depth > maxDepth) {
                maxDepth = depth;
            }
        }
        const trunk = this.buildTrunk(nodeSet);
        const xUnitByValue = new Map<number, number>([[1, 0]]);
        const minGap = 1.04;
        const siblingGap = 1;

        for (let depth = 1; depth <= maxDepth; depth += 1) {
            const layerNodes = nodesByDepth.get(depth) ?? [];
            if (!layerNodes.length) {
                continue;
            }
            const childrenByParent = new Map<number, number[]>();
            for (const node of layerNodes) {
                const parent = parentByNode.get(node) ?? 1;
                const children = childrenByParent.get(parent) ?? [];
                children.push(node);
                childrenByParent.set(parent, children);
            }

            const orderedParents = [...childrenByParent.keys()].sort((left, right) => {
                const leftX = xUnitByValue.get(left) ?? 0;
                const rightX = xUnitByValue.get(right) ?? 0;
                if (leftX !== rightX) {
                    return leftX - rightX;
                }
                return left - right;
            });

            const targetXByNode = new Map<number, number>();
            for (const parent of orderedParents) {
                const children = [...(childrenByParent.get(parent) ?? [])].sort((left, right) => right - left);
                const parentX = xUnitByValue.get(parent) ?? 0;
                const midpoint = (children.length - 1) / 2;
                for (let index = 0; index < children.length; index += 1) {
                    const child = children[index];
                    targetXByNode.set(child, parentX + (index - midpoint) * siblingGap);
                }
            }

            const orderedNodes = [...layerNodes].sort((left, right) => {
                const leftX = targetXByNode.get(left) ?? 0;
                const rightX = targetXByNode.get(right) ?? 0;
                if (leftX !== rightX) {
                    return leftX - rightX;
                }
                return left - right;
            });

            const placedXByNode = new Map<number, number>();
            let previousX: number | null = null;
            for (const node of orderedNodes) {
                let currentX = targetXByNode.get(node) ?? 0;
                if (previousX !== null && currentX < previousX + minGap) {
                    currentX = previousX + minGap;
                }
                placedXByNode.set(node, currentX);
                previousX = currentX;
            }

            const parentMean = orderedNodes.reduce(
                (acc, node) => acc + (xUnitByValue.get(parentByNode.get(node) ?? 1) ?? 0),
                0,
            ) / orderedNodes.length;
            const layerMean = orderedNodes.reduce(
                (acc, node) => acc + (placedXByNode.get(node) ?? 0),
                0,
            ) / orderedNodes.length;
            const shift = parentMean - layerMean;

            for (const node of orderedNodes) {
                xUnitByValue.set(node, (placedXByNode.get(node) ?? 0) + shift);
            }
        }

        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        for (const value of nodeSet) {
            const x = xUnitByValue.get(value) ?? 0;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
        }

        const span = maxX - minX;
        const xByValue = new Map<number, number>();
        for (const value of nodeSet) {
            if (span <= 0) {
                xByValue.set(value, 0.5);
                continue;
            }
            xByValue.set(value, ((xUnitByValue.get(value) ?? 0) - minX) / span);
        }

        const sortedValues = [...nodeSet].sort((left, right) => left - right);
        const nodes: ConvergenceTreeNode[] = sortedValues.map((value) => ({
            id: `${value}`,
            value,
            hits: 1,
            depth: depthByValue.get(value) ?? 0,
            x: xByValue.get(value) ?? 0.5,
            kind: value === 1 ? 'root' : trunk.has(value) ? 'trunk' : 'branch',
        }));

        const edges: TreeEdge[] = [...edgeSet]
            .map((entry) => {
                const [source, target] = entry.split(':').map((part) => Number(part));
                return {
                    source: `${source}`,
                    target: `${target}`,
                    weight: 1,
                };
            })
            .sort((left, right) => {
                const sourceDiff = Number(left.source) - Number(right.source);
                if (sourceDiff !== 0) {
                    return sourceDiff;
                }
                return Number(left.target) - Number(right.target);
            });

        if (layers >= 3 && nodeSet.has(4)) {
            edges.push({
                source: '1',
                target: '4',
                weight: 1,
            });
        }

        const treeData: ConvergenceTreeData = {
            root: '1',
            layers,
            max_depth: maxDepth,
            nodes,
            edges,
        };

        const maxValue = nodes.reduce((acc, node) => Math.max(acc, node.value), 1);
        const summary: Summary = {
            limit: layers,
            longest_chain_start: 1,
            longest_chain_length: maxDepth,
            highest_peak_start: maxValue,
            highest_peak_value: maxValue,
            unique_node_count: nodes.length,
            unique_edge_count: edges.length,
        };

        return {
            limit: layers,
            summary,
            data: treeData,
        };
    }

    private async getTree(layers: number): Promise<TreeAggregate> {
        const safeLayers = Math.max(1, Math.min(MAX_TREE_LAYERS, Math.floor(layers)));
        const key = treeCacheKey(safeLayers);
        const cached = await readClientCache<TreeAggregate>(key);
        if (cached) {
            return cached;
        }
        const inFlight = this.treeInFlight.get(safeLayers);
        if (inFlight) {
            return inFlight;
        }
        const job = this.buildTree(safeLayers).then(async (tree) => {
            await writeClientCache(key, tree);
            return tree;
        }).finally(() => {
            this.treeInFlight.delete(safeLayers);
        });
        this.treeInFlight.set(safeLayers, job);
        return job;
    }

    async fetchXYChart(limit: number, metric: Metric): Promise<ChartResponse<XYData>> {
        const generation = await this.getGeneration(limit);
        const points = generation.xy_points.map((point) => ({
            x: point.x,
            y: metric === 'steps' ? point.steps : point.max_value,
            steps: point.steps,
            max_value: point.max_value,
        }));
        return {
            chart_type: 'xy',
            limit: generation.limit,
            summary: generation.summary,
            data: {
                metric,
                x_label: 'Start n',
                y_label: metric === 'steps' ? 'Steps to 1' : 'Peak value',
                points,
                value_histogram: generation.value_histogram,
            },
        };
    }

    async fetchNetworkChart(limit: number): Promise<ChartResponse<TreeData>> {
        const generation = await this.getGeneration(limit);
        return {
            chart_type: 'network',
            limit: generation.limit,
            summary: generation.summary,
            data: {
                root: '1',
                nodes: generation.network_nodes,
                edges: generation.network_edges,
                value_histogram: generation.value_histogram,
            },
        };
    }

    async fetchTreeChart(layers: number): Promise<ChartResponse<ConvergenceTreeData>> {
        const tree = await this.getTree(layers);
        return {
            chart_type: 'tree',
            limit: tree.limit,
            summary: tree.summary,
            data: tree.data,
        };
    }

    async fetchPath(startN: number): Promise<PathResponse> {
        if (startN <= 0) {
            throw new Error('start_n must be positive.');
        }
        const safeStart = Math.floor(startN);
        const cached = await readClientCache<PathResponse>(pathCacheKey(safeStart));
        if (cached) {
            return cached;
        }
        const inFlight = this.pathInFlight.get(safeStart);
        if (inFlight) {
            return inFlight;
        }
        const job = (async () => {
            const path = this.sequence(safeStart);
            const points: PathPoint[] = path.map((value, step) => ({
                step,
                value,
            }));
            const response: PathResponse = {
                start_n: safeStart,
                steps: Math.max(0, path.length - 1),
                peak_value: path.reduce((acc, value) => Math.max(acc, value), 1),
                path,
                points,
            };
            await writeClientCache(pathCacheKey(safeStart), response);
            return response;
        })().finally(() => {
            this.pathInFlight.delete(safeStart);
        });
        this.pathInFlight.set(safeStart, job);
        return job;
    }

    async clearCache(): Promise<void> {
        this.generationInFlight.clear();
        this.treeInFlight.clear();
        this.pathInFlight.clear();
        this.lengthCache = new Map<number, number>([[1, 0]]);
        this.peakCache = new Map<number, number>([[1, 1]]);
        await clearClientCacheStore();
    }

    async getCacheStats(): Promise<ClientCacheStats> {
        return getClientCacheStats();
    }
}

export const collatzClientService = new CollatzClientService();
