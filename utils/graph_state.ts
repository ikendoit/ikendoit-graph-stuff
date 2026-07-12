export interface NodeMapPosition {
	id: string;
	label: string;
	url: string;
	lat?: number | null;
	lng?: number | null;
	createdAt?: string;
}

export interface GraphNode {
	source: string;
	nodeFilePath: string;
	tags?: string[];
	description?: string;
	mapPositions?: NodeMapPosition[];
	fx?: number | null;
	fy?: number | null;
	x?: number;
	y?: number;
	vx?: number;
	vy?: number;
	image?: string | null;
}

export interface GraphLink {
	source: string;
	target: string;
	zIndex?: number;
}

export interface GraphStateOptions {
	nodes: GraphNode[];
	links: GraphLink[];
	rootNodeIds?: string[];
	currentSelectedNodeId?: string | null;
	searchTerm?: string;
}

export class GraphState {
	private nodes: GraphNode[];
	private nodeLookup: Map<string, GraphNode>;
	private nodeSearchLookup: Map<string, string>;
	private links: GraphLink[];
	private adjacencyList: Map<string, string[]>;
	private rootNodeIds: Set<string>;
	private collapsedNodeIds: Set<string>;
	private manuallyExpandedNodeIds: Set<string>;
	private activeExpansionNodeIds: Set<string>;
	private displayableNodeIds: Set<string>;
	private visibleNodes: GraphNode[];
	private visibleLinks: GraphLink[];
	private searchResultNodeIds: Set<string>;
	private searchTermString: string;
	private currentSelectedNodeId: string | null;

	constructor(options: GraphStateOptions) {
		this.nodes = options.nodes;
		this.nodeLookup = new Map(this.nodes.map((node) => [node.source, node]));
		this.nodeSearchLookup = new Map(
			this.nodes.map((node) => [node.source, this.buildSearchText(node)])
		);
		this.links = options.links;
		this.adjacencyList = this.buildAdjacencyList();
		this.rootNodeIds = new Set(options.rootNodeIds ?? []);
		this.collapsedNodeIds = new Set();
		this.manuallyExpandedNodeIds = new Set();
		this.activeExpansionNodeIds = new Set();
		this.displayableNodeIds = new Set();
		this.visibleNodes = [];
		this.visibleLinks = [];
		this.searchResultNodeIds = new Set();
		this.searchTermString = options.searchTerm ?? '';
		this.currentSelectedNodeId = options.currentSelectedNodeId ?? null;

		if (this.searchTermString.length > 0) {
			this.updateSearchResults(this.searchTermString);
		}

		this.recomputeVisibility();
	}

	getVisibleNodes(): GraphNode[] {
		return this.visibleNodes;
	}

	getVisibleLinks(): GraphLink[] {
		return this.visibleLinks;
	}

	getRootNodeIds(): string[] {
		return Array.from(this.rootNodeIds);
	}

	getCollapsedNodeIds(): string[] {
		return Array.from(this.collapsedNodeIds);
	}

	getActiveExpansionNodeIds(): string[] {
		return Array.from(this.activeExpansionNodeIds);
	}

	getSearchResultNodeIds(): string[] {
		return Array.from(this.searchResultNodeIds);
	}

	getSearchTerm(): string {
		return this.searchTermString;
	}

	getCurrentSelectedNodeId(): string | null {
		return this.currentSelectedNodeId;
	}

	getPrimarySearchResultId(): string | null {
		return this.searchResultNodeIds.values().next().value ?? null;
	}

	getDisplayableNodeIds(): string[] {
		return Array.from(this.displayableNodeIds);
	}

	getNodeById(nodeId: string): GraphNode | undefined {
		return this.nodeLookup.get(nodeId);
	}

	getNodeNeighborCount(nodeId: string): number {
		return this.adjacencyList.get(nodeId)?.length ?? 0;
	}

	hasNodeBeenManuallyExpanded(nodeId: string): boolean {
		return this.manuallyExpandedNodeIds.has(nodeId);
	}

