extends Control

const PLAYER_COLORS := [Color("#C96B00"), Color("#4A7C2A"), Color("#4A3B7C"), Color("#9B2626")]
const ZONE_COLORS := [
	Color("#F5E4B8"), Color("#C8D8A8"), Color("#E0B595"), Color("#C5B8DC")
]

var _cell_nodes: Dictionary = {}  # cell_number -> Control
var _modal: CanvasLayer = null
var _dice_callback: Callable = Callable()
var _log_entries: Array[String] = []

func _ready() -> void:
	GameManager.board_updated.connect(_redraw_tokens)
	GameManager.players_updated.connect(_refresh_player_panel)
	GameManager.turn_started.connect(_on_turn_started)
	GameManager.log_added.connect(_on_log_added)
	GameManager.show_modal_requested.connect(_show_modal)
	GameManager.close_modal_requested.connect(_close_modal)

	_build_ui()
	_build_board()
	_redraw_tokens()
	_refresh_player_panel()

	var p: Dictionary = GameManager.current_player()
	if not p.is_empty():
		_on_turn_started(p)

func _build_ui() -> void:
	anchor_right = 1.0
	anchor_bottom = 1.0

	var bg := ColorRect.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.color = Color("#F5E4B8")
	add_child(bg)

	# Main layout: players panel | board area
	var hbox := HBoxContainer.new()
	hbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hbox.add_theme_constant_override("separation", 14)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["margin_top","margin_left","margin_right","margin_bottom"]:
		margin.add_theme_constant_override(side, 12)
	add_child(margin)
	margin.add_child(hbox)

	# Players panel
	var players_scroll := ScrollContainer.new()
	players_scroll.custom_minimum_size = Vector2(240, 0)
	players_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	hbox.add_child(players_scroll)

	var players_vbox := VBoxContainer.new()
	players_vbox.name = "PlayersPanel"
	players_vbox.add_theme_constant_override("separation", 10)
	players_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	players_scroll.add_child(players_vbox)

	# Board + turn bar area
	var board_vbox := VBoxContainer.new()
	board_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	board_vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	board_vbox.add_theme_constant_override("separation", 12)
	hbox.add_child(board_vbox)

	# Board frame
	var frame := PanelContainer.new()
	frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var frame_style := StyleBoxFlat.new()
	frame_style.bg_color = Color("#4A1C00")
	frame_style.set_border_width_all(2)
	frame_style.border_color = Color("#D4A017")
	frame_style.corner_radius_top_left = 4
	frame_style.corner_radius_top_right = 4
	frame_style.corner_radius_bottom_left = 4
	frame_style.corner_radius_bottom_right = 4
	frame.add_theme_stylebox_override("panel", frame_style)
	board_vbox.add_child(frame)

	var board_margin := MarginContainer.new()
	for side in ["margin_top","margin_left","margin_right","margin_bottom"]:
		board_margin.add_theme_constant_override(side, 8)
	frame.add_child(board_margin)

	var grid := GridContainer.new()
	grid.name = "BoardGrid"
	grid.columns = 10
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 2)
	grid.add_theme_constant_override("v_separation", 2)
	board_margin.add_child(grid)

	# Turn bar
	var turn_bar := _build_turn_bar()
	board_vbox.add_child(turn_bar)

	# Log panel (overlay, hidden by default)
	_build_log_panel()

	# Modal canvas layer
	_modal = CanvasLayer.new()
	_modal.name = "ModalLayer"
	_modal.visible = false
	add_child(_modal)

func _build_turn_bar() -> PanelContainer:
	var bar := PanelContainer.new()
	bar.name = "TurnBar"
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#FDF3DC")
	style.set_border_width_all(2)
	style.border_color = Color("#E8C97A")
	bar.add_theme_stylebox_override("panel", style)

	var margin := MarginContainer.new()
	for side in ["margin_top","margin_left","margin_right","margin_bottom"]:
		margin.add_theme_constant_override(side, 10)
	bar.add_child(margin)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 24)
	margin.add_child(hbox)

	# Turn info
	var turn_vbox := VBoxContainer.new()
	hbox.add_child(turn_vbox)

	var turn_label := Label.new()
	turn_label.text = "เทิร์นของ"
	turn_label.add_theme_font_size_override("font_size", 12)
	turn_label.add_theme_color_override("font_color", Color("#3D2410"))
	turn_vbox.add_child(turn_label)

	var turn_name := Label.new()
	turn_name.name = "TurnName"
	turn_name.text = "—"
	turn_name.add_theme_font_size_override("font_size", 22)
	turn_name.add_theme_color_override("font_color", Color("#7C3A00"))
	turn_vbox.add_child(turn_name)

	# Dice input
	var dice_vbox := VBoxContainer.new()
	dice_vbox.add_theme_constant_override("separation", 4)
	hbox.add_child(dice_vbox)

	var dice_label := Label.new()
	dice_label.text = "ทอด D6 จริง แล้วป้อนผล:"
	dice_label.add_theme_font_size_override("font_size", 12)
	dice_label.add_theme_color_override("font_color", Color("#3D2410"))
	dice_vbox.add_child(dice_label)

	var dice_hbox := HBoxContainer.new()
	dice_hbox.name = "DiceButtons"
	dice_hbox.add_theme_constant_override("separation", 4)
	dice_vbox.add_child(dice_hbox)

	for n in [1, 2, 3, 4, 5, 6]:
		var btn := Button.new()
		btn.name = "Dice%d" % n
		btn.text = str(n)
		btn.custom_minimum_size = Vector2(42, 46)
		btn.add_theme_font_size_override("font_size", 18)
		btn.pressed.connect(_on_dice_pressed.bind(n))
		dice_hbox.add_child(btn)

	return bar

