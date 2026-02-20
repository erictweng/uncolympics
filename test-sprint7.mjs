#!/usr/bin/env node
/**
 * Sprint 7 Test Suite — Awards Ceremony
 * Tests: global title calculation, ceremony data API, global title saving
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uohruuyjmcgemdyxhnnz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaHJ1dXlqbWNnZW1keXhobm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjQyMTgsImV4cCI6MjA4NzE0MDIxOH0.kPBhoTNOAD5z7qLhOMl29VggJdsPvCuZ4_3lFJDLgks'

const DEVICE_ID = `test-s7-${Date.now()}`
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { 'x-device-id': DEVICE_ID } }
})

let passed = 0
let failed = 0
const results = []

function test(name, fn) {
  return fn().then(() => {
    passed++
    results.push({ name, status: '✅' })
    console.log(`✅ ${name}`)
  }).catch(err => {
    failed++
    results.push({ name, status: '❌', error: err.message })
    console.log(`❌ ${name}: ${err.message}`)
  })
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

// Test state
let tournamentId, teamAId, teamBId, player1Id, player2Id, player3Id, player4Id
let game1Id, game2Id
const roomCode = 'S7T' + Math.floor(Math.random() * 100)

async function setup() {
  console.log('\n🔧 Setting up test tournament...\n')

  // Create tournament
  const { data: t, error: tErr } = await supabase.from('tournaments').insert({
    name: 'Sprint 7 Test', room_code: roomCode, num_games: 2, time_est_min: 40, status: 'completed'
  }).select().single()
  console.log('Tournament insert result:', { data: t, error: tErr })
  if (tErr) throw new Error(`Tournament create failed: ${tErr.message}`)
  if (!t) throw new Error('Tournament insert returned null data')
  tournamentId = t.id

  // Create teams
  const { data: tA, error: tAErr } = await supabase.from('teams').insert({ tournament_id: tournamentId, name: 'Alpha', total_points: 0 }).select().single()
  console.log('Team A:', { data: tA, error: tAErr })
  if (tAErr) throw new Error(`Team A failed: ${tAErr.message}`)
  const { data: tB, error: tBErr } = await supabase.from('teams').insert({ tournament_id: tournamentId, name: 'Beta', total_points: 0 }).select().single()
  console.log('Team B:', { data: tB, error: tBErr })
  if (tBErr) throw new Error(`Team B failed: ${tBErr.message}`)
  teamAId = tA.id
  teamBId = tB.id

  // Create players
  const mkPlayer = async (name, teamId, role) => {
    const { data, error } = await supabase.from('players').insert({
      tournament_id: tournamentId, name, device_id: `s7-${name}-${Date.now()}`, team_id: teamId, role, is_leader: false
    }).select().single()
    if (error) throw new Error(`Player ${name} failed: ${error.message}`)
    return data.id
  }
  console.log('Creating players...')
  // Use the same device_id as the client for referee (RLS checks)
  const { data: refPlayer, error: refErr } = await supabase.from('players').insert({
    tournament_id: tournamentId, name: 'Alice', device_id: DEVICE_ID, team_id: teamAId, role: 'referee', is_leader: true
  }).select().single()
  if (refErr) throw new Error(`Referee failed: ${refErr.message}`)
  player1Id = refPlayer.id
  console.log('Alice:', player1Id)
  player2Id = await mkPlayer('Bob', teamAId, 'player')
  console.log('Bob:', player2Id)
  player3Id = await mkPlayer('Charlie', teamBId, 'player')
  console.log('Charlie:', player3Id)
  player4Id = await mkPlayer('Diana', teamBId, 'player')
  console.log('Diana:', player4Id)

  // Update referee_id
  await supabase.from('tournaments').update({ referee_id: player1Id }).eq('id', tournamentId)

  // Get a built-in game type
  const { data: gameTypes } = await supabase.from('game_types').select('id').is('tournament_id', null).limit(2)

  // Create 2 completed games
  console.log('gameTypes:', gameTypes)
  const { data: g1, error: g1Err } = await supabase.from('games').insert({
    tournament_id: tournamentId, game_type_id: gameTypes[0].id, status: 'completed', picked_by_team: teamAId, game_order: 1
  }).select().single()
  if (g1Err) throw new Error(`Game 1 failed: ${g1Err.message}`)
  game1Id = g1.id

  const { data: g2 } = await supabase.from('games').insert({
    tournament_id: tournamentId, game_type_id: gameTypes[1].id, status: 'completed', picked_by_team: teamBId, game_order: 2
  }).select().single()
  game2Id = g2.id

  // Submit stats for both games — Alice and Bob submit in both, Charlie in game2 only, Diana never
  for (const gameId of [game1Id, game2Id]) {
    await supabase.from('player_stats').insert([
      { game_id: gameId, player_id: player1Id, stat_key: 'cups_made', stat_value: 5 },
      { game_id: gameId, player_id: player2Id, stat_key: 'cups_made', stat_value: 3 },
    ])
  }
  await supabase.from('player_stats').insert([
    { game_id: game2Id, player_id: player3Id, stat_key: 'cups_made', stat_value: 7 },
  ])

  // Game results
  await supabase.from('game_results').insert([
    { game_id: game1Id, winning_team_id: teamAId, result_data: {} },
    { game_id: game2Id, winning_team_id: teamBId, result_data: {} },
  ])

  // Save game-level titles
  // Game 1: Alice gets 2 titles, Bob gets 1
  await supabase.from('titles').insert([
    { tournament_id: tournamentId, game_id: game1Id, player_id: player1Id, title_name: 'Sniper', title_desc: 'Most cups', is_funny: false, points: 0.5 },
    { tournament_id: tournamentId, game_id: game1Id, player_id: player1Id, title_name: 'Clutch', title_desc: 'Clutch play', is_funny: false, points: 0.5 },
    { tournament_id: tournamentId, game_id: game1Id, player_id: player2Id, title_name: 'Support', title_desc: 'Fewest cups', is_funny: true, points: 0.5 },
  ])
  // Game 2: Charlie gets 2 titles, Alice gets 1
  await supabase.from('titles').insert([
    { tournament_id: tournamentId, game_id: game2Id, player_id: player3Id, title_name: 'Rage Monster', title_desc: 'Most sinks', is_funny: false, points: 0.5 },
    { tournament_id: tournamentId, game_id: game2Id, player_id: player3Id, title_name: 'MVP Round', title_desc: 'Best round', is_funny: false, points: 0.5 },
    { tournament_id: tournamentId, game_id: game2Id, player_id: player1Id, title_name: 'Consistent', title_desc: 'Steady play', is_funny: false, points: 0.5 },
  ])

  // Update team points based on titles
  // Alpha: Alice(1.5) + Bob(0.5) = 2.0
  // Beta: Charlie(1.0) = 1.0
  await supabase.from('teams').update({ total_points: 2.0 }).eq('id', teamAId)
  await supabase.from('teams').update({ total_points: 1.0 }).eq('id', teamBId)

  console.log(`Tournament: ${tournamentId}, Room: ${roomCode}\n`)
}

async function cleanup() {
  console.log('\n🧹 Cleaning up...')
  // Delete in correct order
  await supabase.from('titles').delete().eq('tournament_id', tournamentId)
  await supabase.from('player_stats').delete().in('game_id', [game1Id, game2Id])
  await supabase.from('game_results').delete().in('game_id', [game1Id, game2Id])
  await supabase.from('games').delete().eq('tournament_id', tournamentId)
  await supabase.from('players').delete().eq('tournament_id', tournamentId)
  await supabase.from('teams').delete().eq('tournament_id', tournamentId)
  await supabase.from('tournaments').delete().eq('id', tournamentId)
}

async function runTests() {
  await setup()

  // Test 1: Fetch ceremony data returns correct structure
  await test('fetchCeremonyData — returns tournament, teams, games', async () => {
    const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
    assert(tournament, 'Tournament exists')
    assert(tournament.status === 'completed', 'Tournament is completed')

    const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('total_points', { ascending: false })
    assert(teams.length === 2, 'Two teams exist')
    assert(teams[0].name === 'Alpha', 'Alpha has more points')
    assert(teams[0].total_points === 2.0, `Alpha has 2.0 pts (got ${teams[0].total_points})`)
  })

  // Test 2: Game-level titles exist
  await test('Game-level titles — 6 titles across 2 games', async () => {
    const { data: titles } = await supabase.from('titles').select('*').eq('tournament_id', tournamentId).not('game_id', 'is', null)
    assert(titles.length === 6, `Expected 6 game titles, got ${titles.length}`)
  })

  // Test 3: Global title calculation — MVP
  await test('Global titles — MVP goes to Alice (most titles: 3)', async () => {
    // Alice has 3 titles (Sniper, Clutch, Consistent), Bob has 1, Charlie has 2
    const { data: titles } = await supabase.from('titles').select('*').eq('tournament_id', tournamentId).not('game_id', 'is', null)
    const counts = {}
    for (const t of titles) {
      counts[t.player_id] = (counts[t.player_id] || 0) + 1
    }
    const maxCount = Math.max(...Object.values(counts))
    assert(maxCount === 3, `Max title count should be 3, got ${maxCount}`)
    assert(counts[player1Id] === 3, `Alice should have 3 titles, got ${counts[player1Id]}`)
  })

  // Test 4: Global title calculation — Iron Man
  await test('Global titles — Iron Man for Alice and Bob (stats in every game)', async () => {
    // Alice and Bob submitted stats in both games, Charlie only in game 2, Diana never
    const { data: stats } = await supabase.from('player_stats').select('player_id, game_id').in('game_id', [game1Id, game2Id])
    
    const gamesByPlayer = {}
    for (const s of stats) {
      if (!gamesByPlayer[s.player_id]) gamesByPlayer[s.player_id] = new Set()
      gamesByPlayer[s.player_id].add(s.game_id)
    }
    
    assert(gamesByPlayer[player1Id]?.size === 2, 'Alice has stats in 2 games')
    assert(gamesByPlayer[player2Id]?.size === 2, 'Bob has stats in 2 games')
    assert((gamesByPlayer[player3Id]?.size || 0) === 1, 'Charlie has stats in 1 game')
    assert(!gamesByPlayer[player4Id], 'Diana has no stats')
  })

  // Test 5: Global title calculation — Ghost
  await test('Global titles — Ghost for Diana (zero titles)', async () => {
    const { data: titles } = await supabase.from('titles').select('*').eq('tournament_id', tournamentId).eq('player_id', player4Id)
    assert(titles.length === 0, `Diana should have 0 titles, got ${titles.length}`)
  })

  // Test 6: Can save global titles (game_id = null)
  await test('Save global titles — INSERT with game_id = null succeeds', async () => {
    const { data, error } = await supabase.from('titles').insert({
      tournament_id: tournamentId,
      game_id: null,
      player_id: player1Id,
      title_name: 'MVP',
      title_desc: 'Most titles overall',
      is_funny: false,
      points: 1.0
    }).select().single()

    assert(!error, `Insert failed: ${error?.message}`)
    assert(data.game_id === null, 'game_id should be null')
    assert(data.title_name === 'MVP', 'Title name should be MVP')
    assert(data.points === 1.0, 'Points should be 1.0')
  })

  // Test 7: Global titles are distinguishable from game titles
  await test('Global vs game titles — can filter by game_id IS NULL', async () => {
    const { data: globalTitles } = await supabase.from('titles').select('*').eq('tournament_id', tournamentId).is('game_id', null)
    const { data: gameTitles } = await supabase.from('titles').select('*').eq('tournament_id', tournamentId).not('game_id', 'is', null)
    
    assert(globalTitles.length >= 1, `Should have at least 1 global title, got ${globalTitles.length}`)
    assert(gameTitles.length === 6, `Should have 6 game titles, got ${gameTitles.length}`)
  })

  // Test 8: Winning team determination
  await test('Winning team — Alpha wins with 2.0 > 1.0', async () => {
    const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('total_points', { ascending: false })
    assert(teams[0].total_points > teams[1].total_points, 'Alpha should be ahead')
    assert(teams[0].name === 'Alpha', 'Alpha should be the winner')
  })

  // Test 9: Title leaderboard calculation
  await test('Title leaderboard — Alice leads with 3 game titles', async () => {
    const { data: titles } = await supabase.from('titles').select('*').eq('tournament_id', tournamentId).not('game_id', 'is', null)
    const counts = {}
    for (const t of titles) counts[t.player_id] = (counts[t.player_id] || 0) + 1
    
    const leaderboard = Object.entries(counts).sort(([, a], [, b]) => b - a)
    assert(leaderboard[0][0] === player1Id, 'Alice should lead')
    assert(leaderboard[0][1] === 3, 'Alice should have 3 titles')
  })

  // Test 10: Ceremony data includes completed games with types
  await test('Ceremony data — games have game_type join', async () => {
    const { data: games } = await supabase.from('games')
      .select('*, game_type:game_types(*)')
      .eq('tournament_id', tournamentId)
      .eq('status', 'completed')
    
    assert(games.length === 2, `Should have 2 completed games, got ${games.length}`)
    assert(games[0].game_type !== null, 'Game should have game_type join')
    assert(games[0].game_type.name, 'Game type should have a name')
  })

  // Test 11: RLS — can read all ceremony data as anon
  await test('RLS — anon can read titles, teams, games, players', async () => {
    const { error: e1 } = await supabase.from('titles').select('*').eq('tournament_id', tournamentId)
    const { error: e2 } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId)
    const { error: e3 } = await supabase.from('games').select('*').eq('tournament_id', tournamentId)
    const { error: e4 } = await supabase.from('players').select('*').eq('tournament_id', tournamentId)
    
    assert(!e1, `Titles read failed: ${e1?.message}`)
    assert(!e2, `Teams read failed: ${e2?.message}`)
    assert(!e3, `Games read failed: ${e3?.message}`)
    assert(!e4, `Players read failed: ${e4?.message}`)
  })

  // Test 12: Tie scenario
  await test('Tie detection — equal points detected', async () => {
    // Temporarily set both teams to same points
    await supabase.from('teams').update({ total_points: 2.0 }).eq('id', teamBId)
    
    const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('total_points', { ascending: false })
    assert(teams[0].total_points === teams[1].total_points, 'Teams should be tied')
    
    // Restore
    await supabase.from('teams').update({ total_points: 1.0 }).eq('id', teamBId)
  })

  await cleanup()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Sprint 7 Results: ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(50)}`)
  
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('Fatal error:', err)
  cleanup().then(() => process.exit(1))
})