	isNodeCollapsed(nodeId: string): boolean {
		return this.collapsedNodeIds.has(nodeId);
	}

	isNodeActivelyExpanded(nodeId: string): boolean {
		return this.activeExpansionNodeIds.has(nodeId);
	}

	setCurrentSelectedNodeId(nodeId: string | null) {
		this.currentSelectedNodeId = nodeId;
		if (nodeId) {
			this.rootNodeIds.add(nodeId);
		}
		this.recomputeVisibility();
	}

	ensureNodeIsRoot(nodeId: string) {
		if (!nodeId) {
			return;
		}
		if (!this.rootNodeIds.has(nodeId)) {
			this.rootNodeIds.add(nodeId);
		}
		this.recomputeVisibility();
	}

	setSearchTerm(term: string) {
		this.searchTermString = term;
		this.updateSearchResults(term);
		this.recomputeVisibility();
	}

	markNodeManuallyExpanded(nodeId: string) {
		if (!nodeId) {
			return;
		}
		this.manuallyExpandedNodeIds.add(nodeId);
		this.collapsedNodeIds.delete(nodeId);
		this.recomputeVisibility();
	}

	clearManualExpansion(nodeId: string) {
		this.manuallyExpandedNodeIds.delete(nodeId);
	}

	collapseNode(nodeId: string) {
		if (!nodeId) {
			return;
		}
		this.collapsedNodeIds.add(nodeId);
		this.manuallyExpandedNodeIds.delete(nodeId);
		this.recomputeVisibility();
	}

	resetCollapsedNode(nodeId: string) {
		this.collapsedNodeIds.delete(nodeId);
	}

	collapseOtherExpandedNodes(nodeId: string) {
		let changed = false;
		for (const expandedNodeId of Array.from(this.manuallyExpandedNodeIds)) {
			if (expandedNodeId === nodeId) {
				continue;
			}
			this.collapsedNodeIds.add(expandedNodeId);
			this.manuallyExpandedNodeIds.delete(expandedNodeId);
			changed = true;
		}
		if (changed) {
			this.recomputeVisibility();
		}
	}

	updateNodeCoordinates(nodeId: string, coords: { fx?: number | null; fy?: number | null }) {
		const node = this.nodeLookup.get(nodeId);
		if (!node) {
			return;
		}
		node.fx = coords.fx;
		node.fy = coords.fy;
	}

	updateNodeContent(nodeId: string, updates: { description?: string; mapPositions?: NodeMapPosition[] }) {
		const node = this.nodeLookup.get(nodeId);
		if (!node) {
			return;
		}
		if (typeof updates.description === 'string') {
			node.description = updates.description;
		}
		if (updates.mapPositions) {
			node.mapPositions = updates.mapPositions;
		}
		this.nodeSearchLookup.set(node.source, this.buildSearchText(node));
		if (this.searchTermString.length > 0) {
			this.updateSearchResults(this.searchTermString);
		}
		this.recomputeVisibility();
	}

	getPathBetweenNodes(sourceId: string, targetId: string): string[] {
		return this.identifyPathBetweenNodes(sourceId, targetId);
	}

	private updateSearchResults(term: string) {
		const normalized = term.trim().toLowerCase();
		if (!normalized) {
			this.searchResultNodeIds.clear();
			return;
		}
		const queryTokens = normalized.split(/\s+/).filter(Boolean);
		const matches = this.nodes
			.filter((node) => {
				const searchableText = this.nodeSearchLookup.get(node.source) ?? '';
				return queryTokens.every((token) => searchableText.includes(token));
			})
			.map((node) => node.source);
		this.searchResultNodeIds = new Set(matches);
	}