func _build_log_panel() -> void:
	var log_btn := Button.new()
	log_btn.name = "LogToggle"
	log_btn.text = "📜"
	log_btn.custom_minimum_size = Vector2(50, 50)
	log_btn.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	log_btn.offset_left = -66
	log_btn.offset_top = -66
	log_btn.pressed.connect(_toggle_log)
	add_child(log_btn)

	var log_panel := PanelContainer.new()
	log_panel.name = "LogPanel"
	log_panel.custom_minimum_size = Vector2(300, 0)
	log_panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	log_panel.offset_top = -420
	log_panel.offset_left = -316
	log_panel.offset_bottom = -80
	log_panel.visible = false
	add_child(log_panel)

	var log_vbox := VBoxContainer.new()
	log_panel.add_child(log_vbox)

	var log_header := HBoxContainer.new()
	log_vbox.add_child(log_header)

	var log_title := Label.new()
	log_title.text = "บันทึกเหตุการณ์"
	log_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	log_header.add_child(log_title)

	var log_close := Button.new()
	log_close.text = "✕"
	log_close.pressed.connect(func(): log_panel.visible = false)
	log_header.add_child(log_close)

	var log_scroll := ScrollContainer.new()
	log_scroll.custom_minimum_size = Vector2(0, 300)
	log_vbox.add_child(log_scroll)

	var log_body := VBoxContainer.new()
	log_body.name = "LogBody"
	log_scroll.add_child(log_body)

func _toggle_log() -> void:
	var panel: PanelContainer = get_node_or_null("LogPanel")
	if panel:
		panel.visible = not panel.visible

func _build_board() -> void:
	var grid: GridContainer = get_node("MarginContainer/HBoxContainer/VBoxContainer/PanelContainer/MarginContainer/BoardGrid")
	_cell_nodes.clear()

	for visual_row in range(10):
		var game_row: int = 10 - visual_row
		var left_to_right: bool = game_row % 2 == 1
		for col in range(10):
			var cell_idx: int
			if left_to_right:
				cell_idx = (game_row - 1) * 10 + col + 1
			else:
				cell_idx = game_row * 10 - col

			var cell := _make_cell(cell_idx)
			grid.add_child(cell)
			_cell_nodes[cell_idx] = cell

func _make_cell(idx: int) -> PanelContainer:
	var cell := PanelContainer.new()
	cell.custom_minimum_size = Vector2(48, 48)
	cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cell.size_flags_vertical = Control.SIZE_EXPAND_FILL

	var zone: int = GameData.get_zone(idx)
	var style := StyleBoxFlat.new()
	style.bg_color = ZONE_COLORS[zone - 1]
	if GameData.LADDERS.has(idx):
		style.border_color = Color("#D4A017")
		style.set_border_width_all(2)
	elif GameData.SNAKES.has(idx):
		style.border_color = Color("#9B2626")
		style.set_border_width_all(2)
	elif idx == 100:
		style.bg_color = Color("#F5CC40")
	cell.add_theme_stylebox_override("panel", style)

	var overlay := VBoxContainer.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cell.add_child(overlay)

	# Cell number
	var num := Label.new()
	num.text = str(idx)
	num.add_theme_font_size_override("font_size", 9)
	num.add_theme_color_override("font_color", Color("#3D2410"))
	overlay.add_child(num)

	# Symbol
	var sym := ""
	if GameData.LADDERS.has(idx):
		sym = "⇧%d" % GameData.LADDERS[idx]
	elif GameData.SNAKES.has(idx):
		sym = "⇩%d" % GameData.SNAKES[idx]
	elif GameData.EVENT_TILES.has(idx):
		sym = GameData.EVENTS[GameData.EVENT_TILES[idx]].icon
	elif idx == 100:
		sym = "👑"

	if sym != "":
		var sym_lbl := Label.new()
		sym_lbl.text = sym
		sym_lbl.add_theme_font_size_override("font_size", 11)
		sym_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		sym_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		overlay.add_child(sym_lbl)

	# Tokens container
	var tokens := HBoxContainer.new()
	tokens.name = "Tokens"
	tokens.add_theme_constant_override("separation", 1)
	overlay.add_child(tokens)

	return cell

