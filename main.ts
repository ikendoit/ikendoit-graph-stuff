import {
	Plugin,
	TFile,
	WorkspaceLeaf,
	Notice,
	normalizePath,
	type DataAdapter,
	type Modifier
} from 'obsidian';
import * as d3 from 'd3';
import * as L from 'leaflet';
import {
    RADIUS_NODE,
    WIDTH_NODE_TITLE_BAR,
    HEIGHT_NODE_TITLE_BAR,
    NODE_IMAGE_SIZE,
    SVG_WIDTH,
    SVG_HEIGHT,
    defaultAvatar,
} from 'utils/constants';
import DisplayPanel from 'utils/canvas_panel_display'
import { GraphState, GraphNode, NodeMapPosition } from 'utils/graph_state'

const box_encapsulations: any[] = [];
const MAP_POSITIONS_BLOCK_START = '<!-- IKG_MAP_POSITIONS_START -->';
const MAP_POSITIONS_BLOCK_END = '<!-- IKG_MAP_POSITIONS_END -->';
const MAP_POSITION_COMMENT_PREFIX = 'IKG_MAP_POSITION';
const NODE_HOLD_REVEAL_MS = 3600;
const NODE_SECOND_TAP_WINDOW_MS = 3600;
const NODE_TOOLBELT_BUBBLE_DISTANCE = RADIUS_NODE + 82;
const NODE_TOOLBELT_CLEARANCE_RADIUS = NODE_TOOLBELT_BUBBLE_DISTANCE + 58;
const NODE_TOOLBELT_COLLISION_PADDING = 22;
const MAP_MODE_DEFAULT_CENTER: [number, number] = [20, 0];
const MAP_MODE_DEFAULT_ZOOM = 2;
const MAP_MODE_MAX_ZOOM = 23;
const MAP_MODE_FOCUS_ZOOM = 22;
const PRIMARY_GRAPH_COMMAND_ID = 'display-interactive-graph';
const PRIMARY_GRAPH_COMMAND_NAME = 'Open interactive knowledge graph';
const PRIMARY_GRAPH_HOTKEY = { modifiers: ['Mod', 'Alt'] as Modifier[], key: 'g' };
const SYNC_RELEASE_ROOT_DIR = '_ikg-plugin-sync';
const SYNC_RELEASE_PLUGIN_DIR = `${SYNC_RELEASE_ROOT_DIR}/ikendoit-graph-stuff`;
const SYNC_RELEASE_MANIFEST_PATH = `${SYNC_RELEASE_PLUGIN_DIR}/release.json`;
const SYNC_RELEASE_RUNTIME_FILES = ['main.js', 'manifest.json', 'styles.css', 'versions.json'] as const;

type AppMode = 'graph' | 'map';

interface NodeLocationRecord {
	node: GraphNode;
	position: NodeMapPosition;
	lat: number;
	lng: number;
}

interface MapAddressSearchResult {
	id: string;
	title: string;
	subtitle: string;
	lat: number;
	lng: number;
}

interface SyncedReleaseManifest {
	pluginId: string;
	version: string;
	builtAt: string;
	files: string[];
}

// --------- Constants
// --------- Module 1: Plugin Foundation
// bookmark__InteractiveGraphPlugin random Static-utilities
// bookmark__Node Render Face Image (first image within note file)

// --------- Module 2: Graph Modal UI Component
// bookmark__Update Displayable Node Logic (Collapse/Expand)
// bookmark__Simulation Configuration
// bookmark__Add Custom-Shape-definitions: Arrow-Marks, etc
// bookmark__displayInteractiveGraph
// Bookmark__Tab_Modules
// config: Create a horizontal split
// config: not create a split, but tops a Modal on top of current UI
// bookmark__Render Relationship-Link On UI
// bookmark__Render_rectangles_groupping_nodes
// bookmark__Render Node-Ball On UI
// bookmark_node_avatar_onclick_handler
// bookmark__Node Render Face Image (first image within note file)
// bookmark__Node Onclick triggers editor
// bookmark__Helper method to build the adjacency list from linksData
// bookmark__Method to identify the path between two nodes using DFS


// --------- Module 3: Node/Links interaction Handlers
// bookmark__Node Onclick triggers editor
// bookmark__Node Drag Handler
// bookmark__Link Onclick Handler (Not Implemented - Considering)

// --------- Module abc: [DOING] rendering a nice node-detail panel on click
// a-mark: image base64 extract
// b-mark: rendering of panel
// Doing this to support mobile usage

// --------- Module 4: [TODO] Relationship Rendering
// bookmark__Collapsed mode from "Root-Node", expand button
// [TODO] Custom backlink Label Syntax Support
// [TODO] Custom backlink Label Value Rendering
// zIndex Relationship visibility

// --------- Module 6: [TODO] Info Bar
// On Mobile, we can't open split view, bad UX - switch tab constantly
// So we need to do pop-up modal, to overcome limitation
// Thus, we need separate UI components to render nodes description
// [DONE] Render markdown-content into HTML, within canvas
// [TODO] UX: Allow scrolling in that foreignObject

// --------- Module 6: [DOING] Search Bar
// [] render search UX 
// [] Search and render path from Root Node(s) to that node, highlights the matching nodes



// Let's do this!

// --------- Module 1: Plugin Foundation
export default class InteractiveGraphPlugin extends Plugin {
	private parsedFileCache = new Map<string, { mtime: number; data: any }>();
	private imageBase64Cache = new Map<string, string>();

	async onload() {
		await this.installSyncedPluginUpdate();

		this.addCommand({
			id: PRIMARY_GRAPH_COMMAND_ID,
			name: PRIMARY_GRAPH_COMMAND_NAME,
			hotkeys: [PRIMARY_GRAPH_HOTKEY],
			callback: () => this.displayInteractiveGraph()
		});

		this.addCommand({
			id: 'display-interactive-graph-from-current-note',
			name: 'Open interactive knowledge graph from current note',
			callback: () => this.displayInteractiveGraph()
		});

		this.addCommand({
			id: 'display-interactive-graph-focus-search',
			name: 'Open interactive knowledge graph and focus search',
			callback: () => this.displayInteractiveGraph({ focusSearch: true })
		});

		this.addCommand({
			id: 'apply-synced-plugin-release',
			name: 'Apply synced plugin release from vault',
			callback: async () => {
				await this.installSyncedPluginUpdate({ force: true, showNoopNotice: true });
			}
		});
	}

	onunload() {
		console.log('unloading interactive graph plugin');
	}

	// bookmark__displayInteractiveGraph
	async displayInteractiveGraph(options: { focusSearch?: boolean } = {}) {
		const files = this.app.vault.getMarkdownFiles();
		const linksData: any[] = [];
		const nodesData: any[] = [];
		const activeLeaf = this.app.workspace.activeLeaf;
		const currentFile = this.app.workspace.getActiveFile();

		if (!activeLeaf || !currentFile) {
			new Notice('Open a markdown note first, then launch the interactive knowledge graph.');
			return;
		}

		if (files.length === 0) {
			new Notice('This vault has no markdown notes to graph yet.');
			return;
		}

		if (activeLeaf && currentFile) {
			// config: Create a horizontal split
			const graphLeafBelow = this.app.workspace.createLeafBySplit(activeLeaf, 'horizontal', false);

			// config: not create a split, but tops a Modal on top of current UI
			// Note: On mobile, this becomes "new tab"
			// const graphLeafBelow = null
			const rootNodeIds = new Set<string>()
			let currentSelectedNodeId = null
			try {
				currentSelectedNodeId = InteractiveGraphPlugin.cleanNodeFileTextName(currentFile.path)
				rootNodeIds.add(currentSelectedNodeId)
			} catch (err) { }

			for (const file of files) {
				const parsed = await this.parseMarkdownFile(file);

				if (parsed.isRootNode) {
					rootNodeIds.add(parsed.source)
				}

				nodesData.push({
					source: parsed.source,
					nodeFilePath: file.path,
					tags: parsed.tags,
					description: parsed.content,
					mapPositions: parsed.mapPositions,
					fx: parsed.persistedCoordinates?.fx ?? null,
					fy: parsed.persistedCoordinates?.fy ?? null,
					image: parsed.image,
				})

				parsed.backlinks.forEach((link: any) => {
					if (InteractiveGraphPlugin.isMediaNode(link.target)) {
						return; // Only graphing Note Files. This needs code-management-scaling
					}
					linksData.push({
						source: parsed.source,
						target: InteractiveGraphPlugin.cleanNodeFileTextName(link.target),
						zIndex: link.zIndex,
					});
				});
			}

			const displayPanel = new DisplayPanel(this.app, graphLeafBelow)
			const container = new AppContainer(
				this.app,
				activeLeaf,
				graphLeafBelow,
				displayPanel,
				linksData,
				nodesData,
				Array.from(rootNodeIds),
				currentSelectedNodeId);

			displayPanel.renderSelectedNodePanel()

			// config: Create a horizontal split
			await container.onOpen();
			if (options.focusSearch) {
				container.focusSearchInput();
			}
			// config: not create a split, but tops a Modal on top of current UI
			// container.open();
		}
	}

	private async parseMarkdownFile(file: TFile) {
		const cacheKey = file.path;
		const fileMtime = file.stat?.mtime ?? 0;
		const cached = this.parsedFileCache.get(cacheKey);
		if (cached && cached.mtime === fileMtime) {
			return cached.data;
		}

		const content = await this.app.vault.read(file);
		const parsed = {
			content,
			source: InteractiveGraphPlugin.cleanNodeFileTextName(file.path),
			isRootNode: content.includes("#ROOT_NODE"),
			backlinks: this.parseBacklinks(content),
			tags: this.extractTags(content, file.path),
			mapPositions: this.extractMapPositions(content),
			persistedCoordinates: this.extractFxFy(content),
			image: await this.extractFirstImage(content),
		};

		this.parsedFileCache.set(cacheKey, { mtime: fileMtime, data: parsed });
		return parsed;
	}

	// bookmark__InteractiveGraphPlugin random Static-utilities
	async extractFirstImage(content: string) {
		const imageRegex = /!\[\[([^\]]+)\]\]/g;
		const match = imageRegex.exec(content);
		if (!match) {
			return defaultAvatar;
		}

		const imagePath = match[1];
		for (const candidatePath of [`images/${imagePath}`, imagePath]) {
			try {
				return await this.imageToBase64(candidatePath);
			} catch (err) {
				continue;
			}
		}