	private buildSearchText(node: GraphNode): string {
		const parts = [
			node.source,
			node.nodeFilePath,
			...(node.tags ?? []),
			node.description ?? '',
			...(node.mapPositions ?? []).flatMap((position) => [
				position.label,
				position.url,
				position.lat != null ? `${position.lat}` : '',
				position.lng != null ? `${position.lng}` : '',
			]),
		];
		return parts
			.join(' ')
			.toLowerCase()
			.replace(/\s+/g, ' ')
			.trim();
	}

	private buildAdjacencyList(): Map<string, string[]> {
		const adjacency = new Map<string, string[]>();
		this.nodes.forEach((node) => {
			if (!adjacency.has(node.source)) {
				adjacency.set(node.source, []);
			}
		});
		this.links.forEach((link) => {
			if (!adjacency.has(link.source)) {
				adjacency.set(link.source, []);
			}
			if (!adjacency.has(link.target)) {
				adjacency.set(link.target, []);
			}
			adjacency.get(link.source)?.push(link.target);
			adjacency.get(link.target)?.push(link.source);
		});
		return adjacency;
	}

	private recomputeVisibility() {
		const initialDisplayable: string[] = [];
		this.rootNodeIds.forEach((root) => initialDisplayable.push(root));
		if (this.currentSelectedNodeId) {
			initialDisplayable.push(this.currentSelectedNodeId);
		}
		this.activeExpansionNodeIds = new Set(initialDisplayable);

		let connectedNodes: string[] = [...initialDisplayable];
		const anchorNode = this.getAnchorNodeId();

		if (anchorNode) {
			for (const nodeId of initialDisplayable) {
				if (nodeId === anchorNode) {
					continue;
				}
				connectedNodes = connectedNodes.concat(
					this.identifyPathBetweenNodes(anchorNode, nodeId)
				);
			}

			for (const searchedId of this.searchResultNodeIds) {
				if (searchedId === anchorNode) {
					continue;
				}
				const path = this.identifyPathBetweenNodes(anchorNode, searchedId);
				if (path.length === 0) {
					connectedNodes.push(searchedId);
				} else {
					connectedNodes = connectedNodes.concat(path);
				}
			}
		}

		for (const nodeId of initialDisplayable) {
			if (this.collapsedNodeIds.has(nodeId)) {
				continue;
			}
			const neighbors = this.adjacencyList.get(nodeId) ?? [];
			connectedNodes = connectedNodes.concat(neighbors);
		}

		this.displayableNodeIds = new Set(
			connectedNodes.filter((value): value is string => Boolean(value))
		);

		this.visibleNodes = this.nodes.filter((node) => this.displayableNodeIds.has(node.source));
		this.visibleLinks = this.links.filter(
			(link) =>
				this.displayableNodeIds.has(link.source) &&
				this.displayableNodeIds.has(link.target)
		);
	}

	private getAnchorNodeId(): string | null {
		if (this.rootNodeIds.size > 0) {
			return this.rootNodeIds.values().next().value ?? null;
		}
		return this.currentSelectedNodeId;
	}

	private identifyPathBetweenNodes(sourceNodeId: string, targetNodeId: string): string[] {
		if (!sourceNodeId || !targetNodeId) {
			return [];
		}
		if (sourceNodeId === targetNodeId) {
			return [sourceNodeId];
		}

		const queue: string[] = [sourceNodeId];
		const visited = new Set<string>([sourceNodeId]);
		const previous = new Map<string, string | null>([[sourceNodeId, null]]);

		while (queue.length > 0) {
			const currentNode = queue.shift();
			if (!currentNode) {
				continue;
			}
			const neighbors = this.adjacencyList.get(currentNode) || [];
			for (const neighbor of neighbors) {
				if (visited.has(neighbor)) {
					continue;
				}
				visited.add(neighbor);
				previous.set(neighbor, currentNode);
				if (neighbor === targetNodeId) {
					const path = [targetNodeId];
					let cursor: string | null = currentNode;
					while (cursor) {
						path.push(cursor);
						cursor = previous.get(cursor) ?? null;
					}
					return path.reverse();
				}
				queue.push(neighbor);
			}
		}

		return [];
	}
}
