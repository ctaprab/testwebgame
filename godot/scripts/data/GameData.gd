extends Node
# All static game data — direct port of data.js

const CHARACTERS: Array[Dictionary] = [
	{
		"id": "aldric",
		"name": "Aldric",
		"title": "The Iron Knight",
		"icon": "⚔",
		"stats": {"str": 5, "lck": 2, "wit": 2},
		"ability": {
			"name": "Ironclad March",
			"icon": "🛡",
			"description": "ก่อนทอดเต๋า: เคลื่อนที่ +6 ช่อง โดยไม่ต้องทอด และข้ามผลของงูในเทิร์นนี้",
			"timing": "pre-roll"
		}
	},
	{
		"id": "lysara",
		"name": "Lysara",
		"title": "The Moon Witch",
		"icon": "🌙",
		"stats": {"str": 1, "lck": 5, "wit": 3},
		"ability": {
			"name": "Hex Reversal",
			"icon": "🔮",
			"description": "หลังหยุดบนงู: เปลี่ยนงูตัวนั้นเป็นบันได ในเทิร์นนี้",
			"timing": "on-snake"
		}
	},
	{
		"id": "keth",
		"name": "Keth",
		"title": "The Shadow Rogue",
		"icon": "🗡",
		"stats": {"str": 3, "lck": 3, "wit": 5},
		"ability": {
			"name": "Shadow Step",
			"icon": "🌑",
			"description": "ก่อนทอดเต๋า: เลือกผู้เล่นคนหนึ่ง — teleport ไปช่องเดียวกับเขา",
			"timing": "pre-roll"
		}
	},
	{
		"id": "seraphel",
		"name": "Seraphel",
		"title": "The Dawn Oracle",
		"icon": "☀",
		"stats": {"str": 2, "lck": 4, "wit": 4},
		"ability": {
			"name": "Foresight",
			"icon": "👁",
			"description": "ก่อนทอดเต๋า: ทอด 2 ครั้ง แล้วเลือกผลใดก็ได้",
			"timing": "pre-roll"
		}
	}
]

const LADDERS: Dictionary = {
	4: 14, 9: 31, 20: 38, 28: 56,
	40: 59, 51: 67, 63: 81, 71: 91
}

const SNAKES: Dictionary = {
	17: 7, 35: 15, 46: 25, 54: 34,
	62: 43, 74: 53, 87: 24, 95: 73
}

const EVENT_TILES: Dictionary = {
	12: "fortune_goldenrain", 33: "fortune_fairy",
	58: "fortune_dragoneye",  82: "fortune_star",
	19: "curse_mist",         44: "curse_hex",
	69: "curse_ruins",        88: "curse_void",
	22: "gamble_wheel",       47: "gamble_dragon",
	65: "gamble_roulette",    79: "gamble_sky",
	15: "duel_crossroad",     38: "duel_arena",
	61: "duel_tribunal",      84: "duel_throne"
}

