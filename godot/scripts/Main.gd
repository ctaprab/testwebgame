extends Node

const TitleScreen    := preload("res://scenes/TitleScreen.tscn")
const CharacterSelect := preload("res://scenes/CharacterSelect.tscn")
const GameBoard      := preload("res://scenes/GameBoard.tscn")
const VictoryScreen  := preload("res://scenes/VictoryScreen.tscn")

var _current: Node = null

func _ready() -> void:
	GameManager.change_screen.connect(_on_change_screen)
	_show("title")

func _show(name: String) -> void:
	if _current:
		_current.queue_free()
		_current = null
	match name:
		"title":   _current = TitleScreen.instantiate()
		"select":  _current = CharacterSelect.instantiate()
		"game":    _current = GameBoard.instantiate()
		"victory": _current = VictoryScreen.instantiate()
	if _current:
		add_child(_current)

func _on_change_screen(name: String) -> void:
	_show(name)
