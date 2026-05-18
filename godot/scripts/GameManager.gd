extends Node
# Central game state machine — coordinates all screens via signals

enum TurnState {
	IDLE,
	AWAITING_ROLL,
	AWAITING_FORESIGHT_1,
	AWAITING_FORESIGHT_2,
	RESOLVING,
	AWAITING_MODAL,
	GAME_OVER
}

# ── Signals ──────────────────────────────────────────────────────────────────
signal change_screen(name: String)
signal board_updated()
signal players_updated()
signal turn_started(player: Dictionary)
signal log_added(message: String)
signal show_modal_requested(config: Dictionary)
signal close_modal_requested()

# ── State ─────────────────────────────────────────────────────────────────────
var player_count: int = 0
var players: Array[Dictionary] = []
var current_idx: int = 0
var current_select_idx: int = 0
var pending_char: Dictionary = {}
var game_log: Array[String] = []

var turn_state: TurnState = TurnState.IDLE
var foresight_rolls: Array[int] = []
var duel_context: Dictionary = {}
var pending_gamble_event: String = ""
var pending_fortune_result: Dictionary = {}

# ── Helpers ───────────────────────────────────────────────────────────────────
func current_player() -> Dictionary:
	return players[current_idx]

func log_event(msg: String) -> void:
	game_log.append(msg)
	log_added.emit(msg)

func reset() -> void:
	player_count = 0
	players.clear()
	current_idx = 0
	current_select_idx = 0
	pending_char = {}
	game_log.clear()
	turn_state = TurnState.IDLE
	foresight_rolls.clear()
	duel_context.clear()

# ── Setup flow ────────────────────────────────────────────────────────────────
func set_player_count(n: int) -> void:
	player_count = n
	players.clear()
	current_select_idx = 0
	change_screen.emit("select")

func confirm_character(ch: Dictionary) -> void:
	players.append({
		"idx": current_select_idx,
		"character": ch,
		"stats": ch.stats.duplicate(),
		"pos": 1,
		"ability_used": false,
		"rerolls_left": ch.stats.wit,
		"skip_next_turn": false,
		"snake_shield": false
	})
	current_select_idx += 1
	if current_select_idx >= player_count:
		_start_game()
	else:
		players_updated.emit()

func _start_game() -> void:
	current_idx = 0
	game_log.clear()
	log_event("เกมเริ่มต้น — ผู้เล่น %d คน" % player_count)
	change_screen.emit("game")
	await get_tree().process_frame
	_begin_turn()

# ── Turn lifecycle ────────────────────────────────────────────────────────────
func _begin_turn() -> void:
	var p: Dictionary = current_player()
	if p.skip_next_turn:
		p.skip_next_turn = false
		log_event("%s เสียเทิร์น (Witch's Hex)" % p.character.name)
		_end_turn()
		return
	turn_state = TurnState.AWAITING_ROLL
	foresight_rolls.clear()
	duel_context.clear()
	turn_started.emit(p)
	players_updated.emit()

func _end_turn() -> void:
	current_idx = (current_idx + 1) % player_count
	_begin_turn()

# ── Dice input ────────────────────────────────────────────────────────────────
func on_dice_roll(roll: int) -> void:
	match turn_state:
		TurnState.AWAITING_ROLL:
			turn_state = TurnState.RESOLVING
			_perform_move(current_player(), roll, {})
		TurnState.AWAITING_FORESIGHT_1:
			foresight_rolls.append(roll)
			turn_state = TurnState.AWAITING_FORESIGHT_2
			log_event("Foresight ครั้งที่ 1: %d" % roll)
		TurnState.AWAITING_FORESIGHT_2:
			foresight_rolls.append(roll)
			log_event("Foresight ครั้งที่ 2: %d" % roll)
			_show_foresight_choice()

