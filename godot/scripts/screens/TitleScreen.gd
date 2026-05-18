extends Control

func _ready() -> void:
	_build_ui()

func _build_ui() -> void:
	anchor_right = 1.0
	anchor_bottom = 1.0

	var bg := ColorRect.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.color = Color("#4A1C00")
	add_child(bg)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var vbox := VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.custom_minimum_size = Vector2(480, 0)
	vbox.add_theme_constant_override("separation", 16)
	center.add_child(vbox)

	# Ornament
	var ornament := Label.new()
	ornament.text = "✦ ✦ ✦"
	ornament.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ornament.add_theme_color_override("font_color", Color("#D4A017"))
	vbox.add_child(ornament)

	# Title
	var title := Label.new()
	title.text = "Dragon's Ladder"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 52)
	title.add_theme_color_override("font_color", Color("#F5CC40"))
	vbox.add_child(title)

	# Subtitle
	var subtitle := Label.new()
	subtitle.text = "REALM OF FORTUNE"
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 18)
	subtitle.add_theme_color_override("font_color", Color("#FDD17A"))
	vbox.add_child(subtitle)

	# Tagline
	var tagline := Label.new()
	tagline.text = "A fantasy snakes-and-ladders adventure of fortune, fate, and bold gambles."
	tagline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tagline.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	tagline.add_theme_color_override("font_color", Color("#E8C97A"))
	tagline.custom_minimum_size = Vector2(420, 0)
	vbox.add_child(tagline)

	# Spacer
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 24)
	vbox.add_child(spacer)

	# Player count label
	var count_label := Label.new()
	count_label.text = "เลือกจำนวนผู้เล่น"
	count_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	count_label.add_theme_color_override("font_color", Color("#F4A532"))
	vbox.add_child(count_label)

	# Count buttons
	var hbox := HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 20)
	vbox.add_child(hbox)

	for n in [2, 3, 4]:
		var btn := Button.new()
		btn.text = str(n)
		btn.custom_minimum_size = Vector2(72, 72)
		btn.add_theme_font_size_override("font_size", 28)
		btn.add_theme_color_override("font_color", Color("#F5CC40"))
		btn.pressed.connect(_on_count_pressed.bind(n))
		hbox.add_child(btn)

	# Hint
	var hint := Label.new()
	hint.text = "⚀ เกมนี้ใช้ลูกเต๋า D6 จริง 1 ลูก กรุณาเตรียมไว้"
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.add_theme_font_size_override("font_size", 13)
	hint.add_theme_color_override("font_color", Color("#E8C97A"))
	vbox.add_child(hint)

func _on_count_pressed(n: int) -> void:
	GameManager.set_player_count(n)