		return defaultAvatar;
	}

	extractTags(content: string, filePath: string): string[]{
		const tagRegex = /#[A-Z0-9_-]+/g;
		return content.match(tagRegex) || []
	}

	extractFxFy(content: string) {
		const match = content.match(/Coordinate-Graph-Render\((\d+(\.\d+)?)\/(\d+(\.\d+)?)\)/);
		if (match) {
			const fx = parseFloat(match[1]);
			const fy = parseFloat(match[3]);
			return { fx, fy };
		}
		return null;
	}

	extractMapPositions(content: string): NodeMapPosition[] {
		const positions: NodeMapPosition[] = [];
		const regex = /<!--\s*IKG_MAP_POSITION\s+({[\s\S]*?})\s*-->/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(content)) !== null) {
			try {
				const parsed = JSON.parse(match[1]);
				if (!parsed?.id || !parsed?.url) {
					continue;
				}
				positions.push({
					id: String(parsed.id),
					label: String(parsed.label ?? 'Pinned map position'),
					url: String(parsed.url),
					lat: typeof parsed.lat === 'number' ? parsed.lat : null,
					lng: typeof parsed.lng === 'number' ? parsed.lng : null,
					createdAt: parsed.createdAt ? String(parsed.createdAt) : undefined,
				});
			} catch (error) {
				console.warn('Failed to parse saved map position metadata', error);
			}
		}
		return positions;
	}

	static arrayBufferToBase64(buffer: ArrayBuffer): string {
		let binary = '';
		const bytes = new Uint8Array(buffer);
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return window.btoa(binary);
	}

	async imageToBase64(relativePath: string): Promise<string> {
		const cached = this.imageBase64Cache.get(relativePath);
		if (cached) {
			return cached;
		}

		const arrayBuffer = await this.app.vault.adapter.readBinary(relativePath);
		const base64 = InteractiveGraphPlugin.arrayBufferToBase64(arrayBuffer);
		const dataUri = `data:image/png;base64,${base64}`;
		this.imageBase64Cache.set(relativePath, dataUri);
		return dataUri;
	}

	parseBacklinks(content: string) {
		const regex = /\[\[([^\]]+)\],\s*(\d+)\]|\[\[([^\]]+)\]\]/g;
		const backlinks = [];

		let match;
		while ((match = regex.exec(content)) !== null) {
			if (match[1] && match[2]) {
				backlinks.push({
					target: match[1],
					zIndex: parseInt(match[2])
				});
			} else if (match[3]) {
				backlinks.push({
					target: match[3],
					zIndex: 1
				});
			}
		}

		return backlinks;
	}

	static cleanNodeFileTextName(name: string) {
		return name.replace(/\.md$/, '').replace('buddy-loop-exports/', '');
	}

	static isMediaNode(name: string) {
		return (
			name.endsWith('.png') ||
			name.endsWith('.jpeg') ||
			name.endsWith('.jpg') ||
			name.endsWith('.webp')
		);
	}

	private async installSyncedPluginUpdate(options: { force?: boolean; showNoopNotice?: boolean } = {}) {
		const adapter = this.app.vault.adapter;
		const releaseManifestPath = normalizePath(SYNC_RELEASE_MANIFEST_PATH);

		try {
			if (!(await adapter.exists(releaseManifestPath))) {
				if (options.showNoopNotice) {
					new Notice('No synced plugin release was found in the vault yet.');
				}
				return false;
			}

			const rawRelease = await adapter.read(releaseManifestPath);
			const release = this.parseSyncedReleaseManifest(rawRelease);
			if (!release) {
				if (options.showNoopNotice) {
					new Notice('The synced plugin release manifest is invalid.');
				}
				return false;
			}

			if (release.pluginId !== this.manifest.id) {
				console.warn('Skipping synced plugin release for unexpected plugin id', release.pluginId);
				return false;
			}

			if (!options.force && InteractiveGraphPlugin.compareVersions(release.version, this.manifest.version) <= 0) {
				if (options.showNoopNotice) {
					new Notice(`Already on the newest synced plugin release (${this.manifest.version}).`);
				}
				return false;
			}

			const targetDir = normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}`);
			await this.ensureDirectoryExists(adapter, targetDir);

			const releaseFiles = release.files.length > 0 ? release.files : [...SYNC_RELEASE_RUNTIME_FILES];
			for (const relativeFile of releaseFiles) {
				const sourcePath = normalizePath(`${SYNC_RELEASE_PLUGIN_DIR}/${relativeFile}`);
				const targetPath = normalizePath(`${targetDir}/${relativeFile}`);
				const fileContents = await adapter.read(sourcePath);
				await adapter.write(targetPath, fileContents);
			}

			new Notice(`Installed synced plugin release ${release.version}. Restart Obsidian to load it.`);
			return true;
		} catch (error) {
			console.error('Failed to install synced plugin release', error);
			if (options.showNoopNotice) {
				new Notice('Failed to apply the synced plugin release. Check the console for details.');
			}
			return false;
		}
	}

	private parseSyncedReleaseManifest(rawRelease: string): SyncedReleaseManifest | null {
		try {
			const parsed = JSON.parse(rawRelease);
			if (
				typeof parsed?.pluginId !== 'string' ||
				typeof parsed?.version !== 'string' ||
				typeof parsed?.builtAt !== 'string' ||
				!Array.isArray(parsed?.files)
			) {
				return null;
			}

			return {
				pluginId: parsed.pluginId,
				version: parsed.version,
				builtAt: parsed.builtAt,
				files: parsed.files.filter((value: unknown): value is string => typeof value === 'string'),
			};
		} catch (error) {
			console.warn('Failed to parse synced plugin release manifest', error);
			return null;
		}
	}

	private async ensureDirectoryExists(adapter: DataAdapter, targetDir: string) {
		const normalizedTargetDir = normalizePath(targetDir);
		const pathParts = normalizedTargetDir.split('/').filter(Boolean);
		let currentPath = '';

		for (const part of pathParts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			if (!(await adapter.exists(currentPath))) {
				await adapter.mkdir(currentPath);
			}
		}
	}

	private static compareVersions(left: string, right: string) {
		const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
		const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
		const partCount = Math.max(leftParts.length, rightParts.length);

		for (let index = 0; index < partCount; index++) {
			const leftValue = leftParts[index] ?? 0;
			const rightValue = rightParts[index] ?? 0;
			if (leftValue !== rightValue) {
				return leftValue - rightValue;
			}
		}

		return 0;
	}

}



// --------- Module 2: Graph Modal UI Component
// config: Create a horizontal split
class AppContainer {
// config: not create a split, but tops a Modal on top of current UI
// class AppContainer extends Modal {
	graphState: GraphState;
	nodesData: GraphNode[];
	linksData: any[];

	// Markdown Tab-Panel;
	userTextEditorPanel: WorkspaceLeaf;

	// Output when we create-the-splitted-panel() to host this UI
	graphContainerPanel: WorkspaceLeaf;

	// Obsidian Plugin App Object
	parentAppContainer: any;

	// HTML elements, displayed on top of canvas, 
	// allowing for full canvas refresh without interputting user activities
	displayPanelComponent: any;

	// SVG Canvas Reference
	svg: any;

	// SVG-Zoom Behavior Reference
	zoomBehavior: any;

	// Track currently running force simulation so we can stop old ones before re-rendering
	simulation: any;

	// Fast lookup for visible node positions without global DOM scans
	renderedNodeLookup: Map<string, any>;

	get currentSelectedNodeId(): string | null {
		return this.graphState.getCurrentSelectedNodeId();
	}

	set currentSelectedNodeId(nodeId: string | null) {
		this.graphState.setCurrentSelectedNodeId(nodeId);
	}

	get rootNodeIds(): string[] {
		return this.graphState.getRootNodeIds();
	}

	get searchResultNodeIds(): string[] {
		return this.graphState.getSearchResultNodeIds();
	}

	get collapsedNodeIds(): string[] {
		return this.graphState.getCollapsedNodeIds();
	}

	get activeExpansionNodeIds(): string[] {
		return this.graphState.getActiveExpansionNodeIds();
	}

	// D3-Transformer-Zoom Object
	currentTransform = d3.zoomIdentity;
	diagnosticsPanelEl: HTMLElement | null = null;
	diagnosticsToggleButtonEl: HTMLButtonElement | null = null;
	diagnosticsVisible = true;
	controlBarEl: HTMLElement | null = null;
	controlBarMetaEl: HTMLElement | null = null;
	searchInputEl: HTMLInputElement | null = null;
	searchInputDebounceHandle: number | null = null;
	graphModeButtonEl: HTMLButtonElement | null = null;
	mapModeButtonEl: HTMLButtonElement | null = null;
	activeNodeToolbeltId: string | null = null;
	holdRevealTimeoutHandle: number | null = null;
	holdAnimationFrameHandle: number | null = null;
	holdStartedAtMs: number | null = null;
	holdNodeId: string | null = null;
	holdProgressCircleEl: SVGCircleElement | null = null;
	suppressNodeClickUntilMs = 0;
	pendingSecondTapNodeId: string | null = null;
	pendingSecondTapExpiryMs = 0;
	currentMode: AppMode = 'graph';
	mapModeRootEl: HTMLElement | null = null;
	mapModeCanvasEl: HTMLElement | null = null;
	mapModeSidebarEl: HTMLElement | null = null;
	mapNodeCountEl: HTMLElement | null = null;
	mapSelectionTitleEl: HTMLElement | null = null;
	mapSelectionMetaEl: HTMLElement | null = null;
	mapSearchInputEl: HTMLInputElement | null = null;
	mapSearchStatusEl: HTMLElement | null = null;
	mapSearchResultsEl: HTMLElement | null = null;
	mapDraftLabelInputEl: HTMLInputElement | null = null;
	mapDraftValueInputEl: HTMLInputElement | null = null;
	mapLocatedListEl: HTMLElement | null = null;
	mapUnlocatedListEl: HTMLElement | null = null;
	mapInstance: L.Map | null = null;
	mapMarkerLayer: L.LayerGroup | null = null;
	mapDraftMarker: L.Marker | null = null;
	mapDraftLatLng: L.LatLngLiteral | null = null;
	mapLayerControl: L.Control.Layers | null = null;
	mapShouldAutoFrame = true;
	mapAutoFrameNodeId: string | null = null;
	mapAddressSearchQuery = '';
	mapAddressSearchResults: MapAddressSearchResult[] = [];
	mapAddressSearchLoading = false;
	mapAddressSearchAbortController: AbortController | null = null;
	mapSectionExpanded: Record<string, boolean> = {};
	layoutObserver: ResizeObserver | null = null;
	layoutSyncFrameHandle: number | null = null;
	graphNodeSelection: any = null;
	graphLinkSelection: any = null;
	nodeElementLookup: Map<string, SVGGElement> = new Map();
	incidentLinkEnds: Map<string, Array<{ el: SVGLineElement; end: 'source' | 'target' }>> = new Map();
	boxedNodesLookup: Record<string, any> = {};
	simulationSettled = false;
	simulationAutoStopHandle: number | null = null;
	graphIsDragging = false;
	renderedVisibleNodeCount = 0;
	liteGraphPaint = false;
	lastDiagnosticsData: {
		visibleNodes: number;
		visibleLinks: number;
		renderedLabels: number;
		renderedImages: number;
		selectedNodeId: string | null;
		rootNodeCount: number;
		collapsedNodeCount: number;
		searchResultCount: number;
		renderMode: string;
		simulationStatus: string;
		alpha?: number;
	} | null = null;

	private readonly LABEL_RENDER_THRESHOLD = 120;
	private readonly IMAGE_RENDER_THRESHOLD = 90;
	private readonly DECORATION_RENDER_THRESHOLD = 50;
	private readonly MOBILE_LABEL_RENDER_THRESHOLD = 64;
	private readonly MOBILE_IMAGE_RENDER_THRESHOLD = 36;


	constructor(parentAppContainer: any,
		userTextEditorPanel: WorkspaceLeaf,
		graphContainerPanel: WorkspaceLeaf,
		displayPanelComponent: any,
		linksData: any[],
		nodesData: any[],
		rootNodeIds: string[],
		currentSelectedNodeId: string | null) {
		/*
			parentAppContainer: Obsidian.Plugin top level anchor reference
			userTextEditorPanel: Used for split-text-file view on Desktop Mode, currently disabled.
				this is HTML-Div (Obsidian.workspaceLeaf) of the panel that 
				User last Focused on before trigger plugin
			graphContainerPanel: Used for split-text-file view on Desktop Mode, currently disabled.
				this is HTML-Div (Obsidian.workspaceLeaf) of the panel that 
				renders the graph
			displayPanelModal: Modal instance reference
			linksData: Array of Links-Objects
			nodesData: Array of Node-Objects
			rootNodeIds: Nodes that we want to always opened, during collapsed mode
			currentSelectedNodeId: ID of Node, last clicked on UI. 
		*/

		// config: Create a horizontal split
		// NA
		// config: not create a split, but tops a Modal on top of current UI
		// super(parentAppContainer);

		this.linksData = linksData;
		this.nodesData = nodesData;
		this.graphState = new GraphState({
			nodes: nodesData,
			links: linksData,
			rootNodeIds,
			currentSelectedNodeId,
		});
		this.displayPanelComponent = displayPanelComponent;
		this.userTextEditorPanel = userTextEditorPanel;
		this.graphContainerPanel = graphContainerPanel;
		this.parentAppContainer = parentAppContainer;
		this.renderedNodeLookup = new Map()
	}

	private destroyMapMode() {
		this.mapAddressSearchAbortController?.abort();
		this.mapAddressSearchAbortController = null;
		this.mapInstance?.remove();
		this.mapInstance = null;
		this.mapMarkerLayer = null;
		this.mapDraftMarker = null;
		this.mapLayerControl = null;
		this.mapModeRootEl?.remove();
		this.mapModeRootEl = null;
		this.mapModeCanvasEl = null;
		this.mapModeSidebarEl = null;
		this.mapNodeCountEl = null;
		this.mapSelectionTitleEl = null;
		this.mapSelectionMetaEl = null;
		this.mapSearchInputEl = null;
		this.mapSearchStatusEl = null;
		this.mapSearchResultsEl = null;
		this.mapDraftLabelInputEl = null;
		this.mapDraftValueInputEl = null;
		this.mapLocatedListEl = null;
		this.mapUnlocatedListEl = null;
	}

	private disconnectLayoutObserver() {
		this.layoutObserver?.disconnect();
		this.layoutObserver = null;
	}

	private isMobileMapLayout() {
		return window.innerWidth <= 900;
	}

	private getMapSectionExpanded(sectionKey: string, mobileDefaultExpanded: boolean) {
		if (!(sectionKey in this.mapSectionExpanded)) {
			this.mapSectionExpanded[sectionKey] = this.isMobileMapLayout() ? mobileDefaultExpanded : true;
		}
		return this.mapSectionExpanded[sectionKey];
	}

	private buildMapUtilityCard(parent: HTMLElement, config: {
		sectionKey: string;
		eyebrow: string;
		title: string;
		mobileDefaultExpanded: boolean;
		extraClasses?: string[];
	}) {
		const section = parent.createDiv({
			cls: ['ikg-map-mode__card', 'ikg-map-mode__utility-card', ...(config.extraClasses ?? [])].join(' '),
		});
		const expanded = this.getMapSectionExpanded(config.sectionKey, config.mobileDefaultExpanded);
		section.classList.toggle('is-collapsed', !expanded);

		const toggleButton = section.createEl('button', {
			cls: 'ikg-map-mode__utility-toggle',
			attr: { type: 'button', 'aria-expanded': String(expanded) },
		});
		const toggleCopy = toggleButton.createDiv({ cls: 'ikg-map-mode__utility-toggle-copy' });
		toggleCopy.createDiv({ cls: 'ikg-map-mode__card-eyebrow', text: config.eyebrow });
		toggleCopy.createDiv({ cls: 'ikg-map-mode__utility-title', text: config.title });
		toggleButton.createDiv({ cls: 'ikg-map-mode__utility-toggle-state', text: expanded ? 'Hide' : 'Show' });
		toggleButton.addEventListener('click', () => {
			this.mapSectionExpanded[config.sectionKey] = !this.getMapSectionExpanded(config.sectionKey, config.mobileDefaultExpanded);
			this.refreshMapModeFromState();
		});

		const body = section.createDiv({ cls: 'ikg-map-mode__utility-body' });
		return { section, body };
	}

	private ensureLayoutObserver() {
		if (typeof ResizeObserver === 'undefined' || !this.controlBarEl?.isConnected) {
			return;
		}
		const contentEl = this.graphContainerPanel.view.containerEl;
		this.disconnectLayoutObserver();
		this.layoutObserver = new ResizeObserver(() => {
			this.scheduleOverlayLayoutSync();
		});
		this.layoutObserver.observe(contentEl);
		this.layoutObserver.observe(this.controlBarEl);
	}

	private scheduleOverlayLayoutSync() {
		if (this.layoutSyncFrameHandle != null) {
			window.cancelAnimationFrame(this.layoutSyncFrameHandle);
		}
		this.layoutSyncFrameHandle = window.requestAnimationFrame(() => {
			this.layoutSyncFrameHandle = null;
			this.syncOverlayLayoutMetrics();
		});
	}

	private syncOverlayLayoutMetrics() {
		const contentEl = this.graphContainerPanel.view.containerEl;
		const contentRect = contentEl.getBoundingClientRect();
		const defaultTopOffset = window.innerWidth <= 900 ? 188 : 144;
		const defaultEdgeInset = window.innerWidth <= 900 ? 12 : 14;
		let topOffset = defaultTopOffset;

		if (this.controlBarEl?.isConnected) {
			const controlBarRect = this.controlBarEl.getBoundingClientRect();
			topOffset = Math.max(topOffset, Math.ceil(controlBarRect.bottom - contentRect.top + defaultEdgeInset));
		}

		contentEl.style.setProperty('--ikg-control-bar-offset', `${topOffset}px`);
		if (this.currentMode === 'map' && this.mapInstance) {
			window.requestAnimationFrame(() => {
				this.mapInstance?.invalidateSize(false);
			});
		}
	}

	private installMapGestureShield() {
		if (!this.mapModeCanvasEl || this.mapModeCanvasEl.dataset.ikgGestureShield === 'true') {
			return;
		}
		L.DomEvent.disableClickPropagation(this.mapModeCanvasEl);
		L.DomEvent.disableScrollPropagation(this.mapModeCanvasEl);
		this.mapModeCanvasEl.dataset.ikgGestureShield = 'true';
	}

	private queueMapAutoFrame(nodeId?: string | null) {
		this.mapShouldAutoFrame = true;
		this.mapAutoFrameNodeId = nodeId ?? this.currentSelectedNodeId ?? null;
	}

	private clearGraphCanvas() {
		const contentEl = this.graphContainerPanel.view.containerEl;
		if (this.simulationAutoStopHandle != null) {
			window.clearTimeout(this.simulationAutoStopHandle);
			this.simulationAutoStopHandle = null;
		}
		this.simulation?.stop();
		this.simulation = null;
		this.simulationSettled = false;
		this.graphIsDragging = false;
		this.graphNodeSelection = null;
		this.graphLinkSelection = null;
		this.nodeElementLookup = new Map();
		this.incidentLinkEnds = new Map();
		this.boxedNodesLookup = {};
		d3.select(contentEl).select('svg').remove();
		this.renderedNodeLookup = new Map();
	}

	private async rerenderGraph() {
		this.destroyMapMode();
		this.clearGraphCanvas();
		const svg = await this.bootstrapCanvasGraphDisplay();
		await this.bootstrapControlPlaneOnCanvas(svg);
	}

	private async renderActiveMode() {
		if (this.currentMode === 'map') {
			this.clearGraphCanvas();
			await this.renderMapMode();
			return;
		}
		await this.rerenderGraph();
	}

	private ensureDiagnosticsPanel() {
		const contentEl = this.graphContainerPanel.view.containerEl;
		if (!this.diagnosticsPanelEl || !this.diagnosticsPanelEl.isConnected) {
			this.diagnosticsPanelEl = contentEl.createEl('div', { cls: 'graph-diagnostics-panel' });
		}
		this.refreshDiagnosticsVisibility();
		return this.diagnosticsPanelEl;
	}

	private shouldDefaultDiagnosticsBeVisible() {
		const width = this.graphContainerPanel.view.containerEl.clientWidth || SVG_WIDTH;
		return width >= 1180;
	}

	private refreshDiagnosticsVisibility() {
		if (this.diagnosticsPanelEl) {
			this.diagnosticsPanelEl.classList.toggle('is-hidden', !this.diagnosticsVisible || this.currentMode !== 'graph');
		}
		if (this.diagnosticsToggleButtonEl) {
			this.diagnosticsToggleButtonEl.setText(this.diagnosticsVisible ? 'Hide stats' : 'Show stats');
			this.diagnosticsToggleButtonEl.classList.toggle('is-active', this.diagnosticsVisible);
		}
	}

	private toggleDiagnosticsVisibility(forceValue?: boolean) {
		this.diagnosticsVisible = typeof forceValue === 'boolean' ? forceValue : !this.diagnosticsVisible;
		this.refreshDiagnosticsVisibility();
		if (this.diagnosticsVisible && this.lastDiagnosticsData) {
			this.updateDiagnosticsPanel(this.lastDiagnosticsData);
		}
	}

	private refreshModeButtons() {
		this.graphModeButtonEl?.classList.toggle('is-active', this.currentMode === 'graph');
		this.mapModeButtonEl?.classList.toggle('is-active', this.currentMode === 'map');
	}

	private ensureControlBar() {
		const contentEl = this.graphContainerPanel.view.containerEl;
		if (this.controlBarEl?.isConnected) {
			this.refreshModeButtons();
			return this.controlBarEl;
		}

		const bar = contentEl.createDiv({ cls: 'ikg-control-bar' });
		const titleBlock = bar.createDiv({ cls: 'ikg-control-bar__title-block' });
		titleBlock.createDiv({ cls: 'ikg-control-bar__eyebrow', text: 'Ikendoit Graph Explorer' });
		titleBlock.createDiv({ cls: 'ikg-control-bar__title', text: 'Interactive knowledge graph for this vault' });
		const modeTabs = titleBlock.createDiv({ cls: 'ikg-control-bar__tabs' });
		const graphModeButton = modeTabs.createEl('button', { text: 'Graph mode' });
		graphModeButton.addEventListener('click', () => {
			void this.setAppMode('graph', { focusSelection: true });
		});
		const mapModeButton = modeTabs.createEl('button', { text: 'Map mode' });
		mapModeButton.addEventListener('click', () => {
			void this.setAppMode('map');
		});
		const meta = titleBlock.createDiv({ cls: 'ikg-control-bar__meta', text: 'Search titles, tags, file paths, or note text.' });

		const searchWrap = bar.createDiv({ cls: 'ikg-control-bar__search' });
		const searchInput = searchWrap.createEl('input', {
			type: 'search',
			placeholder: 'Search nodes, tags, note text…',
		});
		searchInput.value = this.graphState.getSearchTerm() ?? '';
		searchInput.addEventListener('input', (event: any) => {
			const query = String(event.target?.value ?? '');
			this.scheduleSearchQueryUpdate(query);
		});
		searchInput.addEventListener('keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				void this.focusPrimarySearchResult();
			}
		});

		const focusHitButton = searchWrap.createEl('button', { text: 'Focus hit' });
		focusHitButton.addEventListener('click', () => {
			void this.focusPrimarySearchResult();
		});

		const diagnosticsButton = searchWrap.createEl('button', { text: 'Hide stats' });
		diagnosticsButton.addEventListener('click', () => {
			this.toggleDiagnosticsVisibility();
		});

		const clearButton = searchWrap.createEl('button', { text: 'Clear' });
		clearButton.addEventListener('click', () => {
			this.runSearchQueryUpdate('');
			if (this.searchInputEl) {
				this.searchInputEl.value = '';
				this.searchInputEl.focus();
			}
		});

		this.controlBarEl = bar;
		this.controlBarMetaEl = meta;
		this.searchInputEl = searchInput;
		this.diagnosticsToggleButtonEl = diagnosticsButton;
		this.graphModeButtonEl = graphModeButton;
		this.mapModeButtonEl = mapModeButton;
		this.ensureLayoutObserver();
		this.refreshControlBarMeta();
		this.refreshModeButtons();
		this.refreshDiagnosticsVisibility();
		this.scheduleOverlayLayoutSync();
		return bar;
	}

	focusSearchInput() {
		if (this.searchInputEl) {
			this.searchInputEl.focus();
			this.searchInputEl.select();
		}
	}

	private scheduleSearchQueryUpdate(textValue: string) {
		if (this.searchInputDebounceHandle) {
			window.clearTimeout(this.searchInputDebounceHandle);
		}
		this.searchInputDebounceHandle = window.setTimeout(() => {
			this.runSearchQueryUpdate(textValue);
		}, 120);
	}

	private runSearchQueryUpdate(textValue: string) {
		if (this.searchInputDebounceHandle) {
			window.clearTimeout(this.searchInputDebounceHandle);
			this.searchInputDebounceHandle = null;
		}
		void this.onQuerySearchHandler(textValue);
	}

	private async setAppMode(mode: AppMode, options: { focusSelection?: boolean } = {}) {
		if (this.currentMode === mode) {
			if (mode === 'map') {
				this.refreshMapModeFromState();
			}
			return;
		}
		this.currentMode = mode;
		if (mode === 'map') {
			this.queueMapAutoFrame(this.currentSelectedNodeId);
		}
		this.refreshModeButtons();
		this.refreshControlBarMeta();
		this.refreshDiagnosticsVisibility();
		await this.renderActiveMode();
		if (mode === 'graph' && options.focusSelection && this.currentSelectedNodeId) {
			this.focusOnNode(this.currentSelectedNodeId);
		}
	}

	private refreshControlBarMeta() {
		if (!this.controlBarMetaEl) {
			return;
		}
		const searchTerm = this.graphState.getSearchTerm().trim();
		const hitCount = this.searchResultNodeIds.length;
		if (!searchTerm) {
			if (this.currentMode === 'map') {
				this.controlBarMetaEl.setText('Map mode shows all pinned nodes globally. Search filters the node lists, click the map to draft a position, then save it to the selected node.');
				this.scheduleOverlayLayoutSync();
				return;
			}
			this.controlBarMetaEl.setText('Search titles, tags, file paths, or note text. The current note opens centered with bubbles ready ✨ Hold any node for tools, or tap the same node again within 3.6s to expand.');
			this.scheduleOverlayLayoutSync();
			return;
		}
		const suffix = hitCount > 0
			? this.currentMode === 'map'
				? 'Matching nodes stay easy to scan in the map tables.'
				: 'Press Enter or Focus hit to jump to the first match.'
			: 'No matching nodes yet.';
		this.controlBarMetaEl.setText(`${hitCount} search hit${hitCount === 1 ? '' : 's'} for “${searchTerm}”. ${suffix}`);
		this.scheduleOverlayLayoutSync();
	}

	private async focusPrimarySearchResult() {
		const nodeId = this.graphState.getPrimarySearchResultId();
		if (!nodeId) {
			new Notice('No graph node matches the current search yet.');
			return;
		}
		this.graphState.ensureNodeIsRoot(nodeId);
		this.currentSelectedNodeId = nodeId;
		if (this.currentMode === 'map') {
			this.refreshMapModeFromState();
			return;
		}
		await this.rerenderGraph();
		this.focusOnNode(nodeId);
	}

	private updateDiagnosticsPanel(data: {
		visibleNodes: number;
		visibleLinks: number;
		renderedLabels: number;
		renderedImages: number;
		selectedNodeId: string | null;
		rootNodeCount: number;
		collapsedNodeCount: number;
		searchResultCount: number;
		renderMode: string;
		simulationStatus: string;
		alpha?: number;
	}) {
		this.lastDiagnosticsData = data;
		if (!this.diagnosticsVisible || this.currentMode !== 'graph') {
			return;
		}
		const panel = this.ensureDiagnosticsPanel();
		const rows = [
			['Mode', data.renderMode],
			['Visible nodes', `${data.visibleNodes}`],
			['Visible links', `${data.visibleLinks}`],
			['Labels drawn', `${data.renderedLabels}`],
			['Images drawn', `${data.renderedImages}`],
			['Selected', data.selectedNodeId ?? 'none'],
			['Root nodes', `${data.rootNodeCount}`],
			['Collapsed', `${data.collapsedNodeCount}`],
			['Search hits', `${data.searchResultCount}`],
			['Simulation', data.alpha != null ? `${data.simulationStatus} (α=${data.alpha.toFixed(3)})` : data.simulationStatus],
		];

		panel.innerHTML = `<div class="graph-diagnostics-panel__title">Graph diagnostics</div>${rows.map(([k,v]) => `<div class="graph-diagnostics-panel__row"><span>${k}</span><span>${v}</span></div>`).join('')}`;
	}

	private isCoarsePointerDevice() {
		return Boolean(this.parentAppContainer?.isMobile)
			|| (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
	}

	private getLabelRenderThreshold() {
		return this.isCoarsePointerDevice() ? this.MOBILE_LABEL_RENDER_THRESHOLD : this.LABEL_RENDER_THRESHOLD;
	}

	private getImageRenderThreshold() {
		return this.isCoarsePointerDevice() ? this.MOBILE_IMAGE_RENDER_THRESHOLD : this.IMAGE_RENDER_THRESHOLD;
	}

	private shouldUseLiteGraphPaint(visibleNodeCount: number) {
		return this.isCoarsePointerDevice() || visibleNodeCount > 28;
	}

	private indexIncidentLinks() {
		const index = new Map<string, Array<{ el: SVGLineElement; end: 'source' | 'target' }>>();
		this.graphLinkSelection?.each(function (this: SVGLineElement, link: any) {
			const source = link.source;
			const target = link.target;
			const sourceId = typeof source === 'string' ? source : source?.id;
			const targetId = typeof target === 'string' ? target : target?.id;
			if (sourceId) {
				const list = index.get(sourceId) ?? [];
				list.push({ el: this, end: 'source' });
				index.set(sourceId, list);
			}
			if (targetId) {
				const list = index.get(targetId) ?? [];
				list.push({ el: this, end: 'target' });
				index.set(targetId, list);
			}
		});
		this.incidentLinkEnds = index;
	}

	private graphDomMatchesVisibleState() {
		const visibleIds = this.graphState.getDisplayableNodeIds();
		if (visibleIds.length !== this.renderedNodeLookup.size) {
			return false;
		}
		return visibleIds.every((nodeId) => this.renderedNodeLookup.has(nodeId));
	}

	private pinRenderedNodesInPlace() {
		this.renderedNodeLookup.forEach((node: any, nodeId: string) => {
			const x = node.fx ?? node.x;
			const y = node.fy ?? node.y;
			if (x == null || y == null) {
				return;
			}
			node.x = x;
			node.y = y;
			node.fx = x;
			node.fy = y;
			node.vx = 0;
			node.vy = 0;
			this.graphState.updateNodeCoordinates(nodeId, { fx: x, fy: y });
		});
	}

	private settleSimulation(status: string) {
		this.simulation?.alphaTarget(0);
		this.simulation?.stop();
		this.simulationSettled = true;
		if (this.simulationAutoStopHandle != null) {
			window.clearTimeout(this.simulationAutoStopHandle);
			this.simulationAutoStopHandle = null;
		}
		this.paintGraphFrame();
		this.updateDiagnosticsPanel({
			visibleNodes: this.renderedVisibleNodeCount,
			visibleLinks: this.graphLinkSelection?.size?.() ?? this.graphState.getVisibleLinks().length,
			renderedLabels: this.renderedVisibleNodeCount,
			renderedImages: this.renderedVisibleNodeCount,
			selectedNodeId: this.currentSelectedNodeId,
			rootNodeCount: this.rootNodeIds.length,
			collapsedNodeCount: this.collapsedNodeIds.length,
			searchResultCount: this.searchResultNodeIds.length,
			renderMode: this.liteGraphPaint ? 'lite-static' : 'full-detail',
			simulationStatus: status,
			alpha: this.simulation?.alpha?.() ?? 0,
		});
	}

	private paintGraphFrame() {
		this.graphLinkSelection
			?.attr('x1', (d: { source: { x: any } }) => d.source.x)
			.attr('y1', (d: { source: { y: any } }) => d.source.y)
			.attr('x2', (d: { target: { x: any } }) => d.target.x)
			.attr('y2', (d: { target: { y: any } }) => d.target.y);
		this.graphNodeSelection
			?.attr('transform', (d: { x?: number; y?: number }) => `translate(${d.x ?? 0},${d.y ?? 0})`);
	}

	private constrainDragPosition(nodeId: string, x: number, y: number) {
		const box = this.boxedNodesLookup[nodeId];
		if (!box) {
			return { x, y };
		}
		return {
			x: Math.max(box.x + RADIUS_NODE, Math.min(x, box.x + box.width - RADIUS_NODE)),
			y: Math.max(box.y + RADIUS_NODE, Math.min(y, box.y + box.height - RADIUS_NODE)),
		};
	}

	private applyKinematicNodeMove(d: any, x: number, y: number) {
		d.x = x;
		d.y = y;
		d.fx = x;
		d.fy = y;
		d.vx = 0;
		d.vy = 0;
		this.graphState.updateNodeCoordinates(d.id, { fx: x, fy: y });
		const nodeEl = this.nodeElementLookup.get(d.id);
		if (nodeEl) {
			nodeEl.setAttribute('transform', `translate(${x},${y})`);
		}
		const incident = this.incidentLinkEnds.get(d.id);
		if (incident) {
			for (const item of incident) {
				if (item.end === 'source') {
					item.el.setAttribute('x1', String(x));
					item.el.setAttribute('y1', String(y));
				} else {
					item.el.setAttribute('x2', String(x));
					item.el.setAttribute('y2', String(y));
				}
			}
		}
	}

	private setGraphDragging(active: boolean, nodeId?: string) {
		this.graphIsDragging = active;
		const svgNode = this.svg?.node?.() as SVGSVGElement | undefined;
		svgNode?.classList.toggle('ikg-is-dragging', active);
		this.nodeElementLookup.forEach((element, id) => {
			element.classList.toggle('is-dragging', Boolean(active && id === nodeId));
		});
	}

	private refreshRenderedNodePaints() {
		this.nodeElementLookup.forEach((element, nodeId) => {
			const core = element.querySelector('.ikg-node-core') as SVGCircleElement | null;
			if (!core) {
				return;
			}
			core.setAttribute('fill', this.identifyColorForNodeCircle(
				nodeId,
				this.rootNodeIds,
				this.currentSelectedNodeId,
				this.searchResultNodeIds,
			));
			core.setAttribute('stroke', this.identifyStrokeForNodeCircle(
				nodeId,
				this.rootNodeIds,
				this.currentSelectedNodeId,
				this.searchResultNodeIds,
			));
			core.setAttribute('stroke-width', nodeId === this.currentSelectedNodeId ? '5' : '3');
			element.classList.toggle('is-selected', nodeId === this.currentSelectedNodeId);
			element.classList.toggle('is-toolbelt-host', nodeId === this.activeNodeToolbeltId);
		});
	}

	private clearRenderedNodeToolbelts() {
		this.nodeElementLookup.forEach((element) => {
			element.querySelectorAll('.ikg-node-toolbelt, .ikg-node-toolbelt-aura').forEach((child) => child.remove());
			element.classList.remove('is-toolbelt-host');
		});
	}

	private attachNodeToolbelt(groupEl: SVGGElement, nodeId: string) {
		const hostSelection = d3.select(groupEl);
		hostSelection.append('circle')
			.attr('class', 'ikg-node-toolbelt-aura')
			.attr('r', RADIUS_NODE + 26)
			.attr('fill', 'rgba(168, 85, 247, 0.08)')
			.attr('stroke', 'rgba(244, 114, 182, 0.55)')
			.attr('stroke-width', 2.5)
			.style('pointer-events', 'none');

		const host = hostSelection.append('g').attr('class', 'ikg-node-toolbelt');
		const actions = this.getNodeActionBubbles(nodeId);
		const bubble = host.selectAll('g')
			.data(actions)
			.join('g')
			.attr('class', 'ikg-node-action-bubble')
			.attr('transform', (action: any) => {
				const angle = (action.angle * Math.PI) / 180;
				const radius = NODE_TOOLBELT_BUBBLE_DISTANCE;
				return `translate(${Math.cos(angle) * radius},${Math.sin(angle) * radius})`;
			})
			.style('cursor', 'pointer')
			.on('click', (event: any, action: any) => {
				event.stopPropagation();
				void this.handleNodeActionBubble(action.key, nodeId);
			});

		bubble.append('circle')
			.attr('r', 24)
			.attr('fill', 'rgba(15, 23, 42, 0.92)')
			.attr('stroke', 'rgba(191, 219, 254, 0.5)')
			.attr('stroke-width', 1.8);

		bubble.append('text')
			.attr('text-anchor', 'middle')
			.attr('alignment-baseline', 'middle')
			.attr('fill', '#fff')
			.attr('font-size', 16)
			.style('pointer-events', 'none')
			.text((action: any) => action.emoji);

		bubble.append('text')
			.attr('y', 38)
			.attr('text-anchor', 'middle')
			.attr('fill', 'rgba(241, 245, 249, 0.92)')
			.attr('font-size', 9)
			.attr('font-weight', 600)
			.style('pointer-events', 'none')
			.text((action: any) => action.label);

		hostSelection.raise();
		groupEl.classList.add('is-toolbelt-host');
	}

	private syncSelectionAndToolbelt(nodeId: string | null) {
		this.clearRenderedNodeToolbelts();
		this.refreshRenderedNodePaints();
		if (!nodeId) {
			return;
		}
		const groupEl = this.nodeElementLookup.get(nodeId);
		if (!groupEl) {
			return;
		}
		this.attachNodeToolbelt(groupEl, nodeId);
	}

	private async refreshGraphAfterInteraction(nodeId: string, options: { focusNode?: boolean } = {}) {
		const { focusNode = true } = options;
		if (this.graphDomMatchesVisibleState() && this.svg) {
			this.syncSelectionAndToolbelt(this.activeNodeToolbeltId ?? nodeId);
			if (focusNode) {
				this.focusOnNode(nodeId);
			}
			return;
		}
		await this.rerenderGraph();
		if (focusNode) {
			this.focusOnNode(nodeId);
		}
	}

	// section 1 ---------------------------- Canvas Application UI
	async onOpen() {
		// config: Create a horizontal split
		const contentEl = this.graphContainerPanel.view.containerEl;
		// config: not create a split, but tops a Modal on top of current UI
		// const {contentEl} = this
		contentEl.empty();
		this.diagnosticsPanelEl = null;
		this.diagnosticsToggleButtonEl = null;
		this.diagnosticsVisible = this.shouldDefaultDiagnosticsBeVisible();
		this.disconnectLayoutObserver();
		this.controlBarEl = null;
		this.controlBarMetaEl = null;
		this.searchInputEl = null;
		this.graphModeButtonEl = null;
		this.mapModeButtonEl = null;
		this.cancelNodeHold();
		this.clearPendingSecondTap();
		this.activeNodeToolbeltId = this.currentSelectedNodeId;
		contentEl.addClass('ikg-graph-host');
		this.displayPanelComponent.renderSelectedNodePanel();
		this.ensureControlBar();
		this.displayPanelComponent.registerActionHandlers({
			onExpandNode: (_event: any, nodeName: string) => {
				this.graphState.markNodeManuallyExpanded(nodeName)
				void this.rerenderGraph()
			},
			onCollapseNode: (_event: any, nodeName: string) => {
				this.graphState.collapseNode(nodeName)
				void this.rerenderGraph()
			},
			onSaveLayout: () => {
				void this.saveVisibleNodeLayout()
			},
			onClickNodeAvatar: (_event: any, nodeName: string) => {
				const found = this.graphState.getNodeById(nodeName)
				if (found?.nodeFilePath) {
					this.openInNewTabByOverridingOtherMarkdownEditor(found.nodeFilePath, this.parentAppContainer)
				}
			},
			onOpenNote: (_event: any, nodeName: string) => {
				const found = this.graphState.getNodeById(nodeName)
				if (found?.nodeFilePath) {
					this.openInNewTabByOverridingOtherMarkdownEditor(found.nodeFilePath, this.parentAppContainer)
				}
			},
			onSaveMapPosition: async (_event: any, nodeName: string, label: string, rawValue: string) => {
				await this.saveMapPositionForNode(nodeName, label, rawValue)
			},
			onDeleteMapPosition: async (_event: any, nodeName: string, positionId: string) => {
				await this.deleteMapPositionForNode(nodeName, positionId)
			},
			onOpenMapPosition: (_event: any, _nodeName: string, position: NodeMapPosition) => {
				window.open(position.url, '_blank', 'noopener')
			},
		})
		await this.renderActiveMode();
		if (this.currentMode === 'graph' && this.currentSelectedNodeId) {
			this.focusOnNode(this.currentSelectedNodeId);
		}
	}

	private shouldRenderNodeLabel(nodeId: string, visibleNodeCount: number) {
		return (
			visibleNodeCount <= this.getLabelRenderThreshold() ||
			nodeId === this.currentSelectedNodeId ||
			this.rootNodeIds.includes(nodeId) ||
			this.searchResultNodeIds.includes(nodeId)
		);
	}

	private shouldRenderNodeImage(nodeId: string, visibleNodeCount: number) {
		return (
			visibleNodeCount <= this.getImageRenderThreshold() ||
			nodeId === this.currentSelectedNodeId ||
			this.rootNodeIds.includes(nodeId) ||
			this.searchResultNodeIds.includes(nodeId)
		);
	}

	private isNodeCollapsed(nodeId: string) {
		return this.graphState.isNodeCollapsed(nodeId);
	}

	private isNodeActivelyExpanded(nodeId: string) {
		return this.graphState.isNodeActivelyExpanded(nodeId);
	}

	private canNodeExpand(nodeId: string) {
		return this.getNodeNeighborCount(nodeId) > 0 && !this.canNodeCollapse(nodeId);
	}

	private canNodeCollapse(nodeId: string) {
		return this.getNodeNeighborCount(nodeId) > 0 && this.isNodeActivelyExpanded(nodeId) && !this.isNodeCollapsed(nodeId);
	}

	private hasNodeBeenManuallyExpanded(nodeId: string) {
		return this.graphState.hasNodeBeenManuallyExpanded(nodeId);
	}

	private canPanelExpand(nodeId: string) {
		return this.getNodeNeighborCount(nodeId) > 0 && !this.hasNodeBeenManuallyExpanded(nodeId);
	}

	private canPanelCollapse(nodeId: string) {
		return this.getNodeNeighborCount(nodeId) > 0 && this.hasNodeBeenManuallyExpanded(nodeId);
	}

	private getNodeNeighborCount(nodeId: string) {
		return this.graphState.getNodeNeighborCount(nodeId);
	}

	private getNodeToolbeltClearanceRadius(nodeId: string) {
		return this.activeNodeToolbeltId === nodeId ? NODE_TOOLBELT_CLEARANCE_RADIUS : 0;
	}

	private getNodeCollisionRadius(nodeId: string, visibleNodeCount: number) {
		const baseRadius = visibleNodeCount > 40 ? 60 : 80;
		return Math.max(baseRadius, this.getNodeToolbeltClearanceRadius(nodeId) + NODE_TOOLBELT_COLLISION_PADDING);
	}

	private clearPendingSecondTap(nodeId?: string) {
		if (!nodeId || this.pendingSecondTapNodeId === nodeId) {
			this.pendingSecondTapNodeId = null;
			this.pendingSecondTapExpiryMs = 0;
		}
	}

	private cancelNodeHold(resetVisual = true) {
		if (this.holdRevealTimeoutHandle) {
			window.clearTimeout(this.holdRevealTimeoutHandle)
			this.holdRevealTimeoutHandle = null
		}
		if (this.holdAnimationFrameHandle) {
			window.cancelAnimationFrame(this.holdAnimationFrameHandle)
			this.holdAnimationFrameHandle = null
		}
		if (resetVisual && this.holdProgressCircleEl) {
			const circumference = 2 * Math.PI * (RADIUS_NODE + 16)
			this.holdProgressCircleEl.style.display = 'none'
			this.holdProgressCircleEl.style.opacity = '0'
			this.holdProgressCircleEl.style.strokeDasharray = `${circumference}`
			this.holdProgressCircleEl.style.strokeDashoffset = `${circumference}`
		}
		this.holdStartedAtMs = null
		this.holdNodeId = null
		this.holdProgressCircleEl = null
	}

	private selectNode(d: any, options: { openNoteOnDesktop?: boolean; focusNode?: boolean } = {}) {
		const { openNoteOnDesktop = true, focusNode = true } = options
		const found = this.nodesData.find((entry: any) => entry.source === d.id)
		if (found) {
			found.fx = d.x
			found.fy = d.y
			this.graphState.updateNodeCoordinates(d.id, { fx: d.x, fy: d.y })
		}

		const isMobile = this.parentAppContainer.isMobile
		const leaves = this.parentAppContainer.workspace.getLeavesOfType('markdown')
		if (openNoteOnDesktop && !isMobile && leaves.length > 0) {
			this.openInNewTabIfTabNotAlreadyOpened(d.nodeFilePath, this.parentAppContainer)
		}
		this.graphState.ensureNodeIsRoot(d.id)
		this.currentSelectedNodeId = d.id
		void this.bootstrapControlPlaneOnCanvas(this.svg)
		if (focusNode) {
			this.focusOnNode(d.id)
		}
	}

	private beginNodeHold(event: any, d: any, nodeElement: SVGGElement) {
		if (event.button != null && event.button !== 0) {
			return
		}
		this.cancelNodeHold()
		this.selectNode(d, { openNoteOnDesktop: false, focusNode: false })
		const ring = nodeElement.querySelector('.ikg-node-hold-ring') as SVGCircleElement | null
		if (!ring) {
			return
		}
		const circumference = 2 * Math.PI * (RADIUS_NODE + 16)
		ring.style.display = 'block'
		ring.style.opacity = '1'
		ring.style.strokeDasharray = `${circumference}`
		ring.style.strokeDashoffset = `${circumference}`
		this.holdNodeId = d.id
		this.holdProgressCircleEl = ring
		this.holdStartedAtMs = performance.now()

		const animate = () => {
			if (this.holdNodeId !== d.id || !this.holdProgressCircleEl || this.holdStartedAtMs == null) {
				return
			}
			const elapsed = performance.now() - this.holdStartedAtMs
			const progress = Math.min(elapsed / NODE_HOLD_REVEAL_MS, 1)
			this.holdProgressCircleEl.style.strokeDashoffset = `${circumference * (1 - progress)}`
			if (progress >= 1) {
				this.suppressNodeClickUntilMs = Date.now() + 240
				this.activeNodeToolbeltId = d.id
				this.cancelNodeHold(false)
				void this.refreshGraphAfterInteraction(d.id, { focusNode: false })
				return
			}
			this.holdAnimationFrameHandle = window.requestAnimationFrame(animate)
		}

		this.holdRevealTimeoutHandle = window.setTimeout(() => {
			this.holdRevealTimeoutHandle = null
		}, NODE_HOLD_REVEAL_MS)
		this.holdAnimationFrameHandle = window.requestAnimationFrame(animate)
	}

	private handleNodePrimaryTap(event: any, d: any) {
		event.stopPropagation()
		this.cancelNodeHold()
		const now = Date.now()
		if (now < this.suppressNodeClickUntilMs) {
			return
		}
		const shouldExpand = this.pendingSecondTapNodeId === d.id && this.pendingSecondTapExpiryMs > now
		this.activeNodeToolbeltId = d.id
		this.selectNode(d, { openNoteOnDesktop: true, focusNode: false })
		if (shouldExpand) {
			this.clearPendingSecondTap(d.id)
			if (this.canPanelExpand(d.id)) {
				this.graphState.markNodeManuallyExpanded(d.id)
			}
			void this.refreshGraphAfterInteraction(d.id)
			return
		}
		this.pendingSecondTapNodeId = d.id
		this.pendingSecondTapExpiryMs = now + NODE_SECOND_TAP_WINDOW_MS
		void this.refreshGraphAfterInteraction(d.id)
	}

	private getNodeActionBubbles(nodeId: string) {
		return [
			{
				key: this.canPanelCollapse(nodeId) ? 'collapse-branch' : 'expand-neighbors',
				emoji: this.canPanelCollapse(nodeId) ? '🌙' : '✨',
				label: this.canPanelCollapse(nodeId) ? 'Collapse' : 'Expand',
				angle: -90,
			},
			{
				key: 'collapse-others',
				emoji: '🍂',
				label: 'Collapse others',
				angle: -20,
			},
			{
				key: 'save-layout',
				emoji: '💾',
				label: 'Save',
				angle: 45,
			},
			{
				key: 'show-markdown',
				emoji: '📜',
				label: 'Loop note',
				angle: 135,
			},
			{
				key: 'show-map',
				emoji: '🗺️',
				label: 'Map',
				angle: 205,
			},
		]
	}

	private async handleNodeActionBubble(actionKey: string, nodeId: string) {
		const found = this.graphState.getNodeById(nodeId)
		if (!found) {
			return
		}
		this.activeNodeToolbeltId = nodeId
		this.currentSelectedNodeId = nodeId
		if (actionKey === 'expand-neighbors') {
			this.graphState.markNodeManuallyExpanded(nodeId)
			await this.rerenderGraph()
			return
		}
		if (actionKey === 'collapse-branch') {
			this.graphState.collapseNode(nodeId)
			await this.rerenderGraph()
			return
		}
		if (actionKey === 'collapse-others') {
			this.graphState.collapseOtherExpandedNodes(nodeId)
			await this.rerenderGraph()
			return
		}
		if (actionKey === 'save-layout') {
			await this.saveVisibleNodeLayout()
			return
		}
		if (actionKey === 'show-markdown') {
			this.openInNewTabByOverridingOtherMarkdownEditor(found.nodeFilePath, this.parentAppContainer)
			return
		}
		if (actionKey === 'show-map') {
			await this.setAppMode('map')
			return
		}
	}

	private async saveVisibleNodeLayout() {
		const visibleNodes = this.graphState.getVisibleNodes()
		let savedCount = 0
		for (const node of visibleNodes) {
			if (node.fx == null || node.fy == null) {
				continue
			}
			await this.saveAndUpdateNodesFxFy({
				nodeFilePath: node.nodeFilePath,
				id: node.source,
				fx: node.fx,
				fy: node.fy,
			})
			savedCount += 1
		}
		new Notice(savedCount > 0 ? `Saved layout for ${savedCount} note${savedCount === 1 ? '' : 's'}.` : 'No visible pinned node positions were ready to save yet.')
	}

	private nodeMatchesCurrentSearch(node: GraphNode) {
		const term = this.graphState.getSearchTerm().trim();
		return term.length === 0 || this.searchResultNodeIds.includes(node.source);
	}

	private getAllLocatedRecords() {
		const records: NodeLocationRecord[] = [];
		for (const node of this.nodesData) {
			for (const position of node.mapPositions ?? []) {
				if (typeof position.lat !== 'number' || typeof position.lng !== 'number') {
					continue;
				}
				records.push({
					node,
					position,
					lat: position.lat,
					lng: position.lng,
				});
			}
		}
		return records;
	}

	private getSelectedNodeLatestLocatedRecord() {
		if (!this.currentSelectedNodeId) {
			return null;
		}
		const selectedRecords = this.getAllLocatedRecords().filter((record) => record.node.source === this.currentSelectedNodeId);
		return selectedRecords.at(-1) ?? null;
	}

	private createMapMarkerIcon(node: GraphNode, isSelected: boolean) {
		const image = node.image ?? defaultAvatar;
		const label = node.source.length > 18 ? `${node.source.slice(0, 18)}…` : node.source;
		return L.divIcon({
			className: '',
			html: `
				<div class="ikg-map-marker${isSelected ? ' is-selected' : ''}">
					<img class="ikg-map-marker__avatar" src="${image}" alt="${label}">
					<div class="ikg-map-marker__label">${label}</div>
				</div>
			`,
			iconSize: [88, 52],
			iconAnchor: [32, 44],
			popupAnchor: [0, -34],
		});
	}

	private createDraftMapMarkerIcon(node: GraphNode | null) {
		const label = node ? (node.source.length > 18 ? `${node.source.slice(0, 18)}…` : node.source) : 'Draft pin';
		return L.divIcon({
			className: '',
			html: `
				<div class="ikg-map-draft-marker">
					<div class="ikg-map-draft-marker__dot"></div>
					<div class="ikg-map-draft-marker__label">${label}</div>
				</div>
			`,
			iconSize: [108, 44],
			iconAnchor: [14, 38],
			popupAnchor: [0, -28],
		});
	}

	private async searchMapAddresses(rawQuery: string) {
		const query = rawQuery.trim();
		this.mapAddressSearchQuery = rawQuery;
		if (!query) {
			this.mapAddressSearchResults = [];
			this.mapAddressSearchLoading = false;
			this.refreshMapModeFromState();
			return;
		}

		this.mapAddressSearchAbortController?.abort();
		const abortController = new AbortController();
		this.mapAddressSearchAbortController = abortController;
		this.mapAddressSearchLoading = true;
		this.refreshMapModeFromState();

		try {
			const primaryResults = await this.fetchNominatimAddressResults(query, abortController.signal);
			if (primaryResults.length > 0) {
				this.mapAddressSearchResults = primaryResults;
			} else {
				this.mapAddressSearchResults = await this.fetchPostalCodeFallbackResults(query, abortController.signal);
			}
		} catch (error: any) {
			if (error?.name !== 'AbortError') {
				console.error('Address search failed', error);
				new Notice('Address search failed. Try another query in a moment.');
			}
		} finally {
			if (this.mapAddressSearchAbortController === abortController) {
				this.mapAddressSearchAbortController = null;
				this.mapAddressSearchLoading = false;
			}
			this.refreshMapModeFromState();
		}
	}

	private async fetchNominatimAddressResults(query: string, signal: AbortSignal) {
		const searchUrl = new URL('https://nominatim.openstreetmap.org/search');
		searchUrl.searchParams.set('q', query);
		searchUrl.searchParams.set('format', 'jsonv2');
		searchUrl.searchParams.set('limit', '6');
		searchUrl.searchParams.set('addressdetails', '1');

		const response = await fetch(searchUrl.toString(), {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
			},
			signal,
		});

		if (!response.ok) {
			throw new Error(`Address search failed with HTTP ${response.status}`);
		}

		const payload = await response.json();
		const results = Array.isArray(payload) ? payload : [];
		return results
			.map((entry: any, index: number) => this.buildMapAddressSearchResultFromGeocoder(entry, query, index))
			.filter((result: MapAddressSearchResult | null): result is MapAddressSearchResult => result !== null);
	}

	private async fetchPostalCodeFallbackResults(query: string, signal: AbortSignal) {
		const normalized = query.trim().toUpperCase().replace(/\s+/g, '');
		const fallbackTargets: Array<{ country: string; postalCode: string }> = [];

		if (/^\d{5}(?:-\d{4})?$/.test(normalized)) {
			fallbackTargets.push({ country: 'us', postalCode: normalized.slice(0, 5) });
		}

		if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalized)) {
			fallbackTargets.push({ country: 'ca', postalCode: normalized });
		}

		const fallbackResults: MapAddressSearchResult[] = [];
		for (const target of fallbackTargets) {
			const response = await fetch(`https://api.zippopotam.us/${target.country}/${target.postalCode}`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
				},
				signal,
			});

			if (!response.ok) {
				continue;
			}

			const payload = await response.json();
			const places = Array.isArray(payload?.places) ? payload.places : [];
			for (const [index, place] of places.entries()) {
				const lat = Number.parseFloat(String(place?.latitude ?? ''));
				const lng = Number.parseFloat(String(place?.longitude ?? ''));
				if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
					continue;
				}

				const placeName = String(place?.['place name'] ?? payload?.['post code'] ?? query);
				const state = String(place?.state ?? place?.['state abbreviation'] ?? '').trim();
				const country = String(payload?.country ?? target.country.toUpperCase()).trim();
				const subtitleParts = [payload?.['post code'], state, country].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
				fallbackResults.push({
					id: `${target.country}-${target.postalCode}-${index}`,
					title: placeName,
					subtitle: subtitleParts.join(' • '),
					lat,
					lng,
				});
			}
		}

		return fallbackResults;
	}

	private buildMapAddressSearchResultFromGeocoder(entry: any, query: string, index: number): MapAddressSearchResult | null {
		const lat = Number.parseFloat(String(entry?.lat ?? ''));
		const lng = Number.parseFloat(String(entry?.lon ?? ''));
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return null;
		}
		const displayName = String(entry?.display_name ?? query);
		const name = String(entry?.name ?? '').trim();
		const title = name || displayName.split(',')[0]?.trim() || query;
		const subtitle = displayName === title ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : displayName;
		return {
			id: String(entry?.place_id ?? `${query}-${index}`),
			title,
			subtitle,
			lat,
			lng,
		};
	}

	private chooseMapAddressSearchResult(result: MapAddressSearchResult) {
		this.mapDraftLatLng = { lat: result.lat, lng: result.lng };
		if (this.mapDraftValueInputEl) {
			this.mapDraftValueInputEl.value = `${result.lat.toFixed(6)},${result.lng.toFixed(6)}`;
		}
		if (this.mapDraftLabelInputEl && !this.mapDraftLabelInputEl.value.trim()) {
			this.mapDraftLabelInputEl.value = result.title;
		}
		this.mapShouldAutoFrame = false;
		this.mapAutoFrameNodeId = null;
		this.mapInstance?.setView([result.lat, result.lng], Math.max(this.mapInstance?.getZoom() ?? MAP_MODE_DEFAULT_ZOOM, 16), {
			animate: false,
		});
		this.refreshMapModeFromState();
	}

	private createMapModeShell() {
		if (this.mapModeRootEl?.isConnected && this.mapModeCanvasEl && this.mapModeSidebarEl) {
			return;
		}
		const contentEl = this.graphContainerPanel.view.containerEl;
		this.destroyMapMode();

		const root = contentEl.createDiv({ cls: 'ikg-map-mode' });
		const canvas = root.createDiv({ cls: 'ikg-map-mode__canvas' });
		const sidebar = root.createDiv({ cls: 'ikg-map-mode__sidebar' });
		const { body: searchBody } = this.buildMapUtilityCard(root, {
			sectionKey: 'address-search',
			eyebrow: 'Address search',
			title: 'Jump to a place',
			mobileDefaultExpanded: false,
			extraClasses: ['ikg-map-mode__search-card'],
		});
		searchBody.createDiv({ cls: 'ikg-map-mode__card-copy', text: 'Search an address, jump there, then save the red draft pin onto the selected node.' });
		const searchForm = searchBody.createDiv({ cls: 'ikg-map-mode__compose' });
		const addressSearchInput = searchForm.createEl('input', {
			type: 'search',
			placeholder: 'Search address or place…',
			cls: 'ikg-map-mode__input',
		});
		addressSearchInput.value = this.mapAddressSearchQuery;
		const searchActions = searchForm.createDiv({ cls: 'ikg-map-mode__actions' });
		const addressSearchButton = searchActions.createEl('button', { text: 'Find address' });
		const clearAddressSearchButton = searchActions.createEl('button', { text: 'Clear results' });
		const searchStatus = searchBody.createDiv({ cls: 'ikg-map-mode__card-copy', text: 'Existing node pins stay visible while you jump around the map.' });
		const addressResults = searchBody.createDiv({ cls: 'ikg-map-mode__list ikg-map-mode__address-results' });
		const submitAddressSearch = () => {
			this.mapAddressSearchQuery = addressSearchInput.value;
			void this.searchMapAddresses(addressSearchInput.value);
		};
		addressSearchInput.addEventListener('keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				submitAddressSearch();
			}
		});
		addressSearchButton.addEventListener('click', () => {
			submitAddressSearch();
		});
		clearAddressSearchButton.addEventListener('click', () => {
			this.mapAddressSearchQuery = '';
			this.mapAddressSearchResults = [];
			addressSearchInput.value = '';
			this.refreshMapModeFromState();
		});

		const { body: selectedBody } = this.buildMapUtilityCard(sidebar, {
			sectionKey: 'selected-node',
			eyebrow: 'Selected node',
			title: 'Pin details and save',
			mobileDefaultExpanded: true,
		});
		const selectedTitle = selectedBody.createDiv({ cls: 'ikg-map-mode__card-title', text: 'Pick a node' });
		const selectedMeta = selectedBody.createDiv({ cls: 'ikg-map-mode__card-copy', text: 'Click any node marker or choose a node from the lists below.' });
		const composeHint = selectedBody.createDiv({ cls: 'ikg-map-mode__card-copy', text: 'Click on the map to draft a new latitude/longitude pin for the selected node.' });

		const composeForm = selectedBody.createDiv({ cls: 'ikg-map-mode__compose' });
		const labelInput = composeForm.createEl('input', {
			type: 'text',
			placeholder: 'Pin label',
			cls: 'ikg-map-mode__input',
		});
		const valueInput = composeForm.createEl('input', {
			type: 'text',
			placeholder: 'Google Maps URL or lat,lng',
			cls: 'ikg-map-mode__input',
		});
		const composeActions = composeForm.createDiv({ cls: 'ikg-map-mode__actions' });
		const useCenterButton = composeActions.createEl('button', { text: 'Use map center' });
		useCenterButton.addEventListener('click', () => {
			if (!this.mapInstance) {
				return;
			}
			const center = this.mapInstance.getCenter();
			this.mapDraftLatLng = { lat: center.lat, lng: center.lng };
			if (this.mapDraftValueInputEl) {
				this.mapDraftValueInputEl.value = `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`;
			}
			this.refreshMapModeFromState();
		});
		const saveButton = composeActions.createEl('button', { cls: 'mod-cta', text: 'Save position' });
		const submitDraft = async () => {
			if (!this.currentSelectedNodeId) {
				new Notice('Select a node first, then save its map position.');
				return;
			}
			await this.saveMapPositionForNode(
				this.currentSelectedNodeId,
				this.mapDraftLabelInputEl?.value ?? '',
				this.mapDraftValueInputEl?.value ?? ''
			);
		};
		saveButton.addEventListener('click', () => {
			void submitDraft();
		});
		valueInput.addEventListener('keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void submitDraft();
			}
		});

		const { body: locatedBody } = this.buildMapUtilityCard(sidebar, {
			sectionKey: 'mapped-nodes',
			eyebrow: 'Mapped nodes',
			title: 'Saved map pins',
			mobileDefaultExpanded: false,
		});
		const nodeCount = locatedBody.createDiv({ cls: 'ikg-map-mode__card-title', text: '0 saved map pins' });
		const locatedList = locatedBody.createDiv({ cls: 'ikg-map-mode__list' });

		const { body: unlocatedBody } = this.buildMapUtilityCard(sidebar, {
			sectionKey: 'nodes-needing-locations',
			eyebrow: 'Nodes needing locations',
			title: 'Pick a node to pin',
			mobileDefaultExpanded: false,
		});
		unlocatedBody.createDiv({ cls: 'ikg-map-mode__card-copy', text: 'Search with the top bar, then click a node here to target it for a new pin.' });
		const unlocatedList = unlocatedBody.createDiv({ cls: 'ikg-map-mode__list' });

		this.mapModeRootEl = root;
		this.mapModeCanvasEl = canvas;
		this.mapModeSidebarEl = sidebar;
		this.mapNodeCountEl = nodeCount;
		this.mapSelectionTitleEl = selectedTitle;
		this.mapSelectionMetaEl = selectedMeta;
		this.mapSearchInputEl = addressSearchInput;
		this.mapSearchStatusEl = searchStatus;
		this.mapSearchResultsEl = addressResults;
		this.mapDraftLabelInputEl = labelInput;
		this.mapDraftValueInputEl = valueInput;
		this.mapLocatedListEl = locatedList;
		this.mapUnlocatedListEl = unlocatedList;
		this.installMapGestureShield();
		this.scheduleOverlayLayoutSync();

		void composeHint;
	}

	private refreshMapModeFromState() {
		if (this.currentMode !== 'map') {
			return;
		}
		void this.renderMapMode();
	}

	private async renderMapMode() {
		this.createMapModeShell();
		if (!this.mapModeCanvasEl || !this.mapLocatedListEl || !this.mapUnlocatedListEl || !this.mapSelectionTitleEl || !this.mapSelectionMetaEl || !this.mapNodeCountEl || !this.mapSearchStatusEl || !this.mapSearchResultsEl) {
			return;
		}

		if (!this.mapInstance) {
			this.mapInstance = L.map(this.mapModeCanvasEl, {
				center: MAP_MODE_DEFAULT_CENTER,
				zoom: MAP_MODE_DEFAULT_ZOOM,
				maxZoom: MAP_MODE_MAX_ZOOM,
				worldCopyJump: true,
				zoomControl: true,
			});
			const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors',
				maxNativeZoom: 19,
				maxZoom: MAP_MODE_MAX_ZOOM,
			});
			const topoLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
				attribution: 'Tiles &copy; Esri, HERE, Garmin, FAO, NOAA, USGS',
				maxNativeZoom: 19,
				maxZoom: MAP_MODE_MAX_ZOOM,
			});
			const voyagerLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; CARTO, &copy; OpenStreetMap contributors',
				maxNativeZoom: 20,
				maxZoom: MAP_MODE_MAX_ZOOM,
			});
			const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
				attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
				maxNativeZoom: 19,
				maxZoom: MAP_MODE_MAX_ZOOM,
			});
			const hybridLabelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
				attribution: 'Labels &copy; Esri',
				maxNativeZoom: 19,
				maxZoom: MAP_MODE_MAX_ZOOM,
			});
			const hybridLayer = L.layerGroup([satelliteLayer, hybridLabelsLayer]);
			streetLayer.addTo(this.mapInstance);
			this.mapLayerControl = L.control.layers(
				{
					Streets: streetLayer,
					'Topo+': topoLayer,
					Voyager: voyagerLayer,
					Satellite: satelliteLayer,
					Hybrid: hybridLayer,
				},
				{},
				{ position: 'topright' }
			).addTo(this.mapInstance);
			this.mapMarkerLayer = L.layerGroup().addTo(this.mapInstance);
			this.mapInstance.on('click', (event: L.LeafletMouseEvent) => {
				this.mapDraftLatLng = { lat: event.latlng.lat, lng: event.latlng.lng };
				if (this.mapDraftValueInputEl) {
					this.mapDraftValueInputEl.value = `${event.latlng.lat.toFixed(6)},${event.latlng.lng.toFixed(6)}`;
				}
				this.refreshMapModeFromState();
			});
		}
		this.scheduleOverlayLayoutSync();

		const locatedRecords = this.getAllLocatedRecords().filter((record) => this.nodeMatchesCurrentSearch(record.node));
		const unlocatedNodes = this.nodesData.filter((node) => {
			const hasLatLng = (node.mapPositions ?? []).some((position) => typeof position.lat === 'number' && typeof position.lng === 'number');
			return !hasLatLng && this.nodeMatchesCurrentSearch(node);
		});
		const selectedNode = this.currentSelectedNodeId ? this.graphState.getNodeById(this.currentSelectedNodeId) : null;
		const selectedRecord = this.getSelectedNodeLatestLocatedRecord();
		const autoFrameRecord = this.mapAutoFrameNodeId
			? this.getAllLocatedRecords().filter((record) => record.node.source === this.mapAutoFrameNodeId).at(-1) ?? null
			: selectedRecord;

		this.mapSelectionTitleEl.setText(selectedNode?.source ?? 'Pick a node');
		this.mapSelectionMetaEl.setText(
			selectedNode
				? `${selectedNode.nodeFilePath} • ${(selectedNode.mapPositions ?? []).length} saved map position${(selectedNode.mapPositions ?? []).length === 1 ? '' : 's'}`
				: 'Choose a node from the graph, a marker, or the table to start saving locations.'
		);
		this.mapNodeCountEl.setText(`${locatedRecords.length} saved map pin${locatedRecords.length === 1 ? '' : 's'} across ${new Set(locatedRecords.map((record) => record.node.source)).size} nodes`);
		this.mapSearchStatusEl.setText(
			this.mapAddressSearchLoading
				? 'Searching addresses…'
				: this.mapAddressSearchResults.length > 0
					? `${this.mapAddressSearchResults.length} address result${this.mapAddressSearchResults.length === 1 ? '' : 's'} ready. Tap one to move the red draft pin there.`
					: this.mapAddressSearchQuery.trim().length > 0
						? 'No address matches yet. Try a broader place name or a fuller street address.'
						: 'Existing node pins stay visible while you jump around the map.'
		);

		if (this.mapDraftValueInputEl && !this.mapDraftValueInputEl.matches(':focus') && this.mapDraftLatLng) {
			this.mapDraftValueInputEl.value = `${this.mapDraftLatLng.lat.toFixed(6)},${this.mapDraftLatLng.lng.toFixed(6)}`;
		}
		if (selectedNode && this.mapDraftLabelInputEl && !this.mapDraftLabelInputEl.value) {
			this.mapDraftLabelInputEl.placeholder = `Pin label for ${selectedNode.source}`;
		}

		this.mapSearchResultsEl.empty();
		if (this.mapAddressSearchLoading) {
			this.mapSearchResultsEl.createDiv({ cls: 'ikg-map-mode__empty', text: 'Looking up matching addresses…' });
		} else if (this.mapAddressSearchResults.length === 0) {
			this.mapSearchResultsEl.createDiv({ cls: 'ikg-map-mode__empty', text: 'Search for a place, address, or landmark to drop the draft pin there quickly.' });
		} else {
			for (const result of this.mapAddressSearchResults) {
				const item = this.mapSearchResultsEl.createDiv({ cls: 'ikg-map-mode__list-item' });
				item.createDiv({ cls: 'ikg-map-mode__list-title', text: result.title });
				item.createDiv({ cls: 'ikg-map-mode__list-copy', text: result.subtitle });
				item.addEventListener('click', () => {
					this.chooseMapAddressSearchResult(result);
				});
			}
		}

		this.mapLocatedListEl.empty();
		if (locatedRecords.length === 0) {
			this.mapLocatedListEl.createDiv({ cls: 'ikg-map-mode__empty', text: 'No saved map pins yet. Select a node and click on the map to create the first one.' });
		} else {
			for (const record of locatedRecords) {
				const item = this.mapLocatedListEl.createDiv({ cls: 'ikg-map-mode__list-item' });
				if (record.node.source === this.currentSelectedNodeId) {
					item.addClass('is-selected');
				}
				item.createDiv({ cls: 'ikg-map-mode__list-title', text: `${record.node.source} • ${record.position.label}` });
				item.createDiv({ cls: 'ikg-map-mode__list-copy', text: `${record.lat.toFixed(5)}, ${record.lng.toFixed(5)}` });
				item.addEventListener('click', () => {
					this.currentSelectedNodeId = record.node.source;
					this.mapDraftLatLng = { lat: record.lat, lng: record.lng };
					this.queueMapAutoFrame(record.node.source);
					void this.renderMapMode();
				});
			}
		}

		this.mapUnlocatedListEl.empty();
		if (unlocatedNodes.length === 0) {
			this.mapUnlocatedListEl.createDiv({ cls: 'ikg-map-mode__empty', text: 'Every matching node already has at least one map pin.' });
		} else {
			for (const node of unlocatedNodes) {
				const item = this.mapUnlocatedListEl.createDiv({ cls: 'ikg-map-mode__list-item' });
				if (node.source === this.currentSelectedNodeId) {
					item.addClass('is-selected');
				}
				item.createDiv({ cls: 'ikg-map-mode__list-title', text: node.source });
				item.createDiv({ cls: 'ikg-map-mode__list-copy', text: node.nodeFilePath });
				item.addEventListener('click', () => {
					this.currentSelectedNodeId = node.source;
					this.mapDraftLatLng = null;
					if (this.mapDraftValueInputEl) {
						this.mapDraftValueInputEl.value = '';
					}
					void this.renderMapMode();
				});
			}
		}

		this.mapMarkerLayer?.clearLayers();
		const bounds = L.latLngBounds([]);
		for (const record of locatedRecords) {
			const marker = L.marker([record.lat, record.lng], {
				icon: this.createMapMarkerIcon(record.node, record.node.source === this.currentSelectedNodeId),
			});
			marker.bindPopup(`
				<div class="ikg-map-popup">
					<div class="ikg-map-popup__title">${record.node.source}</div>
					<div class="ikg-map-popup__copy">${record.position.label}</div>
					<div class="ikg-map-popup__copy">${record.lat.toFixed(5)}, ${record.lng.toFixed(5)}</div>
				</div>
			`);
			marker.on('click', () => {
				this.currentSelectedNodeId = record.node.source;
				this.mapDraftLatLng = { lat: record.lat, lng: record.lng };
				this.queueMapAutoFrame(record.node.source);
				void this.renderMapMode();
			});
			this.mapMarkerLayer?.addLayer(marker);
			bounds.extend([record.lat, record.lng]);
		}

		if (this.mapDraftMarker) {
			this.mapMarkerLayer?.removeLayer(this.mapDraftMarker);
			this.mapDraftMarker = null;
		}
		if (this.mapDraftLatLng) {
			this.mapDraftMarker = L.marker([this.mapDraftLatLng.lat, this.mapDraftLatLng.lng], {
				icon: this.createDraftMapMarkerIcon(selectedNode ?? null),
				zIndexOffset: 1000,
			});
			this.mapDraftMarker.bindTooltip('Draft pin', { permanent: false, direction: 'top' });
			this.mapMarkerLayer?.addLayer(this.mapDraftMarker);
		}

		const map = this.mapInstance;
		if (!map) {
			return;
		}
		if (this.mapShouldAutoFrame) {
			if (autoFrameRecord) {
				map.setView([autoFrameRecord.lat, autoFrameRecord.lng], MAP_MODE_FOCUS_ZOOM, { animate: false });
			} else if (bounds.isValid()) {
				map.fitBounds(bounds.pad(0.18));
			} else {
				map.setView(MAP_MODE_DEFAULT_CENTER, MAP_MODE_DEFAULT_ZOOM);
			}
			this.mapShouldAutoFrame = false;
			this.mapAutoFrameNodeId = null;
		}

		window.setTimeout(() => {
			map.invalidateSize();
		}, 0);
	}

	// section 2 ---------------------------- Graph Nodes/Links Renders and Behaviors
	async bootstrapCanvasGraphDisplay() {
		// config: Create a horizontal split
		const contentEl = this.graphContainerPanel.view.containerEl;
		// config: not create a split, but tops a Modal on top of current UI
		// const {contentEl} = this

		// Option: Don't use from Cache
		const svg = d3.select(contentEl)
				.append('svg')
				.attr('width', '100%')
				.attr('height', '100%')
				.attr('viewBox', '0 0 800 600')
				.attr('preserveAspectRatio', 'xMidYMid meet')
 				.style('z-index', '0')
				.classed('ikg-graph-svg', true);
		this.svg = svg

		// Ensure correct scaling
		const width = SVG_WIDTH;
		const height = SVG_HEIGHT;
		const visibleLinks = this.graphState.getVisibleLinks();
		const links = this.uniqueJsonArray(visibleLinks).map(
			d => Object.create(d)
		);
		const nodesById = new Map<string, any>();
		const visibleNodes = this.graphState.getVisibleNodes();
		visibleNodes.forEach((d: any) => {
			if (!nodesById.has(d.source)) {
				nodesById.set(d.source, {
					id: d.source,
					image: d.image ?? defaultAvatar,
					nodeFilePath: d.nodeFilePath,
					fx: d.fx,
					fy: d.fy,
					x: d.x,
					y: d.y,
					vx: d.vx,
					vy: d.vy,
				});
			}
		});
		const nodes = Array.from(nodesById.values());

		const boxedNodes: any = {};
		const visibleNodeCount = nodes.length;
		const visibleLinkCount = links.length;
		const litePaint = this.shouldUseLiteGraphPaint(visibleNodeCount);
		const allNodesPinned = nodes.length > 0 && nodes.every((node: any) => node.fx != null && node.fy != null);
		const shouldRenderDecorations = !litePaint && visibleNodeCount <= this.DECORATION_RENDER_THRESHOLD;
		const renderedLabelCount = nodes.filter((node: any) => this.shouldRenderNodeLabel(node.id, visibleNodeCount)).length;
		const renderedImageCount = nodes.filter((node: any) => this.shouldRenderNodeImage(node.id, visibleNodeCount)).length;
		const renderMode = litePaint
			? 'lite-paint'
			: visibleNodeCount > this.getLabelRenderThreshold() ? 'compact-rich' : 'full-detail';
		svg.classed('ikg-lite-paint', litePaint);
		this.liteGraphPaint = litePaint;
		this.renderedVisibleNodeCount = visibleNodeCount;
		this.simulationSettled = false;

		box_encapsulations.forEach(box => {
			box.Nodes.forEach((nodeId: string) => {
				boxedNodes[nodeId] = box;
			});
		});
		this.boxedNodesLookup = boxedNodes;

		function boxConstraintForce(boxedNodesDataset: any) {
			return function(_alpha: any) {
				nodes.forEach(node => {
					const box = boxedNodesDataset[node.id];
					if (box) {
						node.x = Math.max(box.x + RADIUS_NODE, Math.min(node.x, box.x + box.width - RADIUS_NODE));
						node.y = Math.max(box.y + RADIUS_NODE, Math.min(node.y, box.y + box.height - RADIUS_NODE));
					}
				});
			};
		}

		const chargeForce = d3.forceManyBody()
			.strength(visibleNodeCount > 40 ? -90 : -220)
			.theta(litePaint ? 0.95 : 0.9)
			.distanceMax(litePaint ? 280 : 420);
		const collideForce = d3.forceCollide()
			.radius((node: any) => this.getNodeCollisionRadius(node.id, visibleNodeCount))
			.strength(1)
			.iterations(litePaint ? 1 : 2);

		// bookmark__Simulation Configuration
		const simulation = d3.forceSimulation(nodes)
			.force('link',
				d3.forceLink(links)
				.distance(() => visibleNodeCount > 40 ? 75 : 100)
				.id((d: any) => d.id)
				.strength(0.1)
			)
			.force('charge', chargeForce)
			.force('collide', collideForce);
		if (Object.keys(boxedNodes).length > 0) {
			simulation.force('boxConstraint', boxConstraintForce(boxedNodes));
		}
		simulation.alphaDecay(litePaint || visibleNodeCount > 40 ? 0.4 : 0.2);
		simulation.velocityDecay(litePaint ? 0.55 : 0.4);
		simulation.stop();
		this.simulation = simulation;
		this.renderedNodeLookup = new Map(nodes.map((node: any) => [node.id, node]));
		this.updateDiagnosticsPanel({
			visibleNodes: visibleNodeCount,
			visibleLinks: visibleLinkCount,
			renderedLabels: renderedLabelCount,
			renderedImages: renderedImageCount,
			selectedNodeId: this.currentSelectedNodeId,
			rootNodeCount: this.rootNodeIds.length,
			collapsedNodeCount: this.collapsedNodeIds.length,
			searchResultCount: this.searchResultNodeIds.length,
			renderMode,
			simulationStatus: allNodesPinned ? 'pinned-static' : 'starting',
			alpha: simulation.alpha(),
		});

		// bookmark__Add Custom-Shape-definitions: Arrow-Marks, etc
		svg.append('defs')
			.append('marker')
			.attr('id', 'arrowhead')
			.attr('markerWidth', 40)
			.attr('markerHeight', 40)
			.attr('refX', 0)
			.attr('refY', 20)
			.attr('orient', 'auto')
			.attr('markerUnits', 'strokeWidth')
			.append('polygon')
			.attr('points', '0 0, 40 20, 0 40')
			.attr('fill', 'black');
		// Define an arrow marker for the end of each axis
		svg.append('defs')
			.append('marker')
			.attr('id', 'arrow')
			.attr('viewBox', '0 0 10 10')
			.attr('refX', 5)
			.attr('refY', 5)
			.attr('markerWidth', 6)
			.attr('markerHeight', 6)
			.attr('orient', 'auto-start-reverse')
			.append('path')
			.attr('d', 'M 0 0 L 10 5 L 0 10 z')
			.attr('fill', 'white');  


		const zoomableGraphContainer = svg.append('g')
			.attr('background-color', 'gray');

		// Zoom Behavior
		const zoomBehavior = d3.zoom()
			.scaleExtent([0.1, 3])
			.on('zoom', (event: { transform: any; }) => {
				zoomableGraphContainer.attr("transform", event.transform)
				this.currentTransform = event.transform
			})
			.filter(function(event) {
			  	// Disable double-click to zoom behavior by using .filter()
				// Only allow zooming with wheel or touch, not double click/tap
				return !event || (event.type !== 'dblclick');
			});
		svg.call(zoomBehavior)
		svg.call(zoomBehavior.transform, this.currentTransform);
		this.zoomBehavior = zoomBehavior
		svg.on('click', (event: any) => {
			if (event.target !== svg.node()) {
				return
			}
			this.cancelNodeHold()
			if (this.activeNodeToolbeltId) {
				this.activeNodeToolbeltId = null
				this.syncSelectionAndToolbelt(null)
			}
		})

		// bookmark__Render Relationship-Link On UI
		const link = zoomableGraphContainer.append('g')
			.attr('stroke', 'rgba(149, 193, 255, 0.72)')
			.attr('stroke-opacity', 0.9)
			.attr('stroke-width', visibleNodeCount > 40 ? 1.5 : 2.4)
			.attr('marker-end', "url(#arrowhead)")
			.selectAll('line')
			.data(links)
			.join('line');

		// bookmark__Render_rectangles_groupping_nodes
		// const boxes = zoomableGraphContainer.append('g')
		// 	.selectAll('rect')
		// 	.data(box_encapsulations)
		// 	.join('rect')
		// 	.attr('x', d => d.x)
		// 	.attr('y', d => d.y)
		// 	.attr('width', d => d.width)
		// 	.attr('height', d => d.height)
		// 	.attr('stroke', d => d.strokeColor)
		// 	.attr('stroke-width', 2);

		// Add rectangle groups for each encapsulation box
		if (shouldRenderDecorations) {
			zoomableGraphContainer.append('g')
				.selectAll('rect')
				.data(box_encapsulations)
				.join('rect')
				.attr('x', d => d.x)
				.attr('y', d => d.y)
				.attr('width', d => d.width)
				.attr('height', d => d.height)
				.attr('fill', 'none')
				.attr('stroke', 'orange')
				.attr('stroke-width', 20)
				// @ts-ignore
				.call(dragBoundingBoxesBehavior(nodes, boxedNodes));
		}

		function dragBoundingBoxesBehavior(nodesDataRef: any[], boxedNodesScoped: any) {
			function dragstarted(event: any, d: any) {
				if (!event.active) simulation.alphaTarget(0);
				d3.select(this).raise().attr('stroke', 'red');  // Highlight the box when dragging starts
			}
			function dragged(event: any, d: any) {
				d.x += event.dx;
				d.y += event.dy;
				d3.select(this)
					.attr('x', d.x)
					.attr('y', d.y);

				// Move all nodes inside the box accordingly
				nodesDataRef.forEach((nodeObjScoped: any) => {
					if (boxedNodesScoped[nodeObjScoped.id] && boxedNodesScoped[nodeObjScoped.id].Id === d.Id) {
						if (nodeObjScoped.fx && nodeObjScoped.fy) {
							nodeObjScoped.fx += event.dx;
							nodeObjScoped.fy += event.dy;
						} else if (nodeObjScoped.x && nodeObjScoped.y) {
							nodeObjScoped.fx = nodeObjScoped.x + event.dx;
							nodeObjScoped.fy = nodeObjScoped.y + event.dy;
						} else {
							console.log(
								"When you start-drag the rectangle, the nodes within rectangle might not be updating locations properly."
							)
						}
					}
				});

				// Restart the simulation to reflect updated node positions
				// simulation.alpha(1).restart();
			}
			function dragended(event: any, d: any) {
				d3.select(this).attr('stroke', 'black');
			}
			return d3.drag()
				.on('start', dragstarted)
				.on('drag', dragged)
				.on('end', dragended);
		}
		
		if (shouldRenderDecorations) {
			// Draw the Oy axis line (vertical)
			zoomableGraphContainer.append('line')
				.attr('x1', 0)
				.attr('y1', 0)
				.attr('x2', 0)
				.attr('y2', 0.8 * height)
				.attr('stroke', 'lightgreen')
				.attr('stroke-width', 2)
				.attr('marker-end', 'url(#arrow)');

			// Draw the Ox axis line (horizontal)
			zoomableGraphContainer.append('line')
				.attr('x1', 0)
				.attr('y1', 0)
				.attr('x2', 0.8 * width)
				.attr('y2', 0)
				.attr('stroke', 'lightblue')
				.attr('stroke-width', 2)
				.attr('marker-end', 'url(#arrow)');
		}



		// bookmark__Render Node-Ball On UI
		const node = zoomableGraphContainer.append('g')
			.attr('stroke', '#fff')
			.attr('stroke-width', 1.5)
			.selectAll('g')
			.data(nodes)
			.join('g')
			.attr('class', (d: { id: string }) => `ikg-node-group${d.id === this.currentSelectedNodeId ? ' is-selected' : ''}`)
			.attr('data-box', d => boxedNodes[d.id] ? boxedNodes[d.id].Id : null)
			.attr('data-node-id', (d: { id: string }) => d.id)
			// @ts-ignore
			.call(this.createNodeDragHandler(simulation))
			.on('pointerdown', (event: any, d: any) => {
				event.stopPropagation()
				this.beginNodeHold(event, d, event.currentTarget as SVGGElement)
			})
			.on('pointerup', () => this.cancelNodeHold())
			.on('pointerleave', () => this.cancelNodeHold())
			.on('pointercancel', () => this.cancelNodeHold())
			.on('click', (event: any, d: any) => this.handleNodePrimaryTap(event, d));

		this.graphNodeSelection = node;
		this.graphLinkSelection = link;
		this.nodeElementLookup = new Map();
		node.each((d: { id: string }, index: number, groups: any) => {
			this.nodeElementLookup.set(d.id, groups[index] as SVGGElement);
		});
		this.indexIncidentLinks();

		node.append('circle')
			.attr('class', 'ikg-node-hold-ring')
			.attr('r', RADIUS_NODE + 16)
			.attr('fill', 'none')
			.attr('stroke', 'rgba(244, 114, 182, 0.95)')
			.attr('stroke-width', 6)
			.attr('stroke-linecap', 'round')
			.attr('transform', 'rotate(-90)')
			.style('opacity', 0)
			.style('display', 'none')
			.style('pointer-events', 'none');

		node.append('circle')
			.attr('class', 'ikg-node-core')
			.attr('r', RADIUS_NODE)
			.attr('stroke', (d: { id: any; }) => this.identifyStrokeForNodeCircle(d.id, this.rootNodeIds, this.currentSelectedNodeId, this.searchResultNodeIds))
			.attr('stroke-width', (d: { id: any; }) => d.id === this.currentSelectedNodeId ? 5 : 3)
			.attr('fill', (d: { id: any; }) =>
				this.identifyColorForNodeCircle(
					d.id,
					this.rootNodeIds,
					this.currentSelectedNodeId,
					this.searchResultNodeIds)
			);

		node.filter((d: { id: string; }) => this.shouldRenderNodeLabel(d.id, visibleNodeCount))
			.append('rect')
			.attr('width', WIDTH_NODE_TITLE_BAR + 36)
			.attr('height', HEIGHT_NODE_TITLE_BAR + 8)
			.attr('rx', 16)
			.attr('ry', 16)
			.attr('x', -(WIDTH_NODE_TITLE_BAR + 28) / 2)
			.attr('y', RADIUS_NODE + 10)
			.attr('fill', 'rgba(15, 23, 42, 0.64)')
			.attr('stroke', 'rgba(191, 219, 254, 0.16)')
			.attr('stroke-width', 1);

		node.filter((d: { id: string; }) => this.shouldRenderNodeImage(d.id, visibleNodeCount))
			.append('image')
			.attr('clip-path', 'circle(40px at center)')
			.attr('xlink:href', (d: { image: any; }) => d.image ?? defaultAvatar)
			.attr('x', -NODE_IMAGE_SIZE / 2)
			.attr('y', -NODE_IMAGE_SIZE / 2)
			.attr('width', NODE_IMAGE_SIZE)
			.attr('height', NODE_IMAGE_SIZE)
			.style('pointer-events', 'none');

		const labelText = node.filter((d: { id: string; }) => this.shouldRenderNodeLabel(d.id, visibleNodeCount))
			.append('text')
			.attr('x', 0)
			.attr('y', RADIUS_NODE + HEIGHT_NODE_TITLE_BAR / 2 + 10)
			.attr('text-anchor', 'middle')
			.attr('alignment-baseline', 'middle')
			.attr('fill', 'rgba(248, 250, 252, 0.96)')
			.attr('stroke', 'rgba(15, 23, 42, 0.92)')
			.attr('stroke-width', 0.75)
			.attr('paint-order', 'stroke')
			.attr('font-size', visibleNodeCount > 80 ? 9 : 10.5)
			.attr('font-weight', 450)
			.style('font-family', 'var(--font-interface)')
			.text((d: { id: any; }) => d.id.length > 18 ? `${d.id.slice(0, 18)}…` : d.id);
		if (!litePaint) {
			labelText
				.style('text-rendering', 'geometricPrecision')
				.style('shape-rendering', 'geometricPrecision')
				.style('-webkit-font-smoothing', 'antialiased');
		}

		node.append('circle')
			.attr('cx', -RADIUS_NODE * 0.68)
			.attr('cy', -RADIUS_NODE * 0.68)
			.attr('r', 14)
			.attr('fill', (d: { id: string; }) => this.canNodeExpand(d.id) ? 'rgba(34,197,94,0.95)' : this.canNodeCollapse(d.id) ? 'rgba(245,158,11,0.95)' : 'rgba(100,116,139,0.82)')
			.attr('stroke', 'rgba(255,255,255,0.85)')
			.attr('stroke-width', 1.5);

		node.append('text')
			.attr('x', -RADIUS_NODE * 0.68)
			.attr('y', -RADIUS_NODE * 0.68 + 0.5)
			.attr('text-anchor', 'middle')
			.attr('alignment-baseline', 'middle')
			.attr('fill', '#fff')
			.attr('font-size', 13)
			.attr('font-weight', 700)
			.style('pointer-events', 'none')
			.style('font-family', 'var(--font-interface)')
			.text((d: { id: string; }) => this.canNodeExpand(d.id) ? '+' : this.canNodeCollapse(d.id) ? '–' : '•');

		node.filter((d: { id: string; }) => this.shouldRenderNodeLabel(d.id, visibleNodeCount))
			.append('text')
			.attr('x', RADIUS_NODE * 0.8)
			.attr('y', -RADIUS_NODE)
			.attr('text-anchor', 'middle')
			.attr('alignment-baseline', 'middle')
			.attr('fill', 'rgba(147, 197, 253, 0.88)')
			.attr('font-size', 10)
			.attr('font-weight', 600)
			.text((d: { id: any; }) => `${this.graphState.getNodeNeighborCount(d.id)}`);

		if (this.activeNodeToolbeltId) {
			const toolbeltHost = this.nodeElementLookup.get(this.activeNodeToolbeltId);
			if (toolbeltHost) {
				this.attachNodeToolbelt(toolbeltHost, this.activeNodeToolbeltId);
			}
		}

		let lastDiagnosticsUpdate = 0;
		simulation.on('tick', () => {
			this.paintGraphFrame();
			if (!this.diagnosticsVisible) {
				return;
			}
			const now = Date.now();
			if (now - lastDiagnosticsUpdate > 400) {
				lastDiagnosticsUpdate = now;
				this.updateDiagnosticsPanel({
					visibleNodes: visibleNodeCount,
					visibleLinks: visibleLinkCount,
					renderedLabels: renderedLabelCount,
					renderedImages: renderedImageCount,
					selectedNodeId: this.currentSelectedNodeId,
					rootNodeCount: this.rootNodeIds.length,
					collapsedNodeCount: this.collapsedNodeIds.length,
					searchResultCount: this.searchResultNodeIds.length,
					renderMode,
					simulationStatus: 'running',
					alpha: simulation.alpha(),
				});
			}
		});

		simulation.on('end', () => {
			if (this.simulation !== simulation) {
				return;
			}
			this.pinRenderedNodesInPlace();
			this.settleSimulation('settled');
			this.updateDiagnosticsPanel({
				visibleNodes: visibleNodeCount,
				visibleLinks: visibleLinkCount,
				renderedLabels: renderedLabelCount,
				renderedImages: renderedImageCount,
				selectedNodeId: this.currentSelectedNodeId,
				rootNodeCount: this.rootNodeIds.length,
				collapsedNodeCount: this.collapsedNodeIds.length,
				searchResultCount: this.searchResultNodeIds.length,
				renderMode,
				simulationStatus: 'settled',
				alpha: simulation.alpha(),
			});
		});

		if (allNodesPinned) {
			simulation.stop();
			simulation.tick();
			this.pinRenderedNodesInPlace();
			this.settleSimulation('pinned-static');
		} else {
			simulation.alpha(1).restart();
			this.simulationAutoStopHandle = window.setTimeout(() => {
				if (this.simulation !== simulation) {
					return;
				}
				this.pinRenderedNodesInPlace();
				this.settleSimulation('auto-stopped');
				this.updateDiagnosticsPanel({
					visibleNodes: visibleNodeCount,
					visibleLinks: visibleLinkCount,
					renderedLabels: renderedLabelCount,
					renderedImages: renderedImageCount,
					selectedNodeId: this.currentSelectedNodeId,
					rootNodeCount: this.rootNodeIds.length,
					collapsedNodeCount: this.collapsedNodeIds.length,
					searchResultCount: this.searchResultNodeIds.length,
					renderMode,
					simulationStatus: 'auto-stopped',
					alpha: simulation.alpha(),
				});
			}, litePaint ? 800 : (visibleNodeCount > 40 ? 1200 : 2200));
		}

		return svg;
	}

	private createNodeDragHandler(simulation: any) {
		const applyDragPosition = (event: any, d: any) => {
			const next = this.constrainDragPosition(d.id, event.x, event.y);
			this.applyKinematicNodeMove(d, next.x, next.y);
		};

		return d3.drag()
			.clickDistance(12)
			.on('start', (event: any, d: any) => {
				this.cancelNodeHold();
				this.setGraphDragging(true, d.id);
				applyDragPosition(event, d);
				if (!this.simulationSettled && !event.active) {
					simulation.alphaTarget(0.18).restart();
				}
			})
			.on('drag', (event: any, d: any) => {
				applyDragPosition(event, d);
			})
			.on('end', (event: any, d: any) => {
				applyDragPosition(event, d);
				this.setGraphDragging(false);
				if (!this.simulationSettled && !event.active) {
					simulation.alphaTarget(0);
				}
			});
	}

	// section 2 ---------------------------- Graph Nodes/Links Renders and Behaviors
	focusOnNode(nodeId: string) {
		const width = SVG_WIDTH;
		const height = SVG_HEIGHT;
		const nodeData = this.renderedNodeLookup?.get(nodeId);

		if (nodeData && this.svg && this.zoomBehavior) {
			const x = nodeData.fx ?? nodeData.x;
			const y = nodeData.fy ?? nodeData.y;
			if (x == null || y == null) {
				return;
			}
			const duration = this.isCoarsePointerDevice() ? 0 : 180;
			this.svg.transition().duration(duration).call(
				this.zoomBehavior.transform,
				d3.zoomIdentity
					.translate(width / 2, height / 2)
					.scale(1)
					.translate(-x, -y)
			);
		}
	}


	// section 2 ---------------------------- Graph Nodes/Links Renders and Behaviors
	// bookmark__Node Onclick triggers editor
	nodeOnclickHandler(
			event: any,
			d: any,
			nodesDataRef: any,
			userTextEditorPanel: any,
			parentAppContainer: any) {


		const isMobile = parentAppContainer.isMobile;
		const found = nodesDataRef.find(
			(e: any) => e.source == d.id)
		if (found) {
			found.fx = d.x
			found.fy = d.y
			this.graphState.updateNodeCoordinates(d.id, { fx: d.x, fy: d.y })
		}

		// open the mark-down-file in any markdown-tab-type
		const leaves = parentAppContainer.workspace.getLeavesOfType('markdown');
		if (leaves.length > 0) {
			// Only auto-open in new tabs on Web
			// On mobile, we rely on node-avatar-button onclick to trigger open_markdown_file
			// Reference: bookmark_node_avatar_onclick_handler
			if (!isMobile) {
				this.openInNewTabIfTabNotAlreadyOpened(d.nodeFilePath, parentAppContainer)
			}
			this.graphState.ensureNodeIsRoot(d.id)
			this.currentSelectedNodeId = d.id
			this.bootstrapControlPlaneOnCanvas(this.svg)
			this.focusOnNode(d.id)
		} else {
			console.error('No editor pane found to open the file');
		}
	}

	async onQuerySearchHandler(textValue: string) {
		if (this.graphState.getSearchTerm() === textValue) {
			this.refreshControlBarMeta()
			return
		}
		this.graphState.setSearchTerm(textValue)
		this.refreshControlBarMeta()
		if (this.currentMode === 'map') {
			this.refreshMapModeFromState()
			return
		}
		await this.rerenderGraph()
	}

	// section 3 ---------------------------- Tabs manipulation
	// Bookmark__Tab_Modules
	openInNewTabByOverridingOtherMarkdownEditor(file_path: string, parentAppContainer: any) {
		const leaves = parentAppContainer.workspace.getLeavesOfType('markdown');
		const editorLeaf = leaves[0];

		try {
			console.log("[ken] triggering opening for ", file_path)
			editorLeaf.openFile(
				parentAppContainer.vault.getAbstractFileByPath(file_path)
			);
			return;
		} catch(err) {
			console.log("seeing error when opening markdown tab, seeing: ", err)
			console.log("retrying with another file path extension")
		}
	}

	// section 3 ---------------------------- Tabs manipulation
	// Bookmark__Tab_Modules
	async openInNewTabIfTabNotAlreadyOpened(file_path: string, parentAppContainer: any) {
		const leaves = parentAppContainer.workspace.getLeavesOfType('markdown');
		
		// Check if the file is already opened in any tab
		for (let leaf of leaves) {
			const openedFile = leaf.view.file;
			if (openedFile && openedFile.path === file_path) {
				console.log(`File ${file_path} is already opened.`);
				return;
			}
		}
		
		// Open the file in a new tab if it's not already opened
		const fileToOpen = parentAppContainer.vault.getAbstractFileByPath(file_path);
		if (fileToOpen) {
			parentAppContainer.workspace.getLeavesOfType('markdown')[0].openFile(fileToOpen);
			console.log(`Opened ${file_path} in a new tab.`);
		} else {
			console.log(`File ${file_path} not found.`);
			throw new Error("File not found")
		}
	}

	// section 3 ---------------------------- Tabs manipulation
	// Bookmark__Tab_Modules
	listOpenedMarkdownTabs(parentAppContainer: any) {
		const leaves = parentAppContainer.workspace.getLeavesOfType('markdown');
		const openTabs = leaves.map((leaf: any) => leaf.view.file?.path).filter(Boolean);
		console.log("Currently opened tabs:", openTabs);
		return openTabs;
	}

	// section 3 ---------------------------- Tabs manipulation
	// Bookmark__Tab_Modules
	async switchTab(file_path: string, parentAppContainer: any) {
		const leaves = parentAppContainer.workspace.getLeavesOfType('markdown');

		// Find the leaf with the corresponding file path
		for (let leaf of leaves) {
			const openedFile = leaf.view.file;
			if (openedFile && openedFile.path === file_path) {
				parentAppContainer.workspace.setActiveLeaf(leaf);
				console.log(`Switched to tab: ${file_path}`);
				return;
			}
		}
		console.log(`Tab with file ${file_path} is not currently opened.`);
	}

	// section 4 ---------------------------- Tools and Utils
	uniqueJsonArray(arr: any[]) {
		const seen = new Set<string>();
		const unique: any[] = [];
		for (const obj of arr) {
			const key = `${obj?.source ?? ''}\0${obj?.target ?? ''}\0${obj?.zIndex ?? ''}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			unique.push(obj);
		}
		return unique;
	}


	// section 4 ---------------------------- Tools and Utils
	// bookmark__visual_tools_node_coloring
	// since this is a listener method (serialized),
	// we cannot leverage "this" class variables
	identifyColorForNodeCircle(
			nodeId: string, 
			rootNodeIds: string[], 
			currentSelectedNodeId: string | null,
			currentSearchResultNodeIds: string[]) {

		if (currentSelectedNodeId == nodeId) {
			return '#7c3aed';
		}
		if (rootNodeIds.includes(nodeId)) {
			return '#22c55e'
		}
		if (currentSearchResultNodeIds.includes(nodeId)) {
			return '#f59e0b'
		}

		return '#38bdf8'
	}

	identifyStrokeForNodeCircle(
			nodeId: string,
			rootNodeIds: string[],
			currentSelectedNodeId: string | null,
			currentSearchResultNodeIds: string[]) {
		if (currentSelectedNodeId === nodeId) {
			return '#e9d5ff';
		}
		if (rootNodeIds.includes(nodeId)) {
			return '#dcfce7';
		}
		if (currentSearchResultNodeIds.includes(nodeId)) {
			return '#fef3c7';
		}
		return 'rgba(224, 242, 254, 0.75)';
	}


	// section 4 ---------------------------- Tools and Utils
	// bookmark__visual_tools_extract_html_text
	async renderMarkdownFileToHtml(fileName: string) {
		const file = this.parentAppContainer.vault.getAbstractFileByPath(fileName);
		if (!(file instanceof TFile)) {
			new Notice('File not found');
			return '';
		}
		const markdownContent = await this.parentAppContainer.vault.read(file);
		const htmlContainer = document.createElement('div');
		// await MarkdownRenderer.renderMarkdown(
		// 	markdownContent,
		// 	htmlContainer,
		// 	file.path
		// );
		return htmlContainer.innerHTML;
	}

	private sanitizeMarkdownLinkLabel(label: string) {
		return label.replace(/[\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
	}

	private extractMapPositionsFromContent(content: string): NodeMapPosition[] {
		const positions: NodeMapPosition[] = [];
		const regex = /<!--\s*IKG_MAP_POSITION\s+({[\s\S]*?})\s*-->/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(content)) !== null) {
			try {
				const parsed = JSON.parse(match[1]);
				if (!parsed?.id || !parsed?.url) {
					continue;
				}
				positions.push({
					id: String(parsed.id),
					label: String(parsed.label ?? 'Pinned map position'),
					url: String(parsed.url),
					lat: typeof parsed.lat === 'number' ? parsed.lat : null,
					lng: typeof parsed.lng === 'number' ? parsed.lng : null,
					createdAt: parsed.createdAt ? String(parsed.createdAt) : undefined,
				});
			} catch (error) {
				console.warn('Failed to parse saved map position metadata', error);
			}
		}
		return positions;
	}

	private buildManagedMapPositionsBlock(mapPositions: NodeMapPosition[]) {
		if (mapPositions.length === 0) {
			return '';
		}
		const lines = mapPositions.map((position) => {
			const label = this.sanitizeMarkdownLinkLabel(position.label || 'Pinned map position') || 'Pinned map position';
			const metadata = JSON.stringify({
				id: position.id,
				label: position.label,
				url: position.url,
				lat: position.lat ?? null,
				lng: position.lng ?? null,
				createdAt: position.createdAt,
			});
			return `- [📍 ${label}](${position.url}) <!-- ${MAP_POSITION_COMMENT_PREFIX} ${metadata} -->`;
		});
		return [
			MAP_POSITIONS_BLOCK_START,
			'## Saved map positions',
			...lines,
			MAP_POSITIONS_BLOCK_END,
		].join('\n');
	}

	private upsertManagedMapPositionsBlock(content: string, mapPositions: NodeMapPosition[]) {
		const nextBlock = this.buildManagedMapPositionsBlock(mapPositions);
		const blockRegex = /\n*<!-- IKG_MAP_POSITIONS_START -->[\s\S]*?<!-- IKG_MAP_POSITIONS_END -->\n*/g;
		const stripped = content.replace(blockRegex, '').trimEnd();
		if (!nextBlock) {
			return stripped;
		}
		return stripped.length > 0 ? `${stripped}\n\n${nextBlock}\n` : `${nextBlock}\n`;
	}

	private extractCoordinatePair(rawText: string) {
		const match = rawText.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
		if (!match) {
			return null;
		}
		const lat = parseFloat(match[1]);
		const lng = parseFloat(match[2]);
		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			return null;
		}
		return { lat, lng };
	}

	private parseMapPositionInput(rawValue: string): { url: string; lat: number | null; lng: number | null } | null {
		const trimmed = rawValue.trim();
		if (!trimmed) {
			return null;
		}

		const directCoords = this.extractCoordinatePair(trimmed);
		if (directCoords) {
			return {
				url: `https://www.google.com/maps?q=${directCoords.lat},${directCoords.lng}`,
				lat: directCoords.lat,
				lng: directCoords.lng,
			};
		}

		try {
			const url = new URL(trimmed);
			const decodedHref = decodeURIComponent(url.href);
			const candidates = [
				url.searchParams.get('q') ?? '',
				url.searchParams.get('query') ?? '',
				url.searchParams.get('ll') ?? '',
				url.searchParams.get('destination') ?? '',
				decodedHref.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)?.slice(1).join(',') ?? '',
				decodedHref.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)?.slice(1).join(',') ?? '',
			];
			for (const candidate of candidates) {
				const coords = this.extractCoordinatePair(candidate);
				if (coords) {
					return {
						url: `https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
						lat: coords.lat,
						lng: coords.lng,
					};
				}
			}
			return { url: url.toString(), lat: null, lng: null };
		} catch (_error) {
			return null;
		}
	}

	private async refreshNodeContentFromDisk(nodeId: string, nodeFilePath: string) {
		const file = this.parentAppContainer.vault.getAbstractFileByPath(nodeFilePath);
		if (!(file instanceof TFile)) {
			return null;
		}
		const content = await this.parentAppContainer.vault.read(file);
		const mapPositions = this.extractMapPositionsFromContent(content);
		this.graphState.updateNodeContent(nodeId, {
			description: content,
			mapPositions,
		});
		return { content, mapPositions };
	}

	async saveMapPositionForNode(nodeId: string, rawLabel: string, rawValue: string) {
		const found = this.graphState.getNodeById(nodeId);
		if (!found?.nodeFilePath) {
			new Notice('Pick a note node first before saving a map position.');
			return;
		}
		const parsedInput = this.parseMapPositionInput(rawValue);
		if (!parsedInput) {
			new Notice('Paste a Google Maps URL or a lat,lng pair like 37.7749,-122.4194.');
			return;
		}
		const file = this.parentAppContainer.vault.getAbstractFileByPath(found.nodeFilePath);
		if (!(file instanceof TFile)) {
			new Notice('Could not find the note file for this node.');
			return;
		}
		const existingContent = await this.parentAppContainer.vault.read(file);
		const existingPositions = this.extractMapPositionsFromContent(existingContent);
		const label = rawLabel.trim() || `Pinned spot ${existingPositions.length + 1}`;
		const nextPosition: NodeMapPosition = {
			id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			label,
			url: parsedInput.url,
			lat: parsedInput.lat,
			lng: parsedInput.lng,
			createdAt: new Date().toISOString(),
		};
		const updatedContent = this.upsertManagedMapPositionsBlock(existingContent, [...existingPositions, nextPosition]);
		await this.parentAppContainer.vault.modify(file, updatedContent);
		await this.refreshNodeContentFromDisk(nodeId, found.nodeFilePath);
		this.displayPanelComponent.clearMapPositionDraftInputs();
		if (this.mapDraftLabelInputEl) {
			this.mapDraftLabelInputEl.value = '';
		}
		if (this.mapDraftValueInputEl) {
			this.mapDraftValueInputEl.value = '';
		}
		this.mapDraftLatLng = null;
		await this.renderActiveMode();
		new Notice(`Saved map position to ${found.source}.`);
	}

	async deleteMapPositionForNode(nodeId: string, positionId: string) {
		const found = this.graphState.getNodeById(nodeId);
		if (!found?.nodeFilePath) {
			new Notice('Could not find the note file for this node.');
			return;
		}
		const file = this.parentAppContainer.vault.getAbstractFileByPath(found.nodeFilePath);
		if (!(file instanceof TFile)) {
			new Notice('Could not find the note file for this node.');
			return;
		}
		const existingContent = await this.parentAppContainer.vault.read(file);
		const existingPositions = this.extractMapPositionsFromContent(existingContent);
		const filteredPositions = existingPositions.filter((position) => position.id !== positionId);
		if (filteredPositions.length === existingPositions.length) {
			new Notice('That saved map position no longer exists in the note.');
			return;
		}
		const updatedContent = this.upsertManagedMapPositionsBlock(existingContent, filteredPositions);
		await this.parentAppContainer.vault.modify(file, updatedContent);
		await this.refreshNodeContentFromDisk(nodeId, found.nodeFilePath);
		await this.renderActiveMode();
		new Notice(`Deleted saved map position from ${found.source}.`);
	}

	// section 4 ---------------------------- Tools and Utils
	// bookmark__save_permanent_nodes_locations
	async saveAndUpdateNodesFxFy(node: any) {

		// Example usage: save_and_update_nodes_fx_fy(nodeData);
		const { id, fx, fy, nodeFilePath } = node;
		const file = await this.parentAppContainer.vault.getAbstractFileByPath(nodeFilePath);
		if (file && file instanceof TFile) {
			const content = await this.parentAppContainer.vault.read(file);
			const coordinateString = `Coordinate-Graph-Render(${fx}/${fy})`;

			// Check if the coordinate string already exists in the file
			const updatedContent = content.includes("Coordinate-Graph-Render(")
			? content.replace(/Coordinate-Graph-Render\(.*?\)/, coordinateString)
			: `${content}\n${coordinateString}`;

			// Write the updated content back to the file
			await this.parentAppContainer.vault.modify(file, updatedContent);
		}
	}


	// section 5 ---------------------------- Panel UI editting
	async bootstrapControlPlaneOnCanvas(svg: any) {
		this.ensureControlBar();
		this.refreshControlBarMeta();
		const currentSearchTerm = this.graphState.getSearchTerm();
		if (this.searchInputEl && this.searchInputEl.value !== currentSearchTerm) {
			this.searchInputEl.value = currentSearchTerm;
		}

		if (this.currentSelectedNodeId) {
			const nodeData = this.graphState.getNodeById(this.currentSelectedNodeId)
			if (nodeData) {
				const neighborCount = this.getNodeNeighborCount(nodeData.source)
				const searchHint = this.searchResultNodeIds.includes(nodeData.source) ? ' • matches current search' : ''
				this.displayPanelComponent.updateNodeTitle(nodeData.source)
				this.displayPanelComponent.updateNodeSubtitle(`${nodeData.nodeFilePath} • ${neighborCount} linked note${neighborCount === 1 ? '' : 's'}${searchHint}`)
				this.displayPanelComponent.updateNodeImage(
					nodeData.image ?? defaultAvatar,
					() => this.openInNewTabByOverridingOtherMarkdownEditor(nodeData.nodeFilePath, this.parentAppContainer)
				)
				this.displayPanelComponent.updateActionState({
					canExpand: this.canPanelExpand(nodeData.source),
					canCollapse: this.canPanelCollapse(nodeData.source),
					canSave: true,
					canOpen: true,
					canEditMap: true,
				})
				this.displayPanelComponent.renderMapPositions(nodeData.mapPositions ?? [], { canEdit: true })
				await this.displayPanelComponent.updateMarkdownContent(nodeData.description, nodeData.nodeFilePath)
			}
		} else {
			this.displayPanelComponent.updateNodeTitle('Node details')
			this.displayPanelComponent.updateNodeSubtitle('Tap a node in the graph to inspect it here.')
			this.displayPanelComponent.updateActionState({ canExpand: false, canCollapse: false, canSave: true, canOpen: false, canEditMap: false })
			this.displayPanelComponent.renderMapPositions([], { canEdit: false })
			await this.displayPanelComponent.updateMarkdownContent(null)
		}

		void svg
	}

}