# ── Ability ───────────────────────────────────────────────────────────────────
func use_ability(player_idx: int) -> void:
	var p: Dictionary = players[player_idx]
	if p.ability_used or player_idx != current_idx: return
	var ch_id: String = p.character.id
	match ch_id:
		"aldric":
			p.ability_used = true
			turn_state = TurnState.RESOLVING
			log_event("🛡 %s ใช้ Ironclad March → +6 และข้ามงู" % p.character.name)
			players_updated.emit()
			_perform_move(p, 6, {"ignore_snakes": true})
		"seraphel":
			p.ability_used = true
			turn_state = TurnState.AWAITING_FORESIGHT_1
			foresight_rolls.clear()
			log_event("👁 %s ใช้ Foresight — ทอดเต๋า 2 ครั้ง" % p.character.name)
			players_updated.emit()
			show_modal_requested.emit({
				"icon": "👁", "title": "Foresight",
				"body": "ทอด D6 ทั้งหมด 2 ครั้ง แล้วเลือกผล\n\nป้อนผลครั้งที่ 1 ด้วยปุ่มเต๋าด้านล่าง",
				"actions": [], "show_dice": true
			})
		"keth":
			var others: Array = players.filter(func(q): return q.idx != p.idx)
			if others.is_empty(): return
			var actions: Array = others.map(func(opp):
				return {
					"label": "%s (ช่อง %d)" % [opp.character.name, opp.pos],
					"style": "neutral",
					"callback": Callable(self, "_keth_step").bind(p, opp)
				}
			)
			show_modal_requested.emit({
				"icon": "🌑", "title": "Shadow Step",
				"body": "เลือกเป้าหมาย — Keth จะ teleport ไปช่องเดียวกัน",
				"actions": actions
			})

func _keth_step(attacker: Dictionary, target: Dictionary) -> void:
	close_modal_requested.emit()
	attacker.ability_used = true
	attacker.pos = target.pos
	log_event("🌑 Keth ใช้ Shadow Step → ย้ายไปช่อง %d (ตาม %s)" % [target.pos, target.character.name])
	board_updated.emit()
	players_updated.emit()
	turn_state = TurnState.AWAITING_ROLL

func _show_foresight_choice() -> void:
	var r1: int = foresight_rolls[0]
	var r2: int = foresight_rolls[1]
	show_modal_requested.emit({
		"icon": "👁", "title": "Foresight — เลือกผล",
		"body": "ทอดได้ %d และ %d — เลือกผลที่ต้องการใช้" % [r1, r2],
		"actions": [
			{"label": "ใช้ %d" % r1, "style": "neutral",
			 "callback": Callable(self, "_foresight_pick").bind(r1)},
			{"label": "ใช้ %d" % r2, "style": "neutral",
			 "callback": Callable(self, "_foresight_pick").bind(r2)}
		]
	})

func _foresight_pick(roll: int) -> void:
	close_modal_requested.emit()
	turn_state = TurnState.RESOLVING
	_perform_move(current_player(), roll, {})

# ── Movement ──────────────────────────────────────────────────────────────────
func _perform_move(player: Dictionary, distance: int, options: Dictionary) -> void:
	var target: int = player.pos + distance
	if target > 100:
		target = 100 - (target - 100)
	if target < 1:
		target = 1
	var old_pos: int = player.pos
	player.pos = target
	log_event("%s เดินจาก %d ไปยัง %d (%s%d)" % [
		player.character.name, old_pos, target,
		"+" if distance >= 0 else "", distance
	])
	board_updated.emit()
	if player.pos == 100 and not options.get("suppress_win", false):
		await get_tree().create_timer(0.5).timeout
		_declare_victory(player)
		return
	if options.get("skip_landing", false):
		await get_tree().create_timer(0.5).timeout
		_end_turn()
		return
	await get_tree().create_timer(0.4).timeout
	_resolve_landing(player, options)

func _resolve_landing(player: Dictionary, options: Dictionary) -> void:
	# Ladder
	if GameData.LADDERS.has(player.pos):
		var dest: int = GameData.LADDERS[player.pos]
		log_event("🪜 %s ปีนบันได %d → %d!" % [player.character.name, player.pos, dest])
		player.pos = dest
		board_updated.emit()
		if player.pos == 100:
			await get_tree().create_timer(0.4).timeout
			_declare_victory(player)
			return
		await get_tree().create_timer(0.4).timeout
		_resolve_landing(player, options)
		return

	# Snake
	if GameData.SNAKES.has(player.pos) and not options.get("ignore_snakes", false):
		if player.snake_shield:
			player.snake_shield = false
			log_event("🛡 %s ใช้ Snake Shield — ข้ามงูที่ %d" % [player.character.name, player.pos])
			players_updated.emit()
			await get_tree().create_timer(0.4).timeout
			_end_turn()
			return
		if player.character.id == "lysara" and not player.ability_used:
			_offer_hex_reversal(player)
			return
		var dest: int = GameData.SNAKES[player.pos]
		log_event("🐍 %s โดนงูกัด %d → %d!" % [player.character.name, player.pos, dest])
		player.pos = dest
		board_updated.emit()
		await get_tree().create_timer(0.4).timeout
		_resolve_landing(player, options)
		return

	# Event
	if GameData.EVENT_TILES.has(player.pos):
		_trigger_event(player, GameData.EVENT_TILES[player.pos])
		return

	await get_tree().create_timer(0.3).timeout
	_end_turn()

