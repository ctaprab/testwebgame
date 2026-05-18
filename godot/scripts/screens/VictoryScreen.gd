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
	vbox.add_theme_constant_override("separation", 18)
	center.add_child(vbox)

	var ornament := Label.new()
	ornament.text = "✦ ✦ ✦"
	ornament.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ornament.add_theme_color_override("font_color", Color("#D4A017"))
	ornament.add_theme_font_size_override("font_size", 28)
	vbox.add_child(ornament)

	# Find the winner (last player who reached pos 100, or detect from log)
	var winner_name: String = "ผู้ชนะ"
	for p in GameManager.players:
		if p.pos == 100:
			winner_name = p.character.name
			break

	var name_lbl := Label.new()
	name_lbl.text = winner_name
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.add_theme_font_size_override("font_size", 52)
	name_lbl.add_theme_color_override("font_color", Color("#F5CC40"))
	vbox.add_child(name_lbl)

	var sub_lbl := Label.new()
	sub_lbl.text = "คือผู้ครองอาณาจักร!"
	sub_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub_lbl.add_theme_font_size_override("font_size", 22)
	sub_lbl.add_theme_color_override("font_color", Color("#FDD17A"))
	vbox.add_child(sub_lbl)

	var tagline := Label.new()
	tagline.text = "Realm of Fortune หมอบกราบบุคคลผู้กล้าหาญ"
	tagline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tagline.add_theme_color_override("font_color", Color("#E8C97A"))
	vbox.add_child(tagline)

	var play_again := Button.new()
	play_again.text = "เล่นใหม่"
	play_again.custom_minimum_size = Vector2(200, 52)
	play_again.add_theme_font_size_override("font_size", 18)
	play_again.pressed.connect(_on_play_again)
	vbox.add_child(play_again)

func _on_play_again() -> void:
	GameManager.reset()
	GameManager.change_screen.emit("title")
