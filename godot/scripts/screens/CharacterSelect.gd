extends Control

var _selected_char: Dictionary = {}
var _confirm_btn: Button

func _ready() -> void:
	GameManager.players_updated.connect(_refresh)
	_build_ui()
	_populate_grid()

func _build_ui() -> void:
	anchor_right = 1.0
	anchor_bottom = 1.0

	var bg := ColorRect.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.color = Color("#F5E4B8")
	add_child(bg)

	var vbox := VBoxContainer.new()
	vbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 16)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_top", 32)
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 80)
	add_child(margin)
	margin.add_child(vbox)

	# Header
	var header := Label.new()
	header.name = "Header"
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header.add_theme_font_size_override("font_size", 28)
	header.add_theme_color_override("font_color", Color("#7C3A00"))
	vbox.add_child(header)

	# Grid scroll
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll)

	var grid := GridContainer.new()
	grid.name = "CharGrid"
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 16)
	grid.add_theme_constant_override("v_separation", 16)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(grid)

	# Confirm button (fixed bottom)
	var footer := PanelContainer.new()
	footer.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	footer.custom_minimum_size = Vector2(0, 70)
	add_child(footer)

	var footer_center := CenterContainer.new()
	footer.add_child(footer_center)

	_confirm_btn = Button.new()
	_confirm_btn.text = "ยืนยันตัวละคร"
	_confirm_btn.custom_minimum_size = Vector2(240, 48)
	_confirm_btn.disabled = true
	_confirm_btn.pressed.connect(_on_confirm)
	footer_center.add_child(_confirm_btn)

	_update_header()

func _update_header() -> void:
	var header: Label = get_node_or_null("MarginContainer/VBoxContainer/Header")
	if header:
		header.text = "เลือกตัวละคร — ผู้เล่น %d / %d" % [
			GameManager.current_select_idx + 1, GameManager.player_count]

func _populate_grid() -> void:
	var grid: GridContainer = get_node_or_null("MarginContainer/VBoxContainer/ScrollContainer/CharGrid")
	if not grid: return
	for child in grid.get_children():
		child.queue_free()

	var taken_ids: Array = GameManager.players.map(func(p): return p.character.id)
	_selected_char = {}
	_confirm_btn.disabled = true

	for ch in GameData.CHARACTERS:
		var taken: bool = taken_ids.has(ch.id)
		var card := _make_char_card(ch, taken)
		grid.add_child(card)

func _make_char_card(ch: Dictionary, taken: bool) -> PanelContainer:
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(200, 280)

	var style := StyleBoxFlat.new()
	style.bg_color = Color("#FDF3DC")
	style.border_color = Color("#E8C97A")
	style.set_border_width_all(2)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	card.add_theme_stylebox_override("panel", style)

	if taken:
		card.modulate.a = 0.4

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	card.add_child(vbox)

	var margin := MarginContainer.new()
	for side in ["margin_top","margin_left","margin_right","margin_bottom"]:
		margin.add_theme_constant_override(side, 14)
	vbox.add_child(margin)

	var inner := VBoxContainer.new()
	inner.add_theme_constant_override("separation", 6)
	margin.add_child(inner)

	# Icon + name row
	var name_lbl := Label.new()
	name_lbl.text = "%s %s" % [ch.icon, ch.name]
	name_lbl.add_theme_font_size_override("font_size", 18)
	name_lbl.add_theme_color_override("font_color", Color("#7C3A00"))
	inner.add_child(name_lbl)

	var title_lbl := Label.new()
	title_lbl.text = ch.title
	title_lbl.add_theme_font_size_override("font_size", 12)
	title_lbl.add_theme_color_override("font_color", Color("#C96B00"))
	inner.add_child(title_lbl)

	# Stats
	for stat_key in ["str", "lck", "wit"]:
		var stat_lbl := Label.new()
		var labels := {"str": "STR", "lck": "LCK", "wit": "WIT"}
		stat_lbl.text = "%s: %d/5" % [labels[stat_key], ch.stats[stat_key]]
		stat_lbl.add_theme_font_size_override("font_size", 13)
		inner.add_child(stat_lbl)

	# Ability
	var ab_panel := PanelContainer.new()
	var ab_style := StyleBoxFlat.new()
	ab_style.bg_color = Color(0.83, 0.63, 0.09, 0.1)
	ab_style.border_color = Color("#D4A017")
	ab_style.border_width_left = 3
	ab_panel.add_theme_stylebox_override("panel", ab_style)
	inner.add_child(ab_panel)

	var ab_vbox := VBoxContainer.new()
	ab_panel.add_child(ab_vbox)

	var ab_name := Label.new()
	ab_name.text = "%s %s" % [ch.ability.icon, ch.ability.name]
	ab_name.add_theme_font_size_override("font_size", 12)
	ab_name.add_theme_color_override("font_color", Color("#7C3A00"))
	ab_vbox.add_child(ab_name)

	var ab_desc := Label.new()
	ab_desc.text = ch.ability.description
	ab_desc.add_theme_font_size_override("font_size", 11)
	ab_desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ab_vbox.add_child(ab_desc)

	if taken:
		var taken_lbl := Label.new()
		taken_lbl.text = "เลือกแล้ว"
		taken_lbl.add_theme_color_override("font_color", Color("#9B2626"))
		inner.add_child(taken_lbl)
	else:
		var btn := Button.new()
		btn.text = "เลือก"
		btn.pressed.connect(_on_char_selected.bind(ch, card))
		inner.add_child(btn)

	return card

func _on_char_selected(ch: Dictionary, _card: PanelContainer) -> void:
	_selected_char = ch
	_confirm_btn.disabled = false
	_confirm_btn.text = "ยืนยัน %s" % ch.name

func _on_confirm() -> void:
	if _selected_char.is_empty(): return
	GameManager.confirm_character(_selected_char)
	if GameManager.current_select_idx < GameManager.player_count:
		_selected_char = {}
		_confirm_btn.disabled = true
		_confirm_btn.text = "ยืนยันตัวละคร"
		_update_header()
		_populate_grid()

func _refresh() -> void:
	_update_header()