func _offer_hex_reversal(player: Dictionary) -> void:
	var dest: int = GameData.SNAKES[player.pos]
	show_modal_requested.emit({
		"icon": "🔮", "title": "Hex Reversal",
		"body": "%s หยุดบนงูที่ช่อง %d (จะลงไป %d)\nต้องการใช้ Hex Reversal เพื่อเปลี่ยนงูเป็นบันไดไหม?" % [
			player.character.name, player.pos, dest],
		"actions": [
			{"label": "ใช้ Hex Reversal", "style": "neutral",
			 "callback": Callable(self, "_hex_reversal_yes").bind(player)},
			{"label": "ไม่ใช้", "style": "ghost",
			 "callback": Callable(self, "_hex_reversal_no").bind(player)}
		]
	})

func _hex_reversal_yes(player: Dictionary) -> void:
	close_modal_requested.emit()
	player.ability_used = true
	var snake_dest: int = GameData.SNAKES[player.pos]
	var move_dist: int = player.pos - snake_dest
	var new_pos: int = min(100, player.pos + move_dist)
	log_event("🔮 %s ใช้ Hex Reversal! %d → %d" % [player.character.name, player.pos, new_pos])
	player.pos = new_pos
	board_updated.emit()
	players_updated.emit()
	if player.pos == 100:
		await get_tree().create_timer(0.4).timeout
		_declare_victory(player)
		return
	await get_tree().create_timer(0.4).timeout
	_resolve_landing(player, {})

func _hex_reversal_no(player: Dictionary) -> void:
	close_modal_requested.emit()
	var dest: int = GameData.SNAKES[player.pos]
	log_event("🐍 %s โดนงูกัด %d → %d" % [player.character.name, player.pos, dest])
	player.pos = dest
	board_updated.emit()
	await get_tree().create_timer(0.4).timeout
	_resolve_landing(player, {})

# ── Events ────────────────────────────────────────────────────────────────────
func _trigger_event(player: Dictionary, event_key: String) -> void:
	var ev: Dictionary = GameData.EVENTS[event_key]
	match ev.type:
		"fortune", "curse":
			var result: Dictionary = (
				GameData.resolve_fortune(event_key, player)
				if ev.type == "fortune" else
				GameData.resolve_curse(event_key, player)
			)
			_show_fortune_curse_modal(player, ev, result)
		"gamble":
			_show_gamble_modal(player, event_key)
		"duel":
			_show_duel_target_modal(player, event_key)

func _show_fortune_curse_modal(player: Dictionary, ev: Dictionary, result: Dictionary) -> void:
	var body: String = ev.flavor + "\n\n" + result.message
	if result.get("request_reroll", false):
		show_modal_requested.emit({
			"icon": ev.icon, "title": ev.title,
			"body": body + "\n\nทอดเต๋าใหม่ แล้วป้อนผล (ใช้ผลที่สูงกว่า):",
			"actions": [], "show_dice": true,
			"dice_callback": Callable(self, "_fairy_reroll").bind(player)
		})
		return
	if result.get("request_parity", false):
		show_modal_requested.emit({
			"icon": ev.icon, "title": ev.title,
			"body": body + "\n\nทอดเต๋า: คี่=เสียเทิร์นถัดไป, คู่=ปลอดภัย",
			"actions": [], "show_dice": true,
			"dice_callback": Callable(self, "_hex_parity").bind(player)
		})
		return
	if result.get("choose_move", false):
		var actions: Array = []
		for n in [1,2,3,4,5,6]:
			actions.append({"label": "+%d" % n, "style": "neutral",
				"callback": Callable(self, "_apply_choose_move").bind(player, n)})
		show_modal_requested.emit({
			"icon": ev.icon, "title": ev.title,
			"body": body + "\n\nเลือกเดิน 1-6 ช่อง:",
			"actions": actions
		})
		return
	show_modal_requested.emit({
		"icon": ev.icon, "title": ev.title, "body": body,
		"actions": [{"label": "รับผล", "style": "neutral",
			"callback": Callable(self, "_apply_outcome").bind(player, result)}]
	})

