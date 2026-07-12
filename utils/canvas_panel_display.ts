import { MarkdownRenderer } from "obsidian";
import type { NodeMapPosition } from "./graph_state";

class DisplayPanel {
	parentAppContainer: any
	graphContainerPanel: any
	panelRootEl: HTMLElement | null;
	headerEl: HTMLElement | null;
	imageElement: HTMLImageElement | null;
	nodeTitleElement: HTMLElement | null;
	nodeSubtitleElement: HTMLElement | null;
	bodyEl: HTMLElement | null;
	nodeBase64Avatar: string | null;
	markdownFileContent: string | null;
	markdownContentEl: HTMLElement | null;
	actionRowEl: HTMLElement | null;
	mapSectionEl: HTMLElement | null;
	mapListEl: HTMLElement | null;
	mapEmptyEl: HTMLElement | null;
	mapLabelInputEl: HTMLInputElement | null;
	mapUrlInputEl: HTMLInputElement | null;
	mapAddButtonEl: HTMLButtonElement | null;

	buttonExpandNeighborElement: HTMLButtonElement | null;
	buttonCollapseNeighborElement: HTMLButtonElement | null;
	function_ptr_on_expand_node_trigger: any;
	function_ptr_on_collapse_node_trigger: any;

	buttonSaveAllNodesLocationButton: HTMLButtonElement | null;
	function_ptr_on_save_node_location_trigger: any;
	buttonOpenNoteElement: HTMLButtonElement | null;
	function_ptr_on_open_note_trigger: any;
	function_ptr_on_save_map_position_trigger: any;
	function_ptr_on_delete_map_position_trigger: any;
	function_ptr_on_open_map_position_trigger: any;

	nodeTitleString: string;
	function_ptr_on_click_node_avatar: any;

	constructor(parentAppContainer: any,
				graphContainerPanel: any) {

		this.parentAppContainer = parentAppContainer
		this.graphContainerPanel = graphContainerPanel
		this.panelRootEl = null
		this.headerEl = null
		this.imageElement = null
		this.nodeTitleElement = null
		this.nodeSubtitleElement = null
		this.bodyEl = null
		this.nodeBase64Avatar = null
		this.markdownFileContent = null
		this.markdownContentEl = null
		this.actionRowEl = null
		this.mapSectionEl = null
		this.mapListEl = null
		this.mapEmptyEl = null
		this.mapLabelInputEl = null
		this.mapUrlInputEl = null
		this.mapAddButtonEl = null
		this.buttonExpandNeighborElement = null
		this.buttonCollapseNeighborElement = null
		this.buttonSaveAllNodesLocationButton = null
		this.buttonOpenNoteElement = null
		this.nodeTitleString = ""
	}

	registerActionHandlers(handlers: {
		onExpandNode: any;
		onCollapseNode: any;
		onSaveLayout: any;
		onClickNodeAvatar: any;
		onOpenNote: any;
		onSaveMapPosition: any;
		onDeleteMapPosition: any;
		onOpenMapPosition: any;
	}) {
		this.function_ptr_on_expand_node_trigger = handlers.onExpandNode
		this.function_ptr_on_collapse_node_trigger = handlers.onCollapseNode
		this.function_ptr_on_save_node_location_trigger = handlers.onSaveLayout
		this.function_ptr_on_click_node_avatar = handlers.onClickNodeAvatar
		this.function_ptr_on_open_note_trigger = handlers.onOpenNote
		this.function_ptr_on_save_map_position_trigger = handlers.onSaveMapPosition
		this.function_ptr_on_delete_map_position_trigger = handlers.onDeleteMapPosition
		this.function_ptr_on_open_map_position_trigger = handlers.onOpenMapPosition
	}

	renderSelectedNodePanel() {
		const containerEl = this.graphContainerPanel.view.containerEl.parentElement;
		if (!containerEl) {
			return;
		}

		containerEl.querySelectorAll('.ikg-node-panel').forEach((el: Element) => el.remove());
		this.panelRootEl = null
		this.headerEl = null
		this.imageElement = null
		this.nodeTitleElement = null
		this.nodeSubtitleElement = null
		this.bodyEl = null
		this.markdownContentEl = null
		this.actionRowEl = null
		this.mapSectionEl = null
		this.mapListEl = null
		this.mapEmptyEl = null
		this.mapLabelInputEl = null
		this.mapUrlInputEl = null
		this.mapAddButtonEl = null
		this.buttonExpandNeighborElement = null
		this.buttonCollapseNeighborElement = null
		this.buttonSaveAllNodesLocationButton = null
		this.buttonOpenNoteElement = null
	}

	renderSearchBar() {
		return;
	}

	updateNodeImage(nodeImageB64Avatar: string, image_onclick_listener: any) {
		this.nodeBase64Avatar = nodeImageB64Avatar
		if (this.imageElement) {
			this.imageElement.src = nodeImageB64Avatar;
		}
		if (this.imageElement?.parentElement && image_onclick_listener) {
			this.imageElement.parentElement.onclick = image_onclick_listener;
		}
	}