const EVENTS: Dictionary = {
	"fortune_goldenrain": {
		"icon": "⚡", "title": "Golden Rain", "type": "fortune",
		"flavor": "ฝนทองหลั่งลงจากฟ้า — โชคยิ่งสูง พระพรยิ่งหนา"
	},
	"fortune_fairy": {
		"icon": "⚡", "title": "Fairy Blessing", "type": "fortune",
		"flavor": "นางฟ้าประทานคำอวยพร"
	},
	"fortune_dragoneye": {
		"icon": "⚡", "title": "Dragon's Eye", "type": "fortune",
		"flavor": "ตามังกรเฝ้ามองคุณ"
	},
	"fortune_star": {
		"icon": "⚡", "title": "Star Alignment", "type": "fortune",
		"flavor": "ดวงดาวเรียงตัวเป็นใจคุณ"
	},
	"curse_mist": {
		"icon": "💀", "title": "Black Mist", "type": "curse",
		"flavor": "หมอกดำพันธนาการก้าวเดิน"
	},
	"curse_hex": {
		"icon": "💀", "title": "Witch's Hex", "type": "curse",
		"flavor": "คำสาปแม่มดเรียกหา"
	},
	"curse_ruins": {
		"icon": "💀", "title": "Falling Ruins", "type": "curse",
		"flavor": "ซากปรักหักพังถล่มลง"
	},
	"curse_void": {
		"icon": "💀", "title": "Void Rift", "type": "curse",
		"flavor": "รอยแยกแห่งความว่างเปล่า"
	},
	"gamble_wheel": {
		"icon": "🎲", "title": "Fortune's Wheel", "type": "gamble",
		"flavor": "วงล้อแห่งโชคหมุน — กล้าเสี่ยงไหม?",
		"safe":        {"delta": 3,  "label": "เดิน +3"},
		"push_success":{"delta": 8,  "label": "เดิน +8"},
		"push_fail":   {"delta": -5, "label": "ถอย -5"}
	},
	"gamble_dragon": {
		"icon": "🎲", "title": "Dragon's Gambit", "type": "gamble",
		"flavor": "มังกรท้าทาย — เดิมพันเหรียญสุดท้าย",
		"safe":        {"delta": 4,             "label": "เดิน +4"},
		"push_success":{"jump_nearest_ladder": true, "label": "กระโดดบันไดถัดไป"},
		"push_fail":   {"jump_nearest_snake": true,  "label": "ถอยไปหัวงูถัดไป"}
	},
	"gamble_roulette": {
		"icon": "🎲", "title": "Ancient Roulette", "type": "gamble",
		"flavor": "เลเซอร์โบราณหมุนรอบช้า ๆ",
		"safe":        {"delta": 3,   "label": "เดิน +3"},
		"push_success":{"delta": 10,  "label": "เดิน +10"},
		"push_fail":   {"delta": -7,  "label": "ถอย -7"}
	},
	"gamble_sky": {
		"icon": "🎲", "title": "Sky Dice", "type": "gamble",
		"flavor": "ลูกเต๋าฟ้าทอดเสียงดังก้องเมฆ",
		"safe":        {"delta": 5,        "label": "เดิน +5"},
		"push_success":{"delta": 15,       "label": "เดิน +15"},
		"push_fail":   {"teleport": 60,    "label": "ถอยไปช่อง 60"}
	},
	"duel_crossroad": {
		"icon": "⚔", "title": "Crossroads Clash", "type": "duel",
		"flavor": "ทางแยกแห่งดวงดาบ",
		"winner": {"delta": 4,  "label": "เดิน +4"},
		"loser":  {"delta": -2, "label": "ถอย -2"}
	},
	"duel_arena": {
		"icon": "⚔", "title": "Arena of Fate", "type": "duel", "push_variant": true,
		"flavor": "สังเวียนแห่งชะตา — กล้าเดิมพันสองเท่าไหม?",
		"winner":      {"delta": 6,  "label": "เดิน +6"},
		"loser":       {"delta": -4, "label": "ถอย -4"},
		"push_winner": {"delta": 12, "label": "เดิน +12"},
		"push_loser":  {"delta": -8, "label": "ถอย -8"}
	},
	"duel_tribunal": {
		"icon": "⚔", "title": "Dragon's Tribunal", "type": "duel",
		"flavor": "ศาลแห่งมังกรพิพากษา",
		"winner": {"delta": 5, "snake_shield": true, "label": "เดิน +5 + ข้ามงู 1 ครั้ง"},
		"loser":  {"delta": -5, "label": "ถอย -5"}
	},
	"duel_throne": {
		"icon": "⚔", "title": "Sky Throne Duel", "type": "duel", "push_variant": true,
		"flavor": "ดวลบนบัลลังก์เมฆา — รางวัลใหญ่ ความเสี่ยงใหญ่",
		"winner":      {"delta": 8,       "label": "เดิน +8"},
		"loser":       {"teleport": 70,   "label": "ถอยไปช่อง 70"},
		"push_winner": {"teleport": 95,   "label": "พุ่งไปช่อง 95"},
		"push_loser":  {"teleport": 55,   "label": "ตกไปช่อง 55"}
	}
}