func _fairy_reroll(roll: int, player: Dictionary) -> void:
	close_modal_requested.emit()
	log_event("Fairy Blessing: ทอดใหม่ได้ %d" % roll)
	_perform_move(player, roll, {})

func _hex_parity(roll: int, player: Dictionary) -> void:
	close_modal_requested.emit()
	if roll % 2 == 1:
		player.skip_next_turn = true
		log_event("Hex parity: ทอดได้ %d (คี่) — %s เสียเทิร์นถัดไป" % [roll, player.character.name])
	else:
		log_event("Hex parity: ทอดได้ %d (คู่) — ปลอดภัย" % roll)
	_end_turn()

func _apply_choose_move(player: Dictionary, n: int) -> void:
	close_modal_requested.emit()
	_perform_move(player, n, {})

func _apply_outcome(player: Dictionary, outcome: Dictionary) -> void:
	close_modal_requested.emit()
	if outcome.has("teleport"):
		log_event("%s ถูกย้ายไปช่อง %d" % [player.character.name, outcome.teleport])
		player.pos = outcome.teleport
		board_updated.emit()
		if player.pos == 100:
			await get_tree().create_timer(0.4).timeout
			_declare_victory(player)
			return
		await get_tree().create_timer(0.4).timeout
		_resolve_landing(player, {})
		return
	if outcome.get("jump_nearest_ladder", false):
		var ls: int = GameData.find_nearest_ladder_ahead(player.pos)
		if ls != -1:
			log_event("%s กระโดดไปหัวบันไดที่ช่อง %d" % [player.character.name, ls])
			player.pos = ls
			board_updated.emit()
			await get_tree().create_timer(0.4).timeout
			_resolve_landing(player, {})
		else:
			log_event("ไม่มีบันไดด้านหน้า — ไม่มีผล")
			_end_turn()
		return
	if outcome.get("jump_nearest_snake", false):
		var ss: int = GameData.find_nearest_snake_ahead(player.pos)
		if ss != -1:
			log_event("%s ถูกพาไปหัวงูที่ช่อง %d" % [player.character.name, ss])
			player.pos = ss
			board_updated.emit()
			await get_tree().create_timer(0.4).timeout
			_resolve_landing(player, {})
		else:
			log_event("ไม่มีงูด้านหน้า — ไม่มีผล")
			_end_turn()
		return
	if outcome.get("snake_shield", false):
		player.snake_shield = true
		log_event("%s ได้รับ Snake Shield" % player.character.name)
		players_updated.emit()
	if outcome.get("skip_turn", false):
		player.skip_next_turn = true
	if outcome.get("delta", 0) != 0:
		_perform_move(player, outcome.delta, {})
		return
	_end_turn()

# ── Gamble ────────────────────────────────────────────────────────────────────
func _show_gamble_modal(player: Dictionary, event_key: String) -> void:
	var ev: Dictionary = GameData.EVENTS[event_key]
	show_modal_requested.emit({
		"icon": ev.icon, "title": ev.title,
		"body": ev.flavor + "\n\nSafe: " + ev.safe.label +
				"\nPush ✓ (≥4): " + ev.push_success.label +
				"\nPush ✗ (≤3): " + ev.push_fail.label,
		"actions": [
			{"label": "Safe", "style": "safe",
			 "callback": Callable(self, "_gamble_safe").bind(player, ev)},
			{"label": "Push Your Luck", "style": "risky",
			 "callback": Callable(self, "_gamble_push_roll").bind(player, event_key)}
		]
	})

func _gamble_safe(player: Dictionary, ev: Dictionary) -> void:
	close_modal_requested.emit()
	log_event("%s เลือก Safe ที่ %s" % [player.character.name, ev.title])
	_apply_outcome(player, ev.safe)

func _gamble_push_roll(player: Dictionary, event_key: String) -> void:
	var ev: Dictionary = GameData.EVENTS[event_key]
	show_modal_requested.emit({
		"icon": "🎲", "title": "Push: %s" % ev.title,
		"body": "ทอดเต๋า D6 — ผล 4-6 = ชนะ, 1-3 = แพ้\n\nป้อนผลการทอด:",
		"actions": [], "show_dice": true,
		"dice_callback": Callable(self, "_gamble_resolve").bind(player, event_key)
	})

