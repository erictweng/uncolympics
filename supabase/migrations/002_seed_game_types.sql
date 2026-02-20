-- Seed built-in game types

INSERT INTO game_types (tournament_id, name, emoji, description, player_inputs, referee_inputs, title_definitions) VALUES

-- Beer Pong
(NULL, 'Beer Pong', '🍺', 'Classic beer pong - sink cups into opponents beer',
'[
  {"key": "cups_made", "label": "Cups Made", "type": "number"},
  {"key": "last_cup", "label": "Sank Last Cup", "type": "boolean"}
]',
'[
  {"key": "winning_team", "label": "Winning Team", "type": "team_select"}
]',
'[
  {
    "name": "Sniper",
    "desc": "Made the most cups",
    "isFunny": false,
    "condition": {"type": "highest", "stat": "cups_made"}
  },
  {
    "name": "Emotional Support",
    "desc": "Made 0 cups",
    "isFunny": true,
    "condition": {"type": "exact", "stat": "cups_made", "value": 0}
  },
  {
    "name": "Clutch Gene",
    "desc": "Sank the last cup",
    "isFunny": false,
    "condition": {"type": "flag", "stat": "last_cup"}
  }
]'),

-- Rage Cage
(NULL, 'Rage Cage', '🥤', 'Fast-paced bouncing game around the circle',
'[
  {"key": "sinks", "label": "Successful Sinks", "type": "number"}
]',
'[
  {"key": "winning_team", "label": "Winning Team", "type": "team_select"}
]',
'[
  {
    "name": "Rage Monster",
    "desc": "Most successful sinks",
    "isFunny": false,
    "condition": {"type": "highest", "stat": "sinks"}
  },
  {
    "name": "Pacifist",
    "desc": "Fewest successful sinks",
    "isFunny": true,
    "condition": {"type": "lowest", "stat": "sinks"}
  }
]'),

-- Mario Kart
(NULL, 'Mario Kart', '🏎️', 'Multiple races, track placements per player',
'[
  {"key": "placement", "label": "Race Placement (1-4)", "type": "number", "min": 1, "max": 4}
]',
'[]',
'[
  {
    "name": "Speed Demon",
    "desc": "Most 1st place finishes",
    "isFunny": false,
    "condition": {"type": "highest", "stat": "first_places"}
  },
  {
    "name": "Scenic Route",
    "desc": "Most last place finishes",
    "isFunny": true,
    "condition": {"type": "highest", "stat": "last_places"}
  },
  {
    "name": "Consistent",
    "desc": "All same placement",
    "isFunny": false,
    "condition": {"type": "flag", "stat": "consistent_placement"}
  }
]'),

-- Smash Bros
(NULL, 'Smash Bros', '👊', 'Fighting game tournament with KO tracking',
'[
  {"key": "kos", "label": "Total KOs", "type": "number"},
  {"key": "last_alive", "label": "Last One Standing", "type": "boolean"}
]',
'[
  {"key": "match_winner", "label": "Match Winner", "type": "player_select"}
]',
'[
  {
    "name": "Destroyer",
    "desc": "Most KOs",
    "isFunny": false,
    "condition": {"type": "highest", "stat": "kos"}
  },
  {
    "name": "Survivor",
    "desc": "Last alive most often",
    "isFunny": false,
    "condition": {"type": "highest", "stat": "last_alive_count"}
  },
  {
    "name": "Glass Cannon",
    "desc": "High KOs but also high deaths",
    "isFunny": true,
    "condition": {"type": "flag", "stat": "glass_cannon"}
  }
]'),

-- Pickleball
(NULL, 'Pickleball', '🏓', 'Team sport with rally and speed tracking',
'[]',
'[
  {"key": "team_scores", "label": "Team Scores", "type": "team_scores"},
  {"key": "longest_rally", "label": "Longest Rally Player", "type": "player_select"},
  {"key": "fastest_point", "label": "Fastest Point Player", "type": "player_select"}
]',
'[
  {
    "name": "The Wall",
    "desc": "Part of longest rally",
    "isFunny": false,
    "condition": {"type": "flag", "stat": "longest_rally"}
  },
  {
    "name": "Lightning",
    "desc": "Scored fastest point",
    "isFunny": false,
    "condition": {"type": "flag", "stat": "fastest_point"}
  }
]'),

-- Cornhole
(NULL, 'Cornhole', '🎯', 'Toss bags into holes for points',
'[
  {"key": "bags_in_hole", "label": "Bags in Hole", "type": "number"}
]',
'[
  {"key": "winning_team", "label": "Winning Team", "type": "team_select"}
]',
'[
  {
    "name": "Bullseye",
    "desc": "Most bags in hole",
    "isFunny": false,
    "condition": {"type": "highest", "stat": "bags_in_hole"}
  },
  {
    "name": "Throwing Blind",
    "desc": "Zero bags in hole",
    "isFunny": true,
    "condition": {"type": "exact", "stat": "bags_in_hole", "value": 0}
  }
]'),

-- Obstacle Course
(NULL, 'Obstacle Course', '🏃', 'Timed physical challenges',
'[]',
'[
  {"key": "player_times", "label": "Player Times (seconds)", "type": "player_times"}
]',
'[
  {
    "name": "Flash",
    "desc": "Fastest completion time",
    "isFunny": false,
    "condition": {"type": "lowest", "stat": "completion_time"}
  },
  {
    "name": "Scenic Route",
    "desc": "Slowest completion time",
    "isFunny": true,
    "condition": {"type": "highest", "stat": "completion_time"}
  },
  {
    "name": "Photo Finish",
    "desc": "Closest times to another player",
    "isFunny": false,
    "condition": {"type": "flag", "stat": "photo_finish"}
  }
]');