func get_zone(cell: int) -> int:
	if cell <= 25: return 1
	if cell <= 50: return 2
	if cell <= 75: return 3
	return 4

func resolve_fortune(event_key: String, player: Dictionary) -> Dictionary:
	var lck: int = player.stats.lck
	match event_key:
		"fortune_goldenrain":
			var move: int = 1 if lck <= 2 else (3 if lck == 3 else 5)
			return {"type": "good", "message": "LCK %d → เดิน +%d ช่อง" % [lck, move], "delta": move}
		"fortune_fairy":
			if lck <= 2: return {"type": "neutral", "message": "LCK %d → ไม่มีผล" % lck, "delta": 0}
			if lck == 3: return {"type": "good", "message": "LCK 3 → ทอดเต๋าใหม่ ใช้ผลที่สูงกว่า", "request_reroll": true}
			return {"type": "good", "message": "LCK %d → เดิน +4 และข้ามงูครั้งถัดไป" % lck, "delta": 4, "snake_shield": true}
		"fortune_dragoneye":
			if lck <= 2: return {"type": "bad", "message": "LCK %d → ถอย -2" % lck, "delta": -2}
			if lck == 3: return {"type": "good", "message": "LCK 3 → เดิน +3", "delta": 3}
			return {"type": "good", "message": "LCK %d → กระโดดบันไดใกล้สุด" % lck, "jump_nearest_ladder": true}
		"fortune_star":
			if lck <= 2: return {"type": "good", "message": "LCK %d → เดิน +2" % lck, "delta": 2}
			if lck == 3: return {"type": "good", "message": "LCK 3 → เดิน +5", "delta": 5}
			return {"type": "good", "message": "LCK %d → เลือกเดิน 1-6 ช่อง" % lck, "choose_move": true}
	return {}

func resolve_curse(event_key: String, player: Dictionary) -> Dictionary:
	var lck: int = player.stats.lck
	match event_key:
		"curse_mist":
			var move: int = -5 if lck <= 2 else (-3 if lck == 3 else -1)
			return {"type": "bad", "message": "LCK %d → ถอย %d" % [lck, move], "delta": move}
		"curse_hex":
			if lck <= 2: return {"type": "bad", "message": "LCK %d → เสีย 1 เทิร์น" % lck, "skip_turn": true}
			if lck == 3: return {"type": "neutral", "message": "LCK 3 → ทอดเต๋า: คี่=เสียเทิร์น, คู่=ไม่มีผล", "request_parity": true}
			return {"type": "good", "message": "LCK %d → ไม่มีผล" % lck, "delta": 0}
		"curse_ruins":
			if lck <= 2: return {"type": "bad", "message": "LCK %d → ถอยไปช่อง 51" % lck, "teleport": 51}
			if lck == 3: return {"type": "bad", "message": "LCK 3 → ถอย -6", "delta": -6}
			return {"type": "bad", "message": "LCK %d → ถอย -2" % lck, "delta": -2}
		"curse_void":
			if lck <= 2: return {"type": "bad", "message": "LCK %d → ถอยไปช่อง 50" % lck, "teleport": 50}
			if lck == 3: return {"type": "bad", "message": "LCK 3 → ถอย -8", "delta": -8}
			return {"type": "bad", "message": "LCK %d → ถอย -3" % lck, "delta": -3}
	return {}

func find_nearest_ladder_ahead(pos: int) -> int:
	var keys: Array = LADDERS.keys().filter(func(k): return k > pos)
	keys.sort()
	return keys[0] if keys.size() > 0 else -1

func find_nearest_snake_ahead(pos: int) -> int:
	var keys: Array = SNAKES.keys().filter(func(k): return k > pos)
	keys.sort()
	return keys[0] if keys.size() > 0 else -1