func _gamble_resolve(roll: int, player: Dictionary, event_key: String) -> void:
	close_modal_requested.emit()
	var ev: Dictionary = GameData.EVENTS[event_key]
	var success: bool = roll >= 4
	var outcome: Dictionary = ev.push_success if success else ev.push_fail
	log_event("%s Push ที่ %s — ทอดได้ %d (%s)" % [
		player.character.name, ev.title, roll,
		"สำเร็จ" if success else "ล้มเหลว"
	])
	if player.rerolls_left > 0:
		_offer_reroll(player, roll, Callable(self, "_gamble_after_reroll").bind(player, event_key))
	else:
		_apply_outcome(player, outcome)

func _gamble_after_reroll(final_roll: int, player: Dictionary, event_key: String) -> void:
	var ev: Dictionary = GameData.EVENTS[event_key]
	var outcome: Dictionary = ev.push_success if final_roll >= 4 else ev.push_fail
	_apply_outcome(player, outcome)

# ── Duel ──────────────────────────────────────────────────────────────────────
func _show_duel_target_modal(player: Dictionary, event_key: String) -> void:
	var ev: Dictionary = GameData.EVENTS[event_key]
	var others: Array = players.filter(func(p): return p.idx != player.idx)
	if others.is_empty():
		log_event("ไม่มีคู่ดวล — Event ไม่มีผล")
		_end_turn()
		return
	if ev.get("push_variant", false):
		show_modal_requested.emit({
			"icon": ev.icon, "title": ev.title,
			"body": ev.flavor + "\n\nเลือกประเภทดวล:\nNormal: ชนะ %s / แพ้ %s\nPush: ชนะ %s / แพ้ %s" % [
				ev.winner.label, ev.loser.label,
				ev.push_winner.label, ev.push_loser.label],
			"actions": [
				{"label": "Normal", "style": "safe",
				 "callback": Callable(self, "_duel_pick_target").bind(player, event_key, false)},
				{"label": "Push", "style": "risky",
				 "callback": Callable(self, "_duel_pick_target").bind(player, event_key, true)}
			]
		})
	else:
		_duel_pick_target(player, event_key, false)

func _duel_pick_target(player: Dictionary, event_key: String, push: bool) -> void:
	close_modal_requested.emit()
	var ev: Dictionary = GameData.EVENTS[event_key]
	var others: Array = players.filter(func(p): return p.idx != player.idx)
	var actions: Array = others.map(func(opp):
		return {"label": "%s (P%d) · STR %d" % [opp.character.name, opp.idx + 1, opp.stats.str],
				"style": "neutral",
				"callback": Callable(self, "_duel_start").bind(player, opp, event_key, push)}
	)
	show_modal_requested.emit({
		"icon": ev.icon, "title": "%s %s" % [ev.title, "(Push)" if push else ""],
		"body": "เลือกคู่ต่อสู้:", "actions": actions
	})

func _duel_start(attacker: Dictionary, defender: Dictionary, event_key: String, push: bool) -> void:
	close_modal_requested.emit()
	duel_context = {"event_key": event_key, "attacker_idx": attacker.idx,
		"defender_idx": defender.idx, "push": push,
		"attacker_roll": -1, "defender_roll": -1}
	_duel_prompt_roll("attacker")

func _duel_prompt_roll(who: String) -> void:
	var ctx: Dictionary = duel_context
	var p: Dictionary = players[ctx.attacker_idx if who == "attacker" else ctx.defender_idx]
	show_modal_requested.emit({
		"icon": "⚔", "title": "Duel — %s ทอด" % p.character.name,
		"body": "%s (STR %d) ทอดเต๋า D6 แล้วป้อนผล\nรวม = STR + เต๋า" % [p.character.name, p.stats.str],
		"actions": [], "show_dice": true,
		"dice_callback": Callable(self, "_duel_roll_received").bind(who)
	})

func _duel_roll_received(roll: int, who: String) -> void:
	close_modal_requested.emit()
	var ctx: Dictionary = duel_context
	if who == "attacker":
		ctx.attacker_roll = roll
		var att: Dictionary = players[ctx.attacker_idx]
		log_event("%s ทอดได้ %d + STR %d = %d" % [att.character.name, roll, att.stats.str, roll + att.stats.str])
		_duel_prompt_roll("defender")
	else:
		ctx.defender_roll = roll
		var def: Dictionary = players[ctx.defender_idx]
		log_event("%s ทอดได้ %d + STR %d = %d" % [def.character.name, roll, def.stats.str, roll + def.stats.str])
		_duel_resolve()

