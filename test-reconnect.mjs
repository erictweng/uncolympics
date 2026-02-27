import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  'https://uohruuyjmcgemdyxhnnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaHJ1dXlqbWNnZW1keXhobm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjQyMTgsImV4cCI6MjA4NzE0MDIxOH0.kPBhoTNOAD5z7qLhOMl29VggJdsPvCuZ4_3lFJDLgks'
)

const deviceId = crypto.randomUUID()
let tournamentId, playerId
let testsPassed = 0
let testsFailed = 0

console.log('=== UNCOLYMPICS RECONNECT FLOW INTEGRATION TESTS ===')
console.log('device_id:', deviceId)
console.log()

function logTest(testName, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  if (passed) testsPassed++
  else testsFailed++
  console.log(`${status} - ${testName}${message ? ' - ' + message : ''}`)
}

// Helper function to call reconnectPlayer equivalent
async function reconnectPlayer(deviceId) {
  const { data, error } = await supabase
    .from('players')
    .select('*, tournament:tournaments!fk_players_tournament(*)')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.log('reconnectPlayer error:', error)
    return null
  }

  // Find first player with non-completed tournament
  const match = data?.find(r => r.tournament && r.tournament.status !== 'completed')
  return match || null
}

// Setup: Create tournament and player
console.log('--- SETUP: Create tournament and player ---')
const { data: tournament, error: tErr } = await supabase
  .from('tournaments')
  .insert({
    name: 'Reconnect Test Tournament',
    room_code: 'RTEST',
    num_games: 3,
    time_est_min: 60,
    status: 'lobby',
    current_pick_team: null
  })
  .select()
  .single()

if (tErr) {
  console.log('❌ SETUP FAILED - Cannot create tournament:', tErr.message)
  process.exit(1)
}

tournamentId = tournament.id
console.log('✅ Tournament created:', tournamentId)

const { data: player, error: pErr } = await supabase
  .from('players')
  .insert({
    tournament_id: tournamentId,
    name: 'TestPlayer',
    device_id: deviceId,
    role: 'player',
    is_leader: false,
    team_id: null
  })
  .select()
  .single()

if (pErr) {
  console.log('❌ SETUP FAILED - Cannot create player:', pErr.message)
  process.exit(1)
}

playerId = player.id
console.log('✅ Player created:', playerId)
console.log()

// TEST 1: Basic reconnect after status change
console.log('--- TEST 1: Basic reconnect after status change ---')

// 1.1: Initial reconnect in lobby status
let reconnectResult = await reconnectPlayer(deviceId)
logTest('T1.1: Initial reconnect in lobby', 
  reconnectResult && reconnectResult.tournament && reconnectResult.tournament.status === 'lobby',
  `Status: ${reconnectResult?.tournament?.status || 'null'}`)

// 1.2: Update to team_select and reconnect
const { error: updateErr1 } = await supabase
  .from('tournaments')
  .update({ status: 'team_select' })
  .eq('id', tournamentId)

if (updateErr1) {
  logTest('T1.2: Update to team_select', false, updateErr1.message)
} else {
  reconnectResult = await reconnectPlayer(deviceId)
  logTest('T1.2: Reconnect after team_select update', 
    reconnectResult && reconnectResult.tournament && reconnectResult.tournament.status === 'team_select',
    `Status: ${reconnectResult?.tournament?.status || 'null'}`)
}

// 1.3: Update to picking and reconnect
const { error: updateErr2 } = await supabase
  .from('tournaments')
  .update({ status: 'picking' })
  .eq('id', tournamentId)

if (updateErr2) {
  logTest('T1.3: Update to picking', false, updateErr2.message)
} else {
  reconnectResult = await reconnectPlayer(deviceId)
  logTest('T1.3: Reconnect after picking update', 
    reconnectResult && reconnectResult.tournament && reconnectResult.tournament.status === 'picking',
    `Status: ${reconnectResult?.tournament?.status || 'null'}`)
}

console.log()

// TEST 2: Reconnect should fail after leaving
console.log('--- TEST 2: Reconnect should fail after leaving ---')

// 2.1: Delete player (simulate leaving lobby)
const { error: deletePlayerErr } = await supabase
  .from('players')
  .delete()
  .eq('id', playerId)

if (deletePlayerErr) {
  logTest('T2.1: Delete player', false, deletePlayerErr.message)
} else {
  console.log('✅ Player deleted (simulating leave lobby)')
  
  // 2.2: Try to reconnect - should fail
  reconnectResult = await reconnectPlayer(deviceId)
  logTest('T2.2: Reconnect after leaving', 
    reconnectResult === null,
    `Result: ${reconnectResult ? 'found player' : 'null (expected)'}`)
}

console.log()

// TEST 3: Reconnect should fail for completed tournaments
console.log('--- TEST 3: Reconnect should fail for completed tournaments ---')

// 3.1: Re-create player
const { data: newPlayer, error: newPlayerErr } = await supabase
  .from('players')
  .insert({
    tournament_id: tournamentId,
    name: 'TestPlayer',
    device_id: deviceId,
    role: 'player',
    is_leader: false,
    team_id: null
  })
  .select()
  .single()

if (newPlayerErr) {
  logTest('T3.1: Re-create player', false, newPlayerErr.message)
} else {
  playerId = newPlayer.id
  console.log('✅ Player re-created:', playerId)
  
  // 3.2: Update tournament to completed
  const { error: updateErr3 } = await supabase
    .from('tournaments')
    .update({ status: 'completed' })
    .eq('id', tournamentId)

  if (updateErr3) {
    logTest('T3.2: Update to completed', false, updateErr3.message)
  } else {
    // 3.3: Try to reconnect - should fail because completed tournaments are filtered out
    reconnectResult = await reconnectPlayer(deviceId)
    logTest('T3.3: Reconnect with completed tournament', 
      reconnectResult === null,
      `Result: ${reconnectResult ? 'found player (unexpected)' : 'null (expected)'}`)
  }
}

console.log()

// CLEANUP
console.log('--- CLEANUP ---')
const { error: cleanupErr } = await supabase
  .from('tournaments')
  .delete()
  .eq('id', tournamentId)

if (cleanupErr) {
  console.log('❌ Cleanup failed:', cleanupErr.message)
} else {
  console.log('✅ Test tournament deleted')
}

console.log()
console.log('=== TEST SUMMARY ===')
console.log(`Total tests: ${testsPassed + testsFailed}`)
console.log(`Passed: ${testsPassed}`)
console.log(`Failed: ${testsFailed}`)

if (testsFailed === 0) {
  console.log('🎉 ALL TESTS PASSED!')
} else {
  console.log('⚠️  Some tests failed')
}