func _redraw_tokens() -> void:
	for idx in _cell_nodes:
		var tokens: HBoxContainer = _cell_nodes[idx].get_node_or_null("VBoxContainer/Tokens")
		if tokens:
			for child in tokens.get_children():
				child.queue_free()

	for p in GameManager.players:
		if not _cell_nodes.has(p.pos): continue
		var tokens: HBoxContainer = _cell_nodes[p.pos].get_node_or_null("VBoxContainer/Tokens")
		if not tokens: continue
		var tok := ColorRect.new()
		tok.custom_minimum_size = Vector2(10, 10)
		tok.color = PLAYER_COLORS[p.idx]
		tok.tooltip_text = p.character.name
		tokens.add_child(tok)

func _refresh_player_panel() -> void:
	var panel: VBoxContainer = get_node_or_null("MarginContainer/HBoxContainer/ScrollContainer/PlayersPanel")
	if not panel: return
	for child in panel.get_children():
		child.queue_free()

	for p in GameManager.players:
		var card := _make_player_card(p)
		panel.add_child(card)

func _make_player_card(p: Dictionary) -> PanelContainer:
	var card := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#FDF3DC")
	style.border_color = PLAYER_COLORS[p.idx] if p.idx == GameManager.current_idx else Color("#E8C97A")
	style.set_border_width_all(2)
	style.border_width_left = 6
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	card.add_theme_stylebox_override("panel", style)

	var margin := MarginContainer.new()
	for side in ["margin_top","margin_left","margin_right","margin_bottom"]:
		margin.add_theme_constant_override(side, 10)
	card.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	margin.add_child(vbox)

	var name_lbl := Label.new()
	name_lbl.text = "%s  P%d" % [p.character.name, p.idx + 1]
	name_lbl.add_theme_font_size_override("font_size", 15)
	name_lbl.add_theme_color_override("font_color", Color("#7C3A00"))
	vbox.add_child(name_lbl)

	var title_lbl := Label.new()
	title_lbl.text = p.character.title
	title_lbl.add_theme_font_size_override("font_size", 11)
	title_lbl.add_theme_color_override("font_color", Color("#C96B00"))
	vbox.add_child(title_lbl)

	# Stats row
	var stats_hbox := HBoxContainer.new()
	stats_hbox.add_theme_constant_override("separation", 8)
	vbox.add_child(stats_hbox)
	for sk in ["str", "lck", "wit"]:
		var sl := Label.new()
		sl.text = "%s:%d" % [sk.to_upper(), p.stats[sk]]
		sl.add_theme_font_size_override("font_size", 12)
		stats_hbox.add_child(sl)

	var pos_lbl := Label.new()
	pos_lbl.text = "ช่อง %d  |  Re-roll: %d" % [p.pos, p.rerolls_left]
	pos_lbl.add_theme_font_size_override("font_size", 12)
	vbox.add_child(pos_lbl)

	# Ability button (only for current player, pre-roll abilities)
	if p.idx == GameManager.current_idx and not p.ability_used and p.character.ability.timing == "pre-roll":
		var ab_btn := Button.new()
		ab_btn.text = "%s %s" % [p.character.ability.icon, p.character.ability.name]
		ab_btn.pressed.connect(func(): GameManager.use_ability(p.idx))
		vbox.add_child(ab_btn)

	return card

func _on_turn_started(p: Dictionary) -> void:
	var turn_name: Label = get_node_or_null("MarginContainer/HBoxContainer/VBoxContainer/TurnBar/MarginContainer/HBoxContainer/VBoxContainer/TurnName")
	if turn_name:
		turn_name.text = "%s (P%d)" % [p.character.name, p.idx + 1]
		turn_name.add_theme_color_override("font_color", PLAYER_COLORS[p.idx])

func _on_dice_pressed(n: int) -> void:
	if _dice_callback.is_valid():
		var cb := _dice_callback
		_dice_callback = Callable()
		cb.call(n)
	else:
		GameManager.on_dice_roll(n)