func _duel_resolve() -> void:
	var ctx: Dictionary = duel_context
	var ev: Dictionary = GameData.EVENTS[ctx.event_key]
	var att: Dictionary = players[ctx.attacker_idx]
	var def: Dictionary = players[ctx.defender_idx]
	var a_total: int = ctx.attacker_roll + att.stats.str
	var d_total: int = ctx.defender_roll + def.stats.str
	var winner: Dictionary = att if a_total >= d_total else def
	var loser: Dictionary = def if a_total >= d_total else att
	var win_out: Dictionary = ev.push_winner if ctx.push else ev.winner
	var lose_out: Dictionary = ev.push_loser if ctx.push else ev.loser
	show_modal_requested.emit({
		"icon": "⚔", "title": "%s — ผล" % ev.title,
		"body": "%s ได้ %d vs %s ได้ %d\n\nชนะ (%s): %s\nแพ้ (%s): %s" % [
			att.character.name, a_total, def.character.name, d_total,
			winner.character.name, win_out.label,
			loser.character.name, lose_out.label],
		"actions": [{"label": "รับผล", "style": "neutral",
			"callback": Callable(self, "_duel_apply").bind(winner, loser, win_out, lose_out)}]
	})

func _duel_apply(winner: Dictionary, loser: Dictionary, win_out: Dictionary, lose_out: Dictionary) -> void:
	close_modal_requested.emit()
	log_event("Duel: %s ชนะ %s" % [winner.character.name, loser.character.name])
	if win_out.get("snake_shield", false): winner.snake_shield = true
	if lose_out.get("snake_shield", false): loser.snake_shield = true
	players_updated.emit()
	await _apply_duel_move(winner, win_out)
	await _apply_duel_move(loser, lose_out)
	_end_turn()

func _apply_duel_move(player: Dictionary, out: Dictionary) -> void:
	if out.has("teleport"):
		player.pos = out.teleport
		board_updated.emit()
		log_event("%s ย้ายไปช่อง %d" % [player.character.name, out.teleport])
		await get_tree().create_timer(0.3).timeout
	elif out.get("delta", 0) != 0:
		var target: int = player.pos + out.delta
		if target > 100: target = 100 - (target - 100)
		if target < 1: target = 1
		log_event("%s เดิน %s%d → ช่อง %d" % [
			player.character.name, "+" if out.delta > 0 else "", out.delta, target])
		player.pos = target
		board_updated.emit()
		await get_tree().create_timer(0.3).timeout

# ── Re-roll ───────────────────────────────────────────────────────────────────
func _offer_reroll(player: Dictionary, current_roll: int, final_cb: Callable) -> void:
	if player.rerolls_left <= 0:
		final_cb.call(current_roll)
		return
	show_modal_requested.emit({
		"icon": "🎲", "title": "ทอดใหม่?",
		"body": "%s ทอดได้ %d\nมี Re-roll เหลือ %d ครั้ง — ต้องการทอดใหม่ไหม?" % [
			player.character.name, current_roll, player.rerolls_left],
		"actions": [
			{"label": "ใช้ %d" % current_roll, "style": "safe",
			 "callback": Callable(self, "_reroll_keep").bind(player, current_roll, final_cb)},
			{"label": "ทอดใหม่ (-1 Re-roll)", "style": "risky",
			 "callback": Callable(self, "_reroll_do").bind(player, final_cb)}
		]
	})

func _reroll_keep(player: Dictionary, roll: int, final_cb: Callable) -> void:
	close_modal_requested.emit()
	final_cb.call(roll)

func _reroll_do(player: Dictionary, final_cb: Callable) -> void:
	close_modal_requested.emit()
	player.rerolls_left -= 1
	players_updated.emit()
	log_event("%s ใช้ Re-roll (เหลือ %d)" % [player.character.name, player.rerolls_left])
	show_modal_requested.emit({
		"icon": "🎲", "title": "ทอดใหม่",
		"body": "ทอด D6 อีกครั้ง แล้วป้อนผล:",
		"actions": [], "show_dice": true,
		"dice_callback": Callable(self, "_reroll_result").bind(player, final_cb)
	})

func _reroll_result(new_roll: int, player: Dictionary, final_cb: Callable) -> void:
	close_modal_requested.emit()
	log_event("Re-roll: ทอดได้ %d" % new_roll)
	_offer_reroll(player, new_roll, final_cb)

# ── Victory ───────────────────────────────────────────────────────────────────
func _declare_victory(player: Dictionary) -> void:
	turn_state = TurnState.GAME_OVER
	log_event("🏆 %s ชนะ!" % player.character.name)
	change_screen.emit("victory")