	updateActionState(options: { canExpand: boolean; canCollapse: boolean; canSave?: boolean; canOpen?: boolean; canEditMap?: boolean }) {
		const { canExpand, canCollapse, canSave = true, canOpen = true, canEditMap = true } = options
		if (this.buttonExpandNeighborElement) {
			this.buttonExpandNeighborElement.disabled = !canExpand
			this.buttonExpandNeighborElement.classList.toggle('is-inactive', !canExpand)
			this.buttonExpandNeighborElement.classList.toggle('mod-cta', canExpand)
		}
		if (this.buttonCollapseNeighborElement) {
			this.buttonCollapseNeighborElement.disabled = !canCollapse
			this.buttonCollapseNeighborElement.classList.toggle('is-inactive', !canCollapse)
			this.buttonCollapseNeighborElement.classList.toggle('mod-cta', canCollapse)
		}
		if (this.buttonSaveAllNodesLocationButton) {
			this.buttonSaveAllNodesLocationButton.disabled = !canSave
			this.buttonSaveAllNodesLocationButton.classList.toggle('is-inactive', !canSave)
		}
		if (this.buttonOpenNoteElement) {
			this.buttonOpenNoteElement.disabled = !canOpen
			this.buttonOpenNoteElement.classList.toggle('is-inactive', !canOpen)
		}
		if (this.mapAddButtonEl) {
			this.mapAddButtonEl.disabled = !canEditMap
			this.mapAddButtonEl.classList.toggle('is-inactive', !canEditMap)
		}
		if (this.mapLabelInputEl) {
			this.mapLabelInputEl.disabled = !canEditMap
		}
		if (this.mapUrlInputEl) {
			this.mapUrlInputEl.disabled = !canEditMap
		}
	}

	updateNodeTitle(nodeTitle: string) {
		this.nodeTitleString = nodeTitle
		if (this.nodeTitleElement) {
			this.nodeTitleElement.setText(nodeTitle);
		}
	}

	updateNodeSubtitle(subtitle: string) {
		if (this.nodeSubtitleElement) {
			this.nodeSubtitleElement.setText(subtitle);
		}
	}

	clearMapPositionDraftInputs() {
		if (this.mapLabelInputEl) {
			this.mapLabelInputEl.value = ''
		}
		if (this.mapUrlInputEl) {
			this.mapUrlInputEl.value = ''
		}
	}

	renderMapPositions(mapPositions: NodeMapPosition[], options: { canEdit: boolean }) {
		if (!this.mapListEl) {
			return
		}
		this.mapListEl.empty()
		if (mapPositions.length === 0) {
			this.mapListEl.createDiv({ cls: 'ikg-node-panel__empty', text: options.canEdit ? 'No map positions saved for this note yet.' : 'Select a node to start saving map positions.' })
			return
		}

		mapPositions.forEach((position) => {
			const item = this.mapListEl?.createDiv({ cls: 'ikg-node-panel__map-item' })
			if (!item) {
				return
			}
			const textWrap = item.createDiv({ cls: 'ikg-node-panel__map-item-copy' })
			textWrap.createDiv({ cls: 'ikg-node-panel__map-item-title', text: position.label || 'Pinned map position' })
			const coordsText = position.lat != null && position.lng != null
				? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
				: 'Google Maps link'
			textWrap.createDiv({ cls: 'ikg-node-panel__map-item-subtitle', text: coordsText })

			const actions = item.createDiv({ cls: 'ikg-node-panel__map-item-actions' })
			const openButton = actions.createEl('button', { text: 'Open map' })
			openButton.addEventListener('click', (pointerEvent: any) => {
				if (this.function_ptr_on_open_map_position_trigger) {
					this.function_ptr_on_open_map_position_trigger(pointerEvent, this.nodeTitleString, position)
				}
			})
			const deleteButton = actions.createEl('button', { text: 'Delete' })
			deleteButton.disabled = !options.canEdit
			deleteButton.classList.toggle('is-inactive', !options.canEdit)
			deleteButton.addEventListener('click', (pointerEvent: any) => {
				if (this.function_ptr_on_delete_map_position_trigger && this.nodeTitleString) {
					this.function_ptr_on_delete_map_position_trigger(pointerEvent, this.nodeTitleString, position.id)
				}
			})
		})
	}

	private spotlightSection(sectionEl: HTMLElement | null) {
		if (!sectionEl) {
			return
		}
		sectionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		sectionEl.classList.add('is-spotlit')
		window.setTimeout(() => sectionEl.classList.remove('is-spotlit'), 1400)
	}

	focusMapComposer() {
		return
	}

	focusMarkdownPreview() {
		return
	}

	async updateMarkdownContent(markdownContent: string | null, filePath = "") {
		this.markdownFileContent = markdownContent
		if (!this.markdownContentEl) {
			return
		}
		this.markdownContentEl.empty()
		if (!markdownContent) {
			this.markdownContentEl.createDiv({ cls: 'ikg-node-panel__empty', text: 'No preview available for this node yet.' })
			return
		}
		await MarkdownRenderer.renderMarkdown(
			markdownContent,
			this.markdownContentEl,
			filePath,
			this.parentAppContainer
		)
	}
}

export default DisplayPanel