func _on_log_added(msg: String) -> void:
	var body: VBoxContainer = get_node_or_null("LogPanel/PanelContainer/VBoxContainer/ScrollContainer/LogBody")
	if not body: return
	var lbl := Label.new()
	lbl.text = msg
	lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl.add_theme_font_size_override("font_size", 12)
	body.add_child(lbl)
	# Keep max 50 entries
	while body.get_child_count() > 50:
		body.get_child(0).queue_free()

# ── Modal ─────────────────────────────────────────────────────────────────────
func _show_modal(config: Dictionary) -> void:
	_close_modal()

	var overlay := ColorRect.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.color = Color(0.12, 0.07, 0.04, 0.75)
	_modal.add_child(overlay)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_modal.add_child(center)

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(460, 0)
	var ps := StyleBoxFlat.new()
	ps.bg_color = Color("#FDF3DC")
	ps.set_border_width_all(3)
	ps.border_color = Color("#D4A017")
	ps.corner_radius_top_left = 6
	ps.corner_radius_top_right = 6
	ps.corner_radius_bottom_left = 6
	ps.corner_radius_bottom_right = 6
	panel.add_theme_stylebox_override("panel", ps)
	center.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 0)
	panel.add_child(vbox)

	# Header
	var header := PanelContainer.new()
	var hs := StyleBoxFlat.new()
	hs.bg_color = Color("#7C3A00")
	header.add_theme_stylebox_override("panel", hs)
	vbox.add_child(header)

	var header_hbox := HBoxContainer.new()
	header_hbox.add_theme_constant_override("separation", 12)
	var hm := MarginContainer.new()
	for side in ["margin_top","margin_left","margin_right","margin_bottom"]:
		hm.add_theme_constant_override(side, 14)
	header.add_child(hm)
	hm.add_child(header_hbox)

	var icon_lbl := Label.new()
	icon_lbl.text = config.get("icon", "⚡")
	icon_lbl.add_theme_font_size_override("font_size", 28)
	header_hbox.add_child(icon_lbl)

	var title_lbl := Label.new()
	title_lbl.text = config.get("title", "Event")
	title_lbl.add_theme_font_size_override("font_size", 20)
	title_lbl.add_theme_color_override("font_color", Color("#FDF3DC"))
	header_hbox.add_child(title_lbl)

	# Body
	var body_margin := MarginContainer.new()
	for side in ["margin_top","margin_left","margin_right","margin_bottom"]:
		body_margin.add_theme_constant_override(side, 18)
	vbox.add_child(body_margin)

	var body_lbl := Label.new()
	body_lbl.text = config.get("body", "")
	body_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body_lbl.add_theme_font_size_override("font_size", 15)
	body_margin.add_child(body_lbl)

	# Dice buttons inside modal (if needed)
	if config.get("show_dice", false):
		var dice_hbox := HBoxContainer.new()
		dice_hbox.alignment = BoxContainer.ALIGNMENT_CENTER
		dice_hbox.add_theme_constant_override("separation", 6)
		body_margin.add_child(dice_hbox)

		var cb: Callable = config.get("dice_callback", Callable())
		for n in [1, 2, 3, 4, 5, 6]:
			var btn := Button.new()
			btn.text = str(n)
			btn.custom_minimum_size = Vector2(44, 48)
			btn.add_theme_font_size_override("font_size", 18)
			if cb.is_valid():
				btn.pressed.connect(func(): _close_modal(); cb.call(n))
			else:
				btn.pressed.connect(func(): _close_modal(); GameManager.on_dice_roll(n))
			dice_hbox.add_child(btn)

	# Action buttons
	var actions: Array = config.get("actions", [])
	if actions.size() > 0:
		var actions_margin := MarginContainer.new()
		for side in ["margin_top","margin_left","margin_right","margin_bottom"]:
			actions_margin.add_theme_constant_override(side, 14)
		vbox.add_child(actions_margin)

		var actions_hbox := HBoxContainer.new()
		actions_hbox.alignment = BoxContainer.ALIGNMENT_END
		actions_hbox.add_theme_constant_override("separation", 10)
		actions_margin.add_child(actions_hbox)

		for action in actions:
			var btn := Button.new()
			btn.text = action.get("label", "OK")
			btn.custom_minimum_size = Vector2(0, 40)
			var cb_action: Callable = action.get("callback", Callable())
			btn.pressed.connect(func(): cb_action.call() if cb_action.is_valid() else _close_modal())
			actions_hbox.add_child(btn)

	_modal.visible = true

func _close_modal() -> void:
	_modal.visible = false
	for child in _modal.get_children():
		child.queue_free()
